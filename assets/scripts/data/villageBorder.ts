// 自己地盘外面的一圈远景，让地盘边界看着自然：上边山坡松林、右边竹林、左边稻田、下边一条小河，其余树林杂草。
// 换样子改这里，图在 tools/art/objects.ts。2026-10-21 外圈从 6 格加宽到 10 格。

import { BorderDef } from '../core/defs';

export const VILLAGE_BORDER: BorderDef = {
    margin: 10,
    trees: { sprites: [['tree', 5], ['pine', 3], ['bamboo', 2], ['tree_peach', 1]], spacing: 2, density: 0.85 },
    edge: { sprites: [['weeds_1', 4], ['weeds_2', 4], ['weeds_3', 3], ['shrub', 2], ['wildflowers', 1], ['rocks', 1]], density: 0.7 },
    scatter: { sprites: [['weeds_1', 3], ['weeds_2', 3], ['shrub', 1], ['wildflowers', 1]], density: 0.3 },
    treeHeight: 5,
    ground: [
        { side: 'bottom', from: 4, to: 6, terrain: 'water' },
        // 地盘里的小溪（data/villageWild.ts）从上边流进来、下边流进小河，各档地盘的出入口都在这两列
        { side: 'top', from: 1, to: 10, terrain: 'water', along: [31, 32] },
        { side: 'bottom', from: 1, to: 3, terrain: 'water', along: [28, 29] },
        { side: 'left', from: 3, to: 9, terrain: 'soil', ridge: 4 },
    ],
    sideTrees: {
        top: [['pine', 5], ['tree', 2]],
        right: [['bamboo', 5], ['tree', 1]],
    },
};
