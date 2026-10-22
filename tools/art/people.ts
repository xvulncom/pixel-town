// 人物：星露谷尺寸 16×32，四个朝向（下、左、右、上）× 3 帧（站、迈左脚、迈右脚）。
// 每个人一行，游戏里按行号切帧做走路动画。同一份 Look 也用来画对话立绘（portraits.ts）。
// 画法：头 10 宽（两侧露耳朵）、身子 8 宽、胳膊各 2 宽，光从左上来，左亮右暗；外轮廓按相邻颜色压暗（不是一圈死黑）。

import { Canvas, Pen, Rnd, TILE } from './canvas';
import { C } from './palette';

export interface Look {
    skin?: number;
    hair: number;
    /** short 短发、bun 盘髻、long 披发、braid 麻花辫、bald 秃顶（两侧有头发）、shaved 光头 */
    hairStyle: 'short' | 'bun' | 'long' | 'bald' | 'braid' | 'shaved';
    top: number;
    pants: number;
    hat?: 'straw' | 'conical' | 'scarf' | 'cowboy' | 'bonnet';
    hatColor?: number;
    apron?: number;
    beard?: number;
    /** 小孩：头一样大，身子和腿短 */
    child?: boolean;
    /** 西部：马甲颜色 */
    vest?: number;
    /** 西部：胸前警徽 */
    badge?: boolean;
    /** 西部：脖子上的方巾颜色 */
    bandana?: number;
    /** 长裙或长袍（盖住腿，颜色用 pants） */
    dress?: boolean;
    /** 衣领：tang 对襟盘扣（默认）、shirt 翻领衬衫、robe 交领长袍 */
    collar?: 'tang' | 'shirt' | 'robe';
    /** 眼睛：round 圆眼（默认）、smile 笑眯眼、narrow 细长眼 */
    eyes?: 'round' | 'smile' | 'narrow';
    glasses?: boolean;
    /** 上了年纪：立绘多画皱纹 */
    old?: boolean;
}

export const DIRS = ['down', 'left', 'right', 'up'] as const;
export const FRAMES = 3;
const FW = TILE;
const FH = TILE * 2;
const SHOE = 0x3a2a22;
const BLUSH = 0xf2a6a0;
const INK = 0x2a1f1a;

export function darker(c: number, k = 0.72): number {
    const r = Math.round(((c >> 16) & 0xff) * k);
    const g = Math.round(((c >> 8) & 0xff) * k);
    const b = Math.round((c & 0xff) * k);
    return (r << 16) | (g << 8) | b;
}

export function lighter(c: number, k = 0.25): number {
    const f = (v: number) => Math.round(v + (255 - v) * k);
    return (f((c >> 16) & 0xff) << 16) | (f((c >> 8) & 0xff) << 8) | f(c & 0xff);
}

/** 一帧里各部位的行号：H0 脸最上一行，S 肩，W 腰（腰带那行），腿到第 28 行，鞋在第 29 行。 */
interface Rows {
    H0: number;
    S: number;
    W: number;
}

function rowsOf(o: Look, bob: number): Rows {
    const H0 = 5 + (o.child ? 4 : 0) + bob;
    return { H0, S: H0 + 10, W: (o.child ? 25 : 23) + bob };
}

const swingOf = (step: number, side: number) => (step === 0 ? 0 : step === side ? 1 : -1);
/** 侧身时胳膊的左边一列：站 7、迈左脚往前 5、迈右脚往后 9 */
const sideArmX = (step: number) => (step === 0 ? 7 : step === 1 ? 5 : 9);

/** 正面或背面，step：0 站，1 迈左脚，2 迈右脚。 */
function front(p: Pen, o: Look, back: boolean, step: number, bob: number): void {
    const skin = o.skin ?? C.skin;
    const { H0, S, W } = rowsOf(o, bob);
    // 腿和鞋：抬起的那只脚鞋高一格
    for (const [x, side] of [[5, 1], [8, 2]] as [number, number][]) {
        const lifted = step !== 0 && step !== side;
        const shoeY = lifted ? 28 : 29;
        p.R(x, W + 1, 3, shoeY - W - 1, o.pants);
        p.R(x === 5 ? 7 : 10, W + 1, 1, shoeY - W - 1, darker(o.pants, 0.82));
        const sx = x === 5 ? 4 : 8;
        p.R(sx, shoeY, 4, 1, SHOE);
        p.P(sx + 1, shoeY, lighter(SHOE, 0.2));
    }
    p.R(4, W + 1, 8, 1, o.pants);
    if (o.dress) skirt(p, o, W, 4, 8);
    // 身子
    p.R(5, S, 6, 1, o.top);
    p.R(4, S + 1, 8, W - S, o.top);
    p.R(4, S + 1, 1, W - S - 1, lighter(o.top, 0.18));
    p.R(10, S + 1, 2, W - S, darker(o.top, 0.86));
    p.R(4, W, 8, 1, darker(o.top, 0.7));
    if (!back) collarFront(p, o, S, W, skin);
    if (o.apron && !back) {
        p.R(5, S + 4, 6, W - S - 1, o.apron);
        p.R(5, S + 4, 6, 1, lighter(o.apron));
        p.R(10, S + 5, 1, W - S - 2, darker(o.apron, 0.85));
        p.P(5, S + 1, o.apron);
        p.P(10, S + 1, o.apron);
        p.R(5, S + 2, 1, 2, o.apron);
        p.R(10, S + 2, 1, 2, o.apron);
    }
    westernFront(p, o, back, S, W);
    // 胳膊：外侧一列本色、里侧一列压暗当缝；迈左脚时右手往前（显得长一格）
    for (const [x, side] of [[2, 2], [12, 1]] as [number, number][]) {
        const sw = swingOf(step, side);
        const handY = W - 1 + sw;
        const outer = x === 2 ? 2 : 13;
        const inner = x === 2 ? 3 : 12;
        p.R(outer, S + 1, 1, handY - S - 1, x === 2 ? o.top : darker(o.top, 0.86));
        p.R(inner, S + 1, 1, handY - S - 1, darker(o.top, 0.74));
        p.R(x, handY, 2, 2, skin);
        p.P(inner, handY + 1, darker(skin, 0.85));
    }
    // 头：两侧露耳朵
    p.R(4, H0, 8, 1, skin);
    p.R(3, H0 + 1, 10, 8, skin);
    p.R(4, H0 + 9, 8, 1, skin);
    p.R(12, H0 + 1, 1, 8, darker(skin, 0.88));
    p.R(5, H0 + 9, 7, 1, darker(skin, 0.9));
    p.R(2, H0 + 4, 1, 2, darker(skin, 0.92));
    p.R(13, H0 + 4, 1, 2, darker(skin, 0.84));
    if (back) {
        hairBack(p, o, H0, S, skin);
    } else {
        face(p, o, H0, skin);
        hairFront(p, o, H0, S);
    }
    hat(p, o, H0, 0);
}

/** 正面的五官：眼睛、腮红、嘴、胡子、眼镜。 */
function face(p: Pen, o: Look, H0: number, skin: number): void {
    const ey = H0 + 4;
    for (const x of [5, 10]) {
        if (o.eyes === 'smile') {
            p.P(x, ey + 1, C.eye);
        } else if (o.eyes === 'narrow') {
            p.R(x === 5 ? 4 : 10, ey + 1, 2, 1, C.eye);
        } else {
            p.P(x, ey, 0x4a3a40);
            p.P(x, ey + 1, C.eye);
        }
    }
    p.P(4, H0 + 7, BLUSH);
    p.P(11, H0 + 7, BLUSH);
    p.R(7, H0 + 7, 2, 1, darker(skin, 0.7));
    if (o.beard) {
        p.R(6, H0 + 6, 4, 1, o.beard);
        p.R(3, H0 + 7, 4, 2, o.beard);
        p.R(9, H0 + 7, 4, 2, o.beard);
        p.R(4, H0 + 9, 8, 1, o.beard);
        p.R(5, H0 + 8, 6, 1, o.beard);
        p.R(7, H0 + 7, 2, 1, darker(o.beard, 0.6));
        p.R(10, H0 + 7, 2, 3, darker(o.beard, 0.85));
    }
    if (o.glasses) {
        p.R(4, ey - 1, 3, 1, 0x3a2c28);
        p.R(9, ey - 1, 3, 1, 0x3a2c28);
        p.R(7, ey - 1, 2, 1, 0x6a5a50);
    }
}

function hairFront(p: Pen, o: Look, H0: number, S: number): void {
    const h = o.hair;
    const hi = lighter(h, 0.22);
    const lo = darker(h, 0.8);
    switch (o.hairStyle) {
        case 'shaved':
            p.R(4, H0, 8, 1, darker(o.skin ?? C.skin, 0.92));
            return;
        case 'bald':
            p.R(3, H0 + 1, 1, 4, h);
            p.R(12, H0 + 1, 1, 4, lo);
            p.P(5, H0 + 1, lighter(o.skin ?? C.skin, 0.45));
            return;
        case 'bun':
        case 'braid':
            p.R(5, H0 - 1, 6, 1, h);
            p.R(4, H0, 8, 1, h);
            p.R(3, H0 + 1, 10, 1, h);
            p.R(3, H0 + 2, 1, 2, h);
            p.R(12, H0 + 2, 1, 2, lo);
            p.P(7, H0 - 1, lo);
            p.P(7, H0, lo);
            p.R(4, H0, 2, 1, hi);
            if (o.hairStyle === 'bun') {
                p.R(6, H0 - 4, 4, 3, h);
                p.R(7, H0 - 5, 2, 1, h);
                p.P(7, H0 - 4, hi);
                p.R(6, H0 - 2, 4, 1, darker(h, 0.7));
            } else {
                // 辫子从右肩垂下来
                for (let y = H0 + 6; y < S + 6; y++) p.P(12 + ((y - H0) % 2), y, (y - H0) % 2 ? h : lo);
                p.P(12, S + 6, 0xc9302c);
            }
            return;
        default: {
            // short / long：头顶一片 + 参差的刘海 + 鬓角
            p.R(5, H0 - 2, 6, 1, h);
            p.R(4, H0 - 1, 8, 1, h);
            p.R(3, H0, 10, 2, h);
            p.R(3, H0 + 2, 3, 1, h);
            p.R(9, H0 + 2, 4, 1, h);
            p.P(7, H0 + 2, h);
            p.R(3, H0 + 3, 1, 2, h);
            p.R(12, H0 + 3, 1, 2, lo);
            p.R(5, H0 - 1, 3, 1, hi);
            p.P(4, H0, hi);
            p.R(10, H0, 2, 2, lo);
            if (o.hairStyle === 'long') {
                p.R(2, H0 + 2, 2, 10, h);
                p.R(12, H0 + 2, 2, 10, lo);
                p.P(2, H0 + 12, h);
                p.P(13, H0 + 12, lo);
            }
        }
    }
}

function hairBack(p: Pen, o: Look, H0: number, S: number, skin: number): void {
    const h = o.hair;
    const lo = darker(h, 0.8);
    if (o.hairStyle === 'shaved') {
        p.R(4, H0, 8, 2, darker(skin, 0.94));
        return;
    }
    if (o.hairStyle === 'bald') {
        p.R(3, H0 + 3, 10, 5, h);
        p.R(10, H0 + 3, 3, 5, lo);
        p.R(4, H0 + 8, 8, 1, h);
        return;
    }
    p.R(5, H0 - 2, 6, 1, h);
    p.R(4, H0 - 1, 8, 1, h);
    p.R(3, H0, 10, 9, h);
    p.R(4, H0 + 9, 8, 1, h);
    p.R(10, H0, 3, 9, lo);
    p.R(5, H0 - 1, 3, 1, lighter(h, 0.22));
    if (o.hairStyle === 'long') {
        p.R(3, H0 + 9, 10, 5, h);
        p.R(10, H0 + 9, 3, 5, lo);
    } else if (o.hairStyle === 'bun') {
        p.R(6, H0 - 4, 4, 3, h);
        p.R(7, H0 - 5, 2, 1, h);
        p.R(6, H0 - 2, 4, 1, darker(h, 0.7));
    } else if (o.hairStyle === 'braid') {
        for (let y = H0 + 9; y < S + 6; y++) p.R(7, y, 2, 1, (y - H0) % 2 ? h : lo);
        p.R(7, S + 6, 2, 1, 0xc9302c);
    }
}

/** 正面衣领：对襟盘扣、翻领、交领。 */
function collarFront(p: Pen, o: Look, S: number, W: number, skin: number): void {
    const t = o.top;
    if (o.collar === 'shirt') {
        p.P(6, S, lighter(t, 0.5));
        p.P(9, S, lighter(t, 0.5));
        p.R(7, S, 2, 1, skin);
        p.P(7, S + 1, darker(skin, 0.85));
        p.R(7, S + 2, 1, W - S - 2, darker(t, 0.8));
        p.P(8, S + 3, lighter(t, 0.45));
        p.P(8, S + 6, lighter(t, 0.45));
    } else if (o.collar === 'robe') {
        p.R(5, S, 6, 1, lighter(t, 0.45));
        p.P(6, S + 1, lighter(t, 0.45));
        p.P(7, S + 2, lighter(t, 0.45));
        p.P(8, S + 3, lighter(t, 0.45));
        p.R(4, W - 2, 8, 2, darker(t, 0.6));
    } else {
        p.R(5, S, 6, 1, lighter(t, 0.3));
        p.R(7, S + 1, 1, W - S - 1, darker(t, 0.75));
        p.P(8, S + 2, lighter(t, 0.55));
        p.P(8, S + 5, lighter(t, 0.55));
    }
}

/** 长裙、长袍：从腰往下张开一点，鞋露在外面。 */
function skirt(p: Pen, o: Look, W: number, x0: number, w: number): void {
    for (let y = W; y < 29; y++) {
        const flare = y > W + 3 ? 1 : 0;
        p.R(x0 - flare, y, w + flare * 2, 1, y === 28 ? darker(o.pants) : o.pants);
        p.P(x0 + w - 1 + flare, y, darker(o.pants, 0.82));
    }
    p.R(x0, W, w, 1, lighter(o.pants));
}

/** 朝左的侧身，朝右由它镜像。 */
function side(p: Pen, o: Look, step: number, bob: number): void {
    const skin = o.skin ?? C.skin;
    const { H0, S, W } = rowsOf(o, bob);
    // 腿：站着并拢，迈步时前后分开；远处那条腿压暗
    if (step === 0) {
        p.R(6, W + 1, 4, 28 - W, o.pants);
        p.R(9, W + 1, 1, 28 - W, darker(o.pants, 0.82));
        p.R(5, 29, 5, 1, SHOE);
        p.P(5, 29, lighter(SHOE, 0.2));
    } else {
        const far = step === 1 ? 9 : 4;
        const near = step === 1 ? 4 : 9;
        p.R(far, W + 2, 3, 27 - W, darker(o.pants, 0.78));
        p.R(far - 1, 29, 4, 1, darker(SHOE, 0.8));
        p.R(6, W + 1, 4, 2, o.pants);
        p.R(near, W + 2, 3, 27 - W, o.pants);
        p.R(near - 1, 29, 4, 1, SHOE);
        p.P(near - 1, 29, lighter(SHOE, 0.2));
    }
    if (o.dress) skirt(p, o, W, 5, 6);
    // 身子
    p.R(6, S, 4, 1, o.top);
    p.R(5, S + 1, 6, W - S, o.top);
    p.R(5, S + 1, 1, W - S - 1, lighter(o.top, 0.18));
    p.R(10, S + 1, 1, W - S, darker(o.top, 0.82));
    p.R(5, W, 6, 1, darker(o.top, 0.7));
    if (o.collar === 'robe') p.R(5, W - 2, 6, 2, darker(o.top, 0.6));
    if (o.apron) p.R(4, S + 4, 2, W - S - 1, o.apron);
    westernSide(p, o, S, W);
    // 胳膊前后摆
    const ax = sideArmX(step);
    p.R(ax, S + 1, 2, W - S - 2, darker(o.top, 0.88));
    p.R(ax + 1, S + 1, 1, W - S - 2, darker(o.top, 0.72));
    p.R(ax, W - 1, 2, 2, skin);
    p.P(ax + 1, W, darker(skin, 0.85));
    // 头：脸朝左，鼻尖冒出一格
    p.R(4, H0, 8, 1, skin);
    p.R(3, H0 + 1, 10, 8, skin);
    p.R(4, H0 + 9, 8, 1, skin);
    p.P(2, H0 + 5, skin);
    p.R(12, H0 + 1, 1, 8, darker(skin, 0.88));
    p.R(5, H0 + 9, 7, 1, darker(skin, 0.9));
    // 头发
    const h = o.hair;
    const lo = darker(h, 0.8);
    if (o.hairStyle === 'shaved') {
        p.R(5, H0, 6, 1, darker(skin, 0.92));
    } else if (o.hairStyle === 'bald') {
        p.R(9, H0 + 2, 4, 5, h);
        p.R(11, H0 + 2, 2, 5, lo);
        p.P(6, H0 + 1, lighter(skin, 0.45));
    } else {
        p.R(5, H0 - 2, 6, 1, h);
        p.R(4, H0 - 1, 8, 1, h);
        p.R(3, H0, 10, 2, h);
        p.R(8, H0 + 2, 5, 6, h);
        p.R(11, H0 + 1, 2, 7, lo);
        p.R(5, H0 - 1, 3, 1, lighter(h, 0.22));
        if (o.hairStyle === 'short' || o.hairStyle === 'long') p.R(3, H0 + 2, 2, 1, h);
        if (o.hairStyle === 'long') p.R(9, H0 + 8, 4, 5, h);
        if (o.hairStyle === 'bun') {
            p.R(11, H0 - 2, 3, 3, h);
            p.P(12, H0 - 2, lighter(h, 0.22));
        }
        if (o.hairStyle === 'braid') for (let y = H0 + 8; y < S + 6; y++) p.P(11, y, (y - H0) % 2 ? h : lo);
    }
    // 耳朵、眼睛、腮红、嘴
    p.R(8, H0 + 4, 1, 2, darker(skin, 0.86));
    if (o.eyes === 'narrow' || o.eyes === 'smile') p.P(4, H0 + 5, C.eye);
    else {
        p.P(4, H0 + 4, 0x4a3a40);
        p.P(4, H0 + 5, C.eye);
    }
    p.P(5, H0 + 7, BLUSH);
    p.P(3, H0 + 7, darker(skin, 0.7));
    if (o.beard) {
        p.R(3, H0 + 6, 5, 4, o.beard);
        p.P(2, H0 + 6, o.beard);
        p.P(3, H0 + 7, darker(o.beard, 0.6));
    }
    if (o.glasses) {
        p.R(3, H0 + 3, 3, 1, 0x3a2c28);
        p.R(6, H0 + 3, 2, 1, 0x6a5a50);
    }
    hat(p, o, H0, -1);
}

function hat(p: Pen, o: Look, H0: number, shift: number): void {
    const X = (x: number) => x + shift;
    if (o.hat === 'straw') {
        const c = o.hatColor ?? 0xd8b45a;
        p.R(X(6), H0 - 4, 4, 1, c);
        p.R(X(5), H0 - 3, 6, 2, c);
        p.R(X(5), H0 - 4 + 1, 2, 1, lighter(c));
        p.R(X(5), H0 - 1, 6, 1, 0x8a5a34);
        p.R(X(1), H0, 14, 1, darker(c, 0.88));
        p.R(X(2), H0, 3, 1, c);
        p.D(3, H0 + 1, 10, 1, 0.86);
    } else if (o.hat === 'conical') {
        // 斗笠：一圈圈压暗的竹篾纹
        const c = o.hatColor ?? 0xc9a85a;
        for (let j = 0; j < 5; j++) {
            p.R(X(7 - j), H0 - 5 + j, 2 + j * 2, 1, j % 2 ? darker(c, 0.9) : c);
            p.P(X(7 - j), H0 - 5 + j, lighter(c));
        }
        p.R(X(1), H0, 14, 1, darker(c, 0.75));
        p.D(3, H0 + 1, 10, 1, 0.84);
    } else if (o.hat === 'cowboy') {
        // 牛仔帽：帽顶中间压个凹，宽帽檐两头上翘
        const c = o.hatColor ?? 0x8a5a34;
        p.R(X(5), H0 - 4, 2, 1, c);
        p.R(X(9), H0 - 4, 2, 1, c);
        p.R(X(4), H0 - 3, 8, 2, c);
        p.R(X(5), H0 - 4, 1, 2, lighter(c));
        p.R(X(4), H0 - 2, 8, 1, darker(c, 0.6));
        p.P(X(1), H0 - 1, c);
        p.P(X(14), H0 - 1, darker(c, 0.85));
        p.R(X(4), H0 - 1, 8, 1, c);
        p.R(X(1), H0, 14, 1, darker(c, 0.82));
        p.D(3, H0 + 1, 10, 1, 0.84);
    } else if (o.hat === 'bonnet') {
        // 遮阳软帽：包住头顶和两侧，前沿翻出一圈
        const c = o.hatColor ?? 0xe8dcc0;
        p.R(X(5), H0 - 3, 6, 1, c);
        p.R(X(4), H0 - 2, 8, 2, c);
        p.R(X(3), H0, 10, 1, c);
        p.R(X(2), H0 + 1, 2, 6, c);
        p.R(X(12), H0 + 1, 2, 6, darker(c, 0.88));
        p.R(X(3), H0 + 1, 10, 1, lighter(c, 0.4));
        p.R(X(7), H0 + 10, 2, 1, darker(c, 0.8));
    } else if (o.hat === 'scarf') {
        // 包头巾，带白点花
        const c = o.hatColor ?? 0x3d6fb0;
        p.R(X(5), H0 - 2, 6, 1, c);
        p.R(X(4), H0 - 1, 8, 1, c);
        p.R(X(3), H0, 10, 2, c);
        p.R(X(2), H0 + 2, 2, 4, c);
        p.R(X(12), H0 + 2, 2, 4, darker(c, 0.85));
        p.P(X(6), H0 - 1, 0xf7f7f2);
        p.P(X(9), H0, 0xf7f7f2);
        p.P(X(4), H0 + 1, 0xf7f7f2);
        p.P(X(11), H0 + 1, 0xf7f7f2);
    }
}

/**
 * 外轮廓：把不透明像素外面一圈描成相邻颜色压暗后的深色（星露谷式的"彩色描边"），影子不描。
 * 立绘和走路帧共用。
 */
export function outline(c: Canvas, x0: number, y0: number, w: number, h: number): void {
    const solid = (x: number, y: number) => {
        if (x < x0 || y < y0 || x >= x0 + w || y >= y0 + h) return -1;
        const i = (y * c.w + x) * 4;
        return c.px[i + 3] === 255 ? i : -1;
    };
    const marks: [number, number, number][] = [];
    for (let y = y0; y < y0 + h; y++) {
        for (let x = x0; x < x0 + w; x++) {
            if (solid(x, y) >= 0) continue;
            let r = 0;
            let g = 0;
            let b = 0;
            let n = 0;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const i = solid(x + dx, y + dy);
                if (i < 0) continue;
                r += c.px[i];
                g += c.px[i + 1];
                b += c.px[i + 2];
                n++;
            }
            if (n === 0) continue;
            const avg = (Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(b / n);
            const d = darker(avg, 0.38);
            // 和固定的深褐色各一半，整体不至于发灰
            const mix = (s: number) => Math.round((((d >> s) & 0xff) + ((INK >> s) & 0xff)) / 2);
            marks.push([x, y, (mix(16) << 16) | (mix(8) << 8) | mix(0)]);
        }
    }
    for (const [x, y, col] of marks) c.set(x, y, col);
}

/** 一个人的一整行：4 个朝向 × 3 帧。 */
export function drawPersonRow(c: Canvas, row: number, o: Look, r: Rnd): void {
    DIRS.forEach((dir, di) => {
        for (let f = 0; f < FRAMES; f++) {
            const x0 = (di * FRAMES + f) * FW;
            const y0 = row * FH;
            const frame = new Canvas(FW, FH);
            const p = new Pen(frame, r);
            // 走路时身子往下颠一格，脚不动
            const bob = f === 0 ? 0 : 1;
            if (dir === 'down' || dir === 'up') front(p, o, dir === 'up', f, bob);
            else side(p, o, f, bob);
            outline(frame, 0, 0, FW, FH);
            // 影子最后垫在脚下，只填空白处
            for (let y = 28; y < 32; y++) {
                for (let x = 1; x < 15; x++) {
                    const inside = ((x - 7.5) ** 2) / 36 + ((y - 30) ** 2) / 2.6 <= 1;
                    if (inside && frame.px[(y * FW + x) * 4 + 3] === 0) frame.set(x, y, C.shadow, 60);
                }
            }
            for (let y = 0; y < FH; y++) {
                for (let x = 0; x < FW; x++) {
                    const sx = dir === 'right' ? FW - 1 - x : x;
                    const si = (y * FW + sx) * 4;
                    const di2 = ((y0 + y) * c.w + x0 + x) * 4;
                    for (let k = 0; k < 4; k++) c.px[di2 + k] = frame.px[si + k];
                }
            }
        }
    });
}

/**
 * 所有人物：id 就是人物 id（镇民、路人、工人、主角），行号就是数组下标。
 * 加一个人只在这里加一行：走路帧和对话立绘（portraits.ts）都按这一行的 look 画。
 * 只能往后追加，前面的行号不能动。
 */
export const PEOPLE: { id: string; look: Look }[] = [
    { id: 'hero', look: { hair: 0x2b2420, hairStyle: 'short', top: 0x3d6fb0, pants: 0x4a3628, hat: 'straw' } },
    { id: 'gui', look: { hair: 0x9a9a9a, hairStyle: 'bun', top: 0xa5463e, pants: 0x3a3a48, eyes: 'smile', old: true } },
    { id: 'zhou', look: { hair: 0x8a8580, hairStyle: 'short', top: 0x5f7f8f, pants: 0x4a3628, apron: 0x8a5a34, beard: 0x8a8580, eyes: 'narrow', old: true } },
    { id: 'fisher', look: { hair: 0x2b2420, hairStyle: 'short', top: 0x6a7f5a, pants: 0x3a3a48, hat: 'conical', skin: 0xdcae84 } },
    { id: 'auntie', look: { hair: 0x2b2420, hairStyle: 'long', top: 0xd98a9a, pants: 0x3d4f7f, hat: 'scarf', hatColor: 0x3d6fb0 } },
    { id: 'grandpa', look: { hair: 0xdedede, hairStyle: 'bald', top: 0x8a7a5a, pants: 0x4a4a4a, beard: 0xdedede, eyes: 'smile', old: true } },
    { id: 'kid', look: { hair: 0x2b2420, hairStyle: 'short', top: 0xe3b341, pants: 0xc9302c, child: true } },
    { id: 'girl', look: { hair: 0x2b2420, hairStyle: 'bun', top: 0x7cc0b0, pants: 0xf1eee4 } },
    // 西部牛仔镇
    { id: 'sheriff', look: { hair: 0x5a3a24, hairStyle: 'short', top: 0xd8c8a0, pants: 0x3d4f6f, hat: 'cowboy', hatColor: 0x3a2a20, vest: 0x2a2420, badge: true, beard: 0x5a3a24, collar: 'shirt', eyes: 'narrow' } },
    { id: 'cowboy', look: { hair: 0x8a5a34, hairStyle: 'short', top: 0x3d6fb0, pants: 0x4a5a7a, hat: 'cowboy', hatColor: 0xb08a5a, bandana: 0xc9302c, collar: 'shirt', skin: 0xe8b890 } },
    { id: 'cowgirl', look: { hair: 0xd8a050, hairStyle: 'long', top: 0xe8dcc0, pants: 0x6a4a34, hat: 'cowboy', hatColor: 0xc9a070, vest: 0x8a5a34, bandana: 0x3d6fb0, collar: 'shirt' } },
    { id: 'bartender', look: { hair: 0x2b2420, hairStyle: 'bald', top: 0xf1eee4, pants: 0x2a2420, apron: 0xe8e0cc, vest: 0x6a2a2a, beard: 0x2b2420, collar: 'shirt' } },
    { id: 'prospector', look: { hair: 0xc8c0b0, hairStyle: 'short', top: 0x8a6a4a, pants: 0x5a4a3a, hat: 'cowboy', hatColor: 0x6a5a48, beard: 0xdedede, collar: 'shirt', old: true, skin: 0xe0a880 } },
    { id: 'lady', look: { hair: 0x6a3a24, hairStyle: 'bun', top: 0x8a5a9a, pants: 0x8a5a9a, hat: 'bonnet', hatColor: 0xeadfc4, dress: true, collar: 'shirt' } },
    { id: 'smith', look: { hair: 0x2b2420, hairStyle: 'short', top: 0x8a7a68, pants: 0x3a3030, apron: 0x5a3a24, beard: 0x2b2420, collar: 'shirt', skin: 0xd8a47c } },
    { id: 'ranchKid', look: { hair: 0xc89050, hairStyle: 'short', top: 0xc9302c, pants: 0x4a5a7a, hat: 'cowboy', hatColor: 0xd8b070, child: true, collar: 'shirt', eyes: 'smile' } },
    // 江南新片区的人（原先借用别人的样子）
    { id: 'monk', look: { hair: 0x2b2420, hairStyle: 'shaved', top: 0x9a8a6a, pants: 0x9a8a6a, dress: true, collar: 'robe', eyes: 'smile' } },
    { id: 'teaPicker', look: { hair: 0x2b2420, hairStyle: 'braid', top: 0x8ab070, pants: 0x3a3a48, apron: 0xe8e0cc, hat: 'scarf', hatColor: 0x4a7ab8 } },
    { id: 'boatman', look: { hair: 0x2b2420, hairStyle: 'short', top: 0x3a5a6a, pants: 0x2a2a30, beard: 0x3a2a20, skin: 0xd09a70, bandana: 0xe8e0cc } },
    { id: 'angler', look: { hair: 0xc8c8c8, hairStyle: 'short', top: 0xd8d0b8, pants: 0x5a5a5a, hat: 'straw', beard: 0xdedede, old: true, eyes: 'narrow' } },
    { id: 'farmer', look: { hair: 0x2b2420, hairStyle: 'short', top: 0x8a6a3a, pants: 0x3d4f7f, skin: 0xd09a70, bandana: 0xf0ece0, hat: 'conical', hatColor: 0xd8c070 } },
    { id: 'vendor', look: { hair: 0x3a2a20, hairStyle: 'short', top: 0xe0a040, pants: 0x4a3a30, apron: 0x5a4030, eyes: 'smile' } },
    { id: 'rancher', look: { hair: 0x3a2a20, hairStyle: 'short', top: 0x9a3a2a, pants: 0x4a4a5a, hat: 'cowboy', hatColor: 0x5a4030, bandana: 0xe3b341, beard: 0x3a2a20, collar: 'shirt' } },
    // 招工处的人（data/workers.ts 的 look 指向这里）
    { id: 'aqiang', look: { hair: 0x1e1a18, hairStyle: 'short', top: 0x5a6a4a, pants: 0x3a3a3a, skin: 0xc8946a, collar: 'shirt' } },
    { id: 'xiaofang', look: { hair: 0x2b2420, hairStyle: 'braid', top: 0xe08a5a, pants: 0x3d4f7f, eyes: 'smile' } },
    { id: 'erleng', look: { hair: 0x3a2a20, hairStyle: 'short', top: 0x8a8a7a, pants: 0x6a4a34, eyes: 'narrow', skin: 0xe0b088 } },
    { id: 'liushen', look: { hair: 0x4a3a30, hairStyle: 'bun', top: 0x7a4a6a, pants: 0x3a3a48, apron: 0xd0c8b0 } },
    { id: 'laoma', look: { hair: 0xb8b8b0, hairStyle: 'bald', top: 0x3a4a6a, pants: 0x3a3a48, old: true, eyes: 'narrow', skin: 0xd8a47c } },
    { id: 'dahai', look: { hair: 0x1e1a18, hairStyle: 'short', top: 0x3a6a8a, pants: 0x2a2a30, beard: 0x2b2420, skin: 0xc08a60 } },
    { id: 'xiaowen', look: { hair: 0x2b2420, hairStyle: 'long', top: 0xf0ece0, pants: 0x3a3a48, glasses: true, collar: 'shirt' } },
    { id: 'apeng', look: { hair: 0x2b2420, hairStyle: 'short', top: 0x3d8a6a, pants: 0x4a4a5a, eyes: 'smile', collar: 'shirt' } },
];

/** 人物 id 在人物图里的行号，没有就报错（生成地图时用） */
export function rowOf(id: string): number {
    const i = PEOPLE.findIndex((p) => p.id === id);
    if (i < 0) throw new Error(`people.ts 里没有 ${id}`);
    return i;
}

export function drawPeople(r: Rnd): Canvas {
    const c = new Canvas(DIRS.length * FRAMES * FW, PEOPLE.length * FH);
    PEOPLE.forEach((person, row) => drawPersonRow(c, row, person.look, r));
    return c;
}

/**
 * 每个朝向、每一帧手的位置（帧内像素坐标，左上角为原点），游戏里把拿着的东西（糖葫芦、伞、鱼竿）画在这里。
 * 按大人算（小孩手低 2 格）；朝上时手在身前被挡住，游戏里把物品画在人物后面。
 */
export function handAnchors(): Record<(typeof DIRS)[number], [number, number][]> {
    const bob = (f: number) => (f === 0 ? 0 : 1);
    const W = (f: number) => 23 + bob(f);
    const frames = [0, 1, 2];
    return {
        down: frames.map((f) => [12, W(f) + swingOf(f, 1)]),
        left: frames.map((f) => [sideArmX(f), W(f)]),
        right: frames.map((f) => [FW - 1 - sideArmX(f), W(f)]),
        up: frames.map((f) => [3, W(f) + swingOf(f, 2)]),
    };
}

export const FRAME_W = FW;
export const FRAME_H = FH;

/** 西部打扮（正面/背面）：马甲、警徽、方巾。 */
function westernFront(p: Pen, o: Look, back: boolean, S: number, W: number): void {
    if (o.vest) {
        if (back) p.R(4, S + 1, 8, W - S - 1, o.vest);
        else {
            p.R(4, S + 1, 3, W - S - 1, o.vest);
            p.R(9, S + 1, 3, W - S - 1, darker(o.vest, 0.88));
            p.P(4, S + 1, lighter(o.vest, 0.2));
        }
    }
    if (o.badge && !back) {
        p.P(5, S + 3, 0xe3b341);
        p.P(5, S + 2, 0xf3d892);
    }
    if (o.bandana) {
        p.R(5, S, 6, 1, o.bandana);
        if (!back) {
            p.R(6, S + 1, 4, 1, o.bandana);
            p.R(7, S + 2, 2, 1, darker(o.bandana, 0.8));
        }
    }
}

/** 西部打扮（侧面）。 */
function westernSide(p: Pen, o: Look, S: number, W: number): void {
    if (o.vest) p.R(7, S + 1, 4, W - S - 1, o.vest);
    if (o.badge) p.P(5, S + 3, 0xe3b341);
    if (o.bandana) {
        p.R(5, S, 5, 1, o.bandana);
        p.R(4, S + 1, 2, 1, o.bandana);
    }
}
