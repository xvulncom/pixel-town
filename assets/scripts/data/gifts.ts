// 店里卖的礼物：买了放背包，点有人设的镇民时可以送（每人每天一次），喜好写在 data/npcs.ts 的 likes / dislikes（`gift:<id>`）。
// sprite 是室内图集 interior.png 里的图名，画法在 tools/art/interior.ts 的 GIFT_ART。加礼物两边各加一行。

import { GiftDef } from '../core/shop';

const g = (id: string, name: string, price: number): GiftDef => ({ id, name, price, sprite: `gift_${id}` });

const LIST: GiftDef[] = [
    // 江南
    g('longjing', '龙井茶', 60),
    g('osmanthus_cake', '桂花糕', 25),
    g('silk_hanky', '丝绸手帕', 80),
    g('indigo_cloth', '蓝印花布', 50),
    g('rice_cake', '年糕', 20),
    g('glutinous_rice', '糯米', 15),
    g('wood_comb', '木梳', 35),
    g('candy', '麦芽糖', 10),
    // 西部
    g('root_beer', '沙士汽水', 15),
    g('jerky', '牛肉干', 25),
    g('coffee', '咖啡豆', 30),
    g('apple_pie', '苹果派', 40),
    g('horseshoe', '幸运马蹄铁', 45),
    g('postcard', '风景明信片', 10),
    g('gold_nugget', '小金块', 300),
    g('herb_tea', '草药茶', 20),
];

export const GIFTS: Record<string, GiftDef> = Object.fromEntries(LIST.map((d) => [d.id, d]));
