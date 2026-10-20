// 自己地盘里自带的天然地貌：小溪、池塘、大石头、老树、竹丛。坐标是地盘格子坐标，地盘升档长大到能装下才出现。
// 开荒（花 price 金）清掉之后才能在那块地上盖东西；溪水上不开荒也能架木桥。
// 村庄 36×44、小镇 56×64、城市 80×96（data/buildings.ts 的 TIERS），老存档 24×32 那块里尽量少放。
// 换布局改这里；图在 tools/art/objects.ts（wild_ 开头的）。

import { WildDef } from '../core/defs';

const water = (id: string, name: string, x: number, y: number, w: number, h: number, price: number): WildDef =>
    ({ id, name, x, y, w, h, price, terrain: 'water' });
const rock = (id: string, x: number, y: number): WildDef => ({ id, name: '大石头', x, y, w: 2, h: 1, price: 40, sprite: 'wild_boulder' });
const oldTree = (id: string, x: number, y: number): WildDef => ({ id, name: '老树', x, y, w: 2, h: 1, price: 60, sprite: 'wild_old_tree' });
const clump = (id: string, x: number, y: number): WildDef => ({ id, name: '竹丛', x, y, w: 3, h: 1, price: 25, sprite: 'wild_bamboo' });

export const VILLAGE_WILD: WildDef[] = [
    // 小溪：从地盘上边流进来，拐个弯顺着右边一路往下，每段单独开荒
    water('stream_1', '小溪', 31, 0, 2, 12, 60),
    water('stream_2', '小溪', 28, 12, 5, 2, 30),
    water('stream_3', '小溪', 28, 14, 2, 30, 90),
    water('stream_4', '小溪', 28, 44, 2, 20, 60),
    water('stream_5', '小溪', 28, 64, 2, 32, 90),
    // 村庄
    water('pond_1', '池塘', 20, 35, 6, 4, 80),
    rock('rock_1', 4, 6),
    rock('rock_2', 6, 36),
    rock('rock_3', 14, 41),
    rock('rock_4', 33, 22),
    oldTree('tree_1', 33, 6),
    oldTree('tree_2', 10, 39),
    oldTree('tree_3', 16, 36),
    clump('bamboo_1', 31, 30),
    clump('bamboo_2', 31, 38),
    clump('bamboo_3', 2, 41),
    // 小镇
    water('pond_2', '池塘', 42, 12, 7, 5, 100),
    rock('rock_5', 50, 30),
    rock('rock_6', 40, 52),
    rock('rock_7', 8, 50),
    oldTree('tree_4', 46, 24),
    oldTree('tree_5', 20, 56),
    oldTree('tree_6', 52, 58),
    clump('bamboo_4', 38, 4),
    clump('bamboo_5', 52, 6),
    clump('bamboo_6', 12, 60),
    // 城市
    water('pond_3', '池塘', 62, 20, 10, 6, 150),
    water('pond_4', '池塘', 40, 80, 8, 5, 120),
    rock('rock_8', 66, 50),
    rock('rock_9', 74, 82),
    rock('rock_10', 12, 72),
    rock('rock_11', 50, 90),
    oldTree('tree_7', 60, 40),
    oldTree('tree_8', 70, 66),
    oldTree('tree_9', 18, 86),
    oldTree('tree_10', 76, 30),
    clump('bamboo_7', 58, 88),
    clump('bamboo_8', 76, 10),
    clump('bamboo_9', 6, 92),
];
