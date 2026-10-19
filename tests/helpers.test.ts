import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD } from './world';
import { newGame } from '../assets/scripts/core/game';
import { plant } from '../assets/scripts/core/farm';
import { assignHelper, capacity } from '../assets/scripts/core/helpers';
import { simulate } from '../assets/scripts/core/simulate';
import { countOf } from '../assets/scripts/core/inventory';
import { DAY } from '../assets/scripts/core/time';
import { bj, rainy, sunny } from './util';

const T0 = bj(2026, 10, 16, 8);

function plantAll(s: ReturnType<typeof newGame>, cropId: string): void {
    // 打工容量按 6 块地设计，测试只用前 6 块
    s.plots.length = 6;
    s.inventory[`seed:${cropId}`] = s.plots.length;
    s.plots.forEach((_, i) => assert.equal(plant(s, WORLD, i, cropId, T0).ok, true));
}

test('好感不到 2 心不肯打工', () => {
    const s = newGame(WORLD, T0, 'p', 'jiangnan');
    assert.equal(assignHelper(s, WORLD, 'zhou', 'water').ok, false);
    assert.equal(assignHelper(s, WORLD, 'gui', 'water').ok, false);
    s.npcs.gui.affinity = 200;
    assert.equal(assignHelper(s, WORLD, 'gui', 'water').ok, true);
    assert.equal(assignHelper(s, WORLD, 'gui', 'harvest').ok, true);
    assert.deepEqual(s.helpers, [{ npcId: 'gui', task: 'harvest' }]);
});

test('勤快和好感决定每小时干多少', () => {
    assert.equal(capacity(2, 0.9), 4);
    assert.equal(capacity(3, 0.7), 4);
    assert.equal(capacity(0, 0.1), 1);
});

test('桂姨帮忙浇水，萝卜当天下午全熟', () => {
    const s = newGame(WORLD, T0, 'p', 'jiangnan');
    s.npcs.gui.affinity = 200;
    assignHelper(s, WORLD, 'gui', 'water');
    plantAll(s, 'radish');
    const report = simulate(s, WORLD, bj(2026, 10, 16, 18), { weather: sunny });
    assert.ok((report.watered.gui ?? 0) >= 6);
    assert.equal(report.matured, 6);
});

test('离线三天：老周收葡萄，收成进背包，不偷吃', () => {
    const s = newGame(WORLD, T0, 'p', 'jiangnan');
    s.npcs.zhou.affinity = 300;
    assignHelper(s, WORLD, 'zhou', 'harvest');
    plantAll(s, 'grape');
    const report = simulate(s, WORLD, T0 + 3 * DAY, { weather: rainy });
    const got = report.harvested['crop:grape'] ?? 0;
    assert.ok(got >= 12, `只收了 ${got}`);
    assert.equal(countOf(s, 'crop:grape'), got);
    assert.deepEqual(report.eaten, []);
});

test('没人打工时作物熟了就放在地里', () => {
    const s = newGame(WORLD, T0, 'p', 'jiangnan');
    plantAll(s, 'grape');
    simulate(s, WORLD, T0 + 3 * DAY, { weather: rainy });
    assert.equal(countOf(s, 'crop:grape'), 0);
    assert.ok(s.plots.every((p) => p.state === 'mature'));
});

test('嘴馋的桂姨偶尔偷吃，背包数量等于净收成', () => {
    const s = newGame(WORLD, T0, 'p', 'jiangnan');
    s.npcs.gui.affinity = 400;
    assignHelper(s, WORLD, 'gui', 'harvest');
    plantAll(s, 'grape');
    const report = simulate(s, WORLD, T0 + 10 * DAY, { weather: rainy });
    assert.ok(report.eaten.length > 0, '十天里应该至少偷吃一次');
    assert.equal(countOf(s, 'crop:grape'), report.harvested['crop:grape']);
});
