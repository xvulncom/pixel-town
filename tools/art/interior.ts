// 屋里的画法：地板、墙面、墙边这些 16px 图块，家具整张图（名字 = data/furniture.ts 的 id），店里卖的礼物图标。
// 光从左上来：顶面亮、右边和底边暗，家具脚下一道半透明影子，和镇上房子、地盘建筑同一套画法。
// 加家具：data/furniture.ts 加一行，这里 FURNITURE_ART 加一个同名画法；加礼物同理（GIFT_ART，图名 gift_<id>）。

import { Pen, TILE } from './canvas';
import { C } from './palette';
import { WC } from './western';

type Paint = (p: Pen) => void;

// ---------- 通用小件 ----------

/** 画一个带轮廓的方块：顶边一道亮、右边和底边一道暗 */
function block(p: Pen, x: number, y: number, w: number, h: number, base: number, light: number, dark: number, line: number): void {
    p.R(x, y, w, h, line);
    p.R(x + 1, y + 1, w - 2, h - 2, base);
    p.R(x + 1, y + 1, w - 2, 1, light);
    p.R(x + w - 2, y + 2, 1, h - 3, dark);
    p.R(x + 2, y + h - 2, w - 4, 1, dark);
}

/** 家具脚下的影子（地面上，往右下偏一点） */
function footShadow(p: Pen, x: number, w: number, base: number, h = 3): void {
    p.R(x + 2, base - h, w, h, 0x000000, 50);
}

/** 架子上的一格小货：罐、盒、瓶，颜色挑一个 */
function smallGoods(p: Pen, x0: number, x1: number, shelfY: number, palette: number[], kind: 'jar' | 'box' | 'bottle' | 'bolt'): void {
    let x = x0;
    while (x < x1 - 2) {
        const c = palette[Math.floor(p.r() * palette.length)];
        if (kind === 'jar') {
            const w = 4 + Math.floor(p.r() * 2);
            p.R(x, shelfY - 5, w, 5, c);
            p.R(x + 1, shelfY - 6, w - 2, 1, 0x3a2a20);
            p.R(x, shelfY - 5, 1, 4, 0xffffff, 60);
            x += w + 1;
        } else if (kind === 'box') {
            const w = 3 + Math.floor(p.r() * 3);
            const h = 3 + Math.floor(p.r() * 3);
            p.R(x, shelfY - h, w, h, c);
            p.R(x, shelfY - h, w, 1, 0xffffff, 70);
            x += w + 1;
        } else if (kind === 'bottle') {
            p.R(x, shelfY - 6, 2, 6, c);
            p.R(x, shelfY - 8, 1, 2, c);
            p.P(x, shelfY - 5, 0xffffff, 120);
            x += 3;
        } else {
            // 一卷卷布：圆头朝外
            p.E(x + 2, shelfY - 3, 2, 3, (dx) => (dx < 0 ? c : shade(c, 0.8)));
            p.P(x + 2, shelfY - 3, shade(c, 0.6));
            x += 5;
        }
    }
}

function shade(c: number, k: number): number {
    const r = Math.min(255, Math.round(((c >> 16) & 255) * k));
    const g = Math.min(255, Math.round(((c >> 8) & 255) * k));
    const b = Math.min(255, Math.round((c & 255) * k));
    return (r << 16) | (g << 8) | b;
}

/** 靠墙的架子：外框、几层隔板，每层摆东西 */
function shelfUnit(p: Pen, wood: number, line: number, layers: number, goods: (x0: number, x1: number, y: number, i: number) => void): void {
    const pw = p.c.w;
    const ph = p.c.h;
    const top = 6;
    const base = ph - 2;
    footShadow(p, 2, pw - 4, ph);
    p.R(1, top, pw - 2, base - top, line);
    p.R(2, top + 1, pw - 4, base - top - 2, shade(wood, 0.62));
    p.R(1, top, pw - 2, 2, shade(wood, 1.15));
    const step = Math.floor((base - top - 4) / layers);
    for (let i = 0; i < layers; i++) {
        const y = top + 3 + step * (i + 1);
        goods(4, pw - 4, y - 1, i);
        p.R(2, y - 1, pw - 4, 2, wood);
        p.R(2, y - 1, pw - 4, 1, shade(wood, 1.18));
    }
    p.R(1, top, 2, base - top, wood);
    p.R(pw - 3, top, 2, base - top, shade(wood, 0.8));
    p.R(1, base - 2, pw - 2, 2, shade(wood, 0.7));
}

/** 桌面（俯视看到的顶面 + 前面一截桌沿和腿） */
function table(p: Pen, top: number, face: number, line: number, legs = true): void {
    const pw = p.c.w;
    const ph = p.c.h;
    const ty = ph - 18;
    footShadow(p, 2, pw - 4, ph, 4);
    p.R(1, ty, pw - 2, 10, line);
    p.R(2, ty + 1, pw - 4, 8, top);
    p.R(2, ty + 1, pw - 4, 1, shade(top, 1.15));
    p.R(1, ty + 10, pw - 2, 3, face);
    p.R(1, ty + 12, pw - 2, 1, line);
    if (legs) {
        p.R(2, ty + 13, 2, ph - ty - 14, face);
        p.R(pw - 4, ty + 13, 2, ph - ty - 14, shade(face, 0.8));
    }
}

/** 地毯：底色、花边、中间纹样 */
function rug(p: Pen, base: number, border: number, motif: number, kind: 'cloud' | 'diamond'): void {
    const pw = p.c.w;
    const ph = p.c.h;
    p.R(1, 2, pw - 2, ph - 4, border);
    p.R(3, 4, pw - 6, ph - 8, base);
    p.R(3, 4, pw - 6, 1, shade(base, 1.12));
    if (kind === 'cloud') {
        for (const [cx, cy] of [[pw / 2, ph / 2], [10, 10], [pw - 10, ph - 10], [10, ph - 10], [pw - 10, 10]]) {
            p.E(Math.round(cx), Math.round(cy), 3, 2, () => motif);
        }
    } else {
        for (let x = 8; x < pw - 6; x += 8) {
            for (let k = 0; k < 4; k++) {
                p.P(x + k, ph / 2 - k, motif);
                p.P(x + k, ph / 2 + k, motif);
                p.P(x + 7 - k, ph / 2 - k, motif);
                p.P(x + 7 - k, ph / 2 + k, motif);
            }
        }
        for (let x = 4; x < pw - 4; x += 3) {
            p.P(x, 5, motif);
            p.P(x, ph - 6, motif);
        }
    }
    // 流苏
    for (let y = 3; y < ph - 3; y += 2) {
        p.P(0, y, border);
        p.P(pw - 1, y, border);
    }
}

// ---------- 江南 ----------

const JN = {
    wood: 0x8a5a34,
    woodDark: 0x5a3a24,
    woodLight: 0xa8744a,
    red: 0x9a3a2a,
    redDark: 0x6e2a20,
    line: 0x3a2618,
    cloth: [0x3d6fb0, 0xe98fa6, 0x7cc0b0, 0xe3b341, 0xf1eee4, 0xc9302c],
    porcelain: [0xeef0f2, 0x3d6fb0, 0x7cc0b0],
};

function jnBed(p: Pen): void {
    const pw = p.c.w;
    const ph = p.c.h;
    footShadow(p, 2, pw - 4, ph, 4);
    // 床架顶和四根柱子、帐子
    p.R(1, 2, pw - 2, 5, JN.line);
    p.R(2, 3, pw - 4, 3, JN.red);
    p.R(2, 3, pw - 4, 1, 0xc0583e);
    for (const x of [2, pw - 5]) p.R(x, 7, 3, ph - 9, JN.redDark);
    p.R(5, 7, pw - 10, 26, 0xf1eee4, 200);
    for (let x = 6; x < pw - 6; x += 4) p.R(x, 8, 1, 24, 0xd9d5c7, 200);
    // 床铺：被子、枕头
    const by = ph - 24;
    p.R(3, by, pw - 6, 18, JN.line);
    p.R(4, by + 1, pw - 8, 16, 0xc9302c);
    p.R(4, by + 1, pw - 8, 1, 0xef5a43);
    for (let x = 8; x < pw - 8; x += 8) p.E(x, by + 9, 2, 2, () => 0xe3b341);
    p.R(6, by + 2, 10, 4, 0xf1eee4);
    p.R(pw - 16, by + 2, 10, 4, 0xf1eee4);
    // 床沿和脚踏
    p.R(2, ph - 7, pw - 4, 4, JN.wood);
    p.R(2, ph - 7, pw - 4, 1, JN.woodLight);
    p.R(2, ph - 3, pw - 4, 1, JN.line);
}

function jnWardrobe(p: Pen): void {
    const pw = p.c.w;
    const ph = p.c.h;
    footShadow(p, 2, pw - 4, ph, 3);
    block(p, 2, 6, pw - 4, ph - 8, JN.red, 0xb4503a, JN.redDark, JN.line);
    p.R(pw / 2, 8, 1, ph - 14, JN.line);
    // 铜锁片
    p.R(pw / 2 - 3, 22, 6, 5, C.gold);
    p.R(pw / 2 - 1, 23, 2, 3, 0xa07a20);
    for (const x of [6, pw - 10]) {
        p.R(x, 12, 4, 6, JN.redDark);
        p.R(x, 30, 4, 6, JN.redDark);
    }
    p.R(1, 4, pw - 2, 3, JN.line);
    p.R(2, 4, pw - 4, 1, JN.woodLight);
}

function jnStove(p: Pen): void {
    const pw = p.c.w;
    const ph = p.c.h;
    footShadow(p, 2, pw - 4, ph, 3);
    // 烟囱贴墙往上
    p.R(pw - 14, 2, 8, 22, 0xd9d5c7);
    p.R(pw - 14, 2, 8, 2, 0xb4b0a6);
    p.R(pw - 7, 4, 1, 20, 0xb4b0a6);
    // 灶台：白灰台面、砖砌灶身、两口锅、灶门火光
    const ty = ph - 22;
    p.R(1, ty, pw - 2, 20, 0x8e8a80);
    p.R(2, ty + 1, pw - 4, 8, 0xe8e4d8);
    p.R(2, ty + 1, pw - 4, 1, 0xf6f4ee);
    for (const cx of [12, 30]) {
        p.E(cx, ty + 5, 6, 3, (dx, dy) => (dx * dx + dy * dy < 8 ? 0x2a2a2e : 0x4a4a50));
    }
    p.R(2, ty + 9, pw - 4, 10, 0xa4533a);
    for (let x = 3; x < pw - 3; x += 6) p.R(x, ty + 13, 1, 3, 0x7a3a2a);
    p.R(2, ty + 13, pw - 4, 1, 0x7a3a2a);
    p.R(10, ty + 12, 7, 6, 0x2a1a14);
    p.R(11, ty + 15, 5, 3, 0xe08a30);
    p.P(13, ty + 14, 0xf3d892);
    // 墙上挂的锅铲
    p.R(6, 8, 1, 10, JN.woodDark);
    p.R(5, 17, 3, 3, 0x8a8a90);
}

function jnCurio(p: Pen): void {
    shelfUnit(p, JN.wood, JN.line, 3, (x0, x1, y, i) => smallGoods(p, x0, x1, y, i === 1 ? [0x3d6fb0, 0xeef0f2] : [0x7cc0b0, 0xe3b341, 0xeef0f2], i === 2 ? 'box' : 'jar'));
}

function jnAltar(p: Pen): void {
    const pw = p.c.w;
    const ph = p.c.h;
    // 墙上中堂：一幅画 + 对联
    p.R(pw / 2 - 8, 2, 16, 22, JN.line);
    p.R(pw / 2 - 7, 3, 14, 20, 0xf1e8d0);
    p.E(pw / 2, 12, 4, 5, (dx, dy) => (dy < 0 ? 0x5f7f5a : 0x7c9a6a));
    for (const x of [pw / 2 - 14, pw / 2 + 11]) {
        p.R(x, 4, 3, 18, C.red);
        for (let k = 0; k < 4; k++) p.P(x + 1, 6 + k * 4, C.gold);
    }
    // 长条供桌，上面香炉、果盘、烛台
    footShadow(p, 2, pw - 4, ph, 3);
    const ty = ph - 16;
    p.R(1, ty, pw - 2, 5, JN.line);
    p.R(2, ty + 1, pw - 4, 3, JN.red);
    p.R(2, ty + 1, pw - 4, 1, 0xb4503a);
    p.R(3, ty + 5, 3, 10, JN.redDark);
    p.R(pw - 6, ty + 5, 3, 10, JN.redDark);
    p.R(6, ty + 5, pw - 12, 2, JN.redDark);
    p.R(pw / 2 - 3, ty - 4, 6, 4, 0x8a7a50);
    p.R(pw / 2 - 1, ty - 7, 1, 3, 0xd8d0b8);
    p.E(10, ty - 1, 3, 1, () => 0xe08a30);
    for (const x of [pw - 12, pw - 9]) {
        p.R(x, ty - 5, 1, 5, C.red);
        p.P(x, ty - 6, 0xf3d892);
    }
}

function jnGoods(p: Pen): void {
    shelfUnit(p, JN.wood, JN.line, 3, (x0, x1, y, i) => {
        const kinds: ('jar' | 'box' | 'bottle')[] = ['box', 'jar', 'bottle'];
        smallGoods(p, x0, x1, y, [0xc9302c, 0xe3b341, 0x3d6fb0, 0x7cc0b0, 0xe8dcc0, 0x8a5a34], kinds[i % 3]);
    });
}

function jnClothRack(p: Pen): void {
    shelfUnit(p, JN.woodLight, JN.line, 3, (x0, x1, y) => smallGoods(p, x0, x1, y, JN.cloth, 'bolt'));
}

function jnTeaJars(p: Pen): void {
    shelfUnit(p, JN.wood, JN.line, 3, (x0, x1, y) => {
        for (let x = x0; x < x1 - 5; x += 7) {
            const c = [0x2f5a3a, 0x8a3a2a, 0xe3b341][Math.floor(p.r() * 3)];
            p.R(x, y - 7, 6, 7, c);
            p.R(x, y - 8, 6, 1, 0x2a2420);
            p.R(x + 1, y - 5, 4, 2, 0xf3d892);
        }
    });
}

function jnRiceBins(p: Pen): void {
    const pw = p.c.w;
    const ph = p.c.h;
    footShadow(p, 2, pw - 4, ph, 3);
    // 三格木斗，装白米、糯米、糙米，插着木牌
    const ty = ph - 20;
    p.R(1, ty, pw - 2, 18, JN.line);
    const n = 3;
    const cw = Math.floor((pw - 2) / n);
    for (let i = 0; i < n; i++) {
        const x = 1 + i * cw;
        p.R(x + 1, ty + 1, cw - 2, 16, JN.wood);
        p.R(x + 1, ty + 1, cw - 2, 1, JN.woodLight);
        const rice = [0xf6f2e6, 0xe8e2d0, 0xc8a878][i];
        p.E(x + cw / 2, ty + 4, cw / 2 - 3, 3, (dx, dy) => (dy < 0 ? shade(rice, 1.05) : rice));
        p.R(x + cw / 2 - 2, ty - 6, 5, 4, 0xf1e8d0);
        p.R(x + cw / 2, ty - 2, 1, 4, JN.woodDark);
        p.R(x + cw / 2 - 1, ty - 5, 3, 1, C.red);
    }
}

function jnTools(p: Pen): void {
    const pw = p.c.w;
    const ph = p.c.h;
    // 墙上一块挂板挂锯、刨子、斧头、凿子，下面一条矮木凳
    p.R(2, 4, pw - 4, 26, 0x6e4a2c);
    p.R(2, 4, pw - 4, 1, 0x8a5a34);
    for (let x = 6; x < pw - 6; x += 5) p.P(x, 8, 0x3a2618);
    // 锯
    p.R(6, 10, 12, 4, 0xb4b0a6);
    for (let x = 6; x < 18; x += 2) p.P(x, 14, 0x8a8a8a);
    p.R(18, 10, 3, 4, JN.woodLight);
    // 刨子
    p.R(24, 12, 9, 4, JN.woodLight);
    p.R(27, 10, 3, 2, JN.woodDark);
    // 斧头
    p.R(36, 9, 1, 14, JN.woodLight);
    p.R(37, 9, 4, 5, 0x8a8a90);
    // 凿子
    for (const x of [8, 11, 14]) {
        p.R(x, 18, 1, 8, 0x8a8a90);
        p.R(x, 16, 1, 3, JN.woodLight);
    }
    footShadow(p, 2, pw - 4, ph, 3);
    p.R(1, ph - 12, pw - 2, 4, JN.line);
    p.R(2, ph - 11, pw - 4, 2, JN.wood);
    p.R(3, ph - 8, 2, 6, JN.woodDark);
    p.R(pw - 5, ph - 8, 2, 6, JN.woodDark);
    p.R(10, ph - 13, 8, 2, 0xd9b37a);
}

function jnCounter(p: Pen): void {
    const pw = p.c.w;
    const ph = p.c.h;
    footShadow(p, 2, pw - 4, ph, 4);
    const ty = ph - 22;
    p.R(0, ty, pw, 6, JN.line);
    p.R(1, ty + 1, pw - 2, 4, JN.woodLight);
    p.R(1, ty + 1, pw - 2, 1, 0xc4905e);
    p.R(1, ty + 6, pw - 2, ph - ty - 8, JN.red);
    for (let x = 4; x < pw - 4; x += 14) {
        p.R(x, ty + 9, 10, ph - ty - 14, JN.redDark);
        p.R(x + 1, ty + 10, 8, 1, 0xb4503a);
    }
    p.R(0, ph - 2, pw, 1, JN.line);
    // 台面上：算盘、账本
    p.R(6, ty - 2, 14, 4, JN.woodDark);
    for (let x = 7; x < 19; x += 2) p.P(x, ty - 1, 0xe3b341);
    p.R(pw - 18, ty - 2, 10, 3, 0xf1e8d0);
    p.R(pw - 18, ty - 2, 10, 1, 0x3d6fb0);
}

function jnTable(p: Pen): void {
    table(p, JN.wood, JN.woodDark, JN.line);
    const pw = p.c.w;
    const ty = p.c.h - 18;
    // 桌上茶壶和两只碗
    p.E(pw / 2, ty + 4, 3, 2, () => 0xeef0f2);
    p.P(pw / 2 + 3, ty + 3, 0xeef0f2);
    p.P(pw / 2, ty + 2, 0x3d6fb0);
    for (const x of [7, pw - 8]) p.E(x, ty + 6, 2, 1, () => 0xeef0f2);
}

function jnTeaTable(p: Pen): void {
    table(p, 0x6e4a2c, 0x5a3a24, JN.line);
    const pw = p.c.w;
    const ty = p.c.h - 18;
    // 茶盘、紫砂壶、小杯
    p.R(5, ty + 2, pw - 10, 6, 0x4a3020);
    p.E(pw / 2 - 3, ty + 4, 3, 2, () => 0x8a4a3a);
    p.P(pw / 2, ty + 3, 0x8a4a3a);
    for (const x of [pw / 2 + 3, pw / 2 + 6, pw / 2 + 9]) p.P(x, ty + 5, 0xeef0f2);
}

function jnStool(p: Pen): void {
    footShadow(p, 2, 11, 16, 2);
    p.R(2, 5, 12, 5, JN.line);
    p.R(3, 6, 10, 3, JN.woodLight);
    p.R(3, 6, 10, 1, 0xc4905e);
    p.R(3, 10, 2, 5, JN.woodDark);
    p.R(11, 10, 2, 5, JN.woodDark);
}

function jnDesk(p: Pen): void {
    table(p, JN.woodDark, 0x4a3020, JN.line);
    const ty = p.c.h - 18;
    // 文房：砚台、笔架、铺开的纸
    p.R(4, ty + 2, 12, 6, 0xf6f2e6);
    for (let y = ty + 3; y < ty + 7; y += 2) p.R(6, y, 7, 1, 0x3a3a3a, 120);
    p.R(19, ty + 3, 5, 4, 0x2a2a2e);
    p.R(26, ty + 1, 4, 1, JN.wood);
    for (const x of [26, 28, 30]) p.R(x, ty - 3, 1, 4, 0x3a2a20);
}

function jnScreen(p: Pen): void {
    const pw = p.c.w;
    const ph = p.c.h;
    footShadow(p, 2, pw - 4, ph, 3);
    const panels = 4;
    const w = Math.floor((pw - 2) / panels);
    for (let i = 0; i < panels; i++) {
        const x = 1 + i * w;
        const y = 4 + (i % 2);
        p.R(x, y, w, ph - y - 2, JN.line);
        p.R(x + 1, y + 1, w - 2, ph - y - 4, 0xf1e8d0);
        // 山水：远山一抹、近处竹子
        p.R(x + 2, y + 14, w - 4, 3, 0x9aa8a0);
        p.R(x + 3, y + 12, w - 7, 2, 0xb4c0b8);
        p.R(x + 2 + (i % 3), y + 18, 1, 16, 0x5f7f5a);
        p.P(x + 3 + (i % 3), y + 20, 0x7c9a6a);
        p.P(x + 1 + (i % 3), y + 26, 0x7c9a6a);
    }
    p.R(1, ph - 3, pw - 2, 1, JN.line);
}

function jnWorkbench(p: Pen): void {
    table(p, 0xc49a68, JN.wood, JN.line);
    const pw = p.c.w;
    const ty = p.c.h - 18;
    // 台上一块木板、刨花、墨斗
    p.R(6, ty + 2, 20, 5, 0xd9b37a);
    p.R(6, ty + 2, 20, 1, 0xe8c890);
    for (const [x, y] of [[30, ty + 4], [33, ty + 6], [28, ty + 7], [36, ty + 3]]) p.E(x, y, 1, 1, () => 0xf3d892);
    p.R(pw - 8, ty + 2, 4, 3, 0x3a2a20);
}

function jnLumber(p: Pen): void {
    const pw = p.c.w;
    const ph = p.c.h;
    footShadow(p, 1, pw - 2, ph, 3);
    for (let i = 0; i < 4; i++) {
        const y = ph - 6 - i * 5;
        p.R(1 + (i % 2), y, pw - 3, 5, JN.line);
        p.R(2 + (i % 2), y + 1, pw - 5, 3, i % 2 ? 0xc49a68 : 0xd9b37a);
        p.R(2 + (i % 2), y + 1, pw - 5, 1, 0xe8c890);
        p.E(3 + (i % 2), y + 2, 1, 1, () => 0xa8744a);
    }
}

function jnRiceSacks(p: Pen): void {
    const pw = p.c.w;
    const ph = p.c.h;
    footShadow(p, 1, pw - 2, ph, 3);
    for (const [cx, cy] of [[9, ph - 9], [22, ph - 9], [15, ph - 18]]) {
        p.E(cx, cy, 7, 7, (dx, dy) => (dx + dy < -5 ? 0xf1e8d0 : dx + dy > 5 ? 0xb8a880 : 0xd8c8a0));
        p.R(cx - 2, cy - 8, 4, 2, 0xa89870);
        p.R(cx - 2, cy - 1, 4, 3, C.red);
    }
}

function jnBolts(p: Pen): void {
    const pw = p.c.w;
    const ph = p.c.h;
    footShadow(p, 1, pw - 2, ph, 3);
    // 叠起来的布匹
    for (let i = 0; i < 4; i++) {
        const c = JN.cloth[(i * 2 + 1) % JN.cloth.length];
        const y = ph - 7 - i * 5;
        p.R(2, y, pw - 4, 5, shade(c, 0.7));
        p.R(3, y, pw - 6, 4, c);
        p.R(3, y, pw - 6, 1, shade(c, 1.15));
    }
}

function jnJar(p: Pen): void {
    footShadow(p, 1, 13, 32, 2);
    p.E(8, 22, 7, 8, (dx, dy) => (dx < -3 && dy < 0 ? 0x6a7a80 : dx > 4 ? 0x2e3a40 : 0x48565c));
    p.R(3, 13, 10, 2, 0x2e3a40);
    p.R(4, 13, 8, 1, 0x7a8a90);
    p.E(8, 13, 4, 1, () => 0x3d6f8f);
}

function jnPlant(p: Pen): void {
    footShadow(p, 1, 13, 32, 2);
    // 青花盆 + 一丛文竹
    p.R(4, 22, 8, 8, 0xeef0f2);
    p.R(4, 22, 8, 1, 0xffffff);
    p.R(5, 25, 6, 2, 0x3d6fb0);
    p.R(11, 23, 1, 7, 0xc8ccd0);
    for (let i = 0; i < 18; i++) {
        const x = 3 + Math.floor(p.r() * 10);
        const y = 8 + Math.floor(p.r() * 14);
        p.P(x, y, [0x3f8a36, 0x5ea64a, 0x2f6b2a][i % 3]);
    }
    p.R(8, 12, 1, 10, 0x3f7a2c);
}

function jnRug(p: Pen): void {
    rug(p, 0xa5463e, 0x6e2a20, 0xe3b341, 'cloud');
}

function jnScroll(p: Pen): void {
    // 竖幅字画：上下轴头，留白里一行墨字
    p.R(1, 0, 14, 2, JN.woodDark);
    p.R(3, 2, 10, 26, 0xf1e8d0);
    p.R(3, 2, 10, 1, 0xd8ccb0);
    for (let y = 5; y < 25; y += 4) p.R(7, y, 3, 2, 0x2a2420);
    p.P(10, 25, C.red);
    p.R(1, 28, 14, 2, JN.woodDark);
    p.R(3, 30, 10, 1, 0x000000, 50);
}

function jnWindow(p: Pen): void {
    const pw = p.c.w;
    const ph = p.c.h;
    // 木格花窗：外框、冰裂纹窗格，透出外面的亮
    p.R(2, 2, pw - 4, ph - 4, JN.line);
    p.R(3, 3, pw - 6, ph - 6, 0xf3e8c8);
    for (let x = 3; x < pw - 3; x += 5) p.R(x, 3, 1, ph - 6, JN.wood);
    for (let y = 3; y < ph - 3; y += 5) p.R(3, y, pw - 6, 1, JN.wood);
    p.R(2, ph - 4, pw - 4, 2, JN.woodDark);
    p.R(2, ph - 2, pw - 4, 1, 0x000000, 50);
}

function jnLantern(p: Pen): void {
    p.R(7, 0, 1, 3, 0x3a2618);
    p.R(4, 3, 8, 2, JN.woodDark);
    p.R(3, 5, 10, 8, C.red);
    p.R(4, 6, 2, 6, C.redLight);
    p.R(3, 8, 10, 1, 0xe3b341);
    p.R(4, 13, 8, 1, JN.woodDark);
    p.R(7, 14, 1, 2, 0xe3b341);
}

// ---------- 西部 ----------

const WW = {
    wood: WC.wood,
    woodDark: WC.woodDark,
    woodLight: WC.woodLight,
    line: 0x3a2418,
    iron: 0x3a3a40,
    ironLight: 0x5a5a62,
    brass: 0xc89a3a,
};

function wBed(p: Pen): void {
    const pw = p.c.w;
    const ph = p.c.h;
    footShadow(p, 2, pw - 4, ph, 4);
    // 铁床头、拼布被
    p.R(2, 6, pw - 4, 2, WW.iron);
    for (let x = 3; x < pw - 3; x += 4) p.R(x, 8, 1, 8, WW.iron);
    p.R(2, 4, 2, 14, WW.ironLight);
    p.R(pw - 4, 4, 2, 14, WW.ironLight);
    const by = 16;
    p.R(2, by, pw - 4, ph - by - 3, WW.line);
    p.R(3, by + 1, pw - 6, 7, 0xf1eee4);
    const quilt = [0xc9302c, 0x3d6fb0, 0xe3b341, 0x6a8a5a, 0xeadfc4];
    for (let y = by + 8; y < ph - 4; y += 5) {
        for (let x = 3; x < pw - 3; x += 5) p.R(x, y, Math.min(5, pw - 3 - x), Math.min(5, ph - 4 - y), quilt[(x + y) % quilt.length]);
    }
    p.R(2, ph - 4, pw - 4, 2, WW.iron);
}

function wDresser(p: Pen): void {
    const pw = p.c.w;
    const ph = p.c.h;
    footShadow(p, 2, pw - 4, ph, 3);
    block(p, 2, 8, pw - 4, ph - 10, WW.wood, WW.woodLight, WW.woodDark, WW.line);
    for (let y = 12; y < ph - 6; y += 6) {
        p.R(4, y, pw - 8, 1, WW.woodDark);
        p.R(pw / 2 - 1, y + 2, 2, 2, WW.brass);
    }
    // 上面一盏煤油灯、一张相片
    p.R(6, 3, 4, 5, 0xd8a050);
    p.R(7, 1, 2, 2, 0xf3e8c0);
    p.R(pw - 12, 2, 6, 6, WW.line);
    p.R(pw - 11, 3, 4, 4, 0xd8ccb4);
}

function wStove(p: Pen): void {
    const ph = p.c.h;
    footShadow(p, 1, 13, ph, 3);
    // 铸铁炉：烟管一直通到墙上
    p.R(6, 0, 4, ph - 18, WW.iron);
    p.R(6, 0, 1, ph - 18, WW.ironLight);
    p.R(5, ph - 20, 6, 2, WW.ironLight);
    p.E(8, ph - 10, 6, 7, (dx, dy) => (dx < -2 && dy < 0 ? WW.ironLight : WW.iron));
    p.R(5, ph - 10, 6, 4, 0x2a1a14);
    p.R(6, ph - 8, 4, 2, 0xe08a30);
    p.R(3, ph - 3, 2, 2, WW.iron);
    p.R(11, ph - 3, 2, 2, WW.iron);
}

function wShelf(p: Pen): void {
    shelfUnit(p, WW.wood, WW.line, 3, (x0, x1, y, i) => {
        const kinds: ('box' | 'jar' | 'bottle')[] = ['jar', 'box', 'bottle'];
        smallGoods(p, x0, x1, y, [0xc9302c, 0xe3b341, 0x3d6fb0, 0x6a8a5a, 0xeadfc4, 0xa8794a], kinds[i % 3]);
    });
}

function wBottles(p: Pen): void {
    const pw = p.c.w;
    // 酒架后面一面镜子
    p.R(6, 4, pw - 12, 10, 0x8fb4c4, 120);
    p.R(6, 4, pw - 12, 1, 0xc8e0e8, 160);
    shelfUnit(p, WW.woodDark, WW.line, 3, (x0, x1, y) => smallGoods(p, x0, x1, y, [0x6a3a1a, 0x3a6a3a, 0x8a5a2a, 0xd8c8a8], 'bottle'));
}

function wPiano(p: Pen): void {
    const pw = p.c.w;
    const ph = p.c.h;
    footShadow(p, 2, pw - 4, ph, 4);
    block(p, 2, 6, pw - 4, ph - 8, 0x4a2a1a, 0x6a3e26, 0x2e1a10, 0x1e120a);
    // 琴键
    const ky = ph - 20;
    p.R(4, ky, pw - 8, 5, 0xf1eee4);
    for (let x = 5; x < pw - 5; x += 3) p.R(x, ky, 1, 3, 0x1e120a);
    p.R(4, ky + 5, pw - 8, 2, 0x2e1a10);
    // 谱架、烛台
    p.R(pw / 2 - 6, 10, 12, 6, 0xeadfc4);
    for (const x of [8, pw - 9]) {
        p.R(x, 6, 1, 4, WW.brass);
        p.P(x, 5, 0xf3d892);
    }
    p.R(5, ph - 8, 2, 6, 0x2e1a10);
    p.R(pw - 7, ph - 8, 2, 6, 0x2e1a10);
}

function wSafe(p: Pen): void {
    const pw = p.c.w;
    const ph = p.c.h;
    footShadow(p, 2, pw - 4, ph, 3);
    block(p, 3, 6, pw - 6, ph - 8, 0x3a4a3a, 0x5a6a5a, 0x2a342a, 0x1a201a);
    p.R(6, 9, pw - 12, ph - 16, 0x2e3a2e);
    p.E(pw / 2, ph / 2 + 2, 4, 4, (dx, dy) => (dx * dx + dy * dy < 4 ? 0x1a1a1a : WW.brass));
    p.R(pw - 10, ph / 2, 3, 6, WW.brass);
    p.R(5, 7, pw - 10, 1, WW.brass);
}

function wCell(p: Pen): void {
    const pw = p.c.w;
    const ph = p.c.h;
    // 牢房：后面一张窄床，前面一排铁栏
    p.R(4, 14, pw - 8, 10, 0x8a7a68);
    p.R(5, 15, pw - 10, 3, 0xd8ccb4);
    p.R(pw - 12, 4, 6, 6, 0x2c3a44);
    for (const x of [pw - 10, pw - 8]) p.R(x, 4, 1, 6, WW.iron);
    p.R(1, ph - 4, pw - 2, 2, WW.iron);
    p.R(1, 2, pw - 2, 2, WW.iron);
    for (let x = 2; x < pw - 1; x += 4) {
        p.R(x, 2, 2, ph - 4, WW.iron);
        p.R(x, 2, 1, ph - 4, WW.ironLight);
    }
    p.R(pw / 2 - 2, ph / 2, 4, 4, WW.brass);
    footShadow(p, 1, pw - 2, ph, 2);
}

function wForge(p: Pen): void {
    const pw = p.c.w;
    const ph = p.c.h;
    footShadow(p, 2, pw - 4, ph, 3);
    // 石砌炉膛、红炭、上面的烟罩、风箱
    p.R(8, 0, pw - 16, 14, 0x5a5048);
    p.R(6, 12, pw - 12, 4, 0x4a4038);
    const ty = ph - 22;
    p.R(2, ty, pw - 4, 20, 0x6a6058);
    for (let y = ty + 2; y < ph - 2; y += 5) for (let x = 3 + (y % 2) * 3; x < pw - 4; x += 7) p.R(x, y, 6, 4, 0x7a7068);
    p.R(8, ty + 2, pw - 16, 7, 0x2a1a14);
    for (let x = 9; x < pw - 9; x += 2) p.P(x, ty + 6 + (x % 3), [0xe08a30, 0xc9302c, 0xf3d892][x % 3]);
    p.R(pw - 12, ty + 8, 9, 8, 0x8a5a34);
    p.R(pw - 12, ty + 8, 9, 1, 0xa8794a);
}

function wMail(p: Pen): void {
    const pw = p.c.w;
    const ph = p.c.h;
    footShadow(p, 2, pw - 4, ph, 3);
    block(p, 1, 4, pw - 2, ph - 6, WW.wood, WW.woodLight, WW.woodDark, WW.line);
    for (let y = 7; y < ph - 8; y += 6) {
        for (let x = 4; x < pw - 6; x += 7) {
            p.R(x, y, 6, 5, WW.woodDark);
            if (p.r() < 0.6) p.R(x + 1, y + 2, 4, 3, 0xf1eee4);
        }
    }
}

function wMedicine(p: Pen): void {
    shelfUnit(p, 0xeadfc4, 0x6a5a48, 4, (x0, x1, y) => smallGoods(p, x0, x1, y, [0x6a3a1a, 0x3d6fb0, 0x6a8a5a, 0xf1eee4], 'bottle'));
}

function wStall(p: Pen): void {
    const pw = p.c.w;
    const ph = p.c.h;
    // 马栏：木栏一截、食槽、挂着马鞍
    p.R(1, 6, pw - 2, 3, WW.wood);
    p.R(1, 6, pw - 2, 1, WW.woodLight);
    p.R(1, 14, pw - 2, 3, WW.wood);
    for (const x of [1, pw / 2 - 1, pw - 3]) p.R(x, 4, 3, ph - 6, WW.woodDark);
    p.R(6, ph - 9, pw - 12, 6, WW.woodDark);
    p.R(7, ph - 9, pw - 14, 2, 0xd8b850);
    p.E(pw / 2 + 8, 10, 5, 3, (dx, dy) => (dy < 0 ? 0x8a4a2a : 0x6a3a1a));
    footShadow(p, 1, pw - 2, ph, 2);
}

function wMirror(p: Pen): void {
    const pw = p.c.w;
    const ph = p.c.h;
    footShadow(p, 2, pw - 4, ph, 3);
    p.R(4, 2, pw - 8, 22, WW.woodDark);
    p.R(5, 3, pw - 10, 20, 0x8fb4c4);
    p.R(6, 4, 3, 10, 0xc8e0e8);
    table(p, WW.wood, WW.woodDark, WW.line);
    p.R(8, ph - 17, 3, 3, 0xeadfc4);
    p.R(pw - 12, ph - 18, 2, 4, 0x6a8a5a);
}

function wOrgan(p: Pen): void {
    const pw = p.c.w;
    const ph = p.c.h;
    footShadow(p, 2, pw - 4, ph, 3);
    // 风琴：顶上一排音管
    for (let x = 4; x < pw - 4; x += 3) p.R(x, 2 + ((x / 3) % 3) * 2, 2, 14, 0xc8a050);
    block(p, 2, 14, pw - 4, ph - 16, 0x5a3a24, 0x7a5030, 0x3a2418, 0x2a1a10);
    p.R(4, ph - 18, pw - 8, 3, 0xf1eee4);
    for (let x = 5; x < pw - 5; x += 3) p.P(x, ph - 18, 0x2a1a10);
}

function wBar(p: Pen): void {
    const pw = p.c.w;
    const ph = p.c.h;
    footShadow(p, 2, pw - 4, ph, 4);
    const ty = ph - 22;
    p.R(0, ty, pw, 6, WW.line);
    p.R(1, ty + 1, pw - 2, 4, 0x6e3e22);
    p.R(1, ty + 1, pw - 2, 1, 0x9a5a34);
    p.R(1, ty + 6, pw - 2, ph - ty - 8, 0x5a3220);
    for (let x = 3; x < pw - 3; x += 10) {
        p.R(x, ty + 9, 8, ph - ty - 14, 0x4a2818);
        p.R(x, ty + 9, 8, 1, 0x7a4a2a);
    }
    // 铜脚踏杆
    p.R(1, ph - 5, pw - 2, 1, WW.brass);
    // 台面上的杯子
    for (const x of [10, 30, 52]) {
        p.R(x, ty - 4, 3, 4, 0xd8e8ec, 200);
        p.R(x, ty - 2, 3, 2, 0xc89a3a, 220);
    }
}

function wCounter(p: Pen): void {
    const pw = p.c.w;
    const ph = p.c.h;
    footShadow(p, 2, pw - 4, ph, 4);
    const ty = ph - 22;
    p.R(0, ty, pw, 6, WW.line);
    p.R(1, ty + 1, pw - 2, 4, WW.woodLight);
    p.R(1, ty + 1, pw - 2, 1, 0xd0a070);
    p.R(1, ty + 6, pw - 2, ph - ty - 8, WW.wood);
    for (let x = 1; x < pw - 1; x += 6) p.R(x, ty + 6, 1, ph - ty - 8, WW.woodDark);
    p.R(0, ph - 2, pw, 1, WW.line);
    // 秤、糖罐、收银机
    p.R(6, ty - 3, 10, 3, WW.brass);
    p.R(10, ty - 6, 2, 3, WW.brass);
    p.R(pw - 20, ty - 7, 12, 7, 0x3a3a40);
    p.R(pw - 19, ty - 6, 10, 2, WW.brass);
    p.E(pw / 2, ty - 3, 3, 3, () => 0xd8e8ec);
}

function wTeller(p: Pen): void {
    const pw = p.c.w;
    const ph = p.c.h;
    footShadow(p, 2, pw - 4, ph, 4);
    const ty = ph - 20;
    p.R(0, ty, pw, 5, WW.line);
    p.R(1, ty + 1, pw - 2, 3, 0x8a4a2a);
    p.R(1, ty + 5, pw - 2, ph - ty - 7, 0x6a3a22);
    for (let x = 4; x < pw - 4; x += 16) p.R(x, ty + 8, 12, ph - ty - 13, 0x5a3020);
    // 铜栅栏，中间一个窗口
    p.R(0, 4, pw, 2, WW.brass);
    for (let x = 1; x < pw; x += 3) if (Math.abs(x - pw / 2) > 6) p.R(x, 6, 1, ty - 6, WW.brass);
    p.R(pw / 2 - 6, 6, 12, 1, WW.brass);
    p.R(pw / 2 - 4, ty - 3, 8, 3, 0xe3b341);
}

function wTable(p: Pen): void {
    table(p, WW.woodLight, WW.wood, WW.line);
    const ty = p.c.h - 18;
    // 红白格桌布
    for (let y = ty + 1; y < ty + 9; y += 2) for (let x = 2; x < p.c.w - 2; x += 2) if (((x + y) / 2) % 2 === 0) p.R(x, y, 2, 2, 0xc9302c);
    p.R(p.c.w / 2 - 2, ty + 2, 4, 4, 0xeadfc4);
}

function wRound(p: Pen): void {
    const pw = p.c.w;
    const ph = p.c.h;
    footShadow(p, 3, pw - 6, ph, 3);
    p.R(pw / 2 - 2, ph - 10, 4, 8, WW.woodDark);
    p.R(pw / 2 - 6, ph - 3, 12, 2, WW.woodDark);
    p.E(pw / 2, ph - 14, 14, 6, (dx, dy) => (dy > 3 ? WW.wood : dx + dy < -8 ? 0xd0a070 : WW.woodLight));
    // 杯子、一瓶汽水
    p.R(pw / 2 - 6, ph - 17, 3, 3, 0xd8e8ec, 200);
    p.R(pw / 2 + 3, ph - 18, 3, 4, 0xd8e8ec, 200);
    p.R(pw / 2 - 1, ph - 21, 2, 6, 0x6a3a1a);
}

function wChair(p: Pen): void {
    const ph = p.c.h;
    footShadow(p, 2, 10, ph, 2);
    p.R(3, ph - 26, 10, 3, WW.woodDark);
    p.R(3, ph - 23, 2, 12, WW.woodDark);
    p.R(11, ph - 23, 2, 12, WW.woodDark);
    for (const x of [6, 8]) p.R(x, ph - 23, 1, 12, WW.wood);
    p.R(2, ph - 12, 12, 4, WW.line);
    p.R(3, ph - 11, 10, 2, WW.woodLight);
    p.R(3, ph - 8, 2, 7, WW.woodDark);
    p.R(11, ph - 8, 2, 7, WW.woodDark);
}

function wDesk(p: Pen): void {
    table(p, WW.wood, WW.woodDark, WW.line);
    const ty = p.c.h - 18;
    p.R(4, ty + 2, 9, 6, 0xeadfc4);
    p.R(5, ty + 3, 6, 1, 0x3a2418, 120);
    p.R(18, ty + 1, 4, 5, 0xd8a050);
    p.R(19, ty - 1, 2, 2, 0xf3e8c0);
    p.R(25, ty + 3, 3, 3, 0x2a2a2e);
}

function wBarber(p: Pen): void {
    const ph = p.c.h;
    footShadow(p, 2, 11, ph, 2);
    p.R(3, ph - 28, 10, 12, 0x8a2a2a);
    p.R(4, ph - 27, 8, 2, 0xb04a3a);
    p.R(2, ph - 16, 12, 5, 0x6a1a1a);
    p.R(2, ph - 16, 12, 1, 0xa03a2a);
    p.R(1, ph - 18, 2, 6, 0xd8ccb4);
    p.R(13, ph - 18, 2, 6, 0xd8ccb4);
    p.R(7, ph - 11, 2, 7, 0xd8ccb4);
    p.R(4, ph - 4, 8, 2, 0xd8ccb4);
}

function wAnvil(p: Pen): void {
    const pw = p.c.w;
    footShadow(p, 2, pw - 4, 16, 2);
    p.R(6, 10, pw - 12, 5, 0x6a4a2c);
    p.R(4, 3, pw - 8, 4, WW.iron);
    p.R(4, 3, pw - 8, 1, 0x7a7a82);
    p.R(pw - 6, 4, 4, 2, WW.iron);
    p.R(10, 7, pw - 20, 3, WW.iron);
    p.R(14, 1, 6, 2, 0x8a8a90);
}

function wPew(p: Pen): void {
    const pw = p.c.w;
    footShadow(p, 2, pw - 4, 16, 2);
    p.R(1, 1, pw - 2, 4, WW.woodDark);
    p.R(1, 1, pw - 2, 1, WW.wood);
    p.R(1, 6, pw - 2, 5, WW.line);
    p.R(2, 7, pw - 4, 3, WW.woodLight);
    for (const x of [2, pw - 4]) p.R(x, 11, 2, 4, WW.woodDark);
}

function wPulpit(p: Pen): void {
    const pw = p.c.w;
    const ph = p.c.h;
    footShadow(p, 3, pw - 6, ph, 3);
    block(p, 6, ph - 22, pw - 12, 20, WW.wood, WW.woodLight, WW.woodDark, WW.line);
    p.R(4, ph - 24, pw - 8, 3, WW.woodDark);
    p.R(pw / 2 - 4, ph - 28, 8, 4, 0x3a2418);
    p.R(pw / 2 - 3, ph - 27, 6, 2, 0xeadfc4);
    p.R(pw / 2 - 1, ph - 18, 2, 8, WW.brass);
    p.R(pw / 2 - 3, ph - 15, 6, 2, WW.brass);
}

function wBarrel(p: Pen): void {
    const ph = p.c.h;
    footShadow(p, 1, 13, ph, 2);
    p.E(8, ph - 10, 6, 9, (dx) => (dx < -3 ? WW.woodLight : dx > 3 ? WW.woodDark : WW.wood));
    for (const y of [ph - 16, ph - 5]) p.R(2, y, 12, 1, WW.iron);
    p.E(8, ph - 18, 5, 1, () => WW.woodDark);
}

function wCrate(p: Pen): void {
    footShadow(p, 1, 13, 16, 2);
    block(p, 2, 3, 12, 12, WW.woodLight, 0xd0a070, WW.wood, WW.line);
    for (let k = 0; k < 9; k++) {
        p.P(4 + k, 5 + k, WW.wood);
    }
    p.R(3, 8, 10, 1, WW.wood);
}

function wSacks(p: Pen): void {
    const pw = p.c.w;
    const ph = p.c.h;
    footShadow(p, 1, pw - 2, ph, 3);
    for (const [cx, cy] of [[9, ph - 9], [22, ph - 9], [15, ph - 19]]) {
        p.E(cx, cy, 7, 7, (dx, dy) => (dx + dy < -5 ? 0xd8c090 : dx + dy > 5 ? 0x9a8058 : 0xbca070));
        p.R(cx - 2, cy - 8, 4, 2, 0x8a7048);
        p.R(cx - 3, cy - 1, 6, 1, 0x6a3a1a);
    }
}

function wHay(p: Pen): void {
    const pw = p.c.w;
    const ph = p.c.h;
    footShadow(p, 1, pw - 2, ph, 3);
    block(p, 1, ph - 22, pw - 2, 20, 0xd8b850, 0xe8d070, 0xb89838, 0x8a7028);
    for (let i = 0; i < 30; i++) p.P(2 + Math.floor(p.r() * (pw - 4)), ph - 21 + Math.floor(p.r() * 18), p.r() < 0.5 ? 0xb89838 : 0xf0e090);
    for (const y of [ph - 16, ph - 8]) p.R(1, y, pw - 2, 1, 0x8a5a34);
}

function wCactus(p: Pen): void {
    const ph = p.c.h;
    footShadow(p, 1, 13, ph, 2);
    p.R(4, ph - 8, 8, 7, 0xb4563a);
    p.R(4, ph - 8, 8, 1, 0xc66a44);
    p.R(6, ph - 22, 4, 14, WC.cactus[0]);
    p.R(6, ph - 22, 1, 14, WC.cactus[2]);
    p.R(3, ph - 18, 3, 2, WC.cactus[0]);
    p.R(3, ph - 21, 2, 4, WC.cactus[0]);
    p.R(10, ph - 16, 3, 2, WC.cactus[1]);
    p.R(11, ph - 19, 2, 4, WC.cactus[1]);
    p.P(8, ph - 23, 0xe98fa6);
}

function wRug(p: Pen): void {
    rug(p, 0xc86a3a, 0x6a2a1a, 0xeadfc4, 'diamond');
}

function wWindow(p: Pen): void {
    const pw = p.c.w;
    const ph = p.c.h;
    p.R(2, 1, pw - 4, ph - 3, WW.woodDark);
    p.R(4, 3, pw - 8, ph - 7, 0x9ac8d8);
    p.R(4, 3, pw - 8, (ph - 7) / 2, 0xb8dce8);
    p.R(pw / 2 - 1, 3, 2, ph - 7, WW.woodDark);
    p.R(4, ph / 2 - 1, pw - 8, 2, WW.woodDark);
    // 两边半拉的窗帘
    p.R(2, 1, 4, ph - 4, 0xc9302c);
    p.R(pw - 6, 1, 4, ph - 4, 0xc9302c);
    p.R(1, ph - 4, pw - 2, 2, WW.wood);
    p.R(1, ph - 2, pw - 2, 1, 0x000000, 50);
}

function wAntlers(p: Pen): void {
    p.E(8, 10, 3, 3, () => WW.woodDark);
    p.R(6, 8, 4, 5, 0x8a6a4a);
    for (const s of [-1, 1]) {
        for (let k = 0; k < 6; k++) p.P(8 + s * (2 + k), 7 - Math.floor(k / 2), 0xeadfc4);
        p.P(8 + s * 4, 3, 0xeadfc4);
        p.P(8 + s * 6, 2, 0xeadfc4);
    }
}

function wWanted(p: Pen): void {
    p.R(2, 1, 12, 14, 0xe8d8b0);
    p.R(2, 1, 12, 1, 0xf6ead0);
    p.R(4, 3, 8, 2, 0x3a2418);
    p.E(8, 8, 2, 2, () => 0x6a5a48);
    p.R(4, 12, 8, 1, 0x3a2418);
    p.P(3, 2, 0x8a8a8a);
    p.R(2, 15, 12, 1, 0x000000, 50);
}

function wLamp(p: Pen): void {
    p.R(3, 3, 2, 2, WW.iron);
    p.R(5, 4, 4, 1, WW.iron);
    p.R(8, 5, 4, 8, 0xd8e8ec, 180);
    p.R(9, 7, 2, 4, 0xf3d892);
    p.R(8, 12, 4, 2, WW.brass);
    p.R(7, 4, 6, 1, WW.brass);
}

export const FURNITURE_ART: Record<string, Paint> = {
    jn_bed: jnBed, jn_wardrobe: jnWardrobe, jn_stove: jnStove, jn_curio: jnCurio, jn_altar: jnAltar, jn_goods: jnGoods,
    jn_cloth_rack: jnClothRack, jn_tea_jars: jnTeaJars, jn_rice_bins: jnRiceBins, jn_tools: jnTools, jn_counter: jnCounter,
    jn_table: jnTable, jn_tea_table: jnTeaTable, jn_stool: jnStool, jn_desk: jnDesk, jn_screen: jnScreen, jn_workbench: jnWorkbench,
    jn_lumber: jnLumber, jn_rice_sacks: jnRiceSacks, jn_bolts: jnBolts, jn_jar: jnJar, jn_plant: jnPlant, jn_rug: jnRug,
    jn_scroll: jnScroll, jn_window: jnWindow, jn_lantern: jnLantern,
    w_bed: wBed, w_dresser: wDresser, w_stove: wStove, w_shelf: wShelf, w_bottles: wBottles, w_piano: wPiano, w_safe: wSafe,
    w_cell: wCell, w_forge: wForge, w_mail: wMail, w_medicine: wMedicine, w_stall: wStall, w_mirror: wMirror, w_organ: wOrgan,
    w_bar: wBar, w_counter: wCounter, w_teller: wTeller, w_table: wTable, w_round: wRound, w_chair: wChair, w_desk: wDesk,
    w_barber: wBarber, w_anvil: wAnvil, w_pew: wPew, w_pulpit: wPulpit, w_barrel: wBarrel, w_crate: wCrate, w_sacks: wSacks,
    w_hay: wHay, w_cactus: wCactus, w_rug: wRug, w_window: wWindow, w_antlers: wAntlers, w_wanted: wWanted, w_lamp: wLamp,
};

// ---------- 地板、墙面 ----------

/** 横铺木地板：一行 4px，接缝错开，零星木节 */
function planks(p: Pen, cols: number[], gap: number, rowH = 4): void {
    for (let y = 0; y < TILE; y += rowH) {
        const c = cols[Math.floor(p.r() * cols.length)];
        p.R(0, y, TILE, rowH, c);
        p.R(0, y + rowH - 1, TILE, 1, gap);
        p.R(0, y, TILE, 1, shade(c, 1.07));
        const joint = Math.floor(p.r() * TILE);
        p.R(joint, y, 1, rowH - 1, gap);
        if (p.r() < 0.25) p.P(Math.floor(p.r() * TILE), y + 1, shade(c, 0.8));
    }
}

/** 方砖地：两块 8px 方砖错缝 */
function bricks(p: Pen, cols: number[], mortar: number): void {
    p.R(0, 0, TILE, TILE, mortar);
    for (let y = 0; y < TILE; y += 8) {
        for (let x = 0; x < TILE; x += 8) {
            const c = cols[Math.floor(p.r() * cols.length)];
            p.R(x, y, 7, 7, c);
            p.R(x, y, 7, 1, shade(c, 1.08));
            if (p.r() < 0.3) p.P(x + 2 + Math.floor(p.r() * 3), y + 3, shade(c, 0.9));
        }
    }
}

function dirt(p: Pen): void {
    p.R(0, 0, TILE, TILE, 0x9a7a52);
    for (let i = 0; i < 18; i++) p.P(Math.floor(p.r() * TILE), Math.floor(p.r() * TILE), [0x8a6a46, 0xa8885e, 0x7a5c3a][i % 3]);
    for (let i = 0; i < 3; i++) {
        const x = Math.floor(p.r() * 13);
        const y = Math.floor(p.r() * 15);
        p.R(x, y, 3, 1, 0xd8b850);
    }
}

/** 竖木板墙 */
function boardWall(p: Pen, cols: number[], gap: number): void {
    for (let x = 0; x < TILE; x += 4) {
        const c = cols[(x / 4 + Math.floor(p.r() * 2)) % cols.length];
        p.R(x, 0, 4, TILE, c);
        p.R(x + 3, 0, 1, TILE, gap);
        p.R(x, 0, 1, TILE, shade(c, 1.08));
        if (p.r() < 0.3) p.P(x + 1, Math.floor(p.r() * TILE), shade(c, 0.8));
    }
}

/** 白灰墙：浅色底、淡淡的斑驳 */
function plaster(p: Pen): void {
    p.R(0, 0, TILE, TILE, 0xeee8d8);
    for (let i = 0; i < 6; i++) p.P(Math.floor(p.r() * TILE), Math.floor(p.r() * TILE), 0xe2dcca);
}

function logWall(p: Pen): void {
    for (let y = 0; y < TILE; y += 8) {
        p.R(0, y, TILE, 8, 0x8a5a34);
        p.R(0, y + 1, TILE, 2, 0xa8794a);
        p.R(0, y + 6, TILE, 2, 0x5a3a24);
        if (p.r() < 0.4) p.P(Math.floor(p.r() * TILE), y + 4, 0x6e4a2c);
    }
}

function paper(p: Pen, base: number, motif: number): void {
    p.R(0, 0, TILE, TILE, base);
    for (let y = 2; y < TILE; y += 8) {
        for (let x = (y % 16 === 2 ? 4 : 0); x < TILE; x += 8) {
            p.P(x + 2, y, motif);
            p.P(x + 1, y + 1, motif);
            p.P(x + 3, y + 1, motif);
            p.P(x + 2, y + 2, motif);
        }
    }
}

function brickWall(p: Pen): void {
    p.R(0, 0, TILE, TILE, WC.mortar);
    for (let y = 0; y < TILE; y += 4) {
        const off = (y / 4) % 2 ? 4 : 0;
        for (let x = -off; x < TILE; x += 8) p.R(x, y, 7, 3, WC.brick[Math.floor(p.r() * WC.brick.length)]);
    }
}

interface WallStyle {
    /** 墙面一格 */
    face: Paint;
    /** 墙裙：墙面下面那行的下半截画什么，不填用一条踢脚线 */
    skirt?: Paint;
    /** 墙头（最上一行）横梁的颜色 */
    beam: number;
}

const WALLS: Record<string, WallStyle> = {
    jn_plaster: { face: plaster, beam: 0x5a3a24, skirt: (p) => boardWall(p, [0x7a4a29, 0x6b3f22], 0x4a2a18) },
    jn_wood_wall: { face: (p) => boardWall(p, [0x9a6a3e, 0x8c5e36, 0xa6744a], 0x5a3a24), beam: 0x4a2e1e },
    w_planks: { face: (p) => boardWall(p, [0xc8a070, 0xbc9464, 0xd0aa7a], 0x8a6a46), beam: 0x6e4a2c },
    w_log: { face: logWall, beam: 0x4a2e1e },
    w_paper_red: { face: (p) => paper(p, 0x8a2a2a, 0xc89a3a), beam: 0x3a2418, skirt: (p) => boardWall(p, [0x6e3e22, 0x5a3220], 0x3a2418) },
    w_paper_green: { face: (p) => paper(p, 0x4a6a5a, 0xd8ccb4), beam: 0x3a2418, skirt: (p) => boardWall(p, [0x8a5a34, 0x7a4a29], 0x4a2a18) },
    w_brick: { face: brickWall, beam: 0x5a3020 },
    w_barn: { face: (p) => boardWall(p, [0x9a4a32, 0x8a4028, 0xa65a3c], 0x5a2a1a), beam: 0x4a2418 },
};

const FLOORS: Record<string, Paint> = {
    jn_wood: (p) => planks(p, [0xa8744a, 0x9a6a3e, 0xb07c50], 0x6e4628),
    jn_brick: (p) => bricks(p, [0x9a9a92, 0x8e8e86, 0xa6a69e], 0x6e6e68),
    w_planks: (p) => planks(p, [0xb48654, 0xa87a4a, 0xbc905e], 0x7a5432),
    w_dirt: dirt,
};

const EDGE = 0x1e1814;
const EDGE_TRIM = 0x4a3426;

/** 室内图块：floor_<名>_<0..2>、floor_<名>_top<0..1>（贴墙那行，带墙脚影子）、wall_<名>_cap|f1|f2_<0..1>、墙边和出口。 */
export function interiorTiles(): Record<string, Paint> {
    const out: Record<string, Paint> = {};
    for (const [name, paint] of Object.entries(FLOORS)) {
        for (let k = 0; k < 3; k++) out[`floor_${name}_${k}`] = paint;
        for (let k = 0; k < 2; k++) {
            out[`floor_${name}_top${k}`] = (p) => {
                paint(p);
                p.R(0, 0, TILE, 4, 0x000000, 60);
                p.R(0, 4, TILE, 2, 0x000000, 28);
            };
        }
    }
    for (const [name, s] of Object.entries(WALLS)) {
        out[`wall_${name}_cap`] = (p) => {
            p.R(0, 0, TILE, TILE, EDGE);
            p.R(0, 10, TILE, 6, s.beam);
            p.R(0, 10, TILE, 1, shade(s.beam, 1.3));
            p.R(0, 15, TILE, 1, shade(s.beam, 0.6));
        };
        for (let k = 0; k < 2; k++) {
            out[`wall_${name}_f1_${k}`] = (p) => {
                s.face(p);
                p.R(0, 0, TILE, 2, 0x000000, 50);
            };
            out[`wall_${name}_f2_${k}`] = (p) => {
                s.face(p);
                if (s.skirt) {
                    // 墙裙只画下半截：先画满墙裙记下来，再画回墙面，把下半截换成墙裙
                    s.skirt(p);
                    const keep = p.c.px.slice();
                    s.face(p);
                    for (let y = 8; y < TILE; y++) for (let x = 0; x < TILE; x++) for (let j = 0; j < 4; j++) p.c.px[(y * TILE + x) * 4 + j] = keep[(y * TILE + x) * 4 + j];
                    p.R(0, 8, TILE, 1, 0x3a2418);
                } else {
                    p.R(0, 13, TILE, 3, s.beam);
                    p.R(0, 13, TILE, 1, shade(s.beam, 1.3));
                }
            };
        }
    }
    out.edge_l = (p) => {
        p.R(0, 0, TILE, TILE, EDGE);
        p.R(12, 0, 4, TILE, EDGE_TRIM);
        p.R(12, 0, 1, TILE, shade(EDGE_TRIM, 1.3));
    };
    out.edge_r = (p) => {
        p.R(0, 0, TILE, TILE, EDGE);
        p.R(0, 0, 4, TILE, EDGE_TRIM);
        p.R(3, 0, 1, TILE, shade(EDGE_TRIM, 0.7));
    };
    out.edge_b = (p) => {
        p.R(0, 0, TILE, TILE, EDGE);
        p.R(0, 0, TILE, 4, EDGE_TRIM);
        p.R(0, 0, TILE, 1, shade(EDGE_TRIM, 1.3));
    };
    out.edge_bl = (p) => {
        out.edge_b(p);
        p.R(0, 0, 12, TILE, EDGE);
        p.R(12, 0, 4, 4, EDGE_TRIM);
    };
    out.edge_br = (p) => {
        out.edge_b(p);
        p.R(4, 0, 12, TILE, EDGE);
        p.R(0, 0, 4, 4, EDGE_TRIM);
    };
    out.edge_top = (p) => p.R(0, 0, TILE, TILE, EDGE);
    // 出口：门槛 + 一块门垫，外面透进一点光
    for (const [style, floor] of [['jiangnan', 'jn_wood'], ['western', 'w_planks']] as const) {
        out[`exit_${style}`] = (p) => {
            FLOORS[floor](p);
            p.R(0, 12, TILE, 4, 0xf3e8c0, 120);
            p.R(1, 2, 14, 9, style === 'jiangnan' ? 0x8a3a2a : 0x6a5a3a);
            p.R(2, 3, 12, 7, style === 'jiangnan' ? 0xb04a3a : 0x8a7a4a);
            for (let x = 3; x < 13; x += 2) p.P(x, 6, style === 'jiangnan' ? 0xe3b341 : 0xc8b070);
            p.R(0, 0, 1, TILE, EDGE_TRIM);
            p.R(15, 0, 1, TILE, EDGE_TRIM);
        };
    }
    return out;
}

// ---------- 礼物图标（16×16） ----------

function giftBox(p: Pen, body: number, lid: number, mark: number): void {
    p.R(2, 5, 12, 9, shade(body, 0.6));
    p.R(3, 6, 10, 7, body);
    p.R(1, 3, 14, 3, lid);
    p.R(7, 3, 2, 11, mark);
}

export const GIFT_ART: Record<string, Paint> = {
    gift_longjing: (p) => {
        p.R(4, 4, 8, 10, 0x2f5a3a);
        p.R(4, 3, 8, 2, 0x1e3a26);
        p.R(5, 7, 6, 4, 0xf3d892);
        p.R(7, 8, 2, 2, 0x4f8a5a);
    },
    gift_osmanthus_cake: (p) => {
        for (const [x, y] of [[2, 8], [8, 8], [5, 4]]) {
            p.R(x, y, 6, 5, 0xf6e6a8);
            p.R(x, y, 6, 1, 0xfff4c8);
            p.P(x + 2, y + 2, 0xe3a030);
            p.P(x + 4, y + 3, 0xe3a030);
        }
    },
    gift_silk_hanky: (p) => {
        p.R(3, 3, 10, 10, 0xe98fa6);
        p.R(3, 3, 10, 1, 0xf6b8c8);
        p.R(5, 5, 6, 6, 0xf6b8c8);
        p.P(8, 8, 0xc9302c);
        p.R(3, 12, 10, 1, 0xb86a80);
    },
    gift_indigo_cloth: (p) => {
        p.R(2, 4, 12, 9, 0x2a3a6a);
        for (let x = 3; x < 13; x += 3) for (let y = 5; y < 12; y += 3) p.P(x, y, 0xf1eee4);
        p.R(2, 4, 12, 1, 0x3d5a9a);
    },
    gift_rice_cake: (p) => {
        p.R(2, 9, 12, 4, 0xf6f2e6);
        p.R(4, 5, 8, 4, 0xf1eee4);
        p.R(2, 9, 12, 1, 0xffffff);
        p.P(7, 6, C.red);
        p.P(8, 6, C.red);
    },
    gift_glutinous_rice: (p) => {
        p.E(8, 9, 6, 5, (dx, dy) => (dy < -2 ? 0xf6f2e6 : 0xd8c8a0));
        p.R(5, 3, 6, 2, 0xa89870);
        p.R(6, 8, 4, 3, C.red);
    },
    gift_wood_comb: (p) => {
        p.R(2, 5, 12, 4, 0xa8744a);
        p.R(2, 5, 12, 1, 0xc4905e);
        for (let x = 3; x < 14; x += 2) p.R(x, 9, 1, 4, 0x8a5a34);
    },
    gift_candy: (p) => {
        p.E(8, 8, 3, 3, (dx, dy) => (dx + dy < -1 ? 0xf6c8a0 : 0xe08a30));
        p.R(2, 7, 3, 3, 0xe98fa6);
        p.R(11, 7, 3, 3, 0xe98fa6);
    },
    gift_root_beer: (p) => {
        p.R(6, 2, 4, 3, 0x3a2418);
        p.R(5, 5, 6, 9, 0x5a2a1a);
        p.R(5, 8, 6, 3, 0xeadfc4);
        p.P(6, 6, 0xc8a080);
    },
    gift_jerky: (p) => {
        p.R(3, 4, 4, 10, 0x8a3a2a);
        p.R(8, 3, 4, 9, 0x7a3020);
        p.P(4, 6, 0xb05a3a);
        p.P(9, 5, 0xb05a3a);
        p.R(2, 12, 12, 2, 0xd8ccb4);
    },
    gift_coffee: (p) => {
        p.R(3, 4, 10, 10, 0x8a6a4a);
        p.R(3, 4, 10, 1, 0xa8885e);
        for (const [x, y] of [[5, 7], [9, 8], [7, 11]]) p.E(x, y, 1, 1, () => 0x3a2418);
    },
    gift_apple_pie: (p) => {
        p.E(8, 9, 6, 4, (dx, dy) => (dy < 0 ? 0xd8a050 : 0xb07838));
        for (let x = 4; x < 13; x += 3) p.R(x, 7, 1, 4, 0xe8c070);
        p.P(8, 9, 0xc9302c);
    },
    gift_horseshoe: (p) => {
        // U 形：外圈留下、里圈和下面开口挖空
        p.E(8, 8, 5, 6, (dx, dy) => (dx * dx + dy * dy > 8 && !(dy > 2 && Math.abs(dx) < 3) ? 0x8a8a90 : null));
        p.P(4, 6, 0xc8c8d0);
        for (const [x, y] of [[4, 9], [12, 9], [6, 3], [10, 3]]) p.P(x, y, 0x4a4a50);
    },
    gift_postcard: (p) => {
        p.R(2, 4, 12, 9, 0xeadfc4);
        p.R(3, 5, 6, 5, 0xd28a5a);
        p.R(3, 5, 6, 2, 0x9ac8d8);
        p.R(10, 5, 3, 3, 0xc9302c);
        p.R(10, 9, 3, 1, 0x6a5a48);
    },
    gift_gold_nugget: (p) => {
        p.E(8, 9, 5, 4, (dx, dy) => (dx + dy < -3 ? 0xf6e08a : dx + dy > 3 ? 0xb08a20 : 0xe3b341));
        p.P(6, 7, 0xffffff);
    },
    gift_herb_tea: (p) => {
        giftBox(p, 0x6a8a5a, 0x4a6a3a, 0xeadfc4);
        p.P(5, 8, 0x8ab06a);
        p.P(11, 9, 0x8ab06a);
    },
};
