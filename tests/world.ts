// 测试用的内容集合：正式开局是一块空地（data/buildings.ts），种地类测试需要现成的菜地，
// 这里换上一块农家布局（一户人家、土路、水井、12 格菜地、几棵树）。

import { StarterItem, World } from '../assets/scripts/core/defs';
import { WORLD as REAL } from '../assets/scripts/data/world';

export const FARM_LAYOUT: StarterItem[] = [
    { def: 'house', x: 9, y: 12 },
    ...[14, 15, 16, 17, 18, 19, 20, 21].flatMap((y) => [11, 12].map((x) => ({ def: 'road_dirt', x, y }))),
    { def: 'well', x: 15, y: 16 },
    ...[16, 17, 18].flatMap((y) => [4, 5, 6, 7].map((x) => ({ def: 'field', x, y }))),
    { def: 'tree', x: 4, y: 8 },
    { def: 'tree_peach', x: 19, y: 9 },
    { def: 'willow', x: 3, y: 25 },
    { def: 'bamboo', x: 20, y: 26 },
    { def: 'jar', x: 8, y: 13 },
];

export const WORLD: World = { ...REAL, villageStarter: FARM_LAYOUT };
