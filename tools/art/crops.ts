// 自己地盘菜地上的作物图，1×2 格（16×32），下半格对着菜地那一格。
// 生长阶段共用：crop_sprout 小苗、crop_young 半大、crop_withered 枯苗；成熟时每种作物一张 crop_<作物 id>。
// 新作物在 LOOKS 加一行（选个样子和颜色），npm test 会查每种作物都有成熟图。

import { Pen, groundShadow } from './canvas';

type Shape = 'leafy' | 'root' | 'berry' | 'big' | 'tall' | 'pod' | 'sapling';

interface Look {
    shape: Shape;
    /** 果实或菜叶的主色 */
    color: number;
}

const LEAF = 0x5f9c3e;
const LEAF_LIGHT = 0x8fcf6a;
const LEAF_DARK = 0x3f7a2a;
const STEM = 0x4f8a30;

export const LOOKS: Record<string, Look> = {
    bokchoy: { shape: 'leafy', color: 0xa8dc84 },
    spinach: { shape: 'leafy', color: 0x5f9c3e },
    napa: { shape: 'leafy', color: 0xd9f2c4 },
    pea: { shape: 'pod', color: 0x8fcf6a },
    soybean: { shape: 'pod', color: 0xb9a05a },
    radish: { shape: 'root', color: 0xf1eee4 },
    sweetpotato: { shape: 'root', color: 0xb5506a },
    strawberry: { shape: 'berry', color: 0xd9333a },
    cucumber: { shape: 'berry', color: 0x3f7a2a },
    tomato: { shape: 'berry', color: 0xe0482e },
    grape: { shape: 'berry', color: 0x7a3f9a },
    blueberry: { shape: 'berry', color: 0x4a5fb0 },
    goji: { shape: 'berry', color: 0xe0402e },
    huajiao: { shape: 'berry', color: 0xb0302a },
    watermelon: { shape: 'big', color: 0x3d8a3a },
    pumpkin: { shape: 'big', color: 0xe8922e },
    corn: { shape: 'tall', color: 0xf0cc4a },
    cherry: { shape: 'sapling', color: 0xc9202e },
    yangmei: { shape: 'sapling', color: 0x8a1f3a },
    lychee: { shape: 'sapling', color: 0xe0505a },
    tangerine: { shape: 'sapling', color: 0xf09a2a },
    persimmon: { shape: 'sapling', color: 0xe8762a },
    apple: { shape: 'sapling', color: 0xd8382e },
    chili: { shape: 'berry', color: 0xd0302a },
    pricklypear: { shape: 'berry', color: 0xd0405e },
};

function shade(c: number, k: number): number {
    const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
    return (f(c >> 16) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255);
}

/** 一颗 3×3 的小果子，带高光。 */
function fruit(p: Pen, x: number, y: number, c: number): void {
    p.R(x, y, 3, 3, c);
    p.R(x, y + 2, 3, 1, shade(c, 0.75));
    p.P(x, y, shade(c, 1.3));
}

function leaves(p: Pen, cx: number, top: number, n: number): void {
    for (let i = 0; i < n; i++) {
        const x = cx - n + i * 2;
        p.R(x, top + (i % 2), 2, 30 - top - (i % 2) - 1, i % 2 ? LEAF : LEAF_LIGHT);
    }
}

export function cropStageArt(p: Pen, stage: 'sprout' | 'young' | 'withered'): void {
    if (stage === 'sprout') {
        for (const ox of [4, 10]) {
            p.R(ox, 25, 1, 5, STEM);
            p.R(ox - 2, 24, 2, 2, LEAF_LIGHT);
            p.R(ox + 1, 23, 2, 2, LEAF_LIGHT);
        }
    } else if (stage === 'young') {
        groundShadow(p, 8, 29, 5, 1);
        p.E(8, 24, 5, 5, (dx, dy) => (dy > 2 ? LEAF_DARK : dx < 0 ? LEAF : LEAF_LIGHT));
        p.R(7, 17, 2, 5, LEAF);
        p.P(5, 21, 0xbfe8a0);
        p.P(10, 22, 0xbfe8a0);
    } else {
        for (const [ox, h] of [[4, 6], [8, 4], [11, 5]]) {
            p.R(ox, 30 - h, 1, h, 0x8a6a3a);
            p.R(ox + 1, 30 - h, 2, 1, 0xa88a50);
        }
    }
}

export function cropRipeArt(p: Pen, look: Look): void {
    const c = look.color;
    switch (look.shape) {
        case 'leafy':
            groundShadow(p, 8, 29, 6, 1);
            p.E(8, 23, 7, 6, (dx, dy) => (dy > 3 ? shade(c, 0.7) : dx * dx + dy * dy < 8 ? shade(c, 1.2) : c));
            p.R(7, 18, 2, 10, shade(c, 0.85));
            p.P(4, 21, shade(c, 1.3));
            p.P(11, 20, shade(c, 1.3));
            break;
        case 'root':
            leaves(p, 8, 14, 4);
            p.E(8, 28, 4, 2, (dx, dy) => (dy < 0 ? shade(c, 1.1) : dx > 1 ? shade(c, 0.8) : c));
            break;
        case 'berry':
            p.R(3, 12, 1, 18, 0x9c8a5a);
            p.R(12, 12, 1, 18, 0x9c8a5a);
            p.E(8, 20, 6, 8, (dx, dy) => ((dx + dy) % 3 === 0 ? LEAF_DARK : dy < -3 ? LEAF_LIGHT : LEAF));
            for (const [x, y] of [[4, 16], [9, 19], [5, 23], [10, 25], [7, 12]]) fruit(p, x, y, c);
            break;
        case 'big':
            p.R(2, 22, 6, 3, LEAF);
            p.R(9, 21, 5, 3, LEAF_LIGHT);
            groundShadow(p, 8, 30, 6, 1);
            p.E(8, 26, 6, 4, (dx, dy) =>
                look.color === 0x3d8a3a ? (dx % 3 === 0 ? 0x2c5e26 : dy < -1 ? 0x5aa850 : c) : (dx % 3 === 0 ? shade(c, 0.8) : dy < -1 ? shade(c, 1.15) : c));
            p.R(7, 21, 2, 2, STEM);
            break;
        case 'tall':
            p.R(7, 2, 2, 28, STEM);
            for (const [y, d] of [[8, -1], [13, 1], [18, -1], [23, 1]]) p.R(d < 0 ? 2 : 9, y, 5, 2, d < 0 ? LEAF : LEAF_LIGHT);
            p.R(9, 10, 3, 7, c);
            p.R(9, 10, 1, 7, shade(c, 1.2));
            p.R(10, 8, 1, 2, 0xc9a050);
            break;
        case 'pod':
            p.E(8, 21, 6, 8, (dx, dy) => (dy < -4 ? LEAF_LIGHT : (dx + dy) % 4 === 0 ? LEAF_DARK : LEAF));
            for (const [x, y] of [[4, 17], [10, 20], [6, 24]]) {
                p.R(x, y, 2, 5, c);
                p.P(x, y, shade(c, 1.25));
            }
            break;
        case 'sapling':
            groundShadow(p, 8, 29, 4, 1);
            p.R(7, 18, 2, 12, 0x7a5236);
            p.E(8, 12, 7, 9, (dx, dy) => (dy > 5 ? LEAF_DARK : dx < -2 && dy < 0 ? LEAF_LIGHT : LEAF));
            for (const [x, y] of [[3, 9], [9, 6], [10, 13], [4, 15], [7, 11]]) fruit(p, x, y, c);
            break;
    }
}
