// 镇民打工：玩家不在线时，好感度够的镇民在自己的工作时段帮忙浇水或收菜。
// 性格决定效率：勤快的一小时干得多，爱偷懒的会摸鱼，嘴馋的偶尔偷吃一个。

import { World } from './defs';
import { GameState, HelperTask, ItemId, OK, Result, Weather, fail } from './types';
import { HOUR, localHour } from './time';
import { rand01 } from './rng';
import { isWetWeather } from './weather';
import { WET_HOURS, collect } from './farm';
import { removeItem } from './inventory';
import { heartsOf } from './npc';

export const MIN_HEARTS_TO_HELP = 2;

export interface HelperLog {
    watered: Record<string, number>;
    harvested: Record<ItemId, number>;
    slacked: Record<string, number>;
    eaten: { npcId: string; itemId: ItemId }[];
}

export function emptyHelperLog(): HelperLog {
    return { watered: {}, harvested: {}, slacked: {}, eaten: [] };
}

/** 每个工作小时最多处理几块地。 */
export function capacity(hearts: number, diligence: number): number {
    return Math.max(1, Math.round((2 + hearts) * diligence));
}

export function assignHelper(state: GameState, world: World, npcId: string, task: HelperTask): Result {
    const def = world.npcs[npcId];
    if (!def || !state.npcs[npcId]) {
        return fail('镇上没有这个人');
    }
    if (heartsOf(state, npcId) < MIN_HEARTS_TO_HELP) {
        return fail(`和${def.name}还不够熟，再多聊聊吧`);
    }
    state.helpers = state.helpers.filter((a) => a.npcId !== npcId);
    state.helpers.push({ npcId, task });
    return OK;
}

export function unassignHelper(state: GameState, npcId: string): void {
    state.helpers = state.helpers.filter((a) => a.npcId !== npcId);
}

function bump(map: Record<string, number>, key: string, n: number = 1): void {
    map[key] = (map[key] ?? 0) + n;
}

/** 在整点 hourMs 让所有打工的镇民干一小时活。 */
export function runHelpers(state: GameState, world: World, hourMs: number, weather: Weather, log: HelperLog): void {
    const hour = localHour(hourMs);
    for (const a of state.helpers) {
        const def = world.npcs[a.npcId];
        const h = heartsOf(state, a.npcId);
        if (!def || h < MIN_HEARTS_TO_HELP) {
            continue;
        }
        const [start, end] = def.workHours;
        if (hour < start || hour >= end) {
            continue;
        }
        if (rand01(state.seed, 'slack', a.npcId, hourMs) < def.traits.laziness) {
            bump(log.slacked, a.npcId);
            continue;
        }
        const cap = capacity(h, def.traits.diligence);
        if (a.task === 'water') {
            if (isWetWeather(weather)) {
                continue;
            }
            let done = 0;
            for (const plot of state.plots) {
                if (done >= cap) break;
                if (plot.state === 'growing' && plot.wetUntil <= hourMs) {
                    plot.wetUntil = hourMs + WET_HOURS * HOUR;
                    done += 1;
                }
            }
            if (done > 0) {
                bump(log.watered, a.npcId, done);
            }
        } else {
            let lastItem: ItemId | null = null;
            let done = 0;
            for (const plot of state.plots) {
                if (done >= cap) break;
                if (plot.state === 'mature') {
                    const itemId = collect(state, world, plot, hourMs);
                    if (itemId) {
                        bump(log.harvested, itemId);
                        lastItem = itemId;
                        done += 1;
                    }
                }
            }
            if (lastItem && rand01(state.seed, 'eat', a.npcId, hourMs) < def.traits.greed) {
                removeItem(state, lastItem);
                bump(log.harvested, lastItem, -1);
                log.eaten.push({ npcId: a.npcId, itemId: lastItem });
            }
        }
    }
}
