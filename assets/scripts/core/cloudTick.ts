// 云端定时进程：每分钟把所有雇了人的存档推进到当前时刻，玩家关着游戏工人也照样干活、偷懒、领工钱。
// 云函数（cloud/functions/workerTick）只负责实现 SaveDb，推进逻辑全在这里，和游戏里跑的是同一份 core。

import { World } from './defs';
import { deserialize, serialize } from './game';
import { simulate } from './simulate';
import { GameState } from './types';

/** 云数据库里一份存档。lastTick 和 active 单独存一列，方便查询和"旧的不覆盖新的"。 */
export interface SaveDoc {
    _id: string;
    json: string;
    lastTick: number;
    /** 有工人或者助理在跑腿，需要云端推进 */
    active: boolean;
}

export interface SaveDb {
    /** 按 _id 升序取 active 的存档，after 是上一页最后一个 _id */
    listActive(limit: number, after: string | null): Promise<SaveDoc[]>;
    /** 只有库里的 lastTick 还等于 expect 时才写，返回写没写成（玩家那边先写了就算了） */
    writeIf(id: string, expect: number, doc: Omit<SaveDoc, '_id'>): Promise<boolean>;
}

export function needsCloud(state: GameState): boolean {
    return state.workers.length > 0 || state.errand !== null;
}

/** 存档变成云端那一行的字段。游戏里写云端也用这个。 */
export function toDoc(state: GameState): Omit<SaveDoc, '_id'> {
    return { json: serialize(state), lastTick: state.lastTick, active: needsCloud(state) };
}

/** 推进一份存档；读不了或不用推进返回 null。 */
export function advanceSave(json: string, world: World, nowMs: number): Omit<SaveDoc, '_id'> | null {
    let state: GameState;
    try {
        state = deserialize(json, world);
    } catch {
        return null;
    }
    if (state.lastTick >= nowMs) return null;
    simulate(state, world, nowMs);
    return toDoc(state);
}

export interface TickStats {
    scanned: number;
    written: number;
    /** 玩家那边刚写过，这次让给玩家 */
    raced: number;
    broken: number;
}

export async function tickAll(db: SaveDb, world: World, nowMs: number, page = 50): Promise<TickStats> {
    const stats: TickStats = { scanned: 0, written: 0, raced: 0, broken: 0 };
    let after: string | null = null;
    for (;;) {
        const docs = await db.listActive(page, after);
        for (const d of docs) {
            stats.scanned++;
            const next = advanceSave(d.json, world, nowMs);
            if (!next) {
                if (d.lastTick < nowMs) stats.broken++;
                continue;
            }
            if (await db.writeIf(d._id, d.lastTick, next)) stats.written++;
            else stats.raced++;
        }
        if (docs.length < page) break;
        after = docs[docs.length - 1]._id;
    }
    return stats;
}
