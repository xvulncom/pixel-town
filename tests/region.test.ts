import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD } from '../assets/scripts/data/world';
import { newGame } from '../assets/scripts/core/game';
import { buySeed, plant } from '../assets/scripts/core/farm';
import { weatherOn } from '../assets/scripts/core/weather';
import { inSeason } from '../assets/scripts/core/region';
import { countOf } from '../assets/scripts/core/inventory';
import { DAY } from '../assets/scripts/core/time';
import { Season } from '../assets/scripts/core/types';
import { bj } from './util';

const WINTER = bj(2026, 12, 25, 9);
const SUMMER = bj(2026, 7, 10, 9);

test('地域数据完整：作物存在，特产都标了 specialty，春夏秋都有东西种', () => {
    for (const r of Object.values(WORLD.regions)) {
        for (const id of [...r.crops, ...r.specialties]) {
            assert.ok(WORLD.crops[id], `${r.name} 引用了不存在的作物 ${id}`);
        }
        for (const id of r.specialties) {
            assert.equal(WORLD.crops[id].specialty, true, `${id} 没标特产`);
        }
        for (const id of r.crops) {
            assert.ok(!WORLD.crops[id].specialty, `${r.name} 把特产 ${id} 放进了普通货架`);
        }
        for (const season of ['spring', 'summer', 'autumn'] as Season[]) {
            assert.ok(r.crops.some((id) => inSeason(WORLD, r, id, season)), `${r.name}${season}没东西种`);
        }
    }
});

test('每种特产只属于一个地域', () => {
    const owner = new Map<string, string>();
    for (const r of Object.values(WORLD.regions)) {
        for (const id of r.specialties) {
            assert.ok(!owner.has(id), `${id} 同时属于 ${owner.get(id)} 和 ${r.id}`);
            owner.set(id, r.id);
        }
    }
});

test('岭南冬天不下雪、还能种叶菜；东北冬天地冻着什么都种不了', () => {
    const lingnan = WORLD.regions.lingnan;
    for (let i = 0; i < 90; i++) {
        assert.notEqual(weatherOn(bj(2026, 12, 1) + i * DAY, lingnan), 'snow');
    }
    const ln = newGame(WORLD, WINTER, 'p', 'lingnan');
    assert.equal(buySeed(ln, WORLD, 'bokchoy', 1, WINTER).ok, true);

    const db = newGame(WORLD, WINTER, 'p', 'dongbei');
    assert.deepEqual(db.inventory, {});
    for (const id of [...WORLD.regions.dongbei.crops, ...WORLD.regions.dongbei.specialties]) {
        assert.equal(buySeed(db, WORLD, id, 1, WINTER).ok, false, `东北冬天居然能买 ${id}`);
    }
});

test('外地特产：自己买不到，好友送的种子按本地季节能种', () => {
    const s = newGame(WORLD, SUMMER, 'p', 'jiangnan');
    assert.equal(buySeed(s, WORLD, 'lychee', 1, SUMMER).ok, false);
    s.inventory['seed:lychee'] = 1;
    assert.equal(plant(s, WORLD, 0, 'lychee', SUMMER).ok, true);
    assert.equal(countOf(s, 'seed:lychee'), 0);
});

test('不同地域天气各自独立', () => {
    let differ = 0;
    for (let i = 0; i < 30; i++) {
        const ms = SUMMER + i * DAY;
        if (weatherOn(ms, WORLD.regions.jiangnan) !== weatherOn(ms, WORLD.regions.xibei)) differ += 1;
    }
    assert.ok(differ > 5, `30 天里只有 ${differ} 天不同`);
});

test('未知地域开局报错', () => {
    assert.throws(() => newGame(WORLD, SUMMER, 'p', 'atlantis'));
});
