// 时间推进：在线时每分钟调一次，回到游戏时调一次做离线结算，两种情况走同一套逻辑。
// 按 10 分钟一步推进：作物生长、换季、整点让打工镇民干活。

import { World } from './defs';
import { GameState, Season, Weather } from './types';
import { DAY, HOUR, MINUTE, dayKey } from './time';
import { seasonAt } from './calendar';
import { WeatherFn, isWetWeather, weatherOn } from './weather';
import { DRY_SPEED, applySeasonChange, growPlot } from './farm';
import { HelperLog, emptyHelperLog, runHelpers } from './helpers';
import { regionOf } from './region';

export const STEP_MS = 10 * MINUTE;
/** 离开太久只结算最近 14 天，防止一次算太久。 */
export const MAX_SIM_MS = 14 * DAY;

export interface SimOptions {
    weather?: WeatherFn;
}

export interface OfflineReport extends HelperLog {
    fromMs: number;
    toMs: number;
    matured: number;
    withered: number;
    seasonChanges: Season[];
}

export function simulate(state: GameState, world: World, toMs: number, opts: SimOptions = {}): OfflineReport {
    const region = regionOf(world, state);
    const weatherFn = opts.weather ?? ((ms: number) => weatherOn(ms, region));
    const report: OfflineReport = {
        ...emptyHelperLog(),
        fromMs: state.lastTick,
        toMs,
        matured: 0,
        withered: 0,
        seasonChanges: [],
    };
    if (toMs <= state.lastTick) {
        return report;
    }

    let t = Math.max(state.lastTick, toMs - MAX_SIM_MS);
    let cachedDay = '';
    let weather: Weather = 'sunny';

    while (t < toMs) {
        const end = Math.min(t + STEP_MS, toMs);

        const season = seasonAt(t);
        if (season !== state.season) {
            report.withered += applySeasonChange(state, world, season);
            state.season = season;
            report.seasonChanges.push(season);
        }

        const day = dayKey(t);
        if (day !== cachedDay) {
            cachedDay = day;
            weather = weatherFn(t);
        }

        const hours = (end - t) / HOUR;
        const rainy = isWetWeather(weather);
        for (const plot of state.plots) {
            const wet = rainy || plot.wetUntil > t;
            if (growPlot(world, plot, wet ? hours : hours * DRY_SPEED)) {
                report.matured += 1;
            }
        }

        // 北京时间与 UTC 差整 8 小时，UTC 整点就是本地整点
        const nextHour = Math.floor(t / HOUR) * HOUR + HOUR;
        if (nextHour <= end) {
            runHelpers(state, world, nextHour, weatherFn(nextHour), report);
        }

        t = end;
    }

    state.lastTick = toMs;
    return report;
}
