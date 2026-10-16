// 用代码画像素图块和江南水乡地图（Tiled .tmx）。正式美术到位前用它，画风与参考图一致。
// 用法：npx tsx tools/gen-map.ts [--preview <目录>]
// 输出：assets/resources/maps/town-tiles.png、assets/resources/maps/jiangnan.tmx
//
// 地形（土路、水面、耕地、石板）按上下左右四邻是否同类自动选边缘图块，每种 16 块；
// 房子、树、桥、船是多格大图，画完切成 16px 小块放进图块集。

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

// ---------- 大图 ----------

function house(p: Pen, sign: 'none' | 'shop' | 'workshop'): void {
    p.R(4, 45, 43, 3, C.shadow, 64);
    const wx = 3;
    const wy = 22;
    const ww = 42;
    const wh = 23;
    p.R(wx, wy, ww, wh, C.wall);
    p.R(wx + ww - 3, wy, 3, wh, C.wallShade);
    p.R(wx, wy, ww, 1, C.wallShade);
    p.R(wx, wy + wh - 3, ww, 3, C.plinth);
    for (let i = 2; i < ww - 3; i += 8) p.R(wx + i, wy + wh - 3, 1, 3, C.plinthJoint);

    const ry = 8;
    for (let j = 0; j < 13; j++) {
        const ex = Math.max(0, 3 - j);
        p.R(1 + ex, ry + j, 46 - 2 * ex, 1, j % 3 === 0 ? C.roof[0] : C.roof[1]);
    }
    for (let i = 2; i < 46; i += 3) p.R(i, ry + 1, 1, 10, C.roofRib);
    p.R(0, ry + 11, 48, 2, C.roofEdge);
    p.P(0, ry + 10, C.roofEdge);
    p.P(47, ry + 10, C.roofEdge);
    p.R(2, ry - 1, 44, 2, C.roofEdge);
    p.P(1, ry - 2, C.roofEdge);
    p.P(46, ry - 2, C.roofEdge);

    const dx = 20;
    const dy = wy + wh - 13;
    p.R(dx, dy, 8, 13, C.wood);
    p.R(dx + 1, dy + 1, 3, 12, C.woodLight);
    p.R(dx + 4, dy + 1, 3, 12, C.woodLight);
    p.P(dx + 3, dy + 6, C.gold);
    p.P(dx + 4, dy + 6, C.gold);

    for (const ox of [7, 31]) {
        const oy = 28;
        p.R(ox, oy, 10, 8, C.woodDark);
        p.R(ox + 1, oy + 1, 8, 6, C.paper);
        for (let k = 1; k < 9; k += 2) p.R(ox + k, oy + 1, 1, 6, C.lattice);
        p.R(ox + 1, oy + 4, 8, 1, C.lattice);
    }

    if (sign === 'shop') {
        p.R(16, 23, 16, 6, 0xb5322c);
        p.R(17, 24, 14, 4, 0xd24a3d);
        for (let k = 0; k < 3; k++) p.R(19 + k * 4, 25, 2, 2, C.paper);
        lanternAt(p, 2, 21);
        lanternAt(p, 44, 21);
    } else if (sign === 'workshop') {
        p.R(16, 23, 16, 6, C.woodDark);
        p.R(17, 24, 14, 4, C.lattice);
        for (let k = 0; k < 3; k++) p.R(19 + k * 4, 25, 2, 2, 0xe3c58a);
    }
}

function lanternAt(p: Pen, x: number, y: number): void {
    p.R(x - 2, y, 5, 6, C.red);
    p.R(x - 1, y + 1, 3, 4, C.redLight);
    p.R(x - 1, y - 1, 3, 1, C.gold);
    p.R(x - 1, y + 6, 3, 1, C.gold);
    p.P(x, y + 7, C.gold);
}

function roundTree(p: Pen): void {
    p.E(16, 29, 11, 2, () => C.shadow);
    for (let y = 26; y < 32; y++) for (let x = 5; x < 28; x++) {
        const i = (y * 32 + x) * 4;
        if (p.c.px[i + 3] === 255 && p.c.px[i] === 0) p.c.px[i + 3] = 56;
    }
    p.R(14, 18, 4, 11, C.trunk);
    p.R(15, 18, 1, 11, C.trunkLight);
    p.E(16, 12, 13, 11, (dx, dy) => {
        const edge = (dx * dx) / 169 + (dy * dy) / 121 > 0.8;
        if (edge) return C.leaf[3];
        if (dx + dy > 6) return C.leaf[0];
        if (dx + dy < -8) return C.leaf[2];
        return p.r() < 0.1 ? C.leaf[3] : C.leaf[1];
    });
    for (let i = 0; i < 6; i++) p.P(8 + Math.floor(p.r() * 10), 5 + Math.floor(p.r() * 6), C.leaf[2]);
}

function willow(p: Pen): void {
    p.R(9, 29, 15, 2, C.shadow, 56);
    p.R(15, 10, 3, 20, C.trunk);
    p.R(16, 10, 1, 20, C.trunkLight);
    p.E(16, 9, 13, 7, (dx, dy) => (dy > 2 ? C.willow[0] : dx + dy < -6 ? C.willow[2] : C.willow[1]));
    for (let i = 0; i < 40; i++) {
        const a = p.r() * Math.PI * 2;
        const d = Math.sqrt(p.r()) * 0.8;
        p.P(16 + Math.cos(a) * d * 13, 8 + Math.sin(a) * d * 6, p.r() < 0.6 ? C.willow[2] : C.willow[3]);
    }
    for (let k = -12; k <= 12; k += 2) {
        const len = 10 + Math.floor(p.r() * 10);
        for (let j = 0; j < len; j++) {
            const sway = j > len / 2 ? Math.sign(k) : 0;
            p.P(16 + k + sway, 10 + j, j % 3 === 0 ? C.willow[2] : C.willow[0]);
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

/** 竖向过河的石桥，2×3 格。 */
function bridge(p: Pen): void {
    for (let y = 0; y < 48; y++) {
        for (let x = 3; x < 29; x++) {
            const mid = Math.abs(y - 24) < 10;
            p.P(x, y, y % 5 === 4 ? 0x8f8f88 : mid ? 0xc4c4bc : p.r() < 0.7 ? 0xa9a9a2 : 0xb9b9b1);
        }
        for (const bx of [0, 29]) {
            p.R(bx, y, 3, 1, 0x8a8a83);
            p.P(bx + (bx === 0 ? 2 : 0), y, 0x6e6e68);
        }
    }
    for (let y = 2; y < 48; y += 8) {
        p.R(0, y, 3, 3, 0xc4c4bc);
        p.R(29, y, 3, 3, 0xc4c4bc);
    }
}

/** 乌篷船，2×1 格。 */
function boat(p: Pen): void {
    for (let x = 2; x < 30; x++) {
        const t = Math.abs(x - 16) / 14;
        const h = Math.round(4 - t * 3);
        p.R(x, 10 - Math.round(t * 2), 1, h, 0x4a3628);
        p.P(x, 10 - Math.round(t * 2), 0x6b4c36);
    }
    for (let x = 9; x < 23; x++) {
        const t = Math.abs(x - 16) / 7;
        const top = 4 + Math.round(t * t * 3);
        p.R(x, top, 1, 10 - top, x % 3 === 0 ? 0x3d3d3d : 0x2b2b2b);
    }
    p.R(4, 13, 6, 1, C.shine);
    p.R(22, 13, 6, 1, C.shine);
}

function lilyPad(p: Pen): void {
    p.E(5, 6, 3, 2, (dx, dy) => (dx === 1 && dy <= 0 ? null : dy < 0 ? 0x6db054 : 0x4b8a3a));
    p.E(11, 11, 3, 2, (dx, dy) => (dx === -1 && dy <= 0 ? null : dy < 0 ? 0x6db054 : 0x4b8a3a));
    p.P(11, 9, 0xf2a6c4);
    p.P(12, 9, 0xf2a6c4);
    p.P(11, 8, 0xf7c9dc);
}

function lantern(p: Pen): void {
    p.R(7, 0, 1, 4, 0x3b2a1e);
    p.E(7, 8, 4, 4, (dx) => (dx < -1 ? C.red : dx > 1 ? 0xa82724 : C.redLight));
    p.R(5, 4, 5, 1, C.gold);
    p.R(5, 12, 5, 1, C.gold);
    p.R(7, 13, 1, 3, C.gold);
    p.P(6, 6, 0xf7a08a);
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

function crop(p: Pen, kind: 'sprout' | 'cabbage' | 'rice'): void {
    for (const [ox, oy] of [[0, 0], [8, 0], [0, 8], [8, 8]]) {
        if (kind === 'sprout') {
            p.R(ox + 3, oy + 3, 1, 4, 0x4f8a30);
            p.P(ox + 2, oy + 4, 0x7cc04e);
            p.P(ox + 4, oy + 3, 0x7cc04e);
            p.P(ox + 5, oy + 5, 0x7cc04e);
        } else if (kind === 'cabbage') {
            p.R(ox + 1, oy + 2, 6, 5, 0x8fcf6a);
            p.R(ox + 2, oy + 3, 4, 3, 0xbfe8a0);
            p.P(ox + 3, oy + 4, 0xe8f7da);
            p.R(ox + 1, oy + 6, 6, 1, 0x5f9c3e);
        } else {
            for (let k = 0; k < 3; k++) {
                p.R(ox + 1 + k * 2, oy + 1, 1, 6, 0x9c8a2e);
                p.P(ox + 1 + k * 2, oy + 1, 0xe8c84a);
                p.P(ox + 1 + k * 2, oy + 2, 0xe8c84a);
            }
        }
    }
}

/** 16px 小人：hair 发色，top 上衣，hat 是否戴草帽。 */
function person(p: Pen, hair: number, top: number, hat: boolean, bun: boolean): void {
    const x = 4;
    const y = 2;
    p.R(x - 1, y + 12, 9, 2, C.shadow, 64);
    p.R(x + 1, y + 1, 5, 5, C.skin);
    p.R(x + 1, y + 1, 5, 2, hair);
    if (bun) p.R(x + 2, y - 1, 3, 2, hair);
    if (hat) {
        p.R(x, y, 7, 2, 0xd8b45a);
        p.R(x - 1, y + 1, 9, 1, 0xc49e45);
    }
    p.P(x + 2, y + 4, C.eye);
    p.P(x + 4, y + 4, C.eye);
    p.R(x, y + 6, 7, 5, top);
    p.R(x, y + 10, 7, 1, C.shadow, 70);
    p.P(x - 1, y + 7, C.skin);
    p.P(x + 7, y + 7, C.skin);
    p.R(x + 1, y + 11, 2, 2, 0x4a3628);
    p.R(x + 4, y + 11, 2, 2, 0x4a3628);
}

// ---------- 组装图块集 ----------

const sheet = new Sheet();
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
    house: sheet.sprite(3, 3, (p) => house(p, 'none')),
    shop: sheet.sprite(3, 3, (p) => house(p, 'shop')),
    workshop: sheet.sprite(3, 3, (p) => house(p, 'workshop')),
    tree: sheet.sprite(2, 2, roundTree),
    willow: sheet.sprite(2, 2, willow),
    bridge: sheet.sprite(2, 3, bridge),
    boat: sheet.sprite(2, 1, boat),
    bush: sheet.add(bush),
    rocks: sheet.add(rocks),
    lily: sheet.add(lilyPad),
    lantern: sheet.add(lantern),
    fence: sheet.add(fence),
    sprout: sheet.add((p) => crop(p, 'sprout')),
    cabbage: sheet.add((p) => crop(p, 'cabbage')),
    rice: sheet.add((p) => crop(p, 'rice')),
    gui: sheet.add((p) => person(p, 0x8b8b8b, 0xa5463e, false, true)),
    zhou: sheet.add((p) => person(p, 0x3a2a20, 0x3d6f8f, false, false)),
    hero: sheet.add((p) => person(p, 0x2b2420, 0x3d6fb0, true, false)),
};

// ---------- 地图 ----------

const W = 48;
const H = 32;

enum Terr { Grass, Dirt, Water, Soil, Stone }

interface MapData {
    ground: number[];
    deco: number[];
}

function buildJiangnan(): MapData {
    const rnd = mulberry32(20261016);
    const terr = new Array<Terr>(W * H).fill(Terr.Grass);
    const deco = new Array<number>(W * H).fill(EMPTY);
    const bridgeCell = new Set<number>();
    const at = (x: number, y: number) => y * W + x;
    const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
    const rect = (x0: number, y0: number, w: number, h: number, f: (x: number, y: number) => void) => {
        for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (inMap(x, y)) f(x, y);
    };
    const setT = (t: Terr) => (x: number, y: number) => { terr[at(x, y)] = t; };

    // 河横穿小镇，两条横路、两条竖路，竖路过河处架石桥
    rect(0, 15, W, 3, setT(Terr.Water));
    rect(4, 10, 41, 2, setT(Terr.Dirt));
    rect(4, 21, 41, 2, setT(Terr.Dirt));
    for (const x of [12, 33]) {
        rect(x, 3, 2, 26, (xx, y) => {
            if (y >= 15 && y <= 17) bridgeCell.add(at(xx, y));
            else terr[at(xx, y)] = Terr.Dirt;
        });
    }
    // 镇中心石板广场
    rect(18, 2, 12, 7, setT(Terr.Stone));
    // 农田六块，每块 3×2
    const plots = [[16, 25], [20, 25], [24, 25], [16, 28], [20, 28], [24, 28]];
    for (const [px, py] of plots) rect(px, py, 3, 2, setT(Terr.Soil));

    const free = (x: number, y: number) => inMap(x, y) && deco[at(x, y)] === EMPTY && terr[at(x, y)] === Terr.Grass;
    const place = (x: number, y: number, grid: number[][]) => {
        grid.forEach((row, dy) => row.forEach((t, dx) => {
            if (t !== EMPTY && inMap(x + dx, y + dy)) deco[at(x + dx, y + dy)] = t;
        }));
    };
    const area = (x: number, y: number, w: number, h: number) => {
        for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (!free(xx, yy)) return false;
        return true;
    };

    // 民居（3×3），门朝下方的路
    for (const x of [2, 6, 15, 37, 41]) place(x, 6, G.house);
    place(28, 6, G.house);
    place(22, 12, G.shop);
    place(38, 18, G.workshop);
    for (const x of [12, 33]) place(x, 15, G.bridge);

    for (const x of [18, 21, 26, 29]) deco[at(x, 2)] = G.lantern;
    rect(15, 24, 13, 1, (x, y) => { deco[at(x, y)] = G.fence; });
    rect(15, 30, 13, 1, (x, y) => { deco[at(x, y)] = G.fence; });
    const crops = [G.sprout, G.sprout, G.cabbage, G.cabbage, G.rice, G.rice];
    plots.forEach(([px, py], i) => rect(px, py, 3, 2, (x, y) => { deco[at(x, y)] = crops[i]; }));

    deco[at(21, 14)] = G.gui;
    deco[at(41, 21)] = G.zhou;
    deco[at(23, 5)] = G.hero;
    place(5, 16, G.boat);
    for (let x = 0; x < W; x++) {
        for (let y = 15; y <= 17; y++) {
            if (!bridgeCell.has(at(x, y)) && deco[at(x, y)] === EMPTY && rnd() < 0.06) deco[at(x, y)] = G.lily;
        }
    }

    // 河岸柳树、四周圆树、零星灌木和石头
    for (let x = 0; x < W - 1; x++) {
        if (rnd() < 0.3 && area(x, 13, 2, 2)) place(x, 13, G.willow);
        if (rnd() < 0.3 && area(x, 18, 2, 2)) place(x, 18, G.willow);
    }
    for (let y = 0; y < H - 1; y++) {
        for (let x = 0; x < W - 1; x++) {
            const border = x < 2 || x >= W - 3 || y < 1 || y >= H - 3;
            if (rnd() < (border ? 0.5 : 0.03) && area(x, y, 2, 2)) place(x, y, G.tree);
        }
    }
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (!free(x, y)) continue;
            const r = rnd();
            if (r < 0.03) deco[at(x, y)] = G.bush;
            else if (r < 0.045) deco[at(x, y)] = G.rocks;
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
        if (bridgeCell.has(i)) t = Terr.Water;
        if (t === Terr.Grass) return pick(rnd, G.grass, [0.6, 0.22, 0.12, 0.06]);
        const mask = (same(x, y - 1, t) ? N : 0) | (same(x + 1, y, t) ? E : 0) | (same(x, y + 1, t) ? S : 0) | (same(x - 1, y, t) ? W_ : 0);
        const set = { [Terr.Dirt]: G.dirt, [Terr.Water]: G.water, [Terr.Soil]: G.soil, [Terr.Stone]: G.stone }[t];
        return set[mask];
    });
    return { ground, deco };
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
        + `<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" width="${W}" height="${H}" tilewidth="${TILE}" tileheight="${TILE}" infinite="0" nextlayerid="3" nextobjectid="1">\n`
        + `  <tileset firstgid="1" name="town" tilewidth="${TILE}" tileheight="${TILE}" tilecount="${tileCount}" columns="${COLS}">\n`
        + `    <image source="town-tiles.png" width="${COLS * TILE}" height="${rows * TILE}"/>\n`
        + `    <tile id="${center}">\n      <animation>\n${frames}\n      </animation>\n    </tile>\n`
        + '  </tileset>\n'
        + layer(1, 'ground', map.ground)
        + layer(2, 'deco', map.deco)
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
    for (let i = 0; i < W * H; i++) {
        blit(map.ground[i], i % W, Math.floor(i / W));
        if (map.deco[i] !== EMPTY) blit(map.deco[i], i % W, Math.floor(i / W));
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
    writeFileSync(join(dir, 'jiangnan-preview.png'), renderPreview(jiangnan, 2).toPng());
    console.log(`preview written to ${dir}`);
}
