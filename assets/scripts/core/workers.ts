// 雇人干活：招工处、签约、上工、偷懒、发工钱、助理跑腿。
// 工人每分钟（按绝对时间的整分钟）由 simulate 推进一次；云端定时进程和游戏里的常驻节点跑的都是这里，
// 随机数只由存档种子、工人和时刻决定，谁来推进、多久推进一次，结果都一样。

import { HiringDef, World, WorkerDef } from './defs';
import { fail, GameState, OK, PayMode, Result, Weather, Worker, WorkerDay } from './types';
import { dayKey, HOUR, MINUTE, startOfDay } from './time';
import { rand01 } from './rng';
import { isWetWeather } from './weather';
import { collect } from './farm';
import { tend } from './fields';
import { removeItem } from './inventory';

/** 雇谁由这个接口给出：现在是本地数据里的 NPC，以后雇好友时换成后端实现，调用方不改。 */
export interface WorkerPool {
    def(id: string): WorkerDef | undefined;
    /** 某天招工处来的人（不含已经雇了的） */
    candidates(state: GameState, day: string): string[];
}

export function localPool(world: World): WorkerPool {
    return {
        def: (id) => world.workers[id],
        candidates: (state, day) => Object.keys(world.workers)
            .filter((id) => !state.workers.some((w) => w.id === id))
            .map((id) => ({ id, r: rand01(state.seed, 'cand', day, id) }))
            .sort((a, b) => a.r - b.r)
            .slice(0, world.hiring.dailyCandidates)
            .map((c) => c.id),
    };
}

export function candidatesToday(state: GameState, world: World, nowMs: number): string[] {
    return localPool(world).candidates(state, dayKey(nowMs));
}

function emptyDay(day: string): WorkerDay {
    return { day, done: 0, slackMin: 0, eaten: 0, paid: 0 };
}

function log(state: GameState, world: World, t: number, who: string, text: string): void {
    state.workerLog.push({ t, who, text });
    const over = state.workerLog.length - world.hiring.logLimit;
    if (over > 0) state.workerLog.splice(0, over);
}

function band(bands: { min: number; text: string }[], v: number): string {
    return (bands.find((b) => v >= b.min) ?? bands[bands.length - 1]).text;
}

/** 口碑：按眼力 eye（0～1）在真实性子上加噪声，眼力越差越不准。salt 区分谁、哪天看的。 */
export function rumorOf(state: GameState, world: World, id: string, eye: number, salt: string): string {
    const def = world.workers[id];
    if (!def) return '';
    const r = world.hiring.rumors;
    const fuzz = 1 - Math.max(0, Math.min(1, eye));
    const noise = (k: string) => rand01(state.seed, 'rumor', salt, id, k) * 2 - 1;
    const lazy = def.traits.laziness + noise('l') * fuzz * 0.5;
    const skill = def.traits.skill + noise('s') * fuzz * 6;
    const greed = def.traits.greed + noise('g') * fuzz * 0.4;
    const parts = [band(r.laziness, lazy), band(r.skill, skill)];
    if (greed >= r.greedy.min) parts.push(r.greedy.text);
    return parts.join('，');
}

/** 自己地盘能住几个工人。 */
export function housingCap(state: GameState, world: World): number {
    const h = world.hiring;
    return state.village.items.filter((it) => h.housing.includes(it.def)).length * h.perHouse;
}

/** 计件单价：按一天大概能干到的件数把要价摊开。 */
export function pieceWage(world: World, def: WorkerDef): number {
    const [a, b] = def.workHours;
    const per = (b - a) * def.traits.skill * world.hiring.pieceBusyRatio;
    return Math.max(1, Math.ceil(def.ask / Math.max(1, per)));
}

/** 按出价档和计酬方式，这个人每天或每件拿多少。 */
export function wageFor(world: World, def: WorkerDef, pay: PayMode, rate: number): number {
    return Math.max(1, Math.round((pay === 'day' ? def.ask : pieceWage(world, def)) * rate));
}

function offerRate(h: HiringDef, offerId: string): number | null {
    return h.offers.find((o) => o.id === offerId)?.rate ?? null;
}

/** 心气高的人受不了压价：出价低于 1 − (1 − 心气) / 2 就不干。 */
export function accepts(def: WorkerDef, rate: number): boolean {
    return rate >= 1 - (1 - def.traits.pride) / 2;
}

export type HireVia = 'self' | 'assistant';

/**
 * 签约。via 是 self 时调用方要保证玩家人在镇上的招工处；assistant 时只能签助理今天带回来的名单上的人。
 */
export function hire(
    state: GameState, world: World, id: string, pay: PayMode, offerId: string, nowMs: number, via: HireVia,
): Result {
    const def = world.workers[id];
    if (!def) return fail('没有这个人');
    if (state.workers.some((w) => w.id === id)) return fail(`${def.name}已经在你这儿干了`);
    const day = dayKey(nowMs);
    if (via === 'self') {
        if (!candidatesToday(state, world, nowMs).includes(id)) return fail(`${def.name}今天没来招工处`);
    } else {
        const rep = state.hireReport;
        if (!rep || rep.day !== day || !rep.candidates.some((c) => c.id === id)) return fail('助理今天没带回这个人');
        if (!state.workers.some((w) => w.id === rep.by)) return fail('带名单的助理已经不在了');
    }
    if (state.workers.length >= housingCap(state, world)) {
        return fail(housingCap(state, world) === 0 ? '工人没地方住，先盖一户民居' : '住处满了，再盖一户民居');
    }
    const rate = offerRate(world.hiring, offerId);
    if (rate === null) return fail('没有这档出价');
    if (!accepts(def, rate)) return fail(`${def.name}嫌钱少，不干`);
    const w: Worker = {
        id, source: 'npc', pay, rate, wage: wageFor(world, def, pay, rate), hiredAt: nowMs,
        morale: world.hiring.morale.start, owed: 0, unpaid: 0, carry: 0, doing: 'off', at: null, today: emptyDay(day),
    };
    state.workers.push(w);
    const how = pay === 'day' ? `日薪 ${w.wage} 金` : `每件 ${w.wage} 金`;
    log(state, world, nowMs, id, `${def.name}来上工了，${how}`);
    return OK;
}

/** 辞退：先把欠的钱结清。 */
export function fire(state: GameState, world: World, id: string, nowMs: number): Result {
    const w = state.workers.find((x) => x.id === id);
    const def = world.workers[id];
    if (!w || !def) return fail('没雇这个人');
    if (w.owed > state.gold) return fail(`先把欠${def.name}的 ${w.owed} 金结了`);
    state.gold -= w.owed;
    w.today.paid += w.owed;
    w.owed = 0;
    removeWorker(state, id);
    log(state, world, nowMs, id, `${def.name}被辞退了`);
    return OK;
}

/** 调薪：涨了心情好，降了心情差（降到他不接受的价位就当场走人）。 */
export function setOffer(state: GameState, world: World, id: string, offerId: string, nowMs: number): Result {
    const w = state.workers.find((x) => x.id === id);
    const def = world.workers[id];
    const rate = offerRate(world.hiring, offerId);
    if (!w || !def) return fail('没雇这个人');
    if (rate === null) return fail('没有这档出价');
    if (rate === w.rate) return OK;
    const m = world.hiring.morale;
    if (!accepts(def, rate)) {
        if (w.owed > state.gold) return fail(`${def.name}说先把欠的 ${w.owed} 金结了再谈`);
        state.gold -= w.owed;
        w.owed = 0;
        removeWorker(state, id);
        log(state, world, nowMs, id, `${def.name}嫌降薪，不干了`);
        return OK;
    }
    w.morale = clampMorale(w.morale + (rate > w.rate ? m.raise : -m.raise));
    w.rate = rate;
    w.wage = wageFor(world, def, w.pay, rate);
    log(state, world, nowMs, id, `${def.name}的工钱改成${w.pay === 'day' ? '日薪' : '每件'} ${w.wage} 金`);
    return OK;
}

function removeWorker(state: GameState, id: string): void {
    state.workers = state.workers.filter((w) => w.id !== id);
    if (state.errand?.by === id) state.errand = null;
}

function clampMorale(v: number): number {
    return Math.max(0, Math.min(100, v));
}

/** 时刻 t 之前那一分钟他在不在上工时段。 */
export function onShift(def: WorkerDef, t: number): boolean {
    const local = (t - 1 - startOfDay(t - 1)) / HOUR;
    return local >= def.workHours[0] && local < def.workHours[1];
}

/** 派助理去招工处。 */
export function sendErrand(state: GameState, world: World, id: string, nowMs: number): Result {
    const w = state.workers.find((x) => x.id === id);
    const def = world.workers[id];
    if (!w || !def) return fail('没雇这个人');
    if (def.role !== 'assistant') return fail(`${def.name}不是助理，不会替你挑人`);
    if (state.errand) return fail('助理已经在路上了');
    if (!onShift(def, nowMs + 1)) return fail(`${def.name}还没上工`);
    state.errand = { by: id, kind: 'hire', until: errandEnd(world, def, nowMs) };
    w.doing = 'errand';
    log(state, world, nowMs, id, `${def.name}去招工处了`);
    return OK;
}

/** 跑腿回来的时刻：懒的人路上磨蹭更久，按整分钟算。 */
export function errandEnd(world: World, def: WorkerDef, nowMs: number): number {
    const h = world.hiring;
    const min = Math.round(h.errandMinutes * (1 + def.traits.laziness * h.errandLazy));
    return Math.ceil((nowMs + min * MINUTE) / MINUTE) * MINUTE;
}

/** 这一分钟偷懒的概率。 */
export function slackChance(state: GameState, world: World, w: Worker, def: WorkerDef, t: number): number {
    const h = world.hiring;
    const pay = w.pay === 'piece' ? h.pieceSlack : 1 / (w.rate * w.rate);
    const watch = watched(state, world, t) ? h.watchSlack : 1;
    const mood = 1.5 - w.morale / 100;
    return Math.max(0, Math.min(0.95, def.traits.laziness * pay * watch * mood));
}

export function watched(state: GameState, world: World, t: number): boolean {
    return state.lastSeen >= t - world.hiring.watchWindowMs;
}

/** 在整分钟 t 推进所有工人一分钟。 */
export function runWorkers(state: GameState, world: World, t: number, weather: Weather): void {
    const day = dayKey(t - 1);
    finishErrand(state, world, t);
    for (const w of [...state.workers]) {
        const def = world.workers[w.id];
        if (!def) continue;
        if (w.today.day !== day) w.today = emptyDay(day);
        const spell = Math.floor(t / (world.hiring.slackSpellMin * MINUTE));
        if (state.errand?.by === w.id) {
            w.doing = 'errand';
        } else if (!onShift(def, t)) {
            w.doing = 'off';
        } else if (rand01(state.seed, 'wslack', w.id, spell) < slackChance(state, world, w, def, t)) {
            // 只有看着的时候才知道他在偷懒
            if (w.doing !== 'slack' && watched(state, world, t)) log(state, world, t, w.id, `${def.name}在地头打盹`);
            w.doing = 'slack';
            w.today.slackMin += 1;
        } else {
            work(state, world, w, def, t, weather);
        }
        // 下工那一分钟结账（跑腿在外也照样结）
        if (t === startOfDay(t - 1) + def.workHours[1] * HOUR) settle(state, world, w, def, t);
    }
}

function finishErrand(state: GameState, world: World, t: number): void {
    const e = state.errand;
    if (!e || e.until > t) return;
    state.errand = null;
    const def = world.workers[e.by];
    if (!def) return;
    const day = dayKey(e.until - 1);
    const ids = localPool(world).candidates(state, day);
    state.hireReport = {
        day, by: e.by,
        candidates: ids.map((id) => ({ id, rumor: rumorOf(state, world, id, def.traits.eye, `${e.by}:${day}`) })),
    };
    log(state, world, t, e.by, `${def.name}从招工处回来了，带回 ${ids.length} 个人的名单`);
}

/** 一分钟能干 skill/60 件，零头攒着；没活干就站着，不攒。 */
function work(state: GameState, world: World, w: Worker, def: WorkerDef, t: number, weather: Weather): void {
    w.carry += def.traits.skill / 60;
    let did = false;
    while (w.carry >= 1) {
        if (!doOne(state, world, w, def, t, weather)) {
            w.carry = 0;
            break;
        }
        w.carry -= 1;
        did = true;
    }
    // 零头还没攒够一件时算在干活，除非上一件就没活可干
    if (did) w.doing = 'work';
    else if (w.carry === 0) w.doing = 'idle';
    else if (w.doing !== 'idle') w.doing = 'work';
}

/** 干一件活：先收熟的、再清枯的、再浇干的、最后种空地。干成了返回 true。 */
function doOne(state: GameState, world: World, w: Worker, def: WorkerDef, t: number, weather: Weather): boolean {
    const plots = state.plots;
    let idx = plots.findIndex((p) => p.state === 'mature');
    if (idx >= 0 && rand01(state.seed, 'weat', w.id, t, idx) < def.traits.greed * 0.2) {
        const item = collect(state, world, plots[idx], t);
        if (item) removeItem(state, item);
        w.today.eaten += 1;
        return finishUnit(state, w, plots[idx].field ?? null);
    }
    if (idx < 0) idx = plots.findIndex((p) => p.state === 'withered');
    if (idx < 0 && !isWetWeather(weather)) idx = plots.findIndex((p) => p.state === 'growing' && p.wetUntil <= t);
    if (idx < 0 && state.farmSeed) idx = plots.findIndex((p) => p.state === 'empty');
    if (idx < 0) return false;
    const r = tend(state, world, idx, state.farmSeed, t);
    if (!r.ok || r.action === 'wait') return false;
    return finishUnit(state, w, plots[idx].field ?? null);
}

function finishUnit(state: GameState, w: Worker, field: number | null): boolean {
    w.today.done += 1;
    w.at = field;
    if (w.pay === 'piece') pay(state, w, w.wage);
    return true;
}

function pay(state: GameState, w: Worker, n: number): void {
    if (state.gold >= n) {
        state.gold -= n;
        w.today.paid += n;
    } else {
        w.owed += n;
    }
}

/** 下工结账：日薪加上欠的一起发；发不出就记欠薪，连欠到上限或心情太差就走人。 */
function settle(state: GameState, world: World, w: Worker, def: WorkerDef, t: number): void {
    const m = world.hiring.morale;
    const due = (w.pay === 'day' ? w.wage : 0) + w.owed;
    if (due > 0) {
        if (state.gold >= due) {
            state.gold -= due;
            w.today.paid += due;
            w.owed = 0;
            w.unpaid = 0;
            w.morale = clampMorale(w.morale + m.paid);
        } else {
            w.owed = due;
            w.unpaid += 1;
            w.morale = clampMorale(w.morale - m.unpaid);
            log(state, world, t, w.id, `没钱发${def.name}的工钱，欠着 ${due} 金`);
        }
    } else if (w.pay === 'piece') {
        w.morale = clampMorale(w.morale + m.paid);
    }
    if (w.pay === 'piece' && w.today.paid < def.ask * world.hiring.pieceFairRatio) {
        w.morale = clampMorale(w.morale - m.tooLittle);
        log(state, world, t, w.id, `${def.name}嫌活太少，今天才挣 ${w.today.paid} 金`);
    }
    if (w.unpaid >= world.hiring.maxUnpaid || w.morale < m.quitBelow) {
        removeWorker(state, w.id);
        const tail = w.owed > 0 ? `，欠的 ${w.owed} 金也不要了` : '';
        log(state, world, t, w.id, `${def.name}不干了${tail}`);
    }
}
