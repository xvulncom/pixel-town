import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD } from '../assets/scripts/data/world';
import { newGame } from '../assets/scripts/core/game';
import {
    DialogueContext, LocalPlanProvider, StateNpcMemory, activityAt, giveGift, pickLine, talk,
} from '../assets/scripts/core/npc';
import { DAY } from '../assets/scripts/core/time';
import { bj } from './util';

const T0 = bj(2026, 10, 16, 8);

test('聊天每天第一次加好感', () => {
    const s = newGame(WORLD, T0, 'p', 'jiangnan');
    assert.deepEqual(talk(s, 'zhou', T0), { ok: true, gained: 10 });
    assert.deepEqual(talk(s, 'zhou', T0 + 3600_000), { ok: true, gained: 0 });
    assert.deepEqual(talk(s, 'zhou', T0 + DAY), { ok: true, gained: 10 });
    assert.equal(s.npcs.zhou.affinity, 20);
});

test('送礼：喜好决定好感，每天一份，礼物从背包扣掉并记进记忆', () => {
    const s = newGame(WORLD, T0, 'p', 'jiangnan');
    s.inventory['crop:strawberry'] = 1;
    s.inventory['crop:radish'] = 2;
    assert.deepEqual(giveGift(s, WORLD, 'gui', 'crop:strawberry', T0), { ok: true, reaction: 'love', delta: 80 });
    assert.equal(s.npcs.gui.affinity, 230);
    assert.equal(s.inventory['crop:strawberry'], undefined);
    assert.equal(giveGift(s, WORLD, 'gui', 'crop:radish', T0).ok, false);
    assert.deepEqual(giveGift(s, WORLD, 'gui', 'crop:radish', T0 + DAY), { ok: true, reaction: 'dislike', delta: -20 });
    assert.equal(s.npcs.gui.affinity, 210);
    assert.equal(new StateNpcMemory(s).recall('gui', 5).length, 2);
});

function ctx(over: Partial<DialogueContext>): DialogueContext {
    return {
        npcId: 'zhou', hearts: 0, season: 'autumn', term: '霜降', weather: 'sunny',
        timeOfDay: 'morning', dayKey: '2026-10-24', recentIds: [], ...over,
    };
}

test('对话：只选符合条件的台词，节气台词优先', () => {
    const allowed = new Set(['zhou_001', 'zhou_002', 'zhou_003', 'zhou_004', 'zhou_009', 'zhou_011', 'zhou_012']);
    let termHits = 0;
    for (let i = 0; i < 50; i++) {
        const r = pickLine(WORLD.dialogues, ctx({ dayKey: `day-${i}` }));
        assert.ok(allowed.has(r.id), `不该选到 ${r.id}`);
        if (r.id === 'zhou_011') termHits += 1;
    }
    assert.ok(termHits >= 20, `节气台词只出现 ${termHits} 次`);
});

test('对话：避开最近说过的', () => {
    const all = ['zhou_001', 'zhou_002', 'zhou_003', 'zhou_004', 'zhou_009', 'zhou_012'];
    assert.equal(pickLine(WORLD.dialogues, ctx({ recentIds: all })).id, 'zhou_011');
    assert.equal(pickLine(WORLD.dialogues, ctx({ npcId: 'nobody' })).id, 'fallback');
});

test('计划：雨天用雨天作息，凌晨沿用前一天最后一条', async () => {
    const p = new LocalPlanProvider(WORLD);
    const sunnyPlan = await p.getPlan('gui', '2026-10-16', 'sunny');
    const rainPlan = await p.getPlan('gui', '2026-10-16', 'rain');
    assert.equal(activityAt(sunnyPlan, 14).place, 'big_tree');
    assert.equal(activityAt(rainPlan, 14).place, 'store');
    assert.equal(activityAt(sunnyPlan, 3).activity, '睡觉');
});
