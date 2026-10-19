// 集市摆摊的参数。一轮大约能卖 15～20 单，按当季作物收购价的两成算，一轮一两百金，每天前 3 轮给钱。

import { MarketDef } from '../core/defs';

export const MARKET: MarketDef = {
    roundSec: 60,
    roundsPerDay: 3,
    priceRate: 0.2,
    streakStep: 0.1,
    streakMax: 1,
    patience: { start: 4, step: 0.12, min: 1.6 },
    goods: 4,
};
