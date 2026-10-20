import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WORLD } from './world';
import { SAVE_VERSION, deserialize, newGame, serialize } from '../assets/scripts/core/game';
import {
    anchorFromCell, canPlace, E, N, newVillage, occupancy, place, removeAt, S, terrainGrid, terrainMask, W,
} from '../assets/scripts/core/village';
import { bj } from './util';

const T0 = bj(2026, 10, 18, 8);
const fresh = () => newGame(WORLD, T0, 'p', 'jiangnan');

test('地盘：开局送的布局都放得下，没有重叠', () => {
    const v = newVillage(WORLD);
    assert.equal(v.tier, 'village');
    assert.equal(v.items.length, WORLD.villageStarter.length);
    const o = occupancy(WORLD, v);
    const house = v.items.find((it) => it.def === 'house')!;
    assert.equal(o.objects[house.y * o.w + house.x], house.uid);
});

test('地盘：摆建筑扣钱，压到别的东西、出界、没解锁、钱不够都不行', () => {
    const s = fresh();
    const gold = s.gold;
    const r = place(WORLD, s, 'well', 1, 1);
    assert.equal(r.ok, true);
    assert.equal(s.gold, gold - WORLD.buildings.well.price);

    assert.deepEqual(canPlace(WORLD, s, 'jar', 2, 1), { ok: false, reason: '这里已经有东西了' });
    assert.deepEqual(canPlace(WORLD, s, 'well', 35, 0), { ok: false, reason: '超出地盘了' });
    assert.deepEqual(canPlace(WORLD, s, 'shop', 0, 3), { ok: false, reason: '小镇才能盖' });
    // 开局的土路上不能盖房
    assert.deepEqual(canPlace(WORLD, s, 'jar', 11, 18), { ok: false, reason: '不能盖在路上' });
    assert.deepEqual(canPlace(WORLD, s, 'road_dirt', 11, 18), { ok: false, reason: '这里已经铺过了' });
    s.gold = 0;
    assert.deepEqual(canPlace(WORLD, s, 'jar', 1, 5), { ok: false, reason: '金币不够' });
});

test('地盘：拆除先拆建筑再拆路，退一半钱', () => {
    const s = fresh();
    place(WORLD, s, 'road_dirt', 1, 1);
    const gold = s.gold;
    const r = removeAt(WORLD, s, 11, 14);
    assert.equal(r.ok && r.item.def, 'road_dirt');
    assert.equal(s.gold, gold + 1);
    const house = removeAt(WORLD, s, 10, 13);
    assert.equal(house.ok && house.item.def, 'house');
    assert.equal(s.gold, gold + 1 + 60);
    assert.deepEqual(removeAt(WORLD, s, 0, 0), { ok: false, reason: '这里没有东西' });
});

test('地盘：点到的格子落在占地最下一行正中', () => {
    assert.deepEqual(anchorFromCell(WORLD.buildings.house, 12, 20), [10, 19]);
    assert.deepEqual(anchorFromCell(WORLD.buildings.tree, 5, 5), [5, 5]);
    assert.deepEqual(anchorFromCell(WORLD.buildings.stall_fruit, 5, 5), [4, 5]);
});

test('地盘：路面四邻掩码，土路和石板路连着，菜地不连路', () => {
    const w = 3;
    const grid = [
        null, 'dirt', null,
        'soil', 'stone', 'dirt',
        null, 'soil', null,
    ] as const;
    const g = [...grid];
    assert.equal(terrainMask(g, w, 3, 1, 1), N | E);
    assert.equal(terrainMask(g, w, 3, 1, 0), S);
    assert.equal(terrainMask(g, w, 3, 0, 1), 0);
    const s = fresh();
    const t = terrainGrid(WORLD, s.village);
    assert.equal(t[14 * 36 + 11], 'dirt');
    assert.equal(terrainMask(t, 36, 44, 11, 15), N | E | S);
    assert.equal(W, 8);
});

test('存档：第 1 版存档读进来送开局地盘；删掉的建筑和越界的东西清掉', () => {
    const s = fresh();
    const v1 = JSON.parse(serialize(s));
    delete v1.village;
    v1.version = 1;
    const loaded = deserialize(JSON.stringify(v1), WORLD);
    assert.equal(loaded.version, SAVE_VERSION);
    assert.equal(loaded.village.items.length, WORLD.villageStarter.length);

    const bad = JSON.parse(serialize(s));
    bad.village.items.push({ uid: 999, def: 'ufo', x: 1, y: 1 }, { uid: 1000, def: 'well', x: 35, y: 0 });
    const fixed = deserialize(JSON.stringify(bad), WORLD);
    assert.equal(fixed.village.items.length, WORLD.villageStarter.length);
    assert.ok(fixed.village.nextUid >= 1001);
});

test('素材：每种建筑都有图，每种路面都有图块', () => {
    const dir = join(__dirname, '..', 'assets', 'resources', 'maps');
    const sprites = join(dir, 'buildings-frames.json');
    const terrain = join(dir, 'terrain.json');
    assert.ok(existsSync(sprites) && existsSync(terrain), '先跑 npx tsx tools/gen-map.ts');
    const frames = JSON.parse(readFileSync(sprites, 'utf8')).frames;
    const tiles = JSON.parse(readFileSync(terrain, 'utf8'));
    for (const def of Object.values(WORLD.buildings)) {
        if (def.kind === 'building') assert.ok(frames[def.sprite!], `缺图 ${def.sprite}`);
        else assert.equal(tiles[def.terrain!]?.length, 16, `缺路面 ${def.terrain}`);
    }
    assert.ok(tiles.grass.length > 0);
});
