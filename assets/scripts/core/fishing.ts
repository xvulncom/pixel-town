// 钓鱼：抛竿 → 等鱼咬钩 → 在窗口内提竿 → 溜鱼（按住让绿条罩住鱼，进度满了钓上来，空了鱼跑掉）。
// 这里只有规则和溜鱼的模拟，画面在 game/FishingView.ts；随机数都用种子 + 计数算，同样输入同样结果，方便测试。

import { FishDef, World } from './defs';
import { GameState, Weather } from './types';
import { seasonAt } from './calendar';
import { localParts } from './time';
import { today } from './daily';

/** 绿条占整条的比例 */
export const ZONE = 0.3;
const START_PROGRESS = 0.25;

export function hash01(seed: number, k: number): number {
    let h = Math.imul(seed ^ 0x9e3779b9, 374761393) ^ Math.imul(k + 1, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function inHours(hours: [number, number] | undefined, hour: number): boolean {
    if (!hours) return true;
    const [a, b] = hours;
    return a <= b ? hour >= a && hour < b : hour >= a || hour < b;
}

/** 现在这个地域、这个天气能钓到的鱼。 */
export function fishPool(world: World, regionId: string, nowMs: number, weather: Weather): FishDef[] {
    const season = seasonAt(nowMs);
    const hour = localParts(nowMs).hour;
    return Object.values(world.fish).filter((f) =>
        (f.seasons.length === 0 || f.seasons.includes(season))
        && inHours(f.hours, hour)
        && (!f.weather || f.weather.includes(weather))
        && (!f.regions || f.regions.includes(regionId)));
}

/** 按权重挑一条，r 是 0～1 的随机数。 */
export function rollFish(pool: FishDef[], r: number): FishDef | null {
    const total = pool.reduce((a, f) => a + f.weight, 0);
    let acc = 0;
    for (const f of pool) {
        acc += f.weight / total;
        if (r < acc) return f;
    }
    return pool[pool.length - 1] ?? null;
}

/** 抛竿后多久咬钩（毫秒）。 */
export function biteDelayMs(r: number): number {
    return 1500 + r * 4500;
}

/** 咬钩后多久内提竿算数（毫秒），难的鱼短。 */
export function hookWindowMs(f: FishDef): number {
    return 1100 - f.difficulty * 120;
}

export interface Reel {
    fishId: string;
    difficulty: number;
    seed: number;
    /** 已经过的秒数 */
    t: number;
    /** 鱼和绿条中心的位置，0 在底、1 在顶 */
    fish: number;
    target: number;
    nextTurn: number;
    turns: number;
    zone: number;
    zoneV: number;
    progress: number;
    done: 'caught' | 'escaped' | null;
}

export function newReel(f: FishDef, seed: number): Reel {
    return {
        fishId: f.id, difficulty: f.difficulty, seed, t: 0,
        fish: 0.5, target: 0.5, nextTurn: 0, turns: 0,
        zone: ZONE / 2, zoneV: 0, progress: START_PROGRESS, done: null,
    };
}

/** 鱼在不在绿条里。 */
export function inZone(r: Reel): boolean {
    return Math.abs(r.fish - r.zone) <= ZONE / 2;
}

/** 往前推 dt 秒；holding 是玩家是不是按着屏幕。内部按 1/60 秒一步，帧率不同结果一样。 */
export function stepReel(r: Reel, holding: boolean, dt: number): Reel {
    const STEP = 1 / 60;
    let left = dt;
    while (left > 1e-9 && !r.done) {
        const h = Math.min(STEP, left);
        left -= h;
        r.t += h;
        // 鱼：隔一阵换个目标，往目标游；难的鱼换得勤、游得快
        if (r.t >= r.nextTurn) {
            r.turns += 1;
            r.target = hash01(r.seed, r.turns);
            r.nextTurn = r.t + 1.3 - r.difficulty * 0.18 + hash01(r.seed, 1000 + r.turns) * 0.6;
        }
        const speed = 0.2 + r.difficulty * 0.16;
        const d = r.target - r.fish;
        r.fish += Math.sign(d) * Math.min(Math.abs(d), speed * h);
        // 绿条：按住往上加速，松开往下掉，碰到两头停住
        r.zoneV += (holding ? 2.6 : -2.2) * h;
        r.zoneV = Math.max(-1.4, Math.min(1.4, r.zoneV));
        r.zone += r.zoneV * h;
        const lo = ZONE / 2;
        const hi = 1 - ZONE / 2;
        if (r.zone < lo) {
            r.zone = lo;
            r.zoneV = Math.max(0, r.zoneV);
        } else if (r.zone > hi) {
            r.zone = hi;
            r.zoneV = Math.min(0, r.zoneV);
        }
        r.progress += inZone(r) ? 0.32 * h : -(0.12 + r.difficulty * 0.04) * h;
        if (r.progress >= 1) {
            r.progress = 1;
            r.done = 'caught';
        } else if (r.progress <= 0) {
            r.progress = 0;
            r.done = 'escaped';
        }
    }
    return r;
}

export interface Landed {
    gold: number;
    /** 今天第一条，价钱翻倍 */
    first: boolean;
    /** 图鉴里第一次出现 */
    newSpecies: boolean;
}

/** 钓上来：记图鉴，直接卖掉。以后有背包后可以改成进背包、送镇民。 */
export function landFish(state: GameState, world: World, fishId: string, nowMs: number): Landed {
    const f = world.fish[fishId];
    if (!f) return { gold: 0, first: false, newSpecies: false };
    const d = today(state, nowMs);
    const first = !d.fished;
    d.fished = true;
    const newSpecies = !state.fishLog[fishId];
    state.fishLog[fishId] = (state.fishLog[fishId] ?? 0) + 1;
    const gold = f.price * (first ? 2 : 1);
    state.gold += gold;
    return { gold, first, newSpecies };
}

/** 图鉴进度：钓到过几种 / 一共几种。 */
export function fishDexProgress(state: GameState, world: World): [number, number] {
    const all = Object.keys(world.fish);
    return [all.filter((id) => state.fishLog[id] > 0).length, all.length];
}
