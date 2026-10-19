import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD } from './world';
import { newGame, deserialize } from '../assets/scripts/core/game';
import { SaveDb, SaveDoc, tickAll, toDoc } from '../assets/scripts/core/cloudTick';
import { hire } from '../assets/scripts/core/workers';
import { HOUR } from '../assets/scripts/core/time';
import { bj } from './util';

/** 内存里的存档库，行为同云函数里的实现：按 _id 分页，lastTick 不等就不写。 */
function memoryDb(docs: SaveDoc[]): SaveDb & { docs: Map<string, SaveDoc> } {
    const map = new Map(docs.map((d) => [d._id, d]));
    return {
        docs: map,
        async listActive(limit, after) {
            return [...map.values()].filter((d) => d.active && (after === null || d._id > after))
                .sort((a, b) => (a._id < b._id ? -1 : 1)).slice(0, limit);
        },
        async writeIf(id, expect, doc) {
            const cur = map.get(id);
            if (!cur || cur.lastTick !== expect) return false;
            map.set(id, { _id: id, ...doc });
            return true;
        },
    };
}

const T0 = bj(2026, 10, 20, 7);

function playerDoc(id: string, withWorker: boolean): SaveDoc {
    const s = newGame(WORLD, T0, id, 'jiangnan');
    s.gold = 1000;
    s.farmSeed = 'radish';
    if (withWorker) {
        const w = { ...WORLD, hiring: { ...WORLD.hiring, dailyCandidates: 99 } };
        assert.ok(hire(s, w, 'xiaofang', 'day', 'fair', T0, 'self').ok);
    }
    return { _id: id, ...toDoc(s) };
}

test('云端进程：只推进雇了人的存档，分页扫完，推进到现在', async () => {
    const docs = [playerDoc('a', true), playerDoc('b', false), playerDoc('c', true), playerDoc('d', true)];
    const db = memoryDb(docs);
    const now = T0 + 5 * HOUR;
    const stats = await tickAll(db, WORLD, now, 2);
    assert.equal(stats.scanned, 3);
    assert.equal(stats.written, 3);
    for (const id of ['a', 'c', 'd']) {
        const s = deserialize(db.docs.get(id)!.json, WORLD);
        assert.equal(s.lastTick, now);
        assert.ok(s.workers[0].today.done > 0, '玩家不在线工人也在干');
    }
    assert.equal(db.docs.get('b')!.lastTick, T0, '没雇人的不动');
});

test('云端进程：玩家那边刚写过就让给玩家，旧的不覆盖新的', async () => {
    const db = memoryDb([playerDoc('a', true)]);
    const orig = db.writeIf.bind(db);
    // 模拟云函数读完之后、写回之前，玩家把更新的存档写了上去
    db.writeIf = async (id, expect, doc) => {
        const cur = db.docs.get(id)!;
        db.docs.set(id, { ...cur, lastTick: cur.lastTick + 1 });
        return orig(id, expect, doc);
    };
    const stats = await tickAll(db, WORLD, T0 + HOUR);
    assert.equal(stats.raced, 1);
    assert.equal(stats.written, 0);
});
