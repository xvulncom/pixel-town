import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildWestern, WESTERN_H, WESTERN_W } from '../tools/maps/western';
import { TOWN_PLACES, TOWN_TOURS } from '../assets/scripts/data/townPlaces';
import { REGIONS } from '../assets/scripts/data/regions';
import { EMPTY } from '../tools/art/canvas';

const map = buildWestern();
const MAPS = join(__dirname, '..', 'assets', 'resources', 'maps');

test('西部牛仔镇：160×120，地点都有名字和介绍，逛逛去的地方都在图上', () => {
    assert.equal(map.w, WESTERN_W);
    assert.equal(map.h, WESTERN_H);
    assert.ok(WESTERN_W >= 160 && WESTERN_H >= 120);
    const ids = map.places.map((p) => p.id);
    for (const id of ids) assert.ok(TOWN_PLACES[id], `${id} 没写在 data/townPlaces.ts`);
    assert.ok(TOWN_TOURS.western?.length, 'TOWN_TOURS 里没有 western');
    for (const id of TOWN_TOURS.western) assert.ok(ids.includes(id), `逛逛要去的 ${id} 不在地图上`);
    for (const p of map.places) assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= map.w && p.y + p.h <= map.h, `${p.id} 出界`);
});

test('西部牛仔镇：登记成地域，地图文件在仓库里', () => {
    const r = REGIONS.western;
    assert.ok(r, 'data/regions.ts 里没有 western');
    assert.equal(r.map, 'western');
    assert.equal(r.climate.snow, false);
    assert.ok(existsSync(join(MAPS, `${r.map}.tmx`)), `${r.map}.tmx 没生成`);
});

test('西部牛仔镇：走动的人脚下不压东西，路线横平竖直', () => {
    for (const wk of map.walkers) {
        wk.path.forEach(([x, y], i) => {
            assert.ok(x >= 0 && y >= 0 && x < map.w && y < map.h, `${wk.id} 出界`);
            assert.equal(map.deco[y * map.w + x], EMPTY, `${wk.id} 的第 ${i} 个点 (${x},${y}) 压在东西上`);
            if (i > 0) {
                const [px, py] = wk.path[i - 1];
                assert.ok(px === x || py === y, `${wk.id} 第 ${i} 段是斜的`);
            }
        });
    }
});

test('西部牛仔镇：主角落脚点能走', () => {
    const [x, y] = map.spawn;
    assert.equal(map.walk.length, map.h);
    assert.equal(map.walk[y][x], '.', `落脚点 (${x},${y}) 被挡住`);
});

test('西部牛仔镇：用自己的图块集，仓库里的 json 是最新生成的', () => {
    const tmx = readFileSync(join(MAPS, 'western.tmx'), 'utf8');
    assert.match(tmx, /<image source="western-tiles\.png"/);
    assert.ok(existsSync(join(MAPS, 'western-tiles.png')));
    const read = (f: string) => JSON.parse(readFileSync(join(MAPS, f), 'utf8'));
    assert.deepEqual(read('western.places.json'), map.places, '改了布局要重跑 npx tsx tools/gen-map.ts');
    assert.deepEqual(read('western.walkers.json'), map.walkers, '改了布局要重跑 npx tsx tools/gen-map.ts');
    assert.deepEqual(read('western.walk.json'), { spawn: map.spawn, rows: map.walk },'改了布局要重跑 npx tsx tools/gen-map.ts');
});
