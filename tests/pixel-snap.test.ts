import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snapOffset, snapToGrid, snapZoom } from '../assets/scripts/core/screen';

const isInt = (v: number) => Math.abs(v - Math.round(v)) < 1e-6;

test('缩放取到一个美术像素占整数个物理像素', () => {
    // iPhone 竖屏：设计宽 720，物理宽 1179，r ≈ 1.6375
    const r = 1179 / 720;
    for (const z of [1, 1.7, 2.4, 3, 3.3, 5.9]) {
        const s = snapZoom(z, r, 1, 6);
        assert.ok(isInt(s * r), `${z} → ${s}`);
        // 在上下限档之间时取最近的一档；超出的夹到边上那档（1179/720 时是 2～9 个物理像素）
        const want = Math.min(9, Math.max(2, Math.round(z * r)));
        assert.equal(Math.round(s * r), want);
    }
});

test('取整后不低于下限（还能铺满屏幕），上限也不超', () => {
    const r = 1.5;
    const s = snapZoom(1.21, r, 1.21, 6);
    assert.ok(s >= 1.21);
    assert.ok(isInt(s * r));
    assert.ok(snapZoom(99, r, 1, 6) <= 6);
    // 下限比上限还大时取下限那档
    assert.ok(snapZoom(3, r, 7, 6) >= 7);
});

test('地图位置取整后地图边缘落在物理像素上（屏幕物理宽为奇数也一样）', () => {
    const r = 1179 / 720;
    for (const physW of [1179, 1170]) {
        const half = physW / 2;
        for (const p of [0, 0.3, -17.77, 123.456]) {
            const s = snapOffset(p, r, half);
            // 地图宽 160 格、3 个物理像素一美术像素时，左边缘的物理坐标
            const left = half + s * r - (160 * 16 * 3) / 2;
            assert.ok(isInt(left), `${physW} ${p} → ${left}`);
            assert.ok(Math.abs(s - p) * r <= 0.5 + 1e-6);
        }
    }
});

test('人物坐标取到物理像素格：慢慢走一步只挪一个物理像素', () => {
    const n = 3;
    const xs = [0, 0.1, 0.2, 0.34, 0.5, 0.7, 1];
    const snapped = xs.map((v) => snapToGrid(v, n) * n);
    snapped.forEach((v) => assert.ok(isInt(v)));
    for (let i = 1; i < snapped.length; i++) assert.ok(snapped[i] - snapped[i - 1] <= 1 + 1e-6);
    // 不到一个物理像素一美术像素时退回按地图像素取整
    assert.equal(snapToGrid(2.6, 0), 3);
});
