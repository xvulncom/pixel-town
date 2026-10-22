import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CULL_MARGIN, minMapZoom } from '../assets/scripts/core/screen';

const cells = (visW: number, visH: number, z: number) => (visW / 16 / z + CULL_MARGIN) * (visH / 16 / z + CULL_MARGIN);

test('地图比屏幕大很多时，最小缩放就是下限', () => {
    assert.equal(minMapZoom({ visW: 720, visH: 1280, mapW: 2560, mapH: 1920, floor: 1 }), 1);
});

test('地图小时最小缩放要铺满屏幕', () => {
    const z = minMapZoom({ visW: 720, visH: 1280, mapW: 576, mapH: 704, floor: 1 });
    assert.equal(z, 1280 / 704);
});

test('一屏格子数超出缓冲时抬高最小缩放，刚好卡在上限', () => {
    // 超宽桌面浏览器：设计高 720、宽 2560，1 倍时一屏 164×49 格，超过 7000
    const l = { visW: 2560, visH: 720, mapW: 2560, mapH: 1920, floor: 1, tile: 16, maxCells: 7000 };
    assert.ok(cells(2560, 720, 1) > 7000);
    const z = minMapZoom(l);
    assert.ok(z > 1);
    assert.ok(Math.abs(cells(2560, 720, z) - 7000) < 1e-6);
});

test('普通手机竖屏横屏 1 倍时都在缓冲以内，不受影响', () => {
    for (const [w, h] of [[720, 1560], [1560, 720], [720, 960]]) {
        assert.equal(minMapZoom({ visW: w, visH: h, mapW: 2560, mapH: 1920, floor: 1, tile: 16, maxCells: 7000 }), 1);
    }
});
