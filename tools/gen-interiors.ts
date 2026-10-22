// 生成屋里用的图和门表。不碰 people.png 等其他产物，单独跑。
// 用法：npx tsx tools/gen-interiors.ts [--preview <目录>]
// 输出（assets/resources/maps/）：
//   interior.png / interior-frames.json   室内图块、家具、礼物图标，frames 记每张 [x, y, w, h]（像素）
//   <地图>.doors.json                      镇上每栋能点的房子：盖住的格子、门前格、室内配方（布局在 tools/maps/ 里登记）
// --preview 把每个配方排两间样例画成 PNG，看排得好不好。

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hashString, mulberry32 } from '../assets/scripts/core/rng';
import { Canvas, Pen, TILE, warmGrade } from './art/canvas';
import { FURNITURE_ART, GIFT_ART, interiorTiles } from './art/interior';
import { buildJiangnan } from './maps/jiangnan';
import { buildWestern } from './maps/western';
import { FURNITURE } from '../assets/scripts/data/furniture';
import { INTERIORS } from '../assets/scripts/data/interiors';
import { interiorTile, layoutInterior, InteriorWorld } from '../assets/scripts/core/interior';

type Frame = [number, number, number, number];

const out = join(__dirname, '..', 'assets', 'resources', 'maps');
mkdirSync(out, { recursive: true });

interface Sprite {
    w: number;
    h: number;
    paint: (p: Pen) => void;
}

const sprites: Record<string, Sprite> = {};
for (const [name, paint] of Object.entries(interiorTiles())) sprites[name] = { w: TILE, h: TILE, paint };
for (const def of Object.values(FURNITURE)) {
    const paint = FURNITURE_ART[def.id];
    if (!paint) throw new Error(`家具 ${def.id} 没有画法（tools/art/interior.ts 的 FURNITURE_ART）`);
    sprites[def.id] = { w: def.art[0] * TILE, h: def.art[1] * TILE, paint };
}
for (const [name, paint] of Object.entries(GIFT_ART)) sprites[name] = { w: TILE, h: TILE, paint };

/** 按高度排成几行拼进一张图（同 objects.ts 的 packObjects），每张图按名字定种子，加东西不影响别的图。 */
function pack(width = 512): { canvas: Canvas; frames: Record<string, Frame> } {
    const names = Object.keys(sprites).sort((a, b) => sprites[b].h - sprites[a].h || a.localeCompare(b));
    const frames: Record<string, Frame> = {};
    let x = 0;
    let y = 0;
    let rowH = 0;
    for (const n of names) {
        const { w, h } = sprites[n];
        if (x + w > width) {
            x = 0;
            y += rowH;
            rowH = 0;
        }
        frames[n] = [x, y, w, h];
        x += w;
        rowH = Math.max(rowH, h);
    }
    const canvas = new Canvas(width, y + rowH);
    for (const n of names) {
        const [fx, fy, fw, fh] = frames[n];
        const one = new Canvas(fw, fh);
        sprites[n].paint(new Pen(one, mulberry32(hashString(`interior-art|${n}`))));
        for (let yy = 0; yy < fh; yy++) {
            for (let xx = 0; xx < fw; xx++) {
                const si = (yy * fw + xx) * 4;
                const di = ((fy + yy) * width + fx + xx) * 4;
                for (let k = 0; k < 4; k++) canvas.px[di + k] = one.px[si + k];
            }
        }
    }
    return { canvas, frames };
}

const atlas = pack();
warmGrade(atlas.canvas);
writeFileSync(join(out, 'interior.png'), atlas.canvas.toPng());
writeFileSync(join(out, 'interior-frames.json'), JSON.stringify(atlas.frames) + '\n');

for (const [name, map] of [['jiangnan', buildJiangnan()], ['western', buildWestern()]] as const) {
    writeFileSync(join(out, `${name}.doors.json`), JSON.stringify(map.doors, null, 1) + '\n');
}

const pi = process.argv.indexOf('--preview');
if (pi > 0) {
    const dir = process.argv[pi + 1];
    mkdirSync(dir, { recursive: true });
    const world: InteriorWorld = { furniture: FURNITURE, recipes: INTERIORS };
    const blit = (dst: Canvas, name: string, dx: number, dy: number) => {
        const [sx, sy, sw, sh] = atlas.frames[name];
        for (let y = 0; y < sh; y++) {
            for (let x = 0; x < sw; x++) {
                const i = ((sy + y) * atlas.canvas.w + sx + x) * 4;
                const a = atlas.canvas.px[i + 3];
                if (a) dst.blend(dx + x, dy + y, atlas.canvas.px[i], atlas.canvas.px[i + 1], atlas.canvas.px[i + 2], a);
            }
        }
    };
    const sheets: Canvas[] = [];
    for (const recipe of Object.values(INTERIORS)) {
        for (const key of ['a', 'b']) {
            const L = layoutInterior(world, recipe.id, `preview:${key}`);
            const c = new Canvas(L.w * TILE, L.h * TILE);
            for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) blit(c, interiorTile(recipe, L, x, y), x * TILE, y * TILE);
            const draw = [...L.items].sort((a, b) => {
                const fa = FURNITURE[a.f];
                const fb = FURNITURE[b.f];
                const la = fa.spot === 'rug' ? -1 : fa.spot === 'hang' ? 0 : 1;
                const lb = fb.spot === 'rug' ? -1 : fb.spot === 'hang' ? 0 : 1;
                return la - lb || a.y + fa.foot[1] - (b.y + fb.foot[1]);
            });
            for (const it of draw) {
                const def = FURNITURE[it.f];
                const ax = it.x * TILE + ((def.foot[0] - def.art[0]) * TILE) / 2;
                const ay = def.spot === 'hang' ? it.y * TILE : (it.y + def.foot[1] - def.art[1]) * TILE;
                blit(c, def.id, ax, ay);
            }
            if (L.keeper) {
                for (let y = 2; y < 14; y++) for (let x = 5; x < 11; x++) c.blend(L.keeper[0] * TILE + x, L.keeper[1] * TILE + y, 60, 120, 220, 200);
            }
            writeFileSync(join(dir, `${recipe.id}-${key}.png`), c.toPng());
            if (key === 'a') sheets.push(c);
        }
    }
    // 每个配方第一间拼成一张总览
    const cw = Math.max(...sheets.map((c) => c.w)) + 8;
    const ch = Math.max(...sheets.map((c) => c.h)) + 8;
    const cols = 6;
    const all = new Canvas(cw * cols, ch * Math.ceil(sheets.length / cols));
    all.px.fill(255);
    sheets.forEach((c, k) => {
        const ox = (k % cols) * cw;
        const oy = Math.floor(k / cols) * ch;
        for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
            const i = (y * c.w + x) * 4;
            all.blend(ox + x, oy + y, c.px[i], c.px[i + 1], c.px[i + 2], c.px[i + 3]);
        }
    });
    writeFileSync(join(dir, 'all.png'), all.toPng());
    console.log(`预览写到 ${dir}`);
}
console.log(`interior.png ${atlas.canvas.w}×${atlas.canvas.h}，${Object.keys(atlas.frames).length} 张`);
