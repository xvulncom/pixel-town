// 招工处能雇的人和雇工规则。加一个人只在 WORKERS 加一行；look 对应 people-frames.json 的行名（每人一行，走路帧和对话立绘都按它取）。
// traits 全部藏着不给玩家看，玩家只能从口碑和干活结果去猜（见方案「雇人干活」）。

import { HiringDef, WorkerDef } from '../core/defs';

const LIST: WorkerDef[] = [
    {
        id: 'aqiang', name: '阿强', role: 'farmhand', look: 'aqiang', ask: 90, workHours: [7, 18],
        intro: '在工地干过两年，力气有的是。',
        traits: { skill: 9, laziness: 0.35, greed: 0.1, pride: 0.7, eye: 0.3 },
    },
    {
        id: 'xiaofang', name: '小芳', role: 'farmhand', look: 'xiaofang', ask: 70, workHours: [8, 17],
        intro: '家里种过菜，手慢点但细。',
        traits: { skill: 5, laziness: 0.05, greed: 0.05, pride: 0.4, eye: 0.5 },
    },
    {
        id: 'erleng', name: '二愣', role: 'farmhand', look: 'erleng', ask: 40, workHours: [9, 18],
        intro: '啥都能干，给口饭吃就行。',
        traits: { skill: 4, laziness: 0.45, greed: 0.35, pride: 0.1, eye: 0.1 },
    },
    {
        id: 'liushen', name: '刘婶', role: 'farmhand', look: 'liushen', ask: 110, workHours: [6, 16],
        intro: '种了三十年地，一个顶俩，就是贵。',
        traits: { skill: 10, laziness: 0.1, greed: 0.2, pride: 0.8, eye: 0.6 },
    },
    {
        id: 'laoma', name: '老马', role: 'farmhand', look: 'laoma', ask: 60, workHours: [5, 14],
        intro: '起得早，下午要回家带孙子。',
        traits: { skill: 6, laziness: 0.15, greed: 0, pride: 0.5, eye: 0.7 },
    },
    {
        id: 'dahai', name: '大海', role: 'farmhand', look: 'dahai', ask: 80, workHours: [10, 21],
        intro: '夜猫子，晚上也能干。',
        traits: { skill: 7, laziness: 0.25, greed: 0.15, pride: 0.3, eye: 0.4 },
    },
    {
        id: 'xiaowen', name: '小文', role: 'assistant', look: 'xiaowen', ask: 100, workHours: [9, 18],
        intro: '读过书，会记账，看人挺准。',
        traits: { skill: 3, laziness: 0.1, greed: 0, pride: 0.6, eye: 0.85 },
    },
    {
        id: 'apeng', name: '阿鹏', role: 'assistant', look: 'apeng', ask: 60, workHours: [8, 20],
        intro: '跑腿最快，镇上人都熟。',
        traits: { skill: 4, laziness: 0.3, greed: 0.1, pride: 0.3, eye: 0.35 },
    },
];

export const WORKERS: Record<string, WorkerDef> = Object.fromEntries(LIST.map((d) => [d.id, d]));

export const HIRING: HiringDef = {
    dailyCandidates: 4,
    housing: ['house', 'house_gable', 'house_2f'],
    perHouse: 2,
    offers: [
        { id: 'low', name: '压价', rate: 0.8 },
        { id: 'fair', name: '照价', rate: 1 },
        { id: 'high', name: '加价', rate: 1.25 },
    ],
    pieceSlack: 0.3,
    watchSlack: 0.4,
    watchWindowMs: 2 * 60 * 1000,
    slackSpellMin: 10,
    maxUnpaid: 2,
    morale: { start: 70, paid: 5, raise: 10, unpaid: 30, tooLittle: 15, quitBelow: 10 },
    pieceFairRatio: 0.6,
    pieceBusyRatio: 0.5,
    errandMinutes: 30,
    errandLazy: 2,
    inPersonEye: 0.9,
    rumors: {
        laziness: [
            { min: 0.4, text: '听说爱偷懒' },
            { min: 0.2, text: '干活一般' },
            { min: -1, text: '都说勤快' },
        ],
        skill: [
            { min: 8, text: '手脚麻利' },
            { min: 5, text: '手上不快不慢' },
            { min: -1, text: '手有点慢' },
        ],
        greedy: { min: 0.25, text: '嘴有点馋' },
    },
    logLimit: 40,
};
