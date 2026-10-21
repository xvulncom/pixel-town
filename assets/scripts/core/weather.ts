// 每日天气：同一地域的玩家共用一个种子，同一天天气相同，方便好友之间聊"今天镇上下雨"。
// 不同地域气候不同。有现实天气（core/realWeather.ts）时先用现实天气，见 placeWeather。

import { Climate, RegionDef } from './defs';
import { Weather } from './types';
import { seasonAt } from './calendar';
import { dayKey } from './time';
import { rand01 } from './rng';
import { realWeather } from './realWeather';

export const WORLD_SEED = 'pixel-town';

export const DEFAULT_CLIMATE: Climate = {
    wetChance: { spring: 0.3, summer: 0.35, autumn: 0.2, winter: 0.15 },
    snow: true,
};

const CLOUDY_CHANCE = 0.25;

export type WeatherFn = (ms: number) => Weather;

export type WeatherRegion = Pick<RegionDef, 'id' | 'climate'>;

const DEFAULT_REGION: WeatherRegion = { id: 'default', climate: DEFAULT_CLIMATE };

export function weatherOn(ms: number, region: WeatherRegion = DEFAULT_REGION, worldSeed: string = WORLD_SEED): Weather {
    const season = seasonAt(ms);
    const r = rand01(worldSeed, region.id, 'weather', dayKey(ms));
    const wet = region.climate.wetChance[season];
    if (r < wet) {
        return season === 'winter' && region.climate.snow ? 'snow' : 'rain';
    }
    if (r < wet + CLOUDY_CHANCE) {
        return 'cloudy';
    }
    return 'sunny';
}

/** 某个现实地点那天的天气：拉到了真实天气就用真实的，没有就退回地域气候的随机天气。 */
export function placeWeather(ms: number, region: WeatherRegion, placeId: string, worldSeed: string = WORLD_SEED): Weather {
    return (placeId && realWeather(placeId, ms)) || weatherOn(ms, region, worldSeed);
}

/** 雨雪天作物全天湿润，不用浇水。 */
export function isWetWeather(w: Weather): boolean {
    return w === 'rain' || w === 'snow';
}
