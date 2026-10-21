// 地图搭建工具：所有地域地图共用。布局文件只管"什么放哪"，地形边缘、草地点缀、图层拆分都在这里。

import { EMPTY, noise2d, pick, Rnd } from '../art/canvas';
import { mulberry32 } from '../../assets/scripts/core/rng';
import { G } from '../art/tileset';
import { E, N, S, W_ } from '../art/terrain';

/** Wood 木码头、Slab 石板桥：铺在水上，底下画水。 */
export enum Terr { Grass, Dirt, Water, Soil, Stone, Wood, Slab }

/** 地图上会走动的人：row 是人物图里的行号，path 是脚下所在格子的路线（来回走）。 */
export interface Walker {
    id: string;
    row: number;
    path: [number, number][];
    /** 每秒走几格 */
    speed: number;
}

/** 地图上能点的地方（招工处等），游戏里点到这块格子就打开对应的界面。 */
export interface Place {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface MapData {
    w: number;
    h: number;
    ground: number[];
    deco: number[];
    over: number[];
    walkers: Walker[];
    places: Place[];
    /** 主角挡路表，'#' 挡路 '.' 能走，见 MapBuilder.walkRows */
    walk: string[];
    /** 主角到镇上时站的格子 */
    spawn: [number, number];
}

const flatIds = (...gs: (number[] | number[][])[]) => new Set<number>(gs.flat(2) as number[]);
/** deco 里能踩过去的：高草、野花、院门（门开着，能进院子） */
const SOFT = flatIds(G.tallGrass, G.flowers, G.gate);
/** 架在水上能走的：石桥、河埠头台阶 */
const DECK = flatIds(G.bridgeV, G.bridgeH, G.stepsDown, G.stepsUp, G.stepsLeft, G.stepsRight);

const isRoad = (t: Terr) => t === Terr.Dirt || t === Terr.Stone;
const onWater = (t: Terr) => t === Terr.Wood || t === Terr.Slab;

export class MapBuilder {
    readonly terr: Terr[];
    readonly deco: number[];
    readonly over: number[];
    /** 地面高度：0 是平地，茶山一层层往上。高处往南落下的那面画崖壁，见 cliffs() */
    readonly level: number[];
    /** 直接指定地面图块的格子（崖壁上的石阶），finish 时优先用 */
    readonly groundAt = new Map<number, number>();
    readonly bridge = new Set<number>();
    readonly walkers: Walker[] = [];
    readonly places: Place[] = [];
    spawn: [number, number] = [0, 0];
    readonly rnd: Rnd;

    constructor(readonly w: number, readonly h: number, seed: number) {
        this.terr = new Array<Terr>(w * h).fill(Terr.Grass);
        this.deco = new Array<number>(w * h).fill(EMPTY);
        this.over = new Array<number>(w * h).fill(EMPTY);
        this.level = new Array<number>(w * h).fill(0);
        this.rnd = mulberry32(seed);
    }

    levelAt(x: number, y: number): number {
        return this.inMap(x, y) ? this.level[this.at(x, y)] : 0;
    }

    /** 把一块地抬到 lv 层（只会抬高，不会压低） */
    raise(x0: number, y0: number, w: number, h: number, lv: number): void {
        for (let y = y0; y < y0 + h; y++) {
            for (let x = x0; x < x0 + w; x++) if (this.inMap(x, y)) this.level[this.at(x, y)] = Math.max(this.level[this.at(x, y)], lv);
        }
    }

    /**
     * 画崖壁：高处往南落到低处时，在低处顶上几行画岩壁（rows 给每一落差几行，默认落到平地 2 行、梯田之间 1 行）；
     * 路穿过的地方画石阶（走得过去）。高地左右两侧画竖的崖沿，北沿压一道细线。要在铺完路之后、摆东西之前调。
     */
    cliffs(rows: (high: number, low: number) => number = (_h, low) => (low === 0 ? 2 : 1)): void {
        const face = new Map<number, { row: number; of: number }>();
        for (let y = 1; y < this.h; y++) {
            for (let x = 0; x < this.w; x++) {
                const hi = this.levelAt(x, y - 1);
                const lo = this.levelAt(x, y);
                if (hi <= lo) continue;
                const n = rows(hi, lo);
                for (let k = 0; k < n && y + k < this.h; k++) face.set(this.at(x, y + k), { row: k, of: n });
            }
        }
        const isFace = (x: number, y: number) => this.inMap(x, y) && face.has(this.at(x, y));
        for (const [i, f] of face) {
            const x = i % this.w;
            const y = Math.floor(i / this.w);
            const row = f.of === 1 ? 3 : f.row === 0 ? 0 : f.row === f.of - 1 ? 2 : 1;
            this.over[i] = EMPTY;
            if (isRoad(this.terr[i])) {
                this.groundAt.set(i, G.cliffStairs[row]);
                this.deco[i] = EMPTY;
                continue;
            }
            const l = isFace(x - 1, y);
            const r = isFace(x + 1, y);
            this.deco[i] = G.cliff[row][!l ? 0 : !r ? 2 : 1];
        }
        for (let y = 0; y < this.h; y++) {
            for (let x = 0; x < this.w; x++) {
                const i = this.at(x, y);
                const L = this.level[i];
                if (L === 0 || face.has(i) || !this.free(x, y) || this.terr[i] !== Terr.Grass) continue;
                if (x > 0 && this.levelAt(x - 1, y) < L) this.deco[i] = G.cliffSideL;
                else if (x < this.w - 1 && this.levelAt(x + 1, y) < L) this.deco[i] = G.cliffSideR;
                else if (y > 0 && this.levelAt(x, y - 1) < L && !isFace(x, y - 1)) this.deco[i] = G.cliffTop;
            }
        }
    }

    at(x: number, y: number): number {
        return y * this.w + x;
    }

    inMap(x: number, y: number): boolean {
        return x >= 0 && y >= 0 && x < this.w && y < this.h;
    }

    rect(x0: number, y0: number, w: number, h: number, t: Terr): void {
        for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (this.inMap(x, y)) this.terr[this.at(x, y)] = t;
    }

    /** 沿折线铺路：相邻两点必须同行或同列，宽 width 格（往右、往下加宽）。路过水面的格子记为桥。 */
    road(points: [number, number][], t: Terr, width = 2): void {
        for (let i = 0; i + 1 < points.length; i++) {
            const [x0, y0] = points[i];
            const [x1, y1] = points[i + 1];
            if (x0 !== x1 && y0 !== y1) throw new Error(`路线要横平竖直：${points[i]} → ${points[i + 1]}`);
            const xa = Math.min(x0, x1);
            const ya = Math.min(y0, y1);
            const w = Math.abs(x1 - x0) + width;
            const h = Math.abs(y1 - y0) + width;
            for (let y = ya; y < ya + h; y++) {
                for (let x = xa; x < xa + w; x++) {
                    if (!this.inMap(x, y)) continue;
                    const i2 = this.at(x, y);
                    if (this.terr[i2] === Terr.Water) this.bridge.add(i2);
                    else this.terr[i2] = t;
                }
            }
        }
    }

    grassAt(x: number, y: number): boolean {
        return this.inMap(x, y) && this.terr[this.at(x, y)] === Terr.Grass && !this.bridge.has(this.at(x, y));
    }

    free(x: number, y: number): boolean {
        if (!this.inMap(x, y)) return false;
        const i = this.at(x, y);
        return this.deco[i] === EMPTY && this.over[i] === EMPTY;
    }

    /** 放大图：最下一行进 deco（挡路的部分），上面几行进 over（盖在人物头上）。flat 时全部进 deco。 */
    place(x: number, y: number, grid: number[][], flat = false): void {
        const last = grid.length - 1;
        grid.forEach((row, dy) => row.forEach((t, dx) => {
            if (t === EMPTY || !this.inMap(x + dx, y + dy)) return;
            if (flat || dy === last) this.deco[this.at(x + dx, y + dy)] = t;
            else this.over[this.at(x + dx, y + dy)] = t;
        }));
    }

    /** 能不能放：底行要在空草地上（ground 给了就按它判断），上面几行不能压到别的东西。 */
    fits(x: number, y: number, grid: number[][], ground: (t: Terr) => boolean = (t) => t === Terr.Grass): boolean {
        const last = grid.length - 1;
        for (let dy = 0; dy <= last; dy++) {
            for (let dx = 0; dx < grid[dy].length; dx++) {
                const xx = x + dx;
                const yy = y + dy;
                if (!this.free(xx, yy)) return false;
                const i = this.at(xx, yy);
                if (dy === last && (!ground(this.terr[i]) || this.bridge.has(i))) return false;
            }
        }
        return true;
    }

    tryPlace(x: number, y: number, grid: number[][]): boolean {
        if (!this.fits(x, y, grid)) return false;
        this.place(x, y, grid);
        return true;
    }

    /** 带院子的人家：房子 + 前院（左右矮墙、前墙正中门楼）。返回院子里空着的格子，好摆小物件。 */
    yardHouse(x: number, baseY: number, house: number[][], yardDepth = 3): [number, number][] {
        this.place(x, baseY - house.length + 1, house);
        const fy = baseY + yardDepth + 1;
        // 前墙压在 fy 行（瓦顶在 fy-1 行），两侧矮墙从房子底边一直接到前墙
        for (let y = baseY; y < fy; y++) {
            this.place(x - 1, y, [[G.wallV]]);
            this.place(x + 6, y, [[G.wallV]]);
        }
        const gx = x + 2;
        for (let wx = x - 1; wx <= x + 6; wx++) {
            if (wx === gx || wx === gx + 1) continue;
            this.place(wx, fy - 1, G.wallH);
        }
        this.place(gx, fy - 1, G.gate);
        const yard: [number, number][] = [];
        for (let y = baseY + 1; y < fy - 1; y++) for (let xx = x; xx < x + 6; xx++) if (this.free(xx, y)) yard.push([xx, y]);
        return yard;
    }

    walker(id: string, row: number, path: [number, number][], speed = 1.2): void {
        this.walkers.push({ id, row, path, speed });
    }

    /** 草地点缀：深草成片、深草里长高草、野花一簇簇同色、零星灌木和石头。 */
    decorateGrass(): (x: number, y: number) => boolean {
        const { rnd } = this;
        const lushN = noise2d(rnd, 7);
        const flowerN = noise2d(rnd, 5);
        const flowerColor = noise2d(rnd, 9);
        const lush = (x: number, y: number) => this.inMap(x, y) && this.terr[this.at(x, y)] === Terr.Grass && lushN(x, y) > 0.56;
        for (let y = 0; y < this.h; y++) {
            for (let x = 0; x < this.w; x++) {
                if (!this.grassAt(x, y) || !this.free(x, y)) continue;
                const r = rnd();
                const i = this.at(x, y);
                if (lush(x, y) && lushN(x, y) > 0.66 && r < 0.3) this.deco[i] = G.tallGrass[Math.floor(rnd() * G.tallGrass.length)];
                else if (flowerN(x, y) > 0.68 && r < 0.35) this.deco[i] = G.flowers[Math.min(2, Math.floor(flowerColor(x, y) * 3))];
                else if (r < 0.012) this.deco[i] = G.bush;
                else if (r < 0.02) this.deco[i] = G.rocks;
            }
        }
        return lush;
    }

    /** 地面：地形按四邻选边缘图块；土路和石板路算连通，不留草缝；深草也当一种地形。 */
    finish(lush: (x: number, y: number) => boolean): MapData {
        const { rnd } = this;
        const same = (x: number, y: number, t: Terr) => {
            if (!this.inMap(x, y)) return true;
            const i = this.at(x, y);
            const u = this.terr[i];
            // 桥既连着路也连着河
            if (this.bridge.has(i)) return isRoad(t) || t === Terr.Water;
            // 码头、石板桥底下是水；木板自己只在临水那边收边
            if (t === Terr.Water) return u === t || onWater(u);
            if (onWater(t)) return u === t || u !== Terr.Water;
            return u === t || (isRoad(t) && isRoad(u));
        };
        const lushSame = (x: number, y: number) => !this.inMap(x, y) || this.terr[this.at(x, y)] !== Terr.Grass || lush(x, y);
        const ground = this.terr.map((t, i) => {
            const x = i % this.w;
            const y = Math.floor(i / this.w);
            const fixed = this.groundAt.get(i);
            if (fixed !== undefined) return fixed;
            if (t === Terr.Grass) {
                if (!lush(x, y)) return pick(rnd, G.grass, [0.6, 0.22, 0.12, 0.06]);
                const m = (lushSame(x, y - 1) ? N : 0) | (lushSame(x + 1, y) ? E : 0) | (lushSame(x, y + 1) ? S : 0) | (lushSame(x - 1, y) ? W_ : 0);
                return G.lush[m];
            }
            const mask = (same(x, y - 1, t) ? N : 0) | (same(x + 1, y, t) ? E : 0) | (same(x, y + 1, t) ? S : 0) | (same(x - 1, y, t) ? W_ : 0);
            if (t === Terr.Water && mask === 15) return pick(rnd, G.waterAnims, [0.4, 0.3, 0.3])[0];
            if (t === Terr.Stone && mask === 15) return G.stoneFill[Math.floor(rnd() * G.stoneFill.length)];
            const set = {
                [Terr.Dirt]: G.dirt, [Terr.Water]: G.water, [Terr.Soil]: G.soil, [Terr.Stone]: G.stone,
                [Terr.Wood]: G.planks, [Terr.Slab]: G.slabs,
            }[t];
            return set[mask];
        });
        return {
            w: this.w, h: this.h, ground, deco: this.deco, over: this.over, walkers: this.walkers, places: this.places,
            walk: this.walkRows(), spawn: this.spawn,
        };
    }

    /**
     * 主角的挡路表（core/path 读）：deco 里的东西挡路，花草除外；没架桥的水面挡路，石桥、河埠头台阶例外。
     * 码头木板、石板桥是地形（Wood、Slab），本来就能走；崖壁石阶是 ground 图块，也能走。
     */
    walkRows(): string[] {
        const rows: string[] = [];
        for (let y = 0; y < this.h; y++) {
            let r = '';
            for (let x = 0; x < this.w; x++) {
                const i = this.at(x, y);
                const d = this.deco[i];
                const deck = DECK.has(d);
                const solid = d !== EMPTY && !deck && !SOFT.has(d);
                const water = this.terr[i] === Terr.Water && !this.bridge.has(i) && !deck;
                r += solid || water ? '#' : '.';
            }
            rows.push(r);
        }
        return rows;
    }
}
