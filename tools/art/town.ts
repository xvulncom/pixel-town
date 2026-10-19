// 镇子的大件和水边细节：院墙、门楼、戏台、牌坊、茶桌、糖葫芦、河埠头台阶、水里的倒影。

import { Pen, TILE, groundShadow } from './canvas';
import { C } from './palette';
import { tileEave } from './props';

const WALL_CAP = [0x3a3f47, 0x4a515b, 0x262a30];

/** 院墙横段，1×2 格：上半格是黑瓦压顶（盖住人），下半格是白墙和墙脚（挡路）。 */
export function wallH(p: Pen): void {
    p.R(0, 28, 16, 4, C.shadow, 50);
    p.R(0, 15, 16, 13, C.wall);
    p.R(0, 15, 16, 2, 0xc9c4b5);
    p.R(0, 25, 16, 3, C.plinth);
    p.R(0, 25, 16, 1, 0xa29e94);
    p.R(0, 9, 16, 6, WALL_CAP[0]);
    p.R(0, 9, 16, 1, WALL_CAP[1]);
    for (let x = 1; x < 16; x += 3) p.R(x, 10, 1, 4, WALL_CAP[2]);
    p.R(0, 14, 16, 1, WALL_CAP[2]);
    if ((p.r() * 3) | 0) p.P(4 + ((p.r() * 8) | 0), 19 + ((p.r() * 4) | 0), 0xe2ded2);
}

/** 院墙竖段，1×1 格：从上往下看只看到墙顶的瓦和两侧一线白墙，右侧地上有影子。 */
export function wallV(p: Pen): void {
    p.R(11, 0, 3, 16, C.shadow, 50);
    p.R(4, 0, 8, 16, C.wall);
    p.R(5, 0, 6, 16, WALL_CAP[0]);
    p.R(5, 0, 1, 16, WALL_CAP[1]);
    for (let y = 1; y < 16; y += 3) p.R(6, y, 4, 1, WALL_CAP[2]);
    p.R(11, 0, 1, 16, C.wallShade);
}

/** 门楼，2×2 格：两边墙垛，上面一小截瓦檐，中间门洞敞着能看到院里。 */
export function wallGate(p: Pen): void {
    p.R(0, 28, 32, 4, C.shadow, 50);
    for (const x of [0, 26]) {
        p.R(x, 12, 6, 16, C.wall);
        p.R(x, 25, 6, 3, C.plinth);
        p.R(x + (x === 0 ? 5 : 0), 12, 1, 16, C.wallShade);
    }
    // 门框
    p.R(6, 12, 2, 16, C.woodDark);
    p.R(24, 12, 2, 16, C.woodDark);
    p.R(6, 12, 20, 2, C.woodDark);
    p.R(8, 14, 3, 14, C.wood);
    p.R(21, 14, 3, 14, C.wood);
    p.R(8, 27, 16, 1, 0x9b968b);
    tileEave(p, 1, 31, 4, 12);
    p.R(5, 2, 22, 2, 0x262a30);
    p.P(3, 1, 0x262a30);
    p.P(28, 1, 0x262a30);
    // 门楣上的小匾
    p.R(12, 7, 8, 3, 0x2b3a5a);
    p.P(14, 8, C.gold);
    p.P(17, 8, C.gold);
}

/** 戏台，6×5 格：石台基、红柱、大红幕布、翘角飞檐。 */
export function stage(p: Pen): void {
    const pw = 6 * TILE;
    p.R(4, 74, pw - 4, 6, C.shadow, 56);
    // 台基：石块砌的正面
    p.R(2, 58, pw - 4, 16, C.plinth);
    for (let y = 58; y < 74; y += 5) p.R(2, y, pw - 4, 1, C.plinthJoint);
    for (let y = 58, row = 0; y < 74; y += 5, row++) {
        for (let x = 2 + (row % 2) * 6; x < pw - 2; x += 12) p.R(x, y, 1, 5, C.plinthJoint);
    }
    p.R(2, 56, pw - 4, 3, C.woodLight);
    p.R(2, 58, pw - 4, 1, C.woodDark);
    // 幕布和台口
    p.R(8, 24, pw - 16, 32, 0x8e2621);
    for (let x = 10; x < pw - 10; x += 4) p.R(x, 26, 1, 30, 0x7a1f1b);
    p.R(8, 24, pw - 16, 6, 0xb8352e);
    for (let x = 10; x < pw - 10; x += 8) p.R(x, 29, 4, 2, C.gold);
    p.R(30, 40, 36, 14, 0x5a1a16);
    p.R(32, 42, 32, 10, 0x6b2420);
    // 红柱子
    for (const x of [4, pw - 9]) {
        p.R(x, 22, 5, 35, C.red);
        p.R(x, 22, 1, 35, C.redLight);
        p.R(x + 4, 22, 1, 35, 0x8e2621);
        p.R(x - 1, 53, 7, 3, C.stone[2]);
    }
    // 檐下挂的灯笼
    for (const x of [14, pw - 15]) {
        p.R(x, 24, 1, 3, 0x3b2a1e);
        p.E(x, 31, 3, 4, (dx) => (dx < -1 ? C.red : dx > 1 ? 0xa82724 : C.redLight));
        p.R(x - 2, 27, 5, 1, C.gold);
        p.R(x - 2, 35, 5, 1, C.gold);
    }
    // 屋顶：大檐 + 正脊 + 两端高高翘起
    tileEave(p, 2, pw - 2, 8, 23);
    p.R(0, 21, pw, 2, 0x262a30);
    p.R(10, 5, pw - 20, 4, 0x262a30);
    p.R(11, 5, pw - 22, 1, 0x4a515b);
    for (const [x, d] of [[0, 1], [pw - 1, -1]] as [number, number][]) {
        for (let j = 0; j < 6; j++) p.P(x + d * Math.floor(j / 2), 20 - j, 0x262a30);
    }
    for (const x of [8, pw - 10]) p.R(x, 1, 2, 5, 0x262a30);
    p.R(pw / 2 - 2, 2, 4, 3, C.gold);
}

/** 石牌坊，6×4 格：四根石柱、三间，中门正好让出两格宽的路（放在路左边一格），匾和三段小瓦顶。 */
export function archway(p: Pen): void {
    const pw = 6 * TILE;
    const stone = (x: number, y: number, w: number, h: number) => {
        p.R(x, y, w, h, C.stone[0]);
        p.R(x, y, 1, h, 0xd2cec4);
        p.R(x + w - 1, y, 1, h, C.stoneEdge);
    };
    // 柱子只在柱脚下有影子，中门底下留空好走人
    for (const x of [4, 26, 65, 87]) {
        p.R(x - 1, 60, 8, 3, C.shadow, 50);
        stone(x, 24, 5, 34);
        p.R(x - 1, 54, 7, 6, C.stone[1]);
        p.R(x - 1, 54, 7, 1, 0xd2cec4);
    }
    // 横梁
    stone(2, 24, pw - 4, 4);
    stone(30, 14, 36, 4);
    p.R(2, 27, pw - 4, 1, C.stoneEdge);
    // 中间的匾：深蓝底金字
    p.R(36, 15, 24, 9, 0x2b3a5a);
    p.R(37, 16, 22, 7, 0x34466b);
    for (const x of [41, 47, 53]) p.R(x, 18, 2, 3, C.gold);
    // 三段瓦顶
    tileEave(p, 26, 70, 4, 14);
    tileEave(p, 1, 36, 16, 24);
    tileEave(p, 60, 95, 16, 24);
    p.R(30, 2, 36, 2, 0x262a30);
    for (const x of [28, 67]) p.R(x, 0, 1, 4, 0x262a30);
}

/** 茶桌，2×2 格：方桌、茶壶、茶碗、两张竹凳。 */
export function teaTable(p: Pen): void {
    groundShadow(p, 17, 28, 13, 3);
    for (const x of [2, 24]) {
        p.R(x, 18, 6, 4, 0x8cbf4a);
        p.R(x, 18, 6, 1, 0xa8d46a);
        p.R(x + 1, 22, 1, 5, 0x6fa23a);
        p.R(x + 4, 22, 1, 5, 0x6fa23a);
    }
    p.R(8, 10, 16, 8, C.woodLight);
    p.R(8, 10, 16, 1, 0xa0683f);
    p.R(8, 17, 16, 2, C.woodDark);
    p.R(9, 19, 2, 9, C.woodDark);
    p.R(21, 19, 2, 9, C.woodDark);
    // 茶壶和两只碗
    p.E(15, 11, 3, 2, (dx, dy) => (dx + dy < -1 ? 0xf7f7f2 : 0x8fb7c9));
    p.P(18, 10, 0x8fb7c9);
    p.P(15, 8, 0x8fb7c9);
    p.R(10, 12, 2, 2, 0xf7f7f2);
    p.R(20, 13, 2, 2, 0xf7f7f2);
    p.P(10, 12, 0x8cbf4a);
}

/** 糖葫芦草把子，1×3 格。 */
export function tanghulu(p: Pen): void {
    groundShadow(p, 8, 46, 4, 1);
    p.R(7, 20, 2, 26, C.woodDark);
    p.E(8, 16, 6, 9, (dx, dy) => (dx + dy < -4 ? 0xe8cf86 : dx + dy > 4 ? 0xa8843f : 0xd8b45a));
    for (const [x, y] of [[2, 6], [13, 7], [3, 14], [14, 15], [5, 22], [12, 23], [8, 4]]) {
        p.R(x, y - 3, 1, 3, 0xd9b37a);
        for (let k = 0; k < 2; k++) {
            p.R(x - 1, y + k * 3, 3, 3, 0xd23a2c);
            p.P(x - 1, y + k * 3, 0xff8a70);
        }
    }
}

/** 河埠头：从岸边一级级下到水里的石阶。dir 是台阶往哪个方向下水。 */
export function waterSteps(p: Pen, dir: 'down' | 'up' | 'left' | 'right'): void {
    const tone = [C.stone[2], C.stone[0], C.plinth, 0x6f7a78];
    const put = (u: number, v: number, c: number, a = 255) => {
        // u 沿下水方向（0 在岸边），v 横向
        if (dir === 'down') p.P(v, u, c, a);
        else if (dir === 'up') p.P(v, 15 - u, c, a);
        else if (dir === 'right') p.P(u, v, c, a);
        else p.P(15 - u, v, c, a);
    };
    const len = 15;
    for (let u = 0; u < len; u++) {
        const step = Math.min(3, Math.floor(u / 4));
        for (let v = 4; v < 28; v++) put(u, v, u % 4 === 3 ? C.plinthJoint : tone[step]);
        // 两侧挡墙
        for (const v of [2, 3, 28, 29]) put(u, v, v === 2 || v === 29 ? C.plinthJoint : C.plinth);
    }
    // 最下一级泡在水里，半透明的水线
    for (let v = 4; v < 28; v++) put(len, v, C.shine, 120);
}

/** 柳树在河里的倒影，3×1 格：深绿的横向波纹，越往下越淡越窄。 */
export function willowReflection(p: Pen): void {
    // 从第 4 行开始，让开驳岸的条石
    for (let y = 4; y < 16; y++) {
        const half = 22 - y;
        const a = 120 - y * 6;
        for (let x = 24 - half; x <= 24 + half; x++) {
            if ((x + y * 3) % 7 < 5) p.P(x, y, y % 3 === 0 ? C.willow[1] : C.willow[0], a);
        }
    }
}

/** 乌篷船的倒影，4×1 格。 */
export function boatReflection(p: Pen): void {
    for (let y = 0; y < 8; y++) {
        for (let x = 8; x < 56; x++) {
            if ((x + y * 3) % 6 < 4) p.P(x, y, 0x1e2a30, 70 - y * 8);
        }
    }
}

/** 招工告示栏，3×3 格：小瓦檐、两根立柱、木板上贴着招工启事和一张红纸。镇上招工处就是它。 */
export function hireBoard(p: Pen): void {
    groundShadow(p, 24, 45, 20, 3);
    for (const x of [6, 40]) {
        p.R(x, 10, 3, 36, C.woodDark);
        p.R(x, 10, 1, 36, 0x6e4a30);
    }
    p.R(8, 14, 33, 22, C.woodLight);
    p.R(8, 14, 33, 1, 0xa0683f);
    p.R(8, 35, 33, 2, C.woodDark);
    for (let y = 18; y < 35; y += 5) p.R(9, y, 31, 1, 0x6e4329);
    // 白纸启事，上面几行字
    const notes: [number, number, number, number][] = [[11, 17, 8, 10], [21, 16, 7, 8], [30, 18, 8, 11], [12, 28, 7, 6]];
    for (const [x, y, w, h] of notes) {
        p.R(x, y, w, h, 0xf2ecd8);
        p.R(x, y + h - 1, w, 1, 0xd5ccb0);
        for (let ly = y + 2; ly < y + h - 1; ly += 2) p.R(x + 1, ly, w - 2 - ((ly * 3) % 3), 1, 0x8a8478);
    }
    // 红纸：招工
    p.R(21, 25, 8, 9, 0xc8322a);
    p.R(21, 25, 8, 1, 0xe2574a);
    p.R(23, 27, 4, 1, 0xf0c24a);
    p.R(24, 27, 1, 5, 0xf0c24a);
    p.R(23, 30, 4, 1, 0xf0c24a);
    tileEave(p, 2, 46, 4, 12);
}
