// 开机时定存档放哪：按平台选后端（data/backend.ts），返回本机缓存和后端同步两样，Boot 交给 Sim。
//   local   —— 只用本机存档
//   wxcloud —— 微信云开发（data/cloud.ts 的 env 为空时等同 local）
//   server  —— 自建服务器：没会话先输邀请码，拉服务器那份存档，推进得更靠后就用它
// 调试覆盖：加载前设 window.__pixelTownBackend（'local' | 'server' | 'wxcloud'）、window.__pixelTownServer（接口地址前缀）。

import { sys } from 'cc';
import { chooseStart, CloudSync, makeServerSync, pickBackend, Platform, Session } from '../core/sync';
import { BACKEND } from '../data/backend';
import { makeCloudSync } from './CloudStore';
import { askInvite, waitRetry } from './InviteGate';
import { localStore, playerStore, SaveStore } from './Store';

const SESSION_KEY = 'pixel-town-session';

export interface Backend {
    store: SaveStore;
    cloud: CloudSync | null;
}

function platform(): Platform {
    if (sys.platform === sys.Platform.WECHAT_GAME) return 'wechat';
    if (sys.isBrowser) return 'web';
    return 'other';
}

function loadSession(): Session | null {
    try {
        const s = JSON.parse(sys.localStorage.getItem(SESSION_KEY) ?? 'null');
        return s && typeof s.token === 'string' && typeof s.playerId === 'string' ? s : null;
    } catch {
        return null;
    }
}

const clearSession = () => sys.localStorage.removeItem(SESSION_KEY);

export async function prepareBackend(): Promise<Backend> {
    const g = globalThis as { __pixelTownBackend?: unknown; __pixelTownServer?: unknown };
    const kind = pickBackend(platform(), BACKEND, g.__pixelTownBackend);
    if (kind === 'local') return { store: localStore, cloud: null };
    if (kind === 'wxcloud') return { store: localStore, cloud: makeCloudSync() };

    const base = typeof g.__pixelTownServer === 'string' ? g.__pixelTownServer : BACKEND.server.base;
    let hint = '';
    for (;;) {
        let session = loadSession();
        if (!session) {
            session = await askInvite(base, hint);
            sys.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        }
        let lost = false;
        const opts = {
            base, token: session.token, fetch: fetch.bind(globalThis), pushEverySec: BACKEND.server.pushEverySec,
            onAuthLost: () => { lost = true; },
        };
        const sync = makeServerSync(opts);
        const remote = await sync.load();
        if (lost) {
            clearSession();
            hint = '邀请码失效了，重新输一次';
            continue;
        }
        const store = playerStore(session.playerId);
        const start = chooseStart(store.load(), remote);
        if (start === 'retry') {
            await waitRetry('连不上服务器，检查网络后重试');
            continue;
        }
        if (start.save) store.save(start.save);
        // 玩着玩着会话没了（邀请码被作废）：清掉会话，刷新回到输邀请码
        opts.onAuthLost = () => {
            clearSession();
            location.reload();
        };
        return { store, cloud: sync };
    }
}
