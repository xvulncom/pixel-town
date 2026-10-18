import { test } from 'node:test';
import assert from 'node:assert/strict';
import { poseAt } from '../assets/scripts/core/walk';
import { tintAt } from '../assets/scripts/core/lighting';

const route = { path: [[0, 0], [4, 0], [4, 2]] as [number, number][], speed: 2, pause: 1 };

test('走路：去程按速度前进，拐弯换朝向', () => {
    assert.deepEqual(poseAt(route, 0), { x: 0, y: 0, dir: 'right', moving: true, frame: 0 });
    const p = poseAt(route, 1);
    assert.equal(p.x, 2);
    assert.equal(p.dir, 'right');
    const q = poseAt(route, 2.5);
    assert.equal(q.x, 4);
    assert.equal(q.y, 1);
    assert.equal(q.dir, 'down');
});

test('走路：到头停一下，再原路返回，朝向反过来', () => {
    const stop = poseAt(route, 3.5);
    assert.equal(stop.moving, false);
    assert.deepEqual([stop.x, stop.y], [4, 2]);
    const back = poseAt(route, 4.5);
    assert.equal(back.dir, 'up');
    assert.deepEqual([back.x, back.y], [4, 1]);
    // 一圈 = 去 3 秒 + 停 1 秒 + 回 3 秒 + 停 1 秒
    assert.deepEqual(poseAt(route, 8), poseAt(route, 0));
});

test('走路：只有一个点就站着', () => {
    assert.deepEqual(poseAt({ path: [[3, 5]], speed: 1 }, 10), { x: 3, y: 5, dir: 'down', moving: false, frame: 0 });
});

test('走路：迈步帧按走过的距离换', () => {
    const frames = [0, 0.125, 0.25, 0.375].map((s) => poseAt(route, s).frame);
    assert.deepEqual(frames, [0, 1, 0, 2]);
});

test('光照：白天不盖，夜里深蓝，傍晚偏暖', () => {
    assert.equal(tintAt(12).a, 0);
    assert.ok(tintAt(23).a > 0.3);
    assert.ok(tintAt(23).b > tintAt(23).r);
    const dusk = tintAt(17.5);
    assert.ok(dusk.a > 0 && dusk.r > dusk.b);
    // 跨午夜连续
    assert.deepEqual(tintAt(0), tintAt(24));
});
