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

/** 路面种类，渲染层按它挑地面图块。土路和石板路算连通。 */
export type Terrain = 'dirt' | 'stone' | 'soil';

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
}

/** 开局送的布局，不花钱。 */
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
}

export interface StarterItem {
    def: string;
    x: number;
    y: number;
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
}
