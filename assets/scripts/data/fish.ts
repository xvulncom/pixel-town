// 鱼表。季节、时段、天气决定什么时候能钓到；难度决定提竿窗口和溜鱼时鱼跑多快；权重越小越稀有。
// 鱼的图在 tools/art/fish.ts，加鱼两边各加一行。

import { FishDef } from '../core/defs';

export const FISH: Record<string, FishDef> = {
    baitiao: { id: 'baitiao', name: '白条', seasons: [], hours: [5, 19], difficulty: 1, price: 12, weight: 8 },
    jiyu: { id: 'jiyu', name: '鲫鱼', seasons: [], difficulty: 1, price: 20, weight: 10 },
    liyu: { id: 'liyu', name: '鲤鱼', seasons: [], difficulty: 2, price: 35, weight: 6 },
    caoyu: { id: 'caoyu', name: '草鱼', seasons: ['spring', 'summer', 'autumn'], difficulty: 2, price: 40, weight: 5 },
    bianyu: { id: 'bianyu', name: '鳊鱼', seasons: ['spring', 'autumn'], difficulty: 2, price: 45, weight: 4 },
    xiaolongxia: { id: 'xiaolongxia', name: '小龙虾', seasons: ['summer'], difficulty: 1, price: 25, weight: 6 },
    angci: { id: 'angci', name: '昂刺鱼', seasons: ['summer', 'autumn'], hours: [19, 5], difficulty: 3, price: 60, weight: 3 },
    huangshan: { id: 'huangshan', name: '黄鳝', seasons: ['summer'], weather: ['rain', 'cloudy'], difficulty: 3, price: 70, weight: 3 },
    yinyu: { id: 'yinyu', name: '太湖银鱼', seasons: ['spring', 'winter'], hours: [5, 9], regions: ['jiangnan'], difficulty: 2, price: 50, weight: 2 },
    guiyu: { id: 'guiyu', name: '鳜鱼', seasons: ['spring'], difficulty: 4, price: 120, weight: 2 },
    dazhaxie: { id: 'dazhaxie', name: '大闸蟹', seasons: ['autumn'], hours: [17, 23], regions: ['jiangnan'], difficulty: 3, price: 150, weight: 1.5 },
    qingyu: { id: 'qingyu', name: '青鱼', seasons: ['winter'], difficulty: 5, price: 200, weight: 1 },
};
