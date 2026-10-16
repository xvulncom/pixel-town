// 地块：买种子、种、浇水、生长、收获、出售、换季枯萎。

import { CropDef, World } from './defs';
import { GameState, ItemId, OK, Plot, Result, Season, fail } from './types';
import { HOUR } from './time';
import { seasonAt } from './calendar';
import { addItem, cropItem, removeItem, seedItem } from './inventory';
import { inSeason, regionOf, sellsSeed } from './region';

/** 浇一次水保持湿润的时长。 */
export const WET_HOURS = 8;
/** 干燥时的生长速度倍率。 */
export const DRY_SPEED = 0.5;

export type HarvestResult = { ok: true; itemId: ItemId } | { ok: false; reason: string };

export function emptyPlot(): Plot {
    return { state: 'empty', cropId: null, growth: 0, wetUntil: 0, harvests: 0 };
}

function cropOf(world: World, plot: Plot): CropDef | undefined {
    return plot.cropId ? world.crops[plot.cropId] : undefined;
}

export function growthTarget(world: World, plot: Plot): number {
    const def = cropOf(world, plot);
    if (!def) {
        return Infinity;
    }
    return plot.harvests > 0 && def.regrowHours ? def.regrowHours : def.growHours;
}

export function buySeed(state: GameState, world: World, cropId: string, n: number, nowMs: number): Result {
    const def = world.crops[cropId];
    if (!def) {
        return fail('没有这种种子');
    }
    if (n <= 0) {
        return fail('数量不对');
    }
    const region = regionOf(world, state);
    if (!sellsSeed(region, cropId)) {
        return fail(def.specialty
            ? `${def.name}是外地特产，只能请那边的好友送种子`
            : `${region.name}的种子店不卖${def.name}`);
    }
    if (!inSeason(world, region, cropId, seasonAt(nowMs))) {
        return fail(`现在不是种${def.name}的季节`);
    }
    const cost = def.seedPrice * n;
    if (state.gold < cost) {
        return fail('金币不够');
    }
    state.gold -= cost;
    addItem(state, seedItem(cropId), n);
    return OK;
}

export function plant(state: GameState, world: World, plotIdx: number, cropId: string, nowMs: number): Result {
    const plot = state.plots[plotIdx];
    const def = world.crops[cropId];
    if (!plot) {
        return fail('没有这块地');
    }
    if (!def) {
        return fail('没有这种作物');
    }
    if (plot.state !== 'empty' && plot.state !== 'withered') {
        return fail('这块地已经种了东西');
    }
    if (!inSeason(world, regionOf(world, state), cropId, seasonAt(nowMs))) {
        return fail(`现在种${def.name}会冻死或热死`);
    }
    if (!removeItem(state, seedItem(cropId))) {
        return fail(`没有${def.name}种子`);
    }
    state.plots[plotIdx] = { state: 'growing', cropId, growth: 0, wetUntil: plot.wetUntil, harvests: 0 };
    return OK;
}

export function water(state: GameState, plotIdx: number, nowMs: number): Result {
    const plot = state.plots[plotIdx];
    if (!plot || plot.state !== 'growing') {
        return fail('这块地不用浇水');
    }
    plot.wetUntil = nowMs + WET_HOURS * HOUR;
    return OK;
}

/** 收获一块成熟的地，物品进背包。玩家和打工镇民共用。 */
export function collect(state: GameState, world: World, plot: Plot, nowMs: number): ItemId | null {
    const def = cropOf(world, plot);
    if (!def || plot.state !== 'mature') {
        return null;
    }
    const itemId = cropItem(def.id);
    addItem(state, itemId);
    if (def.regrowHours && inSeason(world, regionOf(world, state), def.id, seasonAt(nowMs))) {
        plot.state = 'growing';
        plot.growth = 0;
        plot.harvests += 1;
    } else {
        Object.assign(plot, emptyPlot(), { wetUntil: plot.wetUntil });
    }
    return itemId;
}

export function harvest(state: GameState, world: World, plotIdx: number, nowMs: number): HarvestResult {
    const plot = state.plots[plotIdx];
    if (!plot || plot.state !== 'mature') {
        return { ok: false, reason: '还没熟' };
    }
    const itemId = collect(state, world, plot, nowMs);
    return itemId ? { ok: true, itemId } : { ok: false, reason: '还没熟' };
}

export function sell(state: GameState, world: World, itemId: ItemId, n: number): Result {
    const cropId = itemId.startsWith('crop:') ? itemId.slice(5) : '';
    const def = world.crops[cropId];
    if (!def) {
        return fail('这个东西收购站不收');
    }
    if (n <= 0 || !removeItem(state, itemId, n)) {
        return fail('数量不够');
    }
    state.gold += def.sellPrice * n;
    return OK;
}

/** 推进一块地的生长，刚成熟时返回 true。 */
export function growPlot(world: World, plot: Plot, hours: number): boolean {
    if (plot.state !== 'growing') {
        return false;
    }
    plot.growth += hours;
    // 10 分钟一步累加会有浮点误差，留一点余量
    if (plot.growth >= growthTarget(world, plot) - 1e-6) {
        plot.growth = growthTarget(world, plot);
        plot.state = 'mature';
        return true;
    }
    return false;
}

/** 换季：还在长、又不适合新季节的作物枯萎；已经成熟的留着等收。返回枯萎数。 */
export function applySeasonChange(state: GameState, world: World, season: Season): number {
    const region = regionOf(world, state);
    let withered = 0;
    for (const plot of state.plots) {
        const def = cropOf(world, plot);
        if (plot.state === 'growing' && def && !inSeason(world, region, def.id, season)) {
            plot.state = 'withered';
            withered += 1;
        }
    }
    return withered;
}
