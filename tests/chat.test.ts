import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatWith } from '../assets/scripts/core/chat';
import { newGame } from '../assets/scripts/core/game';
import { LocalDialogueProvider, TALK_GAIN } from '../assets/scripts/core/npc';
import { WORLD } from '../assets/scripts/data/world';
import { TOWN_FOLK } from '../assets/scripts/data/townFolk';
import { buildJiangnan } from '../tools/maps/jiangnan';
import { bj } from './util';

const provider = new LocalDialogueProvider(WORLD.dialogues);

test('搭话：有人设的镇民从对话库说话，每天第一次加好感', async () => {
    const now = bj(2026, 10, 21, 9);
    const s = newGame(WORLD, now, 'chat', 'jiangnan');
    const r1 = await chatWith(s, WORLD, TOWN_FOLK, 'gui', now, provider, []);
    assert.ok(r1);
    assert.equal(r1.name, '桂姨');
    assert.ok(r1.text.length > 0 && r1.text !== '……');
    assert.equal(r1.gained, TALK_GAIN);
    const r2 = await chatWith(s, WORLD, TOWN_FOLK, 'gui', now + 1000, provider, [r1.lineId]);
    assert.equal(r2!.gained, 0);
});

test('搭话：路人说闲话不加好感，尽量不重复；不认识的人返回 null', async () => {
    const now = bj(2026, 10, 21, 9);
    const s = newGame(WORLD, now, 'chat', 'jiangnan');
    const recent: string[] = [];
    for (let k = 0; k < TOWN_FOLK.monk.lines.length; k++) {
        const r = await chatWith(s, WORLD, TOWN_FOLK, 'monk', now, provider, recent);
        assert.equal(r!.gained, 0);
        assert.ok(!recent.includes(r!.lineId), '说了重复的话');
        recent.push(r!.lineId);
    }
    assert.equal(await chatWith(s, WORLD, TOWN_FOLK, 'nobody', now, provider, []), null);
});

test('镇上走动的人都有名字能搭话', () => {
    for (const wk of buildJiangnan().walkers) {
        assert.ok(WORLD.npcs[wk.id] || TOWN_FOLK[wk.id], `${wk.id} 既不是镇民也不在 data/townFolk.ts`);
    }
});
