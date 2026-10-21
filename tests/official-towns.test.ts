import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { OFFICIAL_TOWNS, TOWN_TOURS, townChoices } from '../assets/scripts/data/townPlaces';
import { REGIONS } from '../assets/scripts/data/regions';

const MAPS = join(__dirname, '..', 'assets', 'resources', 'maps');

test('官方小镇：每座都是登记过的地域，地图和逛逛路线都有', () => {
    assert.ok(OFFICIAL_TOWNS.length >= 2);
    for (const id of OFFICIAL_TOWNS) {
        const r = REGIONS[id];
        assert.ok(r, `${id} 不是地域`);
        for (const ext of ['tmx', 'places.json', 'walkers.json']) {
            assert.ok(existsSync(join(MAPS, `${r.map}.${ext}`)), `${r.map}.${ext} 没生成`);
        }
        assert.ok(TOWN_TOURS[r.map]?.length, `${r.map} 没写逛逛路线`);
    }
});

test('选镇子：老家排第一，每座镇子只出现一次', () => {
    assert.deepEqual(townChoices('western'), ['western', 'jiangnan']);
    assert.deepEqual(townChoices('jiangnan'), ['jiangnan', 'western']);
    // 老家还没做镇子（如岭南）：照原顺序列出全部
    assert.deepEqual(townChoices('lingnan'), OFFICIAL_TOWNS);
});
