import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WORLD } from '../assets/scripts/data/world';
import { deserialize, newGame, serialize } from '../assets/scripts/core/game';
import { cropSprite, cropStage, plotIndexAt, seedChoices, tend } from '../assets/scripts/core/fields';
import { place, removeAt } from '../assets/scripts/core/village';
import { simulate } from '../assets/scripts/core/simulate';
import { countOf } from '../assets/scripts/core/inventory';
import { HOUR } from '../assets/scripts/core/time';
import { bj, sunny } from './util';

const T0 = bj(2026, 10, 16, 8);
const fresh = () => newGame(WORLD, T0, 'p', 'jiangnan');
const fieldCount = (s: ReturnType<typeof fresh>) => s.village.items.filter((it) => it.def === 'field').length;

test('菜地：每格菜地一块地，新铺的加一块，拆了就没了', () => {
    const s = fresh();
    assert.equal(s.plots.length, fieldCount(s));
    assert.notEqual(plotIndexAt(s, WORLD, 4, 16), -1);
    assert.equal(plotIndexAt(s, WORLD, 0, 0), -1);
    assert.equal(place(WORLD, s, 'field', 0, 30).ok, true);
    assert.equal(s.plots.length, fieldCount(s));
    assert.notEqual(plotIndexAt(s, WORLD, 0, 30), -1);
    assert.equal(removeAt(WORLD, s, 4, 16).ok, true);
    assert.equal(plotIndexAt(s, WORLD, 4, 16), -1);
    assert.equal(s.plots.length, fieldCount(s));
    const uids = new Set(s.plots.map((p) => p.field));
    assert.equal(uids.size, s.plots.length);
});

test('菜地：点一下种下并浇水，熟了点一下收获卖钱，没种子自动买', () => {
    const s = fresh();
    const i = plotIndexAt(s, WORLD, 5, 17);
    const gold = s.gold;
    const r1 = tend(s, WORLD, i, 'radish', T0);
    assert.equal(r1.ok && r1.action, 'plant');
    assert.equal(s.gold, gold, '开局送的种子先用');
    assert.equal(countOf(s, 'seed:radish'), 4);
    assert.equal(cropStage(WORLD, s.plots[i]), 'sprout');
    const r2 = tend(s, WORLD, i, 'radish', T0 + HOUR);
    assert.equal(r2.ok && r2.action, 'wait');

    simulate(s, WORLD, T0 + 3 * HOUR, { weather: sunny });
    assert.equal(cropStage(WORLD, s.plots[i]), 'young');
    simulate(s, WORLD, T0 + 5 * HOUR, { weather: sunny });
    assert.equal(cropStage(WORLD, s.plots[i]), 'ripe');
    const r3 = tend(s, WORLD, i, 'radish', T0 + 5 * HOUR);
    assert.equal(r3.ok && r3.action, 'harvest');
    assert.equal(r3.ok && r3.gold, WORLD.crops.radish.sellPrice);
    assert.equal(s.plots[i].state, 'empty');
    assert.equal(s.plots[i].field !== undefined, true, '收完还绑着菜地');

    s.inventory['seed:radish'] = 0;
    const before = s.gold;
    const r4 = tend(s, WORLD, i, 'radish', T0 + 5 * HOUR);
    assert.equal(r4.ok && r4.gold, -WORLD.crops.radish.seedPrice);
    assert.equal(s.gold, before - WORLD.crops.radish.seedPrice);
});

test('菜地：干了点一下浇水，枯了点一下清掉，不当季的种不了', () => {
    const s = fresh();
    const i = plotIndexAt(s, WORLD, 4, 16);
    tend(s, WORLD, i, 'pumpkin', T0);
    const r = tend(s, WORLD, i, 'pumpkin', T0 + 9 * HOUR);
    assert.equal(r.ok && r.action, 'water');
    s.plots[i].state = 'withered';
    assert.equal(cropStage(WORLD, s.plots[i]), 'withered');
    const c = tend(s, WORLD, i, 'pumpkin', T0 + 10 * HOUR);
    assert.equal(c.ok && c.action, 'clear');
    assert.equal(tend(s, WORLD, i, 'watermelon', T0 + 10 * HOUR).ok, false);
});

test('菜地：当季可选的种子按生长时间排，特产要有种子才出现', () => {
    const s = fresh();
    const list = seedChoices(s, WORLD, T0);
    assert.equal(list[0], 'radish');
    assert.ok(list.includes('pumpkin'));
    assert.ok(!list.includes('watermelon'));
    assert.ok(!list.includes('persimmon'));
    s.inventory['seed:persimmon'] = 1;
    assert.ok(seedChoices(s, WORLD, T0).includes('persimmon'));
});

test('存档：第 2 版的 6 块地分给菜地，地里的庄稼留着', () => {
    const s = fresh();
    const v2 = JSON.parse(serialize(s));
    v2.version = 2;
    v2.plots = Array.from({ length: 6 }, () => ({ state: 'empty', cropId: null, growth: 0, wetUntil: 0, harvests: 0 }));
    v2.plots[0] = { state: 'growing', cropId: 'radish', growth: 3, wetUntil: 0, harvests: 0 };
    const loaded = deserialize(JSON.stringify(v2), WORLD);
    assert.equal(loaded.plots.length, fieldCount(loaded));
    assert.equal(loaded.plots.filter((p) => p.cropId === 'radish').length, 1);
    assert.ok(loaded.plots.every((p) => p.field !== undefined));
});

test('素材：每种作物成熟时有图，各生长阶段有图', () => {
    const frames = JSON.parse(readFileSync(join(__dirname, '../assets/resources/maps/buildings-frames.json'), 'utf8')).frames;
    for (const id of Object.keys(WORLD.crops)) {
        assert.ok(frames[cropSprite(id, 'ripe')], `${id} 没有成熟图`);
    }
    for (const stage of ['sprout', 'young', 'withered'] as const) {
        assert.ok(frames[cropSprite('radish', stage)], `没有 ${stage} 图`);
    }
});
