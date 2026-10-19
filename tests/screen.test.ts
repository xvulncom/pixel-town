import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EAR_MIN_H, hudLayout, orientationOf, ScreenInsets, screenLayout, SIDE_W } from '../assets/scripts/core/screen';

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

test('竖屏：建造栏贴底让开横条，地图在顶栏和建造栏之间', () => {
    const l = screenLayout(iphonePro, 330);
    assert.equal(l.orientation, 'portrait');
    assert.equal(l.panel.y + l.panel.h + l.hud.bottomPad, iphonePro.height);
    assert.equal(l.panel.w, 720);
    assert.equal(l.map.y, l.hud.height);
    assert.equal(l.map.y + l.map.h, l.panel.y);
});

test('横屏：顶栏不分两侧，建造栏在右边一列，让开侧边刘海', () => {
    // iPhone 14 Pro 横过来：852×393pt，左右安全区各 59，底 21；设计高 720
    const q = 720 / 393;
    const s: ScreenInsets = {
        width: 852 * q, height: 720, safeTop: 0, safeBottom: 21 * q, safeLeft: 59 * q, safeRight: 59 * q,
        capsule: { left: 700 * q, top: 8 * q, right: 787 * q, bottom: 40 * q },
    };
    const l = screenLayout(s, 330);
    assert.equal(l.orientation, 'landscape');
    assert.equal(l.hud.ears, null);
    assert.ok(l.hud.row.left >= 59 * q);
    assert.equal(l.panel.x + l.panel.w, s.width - 59 * q);
    assert.equal(l.panel.w, SIDE_W);
    assert.equal(l.panel.y, l.hud.height);
    assert.equal(l.panel.y + l.panel.h, 720 - 21 * q);
    assert.equal(l.map.w, l.panel.x);
    assert.ok(l.map.h > 500, '横屏地图还有足够高度');
    assert.equal(orientationOf(1561, 720), 'landscape');
    assert.equal(orientationOf(720, 1561), 'portrait');
});
