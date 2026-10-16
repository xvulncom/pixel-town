// 作物表。时间单位是湿润小时：干燥时生长速度减半。
// 定价思路：快熟作物单价低、适合中午顺手收；慢熟作物单价高、适合睡前种；多次收获作物种子贵但能一直收。

import { CropDef } from '../core/defs';

export const CROPS: Record<string, CropDef> = {
    // 春
    bokchoy: { id: 'bokchoy', name: '小白菜', seasons: ['spring'], growHours: 2, seedPrice: 10, sellPrice: 24 },
    pea: { id: 'pea', name: '豌豆', seasons: ['spring'], growHours: 6, seedPrice: 20, sellPrice: 55 },
    strawberry: { id: 'strawberry', name: '草莓', seasons: ['spring'], growHours: 12, regrowHours: 8, seedPrice: 60, sellPrice: 45 },
    spinach: { id: 'spinach', name: '菠菜', seasons: ['spring', 'winter'], growHours: 4, seedPrice: 15, sellPrice: 40 },
    // 夏
    cucumber: { id: 'cucumber', name: '黄瓜', seasons: ['summer'], growHours: 6, regrowHours: 4, seedPrice: 40, sellPrice: 30 },
    tomato: { id: 'tomato', name: '番茄', seasons: ['summer'], growHours: 8, regrowHours: 6, seedPrice: 50, sellPrice: 40 },
    watermelon: { id: 'watermelon', name: '西瓜', seasons: ['summer'], growHours: 16, seedPrice: 80, sellPrice: 260 },
    corn: { id: 'corn', name: '玉米', seasons: ['summer', 'autumn'], growHours: 10, seedPrice: 35, sellPrice: 110 },
    // 秋
    radish: { id: 'radish', name: '萝卜', seasons: ['autumn'], growHours: 5, seedPrice: 20, sellPrice: 58 },
    sweetpotato: { id: 'sweetpotato', name: '红薯', seasons: ['autumn'], growHours: 8, seedPrice: 30, sellPrice: 90 },
    pumpkin: { id: 'pumpkin', name: '南瓜', seasons: ['autumn'], growHours: 18, seedPrice: 90, sellPrice: 300 },
    grape: { id: 'grape', name: '葡萄', seasons: ['autumn'], growHours: 12, regrowHours: 8, seedPrice: 70, sellPrice: 50 },
    // 冬
    napa: { id: 'napa', name: '大白菜', seasons: ['winter'], growHours: 10, seedPrice: 30, sellPrice: 100 },
    // 地域特产：只在所属地域的种子店卖（见 regions.ts），其他地域靠好友赠送
    cherry: { id: 'cherry', name: '樱桃', seasons: ['spring'], growHours: 14, regrowHours: 10, seedPrice: 120, sellPrice: 90, specialty: true },
    yangmei: { id: 'yangmei', name: '杨梅', seasons: ['summer'], growHours: 14, regrowHours: 10, seedPrice: 120, sellPrice: 95, specialty: true },
    lychee: { id: 'lychee', name: '荔枝', seasons: ['summer'], growHours: 18, regrowHours: 12, seedPrice: 120, sellPrice: 110, specialty: true },
    tangerine: { id: 'tangerine', name: '砂糖橘', seasons: ['winter'], growHours: 16, regrowHours: 12, seedPrice: 120, sellPrice: 100, specialty: true },
    blueberry: { id: 'blueberry', name: '蓝莓', seasons: ['summer'], growHours: 14, regrowHours: 10, seedPrice: 120, sellPrice: 95, specialty: true },
    soybean: { id: 'soybean', name: '黑土大豆', seasons: ['autumn'], growHours: 12, seedPrice: 60, sellPrice: 190, specialty: true },
    huajiao: { id: 'huajiao', name: '花椒', seasons: ['summer'], growHours: 16, regrowHours: 12, seedPrice: 120, sellPrice: 100, specialty: true },
    persimmon: { id: 'persimmon', name: '柿子', seasons: ['autumn'], growHours: 16, regrowHours: 10, seedPrice: 120, sellPrice: 100, specialty: true },
    goji: { id: 'goji', name: '枸杞', seasons: ['summer'], growHours: 14, regrowHours: 10, seedPrice: 120, sellPrice: 95, specialty: true },
    apple: { id: 'apple', name: '苹果', seasons: ['autumn'], growHours: 18, regrowHours: 12, seedPrice: 120, sellPrice: 110, specialty: true },
};
