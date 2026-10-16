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

export interface World {
    crops: Record<string, CropDef>;
    regions: Record<string, RegionDef>;
    npcs: Record<string, NpcDef>;
    wishes: Record<string, WishDef>;
    dialogues: DialogueLine[];
}
