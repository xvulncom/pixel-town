import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIRS, FRAME_H, FRAME_W, FRAMES, handAnchors, PEOPLE } from '../tools/art/people';
import { drawPortraits, FALLBACK_ID, PORTRAIT, PORTRAIT_COLS, portraitIds, portraitInfo } from '../tools/art/portraits';
import { buildJiangnan } from '../tools/maps/jiangnan';
import { buildWestern } from '../tools/maps/western';
import { portraitCell, PortraitSheet } from '../assets/scripts/core/portrait';
import { CHAT_MIN_TEXT_W, chatBoxLayout } from '../assets/scripts/core/chatLayout';
import { NPCS } from '../assets/scripts/data/npcs';
import { TOWN_FOLK } from '../assets/scripts/data/townFolk';
import { WORKERS } from '../assets/scripts/data/workers';
import { Rect } from '../assets/scripts/core/screen';

const MAPS = join(__dirname, '..', 'assets', 'resources', 'maps');
const sheet = JSON.parse(readFileSync(join(MAPS, 'portraits-frames.json'), 'utf8')) as PortraitSheet;
const walkers = [...buildJiangnan().walkers, ...buildWestern().walkers];

/** PNG 文件头里的宽高 */
function pngSize(file: string): [number, number] {
    const b = readFileSync(join(MAPS, file));
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

test('立绘：仓库里的 portraits-frames.json、people-frames.json 是最新生成的，图集尺寸对得上', () => {
    assert.deepEqual(sheet, portraitInfo(), '改了人物要重跑 npx tsx tools/gen-map.ts');
    assert.deepEqual(pngSize('portraits.png'), [PORTRAIT_COLS * PORTRAIT, Math.ceil(sheet.ids.length / PORTRAIT_COLS) * PORTRAIT]);
    const frames = JSON.parse(readFileSync(join(MAPS, 'people-frames.json'), 'utf8'));
    assert.deepEqual(frames.rows, PEOPLE.map((p) => p.id));
    assert.deepEqual(frames.hands, handAnchors());
    assert.deepEqual(pngSize('people.png'), [DIRS.length * FRAMES * FRAME_W, PEOPLE.length * FRAME_H]);
});

test('人物：16×32 不变，手部挂点四个朝向各三帧、都在帧内', () => {
    assert.equal(FRAME_W, 16);
    assert.equal(FRAME_H, 32);
    const hands = handAnchors();
    for (const d of DIRS) {
        assert.equal(hands[d].length, FRAMES);
        for (const [x, y] of hands[d]) assert.ok(x >= 0 && x < FRAME_W && y >= 0 && y < FRAME_H, `${d} 的手出了帧`);
    }
    assert.equal(new Set(PEOPLE.map((p) => p.id)).size, PEOPLE.length, '人物 id 重复');
});

test('立绘：PEOPLE 里加一行就有一张，最后一张是缺立绘时用的剪影，每张都画了东西', () => {
    assert.deepEqual(portraitIds(), [...PEOPLE.map((p) => p.id), FALLBACK_ID]);
    const c = drawPortraits(() => 0.5);
    portraitIds().forEach((id, i) => {
        const x0 = (i % PORTRAIT_COLS) * PORTRAIT;
        const y0 = Math.floor(i / PORTRAIT_COLS) * PORTRAIT;
        let solid = 0;
        for (let y = y0; y < y0 + PORTRAIT; y++) for (let x = x0; x < x0 + PORTRAIT; x++) if (c.px[(y * c.w + x) * 4 + 3]) solid++;
        assert.ok(solid > PORTRAIT * PORTRAIT * 0.3, `${id} 的立绘几乎是空的`);
    });
});

test('立绘：会说话、会被雇的人都有自己的立绘和走路帧', () => {
    const own = (id: string, why: string) => assert.equal(portraitCell(sheet, id).missing, false, `${id}（${why}）没有立绘，在 tools/art/people.ts 的 PEOPLE 加一行`);
    own('hero', '主角');
    for (const id of Object.keys(NPCS)) own(id, '镇民');
    for (const id of Object.keys(TOWN_FOLK)) own(id, '路人');
    for (const w of Object.values(WORKERS)) {
        own(w.id, '工人');
        assert.ok(PEOPLE.some((p) => p.id === w.look), `工人 ${w.id} 的 look ${w.look} 不在人物图里`);
    }
    for (const wk of walkers) {
        own(wk.id, '镇上走动的人');
        assert.equal(PEOPLE[wk.row]?.id, wk.id, `${wk.id} 借用了别人的样子（第 ${wk.row} 行）`);
        assert.ok(NPCS[wk.id] || TOWN_FOLK[wk.id], `${wk.id} 点了没话说，在 data/townFolk.ts 加一行`);
    }
});

test('立绘退路：不认识的人先试备选 id，再用剪影', () => {
    const miss = portraitCell(sheet, 'nobody');
    assert.equal(miss.missing, true);
    assert.equal(miss.id, FALLBACK_ID);
    const i = sheet.ids.indexOf(FALLBACK_ID);
    assert.deepEqual([miss.x, miss.y], [(i % sheet.cols) * sheet.size, Math.floor(i / sheet.cols) * sheet.size]);
    assert.equal(portraitCell(sheet, 'nobody', 'gui').id, 'gui');
    assert.equal(portraitCell(sheet, undefined as unknown as string).missing, true);
    // 图集里连剪影都没有时也不崩，退到第一张
    assert.equal(portraitCell({ ...sheet, fallback: 'gone' }, 'nobody').id, sheet.ids[0]);
});

test('对话框：竖屏、横屏、窄横屏都在屏幕里，不盖顶栏、不压右下角按钮，台词区够宽', () => {
    const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    // 按钮列和 Boot.buildActions 一样：右下角 132 宽、三颗
    const actions = (mapW: number, bottom: number): Rect => ({ x: mapW - 16 - 132, y: bottom - 3 * 84 + 12, w: 132, h: 3 * 84 - 12 });
    const cases: [string, number, number, number, number, Rect][] = [
        ['竖屏', 720, 1280, 120, 0, actions(720, 1280 - 330 - 16)],
        ['刘海屏竖屏', 720, 1560, 190, 40, actions(720, 1560 - 40 - 330 - 16)],
        ['横屏', 1560, 720, 90, 20, actions(1560 - 400, 720 - 16 - 20)],
        ['窄横屏', 960, 720, 90, 0, actions(960 - 400, 720 - 16)],
    ];
    for (const [name, W, H, top, pad, avoid] of cases) {
        const L = chatBoxLayout(W, H, top, pad, avoid, PORTRAIT);
        const { box } = L;
        assert.ok(box.x >= 0 && box.x + box.w <= W && box.y >= top && box.y + box.h <= H - pad, `${name} 对话框出界`);
        assert.ok(!overlap(box, avoid), `${name} 对话框压住按钮`);
        assert.ok(L.text.w >= CHAT_MIN_TEXT_W, `${name} 台词区太窄`);
        assert.equal(L.portrait.w, PORTRAIT * 3);
        assert.ok(L.portrait.x >= box.x && L.portrait.y + L.portrait.h <= box.y + box.h, `${name} 立绘出框`);
        assert.ok(L.text.x >= L.portrait.x + L.portrait.w, `${name} 台词压住立绘`);
    }
});
