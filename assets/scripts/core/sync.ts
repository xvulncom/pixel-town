// 存档同步：本机存储是主缓存（读写同步），后端是异步的一份，后端进程据此在玩家关着游戏时推进工人。
// 后端有两种实现，按平台选（配置在 data/backend.ts）：
//   wxcloud —— 微信云开发（game/CloudStore.ts），data/cloud.ts 的 env 为空就不用
//   server  —— 自建服务器（本文件 makeServerSync），接口见 ~/SERVER/像素小镇/server/app.ts
// 这里不 import cc，网页请求用注入的 fetch，方便测试。

import { toDoc } from './cloudTick';
import { GameState } from './types';

export interface CloudSync {
    /** 拉后端那份存档，没有或失败返回 null */
    pull(): Promise<{ json: string; lastTick: number } | null>;
    /** 推一份上去（太频繁的会合并） */
    push(state: GameState): void;
    /** 马上推，不管间隔（切到后台、关页面时） */
    flush?(state: GameState): void;
}

export type BackendKind = 'local' | 'wxcloud' | 'server';
export type Platform = 'web' | 'wechat' | 'other';

export interface BackendConfig {
    web: BackendKind;
    wechat: BackendKind;
    other: BackendKind;
    server: {
        /** 接口地址前缀；空串 = 和网页同源 */
        base: string;
        /** 在线时多久推一次（秒） */
        pushEverySec: number;
    };
}

/** 按平台选后端。override 是调试用的（网页里加载前设 window.__pixelTownBackend）。 */
export function pickBackend(platform: Platform, cfg: BackendConfig, override?: unknown): BackendKind {
    if (override === 'local' || override === 'server' || override === 'wxcloud') return override;
    return cfg[platform];
}

/** 本机缓存里那份的 lastTick；没有或读不了算 0。 */
export function lastTickOf(json: string | null): number {
    if (!json) return 0;
    try {
        const t = JSON.parse(json)?.lastTick;
        return typeof t === 'number' ? t : 0;
    } catch {
        return 0;
    }
}

/** 后端那份推进得更靠后就用后端的（玩家关着游戏时工人是在后端干的活）。 */
export function pickNewer(local: string | null, remote: { json: string; lastTick: number } | null): string | null {
    if (remote && remote.lastTick > lastTickOf(local)) return remote.json;
    return local;
}

/**
 * 打开游戏时用哪份存档。没连上服务器、本机也没有缓存时不能开新局（新局的 lastTick 更大，推上去会盖掉服务器上的老档），
 * 返回 'retry' 让玩家重试；本机有缓存就先玩缓存。
 */
export function chooseStart(local: string | null, remote: { json: string; lastTick: number } | null | 'failed'):
    { save: string | null } | 'retry' {
    if (remote === 'failed') return local ? { save: local } : 'retry';
    return { save: pickNewer(local, remote) };
}

type Fetch =(url: string, init?: {
    method?: string; headers?: Record<string, string>; body?: string; keepalive?: boolean;
}) => Promise<{ status: number; ok: boolean; json(): Promise<any> }>;

export interface Session {
    token: string;
    playerId: string;
    note: string;
}

/** 输邀请码换会话。 */
export async function serverLogin(base: string, code: string, fetchFn: Fetch): Promise<Session | { error: string }> {
    try {
        const r = await fetchFn(`${base}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
        });
        const body = await r.json().catch(() => ({}));
        if (r.ok && typeof body.token === 'string') {
            return { token: body.token, playerId: body.player?.id ?? '', note: body.player?.note ?? '' };
        }
        if (r.status === 429) return { error: '试得太快了，等一分钟再输' };
        return { error: body.error ?? `登录失败（${r.status}）` };
    } catch {
        return { error: '连不上服务器，检查网络' };
    }
}

export interface ServerSyncOptions {
    base: string;
    token: string;
    fetch: Fetch;
    pushEverySec: number;
    now?: () => number;
    /** 会话失效（邀请码被作废、换了库）：游戏要清掉会话重新输邀请码 */
    onAuthLost?: () => void;
}

/** 自建服务器版。写入是"lastTick 只能变大"：服务器那份更新时回 409，下次拉的时候换过来。 */
export interface ServerSync extends CloudSync {
    /** 有没有还没写完的 */
    readonly pending: boolean;
    /** 同 pull，但分得清"服务器上没有"（null）和"没连上"（'failed'）：没连上时不能当新玩家开局，否则会盖掉服务器上的档 */
    load(): Promise<{ json: string; lastTick: number } | null | 'failed'>;
}

export function makeServerSync(o: ServerSyncOptions): ServerSync {
    const now = o.now ?? Date.now;
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${o.token}` };
    let lastPush = -Infinity;
    let busy = false;
    let queued: string | null = null;

    const lost = () => o.onAuthLost?.();

    const send = async (json: string, keepalive = false) => {
        busy = true;
        try {
            const r = await o.fetch(`${o.base}/api/save`, {
                method: 'PUT', headers, body: JSON.stringify({ json }), keepalive,
            });
            if (r.status === 401) lost();
            else if (!r.ok && r.status !== 409) console.warn('存档写服务器失败', r.status, await r.json().catch(() => ''));
        } catch (e) {
            console.warn('存档写服务器失败', e);
        } finally {
            busy = false;
            if (queued) {
                const next = queued;
                queued = null;
                void send(next);
            }
        }
    };

    const enqueue = (state: GameState, keepalive: boolean) => {
        lastPush = now();
        const json = toDoc(state).json;
        if (busy && !keepalive) queued = json;
        else void send(json, keepalive);
    };

    const load = async (): Promise<{ json: string; lastTick: number } | null | 'failed'> => {
        try {
            const r = await o.fetch(`${o.base}/api/save`, { headers });
            if (r.status === 401) {
                lost();
                return 'failed';
            }
            if (!r.ok) return 'failed';
            const d = await r.json();
            return typeof d.json === 'string' ? { json: d.json, lastTick: d.lastTick } : null;
        } catch (e) {
            console.warn('存档读服务器失败', e);
            return 'failed';
        }
    };

    return {
        get pending() {
            return busy || queued !== null;
        },
        load,
        async pull() {
            const d = await load();
            return d === 'failed' ? null : d;
        },
        push(state) {
            if (now() - lastPush < o.pushEverySec * 1000) return;
            enqueue(state, false);
        },
        flush(state) {
            enqueue(state, true);
        },
    };
}
