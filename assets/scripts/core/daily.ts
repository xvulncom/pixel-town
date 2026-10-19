// 每天重置的记录：当天第一条鱼、摆摊轮数。按北京时间零点切日，玩家不用睡觉。

import { DailyState, GameState } from './types';
import { dayKey } from './time';

export function emptyDaily(day: string): DailyState {
    return { day, fished: false, marketRounds: 0 };
}

/** 取今天的记录，跨天了先清零。 */
export function today(state: GameState, nowMs: number): DailyState {
    const day = dayKey(nowMs);
    if (!state.daily || state.daily.day !== day) state.daily = emptyDaily(day);
    return state.daily;
}
