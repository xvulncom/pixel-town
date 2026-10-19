// 建筑图集：玩家自己地盘上能摆的东西，每样一整张图（不切块），游戏里按名字取。
// 名字对应 assets/scripts/data/buildings.ts 里的 sprite；加新建筑在这里登记一行。

import { mulberry32 } from '../../assets/scripts/core/rng';
import { Canvas, Pen, TILE } from './canvas';
import {
    bamboo, bush, fence, house, lanternPost, laundry, pineTree, pottedPlant, roundTree, stall, stoneBench, waterJar, well,
    rocks, willow, woodpile,
} from './props';
import { flowerPatch, tallGrass } from './terrain';
import { archway, stage, teaTable } from './town';
import { LOOKS, cropRipeArt, cropStageArt } from './crops';
import { FISH_LOOKS, fishArt, fishSize } from './fish';

interface ObjectArt {
    /** 图的大小（格） */
    w: number;
    h: number;
    paint: (p: Pen) => void;
}

export const OBJECTS: Record<string, ObjectArt> = {
    house: { w: 6, h: 5, paint: (p) => house(p, 6, 5) },
    house_gable: { w: 6, h: 5, paint: (p) => house(p, 6, 5, { gable: true, couplet: true }) },
    house_2f: { w: 6, h: 6, paint: (p) => house(p, 6, 6, { gable: true, floors: 2 }) },
    workshop: { w: 6, h: 5, paint: (p) => house(p, 6, 5, { sign: 'workshop' }) },
    shop: { w: 7, h: 6, paint: (p) => house(p, 7, 6, { sign: 'shop', floors: 2 }) },
    stage: { w: 6, h: 5, paint: stage },
    archway: { w: 6, h: 4, paint: archway },
    well: { w: 2, h: 2, paint: well },
    stall_fruit: { w: 3, h: 3, paint: (p) => stall(p, [0x3d6fb0, 0xf1eee4], [0xe3b341, 0x7cc04e, 0xd24a3d]) },
    stall_bun: { w: 3, h: 3, paint: (p) => stall(p, [0x5f8a5a, 0xf1eee4], [0xd9b37a, 0xefefe6]) },
    stall_cloth: { w: 3, h: 3, paint: (p) => stall(p, [0xe3b341, 0xf1eee4], [0x3d6fb0, 0xe98fa6, 0x7cc0b0]) },
    tea_table: { w: 2, h: 2, paint: teaTable },
    bench: { w: 2, h: 1, paint: stoneBench },
    laundry: { w: 3, h: 2, paint: laundry },
    woodpile: { w: 2, h: 1, paint: woodpile },
    lantern: { w: 1, h: 3, paint: lanternPost },
    jar: { w: 1, h: 1, paint: waterJar },
    pot: { w: 1, h: 1, paint: pottedPlant },
    fence: { w: 1, h: 1, paint: fence },
    tree: { w: 3, h: 5, paint: (p) => roundTree(p) },
    tree_peach: {
        w: 3, h: 5,
        paint: (p) => roundTree(p, { dark: 0x3d7a2e, mid: 0x5a9a40, light: 0x7cc04e, line: 0x2c5e26 }, [0xf7b6c8, 0xfbd3de, 0xe98fa6]),
    },
    pine: { w: 3, h: 5, paint: pineTree },
    bamboo: { w: 3, h: 5, paint: bamboo },
    willow: { w: 3, h: 5, paint: willow },
    // 地盘外圈的杂草、灌木（见 data/villageBorder.ts）；三种杂草画法一样，随机数不同长得不一样
    weeds_1: { w: 1, h: 1, paint: tallGrass },
    weeds_2: { w: 1, h: 1, paint: tallGrass },
    weeds_3: { w: 1, h: 1, paint: tallGrass },
    shrub: { w: 1, h: 1, paint: bush },
    wildflowers: { w: 1, h: 1, paint: (p) => flowerPatch(p, [0xf7f2e8, 0xe98fa6, 0xb7a0e0]) },
    rocks: { w: 1, h: 1, paint: rocks },
    // 菜地上的作物（见 crops.ts），名字和 core/fields.ts 的 cropSprite 对应
    crop_sprout: { w: 1, h: 2, paint: (p) => cropStageArt(p, 'sprout') },
    crop_young: { w: 1, h: 2, paint: (p) => cropStageArt(p, 'young') },
    crop_withered: { w: 1, h: 2, paint: (p) => cropStageArt(p, 'withered') },
    ...Object.fromEntries(Object.entries(LOOKS).map(([id, look]) => [`crop_${id}`, { w: 1, h: 2, paint: (p: Pen) => cropRipeArt(p, look) }])),
    // 鱼（见 fish.ts），钓鱼和摆摊界面用
    ...Object.fromEntries(Object.entries(FISH_LOOKS).map(([id, look]) => [`fish_${id}`, { w: fishSize(look)[0], h: fishSize(look)[1], paint: (p: Pen) => fishArt(p, look) }])),
};

/** 按高度排成几行拼进一张图，返回图和每张的 [x, y, w, h]（像素）。 */
export function packObjects(width = 512): { canvas: Canvas; frames: Record<string, [number, number, number, number]> } {
    const names = Object.keys(OBJECTS).sort((a, b) => OBJECTS[b].h - OBJECTS[a].h || a.localeCompare(b));
    const frames: Record<string, [number, number, number, number]> = {};
    let x = 0;
    let y = 0;
    let rowH = 0;
    for (const n of names) {
        const pw = OBJECTS[n].w * TILE;
        const ph = OBJECTS[n].h * TILE;
        if (x + pw > width) {
            x = 0;
            y += rowH;
            rowH = 0;
        }
        frames[n] = [x, y, pw, ph];
        x += pw;
        rowH = Math.max(rowH, ph);
    }
    const canvas = new Canvas(width, y + rowH);
    names.forEach((n, i) => {
        const [fx, fy, fw, fh] = frames[n];
        const one = new Canvas(fw, fh);
        OBJECTS[n].paint(new Pen(one, mulberry32(5000 + i)));
        for (let yy = 0; yy < fh; yy++) {
            for (let xx = 0; xx < fw; xx++) {
                const si = (yy * fw + xx) * 4;
                const di = ((fy + yy) * width + fx + xx) * 4;
                for (let k = 0; k < 4; k++) canvas.px[di + k] = one.px[si + k];
            }
        }
    });
    return { canvas, frames };
}
