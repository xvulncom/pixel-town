// 镇民：好感度、聊天、送礼，以及对话、计划、记忆三个可替换接口（二期换成大模型时只换实现）。

import { DialogueLine, NpcDef, PlanEntry, TimeOfDay, World } from './defs';
import { GameState, ItemId, NpcState, Season, Weather, fail } from './types';
import { dayKey } from './time';
import { rand01 } from './rng';
import { isWetWeather } from './weather';
import { countOf, removeItem } from './inventory';

export const HEART_POINTS = 100;
export const MAX_AFFINITY = 1000;
export const MEMORY_LIMIT = 20;
export const TALK_GAIN = 10;

export type GiftReaction = 'love' | 'like' | 'neutral' | 'dislike';

export const GIFT_DELTA: Record<GiftReaction, number> = {
    love: 80,
    like: 45,
    neutral: 20,
    dislike: -20,
};

export function hearts(affinity: number): number {
    return Math.min(MAX_AFFINITY / HEART_POINTS, Math.floor(affinity / HEART_POINTS));
}

export function newNpcState(def: NpcDef): NpcState {
    return { affinity: def.initialAffinity, lastTalkDay: '', lastGiftDay: '', memories: [] };
}

export function heartsOf(state: GameState, npcId: string): number {
    const ns = state.npcs[npcId];
    return ns ? hearts(ns.affinity) : 0;
}

export function addAffinity(state: GameState, npcId: string, delta: number): void {
    const ns = state.npcs[npcId];
    if (ns) {
        ns.affinity = Math.max(0, Math.min(MAX_AFFINITY, ns.affinity + delta));
    }
}

export function remember(state: GameState, npcId: string, note: string): void {
    const ns = state.npcs[npcId];
    if (!ns) {
        return;
    }
    ns.memories.push(note);
    if (ns.memories.length > MEMORY_LIMIT) {
        ns.memories.splice(0, ns.memories.length - MEMORY_LIMIT);
    }
}

export type TalkResult = { ok: true; gained: number } | { ok: false; reason: string };

/** 每天第一次聊天加好感。 */
export function talk(state: GameState, npcId: string, nowMs: number): TalkResult {
    const ns = state.npcs[npcId];
    if (!ns) {
        return fail('镇上没有这个人');
    }
    const today = dayKey(nowMs);
    if (ns.lastTalkDay === today) {
        return { ok: true, gained: 0 };
    }
    ns.lastTalkDay = today;
    addAffinity(state, npcId, TALK_GAIN);
    return { ok: true, gained: TALK_GAIN };
}

export function giftReaction(def: NpcDef, itemId: ItemId): GiftReaction {
    if (def.loves.includes(itemId)) return 'love';
    if (def.likes.includes(itemId)) return 'like';
    if (def.dislikes.includes(itemId)) return 'dislike';
    return 'neutral';
}

export type GiftResult =
    | { ok: true; reaction: GiftReaction; delta: number }
    | { ok: false; reason: string };

/** 每人每天收一份礼。 */
export function giveGift(state: GameState, world: World, npcId: string, itemId: ItemId, nowMs: number): GiftResult {
    const def = world.npcs[npcId];
    const ns = state.npcs[npcId];
    if (!def || !ns) {
        return fail('镇上没有这个人');
    }
    const today = dayKey(nowMs);
    if (ns.lastGiftDay === today) {
        return fail(`${def.name}今天已经收过礼了`);
    }
    if (countOf(state, itemId) < 1 || !removeItem(state, itemId)) {
        return fail('背包里没有这个');
    }
    const reaction = giftReaction(def, itemId);
    const delta = GIFT_DELTA[reaction];
    ns.lastGiftDay = today;
    addAffinity(state, npcId, delta);
    remember(state, npcId, `${today} 收到礼物 ${itemId}（${reaction}）`);
    return { ok: true, reaction, delta };
}

export function timeOfDay(hour: number): TimeOfDay {
    if (hour >= 5 && hour < 11) return 'morning';
    if (hour >= 11 && hour < 14) return 'noon';
    if (hour >= 14 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
}

// ---------- 对话来源 ----------

export interface DialogueContext {
    npcId: string;
    hearts: number;
    season: Season;
    term: string;
    weather: Weather;
    timeOfDay: TimeOfDay;
    dayKey: string;
    /** 最近说过的台词 ID，尽量不重复。 */
    recentIds: string[];
}

export interface DialogueReply {
    id: string;
    text: string;
}

export interface DialogueProvider {
    getLine(ctx: DialogueContext): Promise<DialogueReply>;
}

export const FALLBACK_REPLY: DialogueReply = { id: 'fallback', text: '……' };

function lineMatches(line: DialogueLine, ctx: DialogueContext): boolean {
    return line.npcId === ctx.npcId
        && (line.minHearts === undefined || ctx.hearts >= line.minHearts)
        && (line.maxHearts === undefined || ctx.hearts <= line.maxHearts)
        && (!line.seasons || line.seasons.includes(ctx.season))
        && (!line.weather || line.weather.includes(ctx.weather))
        && (!line.terms || line.terms.includes(ctx.term))
        && (!line.timeOfDay || line.timeOfDay.includes(ctx.timeOfDay));
}

/** 条件越多越贴合当下，越优先。 */
function specificity(line: DialogueLine): number {
    let s = 0;
    if (line.minHearts !== undefined || line.maxHearts !== undefined) s += 1;
    if (line.seasons) s += 1;
    if (line.weather) s += 2;
    if (line.terms) s += 3;
    if (line.timeOfDay) s += 1;
    return s;
}

/** 从对话库里挑一句：70% 选最贴合当下的，30% 随便聊，避开最近说过的。 */
export function pickLine(lines: DialogueLine[], ctx: DialogueContext): DialogueReply {
    const matched = lines.filter((l) => lineMatches(l, ctx));
    const fresh = matched.filter((l) => !ctx.recentIds.includes(l.id));
    const pool = fresh.length > 0 ? fresh : matched;
    if (pool.length === 0) {
        return FALLBACK_REPLY;
    }
    const r1 = rand01(ctx.npcId, ctx.dayKey, ctx.recentIds.join(','), 'mode');
    const r2 = rand01(ctx.npcId, ctx.dayKey, ctx.recentIds.join(','), 'pick');
    let candidates = pool;
    if (r1 < 0.7) {
        const best = Math.max(...pool.map(specificity));
        candidates = pool.filter((l) => specificity(l) === best);
    }
    const line = candidates[Math.floor(r2 * candidates.length)];
    return { id: line.id, text: line.text };
}

export class LocalDialogueProvider implements DialogueProvider {
    private readonly lines: DialogueLine[];

    constructor(lines: DialogueLine[]) {
        this.lines = lines;
    }

    getLine(ctx: DialogueContext): Promise<DialogueReply> {
        return Promise.resolve(pickLine(this.lines, ctx));
    }
}

// ---------- 计划来源 ----------

export interface DayPlan {
    npcId: string;
    dayKey: string;
    entries: PlanEntry[];
}

export interface PlanProvider {
    getPlan(npcId: string, dayKey: string, weather: Weather): Promise<DayPlan>;
}

export class LocalPlanProvider implements PlanProvider {
    private readonly world: World;

    constructor(world: World) {
        this.world = world;
    }

    getPlan(npcId: string, day: string, weather: Weather): Promise<DayPlan> {
        const def = this.world.npcs[npcId];
        if (!def) {
            return Promise.reject(new Error(`unknown npc ${npcId}`));
        }
        const entries = isWetWeather(weather) && def.rainSchedule ? def.rainSchedule : def.schedule;
        return Promise.resolve({ npcId, dayKey: day, entries });
    }
}

/** 某个整点镇民在哪、在干什么。凌晨还没到第一条时，沿用前一天最后一条（在家睡觉）。 */
export function activityAt(plan: DayPlan, hour: number): PlanEntry {
    let current = plan.entries[plan.entries.length - 1];
    for (const e of plan.entries) {
        if (e.hour <= hour) {
            current = e;
        }
    }
    return current;
}

// ---------- 记忆 ----------

export interface NpcMemory {
    getAffinity(npcId: string): number;
    addAffinity(npcId: string, delta: number): void;
    remember(npcId: string, note: string): void;
    recall(npcId: string, n: number): string[];
}

/** 一期：记忆存在本地存档里。 */
export class StateNpcMemory implements NpcMemory {
    private readonly state: GameState;

    constructor(state: GameState) {
        this.state = state;
    }

    getAffinity(npcId: string): number {
        return this.state.npcs[npcId]?.affinity ?? 0;
    }

    addAffinity(npcId: string, delta: number): void {
        addAffinity(this.state, npcId, delta);
    }

    remember(npcId: string, note: string): void {
        remember(this.state, npcId, note);
    }

    recall(npcId: string, n: number): string[] {
        const list = this.state.npcs[npcId]?.memories ?? [];
        return list.slice(-n);
    }
}
