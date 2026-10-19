// 组装图块集：所有地图共用一张 town-tiles.png，G 里按名字取图块编号。
// 新增素材：在 art/ 下写画法，在这里登记一行，地图布局里按名字用。

import { Pen, TILE, texture } from './canvas';
import { C } from './palette';
import { Sheet } from './sheet';
import { dirtPaint, flowerPatch, grassFill, grassTile, SHINES, soilPaint, stonePaint, tallGrass, terrainTile, waterPaint } from './terrain';
import {
    bamboo, boat, bush, crop, fence, house, lanternPost, laundry, lilyPad, pineTree, pottedPlant, rocks, roundTree,
    stall, stoneBench, stoneBridge, waterJar, well, willow, woodpile,
} from './props';
import {
    archway, boatReflection, hireBoard, stage, tanghulu, teaTable, wallGate, wallH, wallV, waterSteps, willowReflection,
} from './town';

export const RIVER_H = 5;
export const CANAL_W = 3;

export const sheet = new Sheet();
const terrain16 = (paint: (m: number) => (p: Pen) => void) =>
    Array.from({ length: 16 }, (_, m) => sheet.add(paint(m)));

export const G = {
    grass: [
        sheet.add((p) => grassTile(p, 'plain')),
        sheet.add((p) => grassTile(p, 'plain2')),
        sheet.add((p) => grassTile(p, 'tuft')),
        sheet.add((p) => grassTile(p, 'flowers')),
    ],
    lush: terrain16((m) => (p) => {
        const tex = texture(p.r, (q) => grassFill(q, C.lush, C.lushBlade));
        terrainTile(p, m, 1, 4, (x, y) => tex(x, y));
    }),
    dirt: terrain16((m) => (p) => terrainTile(p, m, 0, 1, dirtPaint(p.r))),
    water: terrain16((m) => (p) => terrainTile(p, m, 0, 0, waterPaint(0))),
    soil: terrain16((m) => (p) => terrainTile(p, m, 1, 0, soilPaint(p.r))),
    stone: terrain16((m) => (p) => terrainTile(p, m, 0, 0, stonePaint(p.r))),
    // 大片石板多几种切法，随机混铺
    stoneFill: Array.from({ length: 5 }, () => sheet.add((p) => terrainTile(p, 15, 0, 0, stonePaint(p.r)))),
    // 开阔水面：每组 4 帧，第 0 帧摆在地图上；第 0 组的第 0 帧就是 water[15]
    waterAnims: [] as number[][],

    // 民居三种：普通、马头墙贴对联、两层马头墙
    houses: [
        sheet.sprite(6, 5, (p) => house(p, 6, 5)),
        sheet.sprite(6, 5, (p) => house(p, 6, 5, { gable: true, couplet: true })),
        sheet.sprite(6, 6, (p) => house(p, 6, 6, { gable: true, floors: 2 })),
    ],
    shop: sheet.sprite(7, 6, (p) => house(p, 7, 6, { sign: 'shop', floors: 2 })),
    workshop: sheet.sprite(6, 5, (p) => house(p, 6, 5, { sign: 'workshop' })),
    wallH: sheet.sprite(1, 2, wallH),
    wallV: sheet.add(wallV),
    gate: sheet.sprite(2, 2, wallGate),
    stage: sheet.sprite(6, 5, stage),
    archway: sheet.sprite(6, 4, archway),

    tree: sheet.sprite(3, 5, (p) => roundTree(p)),
    trees: [
        sheet.sprite(3, 5, (p) => roundTree(p)),
        sheet.sprite(3, 5, (p) => roundTree(p, { dark: 0x3d7a2e, mid: 0x4f9038, light: 0x72b552, line: 0x2c5e26 })),
        sheet.sprite(3, 5, (p) => roundTree(p, { dark: 0x3d7a2e, mid: 0x5a9a40, light: 0x7cc04e, line: 0x2c5e26 }, [0xf7b6c8, 0xfbd3de, 0xe98fa6])),
        sheet.sprite(3, 5, pineTree),
        sheet.sprite(3, 5, bamboo),
    ],
    willow: sheet.sprite(3, 5, willow),

    well: sheet.sprite(2, 2, well),
    stalls: [
        sheet.sprite(3, 3, (p) => stall(p, [0x3d6fb0, 0xf1eee4], [0xe3b341, 0x7cc04e, 0xd24a3d])),
        sheet.sprite(3, 3, (p) => stall(p, [0xc9302c, 0xf1eee4], [0xf3d892, 0xefefe6, 0x8a5a34])),
        // 包子摊：竹蒸笼
        sheet.sprite(3, 3, (p) => stall(p, [0x5f8a5a, 0xf1eee4], [0xd9b37a, 0xefefe6])),
        // 布摊：几匹花布
        sheet.sprite(3, 3, (p) => stall(p, [0xe3b341, 0xf1eee4], [0x3d6fb0, 0xe98fa6, 0x7cc0b0])),
    ],
    teaTable: sheet.sprite(2, 2, teaTable),
    tanghulu: sheet.sprite(1, 3, tanghulu),
    hireBoard: sheet.sprite(3, 3, hireBoard),
    laundry: sheet.sprite(3, 2, laundry),
    woodpile: sheet.sprite(2, 1, woodpile),
    bench: sheet.sprite(2, 1, stoneBench),
    jar: sheet.add(waterJar),
    pot: sheet.add(pottedPlant),

    tallGrass: [0, 1, 2].map(() => sheet.add(tallGrass)),
    flowers: [
        sheet.add((p) => flowerPatch(p, [0xf4e27a, 0xf7f7f2])),
        sheet.add((p) => flowerPatch(p, [0xe98fa6, 0xf7f7f2])),
        sheet.add((p) => flowerPatch(p, [0x9db8f0, 0xc9b4f0])),
    ],
    bush: sheet.add(bush),
    rocks: sheet.add(rocks),
    fence: sheet.add(fence),

    bridgeV: sheet.sprite(2, RIVER_H, (p) => stoneBridge(p, RIVER_H * TILE, true)),
    bridgeH: sheet.sprite(CANAL_W, 2, (p) => stoneBridge(p, CANAL_W * TILE, false)),
    boat: sheet.sprite(4, 2, boat),
    lily: sheet.add(lilyPad),
    stepsDown: sheet.sprite(2, 1, (p) => waterSteps(p, 'down')),
    stepsUp: sheet.sprite(2, 1, (p) => waterSteps(p, 'up')),
    stepsRight: sheet.sprite(1, 2, (p) => waterSteps(p, 'right')),
    stepsLeft: sheet.sprite(1, 2, (p) => waterSteps(p, 'left')),
    willowRefl: sheet.sprite(3, 1, willowReflection),
    boatRefl: sheet.sprite(4, 1, boatReflection),
    lanternPost: sheet.sprite(1, 3, lanternPost),

    sprout: sheet.sprite(1, 2, (p) => crop(p, 'sprout')),
    cabbage: sheet.sprite(1, 2, (p) => crop(p, 'cabbage')),
    rice: sheet.sprite(1, 2, (p) => crop(p, 'rice')),
};

G.waterAnims = SHINES.map((_, v) => {
    const first = v === 0 ? G.water[15] : sheet.add((p) => terrainTile(p, 15, 0, 0, waterPaint(0, v)));
    return [first, ...[1, 2, 3].map((f) => sheet.add((p) => terrainTile(p, 15, 0, 0, waterPaint(f, v))))];
});
