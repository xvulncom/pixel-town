// 镇民心愿：代替星露谷的社区中心收集包，完成后修好建筑、迎回新镇民。

import { WishDef } from '../core/defs';

export const WISHES: Record<string, WishDef> = {
    zhou_workshop: {
        id: 'zhou_workshop',
        npcId: 'zhou',
        title: '重开木工坊',
        story: '老周的木工坊关了快十年，屋顶漏雨、门轴也锈了。凑齐木料和修缮的钱，他也许会给在城里的徒弟小树打个电话。',
        minHearts: 3,
        requires: { items: { wood: 30 }, gold: 500 },
        rewards: { unlock: ['building:workshop', 'resident:xiaoshu'], affinity: 150 },
    },
    gui_icebox: {
        id: 'gui_icebox',
        npcId: 'gui',
        title: '杂货铺的冷饮柜',
        story: '桂姨想在杂货铺门口摆个冷饮柜，夏天卖自制的果汁。她说小满小时候最爱趴在冷饮柜上挑冰棍。',
        minHearts: 2,
        requires: { items: { 'crop:cucumber': 5, 'crop:tomato': 5 }, gold: 300 },
        rewards: { unlock: ['shop:drinks'], affinity: 100 },
    },
};
