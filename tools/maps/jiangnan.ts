// 江南水乡：一条大河横穿，镇中心在北岸（戏台广场、牌坊、杂货铺），南岸是木工坊、水巷人家和西南的农田。
// 人家错落摆，有的带院墙门楼；镇中心铺青石板路，镇外是弯来弯去的土路。

import { noise2d, pick } from '../art/canvas';
import { CANAL_W, G, RIVER_H } from '../art/tileset';
import { MapBuilder, MapData, Terr } from './builder';

export const JIANGNAN_W = 96;
export const JIANGNAN_H = 72;

export function buildJiangnan(): MapData {
    const b = new MapBuilder(JIANGNAN_W, JIANGNAN_H, 20261016);
    const { rnd } = b;
    const W = b.w;
    const H = b.h;

    // ---------- 水 ----------
    const riverY = 34;
    const canalX = 60;
    const canalEnd = 66;
    b.rect(0, riverY, W, RIVER_H, Terr.Water);
    b.rect(canalX, riverY + RIVER_H, CANAL_W, canalEnd - riverY - RIVER_H + 1, Terr.Water);

    // ---------- 路 ----------
    // 镇中心：北岸主街、南岸街、广场、广场到主街的小巷，都铺青石板
    b.rect(36, 4, 20, 14, Terr.Stone);
    b.road([[16, 29], [80, 29]], Terr.Stone);
    b.road([[44, 18], [44, 29]], Terr.Stone);
    b.road([[30, 29], [30, 45]], Terr.Stone);
    b.road([[76, 29], [76, 45]], Terr.Stone);
    b.road([[30, 45], [76, 45]], Terr.Stone);
    // 镇外土路，拐几道弯通到地图边
    b.road([[0, 29], [16, 29]], Terr.Dirt);
    b.road([[24, 0], [24, 10], [30, 10], [30, 29]], Terr.Dirt);
    b.road([[82, 0], [82, 12], [76, 12], [76, 29]], Terr.Dirt);
    b.road([[80, 29], [86, 29], [86, 25], [95, 25]], Terr.Dirt);
    b.road([[30, 46], [30, 50], [28, 50], [28, 71]], Terr.Dirt);
    b.road([[76, 46], [76, 56], [72, 56], [72, 71]], Terr.Dirt);
    b.road([[28, 68], [40, 68], [40, 71]], Terr.Dirt);

    // ---------- 农田 ----------
    const plots: [number, number][] = [];
    for (const py of [51, 56, 61]) for (const px of [8, 13, 18, 23]) plots.push([px, py]);
    for (const [px, py] of plots) b.rect(px, py, 4, 3, Terr.Soil);

    // ---------- 桥和河埠头 ----------
    b.place(30, riverY, G.bridgeV, true);
    b.place(76, riverY, G.bridgeV, true);
    b.place(canalX, 45, G.bridgeH, true);
    for (const x of [12, 40, 52, 68, 88]) b.place(x, riverY, G.stepsDown, true);
    for (const x of [20, 46, 84]) b.place(x, riverY + RIVER_H - 1, G.stepsUp, true);
    for (const y of [49, 62]) b.place(canalX, y, G.stepsRight, true);
    b.place(canalX + CANAL_W - 1, 55, G.stepsLeft, true);

    // ---------- 镇中心广场 ----------
    b.place(43, 0, G.stage);
    for (const [x, y] of [[37, 3], [54, 3], [37, 12], [54, 12]]) b.place(x, y, G.lanternPost);
    b.place(38, 6, G.tree);
    b.place(41, 9, G.well);
    b.place(47, 5, G.stalls[0]);
    b.place(51, 5, G.stalls[2]);
    b.place(47, 10, G.stalls[1]);
    b.place(51, 10, G.stalls[3]);
    b.place(39, 13, G.teaTable);
    b.place(46, 13, G.tanghulu);
    b.place(37, 16, G.bench);
    b.place(51, 16, G.bench);
    b.place(42, 16, G.archway);

    // ---------- 人家 ----------
    const house = () => pick(rnd, G.houses, [0.3, 0.4, 0.3]);
    const yards: [number, number][][] = [];
    /** 普通人家：底边在 baseY 行。 */
    const plain = (x: number, baseY: number, grid = house()) => {
        b.place(x, baseY - grid.length + 1, grid);
        // 门口两侧摆点小物件
        for (const sx of [x - 1, x + 6]) {
            if (rnd() < 0.6) {
                const prop = pick(rnd, [[[G.jar]], [[G.pot]]], [0.5, 0.5]);
                b.tryPlace(sx, baseY, prop);
            }
        }
    };
    // 北岸西片：后排两户带院子，前排三户错开
    yards.push(b.yardHouse(4, 13, G.houses[2]));
    yards.push(b.yardHouse(14, 13, G.houses[1]));
    yards.push(b.yardHouse(3, 23, house()));
    plain(13, 27);
    plain(21, 26);
    // 广场南边：杂货铺、一户人家
    b.place(47, 21, G.shop);
    plain(37, 26);
    // 北岸东片
    yards.push(b.yardHouse(58, 15, G.houses[1]));
    yards.push(b.yardHouse(67, 14, G.houses[2]));
    yards.push(b.yardHouse(85, 16, house()));
    plain(57, 27);
    plain(65, 26);
    plain(79, 27);
    plain(87, 26, G.houses[0]);
    // 南岸：木工坊，水巷两岸人家紧贴着水，东边几户
    b.place(36, 47, G.workshop);
    yards.push(b.yardHouse(45, 52, G.houses[0]));
    for (const y of [53, 61]) plain(canalX - 6, y);
    for (const y of [51, 59, 66]) plain(canalX + CANAL_W, y);
    yards.push(b.yardHouse(80, 51, house()));
    plain(86, 63);
    plain(79, 65);

    // 院子里：晾衣竿、柴堆、水缸、盆栽
    for (const yard of yards) {
        if (yard.length === 0) continue;
        const [x0, y0] = yard[0];
        if (rnd() < 0.5) b.tryPlace(x0 + 3, y0, G.laundry);
        else b.tryPlace(x0, y0 + 1, G.woodpile);
        for (const [x, y] of yard) {
            if (rnd() < 0.15) b.tryPlace(x, y, pick(rnd, [[[G.jar]], [[G.pot]]], [0.5, 0.5]));
        }
    }

    // ---------- 农田 ----------
    for (const fy of [49, 65]) for (let x = 7; x < 28; x++) b.place(x, fy, [[G.fence]]);
    const crops = [G.sprout, G.cabbage, G.rice];
    plots.forEach(([px, py], i) => {
        for (let y = py; y < py + 3; y++) for (let x = px; x < px + 4; x++) b.place(x, y - 1, crops[i % 3]);
    });

    // ---------- 河上 ----------
    for (const [x, y] of [[8, riverY + 1], [86, riverY + 2]]) {
        b.place(x, y, G.boat, true);
        b.place(x, y + 2, G.boatRefl, true);
    }

    // 河岸柳树，北岸的在水里有倒影；两岸都隔开种，别排成一排
    let lastN = -99;
    let lastS = -99;
    for (let x = 0; x < W - 2; x++) {
        if (x - lastN > 4 && rnd() < 0.3 && b.fits(x, riverY - 5, G.willow)) {
            b.place(x, riverY - 5, G.willow);
            lastN = x;
            if ([0, 1, 2].every((dx) => b.free(x + dx, riverY) && !b.bridge.has(b.at(x + dx, riverY)))) b.place(x, riverY, G.willowRefl, true);
        }
        const sy = riverY + RIVER_H + 1 + (rnd() < 0.5 ? 0 : 1);
        if (x - lastS > 6 && rnd() < 0.25 && b.fits(x, sy, G.willow)) {
            b.place(x, sy, G.willow);
            lastS = x;
        }
    }
    for (let i = 0; i < W * H; i++) {
        if (b.terr[i] === Terr.Water && !b.bridge.has(i) && b.free(i % W, Math.floor(i / W)) && rnd() < 0.035) b.deco[i] = G.lily;
    }

    // 树：四周密、中间稀；同一片里树种相近，像自然长出来的林子
    const kind = noiseKind(b);
    for (let y = 0; y < H - 4; y++) {
        for (let x = 0; x < W - 2; x++) {
            const border = x < 3 || x >= W - 5 || y < 2 || y >= H - 7;
            if (rnd() < (border ? 0.45 : 0.02)) b.tryPlace(x, y, kind(x, y));
        }
    }

    // ---------- 镇上的人 ----------
    // 行号对应 tools/art/people.ts 的 PEOPLE
    b.walker('hero', 0, [[45, 14], [45, 9]], 1);
    b.walker('gui', 1, [[47, 30], [53, 30]], 0.6);
    b.walker('zhou', 2, [[36, 52], [41, 52]], 0.6);
    b.walker('fisher', 3, [[32, 46], [74, 46]], 1);
    b.walker('auntie', 4, [[18, 30], [74, 30]], 0.9);
    b.walker('grandpa', 5, [[41, 16], [41, 12]], 0.4);
    b.walker('kid', 6, [[36, 17], [36, 4], [55, 4], [55, 17]], 2);
    b.walker('girl', 7, [[31, 22], [31, 50]], 1);

    const lush = b.decorateGrass();
    return b.finish(lush);
}

/** 按噪声挑树种：一片松林、一片竹林，其余是阔叶树和零星桃树。 */
function noiseKind(b: MapBuilder): (x: number, y: number) => number[][] {
    const n = noise2d(b.rnd, 10);
    return (x, y) => {
        const k = n(x, y);
        if (k < 0.3) return G.trees[3];
        if (k > 0.75) return G.trees[4];
        return pick(b.rnd, G.trees.slice(0, 3), [0.5, 0.38, 0.12]);
    };
}
