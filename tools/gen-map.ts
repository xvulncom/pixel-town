// 用代码画像素图块和江南水乡地图（Tiled .tmx）。正式美术到位前用它，画风与参考图一致。
// 用法：npx tsx tools/gen-map.ts [--preview <目录>]
// 输出：assets/resources/maps/town-tiles.png、assets/resources/maps/jiangnan.tmx
//
// 地形（土路、水面、耕地、石板）按上下左右四邻是否同类自动选边缘图块，每种 16 块；
// 房子、树、桥、船、小人是多格大图，画完切成 16px 小块放进图块集。物体尺寸照星露谷。
// 图层：ground 地面，deco 物体底部（挡路），over 物体上半部分（盖在人物头上）。

import { deflateSync, crc32 } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mulberry32 } from '../assets/scripts/core/rng';

const TILE = 16;
const COLS = 16;
const EMPTY = -1;

// ---------- PNG ----------

class Canvas {
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

type Rnd = () => number;

/** 画笔：P 画点，R 画矩形，E 画椭圆，坐标相对画布。 */
class Pen {
    constructor(readonly c: Canvas, readonly r: Rnd) {}
    P(x: number, y: number, col: number, a = 255): void {
        this.c.set(x, y, col, a);
    }
    R(x: number, y: number, w: number, h: number, col: number, a = 255): void {
        for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) this.c.set(x + xx, y + yy, col, a);
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

// ---------- 调色板 ----------

const C = {
    grass: [0x5d9e43, 0x68ab4a, 0x559339, 0x72b552],
    blade: 0x3f7a2c,
    dirt: [0xc9a46a, 0xbd955b, 0xd8b67d],
    dirtEdge: 0xa98a52,
    bank: 0x7a6a48,
    bankLight: 0x8f7d55,
    water: [0x3d6f8f, 0x4a86ad, 0x4f93bd],
    shine: 0x9fd3ee,
    shine2: 0xc9eaf8,
    soil: 0x6a4a2e,
    soilLight: 0x7e5a3a,
    soilDark: 0x55391f,
    soilEdge: 0x7a5a3a,
    stone: [0xb4b0a6, 0xa9a59b, 0xbdb9ae],
    mortar: 0x8a867e,
    stoneEdge: 0x7d7d76,
    wall: 0xf1eee4,
    wallShade: 0xd9d5c7,
    plinth: 0x8e8a80,
    plinthJoint: 0x6f6b62,
    roof: [0x3a3f47, 0x4a515b],
    roofRib: 0x2e3239,
    roofEdge: 0x262a30,
    wood: 0x6b3f22,
    woodLight: 0x7d4a29,
    woodDark: 0x5a3a24,
    lattice: 0x8a5a34,
    paper: 0xf3d892,
    gold: 0xe3b341,
    red: 0xc9302c,
    redLight: 0xef5a43,
    trunk: 0x5b3b24,
    trunkLight: 0x6d4a2e,
    leaf: [0x2f6b2a, 0x3f8a36, 0x5ea64a, 0x2a5e25],
    willow: [0x2c5e26, 0x3d7a2e, 0x4f9038, 0x8cc860],
    skin: 0xf1c9a0,
    eye: 0x2b2420,
    shadow: 0x000000,
};

// ---------- 图块集 ----------

class Sheet {
    readonly tiles: Canvas[] = [];
    private seed = 1000;

    /** 加一个 16px 图块，返回编号。 */
    add(paint: (p: Pen) => void): number {
        const c = new Canvas(TILE, TILE);
        paint(new Pen(c, mulberry32(this.seed++)));
        this.tiles.push(c);
        return this.tiles.length - 1;
    }

    /** 画一张 w×h 格的大图，切成小块，返回 [行][列] 编号；全透明的块记为 EMPTY。 */
    sprite(w: number, h: number, paint: (p: Pen) => void): number[][] {
        const big = new Canvas(w * TILE, h * TILE);
        paint(new Pen(big, mulberry32(this.seed++)));
        const grid: number[][] = [];
        for (let ty = 0; ty < h; ty++) {
            const row: number[] = [];
            for (let tx = 0; tx < w; tx++) {
                const c = new Canvas(TILE, TILE);
                let solid = false;
                for (let y = 0; y < TILE; y++) {
                    for (let x = 0; x < TILE; x++) {
                        const si = ((ty * TILE + y) * big.w + tx * TILE + x) * 4;
                        const di = (y * TILE + x) * 4;
                        for (let k = 0; k < 4; k++) c.px[di + k] = big.px[si + k];
                        if (big.px[si + 3] > 0) solid = true;
                    }
                }
                if (solid) {
                    this.tiles.push(c);
                    row.push(this.tiles.length - 1);
                } else {
                    row.push(EMPTY);
                }
            }
            grid.push(row);
        }
        return grid;
    }

    toCanvas(): Canvas {
        const rows = Math.ceil(this.tiles.length / COLS);
        const out = new Canvas(COLS * TILE, rows * TILE);
        this.tiles.forEach((t, i) => {
            const ox = (i % COLS) * TILE;
            const oy = Math.floor(i / COLS) * TILE;
            for (let y = 0; y < TILE; y++) {
                for (let x = 0; x < TILE; x++) {
                    const si = (y * TILE + x) * 4;
                    const di = ((oy + y) * out.w + ox + x) * 4;
                    for (let k = 0; k < 4; k++) out.px[di + k] = t.px[si + k];
                }
            }
        });
        return out;
    }
}

function pick<T>(r: Rnd, arr: readonly T[], weights: number[]): T {
    let v = r();
    for (let i = 0; i < arr.length; i++) {
        v -= weights[i];
        if (v < 0) return arr[i];
    }
    return arr[arr.length - 1];
}

function grassFill(p: Pen): void {
    for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) p.P(x, y, pick(p.r, C.grass, [0.55, 0.25, 0.13, 0.07]));
    }
}

function blade(p: Pen, x: number, y: number): void {
    p.P(x, y, C.blade);
    p.P(x + 1, y - 1, C.blade);
    p.P(x + 2, y, C.blade);
}

function grassTile(p: Pen, kind: 'plain' | 'plain2' | 'tuft' | 'flowers'): void {
    grassFill(p);
    const n = kind === 'tuft' ? 5 : kind === 'plain2' ? 2 : 1;
    for (let i = 0; i < n; i++) blade(p, 1 + Math.floor(p.r() * 12), 2 + Math.floor(p.r() * 13));
    if (kind === 'flowers') {
        const cols = [0xf4e27a, 0xf7f7f2, 0xe98fa6];
        for (let i = 0; i < 3; i++) {
            const x = 2 + Math.floor(p.r() * 12);
            const y = 2 + Math.floor(p.r() * 12);
            p.P(x, y, cols[i]);
            p.P(x + 1, y + 1, C.blade);
        }
    }
}

// 四邻掩码：同类邻居对应位为 1
const N = 1;
const E = 2;
const S = 4;
const W_ = 8;

/** 地形图块：开口的一侧露出草地，边缘锯齿随机。paint 拿到离草地的距离 k（0 是最外一圈）。 */
function terrainTile(p: Pen, mask: number, margin: number, jagMax: number, paint: (x: number, y: number, k: number) => number): void {
    grassFill(p);
    const jag = () => Array.from({ length: TILE }, () => Math.floor(p.r() * (jagMax + 1)));
    const jn = jag();
    const js = jag();
    const je = jag();
    const jw = jag();
    for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
            let k = 99;
            if (!(mask & N)) k = Math.min(k, y - margin - jn[x]);
            if (!(mask & S)) k = Math.min(k, TILE - 1 - y - margin - js[x]);
            if (!(mask & W_)) k = Math.min(k, x - margin - jw[y]);
            if (!(mask & E)) k = Math.min(k, TILE - 1 - x - margin - je[y]);
            if (k >= 0) p.P(x, y, paint(x, y, k));
        }
    }
}

function dirtPaint(r: Rnd) {
    return (_x: number, _y: number, k: number) => (k === 0 ? C.dirtEdge : pick(r, C.dirt, [0.6, 0.3, 0.1]));
}

/** frame 只影响开阔水面上的反光位置，用来做水面动画。 */
function waterPaint(frame: number) {
    return (x: number, y: number, k: number) => {
        if (k < 2) return k === 0 && (x + y) % 5 === 0 ? C.bankLight : C.bank;
        if (k < 3) return C.water[0];
        if (k < 5) return C.water[1];
        for (const [row, off] of [[3, 0], [8, 9], [13, 4]]) {
            const sx = (off + frame * 3) % TILE;
            const dx = (x - sx + TILE) % TILE;
            if (y === row && dx < 4) return C.shine;
            if (y === row + 1 && dx >= 1 && dx < 3) return C.shine2;
        }
        return C.water[2];
    };
}

function soilPaint(r: Rnd) {
    return (_x: number, y: number, k: number) => {
        if (k === 0) return C.soilEdge;
        const m = y % 4;
        if (m === 0) return C.soilLight;
        if (m === 3) return C.soilDark;
        return r() < 0.1 ? C.soilDark : C.soil;
    };
}

function stonePaint() {
    return (x: number, y: number, k: number) => {
        if (k === 0) return C.stoneEdge;
        const row = Math.floor(y / 6);
        const off = row % 2 === 0 ? 0 : 4;
        if (y % 6 === 5 || (x + off) % 8 === 7) return C.mortar;
        return C.stone[(row * 3 + Math.floor((x + off) / 8)) % 3];
    };
}

// ---------- 大图（尺寸照星露谷：小人 1×2 格，树 3×5，民居 6×5） ----------

function lanternAt(p: Pen, x: number, y: number): void {
    p.R(x, y - 3, 1, 3, 0x3b2a1e);
    p.E(x, y + 4, 3, 4, (dx) => (dx < -1 ? C.red : dx > 1 ? 0xa82724 : C.redLight));
    p.R(x - 2, y, 5, 1, C.gold);
    p.R(x - 2, y + 8, 5, 1, C.gold);
    p.R(x, y + 9, 1, 3, C.gold);
}

/** 江南民居：w×h 格，白墙黛瓦，飞檐翘角。 */
function house(p: Pen, w: number, h: number, sign: 'none' | 'shop' | 'workshop'): void {
    const pw = w * TILE;
    const ph = h * TILE;
    const wy = Math.round(ph * 0.48);
    const base = ph - 3;
    p.R(4, base, pw - 4, 3, C.shadow, 64);

    p.R(2, wy, pw - 4, base - wy, C.wall);
    p.R(pw - 5, wy, 3, base - wy, C.wallShade);
    p.R(2, wy, pw - 4, 2, 0xc9c4b5);
    p.R(2, base - 4, pw - 4, 4, C.plinth);
    for (let i = 6; i < pw - 6; i += 10) p.R(i, base - 4, 1, 4, C.plinthJoint);

    const ry = 7;
    for (let j = 0; ry + j < wy; j++) {
        const ex = Math.max(0, 4 - j);
        p.R(1 + ex, ry + j, pw - 2 - 2 * ex, 1, j % 3 === 0 ? C.roof[0] : C.roof[1]);
    }
    for (let i = 3; i < pw - 3; i += 3) p.R(i, ry + 1, 1, wy - ry - 3, C.roofRib);
    p.R(0, wy - 2, pw, 2, C.roofEdge);
    for (const [x, d] of [[0, 1], [pw - 1, -1]]) {
        p.P(x, wy - 3, C.roofEdge);
        p.P(x, wy - 4, C.roofEdge);
        p.P(x + d, wy - 3, C.roofEdge);
    }
    p.R(3, ry - 2, pw - 6, 3, C.roofEdge);
    p.R(4, ry - 2, pw - 8, 1, 0x3a3f47);
    for (const x of [1, pw - 3]) p.R(x, ry - 4, 2, 2, C.roofEdge);

    const dw = 12;
    const dh = 20;
    const dx = Math.floor(pw / 2) - dw / 2;
    const dy = base - dh;
    p.R(dx - 1, dy - 1, dw + 2, dh + 1, C.woodDark);
    p.R(dx, dy, dw, dh, C.wood);
    p.R(dx + 1, dy + 1, 4, dh - 1, C.woodLight);
    p.R(dx + 7, dy + 1, 4, dh - 1, C.woodLight);
    p.R(dx + 5, dy + 9, 2, 2, C.gold);
    p.R(dx - 2, base - 1, dw + 4, 1, 0x9b968b);

    const winY = wy + 8;
    const slots: number[] = [];
    for (let x = 8; x + 14 <= dx - 4; x += 20) slots.push(x);
    for (let x = pw - 8 - 14; x >= dx + dw + 4; x -= 20) slots.push(x);
    for (const ox of slots) {
        p.R(ox, winY, 14, 12, C.woodDark);
        p.R(ox + 1, winY + 1, 12, 10, C.paper);
        for (let k = 2; k < 13; k += 3) p.R(ox + k, winY + 1, 1, 10, C.lattice);
        p.R(ox + 1, winY + 5, 12, 1, C.lattice);
        p.R(ox, winY + 12, 14, 1, 0xc9c4b5);
    }

    if (sign === 'shop') {
        const sx = Math.floor(pw / 2) - 15;
        p.R(sx, wy + 3, 30, 8, 0x8e2621);
        p.R(sx + 1, wy + 4, 28, 6, 0xd24a3d);
        for (let k = 0; k < 4; k++) p.R(sx + 4 + k * 6, wy + 6, 3, 2, C.paper);
        lanternAt(p, 6, wy + 1);
        lanternAt(p, pw - 7, wy + 1);
    } else if (sign === 'workshop') {
        const sx = Math.floor(pw / 2) - 13;
        p.R(sx, wy + 3, 26, 7, C.woodDark);
        p.R(sx + 1, wy + 4, 24, 5, C.lattice);
        for (let k = 0; k < 3; k++) p.R(sx + 5 + k * 7, wy + 6, 3, 2, 0xe3c58a);
        for (const [lx, ly] of [[dx + dw + 6, base - 5], [dx + dw + 12, base - 5], [dx + dw + 9, base - 10]]) {
            p.E(lx, ly, 3, 3, (ddx, ddy) => (ddx * ddx + ddy * ddy < 3 ? 0xd9b37a : 0x8a5a34));
        }
    }
}

function roundTree(p: Pen): void {
    p.E(24, 76, 12, 3, () => C.shadow);
    for (let y = 72; y < 80; y++) for (let x = 10; x < 38; x++) {
        const i = (y * 48 + x) * 4;
        if (p.c.px[i + 3] === 255 && p.c.px[i] === 0 && p.c.px[i + 1] === 0) p.c.px[i + 3] = 60;
    }
    p.R(21, 40, 6, 36, C.trunk);
    p.R(22, 40, 2, 36, C.trunkLight);
    p.R(19, 72, 10, 4, C.trunk);
    p.R(25, 46, 1, 20, 0x4a2f1c);
    p.E(24, 26, 22, 22, (dx, dy) => {
        const d = (dx * dx + dy * dy) / 484;
        if (d > 0.86) return C.leaf[3];
        if (dx + dy > 10) return C.leaf[0];
        if (dx + dy < -14) return C.leaf[2];
        return p.r() < 0.12 ? C.leaf[0] : C.leaf[1];
    });
    for (let i = 0; i < 9; i++) {
        const cx = 10 + Math.floor(p.r() * 26);
        const cy = 10 + Math.floor(p.r() * 26);
        p.E(cx, cy, 3, 2, (dx, dy) => (dy < 0 ? C.leaf[2] : C.leaf[1]));
    }
}

function willow(p: Pen): void {
    p.R(14, 75, 20, 3, C.shadow, 60);
    p.R(22, 28, 5, 48, C.trunk);
    p.R(23, 28, 2, 48, C.trunkLight);
    p.R(20, 72, 9, 4, C.trunk);
    p.E(24, 22, 22, 14, (dx, dy) => (dy > 5 ? C.willow[0] : dx + dy < -10 ? C.willow[2] : C.willow[1]));
    for (let i = 0; i < 60; i++) {
        const a = p.r() * Math.PI * 2;
        const d = Math.sqrt(p.r()) * 0.85;
        p.P(24 + Math.cos(a) * d * 22, 20 + Math.sin(a) * d * 12, p.r() < 0.6 ? C.willow[2] : C.willow[3]);
    }
    for (let k = -21; k <= 21; k += 2) {
        const len = 18 + Math.floor(p.r() * 26);
        for (let j = 0; j < len; j++) {
            const sway = j > len * 0.6 ? Math.sign(k) : 0;
            p.P(24 + k + sway, 26 + j, j % 3 === 0 ? C.willow[2] : C.willow[0]);
        }
    }
}

function bush(p: Pen): void {
    p.R(3, 13, 11, 2, C.shadow, 56);
    p.E(8, 9, 6, 5, (dx, dy) => (dx + dy > 3 ? C.leaf[0] : dx + dy < -3 ? C.leaf[2] : C.leaf[1]));
    p.P(6, 8, 0xd24a3d);
    p.P(10, 10, 0xd24a3d);
    p.P(8, 6, 0xd24a3d);
}

function rocks(p: Pen): void {
    p.E(6, 10, 4, 3, (dx, dy) => (dy < -1 ? 0xc4c0b6 : dx + dy > 2 ? 0x7d7a72 : 0xa29e94));
    p.E(11, 12, 2, 2, (dx, dy) => (dy < 0 ? 0xc4c0b6 : 0x8f8b82));
}

/** 竖向过河的石桥：2 格宽，长度按河宽。 */
function bridgeV(p: Pen, hT: number): void {
    const ph = hT * TILE;
    for (let y = 0; y < ph; y++) {
        const mid = Math.abs(y - ph / 2) < ph * 0.25;
        for (let x = 3; x < 29; x++) {
            p.P(x, y, y % 5 === 4 ? 0x8f8f88 : mid ? 0xc4c4bc : p.r() < 0.7 ? 0xa9a9a2 : 0xb9b9b1);
        }
        for (const bx of [0, 29]) {
            p.R(bx, y, 3, 1, 0x8a8a83);
            p.P(bx + (bx === 0 ? 2 : 0), y, 0x6e6e68);
        }
    }
    for (let y = 2; y < ph; y += 8) {
        p.R(0, y, 3, 3, 0xc4c4bc);
        p.R(29, y, 3, 3, 0xc4c4bc);
    }
}

/** 横跨小河的石桥：宽按河宽，2 格高。 */
function bridgeH(p: Pen, wT: number): void {
    const pw = wT * TILE;
    for (let x = 0; x < pw; x++) {
        const mid = Math.abs(x - pw / 2) < pw * 0.25;
        for (let y = 3; y < 29; y++) {
            p.P(x, y, x % 5 === 4 ? 0x8f8f88 : mid ? 0xc4c4bc : p.r() < 0.7 ? 0xa9a9a2 : 0xb9b9b1);
        }
        for (const by of [0, 29]) {
            p.R(x, by, 1, 3, 0x8a8a83);
            p.P(x, by + (by === 0 ? 2 : 0), 0x6e6e68);
        }
    }
    for (let x = 2; x < pw; x += 8) {
        p.R(x, 0, 3, 3, 0xc4c4bc);
        p.R(x, 29, 3, 3, 0xc4c4bc);
    }
}

/** 乌篷船，4×2 格。 */
function boat(p: Pen): void {
    for (let x = 4; x < 60; x++) {
        const t = Math.abs(x - 32) / 28;
        const top = 20 - Math.round(t * 5);
        p.R(x, top, 1, Math.round(8 - t * 5) + 1, 0x4a3628);
        p.P(x, top, 0x6b4c36);
    }
    for (let x = 18; x < 46; x++) {
        const t = Math.abs(x - 32) / 14;
        const top = 6 + Math.round(t * t * 7);
        p.R(x, top, 1, 20 - top, x % 4 === 0 ? 0x3d3d3d : 0x2b2b2b);
        p.P(x, top, 0x4a4a4a);
    }
    p.R(56, 10, 1, 10, 0x8a5a34);
    p.R(8, 28, 10, 1, C.shine);
    p.R(44, 28, 12, 1, C.shine);
    p.R(24, 30, 8, 1, C.shine2);
}

function lilyPad(p: Pen): void {
    p.E(5, 6, 3, 2, (dx, dy) => (dx === 1 && dy <= 0 ? null : dy < 0 ? 0x6db054 : 0x4b8a3a));
    p.E(11, 11, 3, 2, (dx, dy) => (dx === -1 && dy <= 0 ? null : dy < 0 ? 0x6db054 : 0x4b8a3a));
    p.P(11, 9, 0xf2a6c4);
    p.P(12, 9, 0xf2a6c4);
    p.P(11, 8, 0xf7c9dc);
}

/** 挂灯笼的木杆，1×3 格。 */
function lanternPost(p: Pen): void {
    p.R(4, 44, 9, 3, C.shadow, 60);
    p.R(5, 40, 7, 5, 0x9b968b);
    p.R(5, 40, 7, 1, 0xb4b0a6);
    p.R(7, 6, 3, 34, C.woodDark);
    p.R(7, 6, 1, 34, C.lattice);
    p.R(7, 6, 8, 2, C.woodDark);
    lanternAt(p, 13, 11);
}

function fence(p: Pen): void {
    for (const x of [2, 10]) {
        p.R(x, 4, 2, 10, C.lattice);
        p.P(x, 4, 0xa8743f);
    }
    p.R(0, 6, 16, 1, 0xa8743f);
    p.R(0, 10, 16, 1, C.lattice);
    p.R(0, 14, 16, 1, C.shadow, 50);
}

/** 作物，1×2 格：下半格是根部所在的地块。 */
function crop(p: Pen, kind: 'sprout' | 'cabbage' | 'rice'): void {
    if (kind === 'sprout') {
        for (const ox of [3, 10]) {
            p.R(ox + 1, 22, 1, 6, 0x4f8a30);
            p.R(ox - 1, 22, 2, 2, 0x7cc04e);
            p.R(ox + 2, 20, 2, 2, 0x7cc04e);
            p.P(ox + 3, 24, 0x7cc04e);
        }
    } else if (kind === 'cabbage') {
        p.R(3, 29, 10, 1, C.shadow, 60);
        p.E(8, 24, 6, 5, (dx, dy) => (dy > 2 ? 0x5f9c3e : dx * dx + dy * dy < 6 ? 0xd9f2c4 : 0x8fcf6a));
        p.P(6, 22, 0xbfe8a0);
        p.P(10, 23, 0xbfe8a0);
    } else {
        for (const sx of [2, 5, 8, 11, 13]) {
            p.R(sx, 12, 1, 18, 0x9c8a2e);
            for (let y = 6; y < 13; y++) p.P(sx + (y > 9 ? 1 : 0), y, y % 2 ? 0xe8c84a : 0xd4b13c);
        }
    }
}

/** 星露谷尺寸的小人：16×32。 */
function person(p: Pen, o: { hair: number; top: number; pants: number; hat?: boolean; bun?: boolean; apron?: boolean }): void {
    p.E(8, 30, 5, 1, () => C.shadow);
    for (let y = 29; y < 32; y++) for (let x = 0; x < 16; x++) {
        const i = (y * 16 + x) * 4;
        if (p.c.px[i + 3] === 255 && p.c.px[i] === 0 && p.c.px[i + 1] === 0) p.c.px[i + 3] = 60;
    }
    p.R(5, 24, 3, 5, o.pants);
    p.R(9, 24, 3, 5, o.pants);
    p.R(5, 28, 3, 1, 0x2b2420);
    p.R(9, 28, 3, 1, 0x2b2420);
    p.R(4, 15, 8, 10, o.top);
    p.R(11, 15, 1, 10, C.shadow, 60);
    p.R(3, 16, 1, 6, o.top);
    p.R(12, 16, 1, 6, o.top);
    p.P(3, 22, C.skin);
    p.P(12, 22, C.skin);
    if (o.apron) p.R(5, 18, 6, 7, 0x8a5a34);
    p.R(5, 6, 6, 9, C.skin);
    p.R(4, 5, 8, 3, o.hair);
    p.R(4, 5, 1, 6, o.hair);
    p.R(11, 5, 1, 6, o.hair);
    if (o.bun) p.R(6, 2, 4, 3, o.hair);
    p.P(6, 10, C.eye);
    p.P(9, 10, C.eye);
    p.P(5, 12, 0xf2a6a0);
    p.P(10, 12, 0xf2a6a0);
    if (o.hat) {
        p.R(5, 1, 6, 4, 0xd8b45a);
        p.R(2, 5, 12, 1, 0xc49e45);
        p.R(5, 4, 6, 1, 0x8a5a34);
    }
}

// ---------- 组装图块集 ----------

const sheet = new Sheet();
const RIVER_H = 5;
const CANAL_W = 3;
const G = {
    grass: [
        sheet.add((p) => grassTile(p, 'plain')),
        sheet.add((p) => grassTile(p, 'plain2')),
        sheet.add((p) => grassTile(p, 'tuft')),
        sheet.add((p) => grassTile(p, 'flowers')),
    ],
    dirt: Array.from({ length: 16 }, (_, m) => sheet.add((p) => terrainTile(p, m, 0, 1, dirtPaint(p.r)))),
    water: Array.from({ length: 16 }, (_, m) => sheet.add((p) => terrainTile(p, m, 1, 1, waterPaint(0)))),
    soil: Array.from({ length: 16 }, (_, m) => sheet.add((p) => terrainTile(p, m, 1, 0, soilPaint(p.r)))),
    stone: Array.from({ length: 16 }, (_, m) => sheet.add((p) => terrainTile(p, m, 0, 0, stonePaint()))),
    waterFrames: [1, 2, 3].map((f) => sheet.add((p) => terrainTile(p, 15, 1, 1, waterPaint(f)))),
    house: sheet.sprite(6, 5, (p) => house(p, 6, 5, 'none')),
    shop: sheet.sprite(7, 6, (p) => house(p, 7, 6, 'shop')),
    workshop: sheet.sprite(6, 5, (p) => house(p, 6, 5, 'workshop')),
    tree: sheet.sprite(3, 5, roundTree),
    willow: sheet.sprite(3, 5, willow),
    bridgeV: sheet.sprite(2, RIVER_H, (p) => bridgeV(p, RIVER_H)),
    bridgeH: sheet.sprite(CANAL_W, 2, (p) => bridgeH(p, CANAL_W)),
    boat: sheet.sprite(4, 2, boat),
    lanternPost: sheet.sprite(1, 3, lanternPost),
    sprout: sheet.sprite(1, 2, (p) => crop(p, 'sprout')),
    cabbage: sheet.sprite(1, 2, (p) => crop(p, 'cabbage')),
    rice: sheet.sprite(1, 2, (p) => crop(p, 'rice')),
    gui: sheet.sprite(1, 2, (p) => person(p, { hair: 0x8b8b8b, top: 0xa5463e, pants: 0x3a3a48, bun: true })),
    zhou: sheet.sprite(1, 2, (p) => person(p, { hair: 0x3a2a20, top: 0x3d6f8f, pants: 0x4a3628, apron: true })),
    hero: sheet.sprite(1, 2, (p) => person(p, { hair: 0x2b2420, top: 0x3d6fb0, pants: 0x4a3628, hat: true })),
    bush: sheet.add(bush),
    rocks: sheet.add(rocks),
    lily: sheet.add(lilyPad),
    fence: sheet.add(fence),
};

// ---------- 地图 ----------

const W = 96;
const H = 72;

enum Terr { Grass, Dirt, Water, Soil, Stone }

interface MapData {
    ground: number[];
    deco: number[];
    over: number[];
}

function buildJiangnan(): MapData {
    const rnd = mulberry32(20261016);
    const terr = new Array<Terr>(W * H).fill(Terr.Grass);
    const deco = new Array<number>(W * H).fill(EMPTY);
    const over = new Array<number>(W * H).fill(EMPTY);
    const bridgeCell = new Set<number>();
    const at = (x: number, y: number) => y * W + x;
    const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
    const rect = (x0: number, y0: number, w: number, h: number, f: (x: number, y: number) => void) => {
        for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (inMap(x, y)) f(x, y);
    };
    const setT = (t: Terr) => (x: number, y: number) => { terr[at(x, y)] = t; };

    // 水：一条大河横穿，一条小河往南分出去，两岸是水巷人家
    const riverY = 34;
    const canalX = 60;
    rect(0, riverY, W, RIVER_H, setT(Terr.Water));
    rect(canalX, riverY + RIVER_H, CANAL_W, 28, setT(Terr.Water));
    // 路：两横两竖，竖路过大河、横路过小河的地方架桥
    const roadsY = [28, 44];
    const roadsX = [30, 76];
    for (const y of roadsY) rect(4, y, W - 8, 2, setT(Terr.Dirt));
    for (const x of roadsX) rect(x, 6, 2, H - 10, setT(Terr.Dirt));
    for (let i = 0; i < W * H; i++) {
        const x = i % W;
        const y = Math.floor(i / W);
        const onRoad = roadsY.some((ry) => y >= ry && y < ry + 2) || roadsX.some((rx) => x >= rx && x < rx + 2 && y >= 6 && y < H - 4);
        const onWater = (y >= riverY && y < riverY + RIVER_H) || (x >= canalX && x < canalX + CANAL_W && y >= riverY + RIVER_H && y < riverY + RIVER_H + 28);
        if (onRoad && onWater) {
            bridgeCell.add(i);
            terr[i] = Terr.Water;
        }
    }
    // 镇中心石板广场，一条小路连到北边横路
    rect(36, 6, 20, 13, setT(Terr.Stone));
    rect(44, 19, 2, 9, setT(Terr.Dirt));
    // 农田：西南角 12 块，每块 4×3
    const plots: [number, number][] = [];
    for (const py of [51, 56, 61]) for (const px of [8, 13, 18, 23]) plots.push([px, py]);
    for (const [px, py] of plots) rect(px, py, 4, 3, setT(Terr.Soil));

    const grassAt = (x: number, y: number) => inMap(x, y) && terr[at(x, y)] === Terr.Grass && !bridgeCell.has(at(x, y));
    /** 放大图：最下一行进 deco（挡路的部分），上面几行进 over（盖在人头上）。flat 时全部进 deco。 */
    const place = (x: number, y: number, grid: number[][], flat = false) => {
        const last = grid.length - 1;
        grid.forEach((row, dy) => row.forEach((t, dx) => {
            if (t === EMPTY || !inMap(x + dx, y + dy)) return;
            if (flat || dy === last) deco[at(x + dx, y + dy)] = t;
            else over[at(x + dx, y + dy)] = t;
        }));
    };
    /** 能不能放：底行要在空草地上，上面几行不能压到别的东西。 */
    const fits = (x: number, y: number, grid: number[][], solid = false) => {
        const last = grid.length - 1;
        for (let dy = 0; dy <= last; dy++) {
            for (let dx = 0; dx < grid[dy].length; dx++) {
                const xx = x + dx;
                const yy = y + dy;
                if (!inMap(xx, yy)) return false;
                const i = at(xx, yy);
                if (deco[i] !== EMPTY || over[i] !== EMPTY) return false;
                if ((solid || dy === last) && !grassAt(xx, yy)) return false;
            }
        }
        return true;
    };

    // 房子：北岸一排民居，广场东边是桂姨的杂货铺；南岸老周的木工坊，小河两岸水巷人家
    for (const x of [6, 14, 22, 36, 58, 66, 82]) place(x, 22, G.house);
    place(48, 21, G.shop);
    place(38, 39, G.workshop);
    for (const y of [48, 56]) {
        place(canalX - 7, y, G.house);
        place(canalX + CANAL_W + 1, y, G.house);
    }
    place(82, 48, G.house);
    place(82, 58, G.house);
    for (const x of roadsX) place(x, riverY, G.bridgeV, true);
    place(canalX, roadsY[1], G.bridgeH, true);

    // 广场：四角灯笼杆，中间一棵老树
    for (const [x, y] of [[37, 6], [54, 6], [37, 15], [54, 15]]) place(x, y, G.lanternPost);
    place(44, 7, G.tree);
    place(46, 13, G.hero);
    place(47, 25, G.gui);
    place(45, 42, G.zhou);

    // 农田篱笆和作物
    rect(7, 49, 21, 1, (x, y) => { deco[at(x, y)] = G.fence; });
    rect(7, 65, 21, 1, (x, y) => { deco[at(x, y)] = G.fence; });
    const crops = [G.sprout, G.cabbage, G.rice];
    plots.forEach(([px, py], i) => rect(px, py, 4, 3, (x, y) => place(x, y - 1, crops[i % 3])));

    // 河上的船和荷叶
    place(10, riverY + 1, G.boat, true);
    place(86, riverY + 2, G.boat, true);
    for (let i = 0; i < W * H; i++) {
        if (terr[i] === Terr.Water && !bridgeCell.has(i) && deco[i] === EMPTY && rnd() < 0.04) deco[i] = G.lily;
    }

    // 河岸柳树、四周圆树、零星灌木和石头
    for (let x = 0; x < W - 2; x++) {
        if (rnd() < 0.25 && fits(x, riverY - 5, G.willow)) place(x, riverY - 5, G.willow);
        if (rnd() < 0.25 && fits(x, riverY + RIVER_H, G.willow)) place(x, riverY + RIVER_H, G.willow);
    }
    for (let y = 0; y < H - 4; y++) {
        for (let x = 0; x < W - 2; x++) {
            const border = x < 3 || x >= W - 5 || y < 2 || y >= H - 7;
            if (rnd() < (border ? 0.45 : 0.015) && fits(x, y, G.tree)) place(x, y, G.tree);
        }
    }
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (!grassAt(x, y) || deco[at(x, y)] !== EMPTY) continue;
            const r = rnd();
            if (r < 0.025) deco[at(x, y)] = G.bush;
            else if (r < 0.04) deco[at(x, y)] = G.rocks;
        }
    }

    // 地面：地形按四邻选边缘图块，草地随机变化
    const same = (x: number, y: number, t: Terr) => {
        if (!inMap(x, y)) return true;
        const i = at(x, y);
        // 桥既连着路也连着河
        if (bridgeCell.has(i)) return t === Terr.Dirt || t === Terr.Water;
        return terr[i] === t;
    };
    const ground = terr.map((t, i) => {
        const x = i % W;
        const y = Math.floor(i / W);
        if (t === Terr.Grass) return pick(rnd, G.grass, [0.6, 0.22, 0.12, 0.06]);
        const mask = (same(x, y - 1, t) ? N : 0) | (same(x + 1, y, t) ? E : 0) | (same(x, y + 1, t) ? S : 0) | (same(x - 1, y, t) ? W_ : 0);
        const set = { [Terr.Dirt]: G.dirt, [Terr.Water]: G.water, [Terr.Soil]: G.soil, [Terr.Stone]: G.stone }[t];
        return set[mask];
    });
    return { ground, deco, over };
}

function layerData(tiles: number[]): string {
    const buf = Buffer.alloc(tiles.length * 4);
    tiles.forEach((t, i) => buf.writeUInt32LE(t === EMPTY ? 0 : t + 1, i * 4));
    return buf.toString('base64');
}

function toTmx(map: MapData, tileCount: number, rows: number): string {
    const layer = (id: number, name: string, tiles: number[]) =>
        `  <layer id="${id}" name="${name}" width="${W}" height="${H}">\n`
        + `    <data encoding="base64">${layerData(tiles)}</data>\n`
        + '  </layer>\n';
    const center = G.water[15];
    const frames = [center, ...G.waterFrames]
        .map((t) => `      <frame tileid="${t}" duration="400"/>`)
        .join('\n');
    return '<?xml version="1.0" encoding="UTF-8"?>\n'
        + `<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" width="${W}" height="${H}" tilewidth="${TILE}" tileheight="${TILE}" infinite="0" nextlayerid="4" nextobjectid="1">\n`
        + `  <tileset firstgid="1" name="town" tilewidth="${TILE}" tileheight="${TILE}" tilecount="${tileCount}" columns="${COLS}">\n`
        + `    <image source="town-tiles.png" width="${COLS * TILE}" height="${rows * TILE}"/>\n`
        + `    <tile id="${center}">\n      <animation>\n${frames}\n      </animation>\n    </tile>\n`
        + '  </tileset>\n'
        + layer(1, 'ground', map.ground)
        + layer(2, 'deco', map.deco)
        + layer(3, 'over', map.over)
        + '</map>\n';
}

/** 把整张地图拼成一张图，方便不开 Cocos 也能看效果。 */
function renderPreview(map: MapData, scale: number): Canvas {
    const c = new Canvas(W * TILE * scale, H * TILE * scale);
    const blit = (t: number, tx: number, ty: number) => {
        const src = sheet.tiles[t];
        for (let y = 0; y < TILE; y++) {
            for (let x = 0; x < TILE; x++) {
                const i = (y * TILE + x) * 4;
                for (let dy = 0; dy < scale; dy++) {
                    for (let dx = 0; dx < scale; dx++) {
                        c.blend((tx * TILE + x) * scale + dx, (ty * TILE + y) * scale + dy, src.px[i], src.px[i + 1], src.px[i + 2], src.px[i + 3]);
                    }
                }
            }
        }
    };
    for (const layer of [map.ground, map.deco, map.over]) {
        for (let i = 0; i < W * H; i++) if (layer[i] !== EMPTY) blit(layer[i], i % W, Math.floor(i / W));
    }
    return c;
}

const out = join(__dirname, '..', 'assets', 'resources', 'maps');
mkdirSync(out, { recursive: true });
const tileset = sheet.toCanvas();
const jiangnan = buildJiangnan();
writeFileSync(join(out, 'town-tiles.png'), tileset.toPng());
writeFileSync(join(out, 'jiangnan.tmx'), toTmx(jiangnan, sheet.tiles.length, tileset.h / TILE));
console.log(`${sheet.tiles.length} tiles, written to ${out}`);

const previewIdx = process.argv.indexOf('--preview');
if (previewIdx > 0) {
    const dir = process.argv[previewIdx + 1];
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'jiangnan-preview.png'), renderPreview(jiangnan, 1).toPng());
    console.log(`preview written to ${dir}`);
}
