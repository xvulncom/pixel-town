// 自己地盘上的农家物件和天然地貌：花圃、蜂箱、稻草人、草垛、鸡舍、鸭棚、葡萄架、晒谷场、土地庙，
// 以及开荒前的大石头、老树。尺寸照星露谷，图底边对齐占地的底边。

import { Pen, Rnd, TILE, groundShadow } from './canvas';
import { C } from './palette';
import { canopy, tileEave } from './props';

const STRAW = { base: 0xd9b45a, light: 0xedd27f, dark: 0xa8823a, line: 0x7a5a28 };

/** 碎石路：土底上撒一层大小不一的灰白卵石。 */
export function gravelPaint(r: Rnd) {
    const pebbles = Array.from({ length: TILE * TILE }, () => r());
    return (x: number, y: number, k: number) => {
        if (k === 0) return 0x8a7a62;
        const v = pebbles[y * TILE + x];
        if (v < 0.18) return 0xc9c3b6;
        if (v < 0.3) return 0xa9a296;
        if (v < 0.36) return 0x7d766a;
        return v < 0.7 ? 0xb39c78 : 0xa58d6a;
    };
}

/** 花圃（1×1）：一圈小石子围着的几簇花。 */
export function flowerbed(p: Pen): void {
    p.E(8, 10, 7, 5, (dx, dy) => (Math.abs(dx) > 5 || Math.abs(dy) > 3 ? 0xb8b0a0 : C.soil));
    const cols = [0xe98fa6, 0xf4e27a, 0xf7f7f2, 0xb7a0e0];
    for (const [x, y, i] of [[4, 8, 0], [8, 7, 1], [12, 9, 2], [6, 12, 3], [10, 12, 0]]) {
        p.R(x, y + 1, 1, 2, C.leaf[1]);
        p.P(x - 1, y, cols[i]);
        p.P(x + 1, y, cols[i]);
        p.P(x, y - 1, cols[i]);
        p.P(x, y, 0xf3d892);
    }
}

/** 蜂箱（1×2）：木架上一摞三层的白木箱，盖子斜顶，门口几只蜂。 */
export function beehive(p: Pen): void {
    groundShadow(p, 8, 30, 6, 2);
    p.R(3, 26, 2, 4, C.woodDark);
    p.R(11, 26, 2, 4, C.woodDark);
    for (let i = 0; i < 3; i++) {
        const y = 12 + i * 5;
        p.R(2, y, 12, 5, i % 2 ? 0xe8dcc0 : 0xf1e8d0);
        p.R(2, y + 4, 12, 1, 0xb8a888);
    }
    p.R(6, 25, 4, 1, 0x3e2a1a);
    p.R(1, 9, 14, 3, C.roof[1]);
    p.R(3, 7, 10, 2, C.roof[0]);
    for (const [x, y] of [[13, 20], [3, 6], [12, 4]]) {
        p.P(x, y, 0xe3b341);
        p.P(x + 1, y, 0x2a2a2a);
    }
}

/** 稻草人（1×2）：十字木架、草帽、破褂子。 */
export function scarecrow(p: Pen): void {
    groundShadow(p, 8, 30, 4, 1);
    p.R(7, 8, 2, 22, C.woodDark);
    p.R(1, 13, 14, 2, C.wood);
    p.R(4, 13, 8, 9, 0x3d6fb0);
    p.R(4, 13, 8, 1, 0x5a8acc);
    p.R(7, 15, 2, 5, 0x2f5890);
    for (const x of [1, 14]) p.R(x, 15, 1, 3, STRAW.base);
    p.E(8, 8, 3, 3, () => 0xe8d2a8);
    p.P(7, 8, 0x2a2a2a);
    p.P(9, 8, 0x2a2a2a);
    p.R(2, 5, 12, 2, STRAW.dark);
    p.E(8, 4, 4, 2, (_dx, dy) => (dy < 0 ? STRAW.light : STRAW.base));
}

/** 草垛（2×2）：圆顶的稻草堆，中间插根木杆。 */
export function haystack(p: Pen): void {
    groundShadow(p, 16, 29, 14, 3);
    p.R(15, 1, 2, 8, C.woodDark);
    p.E(16, 19, 14, 11, (dx, dy) => {
        if (dy > 9) return null;
        const v = dx * 0.5 + dy;
        if ((dx + dy * 3) % 7 === 0) return STRAW.line;
        return v < -6 ? STRAW.light : v > 4 ? STRAW.dark : STRAW.base;
    });
    p.R(4, 20, 24, 1, STRAW.line);
}

/** 带瓦顶的小棚子底子：w 宽像素，木板墙，黛瓦。返回墙顶的 y。 */
function shed(p: Pen, w: number, h: number, wall: number): number {
    groundShadow(p, w / 2, h - 2, w / 2 - 2, 3);
    const top = h - 2 - wall;
    p.R(2, top, w - 4, wall, C.wood);
    for (let x = 4; x < w - 4; x += 4) p.R(x, top, 1, wall, C.woodDark);
    p.R(2, h - 3, w - 4, 1, C.woodDark);
    tileEave(p, 0, w, top - 14, top + 1);
    return top;
}

/** 鸡舍（3×3）：小木棚、斜梯、门口两只鸡。 */
export function coop(p: Pen): void {
    const top = shed(p, 48, 48, 16);
    p.R(20, top + 6, 8, 10, 0x3e2a1a);
    for (let y = top + 16; y < 46; y += 2) p.R(28 + (y - top - 16), y, 3, 1, C.woodLight);
    for (const [x, c] of [[8, 0xf7f2e8], [38, 0xc46b48]] as const) {
        p.E(x, 40, 3, 3, () => c);
        p.E(x + 3, 37, 2, 2, () => c);
        p.P(x + 3, 35, 0xd24a3d);
        p.P(x + 5, 37, 0xe3b341);
        p.P(x + 4, 37, 0x2a2a2a);
    }
}

/** 鸭棚（3×3）：低矮的芦苇顶棚子，前面一小汪水，三只鸭子。 */
export function duckShed(p: Pen): void {
    groundShadow(p, 24, 44, 22, 3);
    p.E(24, 40, 16, 5, (_dx, dy) => (dy < -2 ? 0x2f5a75 : C.water[1]));
    p.R(4, 16, 2, 22, C.woodDark);
    p.R(42, 16, 2, 22, C.woodDark);
    p.R(6, 22, 36, 12, 0x8a6a3e);
    for (let y = 8; y < 20; y++) {
        const ex = Math.max(0, 8 - (y - 8));
        p.R(ex, y, 48 - 2 * ex, 1, (y + ex) % 3 === 0 ? STRAW.line : y < 14 ? STRAW.light : STRAW.base);
    }
    for (const [x, y] of [[14, 39], [26, 41], [33, 38]]) {
        p.E(x, y, 3, 2, () => 0xf7f2e8);
        p.E(x - 2, y - 2, 2, 2, () => 0xf7f2e8);
        p.P(x - 4, y - 2, 0xe3a341);
        p.P(x - 2, y - 3, 0x2a2a2a);
    }
}

/** 葡萄架（3×3）：四根木柱撑一片藤叶，底下垂着几串紫葡萄。 */
export function grapeTrellis(p: Pen): void {
    groundShadow(p, 24, 46, 22, 2);
    for (const x of [3, 43]) p.R(x, 10, 2, 36, C.woodDark);
    p.R(1, 10, 46, 2, C.wood);
    canopy(p, [[10, 10, 9], [24, 8, 10], [38, 10, 9], [17, 14, 7], [31, 14, 7]], { dark: 0x3d7a2e, mid: 0x4f9038, light: 0x72b552, line: 0x2c5e26 }, 22);
    for (const x of [10, 20, 30, 38]) {
        for (let k = 0; k < 4; k++) p.E(x + (k % 2), 22 + k * 2, 2 - (k >> 1), 1, () => (k === 0 ? 0x8a5ab0 : 0x5e3a80));
    }
}

/** 晒谷场（4×3）：平整的夯土场子，摊着一片金黄的稻谷，边上一把木耙。 */
export function threshing(p: Pen): void {
    p.R(1, 2, 62, 44, 0xb59a6e);
    p.R(1, 2, 62, 1, 0xcbb488);
    p.R(1, 45, 62, 1, 0x8a7350);
    for (let y = 8; y < 40; y++) {
        for (let x = 6; x < 52; x++) {
            const v = p.r();
            p.P(x, y, v < 0.15 ? STRAW.light : v < 0.85 ? STRAW.base : STRAW.dark);
        }
    }
    for (let x = 8; x < 50; x += 6) p.R(x, 10, 1, 28, STRAW.dark);
    p.R(54, 6, 1, 34, C.woodDark);
    p.R(51, 6, 7, 2, C.wood);
}

/** 土地庙（3×4）：小小的砖龛，红柱黛瓦，里面一尊土地公，前面香炉。 */
export function shrine(p: Pen): void {
    groundShadow(p, 24, 62, 20, 2);
    p.R(4, 54, 40, 8, C.stone[1]);
    p.R(4, 54, 40, 1, C.stone[2]);
    p.R(8, 26, 32, 28, 0xa8583a);
    for (let y = 28; y < 54; y += 4) p.R(8, y, 32, 1, 0x8a4630);
    p.R(16, 32, 16, 20, 0x3a2418);
    p.E(24, 42, 4, 5, () => 0xe3b341);
    p.E(24, 37, 3, 3, () => 0xe8d2a8);
    p.R(22, 34, 5, 2, 0xf7f7f2);
    for (const x of [10, 36]) p.R(x, 28, 2, 26, C.red);
    tileEave(p, 2, 46, 12, 28);
    p.R(18, 14, 12, 4, C.red);
    p.R(20, 15, 8, 2, C.gold);
    p.R(21, 56, 6, 4, 0x7a6a40);
    p.R(22, 52, 1, 4, 0xd24a3d);
    p.R(25, 52, 1, 4, 0xd24a3d);
}

/** 开荒前的大石头（2×2 图，占地 2×1）：青灰色，长着青苔。 */
export function boulder(p: Pen): void {
    groundShadow(p, 16, 28, 14, 3);
    p.E(15, 19, 13, 10, (dx, dy) => {
        if (dy > 8) return null;
        if (dy < -6 && dx < 2) return 0x5b8a40;
        const v = dx * 0.6 + dy;
        return v < -5 ? 0xb4ada0 : v > 5 ? 0x6a655c : 0x8f897d;
    });
    p.E(25, 24, 5, 4, (dx, dy) => (dx + dy < -2 ? 0xa29b8e : 0x77716a));
    p.R(10, 18, 6, 1, 0x5a554e);
    p.R(15, 19, 1, 4, 0x5a554e);
}

/** 老树（5×6 图，占地 2×1）：粗矮的老樟树，盘根错节，树冠宽大。 */
export function oldTree(p: Pen): void {
    groundShadow(p, 40, 90, 26, 5);
    p.R(32, 58, 16, 32, C.trunk);
    p.R(32, 58, 4, 32, C.trunkLight);
    p.R(44, 58, 4, 32, 0x4a2e1c);
    for (const [x, w] of [[26, 8], [46, 8]]) p.R(x, 84, w, 6, C.trunk);
    p.R(38, 66, 4, 5, 0x3a2418);
    canopy(p, [
        [40, 36, 26], [18, 44, 16], [62, 44, 16], [28, 20, 16], [52, 20, 16], [40, 12, 14], [24, 58, 12], [56, 58, 12],
    ], { dark: 0x2f6b2a, mid: 0x3f8a36, light: 0x5ea64a, line: 0x234f20 }, 70);
}
