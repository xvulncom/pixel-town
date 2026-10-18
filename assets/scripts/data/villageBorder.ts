// 自己地盘外面的一圈树林和杂草，让地盘边界看着自然。换样子改这里，图在 tools/art/objects.ts。

import { BorderDef } from '../core/defs';

export const VILLAGE_BORDER: BorderDef = {
    margin: 6,
    trees: { sprites: [['tree', 5], ['pine', 3], ['bamboo', 2], ['tree_peach', 1]], spacing: 2, density: 0.85 },
    edge: { sprites: [['weeds_1', 4], ['weeds_2', 4], ['weeds_3', 3], ['shrub', 2], ['wildflowers', 1], ['rocks', 1]], density: 0.7 },
    scatter: { sprites: [['weeds_1', 3], ['weeds_2', 3], ['shrub', 1], ['wildflowers', 1]], density: 0.3 },
    treeHeight: 5,
};
