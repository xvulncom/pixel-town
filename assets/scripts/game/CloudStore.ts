// 云端存档：开通云开发后（data/cloud.ts 填了 env）存档在云数据库里留一份，云端定时进程据此推进工人。
// 本机存储仍是主缓存，读写同步；云端是异步的：打开或切回游戏时拉一次，取推进得更靠后的那份；在线时定时推上去。
// 小程序端只能按 _id 整行更新，不能带条件，所以切回前台必须先拉再推；云函数那边写回带条件，不会盖掉玩家刚写的。

import { CLOUD } from '../data/cloud';
import { toDoc } from '../core/cloudTick';
import { GameState } from '../core/types';

declare const wx: any;

export interface CloudSync {
    /** 拉云端那份存档，没有或失败返回 null */
    pull(): Promise<{ json: string; lastTick: number } | null>;
    /** 推一份上去（太频繁的会合并） */
    push(state: GameState): void;
}

export function makeCloudSync(): CloudSync | null {
    if (!CLOUD.env || typeof wx === 'undefined' || !wx.cloud) return null;
    wx.cloud.init({ env: CLOUD.env, traceUser: false });
    const col = wx.cloud.database().collection(CLOUD.collection);
    let id: string | null = null;
    let busy = false;
    let pending: ReturnType<typeof toDoc> | null = null;
    let lastPush = 0;

    const find = async () => {
        const r = await col.limit(1).get();
        const d = r.data[0] ?? null;
        id = d?._id ?? null;
        return d;
    };

    const write = async (doc: ReturnType<typeof toDoc>) => {
        busy = true;
        try {
            if (!id && !(await find())) {
                const r = await col.add({ data: { ...doc, updatedAt: Date.now() } });
                id = r._id;
            } else {
                await col.doc(id).update({ data: { ...doc, updatedAt: Date.now() } });
            }
        } catch (e) {
            console.warn('云存档写失败', e);
        } finally {
            busy = false;
            if (pending) {
                const next = pending;
                pending = null;
                void write(next);
            }
        }
    };

    return {
        async pull() {
            try {
                const d = await find();
                return d ? { json: d.json, lastTick: d.lastTick } : null;
            } catch (e) {
                console.warn('云存档读失败', e);
                return null;
            }
        },
        push(state) {
            const now = Date.now();
            if (now - lastPush < CLOUD.pushEverySec * 1000 && id) return;
            lastPush = now;
            const doc = toDoc(state);
            if (busy) pending = doc;
            else void write(doc);
        },
    };
}
