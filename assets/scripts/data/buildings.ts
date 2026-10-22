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
    g('road_gravel', '碎石路', 'village', 3, 'gravel'),
    g('pond', '池塘', 'village', 20, 'water'),
    { ...g('bridge', '木桥', 'village', 25, 'wood'), onWater: true },
    // 房子：占地是最下面两行（墙和台阶），屋顶往上盖。interior 是进门后的室内配方（data/interiors.ts）
    { ...b('house', '民居', 'village', 120, [6, 2]), interior: 'v_home' },
    { ...b('house_gable', '马头墙民居', 'village', 200, [6, 2]), interior: 'v_home' },
    { ...b('house_2f', '两层民居', 'town', 360, [6, 2]), interior: 'v_home_big' },
    { ...b('workshop', '木工坊', 'town', 400, [6, 2]), interior: 'v_workshop' },
    { ...b('shop', '杂货铺', 'town', 500, [7, 2]), interior: 'v_shop' },
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
    b('flowerbed', '花圃', 'village', 15, [1, 1]),
    b('stone_lamp', '石灯', 'village', 30, [1, 1]),
    b('beehive', '蜂箱', 'village', 35, [1, 1]),
    b('scarecrow', '稻草人', 'village', 20, [1, 1]),
    b('haystack', '草垛', 'village', 15, [2, 1]),
    // 农家棚舍和村里的公共去处
    // 有门没室内的：点门说 locked
    { ...b('coop', '鸡舍', 'village', 90, [3, 2]), interior: null, locked: '鸡在里面下蛋，别去打扰' },
    { ...b('duck_shed', '鸭棚', 'village', 90, [3, 2]), interior: null, locked: '鸭棚太矮，钻不进去' },
    b('grape_trellis', '葡萄架', 'town', 120, [3, 1]),
    { ...b('threshing', '晒谷场', 'town', 150, [4, 3]), walkable: true },
    { ...b('shrine', '土地庙', 'town', 260, [3, 2]), interior: null, locked: '土地公在里面歇着，拜一拜就好' },
    b('pavilion', '凉亭', 'town', 300, [4, 2]),
    // 树：只占树干那一格，树冠往上盖
    b('tree', '大树', 'village', 30, [1, 1]),
    b('tree_peach', '桃树', 'village', 50, [1, 1]),
    b('pine', '松树', 'village', 30, [1, 1]),
    b('bamboo', '竹子', 'village', 30, [1, 1]),
    b('willow', '柳树', 'village', 40, [1, 1]),
];

export const BUILDINGS: Record<string, BuildingDef> = Object.fromEntries(LIST.map((d) => [d.id, d]));

// 升档条件之后和人口、繁荣度挂钩（见方案「世界结构」），现在只定大小。
// 2026-10-21 放大（原 24×32 / 40×48 / 64×72）：只往右、往下长，老存档的东西坐标不变。
export const TIERS: Record<Tier, TierDef> = {
    village: { id: 'village', name: '村庄', size: [36, 44] },
    town: { id: 'town', name: '小镇', size: [56, 64] },
    city: { id: 'city', name: '城市', size: [80, 96] },
};

/** 开局只有自己和起始资金（用户 2026-10-19 定），地盘是一块空地，房子菜地都自己盖。要送东西在这里加。 */
export const VILLAGE_STARTER: StarterItem[] = [];
