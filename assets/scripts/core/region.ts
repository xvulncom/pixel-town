// 地域相关的查询：种植季节、种子店卖什么。

import { RegionDef, World } from './defs';
import { GameState, Season } from './types';

export function regionOf(world: World, state: GameState): RegionDef {
    const region = world.regions[state.region];
    if (!region) {
        throw new Error(`unknown region ${state.region}`);
    }
    return region;
}

/** 自己村庄的天气跟哪个现实地点：玩家选过就用选的，没选跟老家原型地点 */
export function villagePlace(world: World, state: GameState): string {
    return state.place || world.regions[state.region]?.origin || '';
}

/** 某作物在该地域能种的季节（地域有覆盖就用覆盖值）。好友送来的外地种子也按本地气候算。 */
export function cropSeasons(world: World, region: RegionDef, cropId: string): Season[] {
    return region.seasonOverrides?.[cropId] ?? world.crops[cropId]?.seasons ?? [];
}

export function inSeason(world: World, region: RegionDef, cropId: string, season: Season): boolean {
    return cropSeasons(world, region, cropId).includes(season);
}

/** 本地种子店是否卖这种种子。 */
export function sellsSeed(region: RegionDef, cropId: string): boolean {
    return region.crops.includes(cropId) || region.specialties.includes(cropId);
}
