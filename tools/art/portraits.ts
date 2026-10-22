// 对话立绘：每个人一张 48×48 的半身像（头和肩），和走路帧共用 people.ts 的 Look，加一个人不用另外画。
// 游戏里按整数倍放大显示（对话框里 3 倍），所以和地图一样是硬边像素画；背景透明，框和底色由对话框画。
// 拼成一张图集 portraits.png，portraits-frames.json 记每张的 id；没有立绘的人用 unknown（灰色剪影 + 问号）。

import { Canvas, Pen, Rnd } from './canvas';
import { C } from './palette';
import { darker, lighter, Look, outline, PEOPLE } from './people';

export const PORTRAIT = 48;
export const PORTRAIT_COLS = 8;
/** 缺立绘时用的那张 */
export const FALLBACK_ID = 'unknown';

const EYE_WHITE = 0xf6f0e6;
const LINE = 0x2a1f1a;
const LIPS = 0xa0524a;
const BLUSH = 0xf0a098;
const MID = 24;

/** 头的半宽：头顶到第 20 行是椭圆，往下脸颊直、下巴收窄。grow 让头发、帽子比头大一圈。 */
function headHalf(y: number, grow = 0): number {
    if (y <= 21) {
        const ry = 13.5 + grow;
        const t = (y + 0.5 - 21) / ry;
        return t <= -1 ? 0 : Math.round((12 + grow) * Math.sqrt(1 - t * t));
    }
    if (y <= 25) return 12 + Math.round(grow);
    if (y > 34) return 0;
    return Math.round(12 + grow - Math.pow((y - 25) / 9, 1.5) * 7);
}

/** 肩膀和身子的半宽 */
function bodyHalf(y: number): number {
    if (y < 36) return 0;
    if (y <= 38) return 8 + (y - 36) * 4;
    return Math.min(22, 16 + Math.round((y - 38) * 1.8));
}

/** 横向一条：以中线对称，半宽 half */
function span(p: Pen, y: number, half: number, col: (x: number) => number | null): void {
    for (let x = MID - half; x < MID + half; x++) {
        const c = col(x);
        if (c !== null) p.P(x, y, c);
    }
}

/** 相对中线的横向位置，-1 最左、1 最右 */
const nx = (x: number, half: number) => (x + 0.5 - MID) / Math.max(1, half);

/** 三档明暗：左亮、中本色、右暗 */
function shade3(base: number, n: number, lo = 0.84, hi = 0.14): number {
    if (n > 0.5) return darker(base, lo);
    if (n < -0.62) return lighter(base, hi);
    return base;
}

function drawBody(p: Pen, o: Look, skin: number): void {
    const t = o.top;
    for (let y = 36; y < PORTRAIT; y++) {
        const half = bodyHalf(y);
        span(p, y, half, (x) => {
            const n = nx(x, half);
            // 袖子和身子之间的缝
            if (y > 40 && Math.abs(Math.abs(n) - 0.66) < 0.05) return darker(t, 0.72);
            return shade3(t, n);
        });
    }
    // 脖子（后画的头会盖住上半截），下巴底下压暗
    for (let y = 29; y < 39; y++) span(p, y, 5, (x) => (y < 33 || x >= MID + 2 ? darker(skin, 0.82) : skin));

    if (o.collar === 'shirt') {
        // 敞口翻领：领尖浅色、领口露皮肤、门襟一条线两颗扣
        const cl = lighter(t, 0.5);
        for (let i = 0; i < 5; i++) {
            p.R(MID - 7 + i, 36 + i, 3, 1, cl);
            p.R(MID + 4 - i, 36 + i, 3, 1, darker(cl, 0.9));
        }
        for (let y = 36; y < 40; y++) span(p, y, 4 - (y - 36), () => darker(skin, 0.9));
        p.R(MID - 1, 41, 1, 7, darker(t, 0.75));
        p.P(MID, 43, lighter(t, 0.55));
        p.P(MID, 46, lighter(t, 0.55));
    } else if (o.collar === 'robe') {
        // 交领：左襟压右襟，里面一层浅色
        const band = lighter(t, 0.42);
        for (let y = 36; y < 41; y++) span(p, y, 5 - (y - 36), () => lighter(t, 0.7));
        for (let i = 0; i < 10; i++) p.R(MID - 7 + i, 36 + i, 3, 1, band);
        for (let i = 0; i < 6; i++) p.R(MID + 5 - i, 36 + i, 3, 1, darker(band, 0.88));
    } else {
        // 对襟：立领一圈、中缝、两对盘扣
        for (let y = 35; y < 38; y++) span(p, y, 7, (x) => (y === 37 ? darker(t, 0.7) : shade3(lighter(t, 0.22), nx(x, 7))));
        p.R(MID - 1, 38, 1, 10, darker(t, 0.7));
        for (const y of [41, 45]) {
            p.R(MID - 3, y, 5, 1, lighter(t, 0.55));
            p.P(MID - 1, y, lighter(t, 0.8));
        }
    }
    if (o.vest) {
        for (let y = 37; y < PORTRAIT; y++) {
            const half = bodyHalf(y);
            const open = Math.max(2, 7 - (y - 37));
            span(p, y, half, (x) => {
                const d = Math.abs(x + 0.5 - MID);
                if (d < open) return null;
                return shade3(o.vest!, nx(x, half));
            });
        }
        p.P(MID + 3, 43, lighter(o.vest, 0.35));
        p.P(MID + 3, 46, lighter(o.vest, 0.35));
    }
    if (o.badge) {
        const star = ['..#..', '.###.', '#####', '.###.', '.#.#.'];
        star.forEach((row, j) => [...row].forEach((ch, i) => ch === '#' && p.P(13 + i, 40 + j, i + j < 3 ? 0xf3d892 : 0xe3b341)));
    }
    if (o.bandana) {
        for (let y = 34; y < 43; y++) span(p, y, y < 37 ? 8 : 8 - (y - 37) * 1.4, (x) => shade3(o.bandana!, nx(x, 8), 0.8));
        p.R(MID - 2, 36, 4, 2, darker(o.bandana, 0.7));
    }
    if (o.apron) {
        const a = o.apron;
        for (let y = 37; y < PORTRAIT; y++) {
            p.R(MID - 7, y, 2, 1, a);
            p.R(MID + 5, y, 2, 1, darker(a, 0.88));
        }
        for (let y = 42; y < PORTRAIT; y++) span(p, y, 7, (x) => shade3(a, nx(x, 7)));
        span(p, 42, 7, () => lighter(a, 0.25));
    }
}

function drawHairBack(p: Pen, o: Look): void {
    if (o.hairStyle !== 'long') return;
    // 披发：从头顶垂到肩下，脖子前面让开
    for (let y = 12; y < 46; y++) {
        const half = Math.max(headHalf(Math.min(y, 24), 2.5), 14);
        span(p, y, half, (x) => {
            const d = Math.abs(x + 0.5 - MID);
            if (y > 28 && d < 9) return null;
            return shade3(o.hair, nx(x, half), 0.8, 0.18);
        });
    }
}

function drawHead(p: Pen, o: Look, skin: number): void {
    for (let y = 7; y <= 34; y++) {
        const half = headHalf(y);
        span(p, y, half, (x) => {
            const n = nx(x, half);
            if (n > 0.6) return darker(skin, 0.86);
            if (n < -0.7 && y < 27) return lighter(skin, 0.12);
            if (y >= 33) return darker(skin, 0.92);
            return skin;
        });
    }
    // 耳朵
    for (const [x0, k] of [[MID - 14, 0.94], [MID + 12, 0.84]] as [number, number][]) {
        p.R(x0, 21, 2, 6, darker(skin, k));
        p.R(x0 + (x0 < MID ? 1 : 0), 22, 1, 4, darker(skin, k * 0.85));
    }
}

function drawFace(p: Pen, o: Look, skin: number): void {
    // 眼睛：左眼 16..19，右眼 28..31（相对中线对称），高光都在左上
    for (const xl of [16, 28]) {
        if (o.eyes === 'smile') {
            p.R(xl + 1, 22, 2, 1, LINE);
            p.P(xl, 23, LINE);
            p.P(xl + 3, 23, LINE);
        } else if (o.eyes === 'narrow') {
            p.R(xl - (xl < MID ? 1 : 0), 22, 5, 1, LINE);
            p.R(xl, 23, 4, 1, EYE_WHITE);
            p.R(xl + 1, 23, 2, 1, C.eye);
        } else {
            p.R(xl, 21, 4, 1, LINE);
            p.R(xl, 22, 4, 2, EYE_WHITE);
            p.R(xl + 1, 22, 2, 3, C.eye);
            p.P(xl + 1, 22, 0xffffff);
            p.P(xl + 2, 24, 0x5a3a2a);
        }
        // 眉毛
        const brow = o.old ? lighter(o.hair, 0.15) : darker(o.hair, 0.9);
        p.R(xl, 19, 4, 1, o.hairStyle === 'shaved' ? darker(skin, 0.7) : brow);
        p.P(xl < MID ? xl : xl + 3, 18, o.hairStyle === 'shaved' ? darker(skin, 0.7) : brow);
    }
    // 鼻子、嘴、腮红
    p.P(MID, 25, darker(skin, 0.86));
    p.P(MID, 26, darker(skin, 0.8));
    p.R(MID - 2, 27, 3, 1, darker(skin, 0.86));
    const smile = o.eyes === 'smile';
    p.R(MID - 2, 30, 4, 1, LIPS);
    if (smile) {
        p.P(MID - 3, 29, LIPS);
        p.P(MID + 2, 29, LIPS);
        p.R(MID - 1, 31, 2, 1, darker(skin, 0.85));
    }
    for (const x of [16, 29]) {
        for (let i = 0; i < 3; i++) p.P(x + i, 27, mix(skin, BLUSH, 0.55));
        p.P(x + 1, 28, mix(skin, BLUSH, 0.3));
    }
    if (o.old) {
        const w = darker(skin, 0.78);
        p.P(14, 23, w);
        p.P(15, 24, w);
        p.P(33, 23, w);
        p.P(32, 24, w);
        p.R(19, 28, 1, 2, w);
        p.R(28, 28, 1, 2, w);
        p.R(20, 15, 8, 1, darker(skin, 0.88));
    }
    if (o.beard) {
        const b = o.beard;
        for (let y = 27; y <= 35; y++) {
            const half = Math.max(headHalf(y) + (y >= 33 ? 1 : 0), y === 35 ? 5 : 0);
            span(p, y, half, (x) => {
                const d = Math.abs(x + 0.5 - MID);
                if (y === 27 && d < 9) return null;
                if (y === 28 && d < 3) return null;
                if (y >= 29 && y <= 30 && d < 3) return y === 30 ? darker(LIPS, 0.8) : null;
                return shade3(b, nx(x, half), 0.8, 0.2);
            });
        }
        // 两撇小胡子
        p.R(MID - 5, 28, 4, 1, b);
        p.R(MID + 1, 28, 4, 1, darker(b, 0.9));
    }
    if (o.glasses) {
        const g = 0x3a2c28;
        for (const xl of [15, 27]) {
            p.R(xl, 20, 6, 1, g);
            p.R(xl, 25, 6, 1, g);
            p.R(xl, 20, 1, 6, g);
            p.R(xl + 5, 20, 1, 6, g);
            p.P(xl + 1, 21, 0xffffff);
        }
        p.R(21, 22, 6, 1, g);
    }
}

function mix(a: number, b: number, k: number): number {
    const ch = (s: number) => Math.round(((a >> s) & 0xff) * (1 - k) + ((b >> s) & 0xff) * k);
    return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

function drawHairFront(p: Pen, o: Look, skin: number): void {
    const h = o.hair;
    const hi = lighter(h, 0.24);
    if (o.hairStyle === 'shaved') {
        for (let y = 8; y < 13; y++) span(p, y, headHalf(y) - 1, (x) => (nx(x, 12) < -0.2 && y < 10 ? lighter(skin, 0.3) : null));
        return;
    }
    if (o.hairStyle === 'bald') {
        // 两侧和后脑一圈头发，头顶反光
        for (let y = 15; y < 24; y++) {
            span(p, y, headHalf(y, 1), (x) => (Math.abs(x + 0.5 - MID) > headHalf(y) - 2 ? shade3(h, nx(x, 13), 0.8) : null));
        }
        p.R(18, 9, 3, 2, lighter(skin, 0.4));
        p.P(17, 11, lighter(skin, 0.3));
        return;
    }
    const capBottom = o.hairStyle === 'bun' || o.hairStyle === 'braid' ? 14 : 16;
    for (let y = 5; y < capBottom; y++) {
        const half = headHalf(y, 1.5);
        span(p, y, half, (x) => {
            const n = nx(x, half);
            if (y >= 8 && y <= 9 && n > -0.75 && n < -0.2) return hi;
            if (n > 0.55) return darker(h, 0.78);
            // 发丝：几道斜着的暗线
            if ((x * 2 + y) % 9 === 0 && y > 6) return darker(h, 0.86);
            return h;
        });
    }
    if (o.hairStyle === 'bun' || o.hairStyle === 'braid') {
        // 梳得平整：额头一道发际线，中分
        for (let y = 14; y < 18; y++) {
            span(p, y, headHalf(y, 1), (x) => {
                const d = Math.abs(x + 0.5 - MID);
                return d > headHalf(y) - 3 - (y - 14) ? shade3(h, nx(x, 13), 0.8) : null;
            });
        }
        p.R(MID, 6, 1, 8, darker(h, 0.7));
        if (o.hairStyle === 'bun') {
            for (let y = 0; y < 8; y++) {
                const half = Math.round(5 * Math.sqrt(Math.max(0, 1 - ((y - 3.5) / 4.2) ** 2)));
                span(p, y, half, (x) => (nx(x, half) < -0.3 && y < 4 ? hi : shade3(h, nx(x, half), 0.78)));
            }
            span(p, 6, 5, () => darker(h, 0.6));
        } else {
            // 麻花辫从右肩垂下
            for (let y = 26; y < 47; y++) {
                const seg = Math.floor((y - 26) / 3) % 2;
                p.R(MID + 10 + seg, y, 4, 1, (y - 26) % 3 === 2 ? darker(h, 0.65) : seg ? h : darker(h, 0.85));
            }
            p.R(MID + 10, 44, 5, 2, 0xc9302c);
        }
        return;
    }
    // short / long：参差的刘海 + 鬓角
    const bangs = [3, 2, 1, 2, 3, 1, 0, 2];
    for (let x = MID - 13; x < MID + 13; x++) {
        const d = Math.abs(x + 0.5 - MID);
        const bottom = d > 10 ? 23 : 16 + bangs[((x % 8) + 8) % 8];
        for (let y = 15; y < bottom; y++) {
            if (Math.abs(x + 0.5 - MID) > headHalf(y, 1)) continue;
            p.P(x, y, x >= MID + 7 ? darker(h, 0.78) : y === bottom - 1 ? darker(h, 0.82) : h);
        }
    }
}

function drawHat(p: Pen, o: Look): void {
    if (!o.hat) return;
    const faceShadow = (y0: number, y1: number, k: number) => {
        for (let y = y0; y < y1; y++) {
            const half = headHalf(y);
            for (let x = MID - half; x < MID + half; x++) p.D(x, y, 1, 1, k);
        }
    };
    if (o.hat === 'straw') {
        const c = o.hatColor ?? 0xd8b45a;
        const weave = (x: number, y: number, base: number) => ((x + y * 2) % 4 === 0 ? darker(base, 0.88) : base);
        faceShadow(15, 18, 0.84);
        for (let y = 1; y < 11; y++) {
            const half = y < 3 ? 6 + y : 9;
            span(p, y, half, (x) => (y >= 8 && y <= 9 ? 0x8a5a34 : weave(x, y, shade3(c, nx(x, half)))));
        }
        const brim = [19, 22, 23, 21];
        brim.forEach((half, j) => span(p, 11 + j, half, (x) => (j === 3 ? darker(c, 0.7) : weave(x, j, shade3(c, nx(x, half), 0.86)))));
    } else if (o.hat === 'conical') {
        const c = o.hatColor ?? 0xc9a85a;
        faceShadow(16, 19, 0.82);
        for (let y = 0; y < 15; y++) {
            const half = Math.round(1 + y * 1.62);
            span(p, y, half, (x) => {
                const ray = Math.floor(((x + 0.5 - MID) / (y + 1)) * 3);
                const base = ray % 2 === 0 ? c : darker(c, 0.9);
                return shade3(base, nx(x, half), 0.85);
            });
        }
        span(p, 15, 23, () => darker(c, 0.65));
    } else if (o.hat === 'cowboy') {
        const c = o.hatColor ?? 0x8a5a34;
        faceShadow(15, 18, 0.82);
        for (let y = 0; y < 12; y++) {
            const half = y === 0 ? 7 : 9;
            span(p, y, half, (x) => {
                const d = Math.abs(x + 0.5 - MID);
                if (y < 3 && d < 2.5 - y) return null;
                if (y >= 9 && y <= 10) return darker(c, 0.55);
                if (y < 9 && d < 1.5) return darker(c, 0.8);
                return shade3(c, nx(x, half));
            });
        }
        for (let j = 0; j < 4; j++) span(p, 12 + j, 22, (x) => (j === 3 ? darker(c, 0.68) : shade3(c, nx(x, 22), 0.85)));
        // 帽檐两头上翘
        for (let j = 0; j < 3; j++) {
            p.R(MID - 22, 9 + j, 3 - j, 1, lighter(c, 0.12));
            p.R(MID + 19 + j, 9 + j, 3 - j, 1, darker(c, 0.85));
        }
    } else if (o.hat === 'bonnet' || o.hat === 'scarf') {
        const c = o.hatColor ?? (o.hat === 'bonnet' ? 0xe8dcc0 : 0x3d6fb0);
        const grow = o.hat === 'bonnet' ? 4 : 2;
        const top = o.hat === 'bonnet' ? 3 : 5;
        const bottom = o.hat === 'bonnet' ? 31 : 28;
        for (let y = top; y < bottom; y++) {
            const half = Math.max(headHalf(Math.min(y, 24), grow), 8);
            span(p, y, half, (x) => {
                const d = Math.abs(x + 0.5 - MID);
                // 脸露在外面
                if (y >= 15 && d < headHalf(y) - 1) return null;
                if (y === 15 && d < headHalf(y) + 1 && o.hat === 'bonnet') return lighter(c, 0.45);
                if (o.hat === 'scarf' && (x * 3 + y * 5) % 11 === 0) return 0xf7f7f2;
                return shade3(c, nx(x, half), 0.84);
            });
        }
        // 下巴底下打的结
        for (let y = 33; y < 38; y++) span(p, y, y < 35 ? 3 : 5 - (y - 35), (x) => shade3(darker(c, 0.9), nx(x, 4)));
    }
}

/** 画一张立绘到 c 的 (x0, y0)。 */
export function drawPortrait(c: Canvas, x0: number, y0: number, o: Look, r: Rnd): void {
    const one = new Canvas(PORTRAIT, PORTRAIT);
    const p = new Pen(one, r);
    const skin = o.skin ?? C.skin;
    drawHairBack(p, o);
    drawBody(p, o, skin);
    drawHead(p, o, skin);
    drawFace(p, o, skin);
    drawHairFront(p, o, skin);
    drawHat(p, o);
    outline(one, 0, 0, PORTRAIT, PORTRAIT);
    blit(one, c, x0, y0);
}

/** 没有立绘的人：灰色剪影，脸上一个问号。 */
function drawUnknown(c: Canvas, x0: number, y0: number, r: Rnd): void {
    const one = new Canvas(PORTRAIT, PORTRAIT);
    const p = new Pen(one, r);
    const g = 0x8a8078;
    for (let y = 36; y < PORTRAIT; y++) span(p, y, bodyHalf(y), (x) => shade3(darker(g, 0.85), nx(x, bodyHalf(y))));
    for (let y = 7; y <= 34; y++) span(p, y, headHalf(y), (x) => shade3(g, nx(x, headHalf(y))));
    const q = ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'];
    q.forEach((row, j) => [...row].forEach((ch, i) => ch === '#' && p.R(MID - 5 + i * 2, 12 + j * 2, 2, 2, 0xf0e8d8)));
    outline(one, 0, 0, PORTRAIT, PORTRAIT);
    blit(one, c, x0, y0);
}

function blit(src: Canvas, dst: Canvas, x0: number, y0: number): void {
    for (let y = 0; y < src.h; y++) {
        for (let x = 0; x < src.w; x++) {
            const si = (y * src.w + x) * 4;
            if (src.px[si + 3] === 0) continue;
            const di = ((y0 + y) * dst.w + x0 + x) * 4;
            for (let k = 0; k < 4; k++) dst.px[di + k] = src.px[si + k];
        }
    }
}

/** 立绘的 id 顺序：PEOPLE 里每个人一张，最后一张是缺立绘时用的 unknown。 */
export function portraitIds(): string[] {
    return [...PEOPLE.map((p) => p.id), FALLBACK_ID];
}

export function drawPortraits(r: Rnd): Canvas {
    const ids = portraitIds();
    const rows = Math.ceil(ids.length / PORTRAIT_COLS);
    const c = new Canvas(PORTRAIT_COLS * PORTRAIT, rows * PORTRAIT);
    ids.forEach((id, i) => {
        const x0 = (i % PORTRAIT_COLS) * PORTRAIT;
        const y0 = Math.floor(i / PORTRAIT_COLS) * PORTRAIT;
        const person = PEOPLE.find((p) => p.id === id);
        if (person) drawPortrait(c, x0, y0, person.look, r);
        else drawUnknown(c, x0, y0, r);
    });
    return c;
}

/** portraits-frames.json 的内容 */
export function portraitInfo(): { size: number; cols: number; ids: string[]; fallback: string } {
    return { size: PORTRAIT, cols: PORTRAIT_COLS, ids: portraitIds(), fallback: FALLBACK_ID };
}
