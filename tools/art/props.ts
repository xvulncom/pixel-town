// 多格大图：房子、树、桥、船、广场和门口的小物件、作物。尺寸照星露谷。

import { Pen, TILE, groundShadow } from './canvas';
import { C } from './palette';

export function lanternAt(p: Pen, x: number, y: number): void {
    p.R(x, y - 3, 1, 3, 0x3b2a1e);
    p.E(x, y + 4, 3, 4, (dx) => (dx < -1 ? C.red : dx > 1 ? 0xa82724 : C.redLight));
    p.R(x - 2, y, 5, 1, C.gold);
    p.R(x - 2, y + 8, 5, 1, C.gold);
    p.R(x, y + 9, 1, 3, C.gold);
}

export interface HouseOpts {
    sign?: 'shop' | 'workshop' | 'tea' | 'cloth' | 'rice';
    /** 两侧马头墙 */
    gable?: boolean;
    /** 两层：中间多一道腰檐和一排窗 */
    floors?: 1 | 2;
    /** 门两边贴红对联 */
    couplet?: boolean;
}

/** 一排木格窗，从 x0 到 x1 之间尽量均匀摆。 */
export function windows(p: Pen, x0: number, x1: number, y: number): void {
    const slots: number[] = [];
    for (let x = x0; x + 14 <= x1; x += 20) slots.push(x);
    for (const ox of slots) {
        p.R(ox, y, 14, 12, C.woodDark);
        p.R(ox + 1, y + 1, 12, 10, C.paper);
        for (let k = 2; k < 13; k += 3) p.R(ox + k, y + 1, 1, 10, C.lattice);
        p.R(ox + 1, y + 5, 12, 1, C.lattice);
        p.R(ox + 1, y + 1, 12, 1, 0xd9b870);
        p.R(ox - 1, y + 12, 16, 1, 0xc9c4b5);
    }
}

/** 一道瓦檐：从 y0 到 y1 的瓦面，下沿一排瓦当。ex 是两端翘角的收进量。 */
export function tileEave(p: Pen, x0: number, x1: number, y0: number, y1: number): void {
    for (let y = y0; y < y1; y++) {
        const j = y - y0;
        const ex = Math.max(0, 4 - j);
        p.R(x0 + ex, y, x1 - x0 - 2 * ex, 1, j % 3 === 0 ? C.roof[0] : C.roof[1]);
    }
    for (let x = x0 + 2; x < x1 - 2; x += 3) {
        p.R(x, y0 + 1, 1, y1 - y0 - 3, C.roofRib);
        p.P(x + 1, y0 + 2, 0x5a626d);
    }
    p.R(x0 - 1, y1 - 2, x1 - x0 + 2, 2, C.roofEdge);
    for (let x = x0; x < x1; x += 3) p.P(x + 1, y1 - 1, 0x5a626d);
    for (const [x, d] of [[x0 - 1, 1], [x1, -1]]) {
        p.P(x, y1 - 3, C.roofEdge);
        p.P(x, y1 - 4, C.roofEdge);
        p.P(x + d, y1 - 3, C.roofEdge);
    }
}

/** 江南民居：w×h 格，白墙黛瓦，飞檐翘角；可选马头墙、两层、对联、店招。 */
export function house(p: Pen, w: number, h: number, o: HouseOpts = {}): void {
    const pw = w * TILE;
    const ph = h * TILE;
    const two = o.floors === 2;
    const wy = Math.round(ph * (two ? 0.36 : 0.48));
    const base = ph - 4;
    // 影子往右下偏一点，房子才像立在地上
    p.R(6, base, pw - 4, 4, C.shadow, 56);
    p.R(pw - 2, wy + 6, 2, base - wy - 6, C.shadow, 40);

    p.R(2, wy, pw - 4, base - wy, C.wall);
    p.R(pw - 5, wy, 3, base - wy, C.wallShade);
    // 檐下阴影
    p.R(2, wy, pw - 4, 3, 0xc9c4b5);
    p.R(2, wy + 3, pw - 4, 1, C.wallShade);
    // 白墙上的雨水痕
    for (let i = 0; i < w * 2; i++) {
        const x = 4 + Math.floor(p.r() * (pw - 10));
        const len = 3 + Math.floor(p.r() * 9);
        for (let j = 0; j < len; j++) if (p.r() < 0.7) p.P(x, wy + 4 + j, 0xe2ded2);
    }
    p.R(2, base - 5, pw - 4, 5, C.plinth);
    p.R(2, base - 5, pw - 4, 1, 0xa29e94);
    for (let i = 6; i < pw - 6; i += 10) p.R(i, base - 4, 1, 4, C.plinthJoint);
    for (let i = 1; i < pw - 6; i += 10) p.R(i, base - 2, 1, 2, C.plinthJoint);

    const ry = 7;
    // 马头墙每级 6px 宽，两层房子三级，平房两级；屋顶夹在两侧马头墙中间
    const steps = o.gable ? (two ? 3 : 2) : 0;
    const inset = steps * 6;
    tileEave(p, 1 + inset, pw - 1 - inset, ry, wy);
    p.R(3 + inset, ry - 2, pw - 6 - 2 * inset, 3, C.roofEdge);
    p.R(4 + inset, ry - 2, pw - 8 - 2 * inset, 1, 0x4a515b);
    if (!o.gable) for (const x of [1, pw - 3]) p.R(x, ry - 4, 2, 2, C.roofEdge);

    if (o.gable) {
        // 马头墙：两端白墙从外往里一级级升高，每级压一道黑瓦，外端瓦头翘起
        const sw = 6;
        for (const side of [0, 1]) {
            for (let k = 0; k < steps; k++) {
                const top = Math.round(wy - 10 - ((wy - 10 - (ry - 3)) * k) / (steps - 1));
                const x = side === 0 ? 1 + k * sw : pw - 1 - (k + 1) * sw;
                p.R(x, top + 3, sw, wy - top - 3, C.wall);
                p.R(side === 0 ? x + sw - 1 : x, top + 3, 1, wy - top - 3, C.wallShade);
                p.R(x, top + 3, sw, 1, C.wallShade);
                p.R(x - 1, top, sw + 2, 3, C.roofEdge);
                p.R(x, top, sw, 1, 0x4a515b);
                const hx = side === 0 ? x - 2 : x + sw + 1;
                p.R(hx, top - 2, 1, 4, C.roofEdge);
                p.P(hx + (side === 0 ? -1 : 1), top - 3, C.roofEdge);
            }
        }
    }

    const dw = 12;
    const dh = 20;
    const dx = Math.floor(pw / 2) - dw / 2;
    const dy = base - dh;
    // 门罩：门上一小截瓦檐
    tileEave(p, dx - 4, dx + dw + 4, dy - 8, dy - 2);
    p.R(dx - 1, dy - 1, dw + 2, dh + 1, C.woodDark);
    p.R(dx, dy, dw, dh, C.wood);
    p.R(dx + 1, dy + 1, 4, dh - 1, C.woodLight);
    p.R(dx + 7, dy + 1, 4, dh - 1, C.woodLight);
    p.R(dx + 5, dy, 2, dh, C.woodDark);
    p.P(dx + 4, dy + 10, C.gold);
    p.P(dx + 7, dy + 10, C.gold);
    p.R(dx - 3, base - 1, dw + 6, 2, 0x9b968b);
    p.R(dx - 3, base - 1, dw + 6, 1, 0xb4b0a6);
    if (o.couplet) {
        p.R(dx - 4, dy + 1, 2, 14, C.red);
        p.R(dx + dw + 2, dy + 1, 2, 14, C.red);
        for (let k = 0; k < 4; k++) {
            p.P(dx - 3, dy + 3 + k * 3, C.gold);
            p.P(dx + dw + 2, dy + 3 + k * 3, C.gold);
        }
        p.R(dx + 1, dy - 1, dw - 2, 1, C.red);
    }

    if (two) {
        // 二楼一排窗，下面一道腰檐
        const midY = wy + Math.round((base - wy) * 0.42);
        windows(p, 10, pw - 10, wy + 7);
        tileEave(p, 0, pw, midY - 5, midY + 1);
    }
    const winY = base - 22;
    windows(p, 8, dx - 4, winY);
    windows(p, dx + dw + 6, pw - 6, winY);

    if (o.sign === 'shop') {
        const sx = Math.floor(pw / 2) - 15;
        p.R(sx, wy + 3, 30, 8, 0x8e2621);
        p.R(sx + 1, wy + 4, 28, 6, 0xd24a3d);
        for (let k = 0; k < 4; k++) p.R(sx + 4 + k * 6, wy + 6, 3, 2, C.paper);
        lanternAt(p, 6, wy + 1);
        lanternAt(p, pw - 7, wy + 1);
    } else if (o.sign === 'workshop') {
        const sx = Math.floor(pw / 2) - 13;
        p.R(sx, wy + 3, 26, 7, C.woodDark);
        p.R(sx + 1, wy + 4, 24, 5, C.lattice);
        for (let k = 0; k < 3; k++) p.R(sx + 5 + k * 7, wy + 6, 3, 2, 0xe3c58a);
        for (const [lx, ly] of [[dx + dw + 6, base - 5], [dx + dw + 12, base - 5], [dx + dw + 9, base - 10]]) {
            p.E(lx, ly, 3, 3, (ddx, ddy) => (ddx * ddx + ddy * ddy < 3 ? 0xd9b37a : 0x8a5a34));
        }
    } else if (o.sign === 'tea' || o.sign === 'cloth' || o.sign === 'rice') {
        // 集市街上的铺子：招牌颜色不同，茶馆门边挂一面布幌子，布庄挂几匹布，米铺门口堆米袋
        const col = { tea: [0x2f5a3a, 0x4f8a5a], cloth: [0x2a3a5a, 0x3d6fb0], rice: [0x8a6a2a, 0xe3b341] }[o.sign];
        const sx = Math.floor(pw / 2) - 14;
        p.R(sx, wy + 3, 28, 8, col[0]);
        p.R(sx + 1, wy + 4, 26, 6, col[1]);
        for (let k = 0; k < 3; k++) p.R(sx + 5 + k * 7, wy + 6, 4, 2, C.paper);
        if (o.sign === 'tea') {
            const fx = 5;
            p.R(fx, wy - 2, 1, 30, C.woodDark);
            p.R(fx + 1, wy, 10, 1, C.woodDark);
            for (let y = wy + 1; y < wy + 18; y++) p.R(fx + 2, y, 8 - (y > wy + 14 ? (y - wy - 14) * 2 : 0), 1, y % 5 === 0 ? 0xe3dccb : 0xf1eee4);
            p.R(fx + 4, wy + 5, 4, 4, 0x2f5a3a);
            p.R(fx + 5, wy + 10, 2, 3, 0x2f5a3a);
        } else if (o.sign === 'cloth') {
            const cols = [0xe98fa6, 0x7cc0b0, 0xe3b341];
            cols.forEach((c, k) => p.R(dx + dw + 6 + k * 5, wy + 4, 4, 16, c));
        } else {
            for (const [lx, ly] of [[dx - 8, base - 6], [dx - 14, base - 6], [dx + dw + 8, base - 6]]) {
                p.E(lx, ly, 4, 3, (ddx, ddy) => (ddx + ddy < -2 ? 0xeee0b4 : 0xd8c690));
            }
        }
    }
}

export type Blob = [number, number, number];

/** 几团圆叠成的树冠：先描深色外轮廓，再按光从左上来分亮暗。 */
export function canopy(p: Pen, blobs: Blob[], pal: { dark: number; mid: number; light: number; line: number }, bottom: number): void {
    for (const [cx, cy, r] of blobs) p.E(cx, cy, r + 1, r + 1, () => pal.line);
    for (const [cx, cy, r] of blobs) {
        p.E(cx, cy, r, r, (dx, dy) => {
            if (cy + dy > bottom - 6 || dx + dy > r * 0.55) return pal.dark;
            if (dx + dy < -r * 0.7) return pal.light;
            return p.r() < 0.08 ? pal.dark : pal.mid;
        });
    }
    for (const [cx, cy, r] of blobs) {
        const hx = cx - Math.round(r * 0.4);
        const hy = cy - Math.round(r * 0.4);
        p.E(hx, hy, 2, 1, () => pal.light);
        p.P(hx - 1, hy - 1, 0xb5e08a);
    }
}

export const TREE_BLOBS: Blob[] = [[24, 30, 17], [11, 27, 11], [37, 27, 11], [24, 14, 13], [14, 40, 10], [34, 40, 10], [24, 44, 11]];

/** 圆冠阔叶树，3×5 格。blossom 给了就在树冠上点花（桃树、桂花）。 */
export function roundTree(p: Pen, pal = { dark: 0x2f6b2a, mid: 0x3f8a36, light: 0x5ea64a, line: 0x234f20 }, blossom?: number[]): void {
    groundShadow(p, 26, 75, 14, 4);
    p.R(20, 46, 8, 30, C.trunk);
    p.R(21, 46, 2, 30, C.trunkLight);
    p.R(26, 46, 2, 30, 0x4a2f1c);
    p.R(17, 72, 14, 4, C.trunk);
    p.P(16, 75, C.trunk);
    p.P(31, 75, C.trunk);
    p.R(23, 62, 1, 5, 0x4a2f1c);
    canopy(p, TREE_BLOBS, pal, 56);
    // 树冠下沿压在树干上的影子
    p.D(20, 56, 8, 4, 0.7);
    if (blossom) {
        for (let i = 0; i < 26; i++) {
            const [cx, cy, r] = TREE_BLOBS[Math.floor(p.r() * TREE_BLOBS.length)];
            const a = p.r() * Math.PI * 2;
            const d = p.r() * (r - 2);
            const x = Math.round(cx + Math.cos(a) * d);
            const y = Math.round(cy + Math.sin(a) * d);
            const c = blossom[i % blossom.length];
            p.P(x, y, c);
            p.P(x + 1, y, c);
            p.P(x, y + 1, blossom[(i + 1) % blossom.length]);
        }
    }
}

/** 松树，3×5 格：一层层往下变宽的三角。 */
export function pineTree(p: Pen): void {
    groundShadow(p, 26, 75, 11, 3);
    p.R(22, 56, 4, 20, C.trunk);
    p.R(22, 56, 1, 20, C.trunkLight);
    const layers: [number, number, number][] = [[4, 20, 7], [14, 34, 11], [26, 50, 15], [38, 62, 18]];
    for (const [top, bot, half] of layers) {
        for (let y = top; y <= bot; y++) {
            const w = Math.round(((y - top) / (bot - top)) * half) + 1;
            for (let x = -w; x <= w; x++) {
                const edge = Math.abs(x) >= w - 1 || y === bot;
                const lit = x < -w / 3;
                p.P(24 + x, y, edge ? 0x1e4a2a : lit ? 0x3f7f4a : y > bot - 4 ? 0x24563a : 0x2e6a42);
            }
        }
        // 下沿锯齿，像一簇簇针叶
        for (let x = -half; x <= half; x += 3) p.P(24 + x, bot + 1, 0x1e4a2a);
    }
    p.P(24, 3, 0x3f7f4a);
}

/** 竹丛，3×5 格。 */
export function bamboo(p: Pen): void {
    groundShadow(p, 24, 76, 15, 3);
    const stalks = [6, 11, 16, 21, 26, 31, 36, 41];
    for (const sx of stalks) {
        const top = 6 + Math.floor(p.r() * 16);
        for (let y = top; y < 77; y++) {
            const node = (y - top) % 9 === 0;
            p.P(sx, y, node ? 0x5f8a2e : 0x8cbf4a);
            p.P(sx + 1, y, node ? 0x4a7024 : 0x6fa23a);
        }
        // 叶子：斜着往外挑的细长条
        for (let k = 0; k < 5; k++) {
            const ly = top + 2 + Math.floor(p.r() * 40);
            const dir = p.r() < 0.5 ? -1 : 1;
            for (let j = 0; j < 6; j++) p.P(sx + 1 + dir * (j + 1), ly + Math.floor(j / 2), j < 3 ? 0x6fa23a : 0x4f8a30);
        }
    }
}

/** 垂柳，3×5 格：圆顶树冠，柳条一缕缕垂下来，中间留出树干。 */
export function willow(p: Pen): void {
    groundShadow(p, 26, 75, 15, 4);
    p.R(21, 34, 7, 42, C.trunk);
    p.R(22, 34, 2, 42, C.trunkLight);
    p.R(26, 34, 2, 42, 0x4a2f1c);
    p.R(18, 72, 13, 4, C.trunk);
    p.R(27, 40, 6, 3, C.trunk);
    canopy(p, [[24, 20, 15], [11, 25, 9], [37, 25, 9], [24, 10, 10]], { dark: C.willow[0], mid: C.willow[1], light: C.willow[2], line: 0x24501f }, 34);
    // 柳条：从树冠下沿垂下，越往外越长，末梢往外飘
    for (let x = 3; x <= 45; x++) {
        if (p.r() < 0.35) continue;
        const off = Math.abs(x - 24);
        const start = 26 + Math.floor(Math.sqrt(Math.max(0, 1 - (off / 22) ** 2)) * 8);
        const len = off < 5 ? 6 + Math.floor(p.r() * 6) : 16 + Math.floor(p.r() * 22);
        for (let j = 0; j < len; j++) {
            const sway = j > len * 0.7 ? Math.sign(x - 24) : 0;
            const c = j % 4 === 0 ? C.willow[2] : j > len - 4 ? C.willow[3] : x % 2 ? C.willow[1] : C.willow[0];
            p.P(x + sway, start + j, c);
        }
    }
}

export function bush(p: Pen): void {
    p.R(3, 13, 11, 2, C.shadow, 56);
    p.E(8, 9, 6, 5, (dx, dy) => (dx + dy > 3 ? C.leaf[0] : dx + dy < -3 ? C.leaf[2] : C.leaf[1]));
    p.P(6, 8, 0xd24a3d);
    p.P(10, 10, 0xd24a3d);
    p.P(8, 6, 0xd24a3d);
}

export function rocks(p: Pen): void {
    p.E(6, 10, 4, 3, (dx, dy) => (dy < -1 ? 0xc4c0b6 : dx + dy > 2 ? 0x7d7a72 : 0xa29e94));
    p.E(11, 12, 2, 2, (dx, dy) => (dy < 0 ? 0xc4c0b6 : 0x8f8b82));
}

/** 石拱桥：len 是沿通行方向的像素长度，横宽 32px。中间拱起处颜色亮，台阶一道道横过桥面，两侧石栏杆。 */
export function stoneBridge(p: Pen, len: number, vertical: boolean): void {
    // u 沿通行方向，v 横过桥面；竖桥把 u、v 对调
    const put = (u: number, v: number, c: number, a = 255) => (vertical ? p.P(v, u, c, a) : p.P(u, v, c, a));
    for (let u = 0; u < len; u++) {
        const t = Math.abs(u - len / 2) / (len / 2);
        const tone = t < 0.3 ? 0xc4c4bc : t < 0.65 ? 0xb4b4ac : 0xa2a29a;
        const step = u % 5 === 4;
        for (let v = 5; v < 27; v++) put(u, v, step ? 0x85857e : (v * 7 + u * 3) % 11 === 0 ? 0x9a9a92 : tone);
        // 栏杆下沿投在桥面上的影子
        put(u, 5, 0x77776f);
        put(u, 6, 0x8a8a83);
        // 两侧栏杆：扶手 + 望柱
        for (const v0 of [0, 27]) {
            for (let v = v0; v < v0 + 5; v++) put(u, v, v === v0 ? 0xd2d2ca : v === v0 + 4 ? 0x6e6e68 : 0xa9a9a2);
        }
    }
    for (let u = 2; u < len - 2; u += 10) {
        for (const v0 of [0, 27]) {
            for (let du = 0; du < 3; du++) for (let v = v0 - 1; v < v0 + 6; v++) put(u + du, v, du === 0 ? 0xdcdcd4 : du === 2 ? 0x77776f : 0xc4c4bc);
        }
    }
}

/** 乌篷船，4×2 格。 */
export function boat(p: Pen): void {
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

export function lilyPad(p: Pen): void {
    p.E(5, 6, 3, 2, (dx, dy) => (dx === 1 && dy <= 0 ? null : dy < 0 ? 0x6db054 : 0x4b8a3a));
    p.E(11, 11, 3, 2, (dx, dy) => (dx === -1 && dy <= 0 ? null : dy < 0 ? 0x6db054 : 0x4b8a3a));
    p.P(11, 9, 0xf2a6c4);
    p.P(12, 9, 0xf2a6c4);
    p.P(11, 8, 0xf7c9dc);
}

/** 挂灯笼的木杆，1×3 格。 */
export function lanternPost(p: Pen): void {
    p.R(4, 44, 9, 3, C.shadow, 60);
    p.R(5, 40, 7, 5, 0x9b968b);
    p.R(5, 40, 7, 1, 0xb4b0a6);
    p.R(7, 6, 3, 34, C.woodDark);
    p.R(7, 6, 1, 34, C.lattice);
    p.R(7, 6, 8, 2, C.woodDark);
    lanternAt(p, 13, 11);
}

export function fence(p: Pen): void {
    for (const x of [2, 10]) {
        p.R(x, 4, 2, 10, C.lattice);
        p.P(x, 4, 0xa8743f);
    }
    p.R(0, 6, 16, 1, 0xa8743f);
    p.R(0, 10, 16, 1, C.lattice);
    p.R(0, 14, 16, 1, C.shadow, 50);
}

/** 石井，2×2 格：井圈、井水、辘轳架。 */
export function well(p: Pen): void {
    groundShadow(p, 17, 28, 13, 3);
    p.E(16, 20, 12, 8, (dx, dy) => (dy < -2 ? C.stone[2] : dx + dy > 6 ? C.stoneEdge : C.stone[0]));
    p.E(16, 19, 8, 5, (_dx, dy) => (dy < -2 ? 0x1d3a4d : 0x2f5a75));
    p.P(13, 20, C.shine);
    p.P(14, 20, C.shine);
    for (const x of [4, 26]) {
        p.R(x, 2, 2, 20, C.woodDark);
        p.R(x, 2, 1, 20, C.lattice);
    }
    p.R(4, 4, 24, 3, C.wood);
    p.R(4, 4, 24, 1, C.woodLight);
    p.R(14, 7, 1, 8, 0x8a7a5a);
    p.R(12, 14, 5, 4, C.woodDark);
    p.R(13, 14, 3, 1, C.woodLight);
}

/** 集市摊子，3×3 格：竹竿撑的布篷，案板上摆货。awning 是篷布的两种条纹色。 */
export function stall(p: Pen, awning: [number, number], goods: number[]): void {
    groundShadow(p, 26, 45, 22, 3);
    for (const x of [3, 43]) p.R(x, 8, 2, 37, C.woodDark);
    // 案板
    p.R(2, 30, 44, 4, C.woodLight);
    p.R(2, 34, 44, 8, C.wood);
    p.R(2, 34, 44, 1, C.woodDark);
    for (let i = 0; i < 8; i++) {
        const gx = 6 + i * 5;
        const c = goods[i % goods.length];
        p.E(gx, 28, 2, 2, (dx, dy) => (dx + dy < -1 ? 0xffffff : c));
    }
    // 篷布：条纹 + 波浪下沿
    for (let y = 4; y < 18; y++) {
        const ex = Math.max(0, 3 - (y - 4));
        for (let x = ex; x < 48 - ex; x++) p.P(x, y, Math.floor(x / 6) % 2 === 0 ? awning[0] : awning[1]);
    }
    for (let x = 0; x < 48; x++) {
        if (x % 6 < 4) p.P(x, 18, Math.floor(x / 6) % 2 === 0 ? awning[0] : awning[1]);
        p.P(x, 4, 0xffffff, 120);
    }
    p.R(0, 19, 48, 1, C.shadow, 50);
}

/** 门口的小物件：水缸、盆栽、柴堆、石凳。 */
export function waterJar(p: Pen): void {
    groundShadow(p, 9, 14, 6, 2);
    p.E(8, 9, 6, 6, (dx, dy) => (dx + dy < -4 ? 0x8a5a3a : dx + dy > 4 ? 0x3e2416 : 0x5e3a24));
    p.E(8, 5, 5, 2, () => 0x3e2416);
    p.E(8, 5, 4, 1, () => 0x2f5a75);
    p.P(6, 5, C.shine);
}

export function pottedPlant(p: Pen): void {
    groundShadow(p, 9, 15, 5, 1);
    p.R(4, 10, 8, 5, 0xa8583a);
    p.R(4, 10, 8, 1, 0xc46b48);
    p.R(5, 14, 6, 1, 0x7a3e28);
    p.E(8, 6, 5, 4, (dx, dy) => (dx + dy < -2 ? C.leaf[2] : dx + dy > 2 ? C.leaf[0] : C.leaf[1]));
    p.P(6, 4, 0xe98fa6);
    p.P(10, 6, 0xe98fa6);
    p.P(8, 3, 0xf7f7f2);
}

export function woodpile(p: Pen): void {
    groundShadow(p, 16, 14, 14, 2);
    for (const [ox, oy] of [[2, 9], [9, 9], [16, 9], [23, 9], [5, 4], [12, 4], [19, 4], [9, 0]]) {
        p.E(ox + 3, oy + 3, 3, 3, (dx, dy) => (dx * dx + dy * dy < 3 ? 0xd9b37a : dx + dy > 1 ? 0x5b3b24 : 0x8a5a34));
    }
}

export function stoneBench(p: Pen): void {
    // 木条凳：放在石板广场上要和地面拉开颜色
    groundShadow(p, 17, 13, 14, 2);
    for (const x of [5, 25]) p.R(x, 8, 2, 5, C.woodDark);
    p.R(2, 5, 28, 4, C.wood);
    p.R(2, 5, 28, 1, C.woodLight);
    p.R(2, 8, 28, 1, C.woodDark);
}

/** 晾衣竿，3×2 格：两根竹竿一根绳，挂两件衣服。 */
export function laundry(p: Pen): void {
    for (const x of [2, 44]) groundShadow(p, x + 2, 30, 3, 1);
    for (const x of [2, 44]) {
        p.R(x, 4, 2, 26, 0x8cbf4a);
        p.R(x, 4, 1, 26, 0x6fa23a);
    }
    p.R(3, 6, 42, 1, 0x7a6a50);
    const cloth: [number, number, number][] = [[9, 0x3d6fb0, 10], [23, 0xe0d8c4, 8], [33, 0xc9302c, 7]];
    for (const [x, c, w] of cloth) {
        p.R(x, 7, w, 11, c);
        p.R(x + w - 2, 7, 2, 11, C.shadow, 50);
        p.R(x, 7, w, 1, 0xffffff, 80);
    }
}

/** 作物，1×2 格：下半格是根部所在的地块。 */
export function crop(p: Pen, kind: 'sprout' | 'cabbage' | 'rice'): void {
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
