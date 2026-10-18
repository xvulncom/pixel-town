// 自己的地盘：在网格上摆建筑、铺路、拆除。只管规则和数据，画面在 game/VillageView。

import { BuildingDef, Terrain, Tier, TIER_ORDER, World } from './defs';
import { fail, Failure, GameState, Placement, VillageState } from './types';
import { syncFieldPlots } from './fields';

/** 拆除退还的比例。 */
export const REFUND_RATE = 0.5;

/** 四邻掩码，和地图生成器一致：上 1、右 2、下 4、左 8。 */
export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;

export function newVillage(world: World): VillageState {
    const v: VillageState = { tier: 'village', items: [], nextUid: 1 };
    for (const s of world.villageStarter) {
        const r = canPlaceIn(world, v, s.def, s.x, s.y);
        if (!r.ok) throw new Error(`开局布局放不下 ${s.def}@${s.x},${s.y}：${r.reason}`);
        v.items.push({ uid: v.nextUid++, def: s.def, x: s.x, y: s.y });
    }
    return v;
}

export function villageSize(world: World, v: VillageState): [number, number] {
    return world.tiers[v.tier].size;
}

export function tierUnlocked(current: Tier, need: Tier): boolean {
    return TIER_ORDER.indexOf(current) >= TIER_ORDER.indexOf(need);
}

/** 每格上是谁：objects 记建筑，ground 记路面，空格是 0，否则是 uid。 */
export interface Occupancy {
    w: number;
    h: number;
    objects: Int32Array;
    ground: Int32Array;
}

export function occupancy(world: World, v: VillageState): Occupancy {
    const [w, h] = villageSize(world, v);
    const o: Occupancy = { w, h, objects: new Int32Array(w * h), ground: new Int32Array(w * h) };
    for (const it of v.items) {
        const def = world.buildings[it.def];
        if (!def) continue;
        const layer = def.kind === 'ground' ? o.ground : o.objects;
        forFoot(def, it.x, it.y, (x, y) => {
            if (x >= 0 && y >= 0 && x < w && y < h) layer[y * w + x] = it.uid;
        });
    }
    return o;
}

function forFoot(def: BuildingDef, x0: number, y0: number, f: (x: number, y: number) => void): void {
    for (let y = y0; y < y0 + def.foot[1]; y++) for (let x = x0; x < x0 + def.foot[0]; x++) f(x, y);
}

/** 不算钱，只看位置和档位能不能摆。 */
export function canPlaceIn(world: World, v: VillageState, defId: string, x: number, y: number): { ok: true } | Failure {
    const def = world.buildings[defId];
    if (!def) return fail('没有这种建筑');
    if (!tierUnlocked(v.tier, def.tier)) return fail(`${world.tiers[def.tier].name}才能盖`);
    const o = occupancy(world, v);
    let reason: string | null = null;
    forFoot(def, x, y, (cx, cy) => {
        if (reason) return;
        if (cx < 0 || cy < 0 || cx >= o.w || cy >= o.h) {
            reason = '超出地盘了';
            return;
        }
        const i = cy * o.w + cx;
        if (o.objects[i]) reason = '这里已经有东西了';
        else if (def.kind === 'ground' && o.ground[i]) reason = '这里已经铺过了';
        else if (def.kind === 'building' && o.ground[i]) reason = '不能盖在路上';
    });
    return reason ? fail(reason) : { ok: true };
}

/** 能不能摆，连钱一起算。 */
export function canPlace(world: World, state: GameState, defId: string, x: number, y: number): { ok: true } | Failure {
    const r = canPlaceIn(world, state.village, defId, x, y);
    if (!r.ok) return r;
    if (state.gold < world.buildings[defId].price) return fail('金币不够');
    return r;
}

export function place(world: World, state: GameState, defId: string, x: number, y: number): { ok: true; item: Placement } | Failure {
    const r = canPlace(world, state, defId, x, y);
    if (!r.ok) return r;
    state.gold -= world.buildings[defId].price;
    const item = { uid: state.village.nextUid++, def: defId, x, y };
    state.village.items.push(item);
    syncFieldPlots(state, world);
    return { ok: true, item };
}

/** 拆掉这格上的东西：先拆建筑，没有建筑再拆路面。退一半钱（向下取整）。 */
export function removeAt(world: World, state: GameState, x: number, y: number): { ok: true; item: Placement; refund: number } | Failure {
    const v = state.village;
    const o = occupancy(world, v);
    if (x < 0 || y < 0 || x >= o.w || y >= o.h) return fail('超出地盘了');
    const uid = o.objects[y * o.w + x] || o.ground[y * o.w + x];
    if (!uid) return fail('这里没有东西');
    const idx = v.items.findIndex((it) => it.uid === uid);
    const [item] = v.items.splice(idx, 1);
    const def = world.buildings[item.def];
    const refund = def ? Math.floor(def.price * REFUND_RATE) : 0;
    state.gold += refund;
    syncFieldPlots(state, world);
    return { ok: true, item, refund };
}

/** 想让点到的格子落在占地的最下一行正中，返回占地左上角。 */
export function anchorFromCell(def: BuildingDef, cx: number, cy: number): [number, number] {
    return [cx - Math.floor((def.foot[0] - 1) / 2), cy - (def.foot[1] - 1)];
}

/** 每格的路面，没铺的是 null（草地）。 */
export function terrainGrid(world: World, v: VillageState): (Terrain | null)[] {
    const [w, h] = villageSize(world, v);
    const grid: (Terrain | null)[] = new Array(w * h).fill(null);
    for (const it of v.items) {
        const def = world.buildings[it.def];
        if (def?.kind !== 'ground' || !def.terrain) continue;
        if (it.x >= 0 && it.y >= 0 && it.x < w && it.y < h) grid[it.y * w + it.x] = def.terrain;
    }
    return grid;
}

const isRoad = (t: Terrain | null) => t === 'dirt' || t === 'stone';

/** 路面的四邻掩码：同种算连着，土路和石板路互相也算连着；地盘外面不算。 */
export function terrainMask(grid: (Terrain | null)[], w: number, h: number, x: number, y: number): number {
    const t = grid[y * w + x];
    const same = (xx: number, yy: number) => {
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) return false;
        const u = grid[yy * w + xx];
        return u === t || (isRoad(t) && isRoad(u));
    };
    return (same(x, y - 1) ? N : 0) | (same(x + 1, y) ? E : 0) | (same(x, y + 1) ? S : 0) | (same(x - 1, y) ? W : 0);
}

/** 草地图块挑哪种：按坐标哈希，同一格永远一样；weights 是各种草的占比。 */
export function grassVariant(x: number, y: number, weights: number[] = [0.6, 0.22, 0.12, 0.06]): number {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const r = ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    let acc = 0;
    for (let i = 0; i < weights.length; i++) {
        acc += weights[i];
        if (r < acc) return i;
    }
    return weights.length - 1;
}

/** 读档时清理：去掉已经删掉的建筑和越界的东西，补上 nextUid。 */
export function repairVillage(world: World, v: VillageState): VillageState {
    if (!world.tiers[v.tier]) v.tier = 'village';
    const [w, h] = villageSize(world, v);
    // 编号按清理前算，被清掉的编号也不再复用
    const maxUid = (v.items ?? []).reduce((m, it) => Math.max(m, it.uid), 0);
    v.items = (v.items ?? []).filter((it) => {
        const def = world.buildings[it.def];
        return def && it.x >= 0 && it.y >= 0 && it.x + def.foot[0] <= w && it.y + def.foot[1] <= h;
    });
    v.nextUid = Math.max(v.nextUid ?? 1, maxUid + 1);
    return v;
}
