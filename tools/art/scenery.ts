// 镇外风景：茶山的崖壁和茶丛、码头木板和货船、古寺宝塔、山顶亭子、水车、荷花芦苇。尺寸照星露谷。

import { Pen, TILE, groundShadow } from './canvas';
import { C } from './palette';
import { tileEave } from './props';
import { E, grassFill, N, S, W_ } from './terrain';

const ROCK = { base: 0x8f8170, light: 0xa89a86, dark: 0x6a5e4f, crack: 0x4d4439, moss: 0x5b8a40 };

/** 一格岩壁的石纹：横向岩层，每块左上亮、右下暗。 */
function rockFace(p: Pen, y0: number, y1: number): void {
    for (let y = y0; y < y1; y++) {
        const band = Math.floor((y + 1) / 5);
        const off = (band * 7) % 11;
        for (let x = 0; x < TILE; x++) {
            const bx = (x + off) % 11;
            const by = (y + 1) % 5;
            let c = ROCK.base;
            if (by === 0) c = ROCK.crack;
            else if (bx === 0) c = ROCK.dark;
            else if (by === 1 || bx === 1) c = ROCK.light;
            else if (bx >= 9 || by === 4) c = ROCK.dark;
            if (c === ROCK.base && p.r() < 0.06) c = ROCK.dark;
            p.P(x, y, c);
        }
    }
}

/**
 * 崖壁（高处往南落下来的那一面），row 是从上往下第几行，end 是左右收口。
 * 顶行压一道草沿，底行压暗；收口那边削圆一点露出底下的草。
 */
export function cliffFace(p: Pen, row: 'top' | 'mid' | 'bot' | 'one', end: 'l' | 'm' | 'r'): void {
    grassFill(p);
    rockFace(p, 0, TILE);
    if (row === 'top' || row === 'one') {
        for (let x = 0; x < TILE; x++) {
            const d = 3 + Math.floor(p.r() * 2);
            for (let y = 0; y < d; y++) p.P(x, y, C.grass[(x + y) % 3]);
            p.P(x, d, 0x3f6a2c);
            p.P(x, d + 1, ROCK.crack);
            if (p.r() < 0.2) p.P(x, d + 1 + Math.floor(p.r() * 3), ROCK.moss);
        }
    }
    if (row === 'bot' || row === 'one') {
        for (let x = 0; x < TILE; x++) {
            p.P(x, TILE - 1, ROCK.crack);
            p.P(x, TILE - 2, ROCK.dark);
            if (p.r() < 0.25) p.P(x, TILE - 3, ROCK.dark);
        }
    }
    // 收口：削掉外侧几列，露出草地，留一道暗边
    if (end !== 'm') {
        for (let y = 0; y < TILE; y++) {
            const cut = row === 'top' || row === 'one' ? Math.max(0, 3 - Math.floor(y / 4)) : 1;
            for (let k = 0; k < cut; k++) {
                const x = end === 'l' ? k : TILE - 1 - k;
                p.P(x, y, C.grass[(x + y) % 3]);
            }
            const ex = end === 'l' ? cut : TILE - 1 - cut;
            if (ex >= 0 && ex < TILE) p.P(ex, y, ROCK.crack);
        }
    }
}

/** 崖壁上凿出来的石阶，路穿过崖壁的地方用。 */
export function cliffStairs(p: Pen, row: 'top' | 'mid' | 'bot' | 'one'): void {
    grassFill(p);
    for (let y = 0; y < TILE; y++) {
        const step = y % 4;
        for (let x = 1; x < TILE - 1; x++) {
            let c = step === 0 ? 0xc4c0b5 : step === 3 ? 0x7d7d76 : C.stone[(x + y) % 3];
            if (step === 1 && x % 5 === 0) c = C.mortar;
            p.P(x, y, c);
        }
        p.P(0, y, ROCK.crack);
        p.P(TILE - 1, y, ROCK.crack);
    }
    if (row === 'top' || row === 'one') for (let x = 0; x < TILE; x++) p.P(x, 0, 0x3f6a2c);
}

/** 高地左右两侧的崖沿：高的那格靠外一侧画一道竖的岩边。 */
export function cliffSide(p: Pen, side: 'l' | 'r'): void {
    for (let y = 0; y < TILE; y++) {
        const w = 2 + (p.r() < 0.3 ? 1 : 0);
        for (let k = 0; k < w; k++) {
            const x = side === 'l' ? k : TILE - 1 - k;
            p.P(x, y, k === 0 ? ROCK.crack : (y % 5 === 0 ? ROCK.dark : ROCK.light));
        }
    }
}

/** 高地北沿：低的那格在后面看不见，只在高地最北一行顶上压一道细线。 */
export function cliffTop(p: Pen): void {
    for (let x = 0; x < TILE; x++) {
        p.P(x, 0, 0x3f6a2c);
        if (p.r() < 0.5) p.P(x, 1, 0x4a7a33);
    }
}

/** 一棵茶丛：圆滚滚一团，一排排种在梯田上。 */
export function teaBush(p: Pen): void {
    groundShadow(p, 8, 13, 6, 2);
    p.E(8, 9, 7, 5, (dx, dy) => {
        if (dx * dx / 49 + dy * dy / 25 > 0.8) return 0x24521f;
        if (dy < -1 && dx < 2) return 0x5ea64a;
        return p.r() < 0.15 ? 0x2f6b2a : 0x3f8a36;
    });
    for (let i = 0; i < 6; i++) p.P(3 + Math.floor(p.r() * 10), 5 + Math.floor(p.r() * 3), 0x8cc860);
}

/**
 * 木板（码头、栈桥）或石板（九曲桥）铺在水上：底下是水，边上不连着板的一侧留一道水缝和影子。
 * mask 用 N/E/S/W_ 表示四边接着的是板或岸。
 */
export function plankTile(p: Pen, mask: number, kind: 'wood' | 'slab', water: (x: number, y: number, k: number) => number): void {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) p.P(x, y, water(x, y, 99));
    const pal = kind === 'wood'
        ? { a: [0x9c6b3e, 0xa8794a, 0x8f6036], gap: 0x5a3a24, edge: 0x4a2f1c }
        : { a: [0xc4c0b5, 0xb4b0a6, 0xbdb9ae], gap: 0x8a867e, edge: 0x6f6b62 };
    const x0 = mask & W_ ? 0 : 2;
    const x1 = mask & E ? TILE : TILE - 2;
    const y0 = mask & N ? 0 : 2;
    const y1 = mask & S ? TILE : TILE - 3;
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            const board = Math.floor(y / 4);
            let c = pal.a[board % 3];
            if (y % 4 === 3) c = pal.gap;
            else if (kind === 'wood' && (x + board * 5) % 13 === 0) c = pal.gap;
            else if (kind === 'slab' && (x + board * 6) % 8 === 0) c = pal.gap;
            p.P(x, y, c);
        }
    }
    // 不连着的边：外沿暗线，南边再往水里投一道影子；木码头四角有桩
    if (!(mask & S)) {
        p.R(x0, y1, x1 - x0, 1, pal.edge);
        p.R(x0, y1 + 1, x1 - x0, 2, 0x2f5a75);
    }
    if (!(mask & W_)) p.R(x0, y0, 1, y1 - y0, pal.edge);
    if (!(mask & E)) p.R(x1 - 1, y0, 1, y1 - y0, pal.edge);
    if (!(mask & N)) p.R(x0, y0, x1 - x0, 1, kind === 'wood' ? 0xb8895a : 0xd4d0c6);
    if (kind === 'wood') {
        for (const [px, cond] of [[x0, !(mask & W_)], [x1 - 2, !(mask & E)]] as [number, boolean][]) {
            if (cond && !(mask & S)) p.R(px, y1 - 2, 2, 4, 0x4a2f1c);
        }
    }
}

/** 运货的大木船（6×3 格）：船舱上堆着货，船尾一根橹。 */
export function cargoBoat(p: Pen): void {
    const W = 6 * TILE;
    for (let x = 4; x < W - 4; x++) {
        const t = Math.abs(x - W / 2) / (W / 2 - 4);
        const top = 26 - Math.round(t * t * 8);
        const bot = 40 - Math.round(t * 4);
        p.R(x, top, 1, bot - top, x % 6 === 0 ? 0x5a3a24 : 0x6b4527);
        p.P(x, top, 0x8a5a34);
        p.P(x, top + 1, 0x8a5a34);
        p.P(x, bot - 1, 0x3b2616);
    }
    // 船篷
    for (let x = 30; x < 62; x++) {
        const t = Math.abs(x - 46) / 16;
        const top = 8 + Math.round(t * t * 8);
        p.R(x, top, 1, 24 - top, x % 4 === 0 ? 0x3d3d3d : 0x2b2b2b);
        p.P(x, top, 0x4a4a4a);
    }
    // 货：木箱和麻袋
    for (const [bx, by, c] of [[12, 16, 0xa8794a], [20, 18, 0x9c6b3e], [66, 16, 0xa8794a], [74, 18, 0x9c6b3e]] as [number, number, number][]) {
        p.R(bx, by, 7, 7, c);
        p.R(bx, by, 7, 1, 0xc49a68);
        p.R(bx + 3, by, 1, 7, 0x5a3a24);
    }
    p.E(26, 22, 3, 2, (dx, dy) => (dy < 0 ? 0xe2cf9a : 0xc9b27a));
    p.R(W - 10, 4, 1, 26, 0x8a5a34);
    p.R(W - 12, 4, 5, 1, 0x8a5a34);
    for (const [sx, sw] of [[10, 12], [40, 16], [70, 10]]) p.R(sx, 44, sw, 1, C.shine);
}

/** 一只木箱、一个酒坛、一袋米，码头和集市上堆着。 */
export function crate(p: Pen): void {
    groundShadow(p, 8, 14, 7, 2);
    p.R(2, 3, 12, 11, 0x9c6b3e);
    p.R(2, 3, 12, 2, 0xb8895a);
    p.R(2, 3, 1, 11, 0x5a3a24);
    p.R(13, 3, 1, 11, 0x5a3a24);
    p.R(2, 13, 12, 1, 0x5a3a24);
    for (let i = 0; i < 10; i++) p.P(3 + i, 5 + i, 0x7a4f2c);
}

export function wineJar(p: Pen): void {
    groundShadow(p, 8, 14, 6, 2);
    p.E(8, 9, 5, 5, (dx, dy) => (dx < -2 ? 0x6e4a2e : dx > 2 ? 0x4a2f1c : 0x5a3a24));
    p.R(5, 3, 6, 2, 0x5a3a24);
    p.R(4, 1, 8, 3, C.red);
    p.R(5, 1, 6, 1, C.redLight);
    p.R(6, 8, 4, 4, C.paper);
    p.P(7, 9, C.red);
    p.P(8, 10, C.red);
}

export function riceSack(p: Pen): void {
    groundShadow(p, 8, 14, 6, 2);
    p.E(8, 9, 6, 5, (dx, dy) => (dx + dy < -3 ? 0xeee0b4 : dx + dy > 3 ? 0xb9a46e : 0xd8c690));
    p.R(6, 3, 4, 2, 0xb9a46e);
    p.P(7, 2, 0x8a7a50);
    p.P(8, 2, 0x8a7a50);
}

/** 山顶亭子（4×5 格）：石台、四根红柱、一层飞檐攒尖顶。 */
export function pavilion(p: Pen): void {
    const W = 4 * TILE;
    const H = 5 * TILE;
    p.R(4, H - 6, W - 4, 5, C.shadow, 50);
    // 石台
    p.R(2, H - 14, W - 4, 10, C.stone[0]);
    p.R(2, H - 14, W - 4, 2, 0xd4d0c6);
    p.R(2, H - 5, W - 4, 1, C.stoneEdge);
    for (let x = 6; x < W - 4; x += 9) p.R(x, H - 12, 1, 7, C.mortar);
    // 柱子和美人靠
    for (const x of [8, 22, 38, 52]) {
        p.R(x, 40, 4, H - 54, x === 22 || x === 38 ? 0xa82724 : C.red);
        p.R(x, 40, 1, H - 54, C.redLight);
    }
    p.R(6, H - 24, W - 12, 3, C.woodDark);
    p.R(6, H - 24, W - 12, 1, C.woodLight);
    // 屋顶：飞檐，攒尖往上收到宝顶
    tileEave(p, 0, W, 26, 42);
    for (let y = 8; y < 28; y++) {
        const half = Math.round(4 + ((y - 8) / 20) * 24);
        p.R(W / 2 - half, y, half * 2, 1, (y % 3 === 0) ? C.roof[0] : C.roof[1]);
        p.P(W / 2 - half, y, C.roofEdge);
        p.P(W / 2 + half - 1, y, C.roofEdge);
    }
    for (let y = 10; y < 27; y += 3) p.R(W / 2 - 1, y, 2, 2, C.roofRib);
    p.R(W / 2 - 2, 2, 4, 6, C.gold);
    p.R(W / 2 - 1, 0, 2, 2, C.gold);
    p.P(W / 2 - 2, 3, 0xf3d892);
}

const TEMPLE = { wall: 0xd8a64a, wallShade: 0xb98a34, roof: [0x4a4038, 0x5a4e44], edge: 0x2e2620 };

/** 古寺大殿（8×6 格）：黄墙、红柱、重檐，正门匾额，门前石阶。 */
export function templeHall(p: Pen): void {
    const W = 8 * TILE;
    const H = 6 * TILE;
    const base = H - 4;
    p.R(6, base, W - 6, 4, C.shadow, 56);
    // 台基
    p.R(2, base - 8, W - 4, 8, C.stone[0]);
    p.R(2, base - 8, W - 4, 1, 0xd4d0c6);
    for (let x = 6; x < W - 4; x += 12) p.R(x, base - 7, 1, 7, C.mortar);
    // 墙
    const wy = 48;
    p.R(6, wy, W - 12, base - 8 - wy, TEMPLE.wall);
    p.R(W - 10, wy, 4, base - 8 - wy, TEMPLE.wallShade);
    p.R(6, wy, W - 12, 3, TEMPLE.wallShade);
    // 红柱一排
    for (let x = 10; x < W - 8; x += 18) {
        p.R(x, wy, 4, base - 8 - wy, C.red);
        p.R(x, wy, 1, base - 8 - wy, C.redLight);
    }
    // 正门：朱门金钉
    const dw = 20;
    const dx = W / 2 - dw / 2;
    p.R(dx - 1, wy + 10, dw + 2, base - 8 - wy - 10, 0x6b1a17);
    p.R(dx, wy + 11, dw, base - 8 - wy - 11, 0xa82724);
    p.R(W / 2, wy + 11, 1, base - 8 - wy - 11, 0x6b1a17);
    for (let yy = wy + 14; yy < base - 10; yy += 4) for (const xx of [dx + 3, dx + 7, dx + 13, dx + 17]) p.P(xx, yy, C.gold);
    // 两侧圆窗
    for (const cx of [26, W - 26]) {
        p.E(cx, wy + 18, 6, 6, (ddx, ddy) => (ddx * ddx + ddy * ddy > 25 ? 0x6b3f22 : (ddx + ddy) % 3 === 0 ? 0x8a5a34 : C.paper));
    }
    // 门前石阶
    for (let k = 0; k < 3; k++) p.R(dx - 6 + k * 2, base - 2 - k * 2, dw + 12 - k * 4, 2, k % 2 ? 0xb4b0a6 : 0xc4c0b5);
    // 下檐
    tileEave(p, 0, W, 36, 50);
    // 上檐和屋脊
    p.R(16, 26, W - 32, 10, TEMPLE.wall);
    p.R(16, 26, W - 32, 2, TEMPLE.wallShade);
    for (let x = 20; x < W - 20; x += 10) p.R(x, 28, 2, 8, C.red);
    tileEave(p, 8, W - 8, 10, 28);
    p.R(14, 6, W - 28, 5, TEMPLE.edge);
    p.R(15, 6, W - 30, 1, 0x5a4e44);
    for (const [x, d] of [[12, -1], [W - 13, 1]] as [number, number][]) {
        p.R(x, 3, 2, 5, TEMPLE.edge);
        p.P(x + d, 2, TEMPLE.edge);
        p.P(x + d * 2, 1, TEMPLE.edge);
    }
    p.R(W / 2 - 3, 2, 6, 5, C.gold);
    // 匾额
    p.R(W / 2 - 12, 38, 24, 9, 0x2a3a5a);
    p.R(W / 2 - 11, 39, 22, 7, 0x34497a);
    for (let k = 0; k < 3; k++) p.R(W / 2 - 8 + k * 6, 41, 4, 3, C.gold);
}

/** 宝塔（4×9 格）：五层，每层一道檐，越往上越窄，顶上塔刹。 */
export function pagoda(p: Pen): void {
    const W = 4 * TILE;
    const H = 9 * TILE;
    p.R(6, H - 4, W - 8, 4, C.shadow, 56);
    p.R(6, H - 12, W - 12, 8, C.stone[0]);
    p.R(6, H - 12, W - 12, 1, 0xd4d0c6);
    const floors = 5;
    let y = H - 12;
    for (let f = 0; f < floors; f++) {
        const half = 22 - f * 3;
        const bodyH = 18 - f;
        const top = y - bodyH;
        p.R(W / 2 - half + 4, top, (half - 4) * 2, bodyH, TEMPLE.wall);
        p.R(W / 2 + half - 8, top, 4, bodyH, TEMPLE.wallShade);
        // 每层正中一扇拱门
        p.R(W / 2 - 3, top + 6, 6, bodyH - 6, 0x6b1a17);
        p.R(W / 2 - 2, top + 5, 4, 1, 0x6b1a17);
        tileEave(p, W / 2 - half - 2, W / 2 + half + 2, top - 6, top + 2);
        y = top - 6;
    }
    p.R(W / 2 - 1, y - 18, 2, 18, 0x8a7a50);
    for (let k = 0; k < 4; k++) p.R(W / 2 - 3 + (k % 2), y - 6 - k * 4, 6 - 2 * (k % 2), 2, C.gold);
    p.R(W / 2 - 1, y - 22, 2, 4, C.gold);
}

/** 香炉（2×2 格）：三足铜鼎，冒两缕烟。 */
export function incenseBurner(p: Pen): void {
    groundShadow(p, 16, 29, 10, 2);
    for (const x of [8, 15, 22]) p.R(x, 24, 2, 5, 0x4a3a20);
    p.E(16, 20, 10, 6, (dx, dy) => (dy < -3 ? 0x8a7a40 : dx < -4 ? 0x9c8a4a : dx > 5 ? 0x5a4a28 : 0x7a6a38));
    p.R(6, 13, 20, 3, 0x9c8a4a);
    p.R(6, 13, 20, 1, 0xc4b06a);
    for (const x of [7, 23]) p.R(x, 9, 2, 4, 0x7a6a38);
    for (const [sx, ph] of [[13, 0], [19, 2]]) {
        for (let k = 0; k < 10; k++) p.P(sx + Math.round(Math.sin((k + ph) / 2) * 1.5), 12 - k, 0xe8e8e8, 160 - k * 12);
    }
}

/** 水车（3×4 格）：木架上一个大轮子，轮辐和戽斗，底下溅水花。 */
export function waterWheel(p: Pen): void {
    const cx = 24;
    const cy = 34;
    const R = 21;
    // 木架
    p.R(cx - 2, 14, 4, 50, 0x5a3a24);
    p.R(4, 60, 40, 3, 0x5a3a24);
    for (let a = 0; a < 16; a++) {
        const t = (a / 16) * Math.PI * 2;
        for (let r = 3; r < R; r++) p.P(Math.round(cx + Math.cos(t) * r), Math.round(cy + Math.sin(t) * r), a % 2 ? 0x7d4a29 : 0x6b3f22);
        // 戽斗
        const bx = Math.round(cx + Math.cos(t) * R);
        const by = Math.round(cy + Math.sin(t) * R);
        p.R(bx - 1, by - 1, 3, 3, 0x8a5a34);
    }
    for (let a = 0; a < 120; a++) {
        const t = (a / 120) * Math.PI * 2;
        for (const r of [R - 1, R - 2]) p.P(Math.round(cx + Math.cos(t) * r), Math.round(cy + Math.sin(t) * r), r === R - 1 ? 0x4a2f1c : 0x7d4a29);
    }
    p.E(cx, cy, 3, 3, () => 0x3b2616);
    for (let k = 0; k < 14; k++) p.P(10 + Math.floor(p.r() * 28), 54 + Math.floor(p.r() * 8), k % 2 ? C.shine : C.shine2);
}

/** 荷花：一张荷叶托一朵粉荷。 */
export function lotus(p: Pen): void {
    p.E(8, 10, 6, 4, (dx, dy) => (dx === 2 && dy <= 0 ? null : dy < 0 ? 0x6db054 : 0x4b8a3a));
    p.R(7, 5, 1, 5, 0x3f7a2c);
    p.E(7, 4, 3, 3, (dx, dy) => (dy > 1 ? null : Math.abs(dx) < 1 ? 0xfbd3de : dx < 0 ? 0xe98fa6 : 0xf2a6c4));
    p.P(7, 2, 0xffffff);
}

/** 芦苇：水边一丛，穗子是褐色的。 */
export function reeds(p: Pen): void {
    for (let i = 0; i < 6; i++) {
        const x = 2 + i * 2 + Math.floor(p.r() * 2);
        const top = 2 + Math.floor(p.r() * 5);
        for (let y = top; y < TILE; y++) p.P(x + (y < top + 4 ? (i % 2) : 0), y, y > 11 ? 0x4f7a32 : 0x6f9a42);
        p.R(x, top - 2, 1, 3, 0x8a6a3e);
    }
}

/** 青石灯（1×2 格），寺前和湖边摆。 */
export function stoneLamp(p: Pen): void {
    groundShadow(p, 8, 30, 5, 2);
    p.R(5, 24, 6, 6, C.stone[1]);
    p.R(6, 16, 4, 8, C.stone[0]);
    p.R(3, 9, 10, 7, C.stone[2]);
    p.R(5, 11, 6, 3, 0xf3d892);
    p.R(2, 6, 12, 3, C.stoneEdge);
    p.R(5, 3, 6, 3, C.stone[1]);
    p.R(7, 1, 2, 2, C.stone[0]);
}
