import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayKey, startOfDay, DAY } from '../assets/scripts/core/time';
import { solarTermAt } from '../assets/scripts/core/calendar';
import { weatherOn, isWetWeather } from '../assets/scripts/core/weather';
import { bj } from './util';

test('日期按北京时间切日', () => {
    assert.equal(dayKey(Date.UTC(2026, 9, 15, 16, 30)), '2026-10-16');
    assert.equal(dayKey(Date.UTC(2026, 9, 15, 15, 59)), '2026-10-15');
    assert.equal(startOfDay(bj(2026, 10, 16, 15, 20)), bj(2026, 10, 16));
});

test('节气和季节', () => {
    assert.deepEqual(solarTermAt(bj(2026, 10, 16)), { index: 18, name: '寒露', season: 'autumn' });
    assert.equal(solarTermAt(bj(2026, 1, 2)).name, '冬至');
    assert.equal(solarTermAt(bj(2026, 1, 2)).season, 'winter');
    assert.equal(solarTermAt(bj(2026, 2, 3, 23)).season, 'winter');
    assert.equal(solarTermAt(bj(2026, 2, 4)).name, '立春');
    assert.equal(solarTermAt(bj(2026, 2, 4)).season, 'spring');
    assert.equal(solarTermAt(bj(2026, 11, 7)).season, 'winter');
});

test('同一天天气不变，冬天只下雪不下雨，雨雪比例合理', () => {
    assert.equal(weatherOn(bj(2026, 10, 16, 1)), weatherOn(bj(2026, 10, 16, 23)));
    let wet = 0;
    const start = bj(2027, 1, 1, 12);
    for (let i = 0; i < 365; i++) {
        const ms = start + i * DAY;
        const w = weatherOn(ms);
        if (isWetWeather(w)) wet += 1;
        if (solarTermAt(ms).season === 'winter') {
            assert.notEqual(w, 'rain');
        }
    }
    assert.ok(wet > 365 * 0.15 && wet < 365 * 0.4, `雨雪天数 ${wet}`);
});
