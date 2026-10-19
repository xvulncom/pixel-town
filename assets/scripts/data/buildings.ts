// 自己地盘上能摆的东西、规模档位、开局送的布局。
// 加新建筑：这里加一行，sprite 名对应 tools/art/objects.ts 里登记的图，跑一遍 gen-map 出图。

import { BuildingDef, StarterItem, Tier, TierDef } from '../core/defs';

const b = (
    id: string, name: string, tier: Tier, price: number, foot: [number, number], sprite = id,
): BuildingDef => ({ id, name, kind: 'building', tier, price, foot, sprite });

const g = (id: string, name: string, tier: Tier, price: number, terrain: BuildingDef['terrain']): BuildingDef =>
    ({ id, name, kind: 'ground', tier, price, foot: [1, 1], terrain });

const LIST: BuildingDef[] = [
    // 路和地
    g('road_dirt', '土路', 'village', 2, 'dirt'),
    g('field', '菜地', 'village', 5, 'soil'),
    g('road_stone', '石板路', 'town', 5, 'stone'),
    // 房子：占地是最下面两行（墙和台阶），屋顶往上盖
    b('house', '民居', 'village', 120, [6, 2]),
    b('house_gable', '马头墙民居', 'village', 200, [6, 2]),
    b('house_2f', '两层民居', 'town', 360, [6, 2]),
    b('workshop', '木工坊', 'town', 400, [6, 2]),
    b('shop', '杂货铺', 'town', 500, [7, 2]),
    b('stage', '戏台', 'city', 1500, [6, 2]),
    b('archway', '牌坊', 'city', 800, [6, 1]),
    // 摊位和院里的小物件
    b('well', '水井', 'village', 60, [2, 1]),
    b('stall_fruit', '果蔬摊', 'village', 80, [3, 1]),
    b('stall_bun', '包子摊', 'village', 80, [3, 1]),
    b('stall_cloth', '布摊', 'town', 100, [3, 1]),
    b('tea_table', '茶桌', 'village', 40, [2, 1]),
    b('bench', '长凳', 'village', 15, [2, 1]),
    b('laundry', '晾衣竿', 'village', 20, [3, 1]),
    b('woodpile', '柴堆', 'village', 15, [2, 1]),
    b('lantern', '灯笼杆', 'village', 25, [1, 1]),
    b('jar', '水缸', 'village', 10, [1, 1]),
    b('pot', '盆栽', 'village', 10, [1, 1]),
    b('fence', '篱笆', 'village', 5, [1, 1]),
    // 树：只占树干那一格，树冠往上盖
    b('tree', '大树', 'village', 30, [1, 1]),
    b('tree_peach', '桃树', 'village', 50, [1, 1]),
    b('pine', '松树', 'village', 30, [1, 1]),
    b('bamboo', '竹子', 'village', 30, [1, 1]),
    b('willow', '柳树', 'village', 40, [1, 1]),
];

export const BUILDINGS: Record<string, BuildingDef> = Object.fromEntries(LIST.map((d) => [d.id, d]));

// 升档条件之后和人口、繁荣度挂钩（见方案「世界结构」），现在只定大小
export const TIERS: Record<Tier, TierDef> = {
    village: { id: 'village', name: '村庄', size: [24, 32] },
    town: { id: 'town', name: '小镇', size: [40, 48] },
    city: { id: 'city', name: '城市', size: [64, 72] },
};

/** 开局只有自己和起始资金（用户 2026-10-19 定），地盘是一块空地，房子菜地都自己盖。要送东西在这里加。 */
export const VILLAGE_STARTER: StarterItem[] = [];
