// 和镇上的人搭话：主角走到旁边后触发。
// 有人设的镇民（world.npcs）走 DialogueProvider（一期本地对话库，二期换大模型），每天第一次聊加好感；
// 没人设的路人从 data/townFolk 里挑一句闲话，不加好感。

import { World } from './defs';
import { GameState } from './types';
import { DialogueProvider, heartsOf, talk, timeOfDay } from './npc';
import { solarTermAt } from './calendar';
import { weatherOn } from './weather';
import { dayKey, localHour } from './time';
import { rand01 } from './rng';

export interface FolkDef {
    name: string;
    lines: string[];
}

export interface ChatReply {
    name: string;
    text: string;
    /** 这次加了多少好感（路人、今天聊过的为 0） */
    gained: number;
    /** 对话库里的台词 id，调用方记下来避免重复 */
    lineId: string;
}

/**
 * 和 id 这个人说一句话；不认识的人返回 null。
 * recentIds 是最近说过的台词 id（调用方保管，不进存档）。
 */
export async function chatWith(
    state: GameState, world: World, folk: Record<string, FolkDef>, id: string, nowMs: number,
    provider: DialogueProvider, recentIds: string[],
): Promise<ChatReply | null> {
    const npc = world.npcs[id];
    if (npc && state.npcs[id]) {
        const term = solarTermAt(nowMs);
        const reply = await provider.getLine({
            npcId: id,
            hearts: heartsOf(state, id),
            season: term.season,
            term: term.name,
            weather: weatherOn(nowMs, world.regions[state.region]),
            timeOfDay: timeOfDay(localHour(nowMs)),
            dayKey: dayKey(nowMs),
            recentIds,
        });
        const t = talk(state, id, nowMs);
        return { name: npc.name, text: reply.text, gained: t.ok ? t.gained : 0, lineId: reply.id };
    }
    const f = folk[id];
    if (!f || f.lines.length === 0) return null;
    // 避开最近说过的，剩下的按日期和次数挑
    const fresh = f.lines.map((_, i) => i).filter((i) => !recentIds.includes(`${id}#${i}`));
    const pool = fresh.length > 0 ? fresh : f.lines.map((_, i) => i);
    const i = pool[Math.floor(rand01(id, dayKey(nowMs), recentIds.join(',')) * pool.length)];
    return { name: f.name, text: f.lines[i], gained: 0, lineId: `${id}#${i}` };
}
