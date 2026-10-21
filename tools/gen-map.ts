// 用代码画像素图块、人物和地图。正式美术到位前用它。
// 用法：npx tsx tools/gen-map.ts [--preview <目录>]
// 输出（assets/resources/maps/）：
//   town-tiles.png      所有地图共用的图块集
//   people.png          人物走路帧，people-frames.json 记行号、帧尺寸、手的位置
//   jiangnan.tmx        江南地图（Tiled），jiangnan.walkers.json 记镇上走动的人和路线
//   buildings.png       自己地盘上的建筑整图，buildings-frames.json 记每张的位置；terrain.json 记路面用哪些图块
//
// 画法在 tools/art/，图块登记在 tools/art/tileset.ts，地图布局在 tools/maps/。
// 图层：ground 地面，deco 物体底部（挡路），over 物体上半部分（盖在人物头上）。

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mulberry32 } from '../assets/scripts/core/rng';
import { Canvas, COLS, EMPTY, Pen, TILE, warmGrade } from './art/canvas';
import { DIRS, drawPeople, FRAME_H, FRAME_W, FRAMES, handAnchors, PEOPLE } from './art/people';
import { G, sheet } from './art/tileset';
import { MapData } from './maps/builder';
import { buildJiangnan } from './maps/jiangnan';
import { buildWestern } from './maps/western';
import { westernSheet, WG } from './art/western-tileset';
import { packObjects } from './art/objects';
import { borderDecor, borderGround, sceneMask } from '../assets/scripts/core/border';
import { newGame } from '../assets/scripts/core/game';
import { VillageState } from '../assets/scripts/core/types';
import { WORLD } from '../assets/scripts/data/world';
import { activeWild, grassVariant, newVillage, place, terrainGrid, villageSize } from '../assets/scripts/core/village';

function layerData(tiles: number[]): string {
    const buf = Buffer.alloc(tiles.length * 4);
    tiles.forEach((t, i) => buf.writeUInt32LE(t === EMPTY ? 0 : t + 1, i * 4));
    return buf.toString('base64');
}

/** image、animSets、name 默认是江南共用的 town-tiles；西部镇传自己的图块集。 */
function toTmx(map: MapData, tileCount: number, rows: number, image = 'town-tiles.png', animSets: number[][] = G.waterAnims, name = 'town'): string {
    const layer = (id: number, name: string, tiles: number[]) =>
        `  <layer id="${id}" name="${name}" width="${map.w}" height="${map.h}">\n`
        + `    <data encoding="base64">${layerData(tiles)}</data>\n`
        + '  </layer>\n';
    const anims = animSets.map((frames) => {
        const list = frames.map((t) => `      <frame tileid="${t}" duration="300"/>`).join('\n');
        return `    <tile id="${frames[0]}">\n      <animation>\n${list}\n      </animation>\n    </tile>\n`;
    }).join('');
    return '<?xml version="1.0" encoding="UTF-8"?>\n'
        + `<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" width="${map.w}" height="${map.h}" tilewidth="${TILE}" tileheight="${TILE}" infinite="0" nextlayerid="4" nextobjectid="1">\n`
        + `  <tileset firstgid="1" name="${name}" tilewidth="${TILE}" tileheight="${TILE}" tilecount="${tileCount}" columns="${COLS}">\n`
        + `    <image source="${image}" width="${COLS * TILE}" height="${rows * TILE}"/>\n`
        + anims
        + '  </tileset>\n'
        + layer(1, 'ground', map.ground)
        + layer(2, 'deco', map.deco)
        + layer(3, 'over', map.over)
        + '</map>\n';
}

/** 把地图（含站着的人）拼成一张图，不开 Cocos 也能看效果。 */
function renderPreview(map: MapData, tiles: Canvas, people: Canvas, scale: number, x0 = 0, y0 = 0, w = map.w, h = map.h): Canvas {
    const c = new Canvas(w * TILE * scale, h * TILE * scale);
    const blit = (src: Canvas, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number) => {
        for (let y = 0; y < sh; y++) {
            for (let x = 0; x < sw; x++) {
                const i = ((sy + y) * src.w + sx + x) * 4;
                for (let ky = 0; ky < scale; ky++) {
                    for (let kx = 0; kx < scale; kx++) {
                        c.blend((dx + x) * scale + kx, (dy + y) * scale + ky, src.px[i], src.px[i + 1], src.px[i + 2], src.px[i + 3]);
                    }
                }
            }
        }
    };
    const tile = (t: number, tx: number, ty: number) =>
        blit(tiles, (t % COLS) * TILE, Math.floor(t / COLS) * TILE, TILE, TILE, tx * TILE, ty * TILE);
    const layerAt = (layer: number[]) => {
        for (let ty = 0; ty < h; ty++) {
            for (let tx = 0; tx < w; tx++) {
                const t = layer[(y0 + ty) * map.w + x0 + tx];
                if (t !== EMPTY) tile(t, tx, ty);
            }
        }
    };
    layerAt(map.ground);
    layerAt(map.deco);
    // 人站在路线起点，朝下，夹在 deco 和 over 之间
    for (const wk of map.walkers) {
        const [fx, fy] = wk.path[0];
        blit(people, 0, wk.row * FRAME_H, FRAME_W, FRAME_H, (fx - x0) * TILE, (fy - y0 - 1) * TILE);
    }
    layerAt(map.over);
    return c;
}

const out = join(__dirname, '..', 'assets', 'resources', 'maps');
mkdirSync(out, { recursive: true });

const tileset = sheet.toCanvas();
warmGrade(tileset);
const people = drawPeople(mulberry32(7));
warmGrade(people);
const jiangnan = buildJiangnan();

writeFileSync(join(out, 'town-tiles.png'), tileset.toPng());
writeFileSync(join(out, 'people.png'), people.toPng());
writeFileSync(join(out, 'people-frames.json'), JSON.stringify({
    frameW: FRAME_W,
    frameH: FRAME_H,
    dirs: DIRS,
    frames: FRAMES,
    rows: PEOPLE.map((p) => p.id),
    hands: handAnchors(),
}, null, 2) + '\n');
writeFileSync(join(out, 'jiangnan.tmx'), toTmx(jiangnan, sheet.tiles.length, tileset.h / TILE));
writeFileSync(join(out, 'jiangnan.walkers.json'), JSON.stringify(jiangnan.walkers, null, 2) + '\n');
writeFileSync(join(out, 'jiangnan.places.json'), JSON.stringify(jiangnan.places, null, 2) + '\n');

// 西部牛仔镇：单独一张图块集 western-tiles.png，其余产物同江南
const westernTiles = westernSheet.toCanvas();
warmGrade(westernTiles);
const western = buildWestern();
writeFileSync(join(out, 'western-tiles.png'), westernTiles.toPng());
writeFileSync(join(out, 'western.tmx'), toTmx(western, westernSheet.tiles.length, westernTiles.h / TILE, 'western-tiles.png', WG.pondAnims, 'western'));
writeFileSync(join(out, 'western.walkers.json'), JSON.stringify(western.walkers, null, 2) + '\n');
writeFileSync(join(out, 'western.places.json'), JSON.stringify(western.places, null, 2) + '\n');
writeFileSync(join(out, 'western.walk.json'), JSON.stringify({ spawn: western.spawn, rows: western.walk }, null, 1) + '\n');
console.log(`western: ${westernSheet.tiles.length} tiles`);

// 自己地盘用：建筑整图图集 + 路面图块编号（地面图块仍在 town-tiles.png 里）
const objects = packObjects();
warmGrade(objects.canvas);
writeFileSync(join(out, 'buildings.png'), objects.canvas.toPng());
writeFileSync(join(out, 'buildings-frames.json'), JSON.stringify({ frames: objects.frames }, null, 2) + '\n');
const terrainTiles = {
    grass: G.grass, dirt: G.dirt, stone: G.stone, soil: G.soil, stoneFill: G.stoneFill, gravel: G.gravel, water: G.water, wood: G.planks,
};
writeFileSync(join(out, 'terrain.json'), JSON.stringify(terrainTiles) + '\n');
console.log(`${sheet.tiles.length} tiles, ${Object.keys(objects.frames).length} buildings, ${PEOPLE.length} people, written to ${out}`);

/** 外圈草地的亮度，游戏里 VillageView 用同一个数。 */
const BORDER_SHADE = 0.86;

/** 地盘的样子：和游戏里 VillageView 同样的画法（地面按掩码挑图块，外圈远景地面，建筑和地貌按占地底边从上往下画）。 */
function renderVillage(scale: number, v: VillageState = newVillage(WORLD)): Canvas {
    const [w, h] = villageSize(WORLD, v);
    const border = WORLD.villageBorder;
    const m = border.margin;
    const c = new Canvas((w + 2 * m) * TILE * scale, (h + 2 * m) * TILE * scale);
    const blit = (src: Canvas, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number) => {
        for (let y = 0; y < sh; y++) {
            for (let x = 0; x < sw; x++) {
                const i = ((sy + y) * src.w + sx + x) * 4;
                for (let ky = 0; ky < scale; ky++) {
                    for (let kx = 0; kx < scale; kx++) {
                        c.blend((dx + m * TILE + x) * scale + kx, (dy + m * TILE + y) * scale + ky, src.px[i], src.px[i + 1], src.px[i + 2], src.px[i + 3]);
                    }
                }
            }
        }
    };
    const grid = terrainGrid(WORLD, v);
    for (let y = -m; y < h + m; y++) {
        for (let x = -m; x < w + m; x++) {
            const inside = x >= 0 && y >= 0 && x < w && y < h;
            const t = inside ? grid[y * w + x] : borderGround(border, w, h, x, y);
            const mask = t ? sceneMask(border, grid, w, h, x, y) : 0;
            const id = t ? terrainTiles[t][mask] : terrainTiles.grass[grassVariant(x, y)];
            blit(tileset, (id % COLS) * TILE, Math.floor(id / COLS) * TILE, TILE, TILE, x * TILE, y * TILE);
        }
    }
    // 外圈压暗一点，和能盖房子的地方分开
    const shadePen = new Pen(c, mulberry32(1));
    const S = TILE * scale;
    shadePen.D(0, 0, c.w, m * S, BORDER_SHADE);
    shadePen.D(0, (h + m) * S, c.w, m * S, BORDER_SHADE);
    shadePen.D(0, m * S, m * S, h * S, BORDER_SHADE);
    shadePen.D((w + m) * S, m * S, m * S, h * S, BORDER_SHADE);
    const items = v.items.map((it) => ({ it, def: WORLD.buildings[it.def] }))
        .filter((e) => e.def.kind === 'building' || e.def.terrain === 'soil')
        .map(({ it, def }) => ({ x: it.x, y: it.y, foot: def.foot, sprite: def.sprite }));
    // 预览图里菜地轮流种上各阶段、各种作物，看作物图
    const cropSprites = Object.keys(objects.frames).filter((n) => n.startsWith('crop_'));
    let k = 0;
    for (const e of items) if (!e.sprite) e.sprite = cropSprites[k++ % cropSprites.length];
    for (const d of activeWild(WORLD, v)) if (d.sprite) items.push({ x: d.x, y: d.y, foot: [d.w, d.h], sprite: d.sprite });
    for (const d of borderDecor(border, w, h)) items.push({ x: d.x, y: d.y, foot: [1, 1], sprite: d.sprite });
    items.sort((a, b) => (a.y + a.foot[1]) - (b.y + b.foot[1]));
    for (const { x, y, foot, sprite } of items) {
        const [fx, fy, fw, fh] = objects.frames[sprite!];
        const left = (x + foot[0] / 2) * TILE - fw / 2;
        const bottom = (y + foot[1]) * TILE;
        blit(objects.canvas, fx, fy, fw, fh, left, bottom - fh);
    }
    return c;
}

/** 预览用的小镇档地盘：新加的建造物各摆几件，看大小和画风。摆不下的打印出来。 */
function demoVillage(): VillageState {
    const s = newGame(WORLD, Date.now(), 'demo', 'jiangnan');
    s.gold = 1e7;
    s.village.tier = 'town';
    const put = (def: string, x: number, y: number) => {
        const r = place(WORLD, s, def, x, y);
        if (!r.ok) console.warn(`预览摆不下 ${def}@${x},${y}：${r.reason}`);
    };
    const row = (def: string, x0: number, x1: number, y: number) => { for (let x = x0; x <= x1; x++) put(def, x, y); };
    put('house_gable', 4, 10);
    row('flowerbed', 11, 14, 11);
    put('stone_lamp', 3, 11);
    row('road_gravel', 2, 27, 13);
    put('pavilion', 22, 10);
    put('coop', 3, 16);
    put('beehive', 8, 16);
    put('beehive', 9, 16);
    for (let y = 16; y < 20; y++) row('field', 12, 17, y);
    put('scarecrow', 18, 17);
    put('haystack', 20, 16);
    put('grape_trellis', 3, 22);
    put('threshing', 8, 22);
    put('shrine', 14, 24);
    row('road_gravel', 2, 27, 27);
    put('bridge', 28, 27);
    put('bridge', 29, 27);
    row('road_gravel', 30, 35, 27);
    for (let y = 29; y < 32; y++) row('pond', 4, 7, y);
    put('duck_shed', 20, 32);
    put('stone_lamp', 26, 33);
    return s.village;
}

const previewIdx = process.argv.indexOf('--preview');
if (previewIdx > 0) {
    const dir = process.argv[previewIdx + 1];
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'jiangnan-preview.png'), renderPreview(jiangnan, tileset, people, 1).toPng());
    writeFileSync(join(dir, 'people.png'), people.toPng());
    // 手机视角：默认 3 倍缩放下一屏约 15×27 格，720×1296
    const views: [string, number, number][] = [
        ['plaza', 68, 28], ['canal', 84, 58], ['farm', 36, 68], ['west', 32, 36],
        ['teahill', 77, 0], ['dock', 133, 38], ['lake', 133, 78], ['temple', 2, 28], ['paddy', 27, 93],
    ];
    for (const [name, x, y] of views) {
        writeFileSync(join(dir, `view-${name}.png`), renderPreview(jiangnan, tileset, people, 3, x, y, 15, 27).toPng());
    }
    writeFileSync(join(dir, 'western-preview.png'), renderPreview(western, westernTiles, people, 1).toPng());
    const westViews: [string, number, number][] = [
        ['w-saloon', 80, 28], ['w-bank', 56, 28], ['w-livery', 12, 28], ['w-chapel', 73, 12],
        ['w-mine', 30, 4], ['w-mesa', 110, 0], ['w-ranch', 136, 20], ['w-arroyo', 72, 66], ['w-backyard', 52, 44],
    ];
    for (const [name, x, y] of westViews) {
        writeFileSync(join(dir, `view-${name}.png`), renderPreview(western, westernTiles, people, 3, x, y, 15, 27).toPng());
    }
    writeFileSync(join(dir, 'village.png'), renderVillage(2).toPng());
    writeFileSync(join(dir, 'village-demo.png'), renderVillage(2, demoVillage()).toPng());
    writeFileSync(join(dir, 'buildings.png'), objects.canvas.toPng());
    console.log(`preview written to ${dir}`);
}
