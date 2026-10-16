// 镇民心愿：交齐材料和金币，解锁建筑或迎回新镇民。

import { World } from './defs';
import { GameState, OK, Result, fail } from './types';
import { countOf, removeItem } from './inventory';
import { dayKey } from './time';
import { addAffinity, heartsOf, remember } from './npc';

export function canSubmitWish(state: GameState, world: World, wishId: string): Result {
    const wish = world.wishes[wishId];
    if (!wish) {
        return fail('没有这个心愿');
    }
    if (state.wishesDone.includes(wishId)) {
        return fail('这个心愿已经完成了');
    }
    if (heartsOf(state, wish.npcId) < wish.minHearts) {
        return fail('对方还没跟你说起这件事');
    }
    if (state.gold < wish.requires.gold) {
        return fail('金币不够');
    }
    for (const [itemId, n] of Object.entries(wish.requires.items)) {
        if (countOf(state, itemId) < n) {
            return fail('材料还没凑齐');
        }
    }
    return OK;
}

export function submitWish(state: GameState, world: World, wishId: string, nowMs: number): Result {
    const check = canSubmitWish(state, world, wishId);
    if (!check.ok) {
        return check;
    }
    const wish = world.wishes[wishId];
    state.gold -= wish.requires.gold;
    for (const [itemId, n] of Object.entries(wish.requires.items)) {
        removeItem(state, itemId, n);
    }
    state.wishesDone.push(wishId);
    for (const u of wish.rewards.unlock) {
        if (!state.unlocked.includes(u)) {
            state.unlocked.push(u);
        }
    }
    addAffinity(state, wish.npcId, wish.rewards.affinity);
    remember(state, wish.npcId, `${dayKey(nowMs)} 心愿完成：${wish.title}`);
    return OK;
}
