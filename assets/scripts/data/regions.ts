// 地域：开局选老家。地图风格、气候、种子店货架、特产各不相同。
// 不画带国界、省界的真实地图，只用地域名和风格化场景，避免地图审核问题。

import { RegionDef } from '../core/defs';

const COMMON = [
    'bokchoy', 'pea', 'strawberry', 'spinach',
    'cucumber', 'tomato', 'watermelon', 'corn',
    'radish', 'sweetpotato', 'pumpkin', 'grape',
    'napa',
];

export const REGIONS: Record<string, RegionDef> = {
    jiangnan: {
        id: 'jiangnan',
        name: '江南水乡',
        blurb: '小桥流水，春天多雨，初夏有梅雨。',
        map: 'jiangnan',
        climate: { wetChance: { spring: 0.4, summer: 0.4, autumn: 0.2, winter: 0.15 }, snow: true },
        crops: COMMON,
        specialties: ['cherry', 'yangmei'],
    },
    lingnan: {
        id: 'lingnan',
        name: '岭南',
        blurb: '一年到头都暖和，冬天不下雪，冬天也能种菜。',
        map: 'lingnan',
        climate: { wetChance: { spring: 0.4, summer: 0.45, autumn: 0.25, winter: 0.1 }, snow: false },
        crops: COMMON.filter((c) => c !== 'napa'),
        specialties: ['lychee', 'tangerine'],
        seasonOverrides: {
            bokchoy: ['spring', 'autumn', 'winter'],
            spinach: ['spring', 'autumn', 'winter'],
            tomato: ['spring', 'summer', 'winter'],
            strawberry: ['winter', 'spring'],
        },
    },
    dongbei: {
        id: 'dongbei',
        name: '东北黑土地',
        blurb: '夏天短而热，冬天大雪封地，猫冬过年。',
        map: 'dongbei',
        climate: { wetChance: { spring: 0.2, summer: 0.35, autumn: 0.15, winter: 0.3 }, snow: true },
        crops: COMMON.filter((c) => c !== 'strawberry' && c !== 'grape'),
        specialties: ['blueberry', 'soybean'],
        // 冬天地冻上了，什么都种不了
        seasonOverrides: {
            napa: ['autumn'],
            spinach: ['spring'],
        },
    },
    bashu: {
        id: 'bashu',
        name: '川渝山城',
        blurb: '山多雾多，秋天连绵阴雨，冬天很少下雪。',
        map: 'bashu',
        climate: { wetChance: { spring: 0.35, summer: 0.35, autumn: 0.35, winter: 0.15 }, snow: false },
        crops: COMMON,
        specialties: ['huajiao', 'persimmon'],
    },
    xibei: {
        id: 'xibei',
        name: '西北黄土高原',
        blurb: '干燥少雨，日照足，瓜果特别甜。',
        map: 'xibei',
        climate: { wetChance: { spring: 0.1, summer: 0.2, autumn: 0.15, winter: 0.1 }, snow: true },
        crops: COMMON.filter((c) => c !== 'strawberry'),
        specialties: ['goji', 'apple'],
    },
    western: {
        id: 'western',
        name: '西部牛仔镇',
        blurb: '红岩荒漠，常年少雨，夏天又晒又热，夏末偶有雷阵雨，冬天不下雪。',
        map: 'western',
        climate: { wetChance: { spring: 0.08, summer: 0.15, autumn: 0.08, winter: 0.1 }, snow: false },
        // 荒漠里种耐旱的：叶菜、草莓、黄瓜这类费水的不卖
        crops: COMMON.filter((c) => !['bokchoy', 'spinach', 'strawberry', 'cucumber', 'napa'].includes(c)),
        specialties: ['chili', 'pricklypear'],
        // 冬天暖和，萝卜能一直种到冬天
        seasonOverrides: { radish: ['autumn', 'winter'] },
    },
};
