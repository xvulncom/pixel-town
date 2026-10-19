import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD as FARM } from './world';
import { WORLD as REAL } from '../assets/scripts/data/world';
import { World } from '../assets/scripts/core/defs';
import { deserialize, newGame, serialize, START_GOLD } from '../assets/scripts/core/game';
import { simulate } from '../assets/scripts/core/simulate';
import { DAY, HOUR, MINUTE } from '../assets/scripts/core/time';
import { GameState } from '../assets/scripts/core/types';
import {
    accepts, candidatesToday, fire, hire, housingCap, pieceWage, rumorOf, sendErrand, setOffer, slackChance,
} from '../assets/scripts/core/workers';
import { bj, sunny } from './util';

// 招工处每天把所有人都放出来，测试不受当天抽到谁影响
const WORLD: World = { ...FARM, hiring: { ...FARM.hiring, dailyCandidates: 99 } };
const T0 = bj(2026, 10, 20, 6);

function fresh(gold = 2000): GameState {
    const s = newGame(WORLD, T0, 'w-test', 'jiangnan');
    s.gold = gold;
    s.farmSeed = 'radish';
    return s;
}

const run = (s: GameState, to: number) => simulate(s, WORLD, to, { weather: sunny });

test('开局只有自己和起始资金：空地、没有菜地、没有工人', () => {
    const s = newGame(REAL, T0, 'x', 'jiangnan');
    assert.equal(s.village.items.length, 0);
    assert.equal(s.plots.length, 0);
    assert.equal(s.gold, START_GOLD);
    assert.equal(s.workers.length, 0);
    assert.equal(housingCap(s, REAL), 0);
});

test('招工处：每天来几个人，同一天看到的一样，雇了的不再出现', () => {
    const s = newGame(REAL, T0, 'x', 'jiangnan');
    const a = candidatesToday(s, REAL, T0);
    assert.equal(a.length, REAL.hiring.dailyCandidates);
    assert.deepEqual(candidatesToday(s, REAL, T0 + 3 * HOUR), a);
    s.village.items.push({ uid: 999, def: 'house', x: 0, y: 0 });
    assert.ok(hire(s, REAL, a[0], 'day', 'high', T0, 'self').ok);
    assert.ok(!candidatesToday(s, REAL, T0).includes(a[0]));
    const other = Object.keys(REAL.workers).find((id) => !candidatesToday(s, REAL, T0).includes(id) && id !== a[0]);
    if (other) assert.equal(hire(s, REAL, other, 'day', 'fair', T0, 'self').ok, false, '没来的人雇不了');
});

test('雇人：要有住处，心气高的人不接受压价', () => {
    const s = fresh();
    assert.equal(housingCap(s, WORLD), 2, '一户民居住两个');
    const r = hire(s, WORLD, 'liushen', 'day', 'low', T0, 'self');
    assert.equal(r.ok, false);
    assert.match((r as { reason: string }).reason, /嫌钱少/);
    assert.ok(hire(s, WORLD, 'liushen', 'day', 'fair', T0, 'self').ok);
    assert.ok(hire(s, WORLD, 'erleng', 'day', 'low', T0, 'self').ok, '二愣不挑');
    const full = hire(s, WORLD, 'xiaofang', 'day', 'fair', T0, 'self');
    assert.match((full as { reason: string }).reason, /住处满了/);
    assert.equal(s.gold, 2000, '签约不扣钱');
});

test('工人上工：种、浇、收都干，下工时扣日薪，金币只因买种子、卖菜、发工钱变', () => {
    const s = fresh();
    assert.ok(hire(s, WORLD, 'xiaofang', 'day', 'fair', T0, 'self').ok);
    run(s, bj(2026, 10, 20, 16, 59));
    const w = s.workers[0];
    assert.ok(w.today.done > 0);
    assert.equal(w.today.paid, 0, '还没下工');
    assert.ok(w.today.done >= s.plots.length, '一块块都种上了');
    assert.ok(s.plots.some((p) => p.state !== 'empty'));
    const before = s.gold;
    run(s, bj(2026, 10, 20, 17));
    assert.equal(w.today.paid, w.wage);
    assert.equal(s.gold, before - w.wage);
    assert.equal(w.doing === 'off' || w.doing === 'work' || w.doing === 'idle', true);
    run(s, bj(2026, 10, 20, 23));
    assert.equal(s.workers[0].doing, 'off');
});

test('不懒加载也不怕：一次推进和分很多次推进结果完全一样', () => {
    const a = fresh();
    const b = fresh();
    for (const s of [a, b]) {
        hire(s, WORLD, 'aqiang', 'day', 'fair', T0, 'self');
        hire(s, WORLD, 'erleng', 'piece', 'fair', T0, 'self');
    }
    const end = T0 + 2 * DAY + 7 * MINUTE;
    run(a, end);
    for (let t = T0 + 37 * 1000; t < end; t += 7 * MINUTE + 13 * 1000) run(b, t);
    run(b, end);
    assert.equal(serialize(a), serialize(b));
});

test('偷懒：压价、没人看着、心情差都更懒，计件几乎不偷懒', () => {
    const s = fresh();
    hire(s, WORLD, 'aqiang', 'day', 'fair', T0, 'self');
    const w = s.workers[0];
    const def = WORLD.workers.aqiang;
    const t = T0 + 3 * HOUR;
    const base = slackChance(s, WORLD, w, def, t);
    assert.ok(slackChance(s, WORLD, { ...w, rate: 0.8 }, def, t) > base);
    assert.ok(slackChance(s, WORLD, { ...w, rate: 1.25 }, def, t) < base);
    assert.ok(slackChance(s, WORLD, { ...w, pay: 'piece' }, def, t) < base / 2);
    assert.ok(slackChance(s, WORLD, { ...w, morale: 10 }, def, t) > base);
    s.lastSeen = t;
    assert.ok(slackChance(s, WORLD, w, def, t) < base, '开着游戏看着');
});

test('有人看着时偷懒少，而且偷懒会记进动态；没人看着时动态里看不到', () => {
    const seen = fresh();
    const away = fresh();
    for (const s of [seen, away]) hire(s, WORLD, 'erleng', 'day', 'fair', T0, 'self');
    seen.lastSeen = T0 + 10 * DAY;
    run(seen, bj(2026, 10, 20, 18));
    run(away, bj(2026, 10, 20, 18));
    const slack = (s: GameState) => s.workers[0]?.today.slackMin ?? 0;
    assert.ok(slack(seen) < slack(away));
    assert.ok(seen.workerLog.some((e) => /打盹/.test(e.text)));
    assert.ok(!away.workerLog.some((e) => /打盹/.test(e.text)));
});

test('欠薪：钱不够就欠着，下次先补，连欠两次走人', () => {
    const s = fresh(0);
    s.farmSeed = '';
    hire(s, WORLD, 'xiaofang', 'day', 'fair', T0, 'self');
    run(s, bj(2026, 10, 20, 17));
    assert.equal(s.workers[0].owed, s.workers[0].wage);
    assert.equal(s.workers[0].unpaid, 1);
    s.gold = 10;
    assert.equal(fire(s, WORLD, 'xiaofang', bj(2026, 10, 20, 18)).ok, false, '欠着钱辞不了');
    run(s, bj(2026, 10, 21, 17));
    assert.equal(s.workers.length, 0);
    assert.ok(s.workerLog.some((e) => /不干了/.test(e.text)));
});

test('计件：每干一件当场付钱，活太少心情变差', () => {
    const s = fresh();
    hire(s, WORLD, 'xiaofang', 'piece', 'fair', T0, 'self');
    const w = s.workers[0];
    assert.equal(w.wage, pieceWage(WORLD, WORLD.workers.xiaofang));
    run(s, bj(2026, 10, 20, 12));
    assert.equal(w.today.paid, w.today.done * w.wage);
    const m = w.morale;
    s.farmSeed = '';
    run(s, bj(2026, 10, 21, 17));
    assert.ok(s.workers[0].morale <= m || s.workers[0].today.paid >= WORLD.workers.xiaofang.ask * WORLD.hiring.pieceFairRatio);
});

test('调薪：加价心情涨，降到他不接受就走人', () => {
    const s = fresh();
    hire(s, WORLD, 'liushen', 'day', 'fair', T0, 'self');
    const m = s.workers[0].morale;
    assert.ok(setOffer(s, WORLD, 'liushen', 'high', T0).ok);
    assert.ok(s.workers[0].morale > m);
    assert.equal(s.workers[0].wage, Math.round(WORLD.workers.liushen.ask * 1.25));
    setOffer(s, WORLD, 'liushen', 'low', T0);
    assert.equal(s.workers.length, 0);
});

test('助理跑招工处：路上要时间，带回名单和评价，凭名单远程签约', () => {
    const s = fresh();
    const t = bj(2026, 10, 20, 10);
    assert.equal(hire(s, WORLD, 'aqiang', 'day', 'fair', t, 'assistant').ok, false, '没名单');
    hire(s, WORLD, 'xiaowen', 'day', 'fair', t, 'self');
    assert.equal(sendErrand(s, WORLD, 'aqiang', t).ok, false);
    assert.ok(sendErrand(s, WORLD, 'xiaowen', t).ok);
    assert.equal(sendErrand(s, WORLD, 'xiaowen', t).ok, false, '已经在路上');
    run(s, t + 20 * MINUTE);
    assert.equal(s.workers[0].doing, 'errand');
    assert.equal(s.hireReport, null);
    run(s, t + 2 * HOUR);
    const rep = (s as GameState).hireReport;
    assert.ok(rep);
    assert.equal(rep.by, 'xiaowen');
    assert.ok(rep.candidates.length > 0);
    assert.notEqual(s.workers[0].doing, 'errand');
    const pick = rep.candidates.find((c) => accepts(WORLD.workers[c.id], 1))!.id;
    assert.ok(hire(s, WORLD, pick, 'day', 'fair', t + 2 * HOUR, 'assistant').ok);
    // 第二天名单就过期了
    s.workers = s.workers.filter((w) => w.id !== pick);
    assert.equal(hire(s, WORLD, pick, 'day', 'fair', t + DAY, 'assistant').ok, false);
});

test('口碑：眼力好说得准，眼力差可能看走眼', () => {
    const s = fresh();
    assert.match(rumorOf(s, WORLD, 'erleng', 1, 'a'), /爱偷懒/);
    assert.match(rumorOf(s, WORLD, 'xiaofang', 1, 'a'), /勤快/);
    const blind = Array.from({ length: 30 }, (_, i) => rumorOf(s, WORLD, 'erleng', 0, `b${i}`));
    assert.ok(blind.some((r) => !/爱偷懒/.test(r)), '眼力为 0 时会把懒汉看成勤快人');
});

test('存档：第 4 版读进来补上雇工字段，工人和跑腿都存得住', () => {
    const s = fresh();
    hire(s, WORLD, 'xiaowen', 'day', 'fair', bj(2026, 10, 20, 10), 'self');
    sendErrand(s, WORLD, 'xiaowen', bj(2026, 10, 20, 10));
    const back = deserialize(serialize(s), WORLD);
    assert.deepEqual(back.workers, s.workers);
    assert.deepEqual(back.errand, s.errand);
    const old = JSON.parse(serialize(s));
    for (const k of ['workers', 'farmSeed', 'lastSeen', 'errand', 'hireReport', 'workerLog']) delete old[k];
    old.version = 4;
    const v4 = deserialize(JSON.stringify(old), WORLD);
    assert.equal(v4.version, 5);
    assert.deepEqual(v4.workers, []);
    assert.equal(v4.errand, null);
});
