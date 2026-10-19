// 云端定时进程：config.json 里的定时触发器每分钟调一次，把所有雇了人的存档推进到现在。
// 推进逻辑在 core.js（由 npm run build:cloud 从 assets/scripts/core 打包，和游戏里跑的是同一份）。
// 存档集合 saves：每个玩家一行 { json, lastTick, active }，权限设"仅创建者可读写"，云函数有管理员权限。
const cloud = require('wx-server-sdk');
const { tickAll, WORLD } = require('./core.js');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const saves = db.collection('saves');

const store = {
    async listActive(limit, after) {
        const where = after ? { active: true, _id: _.gt(after) } : { active: true };
        const r = await saves.where(where).orderBy('_id', 'asc').limit(limit).get();
        return r.data;
    },
    async writeIf(id, expect, doc) {
        const r = await saves.where({ _id: id, lastTick: expect }).update({ data: { ...doc, updatedAt: Date.now() } });
        return r.stats.updated > 0;
    },
};

exports.main = async () => tickAll(store, WORLD, Date.now());
