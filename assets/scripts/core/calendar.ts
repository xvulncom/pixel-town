// 节气日历：季节和节气跟现实日期走。
// 节气日期取近年常见日期，个别年份会差一天，对玩法没有影响。

import { Season } from './types';
import { localParts } from './time';

export interface SolarTermDef {
    name: string;
    month: number;
    day: number;
    season: Season;
}

export const SOLAR_TERMS: readonly SolarTermDef[] = [
    { name: '小寒', month: 1, day: 5, season: 'winter' },
    { name: '大寒', month: 1, day: 20, season: 'winter' },
    { name: '立春', month: 2, day: 4, season: 'spring' },
    { name: '雨水', month: 2, day: 19, season: 'spring' },
    { name: '惊蛰', month: 3, day: 5, season: 'spring' },
    { name: '春分', month: 3, day: 20, season: 'spring' },
    { name: '清明', month: 4, day: 4, season: 'spring' },
    { name: '谷雨', month: 4, day: 20, season: 'spring' },
    { name: '立夏', month: 5, day: 5, season: 'summer' },
    { name: '小满', month: 5, day: 21, season: 'summer' },
    { name: '芒种', month: 6, day: 5, season: 'summer' },
    { name: '夏至', month: 6, day: 21, season: 'summer' },
    { name: '小暑', month: 7, day: 7, season: 'summer' },
    { name: '大暑', month: 7, day: 22, season: 'summer' },
    { name: '立秋', month: 8, day: 7, season: 'autumn' },
    { name: '处暑', month: 8, day: 23, season: 'autumn' },
    { name: '白露', month: 9, day: 7, season: 'autumn' },
    { name: '秋分', month: 9, day: 23, season: 'autumn' },
    { name: '寒露', month: 10, day: 8, season: 'autumn' },
    { name: '霜降', month: 10, day: 23, season: 'autumn' },
    { name: '立冬', month: 11, day: 7, season: 'winter' },
    { name: '小雪', month: 11, day: 22, season: 'winter' },
    { name: '大雪', month: 12, day: 7, season: 'winter' },
    { name: '冬至', month: 12, day: 21, season: 'winter' },
];

export const SEASON_NAMES: Record<Season, string> = {
    spring: '春',
    summer: '夏',
    autumn: '秋',
    winter: '冬',
};

export interface SolarTerm {
    index: number;
    name: string;
    season: Season;
}

/** 某个时间点所处的节气（元旦到小寒之间算上一年的冬至）。 */
export function solarTermAt(ms: number): SolarTerm {
    const p = localParts(ms);
    const today = p.month * 100 + p.day;
    let index = SOLAR_TERMS.length - 1;
    for (let i = 0; i < SOLAR_TERMS.length; i++) {
        const t = SOLAR_TERMS[i];
        if (t.month * 100 + t.day <= today) {
            index = i;
        }
    }
    const t = SOLAR_TERMS[index];
    return { index, name: t.name, season: t.season };
}

export function seasonAt(ms: number): Season {
    return solarTermAt(ms).season;
}
