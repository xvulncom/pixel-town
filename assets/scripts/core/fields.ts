// 自己地盘上的菜地：每格菜地对应 state.plots 里的一块地（plot.field 记菜地的 uid），种、浇、收都走 farm.ts。
// 菜地摆了、拆了都调 syncFieldPlots 重新对齐；地块的生长仍由 simulate 统一推进。

import { World } from './defs';
import { GameState, Plot } from './types';
import { buySeed, emptyPlot, growthTarget, harvest, plant, sell, water } from './farm';
import { seasonAt } from './calendar';
import { countOf, seedItem } from './inventory';
import { inSeason, regionOf, sellsSeed } from './region';

export type CropStage = 'sprout' | 'young' | 'ripe' | 'withered';

export type TendResult =
    | { ok: true; action: 'plant' | 'water' | 'harvest' | 'clear' | 'wait'; message: string; gold: number }
    | { ok: false; reason: string };

function isField(world: World, defId: string): boolean {
    const def = world.buildings[defId];
    return def?.kind === 'ground' && def.terrain === 'soil';
}

/**
 * 让地块和菜地一一对应：已绑定的保留，新菜地先接手没绑定的老地块（第 2 版存档里的 6 块），
 * 再不够就开新地块；菜地被拆了的地块丢掉。
 */
export function syncFieldPlots(state: GameState, world: World): void {
    const fields = state.village.items.filter((it) => isField(world, it.def));
    const byField = new Map<number, Plot>();
    const loose: Plot[] = [];
    for (const p of state.plots) {
        if (p.field !== undefined && !byField.has(p.field)) byField.set(p.field, p);
        else if (p.field === undefined) loose.push(p);
    }
    state.plots = fields.map((it) => {
        const p = byField.get(it.uid) ?? loose.shift() ?? emptyPlot();
        p.field = it.uid;
        return p;
    });
}

/** 某格上的菜地对应的地块下标，不是菜地返回 -1。 */
export function plotIndexAt(state: GameState, world: World, x: number, y: number): number {
    const it = state.village.items.find((i) => i.x === x && i.y === y && isField(world, i.def));
    return it ? state.plots.findIndex((p) => p.field === it.uid) : -1;
}

/** 当季能种的作物：种子店卖的，加上背包里有种子的（好友送的特产），按生长时间排。 */
export function seedChoices(state: GameState, world: World, nowMs: number): string[] {
    const region = regionOf(world, state);
    const season = seasonAt(nowMs);
    return Object.values(world.crops)
        .filter((c) => inSeason(world, region, c.id, season) && (sellsSeed(region, c.id) || countOf(state, seedItem(c.id)) > 0))
        .sort((a, b) => a.growHours - b.growHours)
        .map((c) => c.id);
}

export function cropStage(world: World, plot: Plot): CropStage | null {
    if (plot.state === 'withered') return 'withered';
    if (plot.state === 'mature') return 'ripe';
    if (plot.state !== 'growing') return null;
    return plot.growth < growthTarget(world, plot) / 2 ? 'sprout' : 'young';
}

/** 还要多少小时成熟（按现在的干湿程度估）。 */
export function hoursLeft(world: World, plot: Plot, nowMs: number): number {
    const left = growthTarget(world, plot) - plot.growth;
    return plot.wetUntil > nowMs ? left : left * 2;
}

/**
 * 点一下菜地：空地种下所选作物（没种子先买一颗）并浇水，干了浇水，熟了收获直接卖掉，枯了清掉。
 * 一期收获即卖；以后有仓库、好友送礼再改成进背包。
 */
export function tend(state: GameState, world: World, plotIdx: number, cropId: string, nowMs: number): TendResult {
    const plot = state.plots[plotIdx];
    if (!plot) return { ok: false, reason: '这里不是菜地' };
    const before = state.gold;
    const done = (action: 'plant' | 'water' | 'harvest' | 'clear' | 'wait', message: string): TendResult =>
        ({ ok: true, action, message, gold: state.gold - before });

    if (plot.state === 'withered') {
        Object.assign(plot, emptyPlot(), { field: plot.field, wetUntil: plot.wetUntil });
        return done('clear', '清掉了枯死的苗');
    }
    if (plot.state === 'mature') {
        const r = harvest(state, world, plotIdx, nowMs);
        if (!r.ok) return r;
        const def = world.crops[r.itemId.slice(5)];
        const s = sell(state, world, r.itemId, 1);
        if (!s.ok) return s;
        return done('harvest', `收了${def.name}，卖了 ${def.sellPrice} 金`);
    }
    if (plot.state === 'growing') {
        const name = world.crops[plot.cropId!]?.name ?? '';
        if (plot.wetUntil <= nowMs) {
            water(state, plotIdx, nowMs);
            return done('water', `给${name}浇了水`);
        }
        return done('wait', `${name}还要约 ${Math.max(1, Math.ceil(hoursLeft(world, plot, nowMs)))} 小时`);
    }
    const def = world.crops[cropId];
    if (!def) return { ok: false, reason: '先选要种什么' };
    if (countOf(state, seedItem(cropId)) === 0) {
        const b = buySeed(state, world, cropId, 1, nowMs);
        if (!b.ok) return b;
    }
    const p = plant(state, world, plotIdx, cropId, nowMs);
    if (!p.ok) return p;
    state.plots[plotIdx].field = plot.field;
    water(state, plotIdx, nowMs);
    return done('plant', `种下${def.name}，约 ${def.growHours} 小时熟`);
}

/** 作物在地盘上用哪张图：成熟时每种作物一张 `crop_<作物>`，其余阶段共用 `crop_<阶段>`。图由 tools/art/crops.ts 生成。 */
export function cropSprite(cropId: string, stage: CropStage): string {
    return stage === 'ripe' ? `crop_${cropId}` : `crop_${stage}`;
}
