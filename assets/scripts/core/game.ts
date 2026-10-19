// 新开一局、存档读写。

import { World } from './defs';
import { GameState } from './types';
import { seasonAt } from './calendar';
import { syncFieldPlots } from './fields';
import { emptyDaily } from './daily';
import { dayKey } from './time';
import { inSeason } from './region';
import { seedItem } from './inventory';
import { newNpcState } from './npc';
import { newVillage, repairVillage } from './village';

/** 第 2 版：加自己的地盘 village。 */
export const SAVE_VERSION = 4;
export const START_GOLD = 300;
export const STARTER_SEEDS = 5;

/** 开局。regionId 是玩家选的老家。 */
export function newGame(world: World, nowMs: number, seed: string, regionId: string): GameState {
    const region = world.regions[regionId];
    if (!region) {
        throw new Error(`unknown region ${regionId}`);
    }
    const season = seasonAt(nowMs);

    // 开局送本地当季最便宜的普通作物种子，让玩家第一分钟就能种（东北冬天地冻着，不送）
    const starter = region.crops
        .map((id) => world.crops[id])
        .filter((c) => c && inSeason(world, region, c.id, season))
        .sort((a, b) => a.seedPrice - b.seedPrice)[0];

    const npcs: GameState['npcs'] = {};
    for (const def of Object.values(world.npcs)) {
        npcs[def.id] = newNpcState(def);
    }

    const state: GameState = {
        version: SAVE_VERSION,
        seed,
        createdAt: nowMs,
        lastTick: nowMs,
        season,
        gold: START_GOLD,
        inventory: starter ? { [seedItem(starter.id)]: STARTER_SEEDS } : {},
        plots: [],
        npcs,
        helpers: [],
        region: regionId,
        wishesDone: [],
        unlocked: [],
        village: newVillage(world),
        fishLog: {},
        daily: emptyDaily(dayKey(nowMs)),
    };
    // 开局布局里的每格菜地各配一块地
    syncFieldPlots(state, world);
    return state;
}

export function serialize(state: GameState): string {
    return JSON.stringify(state);
}

/** 读档。后续版本新增的镇民会在这里补上初始状态。 */
export function deserialize(json: string, world: World): GameState {
    const data = JSON.parse(json) as GameState;
    if (!data || typeof data !== 'object' || typeof data.version !== 'number') {
        throw new Error('存档损坏');
    }
    if (data.version > SAVE_VERSION) {
        throw new Error('存档来自更新版本的游戏');
    }
    data.inventory ??= {};
    data.plots ??= [];
    data.npcs ??= {};
    data.helpers ??= [];
    data.wishesDone ??= [];
    data.unlocked ??= [];
    // 第 4 版加入图鉴和每日记录
    data.fishLog ??= {};
    data.daily ??= emptyDaily('');
    // 第 1 版没有地盘，读档时送开局布局；以后删掉的建筑在这里清掉
    data.village = data.village ? repairVillage(world, data.village) : newVillage(world);
    if (!world.regions[data.region]) {
        throw new Error('存档里的地域不存在');
    }
    for (const def of Object.values(world.npcs)) {
        data.npcs[def.id] ??= newNpcState(def);
    }
    // 第 2 版的地块没绑菜地，这里按菜地重新分配（老地块上的庄稼保留）
    syncFieldPlots(data, world);
    data.version = SAVE_VERSION;
    return data;
}
