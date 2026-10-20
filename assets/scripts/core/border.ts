// 地盘外圈的装饰：按坐标哈希摆树和杂草，同一格永远一样，不进存档。地盘升档变大后外圈跟着重算。
// 坐标是地盘格子坐标，外圈是负数或 ≥ 宽高的格子；每件都是 1×1 占地，图底边居中对齐这一格。
// 远景地面（小河、稻田）按 def.ground 算，同样不进存档。

import { BorderDef, Side, Terrain } from './defs';
import { E, N, S, terrainJoins, W } from './village';

export interface Decor {
    sprite: string;
    x: number;
    y: number;
}

function hash01(x: number, y: number, salt: number): number {
    let h = Math.imul(x + salt * 7919, 374761393) ^ Math.imul(y - salt * 104729, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function pick(list: [string, number][], r: number): string {
    const total = list.reduce((a, [, w]) => a + w, 0);
    let acc = 0;
    for (const [name, w] of list) {
        acc += w / total;
        if (r < acc) return name;
    }
    return list[list.length - 1][0];
}

/** 离地盘有几格远（地盘里是 0）。 */
export function outside(w: number, h: number, x: number, y: number): number {
    const dx = x < 0 ? -x : x >= w ? x - w + 1 : 0;
    const dy = y < 0 ? -y : y >= h ? y - h + 1 : 0;
    return Math.max(dx, dy);
}

/** 树的位置是否不会挡住地盘：树冠左右各宽一格、往上高 treeHeight-1 格。 */
function treeFits(def: BorderDef, w: number, h: number, x: number, y: number): boolean {
    const top = y - (def.treeHeight - 1);
    // 树图占的格子：x-1..x+1，top..y，全在地盘外才行
    return x + 1 < 0 || x - 1 >= w || y < 0 || top >= h;
}

/** 外圈这格的远景地面，草地是 null。 */
export function borderGround(def: BorderDef, w: number, h: number, x: number, y: number): Terrain | null {
    for (const g of def.ground ?? []) {
        const d = g.side === 'bottom' ? y - h + 1 : g.side === 'top' ? -y : g.side === 'left' ? -x : x - w + 1;
        const pos = g.side === 'bottom' || g.side === 'top' ? x : y;
        const along = g.along ? pos >= g.along[0] && pos <= g.along[1] : g.side === 'bottom' || g.side === 'top' || (y >= 0 && y < h);
        if (!along || d < g.from || d > g.to) continue;
        if (g.ridge && (g.side === 'left' || g.side === 'right' ? y : x) % g.ridge === 0) return 'dirt';
        return g.terrain;
    }
    return null;
}

/**
 * 整张画面（地盘 + 外圈）上某格地面的四邻掩码：地盘里按 grid，外圈按远景地面，按 terrainJoins 算连不连；
 * 画面以外算连着（小河一直流出去）。这样地盘里的小溪能接上外圈的溪水。
 */
export function sceneMask(def: BorderDef, grid: (Terrain | null)[], w: number, h: number, x: number, y: number): number {
    const m = def.margin;
    const at = (xx: number, yy: number) => (outside(w, h, xx, yy) === 0 ? grid[yy * w + xx] : borderGround(def, w, h, xx, yy));
    const t = at(x, y);
    const same = (xx: number, yy: number) => {
        if (xx < -m || yy < -m || xx >= w + m || yy >= h + m) return true;
        return terrainJoins(t, at(xx, yy));
    };
    return (same(x, y - 1) ? N : 0) | (same(x + 1, y) ? E : 0) | (same(x, y + 1) ? S : 0) | (same(x - 1, y) ? W : 0);
}

/** 外圈这格在地盘的哪一边（角上按离得远的那个方向算）。 */
function sideOf(w: number, h: number, x: number, y: number): Side {
    const dx = x < 0 ? -x : x >= w ? x - w + 1 : 0;
    const dy = y < 0 ? -y : y >= h ? y - h + 1 : 0;
    if (dy >= dx) return y < 0 ? 'top' : 'bottom';
    return x < 0 ? 'left' : 'right';
}

export function borderDecor(def: BorderDef, w: number, h: number): Decor[] {
    const m = def.margin;
    const out: Decor[] = [];
    const used = new Set<string>();
    const put = (sprite: string, x: number, y: number) => {
        used.add(`${x},${y}`);
        out.push({ sprite, x, y });
    };
    // 树：粗网格上抖动一下
    const step = def.trees.spacing;
    for (let gy = -m; gy < h + m; gy += step) {
        for (let gx = -m; gx < w + m; gx += step) {
            const x = gx + Math.floor(hash01(gx, gy, 1) * step);
            const y = gy + Math.floor(hash01(gx, gy, 2) * step);
            if (x < -m || y < -m || x >= w + m || y >= h + m) continue;
            if (outside(w, h, x, y) < 2 || !treeFits(def, w, h, x, y) || borderGround(def, w, h, x, y)) continue;
            if (hash01(x, y, 3) >= def.trees.density) continue;
            const sprites = def.sideTrees?.[sideOf(w, h, x, y)] ?? def.trees.sprites;
            put(pick(sprites, hash01(x, y, 4)), x, y);
        }
    }
    // 贴边一圈和零散杂草
    for (let y = -m; y < h + m; y++) {
        for (let x = -m; x < w + m; x++) {
            const d = outside(w, h, x, y);
            if (d === 0 || used.has(`${x},${y}`) || borderGround(def, w, h, x, y)) continue;
            const layer = d === 1 ? def.edge : def.scatter;
            if (hash01(x, y, 5) < layer.density) put(pick(layer.sprites, hash01(x, y, 6)), x, y);
        }
    }
    return out;
}
