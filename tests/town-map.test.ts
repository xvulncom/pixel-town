import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildJiangnan, JIANGNAN_H, JIANGNAN_W } from '../tools/maps/jiangnan';
import { TOWN_PLACES, TOWN_TOUR } from '../assets/scripts/data/townPlaces';
import { EMPTY } from '../tools/art/canvas';

const map = buildJiangnan();
const MAPS = join(__dirname, '..', 'assets', 'resources', 'maps');

test('江南镇子：160×120，地点都有名字和介绍，逛逛去的地方都在图上', () => {
    assert.equal(map.w, JIANGNAN_W);
    assert.equal(map.h, JIANGNAN_H);
    assert.ok(JIANGNAN_W >= 160 && JIANGNAN_H >= 120);
    const ids = map.places.map((p) => p.id);
    for (const id of ids) assert.ok(TOWN_PLACES[id], `${id} 没写在 data/townPlaces.ts`);
    for (const id of TOWN_TOUR) assert.ok(ids.includes(id), `逛逛要去的 ${id} 不在地图上`);
    for (const p of map.places) assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= map.w && p.y + p.h <= map.h, `${p.id} 出界`);
});

test('江南镇子：走动的人脚下不压东西，路线横平竖直', () => {
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

test('江南镇子：仓库里的 places.json、walkers.json 是最新生成的', () => {
    const places = JSON.parse(readFileSync(join(MAPS, 'jiangnan.places.json'), 'utf8'));
    const walkers = JSON.parse(readFileSync(join(MAPS, 'jiangnan.walkers.json'), 'utf8'));
    assert.deepEqual(places, map.places, '改了布局要重跑 npx tsx tools/gen-map.ts');
    assert.deepEqual(walkers, map.walkers, '改了布局要重跑 npx tsx tools/gen-map.ts');
});
