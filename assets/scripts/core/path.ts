// 寻路：主角"点哪里走到哪里"。格子地图上找一条横平竖直的路，先求步数最少，同样步数里拐弯最少（看着不像锯齿）。
// 不依赖引擎。挡路表从哪来：镇子由 gen-map 生成 <地图>.walk.json（deco 图层的物体、崖壁和没架桥的水面挡路，
// 花草、桥、河埠头台阶能走）；自己地盘由 core/village 的 walkGrid 按占地现算。

export type Cell = [number, number];

export interface WalkGrid {
    w: number;
    h: number;
    /** 1 挡路，0 能走；下标 y * w + x */
    block: Uint8Array;
}

/** 一块格子区域（地点、建筑占地、菜地、镇民脚下）。 */
export interface Area {
    x: number;
    y: number;
    w: number;
    h: number;
}

/** 挡路表的文本形式：每行一个字符串，'#' 挡路、'.' 能走（gen-map 写进 walk.json）。 */
export function gridFromRows(rows: string[]): WalkGrid {
    const h = rows.length;
    const w = h > 0 ? rows[0].length : 0;
    const block = new Uint8Array(w * h);
    rows.forEach((r, y) => {
        for (let x = 0; x < w; x++) block[y * w + x] = r[x] === '#' ? 1 : 0;
    });
    return { w, h, block };
}

export function gridToRows(g: WalkGrid): string[] {
    const rows: string[] = [];
    for (let y = 0; y < g.h; y++) {
        let r = '';
        for (let x = 0; x < g.w; x++) r += g.block[y * g.w + x] ? '#' : '.';
        rows.push(r);
    }
    return rows;
}

export function walkable(g: WalkGrid, x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < g.w && y < g.h && g.block[y * g.w + x] === 0;
}

const DX = [0, -1, 1, 0];
const DY = [1, 0, 0, -1];
/** 一步的代价远大于一次拐弯：先比步数，再比拐弯数 */
const STEP_COST = 10000;
const TURN_COST = 1;

/** 小顶堆，存 [代价, 状态] */
class Heap {
    private keys: number[] = [];
    private vals: number[] = [];

    get size(): number {
        return this.keys.length;
    }

    push(k: number, v: number): void {
        const { keys, vals } = this;
        let i = keys.length;
        keys.push(k);
        vals.push(v);
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (keys[p] <= k) break;
            keys[i] = keys[p];
            vals[i] = vals[p];
            i = p;
        }
        keys[i] = k;
        vals[i] = v;
    }

    pop(): [number, number] {
        const { keys, vals } = this;
        const top: [number, number] = [keys[0], vals[0]];
        const k = keys.pop()!;
        const v = vals.pop()!;
        const n = keys.length;
        if (n > 0) {
            let i = 0;
            for (;;) {
                const l = 2 * i + 1;
                if (l >= n) break;
                const c = l + 1 < n && keys[l + 1] < keys[l] ? l + 1 : l;
                if (keys[c] >= k) break;
                keys[i] = keys[c];
                vals[i] = vals[c];
                i = c;
            }
            keys[i] = k;
            vals[i] = v;
        }
        return top;
    }
}

/**
 * 从 from 走到任意一个满足 goal 的格子，返回拐点序列（含起点和终点，直线上的中间格省掉，可直接给 walk.ts 的 poseAlong）。
 * 起点本身挡路（比如脚下刚盖了东西）也能走出来。走不到返回 null。
 */
export function findPath(g: WalkGrid, from: Cell, goal: (x: number, y: number) => boolean): Cell[] | null {
    const [sx, sy] = from;
    if (sx < 0 || sy < 0 || sx >= g.w || sy >= g.h) return null;
    if (goal(sx, sy)) return [[sx, sy]];
    // 状态 = 格子 × 进来时的方向
    const n = g.w * g.h * 4;
    const cost = new Float64Array(n).fill(Infinity);
    const prev = new Int32Array(n).fill(-1);
    const heap = new Heap();
    const start = sy * g.w + sx;
    for (let d = 0; d < 4; d++) {
        cost[start * 4 + d] = 0;
        heap.push(0, start * 4 + d);
    }
    while (heap.size > 0) {
        const [c, s] = heap.pop();
        if (c > cost[s]) continue;
        const cell = s >> 2;
        const dir = s & 3;
        const x = cell % g.w;
        const y = (cell - x) / g.w;
        if (cell !== start && goal(x, y)) return trace(g, prev, s);
        for (let d = 0; d < 4; d++) {
            const nx = x + DX[d];
            const ny = y + DY[d];
            if (!walkable(g, nx, ny)) continue;
            const ns = (ny * g.w + nx) * 4 + d;
            const nc = c + STEP_COST + (cell !== start && d !== dir ? TURN_COST : 0);
            if (nc < cost[ns]) {
                cost[ns] = nc;
                prev[ns] = s;
                heap.push(nc, ns);
            }
        }
    }
    return null;
}

function trace(g: WalkGrid, prev: Int32Array, end: number): Cell[] {
    const cells: Cell[] = [];
    for (let s = end; s >= 0; s = prev[s]) {
        const c = s >> 2;
        cells.push([c % g.w, Math.floor(c / g.w)]);
    }
    cells.reverse();
    return corners(cells);
}

/** 只留拐点：同一直线上的中间格去掉。 */
export function corners(cells: Cell[]): Cell[] {
    if (cells.length <= 2) return cells;
    const out: Cell[] = [cells[0]];
    for (let i = 1; i < cells.length - 1; i++) {
        const [ax, ay] = out[out.length - 1];
        const [bx, by] = cells[i];
        const [cx, cy] = cells[i + 1];
        if ((ax === bx && bx === cx) || (ay === by && by === cy)) continue;
        out.push(cells[i]);
    }
    out.push(cells[cells.length - 1]);
    return out;
}

function inArea(a: Area, x: number, y: number): boolean {
    return x >= a.x && y >= a.y && x < a.x + a.w && y < a.y + a.h;
}

/** 紧挨着区域四边（不含四个角）的格子。 */
function beside(a: Area, x: number, y: number): boolean {
    if (inArea(a, x, y)) return false;
    const inX = x >= a.x && x < a.x + a.w;
    const inY = y >= a.y && y < a.y + a.h;
    return (inX && (y === a.y - 1 || y === a.y + a.h)) || (inY && (x === a.x - 1 || x === a.x + a.w));
}

/** 离区域的格子距离（在区域里为 0）。 */
function distTo(a: Area, x: number, y: number): number {
    const dx = x < a.x ? a.x - x : x >= a.x + a.w ? x - (a.x + a.w - 1) : 0;
    const dy = y < a.y ? a.y - y : y >= a.y + a.h ? y - (a.y + a.h - 1) : 0;
    return dx + dy;
}

export type WalkMode = 'onto' | 'beside';

export interface WalkPlan {
    path: Cell[];
    /** 真到了目标（onto 站进区域里、beside 站到旁边）；false 是走不过去，只走到了最近能到的地方 */
    reached: boolean;
}

/**
 * 点了一块地方之后怎么走：
 * - onto：站进区域里（点空地面）；区域里没有能站的格子就改成走到旁边。
 * - beside：走到紧挨区域的格子（菜地、告示栏、镇民，到了再触发）。
 * 都走不到时，走到能到的格子里离区域最近的那格（reached = false）。
 */
export function planWalk(g: WalkGrid, from: Cell, area: Area, mode: WalkMode): WalkPlan | null {
    let goal = (x: number, y: number) => inArea(area, x, y) && walkable(g, x, y);
    let any = false;
    if (mode === 'onto') {
        for (let y = area.y; y < area.y + area.h && !any; y++) for (let x = area.x; x < area.x + area.w && !any; x++) any = walkable(g, x, y);
    }
    if (mode === 'beside' || !any) goal = (x, y) => beside(area, x, y) && walkable(g, x, y);
    const path = findPath(g, from, goal);
    if (path) return { path, reached: true };
    // 走不到：在能到的范围里找离区域最近的格子
    const near = closestReachable(g, from, area);
    if (!near) return null;
    const p = findPath(g, from, (x, y) => x === near[0] && y === near[1]);
    return p ? { path: p, reached: false } : null;
}

function closestReachable(g: WalkGrid, from: Cell, area: Area): Cell | null {
    const seen = new Uint8Array(g.w * g.h);
    const q: number[] = [from[1] * g.w + from[0]];
    seen[q[0]] = 1;
    let best: Cell | null = null;
    let bestD = Infinity;
    for (let i = 0; i < q.length; i++) {
        const c = q[i];
        const x = c % g.w;
        const y = (c - x) / g.w;
        const d = distTo(area, x, y);
        if (d < bestD) {
            bestD = d;
            best = [x, y];
        }
        for (let k = 0; k < 4; k++) {
            const nx = x + DX[k];
            const ny = y + DY[k];
            if (!walkable(g, nx, ny)) continue;
            const ni = ny * g.w + nx;
            if (seen[ni]) continue;
            seen[ni] = 1;
            q.push(ni);
        }
    }
    return best;
}

/** 离 (x, y) 最近的能站的格子（出生点被挡住时用）；整张图都挡着返回 null。 */
export function nearestWalkable(g: WalkGrid, x: number, y: number): Cell | null {
    const cx = Math.max(0, Math.min(g.w - 1, x));
    const cy = Math.max(0, Math.min(g.h - 1, y));
    const seen = new Uint8Array(g.w * g.h);
    const q: number[] = [cy * g.w + cx];
    seen[q[0]] = 1;
    for (let i = 0; i < q.length; i++) {
        const c = q[i];
        const px = c % g.w;
        const py = (c - px) / g.w;
        if (g.block[c] === 0) return [px, py];
        for (let k = 0; k < 4; k++) {
            const nx = px + DX[k];
            const ny = py + DY[k];
            if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h) continue;
            const ni = ny * g.w + nx;
            if (seen[ni]) continue;
            seen[ni] = 1;
            q.push(ni);
        }
    }
    return null;
}
