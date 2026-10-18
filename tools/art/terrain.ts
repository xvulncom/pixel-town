// 地面：草地、地形图块（按四邻选边缘）、草丛野花。

import { Pen, Rnd, TILE, pick } from './canvas';
import { C } from './palette';

/** 草地底色：整块一个主色，上面撒短草叶和亮点，比逐像素随机干净。 */
export function grassFill(p: Pen, pal: readonly number[] = C.grass, bladeCol = C.blade): void {
    p.R(0, 0, TILE, TILE, pal[0]);
    for (let i = 0; i < 7; i++) {
        const x = Math.floor(p.r() * TILE);
        const y = Math.floor(p.r() * TILE);
        p.R(x, y, 2, 1, pal[1]);
    }
    for (let i = 0; i < 9; i++) {
        const x = Math.floor(p.r() * TILE);
        const y = Math.floor(p.r() * (TILE - 1));
        p.P(x, y, pal[2]);
        p.P(x, y + 1, bladeCol);
    }
    for (let i = 0; i < 3; i++) p.P(Math.floor(p.r() * TILE), Math.floor(p.r() * TILE), pal[pal.length - 1]);
}

export function blade(p: Pen, x: number, y: number): void {
    p.P(x, y, C.blade);
    p.P(x + 1, y - 1, C.blade);
    p.P(x + 2, y, C.blade);
}

export function grassTile(p: Pen, kind: 'plain' | 'plain2' | 'tuft' | 'flowers'): void {
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

/** 深色草丛：一簇一簇的高草，放在 deco 层，随噪声成片出现。 */
export function tallGrass(p: Pen): void {
    p.R(2, 14, 12, 1, C.shadow, 40);
    // 每簇草叶的位置和高矮随机，几种变体混着用
    const blades = [2, 4, 6, 8, 10, 12].filter(() => p.r() < 0.85).map((x) => [x, 5 + Math.floor(p.r() * 6)]);
    for (const [x, h] of blades) {
        for (let j = 0; j < h; j++) {
            const lean = j > h * 0.6 ? (x < 8 ? -1 : 1) : 0;
            p.P(x + lean, 14 - j, j > h - 3 ? 0x8cc860 : j > h / 2 ? C.grass[3] : C.lushBlade);
            p.P(x + 1 + lean, 14 - j, j > h / 2 ? C.lush[1] : C.lushBlade);
        }
    }
}

/** 一簇野花，cols 是花色。 */
export function flowerPatch(p: Pen, cols: number[]): void {
    for (let i = 0; i < 6; i++) {
        const x = 2 + Math.floor(p.r() * 11);
        const y = 3 + Math.floor(p.r() * 10);
        const c = cols[i % cols.length];
        p.P(x, y + 1, C.blade);
        p.P(x, y + 2, C.blade);
        p.P(x - 1, y, c);
        p.P(x + 1, y, c);
        p.P(x, y - 1, c);
        p.P(x, y, 0xf4e27a);
    }
}

// 四邻掩码：同类邻居对应位为 1
export const N = 1;
export const E = 2;
export const S = 4;
export const W_ = 8;

/** 地形图块：开口的一侧露出草地，边缘锯齿随机。paint 拿到离草地的距离 k（0 是最外一圈）。 */
export function terrainTile(p: Pen, mask: number, margin: number, jagMax: number, paint: (x: number, y: number, k: number) => number): void {
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

export function dirtPaint(r: Rnd) {
    return (_x: number, _y: number, k: number) => (k === 0 ? C.dirtEdge : pick(r, C.dirt, [0.6, 0.3, 0.1]));
}

// 开阔水面反光的几种排法（行, 起点），每种一组动画帧，地图上随机混用，免得一眼看出重复
// 开阔水面上的波光（行, 起点），每种一组 4 帧动画，地图上随机混用，免得一眼看出重复
export const SHINES: [number, number][][] = [
    [[3, 0], [10, 9]],
    [[6, 7], [13, 13]],
    [[2, 11], [9, 3]],
];
// 每组的暗色波纹所在行
const WAVES = [[6, 13], [2, 10], [5, 14]];

/** frame 0~3：波纹和波光每帧往右挪 4px，4 帧正好循环一圈；variant 选波光排法。 */
export function waterPaint(frame: number, variant = 0) {
    return (x: number, y: number, k: number) => {
        // 江南驳岸：一圈条石压顶，下面是石壁，靠岸的水被石壁挡出一道深色
        const joint = (x + y) % 7 === 0;
        if (k === 0) return joint ? C.mortar : C.stone[2];
        if (k === 1) return joint ? C.plinthJoint : C.plinth;
        if (k === 2) return 0x6f6b62;
        if (k < 5) return 0x2f5a75;
        if (k < 7) return C.water[0];
        const shift = frame * 4;
        for (const [row, off] of SHINES[variant]) {
            // 一道弯弯的波光，形如 ︶
            const dx = (x - off - shift + TILE * 2) % TILE;
            if ((y === row && (dx === 0 || dx === 4)) || (y === row + 1 && dx >= 1 && dx <= 3)) return k < 9 ? C.water[2] : C.shine;
            if (y === row + 2 && dx === 2 && k >= 9) return C.shine2;
        }
        for (const base of WAVES[variant]) {
            const wy = base + Math.round(Math.sin(((x + shift) / TILE) * Math.PI * 2));
            if (y === wy) return k < 9 ? C.water[0] : C.water[1];
        }
        return k < 9 ? C.water[1] : C.water[2];
    };
}

export function soilPaint(r: Rnd) {
    return (_x: number, y: number, k: number) => {
        if (k === 0) return C.soilEdge;
        const m = y % 4;
        if (m === 0) return C.soilLight;
        if (m === 3) return C.soilDark;
        return r() < 0.1 ? C.soilDark : C.soil;
    };
}

/** 青石板：三排长短不一的条石，缝里偶尔长青苔。每块图块的切法随机，铺开来不显重复。 */
export function stonePaint(r: Rnd) {
    const rows = [[0, 5], [5, 10], [10, 16]];
    const cuts = rows.map(() => {
        const c = 3 + Math.floor(r() * 10);
        return [0, c, r() < 0.4 ? Math.min(15, c + 4 + Math.floor(r() * 4)) : 16, 16];
    });
    const tones = rows.map(() => [0, 1, 2].map(() => C.stone[Math.floor(r() * 3)]));
    const moss = Array.from({ length: TILE * TILE }, () => r() < 0.12);
    return (x: number, y: number, k: number) => {
        if (k === 0) return C.stoneEdge;
        const ri = rows.findIndex(([a, b]) => y >= a && y < b);
        const [y0, y1] = rows[ri];
        const cut = cuts[ri];
        const si = cut.findIndex((c, i) => i < cut.length - 1 && x >= c && x < cut[i + 1]);
        const isSeam = y === y1 - 1 || (x === cut[si] && x > 0);
        if (isSeam) return moss[y * TILE + x] ? 0x7a8f5a : C.mortar;
        if (y === y0 || x === cut[si] + 1) return 0xc8c4ba;
        return tones[ri][si];
    };
}

