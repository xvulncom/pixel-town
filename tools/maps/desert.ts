// 荒漠地图搭建：在通用 MapBuilder 上换一套地面和崖壁图块（西部图块集），地形含义按荒漠来：
//   Grass 沙地、Dirt 土路、Stone 干河床、Soil 田、Wood 木板人行道（铺在地上）、Water 饮马塘。
// 高度 level 照旧，高处往南落下画红岩台地崖壁。以后别的荒漠地域（如西北戈壁）可以换一套 tiles 复用。

import { EMPTY, noise2d, pick } from '../art/canvas';
import { E, N, S, W_ } from '../art/terrain';
import { WG } from '../art/western-tileset';
import { MapBuilder, MapData, Terr } from './builder';

const isRoad = (t: Terr) => t === Terr.Dirt || t === Terr.Wood;

export class DesertBuilder extends MapBuilder {
    /**
     * 台地崖壁：落到平地 rowsToGround 行、台地之间 1 行；土路穿过的地方凿台阶。要在铺完路之后、摆东西之前调。
     */
    mesaCliffs(rowsToGround = 3): void {
        const face = new Map<number, { row: number; of: number }>();
        for (let y = 1; y < this.h; y++) {
            for (let x = 0; x < this.w; x++) {
                const hi = this.levelAt(x, y - 1);
                const lo = this.levelAt(x, y);
                if (hi <= lo) continue;
                const n = lo === 0 ? rowsToGround : 2;
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
                this.groundAt.set(i, WG.cliffStairs[row]);
                this.deco[i] = EMPTY;
                continue;
            }
            const l = isFace(x - 1, y);
            const r = isFace(x + 1, y);
            this.deco[i] = WG.cliff[row][!l ? 0 : !r ? 2 : 1][(x * 7 + y * 13) % 3];
        }
        for (let y = 0; y < this.h; y++) {
            for (let x = 0; x < this.w; x++) {
                const i = this.at(x, y);
                const L = this.level[i];
                if (L === 0 || face.has(i) || !this.free(x, y) || this.terr[i] !== Terr.Grass) continue;
                if (x > 0 && this.levelAt(x - 1, y) < L && !isFace(x - 1, y)) this.deco[i] = WG.cliffSideL;
                else if (x < this.w - 1 && this.levelAt(x + 1, y) < L && !isFace(x + 1, y)) this.deco[i] = WG.cliffSideR;
                else if (y > 0 && this.levelAt(x, y - 1) < L && !isFace(x, y - 1)) this.deco[i] = WG.cliffTop;
            }
        }
    }

    /** 沙地点缀：暗沙地成片、里面长干草和山艾，零星仙人掌、风滚草、石头、牛头骨。返回暗沙地判定。 */
    decorateSand(skip: (x: number, y: number) => boolean = () => false): (x: number, y: number) => boolean {
        const { rnd } = this;
        const scrubN = noise2d(rnd, 8);
        const scrub = (x: number, y: number) => this.inMap(x, y) && this.terr[this.at(x, y)] === Terr.Grass && this.levelAt(x, y) === 0 && scrubN(x, y) > 0.58;
        for (let y = 0; y < this.h; y++) {
            for (let x = 0; x < this.w; x++) {
                if (!this.grassAt(x, y) || !this.free(x, y) || skip(x, y)) continue;
                const r = rnd();
                const i = this.at(x, y);
                if (this.levelAt(x, y) > 0) {
                    if (r < 0.015) this.deco[i] = WG.rocks;
                    else if (r < 0.025) this.deco[i] = WG.dryGrass[0];
                    continue;
                }
                if (scrub(x, y) && r < 0.12) this.deco[i] = pick(rnd, [WG.dryGrass[0], WG.dryGrass[1], WG.dryGrass[2], WG.sage[0], WG.sage[1]], [0.25, 0.2, 0.15, 0.2, 0.2]);
                else if (r < 0.006) this.deco[i] = WG.pricklyPear;
                else if (r < 0.010) this.deco[i] = WG.barrelCactus;
                else if (r < 0.015) this.deco[i] = WG.tumbleweeds[Math.floor(rnd() * 2)];
                else if (r < 0.020) this.deco[i] = WG.rocks;
                else if (r < 0.0215) this.deco[i] = WG.skull;
            }
        }
        return scrub;
    }

    /** 地面：地形按四邻选边缘；土路和木板路互相连通；台地顶是红砂岩；开阔塘面放动画帧。 */
    finishDesert(scrub: (x: number, y: number) => boolean): MapData {
        const { rnd } = this;
        const same = (x: number, y: number, t: Terr) => {
            if (!this.inMap(x, y)) return true;
            const u = this.terr[this.at(x, y)];
            if (t === Terr.Dirt) return u === t || u === Terr.Wood || u === Terr.Stone;
            if (t === Terr.Stone) return u === t || u === Terr.Dirt;
            return u === t;
        };
        const scrubSame = (x: number, y: number) => !this.inMap(x, y) || this.terr[this.at(x, y)] !== Terr.Grass || scrub(x, y);
        const ground = this.terr.map((t, i) => {
            const x = i % this.w;
            const y = Math.floor(i / this.w);
            const fixed = this.groundAt.get(i);
            if (fixed !== undefined) return fixed;
            if (t === Terr.Grass) {
                if (this.level[i] > 0) return WG.mesaTop[Math.floor(rnd() * WG.mesaTop.length)];
                if (!scrub(x, y)) return pick(rnd, WG.sand, [0.5, 0.22, 0.12, 0.1, 0.06]);
                const m = (scrubSame(x, y - 1) ? N : 0) | (scrubSame(x + 1, y) ? E : 0) | (scrubSame(x, y + 1) ? S : 0) | (scrubSame(x - 1, y) ? W_ : 0);
                return WG.scrub[m];
            }
            const mask = (same(x, y - 1, t) ? N : 0) | (same(x + 1, y, t) ? E : 0) | (same(x, y + 1, t) ? S : 0) | (same(x - 1, y, t) ? W_ : 0);
            if (t === Terr.Water && mask === 15) return WG.pondAnims[0][0];
            const set = {
                [Terr.Dirt]: WG.street, [Terr.Water]: WG.pond, [Terr.Soil]: WG.field, [Terr.Stone]: WG.bed,
                [Terr.Wood]: WG.boards, [Terr.Slab]: WG.boards, [Terr.Grass]: WG.scrub,
            }[t];
            return set[mask];
        });
        return {
            w: this.w, h: this.h, ground, deco: this.deco, over: this.over, walkers: this.walkers, places: this.places,
            walk: this.desertWalkRows(), spawn: this.spawn, doors: this.doors,
        };
    }

    /** 主角的挡路表（同 MapBuilder.walkRows，'#' 挡路）：deco 里的东西挡路，干草除外；塘里的水挡路。 */
    desertWalkRows(): string[] {
        const soft = new Set<number>(WG.dryGrass);
        const rows: string[] = [];
        for (let y = 0; y < this.h; y++) {
            let r = '';
            for (let x = 0; x < this.w; x++) {
                const i = this.at(x, y);
                const d = this.deco[i];
                const solid = d !== EMPTY && !soft.has(d);
                r += solid || this.terr[i] === Terr.Water ? '#' : '.';
            }
            rows.push(r);
        }
        return rows;
    }
}
