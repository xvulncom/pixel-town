// 地盘外圈的装饰：按坐标哈希摆树和杂草，同一格永远一样，不进存档。地盘升档变大后外圈跟着重算。
// 坐标是地盘格子坐标，外圈是负数或 ≥ 宽高的格子；每件都是 1×1 占地，图底边居中对齐这一格。

import { BorderDef } from './defs';

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
            if (outside(w, h, x, y) < 2 || !treeFits(def, w, h, x, y)) continue;
            if (hash01(x, y, 3) >= def.trees.density) continue;
            put(pick(def.trees.sprites, hash01(x, y, 4)), x, y);
        }
    }
    // 贴边一圈和零散杂草
    for (let y = -m; y < h + m; y++) {
        for (let x = -m; x < w + m; x++) {
            const d = outside(w, h, x, y);
            if (d === 0 || used.has(`${x},${y}`)) continue;
            const layer = d === 1 ? def.edge : def.scatter;
            if (hash01(x, y, 5) < layer.density) put(pick(layer.sprites, hash01(x, y, 6)), x, y);
        }
    }
    return out;
}
