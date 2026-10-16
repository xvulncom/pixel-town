import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD } from '../assets/scripts/data/world';
import { deserialize, newGame, serialize } from '../assets/scripts/core/game';
import { submitWish } from '../assets/scripts/core/wishes';
import { bj } from './util';

const T0 = bj(2026, 10, 16, 8);

test('心愿：好感不够时镇民还没提起', () => {
    const s = newGame(WORLD, T0, 'p', 'jiangnan');
    const r = submitWish(s, WORLD, 'zhou_workshop', T0);
    assert.deepEqual(r, { ok: false, reason: '对方还没跟你说起这件事' });
});

test('心愿：凑齐后扣材料、解锁、加好感，只能完成一次', () => {
    const s = newGame(WORLD, T0, 'p', 'jiangnan');
    s.npcs.gui.affinity = 200;
    assert.equal(submitWish(s, WORLD, 'gui_icebox', T0).ok, false);
    s.inventory['crop:cucumber'] = 5;
    s.inventory['crop:tomato'] = 6;
    assert.equal(submitWish(s, WORLD, 'gui_icebox', T0).ok, true);
    assert.equal(s.gold, 0);
    assert.deepEqual(s.inventory, { 'seed:radish': 5, 'crop:tomato': 1 });
    assert.deepEqual(s.unlocked, ['shop:drinks']);
    assert.equal(s.npcs.gui.affinity, 300);
    assert.equal(submitWish(s, WORLD, 'gui_icebox', T0).ok, false);
});

test('存档：读写一致，补上新镇民，拒绝更新版本的存档', () => {
    const s = newGame(WORLD, T0, 'p', 'jiangnan');
    s.gold = 1234;
    assert.deepEqual(deserialize(serialize(s), WORLD), s);

    const old = JSON.parse(serialize(s));
    delete old.npcs.zhou;
    delete old.helpers;
    const loaded = deserialize(JSON.stringify(old), WORLD);
    assert.equal(loaded.npcs.zhou.affinity, 0);
    assert.deepEqual(loaded.helpers, []);

    assert.throws(() => deserialize(JSON.stringify({ ...s, version: 99 }), WORLD));
    assert.throws(() => deserialize('null', WORLD));
});
