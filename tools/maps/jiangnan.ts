// 江南水乡：一条大河横穿全图。中间是老镇子（北岸戏台广场、牌坊、杂货铺，南岸木工坊、水巷人家、农田），
// 四周五片：北边梯田茶山、东边码头集市、东南荷花湖、西边竹林古寺、南边稻田水车。
// 老镇子整块偏移 (OX, OY) 摆在中间，坐标照原来 96×72 时写，加偏移；新片区直接写绝对坐标。

import { noise2d, pick } from '../art/canvas';
import { CANAL_W, G, RIVER_H } from '../art/tileset';
import { MapBuilder, MapData, Place, Terr } from './builder';

export const JIANGNAN_W = 160;
export const JIANGNAN_H = 120;
/** 老镇子在新地图里的偏移 */
const OX = 32;
const OY = 28;

export function buildJiangnan(): MapData {
    const b = new MapBuilder(JIANGNAN_W, JIANGNAN_H, 20261016);
    const { rnd } = b;
    const W = b.w;
    const H = b.h;
    /** 老镇子坐标 → 新地图坐标 */
    const o = (x: number, y: number): [number, number] => [x + OX, y + OY];
    const road = (pts: [number, number][], t: Terr) => b.road(pts.map(([x, y]) => o(x, y)), t);
    const place = (x: number, y: number, grid: number[][], flat = false) => b.place(x + OX, y + OY, grid, flat);
    const spot = (p: Place) => b.places.push(p);

    // ---------- 水 ----------
    const riverY = 34 + OY;
    const canalX = 60 + OX;
    const canalEnd = 66 + OY;
    b.rect(0, riverY, W, RIVER_H, Terr.Water);
    b.rect(canalX, riverY + RIVER_H, CANAL_W, canalEnd - riverY - RIVER_H + 1, Terr.Water);
    // 荷花湖：不规则的一圈，湖心留个小岛
    const lakeX = 142;
    const lakeY = 92;
    const shore = noise2d(rnd, 6);
    const lakeD = (x: number, y: number) => ((x - lakeX) / 15) ** 2 + ((y - lakeY) / 10) ** 2 + (shore(x, y) - 0.5) * 0.35;
    for (let y = lakeY - 13; y <= lakeY + 13; y++) {
        for (let x = lakeX - 18; x < W; x++) {
            const d = lakeD(x, y);
            if (d < 1 && b.inMap(x, y)) b.terr[b.at(x, y)] = Terr.Water;
        }
    }
    const islandY = 91;
    for (let y = islandY - 4; y <= islandY + 4; y++) {
        for (let x = lakeX - 6; x <= lakeX + 6; x++) if (((x - lakeX) / 5) ** 2 + ((y - islandY) / 3.4) ** 2 < 1) b.terr[b.at(x, y)] = Terr.Grass;
    }

    // ---------- 茶山：三级平台 ----------
    b.raise(36, 0, 103, 21, 1);
    b.raise(46, 0, 83, 14, 2);
    b.raise(70, 0, 31, 8, 3);

    // ---------- 路 ----------
    // 镇中心：北岸主街、南岸街、广场、广场到主街的小巷，都铺青石板
    b.rect(...o(36, 4), 20, 14, Terr.Stone);
    road([[16, 29], [80, 29]], Terr.Stone);
    road([[44, 18], [44, 29]], Terr.Stone);
    road([[30, 29], [30, 45]], Terr.Stone);
    road([[76, 29], [76, 45]], Terr.Stone);
    road([[30, 45], [76, 45]], Terr.Stone);
    // 老镇子的土路，原来通到地图边的都接着往外修
    road([[0, 29], [16, 29]], Terr.Dirt);
    road([[24, 0], [24, 10], [30, 10], [30, 29]], Terr.Dirt);
    road([[82, 0], [82, 12], [76, 12], [76, 29]], Terr.Dirt);
    road([[80, 29], [86, 29], [86, 25], [95, 25]], Terr.Dirt);
    road([[30, 46], [30, 50], [28, 50], [28, 71]], Terr.Dirt);
    road([[76, 46], [76, 56], [72, 56], [72, 71]], Terr.Dirt);
    road([[28, 68], [40, 68], [40, 71]], Terr.Dirt);
    // 上茶山：两条路在一级平台汇合，再一路爬到山顶亭子
    b.road([[56, 28], [56, 17], [114, 17], [114, 28]], Terr.Dirt);
    b.road([[84, 17], [84, 6]], Terr.Dirt);
    // 往西进竹林到古寺
    b.road([[32, 57], [18, 57], [18, 49]], Terr.Dirt);
    b.rect(3, 44, 17, 5, Terr.Stone);
    // 往东到码头集市：一条青石板街，正中一条巷子下到码头
    b.road([[127, 53], [158, 53]], Terr.Stone);
    b.road([[140, 55], [140, 60]], Terr.Stone);
    // 往南进稻田；中间那条拐去荷花湖
    b.road([[60, 99], [60, 118]], Terr.Dirt);
    b.road([[72, 99], [72, 118]], Terr.Dirt);
    b.road([[104, 99], [104, 118]], Terr.Dirt);
    b.road([[108, 84], [126, 84], [126, 93]], Terr.Dirt);

    // ---------- 稻田：土埂隔开一块块水田，小溪从河里引下来 ----------
    b.rect(4, 101, 116, 16, Terr.Dirt);
    const paddies: [number, number][] = [];
    for (let py = 102; py + 3 <= 116; py += 4) {
        for (let px = 5; px + 5 <= 119; px += 6) {
            const i = b.at(px, py);
            if (b.terr[i] !== Terr.Dirt || [60, 72, 104].some((rx) => px <= rx + 1 && px + 5 > rx)) continue;
            b.rect(px, py, 5, 3, Terr.Soil);
            paddies.push([px, py]);
        }
    }
    b.rect(34, riverY + RIVER_H, 2, H - riverY - RIVER_H, Terr.Water);

    // ---------- 码头：沿河一排木板，伸出两道栈桥 ----------
    b.rect(129, riverY, 28, 2, Terr.Wood);
    b.rect(134, riverY + 2, 2, 2, Terr.Wood);
    b.rect(148, riverY + 2, 2, 2, Terr.Wood);

    // ---------- 九曲桥：岸边一折一折到湖心岛 ----------
    const zig: [number, number][] = [[127, 93], [129, 93], [129, 89], [132, 89], [132, 95], [135, 95], [135, 92], [138, 92]];
    for (let i = 0; i + 1 < zig.length; i++) {
        const [x0, y0] = zig[i];
        const [x1, y1] = zig[i + 1];
        for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
            for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
                const k = b.at(x, y);
                b.terr[k] = b.terr[k] === Terr.Water ? Terr.Slab : b.terr[k] === Terr.Grass ? Terr.Dirt : b.terr[k];
            }
        }
    }

    // 有高低差的地方画崖壁，路过的地方是石阶
    b.cliffs();

    // ---------- 老镇子农田 ----------
    const plots: [number, number][] = [];
    for (const py of [51, 56, 61]) for (const px of [8, 13, 18, 23]) plots.push([px, py]);
    for (const [px, py] of plots) b.rect(...o(px, py), 4, 3, Terr.Soil);

    // ---------- 桥和河埠头 ----------
    place(30, 34, G.bridgeV, true);
    place(76, 34, G.bridgeV, true);
    place(60, 45, G.bridgeH, true);
    for (const x of [12, 40, 52, 68, 88]) place(x, 34, G.stepsDown, true);
    for (const x of [20, 46, 84]) place(x, 34 + RIVER_H - 1, G.stepsUp, true);
    for (const y of [49, 62]) place(60, y, G.stepsRight, true);
    place(60 + CANAL_W - 1, 55, G.stepsLeft, true);

    // ---------- 镇中心广场 ----------
    place(43, 0, G.stage);
    for (const [x, y] of [[37, 3], [54, 3], [37, 12], [54, 12]]) place(x, y, G.lanternPost);
    place(38, 6, G.tree);
    place(41, 9, G.well);
    place(47, 5, G.stalls[0]);
    place(51, 5, G.stalls[2]);
    place(47, 10, G.stalls[1]);
    place(51, 10, G.stalls[3]);
    place(39, 13, G.teaTable);
    place(46, 13, G.tanghulu);
    place(37, 16, G.bench);
    place(51, 16, G.bench);
    place(42, 16, G.archway);
    // 招工处：广场东边的告示栏，整块（含檐）都能点
    place(55, 6, G.hireBoard);
    spot({ id: 'hiring', x: 55 + OX, y: 6 + OY, w: 3, h: 3 });

    // ---------- 人家 ----------
    const house = () => pick(rnd, G.houses, [0.3, 0.4, 0.3]);
    const yards: [number, number][][] = [];
    const smallProp = () => pick(rnd, [[[G.jar]], [[G.pot]]], [0.5, 0.5]);
    /** 普通人家：底边在 baseY 行（新地图坐标）。 */
    const plainAt = (x: number, baseY: number, grid = house()) => {
        b.place(x, baseY - grid.length + 1, grid);
        // 门口两侧摆点小物件
        for (const sx of [x - 1, x + grid[0].length]) if (rnd() < 0.6) b.tryPlace(sx, baseY, smallProp());
    };
    const plain = (x: number, baseY: number, grid = house()) => plainAt(x + OX, baseY + OY, grid);
    const yardHouse = (x: number, baseY: number, grid: number[][]) => yards.push(b.yardHouse(x + OX, baseY + OY, grid));
    // 北岸西片：后排两户带院子，前排三户错开
    yardHouse(4, 13, G.houses[2]);
    yardHouse(14, 13, G.houses[1]);
    yardHouse(3, 23, house());
    plain(13, 27);
    plain(21, 26);
    // 广场南边：杂货铺、一户人家
    place(47, 21, G.shop);
    plain(37, 26);
    // 北岸东片
    yardHouse(58, 15, G.houses[1]);
    yardHouse(67, 14, G.houses[2]);
    yardHouse(85, 16, house());
    plain(57, 27);
    plain(65, 26);
    plain(79, 27);
    plain(87, 26, G.houses[0]);
    // 南岸：木工坊，水巷两岸人家紧贴着水，东边几户
    place(36, 47, G.workshop);
    yardHouse(45, 52, G.houses[0]);
    for (const y of [53, 61]) plain(60 - 6, y);
    for (const y of [51, 59, 66]) plain(60 + CANAL_W, y);
    yardHouse(80, 51, house());
    plain(86, 63);
    plain(79, 65);

    // 院子里：晾衣竿、柴堆、水缸、盆栽
    for (const yard of yards) {
        if (yard.length === 0) continue;
        const [x0, y0] = yard[0];
        if (rnd() < 0.5) b.tryPlace(x0 + 3, y0, G.laundry);
        else b.tryPlace(x0, y0 + 1, G.woodpile);
        for (const [x, y] of yard) if (rnd() < 0.15) b.tryPlace(x, y, smallProp());
    }

    // 老镇子农田的篱笆和作物
    for (const fy of [49, 65]) for (let x = 7; x < 28; x++) place(x, fy, [[G.fence]]);
    const crops = [G.sprout, G.cabbage, G.rice];
    plots.forEach(([px, py], i) => {
        for (let y = py; y < py + 3; y++) for (let x = px; x < px + 4; x++) place(x, y - 1, crops[i % 3]);
    });

    // ---------- 茶山 ----------
    // 山顶亭子，路正好通到亭子跟前
    b.place(82, 1, G.pavilion);
    spot({ id: 'teahill', x: 82, y: 1, w: 4, h: 5 });
    // 梯田上一行行茶树，隔几棵留个缺口好走
    for (let y = 0; y < 21; y++) {
        if (y % 2 === 1) continue;
        for (let x = 36; x < 139; x++) {
            const lv = b.levelAt(x, y);
            if (lv === 0 || lv === 3 || (x + y * 3) % 11 === 0) continue;
            if (b.grassAt(x, y) && b.free(x, y)) b.deco[b.at(x, y)] = G.teaBushes[(x + y) % 2];
        }
    }
    for (const [x, y] of [[78, 4], [90, 3], [96, 5]]) b.tryPlace(x - 1, y - 4, G.trees[3]);

    // ---------- 竹林古寺 ----------
    b.place(6, 38, G.temple);
    b.place(14, 35, G.pagoda);
    b.place(9, 45, G.incense);
    for (const x of [4, 17]) b.place(x, 45, G.stoneLamp);
    spot({ id: 'temple', x: 6, y: 38, w: 8, h: 6 });

    // ---------- 码头集市 ----------
    // 街北一排铺子：茶馆、布庄、米铺、一户人家
    b.place(129, 47, G.teahouse);
    spot({ id: 'teahouse', x: 129, y: 47, w: 7, h: 6 });
    b.place(137, 48, G.clothShop);
    b.place(144, 48, G.riceShop);
    plainAt(151, 52, G.houses[1]);
    // 街南摆摊，巷口两边各两个
    for (const [x, i] of [[130, 0], [134, 1], [143, 2], [147, 3], [152, 0]] as const) b.place(x, 55, G.stalls[i]);
    for (const x of [128, 139, 142, 156]) b.place(x, 51, G.lanternPost);
    // 河岸边堆的货
    const cargo = [[[G.crate]], [[G.wineJar]], [[G.riceSack]]];
    for (let y = 58; y < 62; y++) {
        for (let x = 129; x < 157; x++) if (rnd() < 0.18) b.tryPlace(x, y, pick(rnd, cargo, [0.4, 0.3, 0.3]));
    }
    b.place(137, riverY + 2, G.cargoBoat, true);
    b.place(151, riverY + 2, G.cargoBoat, true);
    spot({ id: 'dock', x: 129, y: riverY, w: 28, h: 2 });

    // ---------- 荷花湖 ----------
    b.place(140, 88, G.pavilion);
    spot({ id: 'lake', x: 140, y: 88, w: 4, h: 5 });
    for (let y = lakeY - 13; y <= lakeY + 13; y++) {
        for (let x = lakeX - 18; x < W; x++) {
            if (!b.inMap(x, y) || b.terr[b.at(x, y)] !== Terr.Water || !b.free(x, y)) continue;
            const nearLand = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => b.grassAt(x + dx, y + dy));
            const r = rnd();
            if (nearLand && r < 0.35) b.deco[b.at(x, y)] = G.reeds;
            else if (!nearLand && r < 0.22 && lakeD(x, y) > 0.3) b.deco[b.at(x, y)] = G.lotus;
        }
    }

    // ---------- 稻田 ----------
    paddies.forEach(([px, py], i) => {
        const crop = i % 7 === 3 ? G.sprout : G.rice;
        for (let y = py; y < py + 3; y++) for (let x = px; x < px + 5; x++) if (b.terr[b.at(x, y)] === Terr.Soil) b.place(x, y - 1, crop);
    });
    b.place(33, 104, G.waterWheel);
    spot({ id: 'paddy', x: 33, y: 104, w: 3, h: 4 });
    for (let y = riverY + RIVER_H; y < H; y++) {
        for (const x of [33, 36]) if (b.grassAt(x, y) && b.free(x, y) && rnd() < 0.3) b.deco[b.at(x, y)] = G.reeds;
    }

    // ---------- 河上 ----------
    for (const [x, y] of [o(8, 35), o(86, 36), [4, riverY + 1] as [number, number]]) {
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
            if ([0, 1, 2].every((dx) => b.free(x + dx, riverY) && b.terr[b.at(x + dx, riverY)] === Terr.Water && !b.bridge.has(b.at(x + dx, riverY)))) {
                b.place(x, riverY, G.willowRefl, true);
            }
        }
        const sy = riverY + RIVER_H + 1 + (rnd() < 0.5 ? 0 : 1);
        if (x - lastS > 6 && rnd() < 0.25 && b.fits(x, sy, G.willow)) {
            b.place(x, sy, G.willow);
            lastS = x;
        }
    }
    // 湖边也种几棵柳树
    for (let k = 0; k < 40; k++) {
        const a = rnd() * Math.PI * 2;
        const x = Math.round(lakeX + Math.cos(a) * 17) - 1;
        const y = Math.round(lakeY + Math.sin(a) * 11.5) - 4;
        b.tryPlace(x, y, G.willow);
    }
    for (let i = 0; i < W * H; i++) {
        const x = i % W;
        const y = Math.floor(i / W);
        if (b.terr[i] === Terr.Water && !b.bridge.has(i) && b.free(x, y) && lakeD(x, y) >= 1 && rnd() < 0.035) b.deco[i] = G.lily;
    }

    // ---------- 树 ----------
    // 地图四边密；西边整片竹林（古寺门前留空）；老镇子里稀；集市、湖心、山顶不种；其余荒地成片的林子
    const kind = noiseKind(b);
    const inRect = (x: number, y: number, x0: number, y0: number, w: number, h: number) => x >= x0 && y >= y0 && x < x0 + w && y < y0 + h;
    for (let y = 0; y < H - 4; y++) {
        for (let x = 0; x < W - 2; x++) {
            const fy = y + 4;
            const border = x < 3 || x >= W - 5 || y < 2 || fy >= H - 3;
            let p: number;
            let grid: number[][] | undefined;
            if (inRect(x, fy, 126, 44, 34, 18) || inRect(x, fy, 0, 30, 24, 22) || b.levelAt(x, fy) === 3) p = 0;
            else if (border) p = 0.45;
            else if (x < 32) {
                p = 0.3;
                grid = G.trees[4];
            } else if (b.levelAt(x, fy) > 0) p = 0.004;
            else if (inRect(x, fy, OX, OY, 96, 72)) p = 0.02;
            else p = 0.09;
            if (rnd() < p) b.tryPlace(x, y, grid ?? kind(x, y));
        }
    }

    // ---------- 镇上的人 ----------
    // 行号对应 tools/art/people.ts 的 PEOPLE；新片区的和尚、采茶人、船夫、渔夫借用现有的人
    const walk = (id: string, row: number, path: [number, number][], speed: number) => b.walker(id, row, path.map(([x, y]) => o(x, y)), speed);
    walk('hero', 0, [[45, 14], [45, 9]], 1);
    walk('gui', 1, [[47, 30], [53, 30]], 0.6);
    walk('zhou', 2, [[36, 52], [41, 52]], 0.6);
    walk('fisher', 3, [[32, 46], [74, 46]], 1);
    walk('auntie', 4, [[18, 30], [74, 30]], 0.9);
    walk('grandpa', 5, [[41, 16], [41, 12]], 0.4);
    walk('kid', 6, [[36, 17], [36, 4], [55, 4], [55, 17]], 2);
    walk('girl', 7, [[31, 22], [31, 50]], 1);
    b.walker('monk', 5, [[5, 48], [16, 48]], 0.4);
    b.walker('teaPicker', 4, [[60, 18], [110, 18]], 0.5);
    b.walker('boatman', 3, [[130, riverY + 1], [155, riverY + 1]], 0.8);
    b.walker('angler', 1, [[127, 93], [129, 93], [129, 89], [132, 89]], 0.5);
    b.walker('farmer', 2, [[61, 102], [61, 116]], 0.6);
    b.walker('vendor', 6, [[128, 54], [157, 54]], 1.2);

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
