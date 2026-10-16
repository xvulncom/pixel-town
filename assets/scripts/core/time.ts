// 游戏时间跟现实走，统一按北京时间（UTC+8）切日。

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
export const TZ_OFFSET_MS = 8 * HOUR;

export interface LocalParts {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
}

export function localParts(ms: number): LocalParts {
    const d = new Date(ms + TZ_OFFSET_MS);
    return {
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1,
        day: d.getUTCDate(),
        hour: d.getUTCHours(),
        minute: d.getUTCMinutes(),
    };
}

function pad(n: number): string {
    return n < 10 ? `0${n}` : `${n}`;
}

/** 北京时间的日期键，如 `2026-10-16`。 */
export function dayKey(ms: number): string {
    const p = localParts(ms);
    return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** 北京时间当天 0 点对应的毫秒数。 */
export function startOfDay(ms: number): number {
    const local = ms + TZ_OFFSET_MS;
    return local - (((local % DAY) + DAY) % DAY) - TZ_OFFSET_MS;
}

/** 北京时间的小时（0～23）。 */
export function localHour(ms: number): number {
    return localParts(ms).hour;
}
