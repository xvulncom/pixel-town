// 核心类型。core/ 与 data/ 下的代码不依赖 Cocos（不 import 'cc'），可以直接用 node 测试。

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Weather = 'sunny' | 'cloudy' | 'rain' | 'snow';

/** 物品 ID：作物 `crop:<id>`，种子 `seed:<id>`，其他材料直接用名字（如 `wood`）。 */
export type ItemId = string;

export type PlotState = 'empty' | 'growing' | 'mature' | 'withered';

export interface Plot {
    state: PlotState;
    cropId: string | null;
    /** 已累计的生长量（小时，湿润时 1 小时算 1，干燥时算 0.5）。 */
    growth: number;
    /** 浇水后湿润到这个时间点（毫秒）。 */
    wetUntil: number;
    /** 已收获次数，多次收获作物用来判断走 regrowHours。 */
    harvests: number;
    /** 对应自己地盘上哪格菜地（Placement.uid），存档第 3 版加入。 */
    field?: number;
}

export interface NpcState {
    affinity: number;
    lastTalkDay: string;
    lastGiftDay: string;
    /** 最近的关键事件，二期作为大模型上下文。最多保留 MEMORY_LIMIT 条。 */
    memories: string[];
}

export type HelperTask = 'water' | 'harvest';

export interface HelperAssignment {
    npcId: string;
    task: HelperTask;
}

export interface GameState {
    version: number;
    /** 玩家自己的随机种子，决定特产等个人差异。 */
    seed: string;
    createdAt: number;
    /** 模拟已经推进到的时间点（毫秒）。 */
    lastTick: number;
    /** 上次模拟时的季节，用来发现换季。 */
    season: Season;
    gold: number;
    inventory: Record<ItemId, number>;
    plots: Plot[];
    npcs: Record<string, NpcState>;
    helpers: HelperAssignment[];
    /** 老家地域 ID，开局选定，决定地图、气候、种子店和特产。 */
    region: string;
    wishesDone: string[];
    /** 已解锁的建筑、店铺、镇民等，如 `building:workshop`、`resident:xiaoshu`。 */
    unlocked: string[];
    /** 自己的地盘，存档第 2 版加入。 */
    village: VillageState;
}

/** 自己地盘上摆的一件东西。x、y 是占地左上角的格子。 */
export interface Placement {
    uid: number;
    def: string;
    x: number;
    y: number;
}

/** 玩家自己的地盘（村庄 → 小镇 → 城市）。朋友串门时读的也是这一份。 */
export interface VillageState {
    tier: 'village' | 'town' | 'city';
    items: Placement[];
    nextUid: number;
}

export type Failure = { ok: false; reason: string };
export type Result = { ok: true } | Failure;

export const OK: Result = { ok: true };

export function fail(reason: string): Failure {
    return { ok: false, reason };
}
