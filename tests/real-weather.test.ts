import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOpenMeteo, setRealWeather, tableOf, wmoWeather, openMeteoUrls } from '../assets/scripts/core/realWeather';
import { placeWeather, weatherOn } from '../assets/scripts/core/weather';
import { villagePlace } from '../assets/scripts/core/region';
import { newGame, serialize, deserialize, SAVE_VERSION } from '../assets/scripts/core/game';
import { simulate } from '../assets/scripts/core/simulate';
import { plant } from '../assets/scripts/core/farm';
import { PLACES, PLACE_ORDER } from '../assets/scripts/data/places';
import { REGIONS } from '../assets/scripts/data/regions';
import { WORLD } from '../assets/scripts/data/world';
import { HOUR } from '../assets/scripts/core/time';
import { bj } from './util';

test('地点表：坐标、时区像样，每个地域都绑了原型地点', () => {
    assert.equal(PLACE_ORDER.length, Object.keys(PLACES).length, '地点 id 重复');
    for (const p of Object.values(PLACES)) {
        assert.ok(Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180, `${p.id} 坐标不对`);
        assert.match(p.tz, /^[A-Z][a-z]+\/[A-Za-z_]+$/, `${p.id} 时区不对`);
    }
    for (const r of Object.values(REGIONS)) assert.ok(r.origin && PLACES[r.origin], `${r.id} 没绑原型地点`);
    assert.equal(REGIONS.western.origin, 'tombstone');
});

test('天气代码：雪、雨、沙尘暴、晴、多云', () => {
    assert.equal(wmoWeather(73, 3, null), 'snow');
    assert.equal(wmoWeather(61, 5, 400), 'rain', '下了雨就不算沙尘暴');
    assert.equal(wmoWeather(53, 0.1, null), 'cloudy', '毛毛雨没下够算阴天');
    assert.equal(wmoWeather(3, 0, 800), 'dust');
    assert.equal(wmoWeather(1, 0, 40), 'sunny');
    assert.equal(wmoWeather(3, 0, null), 'cloudy');
});

test('Open-Meteo 回包：按地点拼成每天一行，沙尘取当天最高值', () => {
    const places = [PLACES.suzhou, PLACES.tombstone];
    const forecast = [
        { daily: { time: ['2026-10-20', '2026-10-21'], weather_code: [53, 0], precipitation_sum: [4.3, 0] } },
        { daily: { time: ['2026-10-20', '2026-10-21'], weather_code: [3, 1], precipitation_sum: [0, 0] } },
    ];
    const air = [
        { hourly: { time: ['2026-10-20T00:00', '2026-10-21T00:00'], dust: [5, 6] } },
        { hourly: { time: ['2026-10-20T00:00', '2026-10-20T15:00', '2026-10-21T00:00'], dust: [20, 900, 30] } },
    ];
    const t = tableOf(parseOpenMeteo(places, forecast, air));
    assert.deepEqual(t, {
        suzhou: { '2026-10-20': 'rain', '2026-10-21': 'sunny' },
        tombstone: { '2026-10-20': 'dust', '2026-10-21': 'sunny' },
    });
    // 空气质量没拉到：不判沙尘暴；只查一个地点时回包是对象
    assert.deepEqual(parseOpenMeteo([PLACES.tombstone], forecast[1], null).map((r) => r.weather), ['cloudy', 'sunny']);
    const u = openMeteoUrls(places, 7);
    assert.match(u.forecast, /latitude=31\.3,31\.71&longitude=120\.62,-110\.07&timezone=Asia%2FShanghai,America%2FPhoenix&past_days=7/);
});

test('现实天气优先，查不到退回地域随机天气', () => {
    const day = bj(2026, 10, 21, 12);
    setRealWeather({ tombstone: { '2026-10-21': 'dust' } });
    try {
        assert.equal(placeWeather(day, REGIONS.western, 'tombstone'), 'dust');
        assert.equal(placeWeather(day + 24 * HOUR, REGIONS.western, 'tombstone'), weatherOn(day + 24 * HOUR, REGIONS.western));
        assert.equal(placeWeather(day, REGIONS.western, ''), weatherOn(day, REGIONS.western));
    } finally {
        setRealWeather({});
    }
});

test('村庄地点：没选跟老家原型地点；存档第 6 版读进来补上', () => {
    const s = newGame(WORLD, bj(2026, 10, 21, 8), 'p1', 'jiangnan');
    assert.equal(villagePlace(WORLD, s), 'suzhou');
    s.place = 'beijing';
    assert.equal(villagePlace(WORLD, s), 'beijing');
    const old = JSON.parse(serialize(s));
    delete old.place;
    old.version = 6;
    const back = deserialize(JSON.stringify(old), WORLD);
    assert.equal(back.place, '');
    assert.equal(back.version, SAVE_VERSION);
});

test('沙尘暴：作物当天不长、浇的水被吹干；第二天照常长', () => {
    const t0 = bj(2026, 7, 10, 8);
    const s = newGame(WORLD, t0, 'p2', 'western');
    s.place = 'tombstone';
    s.plots = [{ state: 'empty', cropId: null, growth: 0, wetUntil: 0, harvests: 0 }];
    s.gold = 1000;
    s.inventory = { 'seed:corn': 1 };
    assert.ok(plant(s, WORLD, 0, 'corn', t0).ok);
    s.plots[0].wetUntil = t0 + 12 * HOUR;
    setRealWeather({ tombstone: { '2026-07-10': 'dust', '2026-07-11': 'sunny' } });
    try {
        simulate(s, WORLD, t0 + 6 * HOUR);
        assert.equal(s.plots[0].growth, 0, '沙尘暴那天不该长');
        assert.ok(s.plots[0].wetUntil <= t0 + 6 * HOUR, '浇的水应该被吹干');
        simulate(s, WORLD, bj(2026, 7, 11, 10));
        assert.ok(s.plots[0].growth > 0, '第二天应该接着长');
    } finally {
        setRealWeather({});
    }
});
