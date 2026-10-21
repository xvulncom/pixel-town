// 静态内容（作物、镇民、心愿、对话）的类型。内容数据放 data/，核心逻辑通过 World 拿到它们，测试时可以换成自己的 World。

import { ItemId, Season, Weather } from './types';

export interface CropDef {
    id: string;
    name: string;
    seasons: Season[];
    /** 从种下到成熟需要的湿润小时数。 */
    growHours: number;
    /** 多次收获作物：收获后再次成熟需要的湿润小时数。 */
    regrowHours?: number;
    seedPrice: number;
    sellPrice: number;
    /** 特产：只有所属地域的种子店卖，见 RegionDef.specialties。 */
    specialty?: boolean;
}

export interface FishDef {
    id: string;
    name: string;
    /** 哪些季节有，空数组表示四季都有。 */
    seasons: Season[];
    /** 北京时间整点 [开始, 结束)，可以跨夜（如 [19, 5]）；不填全天都有。 */
    hours?: [number, number];
    /** 只在这些天气出来；不填不挑天气。 */
    weather?: Weather[];
    /** 只在这些地域有；不填各地都有。 */
    regions?: string[];
    /** 1～5，越大鱼跑得越快、提竿窗口越短。 */
    difficulty: number;
    price: number;
    /** 出现权重，越小越稀有。 */
    weight: number;
}

/** 集市摆摊的规则参数。 */
export interface MarketDef {
    /** 一轮多少秒 */
    roundSec: number;
    /** 每天前几轮给钱 */
    roundsPerDay: number;
    /** 一单按收购价的多少算 */
    priceRate: number;
    /** 每连对一单多加的比例，和上限 */
    streakStep: number;
    streakMax: number;
    /** 顾客耐心（秒）：第一个 start，之后每个少 step，最少 min */
    patience: { start: number; step: number; min: number };
    /** 摊上摆几样货 */
    goods: number;
}

export interface PlanEntry {
    /** 北京时间整点。 */
    hour: number;
    place: string;
    activity: string;
}

export interface NpcTraits {
    /** 勤快程度 0～1，决定打工时每小时能干多少。 */
    diligence: number;
    /** 每个工作小时摸鱼的概率。 */
    laziness: number;
    /** 帮忙收菜时偷吃的倾向。 */
    greed: number;
}

export interface NpcDef {
    id: string;
    name: string;
    role: string;
    /** 人设，一期写对话库用，二期作为大模型系统提示的一部分。 */
    bio: string;
    initialAffinity: number;
    traits: NpcTraits;
    loves: ItemId[];
    likes: ItemId[];
    dislikes: ItemId[];
    /** 打工时段 [开始, 结束)，北京时间整点。 */
    workHours: [number, number];
    schedule: PlanEntry[];
    rainSchedule?: PlanEntry[];
}

export type TimeOfDay = 'morning' | 'noon' | 'afternoon' | 'evening' | 'night';

export interface DialogueLine {
    id: string;
    npcId: string;
    text: string;
    minHearts?: number;
    maxHearts?: number;
    seasons?: Season[];
    weather?: Weather[];
    terms?: string[];
    timeOfDay?: TimeOfDay[];
}

export interface WishDef {
    id: string;
    npcId: string;
    title: string;
    story: string;
    minHearts: number;
    requires: { items: Record<ItemId, number>; gold: number };
    rewards: { unlock: string[]; affinity: number };
}

export interface Climate {
    /** 各季节雨雪天的概率。 */
    wetChance: Record<Season, number>;
    /** 冬天下雪还是下雨（岭南冬天不下雪）。 */
    snow: boolean;
}

/** 地域：玩家开局选的老家，决定地图、气候、能买的作物和特产。 */
export interface RegionDef {
    id: string;
    name: string;
    /** 一句话介绍，开局选择界面用。 */
    blurb: string;
    /** 地图和图块风格，渲染层据此加载对应的 Tiled 地图。 */
    map: string;
    climate: Climate;
    /** 本地种子店卖的普通作物。 */
    crops: string[];
    /** 本地特产，只有本地种子店卖，其他地域的玩家只能靠好友赠送。 */
    specialties: string[];
    /** 本地气候下与默认不同的种植季节，如岭南冬天也能种叶菜。 */
    seasonOverrides?: Record<string, Season[]>;
    /** 原型地点（data/places.ts 的 id），镇上的天气跟这里的真实天气走 */
    origin?: string;
}

/** 自己地盘的规模档位，从小到大。 */
export type Tier = 'village' | 'town' | 'city';
export const TIER_ORDER: Tier[] = ['village', 'town', 'city'];

export interface TierDef {
    id: Tier;
    name: string;
    /** 地盘大小（格）。升档时往右、往下扩，已有建筑坐标不变。 */
    size: [number, number];
}

/** 路面种类，渲染层按它挑地面图块。土路、石板路、碎石路算连通；water 是水面，wood 是水上的木桥。 */
export type Terrain = 'dirt' | 'stone' | 'soil' | 'gravel' | 'water' | 'wood';

/**
 * 地盘里自带的天然地貌（小溪、池塘、大石头、老树、竹丛）。按坐标写死，地盘大到能装下它才出现；
 * 花 price 开荒清掉之后才能在那块地上盖东西。水面用 terrain 画，其余用 sprite（图底边居中对齐占地）。
 */
export interface WildDef {
    id: string;
    name: string;
    x: number;
    y: number;
    w: number;
    h: number;
    price: number;
    terrain?: 'water';
    sprite?: string;
}

export type Side = 'top' | 'bottom' | 'left' | 'right';

/**
 * 能摆在自己地盘上的东西。
 * - building：房子、树、摊位等，占 foot 那么大一块（宽×深，格）；图比占地高的部分往上画，可以盖住后面。
 * - ground：铺在地上的路和菜地，1×1，建筑不能压在上面。
 */
export interface BuildingDef {
    id: string;
    name: string;
    kind: 'building' | 'ground';
    /** 地盘到这一档才能摆。 */
    tier: Tier;
    price: number;
    foot: [number, number];
    /** building 用：建筑图集里的图名。 */
    sprite?: string;
    /** ground 用：铺成哪种路面。 */
    terrain?: Terrain;
    /** 只能铺在没开荒的水面上（木桥） */
    onWater?: boolean;
}

/** 自己地盘外面一圈装饰（只画不存档、不能摆东西）。sprite 名对应 buildings.png 里的图，数字是权重。 */
export interface BorderDef {
    /** 外圈宽几格 */
    margin: number;
    /** 树：每 spacing 格放一棵，位置抖动，density 是放的概率 */
    trees: { sprites: [string, number][]; spacing: number; density: number };
    /** 贴着地盘的那一圈：杂草、灌木、石头 */
    edge: { sprites: [string, number][]; density: number };
    /** 树之间的空地上零散的杂草 */
    scatter: { sprites: [string, number][]; density: number };
    /** 树图的高（格）：地盘下方的树要离开这么远，免得挡住地盘里的东西 */
    treeHeight: number;
    /**
     * 远景地面：side 那一边离地盘 from～to 格的一带铺成 terrain（小河、稻田）；ridge 是每隔几格留一道土埂；
     * along 给了就只铺沿边的这几列/行（地盘里的小溪从这里流进流出）。
     */
    ground?: { side: Side; from: number; to: number; terrain: Terrain; ridge?: number; along?: [number, number] }[];
    /** 某一边的树换成别的（竹林、山坡松林），不写的边用 trees.sprites */
    sideTrees?: Partial<Record<Side, [string, number][]>>;
}

/** 开局送的布局，不花钱（现在开局是空地，见 data/buildings.ts）。 */
export interface StarterItem {
    def: string;
    x: number;
    y: number;
}

export type WorkerRole = 'farmhand' | 'assistant';

/** 求职的人的性子。全部藏着不给玩家看，玩家只能从口碑和干活结果去猜。 */
export interface WorkerTraits {
    /** 每小时能干几件活 */
    skill: number;
    /** 偷懒的底子，0～1 */
    laziness: number;
    /** 收菜时偷吃的倾向，0～1 */
    greed: number;
    /** 心气，0～1：越高越受不了压价 */
    pride: number;
    /** 助理的眼力，0～1：评价别人准不准 */
    eye: number;
}

/** 一个能雇的人。以后雇好友时由后端给出同样形状的数据。 */
export interface WorkerDef {
    id: string;
    name: string;
    role: WorkerRole;
    /** 人物图集 people-frames.json 里的行名 */
    look: string;
    /** 一句自我介绍，招工处卡片上显示 */
    intro: string;
    /** 要的日薪 */
    ask: number;
    /** 上工时段 [开始, 结束)，北京时间整点 */
    workHours: [number, number];
    traits: WorkerTraits;
}

/** 一档出价：压价、照价、加价。 */
export interface WageOffer {
    id: string;
    name: string;
    /** 相对要价的倍数 */
    rate: number;
}

/** 口碑分档：感觉到的值不低于 min 就用这句（从高到低排）。 */
export interface RumorBand {
    min: number;
    text: string;
}

/** 招工、工钱、偷懒的规则参数。 */
export interface HiringDef {
    /** 招工处每天来几个人 */
    dailyCandidates: number;
    /** 哪些建筑算住处，每处住几个工人 */
    housing: string[];
    perHouse: number;
    offers: WageOffer[];
    /** 计件时偷懒概率乘的系数 */
    pieceSlack: number;
    /** 有人看着时偷懒概率乘的系数 */
    watchSlack: number;
    /** 玩家多久之内开过游戏算"有人看着"（毫秒） */
    watchWindowMs: number;
    /** 一次偷懒持续几分钟（偷懒按这个长度成段决定） */
    slackSpellMin: number;
    /** 连欠几次薪就走人 */
    maxUnpaid: number;
    morale: { start: number; paid: number; raise: number; unpaid: number; tooLittle: number; quitBelow: number };
    /** 计件时一天挣不到要价的这个比例就不高兴 */
    pieceFairRatio: number;
    /** 计件单价按一天能干到多少件估：上工小时 × 每小时件数 × 这个比例 */
    pieceBusyRatio: number;
    /** 助理去招工处单程来回要几分钟；懒的人再乘 (1 + 懒度 × errandLazy) */
    errandMinutes: number;
    errandLazy: number;
    /** 亲自去看人，口碑的准确度 */
    inPersonEye: number;
    rumors: { laziness: RumorBand[]; skill: RumorBand[]; greedy: { min: number; text: string } };
    /** 工人动态最多留几条 */
    logLimit: number;
}

export interface World {
    crops: Record<string, CropDef>;
    regions: Record<string, RegionDef>;
    npcs: Record<string, NpcDef>;
    wishes: Record<string, WishDef>;
    dialogues: DialogueLine[];
    buildings: Record<string, BuildingDef>;
    tiers: Record<Tier, TierDef>;
    villageStarter: StarterItem[];
    villageBorder: BorderDef;
    villageWild: WildDef[];
    fish: Record<string, FishDef>;
    market: MarketDef;
    workers: Record<string, WorkerDef>;
    hiring: HiringDef;
}
