import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD } from './world';
import { newGame, serialize } from '../assets/scripts/core/game';
import { chooseStart, lastTickOf, makeServerSync, pickBackend, pickNewer, serverLogin } from '../assets/scripts/core/sync';
import { BACKEND } from '../assets/scripts/data/backend';
import { bj } from './util';

const T0 = bj(2026, 10, 20, 7);
const save = (t: number) => serialize(newGame(WORLD, t, 's', 'jiangnan'));

/** 假的 fetch：按顺序回 responses 里的状态和内容，记下每次请求。 */
function fakeFetch(responses: { status: number; body?: unknown }[] | ((i: number) => { status: number; body?: unknown })) {
    const calls: { url: string; method: string; headers: Record<string, string>; body?: any; keepalive?: boolean }[] = [];
    const fn = async (url: string, init: { method?: string; headers?: Record<string, string>; body?: string; keepalive?: boolean } = {}) => {
        const i = calls.length;
        calls.push({ url, method: init.method ?? 'GET', headers: init.headers ?? {},
            body: init.body ? JSON.parse(init.body) : undefined, keepalive: init.keepalive });
        const r = typeof responses === 'function' ? responses(i) : responses[i] ?? { status: 200, body: {} };
        return { status: r.status, ok: r.status >= 200 && r.status < 300, json: async () => r.body ?? {} };
    };
    return { fn, calls };
}

const tickNow = () => new Promise((r) => setImmediate(r));

test('后端按平台选：网页走服务器、微信走云开发，调试可覆盖', () => {
    assert.equal(pickBackend('web', BACKEND), 'server');
    assert.equal(pickBackend('wechat', BACKEND), 'wxcloud');
    assert.equal(pickBackend('other', BACKEND), 'local');
    assert.equal(pickBackend('web', BACKEND, 'local'), 'local');
    assert.equal(pickBackend('web', BACKEND, 'bogus'), 'server');
});

test('开局用哪份存档：服务器更靠后用服务器的；没连上又没缓存就重试', () => {
    const local = save(T0);
    assert.equal(lastTickOf(local), T0);
    assert.equal(lastTickOf('坏的'), 0);
    assert.equal(lastTickOf(null), 0);
    const newer = { json: save(T0 + 1000), lastTick: T0 + 1000 };
    assert.equal(pickNewer(local, newer), newer.json);
    assert.equal(pickNewer(local, { json: save(T0 - 1), lastTick: T0 - 1 }), local);
    assert.equal(pickNewer(null, null), null);
    assert.deepEqual(chooseStart(null, null), { save: null }, '服务器上没有 = 新玩家');
    assert.deepEqual(chooseStart(null, newer), { save: newer.json }, '换手机：用服务器的');
    assert.equal(chooseStart(null, 'failed'), 'retry', '没连上不能开新局，会盖掉服务器上的档');
    assert.deepEqual(chooseStart(local, 'failed'), { save: local }, '有缓存先玩缓存');
});

test('输邀请码：成功拿会话，错了、限速、断网给中文提示', async () => {
    const ok = fakeFetch([{ status: 200, body: { token: 't1', player: { id: 'p1', note: '小明' } } }]);
    assert.deepEqual(await serverLogin('https://x', ' ab ', ok.fn), { token: 't1', playerId: 'p1', note: '小明' });
    assert.equal(ok.calls[0].url, 'https://x/api/login');
    assert.deepEqual(ok.calls[0].body, { code: ' ab ' });
    const bad = fakeFetch([{ status: 401, body: { error: '邀请码不对' } }]);
    assert.deepEqual(await serverLogin('', 'x', bad.fn), { error: '邀请码不对' });
    const slow = fakeFetch([{ status: 429 }]);
    assert.match((await serverLogin('', 'x', slow.fn) as { error: string }).error, /等一分钟/);
    const down = async () => { throw new Error('offline'); };
    assert.match((await serverLogin('', 'x', down) as { error: string }).error, /连不上/);
});

test('服务器同步：拉档分得清没有和没连上；会话失效会通知', async () => {
    const f = fakeFetch([
        { status: 200, body: { json: null, lastTick: 0 } },
        { status: 200, body: { json: 'J', lastTick: 5 } },
        { status: 500 },
        { status: 401 },
    ]);
    let lost = 0;
    const s = makeServerSync({ base: '', token: 'tok', fetch: f.fn, pushEverySec: 30, onAuthLost: () => lost++ });
    assert.equal(await s.load(), null);
    assert.deepEqual(await s.pull(), { json: 'J', lastTick: 5 });
    assert.equal(await s.load(), 'failed');
    assert.equal(await s.pull(), null);
    assert.equal(lost, 1);
    assert.equal(f.calls[0].headers.Authorization, 'Bearer tok');
});

test('服务器同步：在线时 30 秒推一次、写的时候来的合并成最后一份；切后台马上推', async () => {
    let now = T0;
    const f = fakeFetch(() => ({ status: 200, body: { lastTick: 0 } }));
    const s = makeServerSync({ base: '', token: 't', fetch: f.fn, pushEverySec: 30, now: () => now });
    const st = newGame(WORLD, T0, 's', 'jiangnan');
    s.push(st);
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].method, 'PUT');
    assert.equal(JSON.parse(f.calls[0].body.json).lastTick, T0);
    await tickNow();
    now += 10_000;
    s.push(st);
    assert.equal(f.calls.length, 1, '不到 30 秒不推');
    now += 25_000;
    st.lastTick = now;
    s.push(st);
    assert.equal(f.calls.length, 2);
    await tickNow();
    assert.equal(s.pending, false);
    now += 1000;
    st.lastTick = now;
    s.flush!(st);
    assert.equal(f.calls.length, 3);
    assert.equal(f.calls[2].keepalive, true, '关页面时也能发出去');
    assert.equal(JSON.parse(f.calls[2].body.json).lastTick, now);
});

test('服务器同步：上一次还没写完就排队，只发最新那份；409 不报错，401 通知', async () => {
    let release: () => void = () => {};
    let n = 0;
    const calls: number[] = [];
    let lost = 0;
    const fetchFn = async (_url: string, init: { body?: string } = {}) => {
        calls.push(JSON.parse(JSON.parse(init.body!).json).lastTick);
        const i = n++;
        if (i === 0) await new Promise<void>((r) => { release = r; });
        const status = i === 1 ? 409 : i === 2 ? 401 : 200;
        return { status, ok: status === 200, json: async () => ({}) };
    };
    let now = T0;
    const s = makeServerSync({ base: '', token: 't', fetch: fetchFn, pushEverySec: 30, now: () => now, onAuthLost: () => lost++ });
    const st = newGame(WORLD, T0, 's', 'jiangnan');
    s.push(st);
    for (const dt of [31_000, 31_000]) {
        now += dt;
        st.lastTick = now;
        s.push(st);
    }
    assert.equal(calls.length, 1, '第一份还在路上');
    assert.equal(s.pending, true);
    release();
    await tickNow();
    await tickNow();
    assert.deepEqual(calls, [T0, now], '中间那份被合并掉');
    now += 31_000;
    st.lastTick = now;
    s.push(st);
    await tickNow();
    assert.equal(lost, 1);
});
