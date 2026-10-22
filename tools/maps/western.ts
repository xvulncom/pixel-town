// 西部牛仔镇：荒漠里一条东西向土路主街，北边一排假门脸木楼（马厩、铁匠铺、杂货铺、旅馆、理发店、银行、警长办公室、
// 沙龙、邮局、化验所、小饭馆、诊所、驿站、饲料店），门前木板人行道和拴马桩；正中一条南北街通到北边小教堂。
// 主街南边是后院（水塔、马车、茅房）和后街一排原木小屋。北边一整条红岩台地，西段崖下有矿洞，东段二层台地是瞭望台；
// 东边牧场（风车水泵、饮马塘、畜栏里的长角牛和马），西边马栏和田（玉米、辣椒），南边一条干河床，再往南荒漠和两座孤丘。

import { noise2d, pick } from '../art/canvas';
import { WG } from '../art/western-tileset';
import { PEOPLE } from '../art/people';
import { MapData, Terr } from './builder';
import { DesertBuilder } from './desert';

export const WESTERN_W = 160;
export const WESTERN_H = 120;

/** 主街第一行（主街 4 格宽），北边楼底边在 MAIN_Y-3，木板人行道 MAIN_Y-2、MAIN_Y-1 */
const MAIN_Y = 46;
/** 后街第一行（3 格宽），南排小屋底边在 BACK_Y-3 */
const BACK_Y = 68;
/** 南北街（4 格宽）左边一列 */
const CROSS_X = 78;

export function buildWestern(): MapData {
    const b = new DesertBuilder(WESTERN_W, WESTERN_H, 20261021);
    const { rnd } = b;
    const W = b.w;
    const H = b.h;
    const spot = (id: string, x: number, y: number, w: number, h: number) => b.places.push({ id, x, y, w, h });
    const row = (id: string) => {
        const i = PEOPLE.findIndex((p) => p.id === id);
        if (i < 0) throw new Error(`people.ts 里没有 ${id}`);
        return i;
    };

    // ---------- 北边红岩台地：每 4 列一段高度，镇子背后压低，矿洞和瞭望台两段定死 ----------
    const ridge = noise2d(rnd, 3);
    const hN: number[] = [];
    for (let x = 0; x < W; x++) {
        let h = 9 + Math.floor(ridge(Math.floor(x / 4), 0) * 6);
        if (x >= 32 && x <= 43) h = 12;
        if (x >= 60 && x <= 95) h = Math.min(h, 13);
        if (x >= 96 && x <= 132) h = Math.max(h, 13);
        if (x > 132) h = Math.min(h, 11);
        hN.push(h);
    }
    for (let x = 0; x < W; x++) b.raise(x, 0, 1, hN[x], 1);
    b.raise(104, 0, 25, 7, 2);
    // 东南孤丘（上面再叠一层）和西南孤丘，边缘用噪声抠得不规则
    const edge = noise2d(rnd, 4);
    const butte = (cx: number, cy: number, rx: number, ry: number, lv: number) => {
        for (let y = cy - ry - 2; y <= cy + ry + 2; y++) {
            for (let x = cx - rx - 2; x <= cx + rx + 2; x++) {
                if (!b.inMap(x, y)) continue;
                const d = Math.max(Math.abs(x - cx) / rx, Math.abs(y - cy) / ry) + (edge(x, y) - 0.5) * 0.25;
                if (d < 1) b.raise(x, y, 1, 1, lv);
            }
        }
    };
    butte(140, 99, 16, 7, 1);
    butte(139, 96, 7, 3, 2);
    butte(14, 105, 12, 6, 1);

    // ---------- 干河床：自西向东弯弯一条 ----------
    const bedY = (x: number) => Math.round(80 + 4 * Math.sin(x / 14));
    for (let x = 0; x < W; x++) for (let y = bedY(x) - 2; y <= bedY(x) + 2; y++) if (b.levelAt(x, y) === 0) b.terr[b.at(x, y)] = Terr.Stone;

    // ---------- 饮马塘 ----------
    for (let y = 24; y <= 32; y++) {
        for (let x = 144; x <= 156; x++) if (((x - 150) / 5.5) ** 2 + ((y - 28) / 3.4) ** 2 < 1) b.terr[b.at(x, y)] = Terr.Water;
    }

    // ---------- 木板人行道（先铺，路口再被土路盖过去） ----------
    b.rect(18, MAIN_Y - 2, 117, 2, Terr.Wood);
    b.rect(18, MAIN_Y + 4, 117, 2, Terr.Wood);
    b.rect(28, BACK_Y - 2, 105, 2, Terr.Wood);

    // ---------- 路 ----------
    b.road([[0, MAIN_Y], [W - 4, MAIN_Y]], Terr.Dirt, 4);
    b.road([[28, BACK_Y], [130, BACK_Y]], Terr.Dirt, 3);
    b.road([[CROSS_X, 27], [CROSS_X, BACK_Y]], Terr.Dirt, 4);
    // 往南出镇的车道，穿过干河床
    b.road([[CROSS_X + 1, BACK_Y + 3], [CROSS_X + 1, H - 2]], Terr.Dirt);
    // 上矿洞、上瞭望台的小路
    b.road([[37, 15], [37, MAIN_Y - 1]], Terr.Dirt);
    b.road([[117, 2], [117, MAIN_Y - 1]], Terr.Dirt);
    // 牧场的车道
    b.road([[136, MAIN_Y], [136, 34], [150, 34]], Terr.Dirt);
    // 西边田间小路
    b.road([[28, BACK_Y], [26, BACK_Y], [26, 54]], Terr.Dirt);

    // ---------- 西边的田 ----------
    const plots: [number, number][] = [];
    for (const py of [56, 60, 64]) for (const px of [4, 10, 16]) plots.push([px, py]);
    for (const [px, py] of plots) b.rect(px, py, 5, 3, Terr.Soil);

    b.mesaCliffs();

    // ---------- 主街北边一排楼（底边 MAIN_Y-3） ----------
    const nb = MAIN_Y - 3;
    /** recipe 是进门后的室内配方（data/interiors.ts），不填就没有门 */
    const north = (x: number, grid: number[][], recipe?: string) => {
        b.place(x, nb - grid.length + 1, grid);
        if (recipe) b.door(x, nb - grid.length + 1, grid, recipe);
    };
    /** 房子放下并登记门 */
    const house = (x: number, y: number, grid: number[][], recipe: string) => {
        b.place(x, y, grid);
        b.door(x, y, grid, recipe);
    };
    north(19, WG.livery, 'w_livery');
    north(30, WG.smithy, 'w_smithy');
    north(39, WG.store, 'w_store');
    north(46, WG.hotel, 'w_hotel');
    north(53, WG.barber, 'w_barber');
    north(60, WG.bank, 'w_bank');
    north(68, WG.sheriff, 'w_sheriff');
    north(74, WG.noticeBoard);
    north(83, WG.saloon, 'w_saloon');
    north(92, WG.post, 'w_post');
    north(98, WG.assay, 'w_assay');
    north(105, WG.cafe, 'w_cafe');
    north(111, WG.doctor, 'w_doctor');
    north(119, WG.stage, 'w_stage');
    north(127, WG.feed, 'w_feed');
    spot('livery', 19, nb - 5, 9, 6);
    spot('smithy', 30, nb - 4, 7, 5);
    spot('store', 39, nb - 5, 7, 6);
    spot('bank', 60, nb - 5, 7, 6);
    spot('sheriff', 68, nb - 4, 6, 5);
    spot('hiring', 74, nb - 2, 3, 3);
    spot('saloon', 83, nb - 5, 8, 6);

    // 拴马桩和马：沙龙、旅馆、杂货铺、驿站门口，拴在主街北沿
    for (const [x, h] of [[84, 0], [88, 1], [41, 2], [48, 3], [121, 1]] as const) {
        b.place(x, MAIN_Y, WG.hitch, true);
        b.place(x - 1, MAIN_Y, WG.horses[h]);
    }
    b.place(62, MAIN_Y, WG.trough, true);
    b.place(100, MAIN_Y, WG.trough, true);

    // 主街南边人行道：路灯、长凳、木桶，隔开摆，不堵路
    for (const x of [22, 44, 66, 90, 112, 132]) b.place(x, MAIN_Y + 4, WG.lamp);
    for (const x of [30, 56, 96, 124]) b.place(x, MAIN_Y + 5, WG.bench, true);
    for (const x of [34, 52, 70, 102, 118]) b.place(x, MAIN_Y + 5, [[pick(rnd, [WG.barrel, WG.crate, WG.hay], [0.5, 0.3, 0.2])]]);

    // ---------- 后院：水塔、马车、茅房、柴火木箱、篱笆 ----------
    b.place(84, 53, WG.waterTower);
    spot('waterTower', 84, 53, 3, 6);
    b.place(58, 54, WG.wagon);
    b.place(108, 55, WG.cart);
    /** 茅房：有门，进不去 */
    const outhouse = (x: number, y: number) => {
        if (b.tryPlace(x, y, WG.outhouse)) b.door(x, y, WG.outhouse, null, '里面有人，等会儿吧');
    };
    for (const x of [36, 48, 94, 116]) outhouse(x, 55);
    for (let y = 53; y < 60; y++) {
        for (let x = 20; x < 134; x++) {
            if (x >= CROSS_X - 1 && x <= CROSS_X + 4) continue;
            if (rnd() < 0.03) b.tryPlace(x, y, [[pick(rnd, [WG.barrel, WG.crate, WG.hay, WG.wheel], [0.35, 0.3, 0.2, 0.15])]]);
        }
    }

    // ---------- 后街一排原木小屋（底边 BACK_Y-3） ----------
    const sb = BACK_Y - 3;
    for (const [x, k] of [[30, 0], [37, 1], [44, 0], [51, 1], [58, 0], [65, 1], [86, 1], [93, 0], [100, 1], [107, 0], [114, 1], [121, 0]] as const) {
        house(x, sb - 4, WG.cabins[k], 'w_cabin');
        if (rnd() < 0.6) b.tryPlace(x + 6, sb, [[pick(rnd, [WG.barrel, WG.crate], [0.6, 0.4])]]);
    }

    // ---------- 教堂、北边人家 ----------
    house(CROSS_X - 1, 19, WG.chapel, 'w_chapel');
    spot('chapel', CROSS_X - 1, 19, 6, 8);
    for (const x of [CROSS_X - 4, CROSS_X + 6]) b.place(x, 25, WG.lamp);
    for (const [x, k] of [[46, 0], [54, 1], [92, 1], [100, 0]] as const) house(x, 26, WG.cabins[k], 'w_cabin');
    b.place(64, 30, WG.waterTower);
    for (const x of [52, 98]) outhouse(x, 32);

    // ---------- 矿洞、瞭望台 ----------
    b.place(36, 12, WG.mine);
    spot('mine', 36, 12, 4, 3);
    for (const [x, y] of [[33, 16], [41, 17], [34, 18]]) b.tryPlace(x, y, [[WG.crate]]);
    b.tryPlace(40, 15, [[WG.barrel]]);
    b.place(114, 1, WG.boulder);
    b.place(120, 2, WG.bench, true);
    spot('mesa', 114, 1, 7, 4);

    // ---------- 西边马栏、田 ----------
    const corral = (x0: number, y0: number, x1: number, y1: number, gate: number[]) => {
        for (let x = x0; x <= x1; x++) {
            if (!gate.includes(x)) b.place(x, y0, [[WG.fenceH]]);
            b.place(x, y1, [[WG.fenceH]]);
        }
        for (let y = y0 + 1; y < y1; y++) {
            b.place(x0, y, [[WG.fenceV]]);
            b.place(x1, y, [[WG.fenceV]]);
        }
    };
    corral(3, 30, 16, 42, []);
    for (const [x, y, h] of [[5, 33, 0], [10, 35, 2], [6, 39, 3], [11, 39, 1]] as const) b.place(x, y, WG.horses[h]);
    b.place(13, 32, [[WG.hay]]);
    b.place(4, 32, WG.trough, true);
    plots.forEach(([px, py], i) => {
        const crop = i % 3 === 1 ? WG.chili : WG.corn;
        for (let y = py; y < py + 3; y++) for (let x = px; x < px + 5; x++) b.place(x, y - 1, crop);
    });
    house(8, 50, WG.cabins[1], 'w_cabin');
    for (let x = 3; x <= 22; x++) b.place(x, 67, [[WG.fenceH]]);

    // ---------- 东边牧场 ----------
    house(139, 36, WG.cabins[0], 'w_cabin');
    house(148, 36, WG.ranchBarn, 'w_livery');
    b.place(141, 22, WG.windmill);
    spot('ranch', 141, 22, 3, 7);
    b.place(142, 30, WG.trough, true);
    corral(138, 53, 156, 66, [146, 147]);
    for (const [x, y, k] of [[140, 55, 0], [144, 58, 1], [150, 56, 0], [141, 62, 1], [152, 61, 0]] as const) b.place(x, y, WG.cows[k]);
    b.place(147, 61, WG.horses[2]);
    b.place(154, 54, [[WG.hay]]);

    // ---------- 干河床里的石头、岸边枯树 ----------
    for (let i = 0; i < W * H; i++) {
        const x = i % W;
        const y = Math.floor(i / W);
        if (b.terr[i] === Terr.Stone && b.free(x, y) && rnd() < 0.025) b.deco[i] = pick(rnd, [WG.rocks, WG.skull, WG.tumbleweeds[0]], [0.6, 0.15, 0.25]);
    }
    spot('arroyo', 66, bedY(76) - 2, 24, 5);

    // ---------- 荒漠植物：镇外成片，镇里只有零星小仙人掌 ----------
    const inTown = (x: number, y: number) => x >= 17 && x < 135 && y >= 18 && y < BACK_Y + 4;
    /** 马栏、田、牧场院子里不长仙人掌 */
    const clear: [number, number, number, number][] = [[2, 29, 16, 15], [2, 48, 27, 21], [134, 18, 26, 50]];
    const kept = (x: number, y: number) => clear.some(([x0, y0, w, h]) => x >= x0 && y >= y0 && x < x0 + w && y < y0 + h);
    for (let y = 0; y < H - 3; y++) {
        for (let x = 0; x < W - 2; x++) {
            const fy = y + 4;
            if (b.levelAt(x, fy) > 0 || kept(x, fy) || kept(x + 2, fy)) continue;
            const r = rnd();
            if (inTown(x, fy)) {
                if (r < 0.004) b.tryPlace(x, y + 2, WG.saguaroYoung);
                continue;
            }
            if (r < 0.022) b.tryPlace(x, y, WG.saguaros[Math.floor(rnd() * 3)]);
            else if (r < 0.03) b.tryPlace(x, y + 2, WG.saguaroYoung);
            else if (r < 0.033) b.tryPlace(x, y, WG.deadTree);
            else if (r < 0.038) b.tryPlace(x, y + 3, WG.boulder);
        }
    }

    // ---------- 镇上的人：行号按 tools/art/people.ts 的 id 查 ----------
    b.walker('sheriff', row('sheriff'), [[56, MAIN_Y - 1], [77, MAIN_Y - 1]], 0.7);
    b.walker('cowboy', row('cowboy'), [[2, MAIN_Y + 3], [150, MAIN_Y + 3]], 1.1);
    b.walker('cowgirl', row('cowgirl'), [[92, MAIN_Y + 2], [130, MAIN_Y + 2]], 1);
    b.walker('bartender', row('bartender'), [[83, MAIN_Y - 2], [90, MAIN_Y - 2]], 0.4);
    b.walker('prospector', row('prospector'), [[37, 16], [37, MAIN_Y - 2]], 0.5);
    b.walker('lady', row('lady'), [[CROSS_X + 1, 28], [CROSS_X + 1, MAIN_Y + 2]], 0.6);
    b.walker('smith', row('smith'), [[30, MAIN_Y - 2], [36, MAIN_Y - 2]], 0.5);
    b.walker('ranchKid', row('ranchKid'), [[30, BACK_Y + 1], [76, BACK_Y + 1]], 1.6);
    b.walker('rancher', row('rancher'), [[137, 36], [137, MAIN_Y + 2], [158, MAIN_Y + 2]], 0.8);

    // 主角到镇上站在主街和南北街的路口
    b.spawn = [CROSS_X + 1, MAIN_Y + 2];
    const scrub = b.decorateSand((x, y) => kept(x, y) || (inTown(x, y) && y >= 36 && (x * 7 + y * 3) % 3 !== 0));
    return b.finishDesert(scrub);
}
