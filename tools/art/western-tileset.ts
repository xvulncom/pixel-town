// 西部牛仔镇的图块集：单独一张 western-tiles.png（不和江南共用），WG 里按名字取图块编号。
// 新增西部素材：在 western.ts 写画法，在这里登记一行，tools/maps/western.ts 里按名字用。

import { Pen } from './canvas';
import { Sheet } from './sheet';
import {
    WC, barn, barrel, barrelCactus, bedPaint, boardPaint, boulder, cabin, chapel, coveredWagon, cowSkull, crateW, deadTree,
    desertCrop, desertTile, dryGrass, falseFront, fenceH, fenceV, fieldPaint, hayBale, hayCart, hitchingPost, horse, longhorn,
    mesaFace, mesaSide, mesaStairs, mesaTop, mesaTopEdge, mineEntrance, noticeBoard, oilLamp, outhouse, pondPaint, pricklyPear,
    redRocks, sagebrush, saguaro, saguaroYoung, sandTile, scrubPaint, smithy, streetPaint, trough, tumbleweed,
    wagonWheel, waterTower, windmill, woodBench,
} from './western';

export const westernSheet = new Sheet();
const s = westernSheet;
const terrain16 = (paint: (m: number) => (p: Pen) => void) => Array.from({ length: 16 }, (_, m) => s.add(paint(m)));

export const WG = {
    sand: [
        s.add((p) => sandTile(p, 'plain')),
        s.add((p) => sandTile(p, 'plain2')),
        s.add((p) => sandTile(p, 'pebbles')),
        s.add((p) => sandTile(p, 'ripple')),
        s.add((p) => sandTile(p, 'tuft')),
    ],
    /** 成片的暗沙地，按四邻收边（江南的深草同一个做法） */
    scrub: terrain16((m) => (p) => desertTile(p, m, 1, 3, scrubPaint(p.r))),
    street: terrain16((m) => (p) => desertTile(p, m, 0, 1, streetPaint(p.r))),
    boards: terrain16((m) => (p) => desertTile(p, m, 0, 0, boardPaint(p.r))),
    bed: terrain16((m) => (p) => desertTile(p, m, 0, 2, bedPaint(p.r))),
    field: terrain16((m) => (p) => desertTile(p, m, 1, 0, fieldPaint(p.r))),
    pond: terrain16((m) => (p) => desertTile(p, m, 0, 1, pondPaint(0))),
    /** 饮马塘开阔水面的 4 帧动画，第 0 帧就是 pond[15] */
    pondAnims: [] as number[][],
    mesaTop: [0, 1, 2, 3].map(() => s.add(mesaTop)),

    /** 台地崖壁：[行][收口][变体]，行 0 顶 1 中 2 底 3 只有一行；收口 0 左 1 中 2 右；每种 3 个变体混用，免得看出重复 */
    cliff: (['top', 'mid', 'bot', 'one'] as const).map((row) => (['l', 'm', 'r'] as const).map((end) => [0, 1, 2].map(() => s.add((p) => mesaFace(p, row, end))))),
    cliffStairs: (['top', 'mid', 'bot', 'one'] as const).map((row) => s.add((p) => mesaStairs(p, row))),
    cliffSideL: s.add((p) => mesaSide(p, 'l')),
    cliffSideR: s.add((p) => mesaSide(p, 'r')),
    cliffTop: s.add(mesaTopEdge),

    // ---------- 主街上的假门脸木楼（7×6 店铺、6×5 小铺子） ----------
    saloon: s.sprite(8, 6, (p) => falseFront(p, 8, 6, {
        siding: 0xa8402e, trim: 0xeadfc4, sign: 'SALOON', signBg: 0x2a1c12, signInk: 0xe3b341,
        floors: 2, balcony: true, door: 'swing', parapet: 'step', curtain: 0xd8b040,
    })),
    hotel: s.sprite(7, 6, (p) => falseFront(p, 7, 6, {
        siding: 0x5f8f8a, trim: 0xeadfc4, sign: 'HOTEL', floors: 2, balcony: true, parapet: 'flat', curtain: 0xc9302c,
    })),
    store: s.sprite(7, 6, (p) => falseFront(p, 7, 6, {
        siding: 0xc8a050, trim: 0x6e4a2c, sign: 'GENERAL\nSTORE', windows: 'shop', door: 'double', goods: true, parapet: 'flat',
    })),
    bank: s.sprite(7, 6, (p) => falseFront(p, 7, 6, {
        siding: 0xa4533a, trim: 0xd8ccb4, sign: 'BANK', signBg: 0x2a2a30, signInk: 0xe3b341, brick: true, parapet: 'arch', door: 'double', porch: false,
    })),
    sheriff: s.sprite(6, 5, (p) => falseFront(p, 6, 5, {
        siding: 0x8a9aa0, trim: 0xeadfc4, sign: 'SHERIFF', windows: 'jail', badge: true, parapet: 'flat',
    })),
    barber: s.sprite(6, 5, (p) => falseFront(p, 6, 5, { siding: 0xe8e0cc, trim: 0x5f7f8f, sign: 'BARBER', pole: true, parapet: 'arch' })),
    post: s.sprite(6, 5, (p) => falseFront(p, 6, 5, { siding: 0x9a6a3e, trim: 0xeadfc4, sign: 'POST', parapet: 'step' })),
    assay: s.sprite(6, 5, (p) => falseFront(p, 6, 5, { siding: 0x7a8a5a, trim: 0xeadfc4, sign: 'ASSAY', parapet: 'flat', goods: true })),
    cafe: s.sprite(6, 5, (p) => falseFront(p, 6, 5, { siding: 0xd8a070, trim: 0x6e4a2c, sign: 'CAFE', parapet: 'arch', curtain: 0xc9302c })),
    doctor: s.sprite(6, 5, (p) => falseFront(p, 6, 5, { siding: 0xe8e0cc, trim: 0x3d6fb0, sign: 'DOCTOR', parapet: 'flat' })),
    stage: s.sprite(7, 6, (p) => falseFront(p, 7, 6, {
        siding: 0x6a8aa8, trim: 0xeadfc4, sign: 'STAGE\nLINE', door: 'double', parapet: 'step', goods: true,
    })),
    feed: s.sprite(7, 6, (p) => falseFront(p, 7, 6, { siding: 0xb08a5a, trim: 0xeadfc4, sign: 'FEED', door: 'double', windows: 'shop', goods: true, roof: WC.tin })),
    livery: s.sprite(9, 6, (p) => barn(p, 9, 6, 0xa8402e, 'LIVERY')),
    ranchBarn: s.sprite(9, 6, (p) => barn(p, 9, 6, 0x9a5a3a)),
    smithy: s.sprite(7, 5, (p) => smithy(p, 7, 5)),
    chapel: s.sprite(6, 8, (p) => chapel(p, 6, 8)),
    cabins: [
        s.sprite(6, 5, (p) => cabin(p, 6, 5)),
        s.sprite(6, 5, (p) => cabin(p, 6, 5, WC.tin)),
    ],
    waterTower: s.sprite(3, 6, (p) => waterTower(p, 3, 6)),
    windmill: s.sprite(3, 7, (p) => windmill(p, 3, 7)),
    outhouse: s.sprite(2, 3, outhouse),
    mine: s.sprite(4, 3, mineEntrance),
    noticeBoard: s.sprite(3, 3, noticeBoard),

    // ---------- 街上的小物件 ----------
    hitch: s.sprite(2, 1, hitchingPost),
    trough: s.sprite(2, 1, trough),
    bench: s.sprite(2, 1, woodBench),
    barrel: s.add(barrel),
    crate: s.add(crateW),
    hay: s.add(hayBale),
    wheel: s.add(wagonWheel),
    lamp: s.sprite(1, 2, oilLamp),
    wagon: s.sprite(4, 3, coveredWagon),
    cart: s.sprite(3, 2, hayCart),
    horses: [
        s.sprite(3, 2, (p) => horse(p, 0x8a5a34, 0x3a2418, 0x5a3a20)),
        s.sprite(3, 2, (p) => horse(p, 0x3a2a20, 0x1a1410, 0x8a3a2a)),
        s.sprite(3, 2, (p) => horse(p, 0xd8c8a8, 0x8a7a5a)),
        s.sprite(3, 2, (p) => horse(p, 0xb07038, 0xeee6d6)),
    ],
    cows: [
        s.sprite(2, 2, (p) => longhorn(p, 0xa0603a)),
        s.sprite(2, 2, (p) => longhorn(p, 0x5a3a2a)),
    ],
    fenceH: s.add(fenceH),
    fenceV: s.add(fenceV),
    corn: s.sprite(1, 2, (p) => desertCrop(p, 'corn')),
    chili: s.sprite(1, 2, (p) => desertCrop(p, 'chili')),

    // ---------- 荒漠植物和石头 ----------
    saguaros: [
        s.sprite(3, 5, (p) => saguaro(p, 2)),
        s.sprite(3, 5, (p) => saguaro(p, 1)),
        s.sprite(3, 4, (p) => saguaro(p, 1, 4)),
    ],
    saguaroYoung: s.sprite(1, 3, saguaroYoung),
    deadTree: s.sprite(3, 5, deadTree),
    pricklyPear: s.add(pricklyPear),
    barrelCactus: s.add(barrelCactus),
    tumbleweeds: [0, 1].map(() => s.add(tumbleweed)),
    sage: [0, 1].map(() => s.add(sagebrush)),
    dryGrass: [0, 1, 2].map(() => s.add(dryGrass)),
    rocks: s.add(redRocks),
    boulder: s.sprite(2, 2, boulder),
    skull: s.add(cowSkull),
};

WG.pondAnims = [[WG.pond[15], ...[1, 2, 3].map((f) => s.add((p) => desertTile(p, 15, 0, 1, pondPaint(f))))]];
