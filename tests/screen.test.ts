import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EAR_MIN_H, hudLayout, ScreenInsets } from '../assets/scripts/core/screen';

// iPhone 14 Pro：393×852pt，安全区顶 59、底 34，胶囊约 (301,62)-(388,94)。设计宽 720，换算 720/393
const k = 720 / 393;
const iphonePro: ScreenInsets = {
    width: 720,
    height: 852 * k,
    safeTop: 59 * k,
    safeBottom: 34 * k,
    capsule: { left: 301 * k, top: 62 * k, right: 388 * k, bottom: 94 * k },
};

test('灵动岛：两侧放信息，主行在安全区下面，按钮让开胶囊，底栏让开横条', () => {
    const l = hudLayout(iphonePro);
    assert.ok(l.ears);
    assert.equal(l.ears.bottom, iphonePro.safeTop);
    // 灵动岛约在 133～260pt，两侧空档不能碰到
    assert.ok(l.ears.left[1] <= 133 * k);
    assert.ok(l.ears.right[0] >= 260 * k);
    assert.ok(l.row.top >= iphonePro.safeTop);
    assert.ok(l.row.right <= iphonePro.capsule!.left);
    assert.ok(l.height > l.row.bottom);
    assert.equal(l.bottomPad, iphonePro.safeBottom);
});

test('普通屏：没有两侧空档，主行贴顶；网页上没胶囊，按钮靠右', () => {
    const l = hudLayout({ width: 720, height: 1280, safeTop: 0, safeBottom: 0, capsule: null });
    assert.equal(l.ears, null);
    assert.equal(l.row.top, 0);
    assert.equal(l.row.right, 720 - 16);
    assert.equal(l.bottomPad, 0);
    const android = hudLayout({ width: 720, height: 1560, safeTop: EAR_MIN_H - 1, safeBottom: 0, capsule: { left: 560, top: 70, right: 700, bottom: 128 } });
    assert.equal(android.ears, null);
    assert.ok(android.row.top <= 70 && android.row.bottom >= 128, '主行把胶囊那一段盖住，按钮和胶囊在同一行');
    assert.ok(android.row.top >= EAR_MIN_H - 1);
});
