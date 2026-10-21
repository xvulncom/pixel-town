// 人物：星露谷尺寸 16×32，四个朝向（下、左、右、上）× 3 帧（站、迈左脚、迈右脚），自动描深色外轮廓。
// 每个人一行，游戏里按行号切帧做走路动画。

import { Canvas, Pen, Rnd, TILE } from './canvas';
import { C } from './palette';

export interface Look {
    skin?: number;
    hair: number;
    hairStyle: 'short' | 'bun' | 'long' | 'bald';
    top: number;
    pants: number;
    hat?: 'straw' | 'conical' | 'scarf' | 'cowboy' | 'bonnet';
    hatColor?: number;
    apron?: number;
    beard?: number;
    /** 小孩：整体矮 3px */
    child?: boolean;
    /** 西部：马甲颜色 */
    vest?: number;
    /** 西部：胸前警徽 */
    badge?: boolean;
    /** 西部：脖子上的方巾颜色 */
    bandana?: number;
    /** 西部：长裙（盖住腿，颜色用 pants） */
    dress?: boolean;
}

export const DIRS = ['down', 'left', 'right', 'up'] as const;
export const FRAMES = 3;
const FW = TILE;
const FH = TILE * 2;

function darker(c: number, k = 0.72): number {
    const r = Math.round(((c >> 16) & 0xff) * k);
    const g = Math.round(((c >> 8) & 0xff) * k);
    const b = Math.round((c & 0xff) * k);
    return (r << 16) | (g << 8) | b;
}

function lighter(c: number, k = 0.25): number {
    const f = (v: number) => Math.round(v + (255 - v) * k);
    return (f((c >> 16) & 0xff) << 16) | (f((c >> 8) & 0xff) << 8) | f(c & 0xff);
}

/** 画一帧朝下或朝上的人，step：0 站，1 迈左脚，2 迈右脚。 */
function front(p: Pen, o: Look, back: boolean, step: number, dy: number): void {
    const skin = o.skin ?? C.skin;
    const lift = (side: number) => (step === 0 ? 0 : step === side ? 1 : -1);
    // 腿和鞋
    for (const [x, side] of [[5, 1], [9, 2]] as [number, number][]) {
        const len = 4 + lift(side);
        p.R(x, 25 + dy, 2, len, o.pants);
        p.R(x, 25 + dy + len, 2, 1, 0x2b2420);
    }
    // 身子：对襟短衫，中缝和盘扣
    p.R(4, 15 + dy, 8, 11, o.top);
    p.R(4, 15 + dy, 8, 1, lighter(o.top));
    p.R(11, 16 + dy, 1, 10, darker(o.top));
    if (!back) {
        p.R(7, 16 + dy, 1, 9, darker(o.top));
        p.P(8, 18 + dy, lighter(o.top, 0.5));
        p.P(8, 21 + dy, lighter(o.top, 0.5));
    }
    p.R(4, 24 + dy, 8, 1, darker(o.top));
    if (o.apron && !back) {
        p.R(5, 19 + dy, 6, 7, o.apron);
        p.R(5, 19 + dy, 6, 1, lighter(o.apron));
    }
    westernFront(p, o, back, dy);
    // 胳膊摆动：迈左脚时右手往前
    for (const [x, side] of [[3, 2], [12, 1]] as [number, number][]) {
        const sw = step === 0 ? 0 : step === side ? 1 : -1;
        p.R(x, 16 + dy + Math.max(0, -sw), 1, 6, o.top);
        p.P(x, 22 + dy + sw, skin);
    }
    // 头
    p.R(4, 5 + dy, 8, 10, skin);
    p.R(5, 4 + dy, 6, 1, skin);
    p.R(11, 6 + dy, 1, 8, darker(skin, 0.9));
    if (back) {
        p.R(4, 3 + dy, 8, o.hairStyle === 'bald' ? 4 : 10, o.hair);
        p.R(4, 3 + dy, 8, 1, lighter(o.hair));
    } else {
        if (o.hairStyle !== 'bald') {
            p.R(4, 3 + dy, 8, 3, o.hair);
            p.R(4, 4 + dy, 1, 5, o.hair);
            p.R(11, 4 + dy, 1, 5, o.hair);
            p.P(6, 6 + dy, o.hair);
            p.R(5, 3 + dy, 3, 1, lighter(o.hair));
        }
        // 眼睛两格高，腮红，嘴
        p.R(5, 9 + dy, 1, 2, C.eye);
        p.R(10, 9 + dy, 1, 2, C.eye);
        p.P(5, 9 + dy, 0x5a4a40);
        p.P(4, 12 + dy, 0xf2a6a0);
        p.P(11, 12 + dy, 0xf2a6a0);
        p.P(7, 12 + dy, darker(skin, 0.75));
        p.P(8, 12 + dy, darker(skin, 0.75));
        if (o.beard) p.R(5, 12 + dy, 6, 3, o.beard);
    }
    if (o.hairStyle === 'long') {
        p.R(3, 6 + dy, 1, back ? 10 : 8, o.hair);
        p.R(12, 6 + dy, 1, back ? 10 : 8, o.hair);
    }
    if (o.hairStyle === 'bun') {
        p.R(6, dy, 4, 3, o.hair);
        p.P(7, dy, lighter(o.hair));
    }
    hat(p, o, dy, 0);
}

/** 朝左的侧身，朝右由它镜像。 */
function side(p: Pen, o: Look, step: number, dy: number): void {
    const skin = o.skin ?? C.skin;
    // 腿：迈步时前后分开
    const spread = step === 0 ? 0 : 2;
    const legs: [number, number][] = step === 0 ? [[7, 4]] : [[7 - spread, 4], [7 + spread, 4]];
    for (const [x, len] of legs) {
        p.R(x, 25 + dy, 2, len, o.pants);
        p.R(x - 1, 25 + dy + len, 3, 1, 0x2b2420);
    }
    p.R(5, 15 + dy, 6, 11, o.top);
    p.R(5, 15 + dy, 6, 1, lighter(o.top));
    p.R(10, 16 + dy, 1, 10, darker(o.top));
    if (o.apron) p.R(5, 19 + dy, 2, 7, o.apron);
    p.R(5, 24 + dy, 6, 1, darker(o.top));
    westernSide(p, o, dy);
    // 胳膊前后摆
    const ax = step === 0 ? 8 : step === 1 ? 6 : 10;
    p.R(ax, 16 + dy, 1, 6, darker(o.top, 0.85));
    p.P(ax, 22 + dy, skin);
    // 头：脸朝左，后脑勺是头发
    p.R(4, 5 + dy, 8, 10, skin);
    p.R(5, 4 + dy, 6, 1, skin);
    p.P(3, 10 + dy, skin);
    if (o.hairStyle !== 'bald') {
        p.R(4, 3 + dy, 8, 3, o.hair);
        p.R(8, 5 + dy, 4, 6, o.hair);
        p.R(5, 3 + dy, 3, 1, lighter(o.hair));
    } else {
        p.R(9, 6 + dy, 3, 4, o.hair);
    }
    p.R(5, 9 + dy, 1, 2, C.eye);
    p.P(5, 12 + dy, 0xf2a6a0);
    p.P(4, 13 + dy, darker(skin, 0.75));
    if (o.beard) p.R(3, 12 + dy, 4, 3, o.beard);
    if (o.hairStyle === 'long') p.R(11, 6 + dy, 2, 9, o.hair);
    if (o.hairStyle === 'bun') p.R(9, 1 + dy, 4, 3, o.hair);
    hat(p, o, dy, -1);
}

function hat(p: Pen, o: Look, dy: number, shift: number): void {
    if (o.hat === 'straw') {
        const c = o.hatColor ?? 0xd8b45a;
        p.R(5 + shift, 1 + dy, 6, 4, c);
        p.R(5 + shift, 1 + dy, 6, 1, lighter(c));
        p.R(5 + shift, 4 + dy, 6, 1, 0x8a5a34);
        p.R(2 + shift, 5 + dy, 12, 1, darker(c, 0.85));
    } else if (o.hat === 'conical') {
        // 斗笠
        const c = o.hatColor ?? 0xc9a85a;
        for (let j = 0; j < 5; j++) p.R(7 - j + shift, 1 + j + dy, 2 + j * 2, 1, j === 4 ? darker(c) : c);
        p.R(1 + shift, 5 + dy, 14, 1, darker(c));
    } else if (o.hat === 'cowboy') {
        // 牛仔帽：宽帽檐两头上翘，帽顶中间压个凹
        const c = o.hatColor ?? 0x8a5a34;
        p.R(4 + shift, 1 + dy, 8, 4, c);
        p.R(5 + shift, 0 + dy, 2, 1, c);
        p.R(9 + shift, 0 + dy, 2, 1, c);
        p.R(4 + shift, 1 + dy, 3, 1, lighter(c));
        p.R(4 + shift, 3 + dy, 8, 1, darker(c, 0.6));
        p.R(2 + shift, 4 + dy, 12, 2, c);
        p.R(2 + shift, 5 + dy, 12, 1, darker(c, 0.8));
    } else if (o.hat === 'bonnet') {
        // 遮阳软帽：包住头顶和两侧，前沿翻出一圈
        const c = o.hatColor ?? 0xe8dcc0;
        p.R(4, 1 + dy, 8, 4, c);
        p.R(3, 3 + dy, 1, 7, c);
        p.R(12, 3 + dy, 1, 7, c);
        p.R(3, 4 + dy, 10, 1, lighter(c, 0.4));
        p.P(7, 9 + dy + 6, darker(c, 0.8));
    } else if (o.hat === 'scarf') {
        const c = o.hatColor ?? 0x3d6fb0;
        p.R(4, 2 + dy, 8, 4, c);
        p.R(3, 4 + dy, 1, 5, c);
        p.R(12, 4 + dy, 1, 5, c);
        p.P(6, 3 + dy, 0xf7f7f2);
        p.P(9, 4 + dy, 0xf7f7f2);
    }
}

/** 把不透明像素外面一圈描成深色轮廓（影子不描）。 */
function outline(c: Canvas, x0: number, y0: number): void {
    const solid = (x: number, y: number) => {
        if (x < x0 || y < y0 || x >= x0 + FW || y >= y0 + FH) return false;
        return c.px[(y * c.w + x) * 4 + 3] === 255;
    };
    const marks: [number, number][] = [];
    for (let y = y0; y < y0 + FH; y++) {
        for (let x = x0; x < x0 + FW; x++) {
            if (solid(x, y)) continue;
            if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) marks.push([x, y]);
        }
    }
    for (const [x, y] of marks) c.set(x, y, 0x2a1f1a);
}

/** 一个人的一整行：4 个朝向 × 3 帧。 */
export function drawPersonRow(c: Canvas, row: number, o: Look, r: Rnd): void {
    DIRS.forEach((dir, di) => {
        for (let f = 0; f < FRAMES; f++) {
            const x0 = (di * FRAMES + f) * FW;
            const y0 = row * FH;
            const frame = new Canvas(FW, FH);
            const p = new Pen(frame, r);
            const dy = o.child ? 3 : 0;
            // 走路时身子上下颠一下
            const bob = f === 0 ? 0 : 1;
            if (dir === 'down' || dir === 'up') front(p, o, dir === 'up', f, dy + bob);
            else side(p, o, f, dy + bob);
            outline(frame, 0, 0);
            // 影子最后垫在脚下，只填空白处
            for (let y = 28; y < 32; y++) {
                for (let x = 2; x < 14; x++) {
                    const inside = ((x - 7.5) ** 2) / 30 + ((y - 30) ** 2) / 2.2 <= 1;
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

/** 镇上的人：id 对应 data/npcs 里的镇民，其余是路人。行号就是数组下标。 */
export const PEOPLE: { id: string; look: Look }[] = [
    { id: 'hero', look: { hair: 0x2b2420, hairStyle: 'short', top: 0x3d6fb0, pants: 0x4a3628, hat: 'straw' } },
    { id: 'gui', look: { hair: 0x9a9a9a, hairStyle: 'bun', top: 0xa5463e, pants: 0x3a3a48 } },
    { id: 'zhou', look: { hair: 0x3a2a20, hairStyle: 'short', top: 0x5f7f8f, pants: 0x4a3628, apron: 0x8a5a34, beard: 0x3a2a20 } },
    { id: 'fisher', look: { hair: 0x2b2420, hairStyle: 'short', top: 0x6a7f5a, pants: 0x3a3a48, hat: 'conical' } },
    { id: 'auntie', look: { hair: 0x2b2420, hairStyle: 'long', top: 0xd98a9a, pants: 0x3d4f7f, hat: 'scarf', hatColor: 0x3d6fb0 } },
    { id: 'grandpa', look: { hair: 0xdedede, hairStyle: 'bald', top: 0x8a7a5a, pants: 0x4a4a4a, beard: 0xdedede } },
    { id: 'kid', look: { hair: 0x2b2420, hairStyle: 'short', top: 0xe3b341, pants: 0xc9302c, child: true } },
    { id: 'girl', look: { hair: 0x2b2420, hairStyle: 'bun', top: 0x7cc0b0, pants: 0xf1eee4 } },
    // 西部牛仔镇的人（只追加在后面，前面的行号不能动）
    { id: 'sheriff', look: { hair: 0x5a3a24, hairStyle: 'short', top: 0xd8c8a0, pants: 0x3d4f6f, hat: 'cowboy', hatColor: 0x3a2a20, vest: 0x2a2420, badge: true, beard: 0x5a3a24 } },
    { id: 'cowboy', look: { hair: 0x8a5a34, hairStyle: 'short', top: 0x3d6fb0, pants: 0x4a5a7a, hat: 'cowboy', hatColor: 0xb08a5a, bandana: 0xc9302c } },
    { id: 'cowgirl', look: { hair: 0xd8a050, hairStyle: 'long', top: 0xe8dcc0, pants: 0x6a4a34, hat: 'cowboy', hatColor: 0xc9a070, vest: 0x8a5a34, bandana: 0x3d6fb0 } },
    { id: 'bartender', look: { hair: 0x2b2420, hairStyle: 'bald', top: 0xf1eee4, pants: 0x2a2420, apron: 0xe8e0cc, vest: 0x6a2a2a, beard: 0x2b2420 } },
    { id: 'prospector', look: { hair: 0xc8c0b0, hairStyle: 'short', top: 0x8a6a4a, pants: 0x5a4a3a, hat: 'cowboy', hatColor: 0x6a5a48, beard: 0xdedede } },
    { id: 'lady', look: { hair: 0x6a3a24, hairStyle: 'bun', top: 0x8a5a9a, pants: 0x8a5a9a, hat: 'bonnet', hatColor: 0xeadfc4, dress: true } },
    { id: 'smith', look: { hair: 0x2b2420, hairStyle: 'short', top: 0x8a7a68, pants: 0x3a3030, apron: 0x5a3a24, beard: 0x2b2420 } },
    { id: 'ranchKid', look: { hair: 0xc89050, hairStyle: 'short', top: 0xc9302c, pants: 0x4a5a7a, hat: 'cowboy', hatColor: 0xd8b070, child: true } },
];

export function drawPeople(r: Rnd): Canvas {
    const c = new Canvas(DIRS.length * FRAMES * FW, PEOPLE.length * FH);
    PEOPLE.forEach((person, row) => drawPersonRow(c, row, person.look, r));
    return c;
}

/**
 * 每个朝向、每一帧手的位置（帧内像素坐标，左上角为原点），游戏里把拿着的东西（糖葫芦、伞、鱼竿）画在这里。
 * 朝上时手在身前被挡住，游戏里把物品画在人物后面。
 */
export function handAnchors(): Record<(typeof DIRS)[number], [number, number][]> {
    const bob = (f: number) => (f === 0 ? 0 : 1);
    const swing = (f: number, side: number) => (f === 0 ? 0 : f === side ? 1 : -1);
    const sideX = (f: number) => (f === 0 ? 8 : f === 1 ? 6 : 10);
    const frames = [0, 1, 2];
    return {
        down: frames.map((f) => [12, 22 + swing(f, 1) + bob(f)]),
        left: frames.map((f) => [sideX(f), 22 + bob(f)]),
        right: frames.map((f) => [FW - 1 - sideX(f), 22 + bob(f)]),
        up: frames.map((f) => [3, 22 + swing(f, 2) + bob(f)]),
    };
}

export const FRAME_W = FW;
export const FRAME_H = FH;

/** 西部打扮（正面/背面）：马甲、警徽、方巾、长裙。没这些字段的人一个像素都不变。 */
function westernFront(p: Pen, o: Look, back: boolean, dy: number): void {
    if (o.dress) {
        for (let y = 22; y < 29; y++) {
            const flare = y > 25 ? 1 : 0;
            p.R(4 - flare, y + dy, 8 + flare * 2, 1, y === 28 ? darker(o.pants) : o.pants);
        }
        p.R(4, 22 + dy, 8, 1, lighter(o.pants));
    }
    if (o.vest) {
        if (back) p.R(4, 15 + dy, 8, 9, o.vest);
        else {
            p.R(4, 15 + dy, 3, 9, o.vest);
            p.R(9, 15 + dy, 3, 9, o.vest);
            p.R(6, 16 + dy, 1, 8, darker(o.vest));
        }
    }
    if (o.badge && !back) {
        p.P(5, 18 + dy, 0xe3b341);
        p.P(5, 17 + dy, 0xf3d892);
    }
    if (o.bandana) {
        p.R(4, 15 + dy, 8, 1, o.bandana);
        if (!back) {
            p.R(6, 16 + dy, 4, 1, o.bandana);
            p.R(7, 17 + dy, 2, 1, darker(o.bandana));
        }
    }
}

/** 西部打扮（侧面）。 */
function westernSide(p: Pen, o: Look, dy: number): void {
    if (o.dress) {
        for (let y = 22; y < 29; y++) p.R(4 - (y > 25 ? 1 : 0), y + dy, 8 + (y > 25 ? 1 : 0), 1, y === 28 ? darker(o.pants) : o.pants);
    }
    if (o.vest) p.R(7, 15 + dy, 4, 9, o.vest);
    if (o.badge) p.P(5, 18 + dy, 0xe3b341);
    if (o.bandana) {
        p.R(5, 15 + dy, 6, 1, o.bandana);
        p.R(4, 16 + dy, 2, 1, o.bandana);
    }
}
