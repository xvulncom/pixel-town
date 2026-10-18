// 画布、画笔和几个通用小工具，所有画图代码共用。

import { deflateSync, crc32 } from 'node:zlib';

export const TILE = 16;
export const COLS = 16;
export const EMPTY = -1;

// ---------- PNG ----------

export class Canvas {
    readonly w: number;
    readonly h: number;
    readonly px: Uint8Array;

    constructor(w: number, h: number) {
        this.w = w;
        this.h = h;
        this.px = new Uint8Array(w * h * 4);
    }

    set(x: number, y: number, c: number, a = 255): void {
        x = Math.floor(x);
        y = Math.floor(y);
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
        const i = (y * this.w + x) * 4;
        this.px[i] = (c >> 16) & 0xff;
        this.px[i + 1] = (c >> 8) & 0xff;
        this.px[i + 2] = c & 0xff;
        this.px[i + 3] = a;
    }

    /** 按透明度叠到已有像素上，预览图用。 */
    blend(x: number, y: number, r: number, g: number, b: number, a: number): void {
        if (x < 0 || y < 0 || x >= this.w || y >= this.h || a === 0) return;
        const i = (y * this.w + x) * 4;
        const k = a / 255;
        this.px[i] = Math.round(r * k + this.px[i] * (1 - k));
        this.px[i + 1] = Math.round(g * k + this.px[i + 1] * (1 - k));
        this.px[i + 2] = Math.round(b * k + this.px[i + 2] * (1 - k));
        this.px[i + 3] = 255;
    }

    toPng(): Buffer {
        const stride = this.w * 4;
        const raw = Buffer.alloc((stride + 1) * this.h);
        for (let y = 0; y < this.h; y++) {
            raw[y * (stride + 1)] = 0;
            Buffer.from(this.px.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
        }
        const chunk = (type: string, data: Buffer): Buffer => {
            const len = Buffer.alloc(4);
            len.writeUInt32BE(data.length);
            const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
            const crc = Buffer.alloc(4);
            crc.writeUInt32BE(crc32(td));
            return Buffer.concat([len, td, crc]);
        };
        const ihdr = Buffer.alloc(13);
        ihdr.writeUInt32BE(this.w, 0);
        ihdr.writeUInt32BE(this.h, 4);
        ihdr[8] = 8;
        ihdr[9] = 6;
        return Buffer.concat([
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
            chunk('IHDR', ihdr),
            chunk('IDAT', deflateSync(raw)),
            chunk('IEND', Buffer.alloc(0)),
        ]);
    }
}

export type Rnd = () => number;

/** 画笔：P 画点，R 画矩形，E 画椭圆，坐标相对画布。 */
export class Pen {
    constructor(readonly c: Canvas, readonly r: Rnd) {}
    P(x: number, y: number, col: number, a = 255): void {
        this.c.set(x, y, col, a);
    }
    R(x: number, y: number, w: number, h: number, col: number, a = 255): void {
        for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) this.c.set(x + xx, y + yy, col, a);
    }
    /** 把已有的不透明像素压暗，k 是保留的亮度比例。画投在物体上的影子用。 */
    D(x: number, y: number, w: number, h: number, k: number): void {
        for (let yy = y; yy < y + h; yy++) {
            for (let xx = x; xx < x + w; xx++) {
                if (xx < 0 || yy < 0 || xx >= this.c.w || yy >= this.c.h) continue;
                const i = (yy * this.c.w + xx) * 4;
                if (this.c.px[i + 3] < 255) continue;
                for (let j = 0; j < 3; j++) this.c.px[i + j] = Math.round(this.c.px[i + j] * k);
            }
        }
    }
    E(cx: number, cy: number, rx: number, ry: number, col: (dx: number, dy: number) => number | null): void {
        for (let y = -ry; y <= ry; y++) {
            for (let x = -rx; x <= rx; x++) {
                if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) {
                    const c = col(x, y);
                    if (c !== null) this.c.set(cx + x, cy + y, c);
                }
            }
        }
    }
}

/** 平滑的值噪声：每 cell 格一个随机值，中间双线性插值，返回 0~1。用来让草丛、花、树种成片出现。 */
export function noise2d(r: Rnd, cell: number): (x: number, y: number) => number {
    const gw = 64;
    const grid = Array.from({ length: gw * gw }, () => r());
    const g = (i: number, j: number) => grid[(j % gw) * gw + (i % gw)];
    const smooth = (t: number) => t * t * (3 - 2 * t);
    return (x, y) => {
        const fx = x / cell;
        const fy = y / cell;
        const i = Math.floor(fx);
        const j = Math.floor(fy);
        const tx = smooth(fx - i);
        const ty = smooth(fy - j);
        const top = g(i, j) * (1 - tx) + g(i + 1, j) * tx;
        const bot = g(i, j + 1) * (1 - tx) + g(i + 1, j + 1) * tx;
        return top * (1 - ty) + bot * ty;
    };
}

export function pick<T>(r: Rnd, arr: readonly T[], weights: number[]): T {
    let v = r();
    for (let i = 0; i < arr.length; i++) {
        v -= weights[i];
        if (v < 0) return arr[i];
    }
    return arr[arr.length - 1];
}


/** 先在一张小画布上画好纹理，再按像素取色，给地形图块当内部填充。 */
export function texture(r: Rnd, fill: (p: Pen) => void): (x: number, y: number) => number {
    const c = new Canvas(TILE, TILE);
    fill(new Pen(c, r));
    return (x, y) => {
        const i = (y * TILE + x) * 4;
        return (c.px[i] << 16) | (c.px[i + 1] << 8) | c.px[i + 2];
    };
}


/** 地上的半透明椭圆影子。 */
export function groundShadow(p: Pen, cx: number, cy: number, rx: number, ry: number, a = 60): void {
    for (let y = -ry; y <= ry; y++) {
        for (let x = -rx; x <= rx; x++) {
            if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) p.P(cx + x, cy + y, 0x000000, a);
        }
    }
}

/** 统一的江南暖色调：红稍提、蓝稍压，整张图偏暖、不那么"荧光绿"。透明像素不动。 */
export function warmGrade(c: Canvas): void {
    for (let i = 0; i < c.px.length; i += 4) {
        if (c.px[i + 3] === 0) continue;
        const r = c.px[i];
        const g = c.px[i + 1];
        const b = c.px[i + 2];
        // 先轻微去饱和，再往暖里推
        const l = (r * 3 + g * 6 + b) / 10;
        const mix = (v: number) => v * 0.9 + l * 0.1;
        c.px[i] = Math.min(255, Math.round(mix(r) * 1.04 + 4));
        c.px[i + 1] = Math.min(255, Math.round(mix(g) * 1.0 + 1));
        c.px[i + 2] = Math.min(255, Math.round(mix(b) * 0.92));
    }
}
