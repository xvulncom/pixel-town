import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD } from '../assets/scripts/data/world';
import { newGame } from '../assets/scripts/core/game';
import { buySeed, harvest, plant, sell, water } from '../assets/scripts/core/farm';
import { simulate } from '../assets/scripts/core/simulate';
import { countOf } from '../assets/scripts/core/inventory';
import { HOUR } from '../assets/scripts/core/time';
import { bj, rainy, sunny } from './util';

const T0 = bj(2026, 10, 16, 8);

test('开局：金币、地块、当季种子、镇民初始好感', () => {
    const s = newGame(WORLD, T0, 'player-1', 'jiangnan');
    assert.equal(s.gold, 300);
    // 开局布局里有几格菜地就有几块地
    const fields = WORLD.villageStarter.filter((it) => it.def === 'field').length;
    assert.equal(s.plots.length, fields);
    assert.ok(s.plots.every((p) => p.field !== undefined));
    assert.equal(s.season, 'autumn');
    assert.equal(countOf(s, 'seed:radish'), 5);
    assert.equal(s.npcs.gui.affinity, 150);
    assert.equal(s.npcs.zhou.affinity, 0);
    assert.equal(s.region, 'jiangnan');
});

test('买种子：季节、特产、金币限制', () => {
    const s = newGame(WORLD, T0, 'player-1', 'bashu');
    assert.equal(buySeed(s, WORLD, 'watermelon', 1, T0).ok, false);
    assert.equal(buySeed(s, WORLD, 'apple', 1, T0).ok, false);
    assert.equal(buySeed(s, WORLD, 'persimmon', 1, T0).ok, true);
    assert.equal(s.gold, 180);
    assert.equal(buySeed(s, WORLD, 'pumpkin', 3, T0).ok, false);
    assert.equal(s.gold, 180);
});

test('浇水后 5 小时萝卜成熟，不浇水要 10 小时', () => {
    const s = newGame(WORLD, T0, 'player-1', 'jiangnan');
    assert.equal(plant(s, WORLD, 0, 'radish', T0).ok, true);
    assert.equal(plant(s, WORLD, 1, 'radish', T0).ok, true);
    assert.equal(plant(s, WORLD, 0, 'radish', T0).ok, false);
    water(s, 0, T0);

    simulate(s, WORLD, T0 + 5 * HOUR, { weather: sunny });
    assert.equal(s.plots[0].state, 'mature');
    assert.equal(s.plots[1].state, 'growing');

    simulate(s, WORLD, T0 + 10 * HOUR, { weather: sunny });
    assert.equal(s.plots[1].state, 'mature');

    const r = harvest(s, WORLD, 0, T0 + 10 * HOUR);
    assert.deepEqual(r, { ok: true, itemId: 'crop:radish' });
    assert.equal(s.plots[0].state, 'empty');
    assert.equal(sell(s, WORLD, 'crop:radish', 1).ok, true);
    assert.equal(s.gold, 300 + 58);
    assert.equal(sell(s, WORLD, 'crop:radish', 1).ok, false);
});

test('多次收获：葡萄收完继续长，第二茬 8 小时', () => {
    const s = newGame(WORLD, T0, 'player-1', 'jiangnan');
    s.inventory['seed:grape'] = 1;
    plant(s, WORLD, 0, 'grape', T0);
    simulate(s, WORLD, T0 + 12 * HOUR, { weather: rainy });
    assert.equal(harvest(s, WORLD, 0, T0 + 12 * HOUR).ok, true);
    assert.equal(s.plots[0].state, 'growing');
    simulate(s, WORLD, T0 + 20 * HOUR, { weather: rainy });
    assert.equal(s.plots[0].state, 'mature');
});

test('换季：没长成的秋季作物在立冬枯萎', () => {
    const t = bj(2026, 11, 6, 12);
    const s = newGame(WORLD, t, 'player-1', 'jiangnan');
    s.inventory['seed:pumpkin'] = 1;
    plant(s, WORLD, 0, 'pumpkin', t);
    const report = simulate(s, WORLD, bj(2026, 11, 7, 12), { weather: sunny });
    assert.equal(s.plots[0].state, 'withered');
    assert.equal(report.withered, 1);
    assert.deepEqual(report.seasonChanges, ['winter']);
    assert.equal(s.season, 'winter');
});
