// 现实天气：镇子和村庄的天气跟一个现实地点当天的真实天气走。
// 服务端每小时从 Open-Meteo 拉一次（天气代码、降水、沙尘浓度），存成"地点 → 日期 → 天气"表；
// 游戏和服务端推进都先查这张表，查不到（断网、微信版还没有后端、太久以前）再用地域气候的随机天气。
// 日期对法：游戏的第 D 天（北京时间）用那个地点当地日历的第 D 天，美国那边会差半天，不追究。

import { Weather } from './types';
import { dayKey } from './time';

export interface PlaceDef {
    id: string;
    name: string;
    lat: number;
    lon: number;
    /** IANA 时区，Open-Meteo 按它切当地日期 */
    tz: string;
    /** 国外地点，选地点界面分开列 */
    abroad?: boolean;
}

/** 地点 id → 日期（YYYY-MM-DD）→ 天气 */
export type WeatherTable = Record<string, Record<string, Weather>>;

/**
 * 一天里沙尘浓度最高值（μg/m³，CAMS 模型）到这个才算沙尘暴。2026-10 看过 14 天的数：江南、岭南几十，
 * 华北有浮尘时两三百，兰州银川常年三四百，乌鲁木齐平时就五百多、起沙那天上千。取 800 只留真正起沙的日子。
 */
export const DUST_STORM_UG = 800;
/** 一天降水不到这个（毫米）不算下雨，只是阴天 */
export const RAIN_MM = 0.5;

let table: WeatherTable = {};

/** 换一张天气表（游戏从服务端拉到、服务端从库里读出来之后调） */
export function setRealWeather(t: WeatherTable): void {
    table = t;
}

export function realWeatherTable(): WeatherTable {
    return table;
}

/** 那个地点那天的真实天气，没有就是 null */
export function realWeather(placeId: string, ms: number): Weather | null {
    return table[placeId]?.[dayKey(ms)] ?? null;
}

/**
 * 一天的天气：Open-Meteo 的每日天气代码（WMO，取一天里最严重的）+ 降水量 + 沙尘浓度最高值。
 * 下雪看代码；下雨看降水够不够；没下雨但沙尘超标就是沙尘暴；其余按云量分晴和多云。
 */
export function wmoWeather(code: number, precipMm: number, dustMax: number | null): Weather {
    const snowCode = (code >= 71 && code <= 77) || code === 85 || code === 86;
    if (snowCode && precipMm >= RAIN_MM) return 'snow';
    if (precipMm >= RAIN_MM && code >= 51) return 'rain';
    if (dustMax !== null && dustMax >= DUST_STORM_UG) return 'dust';
    if (code <= 1) return 'sunny';
    return 'cloudy';
}

export interface WeatherRow {
    place: string;
    day: string;
    weather: Weather;
}

interface DailyBlock {
    daily?: { time?: string[]; weather_code?: (number | null)[]; precipitation_sum?: (number | null)[] };
}

interface HourlyBlock {
    hourly?: { time?: string[]; dust?: (number | null)[] };
}

/** Open-Meteo 一次查多个坐标时回数组，查一个时回对象，都整理成数组 */
const asList = <T>(v: unknown): T[] => (Array.isArray(v) ? v : v && typeof v === 'object' ? [v] : []) as T[];

/**
 * 把 Open-Meteo 的天气回包（daily=weather_code,precipitation_sum）和空气质量回包（hourly=dust）
 * 按地点顺序拼成每天一行。空气质量拉不到时 air 传 null，就不判沙尘暴。
 */
export function parseOpenMeteo(places: PlaceDef[], forecast: unknown, air: unknown): WeatherRow[] {
    const f = asList<DailyBlock>(forecast);
    const a = asList<HourlyBlock>(air);
    const rows: WeatherRow[] = [];
    places.forEach((p, i) => {
        const d = f[i]?.daily;
        if (!d?.time) return;
        const dust = new Map<string, number>();
        const h = a[i]?.hourly;
        h?.time?.forEach((t, k) => {
            const v = h.dust?.[k];
            if (typeof v !== 'number') return;
            const day = t.slice(0, 10);
            dust.set(day, Math.max(dust.get(day) ?? 0, v));
        });
        d.time.forEach((day, k) => {
            const code = d.weather_code?.[k];
            if (typeof code !== 'number') return;
            const rain = d.precipitation_sum?.[k] ?? 0;
            rows.push({ place: p.id, day, weather: wmoWeather(code, rain, dust.has(day) ? dust.get(day)! : null) });
        });
    });
    return rows;
}

/** 行转成表 */
export function tableOf(rows: WeatherRow[]): WeatherTable {
    const t: WeatherTable = {};
    for (const r of rows) (t[r.place] ??= {})[r.day] = r.weather;
    return t;
}

/** 拉 Open-Meteo 用的两个地址：过去 past 天到未来 2 天 */
export function openMeteoUrls(places: PlaceDef[], past: number): { forecast: string; air: string } {
    const q = (k: string, f: (p: PlaceDef) => string | number) => `${k}=${places.map((p) => encodeURIComponent(String(f(p)))).join(',')}`;
    const common = `${q('latitude', (p) => p.lat)}&${q('longitude', (p) => p.lon)}&${q('timezone', (p) => p.tz)}&past_days=${past}&forecast_days=2`;
    return {
        forecast: `https://api.open-meteo.com/v1/forecast?${common}&daily=weather_code,precipitation_sum`,
        air: `https://air-quality-api.open-meteo.com/v1/air-quality?${common}&hourly=dust`,
    };
}
