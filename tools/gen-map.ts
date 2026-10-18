// 用代码画像素图块、人物和地图。正式美术到位前用它。
// 用法：npx tsx tools/gen-map.ts [--preview <目录>]
// 输出（assets/resources/maps/）：
//   town-tiles.png      所有地图共用的图块集
//   people.png          人物走路帧，people-frames.json 记行号、帧尺寸、手的位置
//   jiangnan.tmx        江南地图（Tiled），jiangnan.walkers.json 记镇上走动的人和路线
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
console.log(`${sheet.tiles.length} tiles, ${PEOPLE.length} people, written to ${out}`);

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
    console.log(`preview written to ${dir}`);
}
