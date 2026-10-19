import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD } from './world';
import { deserialize, newGame, SAVE_VERSION, serialize } from '../assets/scripts/core/game';
import { plotIndexAt, tend } from '../assets/scripts/core/fields';
import { patrol, patrolSummary } from '../assets/scripts/core/patrol';
import { fishDexProgress, fishPool, hookWindowMs, landFish, newReel, rollFish, stepReel } from '../assets/scripts/core/fishing';
import { advanceMarket, newMarket, openMarket, patienceOf, priceOf, roundsLeft, serve, wantOf } from '../assets/scripts/core/market';
import { simulate } from '../assets/scripts/core/simulate';
import { DAY, HOUR } from '../assets/scripts/core/time';
import { bj, sunny } from './util';

const T0 = bj(2026, 10, 16, 8);
const fresh = () => newGame(WORLD, T0, 'p', 'jiangnan');

test('巡村：一下把空地种上，第二天熟了的收掉再种上，不白给钱', () => {
    const s = fresh();
    s.gold = 1000;
    const gold = s.gold;
    const r1 = patrol(s, WORLD, 'radish', T0);
    assert.equal(r1.planted, s.plots.length);
    assert.equal(s.gold, gold + r1.gold, '金币只因买种子变');
    assert.ok(r1.gold < 0, '买了种子');
    assert.equal(patrol(s, WORLD, 'radish', T0 + HOUR).gold, 0, '没事可干就不动钱');

    simulate(s, WORLD, T0 + DAY, { weather: sunny });
    const r2 = patrol(s, WORLD, 'radish', T0 + DAY);
    assert.equal(r2.harvested, s.plots.length);
    assert.equal(r2.planted, s.plots.length, '收完接着种');
    assert.match(patrolSummary(r2), /收了 12 块/);
});

test('巡村：干了的浇水，钱不够就不种，熟了的照样收', () => {
    const s = fresh();
    const i = plotIndexAt(s, WORLD, 4, 16);
    tend(s, WORLD, i, 'radish', T0);
    s.gold = 0;
    s.inventory = {};
    const r = patrol(s, WORLD, 'radish', T0 + 10 * HOUR);
    assert.equal(r.watered, 1);
    assert.equal(r.planted, 0);
    assert.equal(patrolSummary({ harvested: 0, watered: 0, cleared: 0, planted: 0, gold: 0 }), '地里都挺好，没什么要干的');
});

test('钓鱼：鱼按季节、时段、天气、地域出现', () => {
    const autumnMorning = fishPool(WORLD, 'jiangnan', T0, 'sunny').map((f) => f.id);
    assert.ok(autumnMorning.includes('jiyu'));
    assert.ok(autumnMorning.includes('baitiao'));
    assert.ok(!autumnMorning.includes('qingyu'), '青鱼冬天才有');
    assert.ok(!autumnMorning.includes('dazhaxie'), '大闸蟹傍晚才有');
    const autumnEvening = fishPool(WORLD, 'jiangnan', bj(2026, 10, 16, 20), 'sunny').map((f) => f.id);
    assert.ok(autumnEvening.includes('dazhaxie'));
    assert.ok(autumnEvening.includes('angci'), '跨夜时段');
    assert.ok(!autumnEvening.includes('baitiao'));
    assert.ok(!fishPool(WORLD, 'bashu', bj(2026, 10, 16, 20), 'sunny').some((f) => f.id === 'dazhaxie'), '外地没有');
    const pool = fishPool(WORLD, 'jiangnan', T0, 'sunny');
    assert.equal(rollFish(pool, 0)?.id, pool[0].id);
    assert.equal(rollFish(pool, 0.999999)?.id, pool[pool.length - 1].id);
    assert.ok(hookWindowMs(WORLD.fish.qingyu) < hookWindowMs(WORLD.fish.jiyu));
});

test('钓鱼：会预判的人每种鱼大多能钓上来，一直不按的会跑掉，同样种子结果一样', () => {
    for (const f of Object.values(WORLD.fish)) {
        // 会预判的人：看绿条的速度提前松手，最难的鱼也能七成钓上
        let caught = 0;
        for (let seed = 0; seed < 50; seed++) {
            const r = newReel(f, seed);
            for (let i = 0; i < 60 * 60 && !r.done; i++) stepReel(r, r.zone + r.zoneV * 0.35 < r.fish, 1 / 60);
            if (r.done === 'caught') caught++;
        }
        assert.ok(caught >= 35, `${f.name} 50 次只钓上 ${caught} 次`);
        const idle = newReel(f, 42);
        stepReel(idle, false, 60);
        assert.equal(idle.done, 'escaped', `${f.name} 不按也能钓上`);
    }
    const a = stepReel(newReel(WORLD.fish.liyu, 7), true, 2.5);
    const b = newReel(WORLD.fish.liyu, 7);
    for (let i = 0; i < 25; i++) stepReel(b, true, 0.1);
    assert.ok(Math.abs(a.fish - b.fish) < 1e-9 && Math.abs(a.progress - b.progress) < 1e-9, '帧率不同结果一样');
});

test('钓鱼：每天第一条翻倍，新品种记进图鉴', () => {
    const s = fresh();
    const g = s.gold;
    const a = landFish(s, WORLD, 'jiyu', T0);
    assert.deepEqual(a, { gold: 40, first: true, newSpecies: true });
    const b = landFish(s, WORLD, 'jiyu', T0 + HOUR);
    assert.deepEqual(b, { gold: 20, first: false, newSpecies: false });
    assert.equal(s.gold, g + 60);
    assert.equal(s.fishLog.jiyu, 2);
    assert.equal(landFish(s, WORLD, 'liyu', T0 + DAY).first, true, '第二天又翻倍');
    assert.deepEqual(fishDexProgress(s, WORLD), [2, Object.keys(WORLD.fish).length]);
});

test('摆摊：点对挣钱连对加成，点错断连，顾客等太久就走，到点收摊', () => {
    const s = fresh();
    const r = newMarket(s, WORLD, T0, 'sunny', 123);
    assert.equal(r.goods.length, WORLD.market.goods);
    assert.equal(new Set(r.goods).size, r.goods.length);
    const want = wantOf(r);
    const p = priceOf(WORLD, want);
    const g0 = s.gold;
    assert.equal(serve(s, WORLD, r, want, 0.5), Math.ceil(p * WORLD.market.priceRate));
    assert.equal(s.gold, g0 + r.earned, '卖一单当场到账');
    const want2 = wantOf(r);
    const got2 = serve(s, WORLD, r, want2, 1);
    assert.equal(got2, Math.ceil(priceOf(WORLD, want2) * WORLD.market.priceRate * (1 + WORLD.market.streakStep)));
    const wrong = r.goods.find((g) => g !== wantOf(r))!;
    assert.equal(serve(s, WORLD, r, wrong, 1.5), 0);
    assert.equal(r.streak, 0);
    const idx = r.idx;
    advanceMarket(WORLD, r, 1.5 + patienceOf(WORLD, r) + 0.01);
    assert.equal(r.idx, idx + 1, '没耐心走了');
    assert.equal(r.missed, 2);
    advanceMarket(WORLD, r, WORLD.market.roundSec);
    assert.equal(r.over, true);
    assert.equal(serve(s, WORLD, r, wantOf(r), WORLD.market.roundSec + 1), 0);
    assert.equal(s.gold, g0 + r.earned);
});

test('摆摊：每天能摆 3 轮，第二天重新算', () => {
    const s = fresh();
    for (let k = 0; k < 3; k++) {
        assert.equal(roundsLeft(s, WORLD, T0), 3 - k);
        openMarket(s, T0);
    }
    assert.equal(roundsLeft(s, WORLD, T0), 0);
    assert.equal(roundsLeft(s, WORLD, T0 + DAY), 3);
});

test('存档：第 3 版读进来补上空图鉴和每日记录', () => {
    const v3 = JSON.parse(serialize(fresh()));
    v3.version = 3;
    delete v3.fishLog;
    delete v3.daily;
    const s = deserialize(JSON.stringify(v3), WORLD);
    assert.equal(s.version, SAVE_VERSION);
    assert.deepEqual(s.fishLog, {});
    assert.equal(landFish(s, WORLD, 'jiyu', T0).first, true);
});
