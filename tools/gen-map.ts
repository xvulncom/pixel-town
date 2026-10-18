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
import { Canvas, COLS, EMPTY, TILE, warmGrade } from './art/canvas';
import { DIRS, drawPeople, FRAME_H, FRAME_W, FRAMES, handAnchors, PEOPLE } from './art/people';
import { G, sheet } from './art/tileset';
import { MapData } from './maps/builder';
import { buildJiangnan } from './maps/jiangnan';
import { packObjects } from './art/objects';
import { WORLD } from '../assets/scripts/data/world';
import { grassVariant, newVillage, terrainGrid, terrainMask, villageSize } from '../assets/scripts/core/village';

function layerData(tiles: number[]): string {
    const buf = Buffer.alloc(tiles.length * 4);
    tiles.forEach((t, i) => buf.writeUInt32LE(t === EMPTY ? 0 : t + 1, i * 4));
    return buf.toString('base64');
}

function toTmx(map: MapData, tileCount: number, rows: number): string {
    const layer = (id: number, name: string, tiles: number[]) =>
        `  <layer id="${id}" name="${name}" width="${map.w}" height="${map.h}">\n`
        + `    <data encoding="base64">${layerData(tiles)}</data>\n`
        + '  </layer>\n';
    const anims = G.waterAnims.map((frames) => {
        const list = frames.map((t) => `      <frame tileid="${t}" duration="300"/>`).join('\n');
        return `    <tile id="${frames[0]}">\n      <animation>\n${list}\n      </animation>\n    </tile>\n`;
    }).join('');
    return '<?xml version="1.0" encoding="UTF-8"?>\n'
        + `<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" width="${map.w}" height="${map.h}" tilewidth="${TILE}" tileheight="${TILE}" infinite="0" nextlayerid="4" nextobjectid="1">\n`
        + `  <tileset firstgid="1" name="town" tilewidth="${TILE}" tileheight="${TILE}" tilecount="${tileCount}" columns="${COLS}">\n`
        + `    <image source="town-tiles.png" width="${COLS * TILE}" height="${rows * TILE}"/>\n`
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

// 自己地盘用：建筑整图图集 + 路面图块编号（地面图块仍在 town-tiles.png 里）
const objects = packObjects();
warmGrade(objects.canvas);
writeFileSync(join(out, 'buildings.png'), objects.canvas.toPng());
writeFileSync(join(out, 'buildings-frames.json'), JSON.stringify({ frames: objects.frames }, null, 2) + '\n');
const terrainTiles = { grass: G.grass, dirt: G.dirt, stone: G.stone, soil: G.soil, stoneFill: G.stoneFill };
writeFileSync(join(out, 'terrain.json'), JSON.stringify(terrainTiles) + '\n');
console.log(`${sheet.tiles.length} tiles, ${Object.keys(objects.frames).length} buildings, ${PEOPLE.length} people, written to ${out}`);

/** 开局村庄的样子：和游戏里 VillageView 同样的画法（地面按掩码挑图块，建筑按占地底边从上往下画）。 */
function renderVillage(scale: number): Canvas {
    const v = newVillage(WORLD);
    const [w, h] = villageSize(WORLD, v);
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
    const grid = terrainGrid(WORLD, v);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const t = grid[y * w + x];
            const id = t ? terrainTiles[t][terrainMask(grid, w, h, x, y)] : terrainTiles.grass[grassVariant(x, y)];
            blit(tileset, (id % COLS) * TILE, Math.floor(id / COLS) * TILE, TILE, TILE, x * TILE, y * TILE);
        }
    }
    const items = v.items.map((it) => ({ it, def: WORLD.buildings[it.def] })).filter((e) => e.def.kind === 'building');
    items.sort((a, b) => (a.it.y + a.def.foot[1]) - (b.it.y + b.def.foot[1]));
    for (const { it, def } of items) {
        const [fx, fy, fw, fh] = objects.frames[def.sprite!];
        const left = (it.x + def.foot[0] / 2) * TILE - fw / 2;
        const bottom = (it.y + def.foot[1]) * TILE;
        blit(objects.canvas, fx, fy, fw, fh, left, bottom - fh);
    }
    return c;
}

const previewIdx = process.argv.indexOf('--preview');
if (previewIdx > 0) {
    const dir = process.argv[previewIdx + 1];
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'jiangnan-preview.png'), renderPreview(jiangnan, tileset, people, 1).toPng());
    writeFileSync(join(dir, 'people.png'), people.toPng());
    // 手机视角：默认 3 倍缩放下一屏约 15×27 格，720×1296
    const views: [string, number, number][] = [['plaza', 36, 0], ['canal', 52, 30], ['farm', 4, 40], ['west', 0, 8]];
    for (const [name, x, y] of views) {
        writeFileSync(join(dir, `view-${name}.png`), renderPreview(jiangnan, tileset, people, 3, x, y, 15, 27).toPng());
    }
    writeFileSync(join(dir, 'village.png'), renderVillage(2).toPng());
    writeFileSync(join(dir, 'buildings.png'), objects.canvas.toPng());
    console.log(`preview written to ${dir}`);
}
