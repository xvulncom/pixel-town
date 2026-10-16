// 镇民人设。bio 是写对话库和二期大模型提示词的依据，改人设时两边一起改。

import { NpcDef } from '../core/defs';

export const NPCS: Record<string, NpcDef> = {
    gui: {
        id: 'gui',
        name: '桂姨',
        role: '杂货铺老板娘',
        bio: '五十出头，镇上唯一一家杂货铺的老板娘，看着主角长大。热心、话多、爱打听，什么消息都是她先知道。'
            + '女儿小满在深圳打工，一年回来一次，她嘴上说"外面好"，其实天天看手机等消息。嘴馋，尤其爱吃甜的。'
            + '说话带点家乡口音，喜欢叫主角小名"娃儿"，动不动就塞东西给人。',
        initialAffinity: 150,
        traits: { diligence: 0.9, laziness: 0.05, greed: 0.25 },
        loves: ['crop:strawberry', 'crop:watermelon', 'crop:cherry'],
        likes: ['crop:tomato', 'crop:grape', 'crop:lychee', 'crop:tangerine', 'crop:persimmon'],
        dislikes: ['crop:radish'],
        workHours: [7, 19],
        schedule: [
            { hour: 6, place: 'gui_home', activity: '起床梳头' },
            { hour: 7, place: 'store', activity: '开门看店' },
            { hour: 12, place: 'store', activity: '在柜台后面吃午饭' },
            { hour: 14, place: 'big_tree', activity: '在村口大树下和人聊天' },
            { hour: 16, place: 'store', activity: '看店、整理货架' },
            { hour: 19, place: 'gui_home', activity: '看电视、和女儿视频' },
            { hour: 22, place: 'gui_home', activity: '睡觉' },
        ],
        rainSchedule: [
            { hour: 6, place: 'gui_home', activity: '起床梳头' },
            { hour: 7, place: 'store', activity: '开门看店' },
            { hour: 12, place: 'store', activity: '在柜台后面吃午饭' },
            { hour: 14, place: 'store', activity: '坐在门口织毛衣看雨' },
            { hour: 19, place: 'gui_home', activity: '看电视、和女儿视频' },
            { hour: 22, place: 'gui_home', activity: '睡觉' },
        ],
    },
    zhou: {
        id: 'zhou',
        name: '老周',
        role: '老木匠',
        bio: '快七十岁的老木匠，镇上的木工坊关了快十年。话少、嘴硬、心软，夸人从来不直接夸。'
            + '唯一的徒弟小树去城里跟装修队干活，老周嘴上说"走了好"，其实一直留着徒弟的那套刨子。'
            + '爱吃烤红薯，晚上喝一小盅酒，下棋输了会耍赖。',
        initialAffinity: 0,
        traits: { diligence: 0.7, laziness: 0.2, greed: 0 },
        loves: ['crop:sweetpotato', 'crop:persimmon'],
        likes: ['crop:corn', 'crop:napa', 'crop:pumpkin', 'wood'],
        dislikes: ['crop:strawberry'],
        workHours: [6, 17],
        schedule: [
            { hour: 5, place: 'zhou_home', activity: '起床' },
            { hour: 6, place: 'river', activity: '沿着河边慢慢走' },
            { hour: 8, place: 'workshop_door', activity: '坐在关着的木工坊门口修小玩意' },
            { hour: 12, place: 'zhou_home', activity: '吃午饭' },
            { hour: 13, place: 'zhou_home', activity: '午睡' },
            { hour: 15, place: 'big_tree', activity: '在村口大树下下棋' },
            { hour: 18, place: 'zhou_home', activity: '喝一小盅酒' },
            { hour: 21, place: 'zhou_home', activity: '睡觉' },
        ],
        rainSchedule: [
            { hour: 5, place: 'zhou_home', activity: '起床' },
            { hour: 8, place: 'zhou_home', activity: '在屋檐下擦工具' },
            { hour: 12, place: 'zhou_home', activity: '吃午饭' },
            { hour: 13, place: 'zhou_home', activity: '午睡' },
            { hour: 18, place: 'zhou_home', activity: '喝一小盅酒' },
            { hour: 21, place: 'zhou_home', activity: '睡觉' },
        ],
    },
};
