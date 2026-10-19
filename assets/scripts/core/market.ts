// 集市摆摊：一轮 roundSec 秒，顾客一个个来要摊上的某样货，点对就卖掉，越往后顾客越没耐心。
// 时间由画面传进来（这一轮开始后的秒数），这里不读时钟，方便测试。
// 每卖出一单金币当场到账；一天只能摆 roundsPerDay 轮，免得刷钱压过种地。

import { World } from './defs';
import { GameState, ItemId, Weather } from './types';
import { inSeason, regionOf, sellsSeed } from './region';
import { seasonAt } from './calendar';
import { fishPool, hash01 } from './fishing';
import { today } from './daily';

export interface MarketRound {
    seed: number;
    goods: ItemId[];
    /** 当前顾客是第几个（从 0 起） */
    idx: number;
    /** 当前顾客到摊前的时刻（秒） */
    arrivedAt: number;
    t: number;
    streak: number;
    served: number;
    missed: number;
    earned: number;
    over: boolean;
}

/** 物品的收购价：作物 crop:<id>，鱼 fish:<id>。 */
export function priceOf(world: World, item: ItemId): number {
    const [kind, id] = item.split(':');
    if (kind === 'crop') return world.crops[id]?.sellPrice ?? 0;
    if (kind === 'fish') return world.fish[id]?.price ?? 0;
    return 0;
}

export function itemName(world: World, item: ItemId): string {
    const [kind, id] = item.split(':');
    return (kind === 'crop' ? world.crops[id]?.name : kind === 'fish' ? world.fish[id]?.name : undefined) ?? item;
}

/** 开一轮：摊上摆当季能种的菜和现在能钓的鱼，挑 goods 样。 */
export function newMarket(state: GameState, world: World, nowMs: number, weather: Weather, seed: number): MarketRound {
    const region = regionOf(world, state);
    const season = seasonAt(nowMs);
    const crops = Object.values(world.crops)
        .filter((c) => sellsSeed(region, c.id) && inSeason(world, region, c.id, season))
        .map((c) => `crop:${c.id}`);
    const fish = fishPool(world, region.id, nowMs, weather).map((f) => `fish:${f.id}`);
    const all = [...crops, ...fish];
    const goods: ItemId[] = [];
    for (let k = 0; goods.length < Math.min(world.market.goods, all.length); k++) {
        const it = all[Math.floor(hash01(seed, 100 + k) * all.length)];
        if (!goods.includes(it)) goods.push(it);
    }
    return { seed, goods, idx: 0, arrivedAt: 0, t: 0, streak: 0, served: 0, missed: 0, earned: 0, over: false };
}

export function wantOf(round: MarketRound): ItemId {
    return round.goods[Math.floor(hash01(round.seed, round.idx) * round.goods.length)];
}

export function patienceOf(world: World, round: MarketRound): number {
    const p = world.market.patience;
    return Math.max(p.min, p.start - p.step * round.idx);
}

/** 推进到 t 秒：等太久的顾客走掉，换下一个；到点收摊。 */
export function advanceMarket(world: World, round: MarketRound, t: number): MarketRound {
    round.t = Math.max(round.t, t);
    while (!round.over) {
        const leaveAt = round.arrivedAt + patienceOf(world, round);
        if (leaveAt > round.t || leaveAt >= world.market.roundSec) break;
        round.missed++;
        round.streak = 0;
        round.idx++;
        round.arrivedAt = leaveAt;
    }
    if (round.t >= world.market.roundSec) round.over = true;
    return round;
}

/** 点了一样货卖给当前顾客，钱当场进账，返回这一单挣多少（点错是 0）。 */
export function serve(state: GameState, world: World, round: MarketRound, item: ItemId, t: number): number {
    advanceMarket(world, round, t);
    if (round.over) return 0;
    let got = 0;
    if (item === wantOf(round)) {
        const m = world.market;
        got = Math.ceil(priceOf(world, item) * m.priceRate * (1 + Math.min(round.streak * m.streakStep, m.streakMax)));
        round.earned += got;
        state.gold += got;
        round.served++;
        round.streak++;
    } else {
        round.missed++;
        round.streak = 0;
    }
    round.idx++;
    round.arrivedAt = round.t;
    return got;
}

/** 开张记一轮（中途收摊也算）。 */
export function openMarket(state: GameState, nowMs: number): void {
    today(state, nowMs).marketRounds++;
}

/** 今天还能摆几轮。 */
export function roundsLeft(state: GameState, world: World, nowMs: number): number {
    return Math.max(0, world.market.roundsPerDay - today(state, nowMs).marketRounds);
}
