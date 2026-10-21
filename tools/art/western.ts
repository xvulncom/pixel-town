// 美国西部荒漠小镇的画法：沙地、土路、木板人行道、干河床、红岩台地崖壁、假门脸木楼、马厩、教堂、水塔、风车、
// 仙人掌、风滚草、马车、拴马桩等。尺寸照星露谷，和江南共用画布、画笔、四邻掩码，颜色另起一套荒漠色。

import { Pen, Rnd, TILE, groundShadow, pick } from './canvas';
import { E, N, S, W_ } from './terrain';

/** 荒漠调色板 */
export const WC = {
    sand: [0xe2c48e, 0xd6b47c, 0xecd3a2, 0xc9a46c],
    scrub: [0xd6b37c, 0xcca872, 0xdcbc88],
    scrubBlade: 0xa08048,
    mesa: [0xd28a5a, 0xc87e50, 0xdc9868, 0xb8703f],
    strata: [0xb4563a, 0xc66a44, 0xa04832, 0xd28455, 0x8c3e2c],
    rockCrack: 0x7a3426,
    rockRim: 0xe8a878,
    street: [0xb48a5a, 0xa98050, 0xbf9766],
    streetEdge: 0xa27a4c,
    rut: 0x94704a,
    plank: [0x9a6a3e, 0x8c5e36, 0xa6744a],
    plankGap: 0x553620,
    plankFace: 0x6e4628,
    bed: [0xcbb38a, 0xc2a87e, 0xd6c098],
    bedCrack: 0x9a8260,
    bedBank: 0xb8996a,
    pebble: [0xa89a88, 0xe8dcc4, 0x8a7c6a],
    soil: 0x8a5a3a,
    soilLight: 0x9c6a46,
    soilDark: 0x704630,
    soilEdge: 0x9a7048,
    water: [0x3f7d96, 0x4f8fa8, 0x5ea3bb],
    waterShine: 0xa8dbe8,
    mud: 0x8a6a46,
    mudWet: 0x6e5438,
    wood: 0xa8794a,
    woodMid: 0x946a40,
    woodLight: 0xbc8c58,
    woodDark: 0x6e4a2c,
    woodGrey: [0x9a8c78, 0x877a68, 0xaea08a],
    shingle: [0x6e4c36, 0x5e402e, 0x7c5840],
    tin: [0x9a968c, 0x8a867c, 0xb0aca2],
    glass: 0x2c3a44,
    glassShine: 0x8fb4c4,
    brick: [0xa4533a, 0x96482f, 0xb05e44],
    mortar: 0xc9a88a,
    cream: 0xeadfc4,
    ink: 0x3a2418,
    gold: 0xe3b341,
    cactus: [0x5f8a4a, 0x4a7436, 0x78a35a, 0x3a5e2c],
    spine: 0xf0e6b8,
    sage: [0x8a9a78, 0x9fae8a, 0x6e7e60],
    dry: [0xc8a860, 0xb08e48, 0xdcc07a],
    skin: 0xf1c9a0,
};

const darker = (c: number, k = 0.75) =>
    (Math.round(((c >> 16) & 0xff) * k) << 16) | (Math.round(((c >> 8) & 0xff) * k) << 8) | Math.round((c & 0xff) * k);
const lighter = (c: number, k = 0.25) => {
    const f = (v: number) => Math.round(v + (255 - v) * k);
    return (f((c >> 16) & 0xff) << 16) | (f((c >> 8) & 0xff) << 8) | f(c & 0xff);
};

// ---------- 招牌字：3×5 像素大写字母 ----------

const FONT: Record<string, string[]> = {
    A: ['010', '101', '111', '101', '101'], B: ['110', '101', '110', '101', '110'], C: ['011', '100', '100', '100', '011'],
    D: ['110', '101', '101', '101', '110'], E: ['111', '100', '110', '100', '111'], F: ['111', '100', '110', '100', '100'],
    G: ['011', '100', '101', '101', '011'], H: ['101', '101', '111', '101', '101'], I: ['111', '010', '010', '010', '111'],
    J: ['001', '001', '001', '101', '010'], K: ['101', '101', '110', '101', '101'], L: ['100', '100', '100', '100', '111'],
    M: ['101', '111', '111', '101', '101'], N: ['110', '101', '101', '101', '101'], O: ['010', '101', '101', '101', '010'],
    P: ['110', '101', '110', '100', '100'], R: ['110', '101', '110', '101', '101'], S: ['011', '100', '010', '001', '110'],
    T: ['111', '010', '010', '010', '010'], U: ['101', '101', '101', '101', '111'], V: ['101', '101', '101', '101', '010'],
    W: ['101', '101', '111', '111', '101'], X: ['101', '101', '010', '101', '101'], Y: ['101', '101', '010', '010', '010'],
    ' ': ['000', '000', '000', '000', '000'],
};

export function textWidth(s: string): number {
    return s.length * 4 - 1;
}

/** 写一行招牌字，(x, y) 是左上角。 */
export function text(p: Pen, s: string, x: number, y: number, col: number): void {
    [...s].forEach((ch, i) => {
        const g = FONT[ch];
        if (!g) throw new Error(`招牌字缺字形：${ch}`);
        g.forEach((row, dy) => [...row].forEach((b, dx) => { if (b === '1') p.P(x + i * 4 + dx, y + dy, col); }));
    });
}

/** 招牌：一块带边框的木牌，字居中，多行用 \n 分开。返回牌子底边 y。 */
function signBoard(p: Pen, cx: number, y: number, s: string, bg = WC.cream, ink = WC.ink, frame = WC.woodDark): number {
    const lines = s.split('\n');
    const w = Math.max(...lines.map(textWidth)) + 8;
    const h = lines.length * 7 + 4;
    const x = Math.round(cx - w / 2);
    p.R(x - 1, y - 1, w + 2, h + 2, frame);
    p.R(x, y, w, h, bg);
    p.R(x, y + h - 1, w, 1, darker(bg, 0.88));
    lines.forEach((ln, i) => text(p, ln, Math.round(cx - textWidth(ln) / 2), y + 3 + i * 7, ink));
    return y + h + 1;
}

// ---------- 地面 ----------

/** 沙地底色：一个主色，撒风吹出的细纹、亮砂和暗砂。 */
export function sandFill(p: Pen, pal: readonly number[] = WC.sand): void {
    p.R(0, 0, TILE, TILE, pal[0]);
    for (let i = 0; i < 6; i++) p.R(Math.floor(p.r() * TILE), Math.floor(p.r() * TILE), 2 + Math.floor(p.r() * 2), 1, pal[1]);
    for (let i = 0; i < 8; i++) p.P(Math.floor(p.r() * TILE), Math.floor(p.r() * TILE), pal[2]);
    for (let i = 0; i < 3; i++) p.P(Math.floor(p.r() * TILE), Math.floor(p.r() * TILE), pal[3]);
}

function pebble(p: Pen, x: number, y: number): void {
    p.R(x, y, 2, 1, WC.pebble[0]);
    p.P(x, y, WC.pebble[1]);
    p.R(x, y + 1, 2, 1, WC.pebble[2]);
}

/** 沙地的几种：素的、带小石子、带风纹、带一撮干草。 */
export function sandTile(p: Pen, kind: 'plain' | 'plain2' | 'pebbles' | 'ripple' | 'tuft'): void {
    sandFill(p);
    if (kind === 'pebbles') for (let i = 0; i < 3; i++) pebble(p, 1 + Math.floor(p.r() * 13), 1 + Math.floor(p.r() * 13));
    if (kind === 'ripple') {
        for (const y0 of [4, 10]) {
            const off = Math.floor(p.r() * 6);
            for (let x = 0; x < TILE; x++) {
                const y = y0 + Math.round(Math.sin((x + off) / 2.5));
                p.P(x, y, WC.sand[1]);
                p.P(x, y - 1, WC.sand[2]);
            }
        }
    }
    if (kind === 'tuft') {
        const x = 3 + Math.floor(p.r() * 9);
        const y = 12 + Math.floor(p.r() * 3);
        for (const [dx, h] of [[0, 3], [1, 4], [2, 3], [3, 2]]) for (let j = 0; j < h; j++) p.P(x + dx + (j > 2 ? (dx < 2 ? -1 : 1) : 0), y - j, j > 1 ? WC.dry[2] : WC.dry[1]);
    }
}

/** 地形图块（荒漠版）：开口的一侧露出沙地。paint 拿到离沙地的距离 k（0 是最外一圈）。 */
export function desertTile(p: Pen, mask: number, margin: number, jagMax: number, paint: (x: number, y: number, k: number) => number,
    under: (p: Pen) => void = (q) => sandFill(q)): void {
    under(p);
    const jag = () => Array.from({ length: TILE }, () => Math.floor(p.r() * (jagMax + 1)));
    const jn = jag();
    const js = jag();
    const je = jag();
    const jw = jag();
    for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
            let k = 99;
            if (!(mask & N)) k = Math.min(k, y - margin - jn[x]);
            if (!(mask & S)) k = Math.min(k, TILE - 1 - y - margin - js[x]);
            if (!(mask & W_)) k = Math.min(k, x - margin - jw[y]);
            if (!(mask & E)) k = Math.min(k, TILE - 1 - x - margin - je[y]);
            if (k >= 0) p.P(x, y, paint(x, y, k));
        }
    }
}

/** 暗沙地（成片的硬地皮，长干草）：给大片沙地分出深浅。 */
export function scrubPaint(r: Rnd) {
    const blades = Array.from({ length: TILE * TILE }, () => r() < 0.06);
    return (x: number, y: number, k: number) => {
        // 靠边几圈和沙地点状掺开，不留直边
        if (k < 4 && r() < (4 - k) / 5) return WC.sand[r() < 0.7 ? 0 : 1];
        if (blades[y * TILE + x]) return WC.scrubBlade;
        return pick(r, WC.scrub, [0.7, 0.2, 0.1]);
    };
}

/** 土路：压实的深色土，偶尔有车辙和马蹄印。 */
export function streetPaint(r: Rnd) {
    const ruts = [4 + Math.floor(r() * 2), 11 + Math.floor(r() * 2)];
    return (x: number, y: number, k: number) => {
        if (k === 0) return WC.streetEdge;
        if (ruts.includes(x) && r() < 0.5) return WC.rut;
        if (r() < 0.03) return darker(WC.street[0], 0.85);
        return pick(r, WC.street, [0.6, 0.25, 0.15]);
    };
}

/** 木板人行道：横铺木板，每块错缝，临沙地那边露出一道板子侧面。 */
export function boardPaint(r: Rnd) {
    const seams = [0, 1, 2, 3].map(() => Math.floor(r() * 14) + 1);
    const tone = [0, 1, 2, 3].map(() => WC.plank[Math.floor(r() * 3)]);
    const knots = Array.from({ length: TILE * TILE }, () => r() < 0.02);
    return (x: number, y: number, k: number) => {
        if (k === 0) return WC.plankFace;
        if (k === 1) return WC.plankGap;
        const row = Math.floor(y / 4);
        if (y % 4 === 3) return WC.plankGap;
        if (x === seams[row]) return WC.plankGap;
        if (y % 4 === 0) return lighter(tone[row], 0.15);
        if (knots[y * TILE + x]) return WC.woodDark;
        return tone[row];
    };
}

/** 干河床：龟裂的泥底，零星卵石，两岸一道斜坡。 */
export function bedPaint(r: Rnd) {
    const crack = new Set<number>();
    for (let c = 0; c < 4; c++) {
        let x = Math.floor(r() * TILE);
        let y = Math.floor(r() * TILE);
        for (let s = 0; s < 9; s++) {
            crack.add(y * TILE + x);
            if (r() < 0.5) x = (x + (r() < 0.5 ? 1 : -1) + TILE) % TILE;
            else y = (y + (r() < 0.5 ? 1 : -1) + TILE) % TILE;
        }
    }
    const pebbles = Array.from({ length: TILE * TILE }, () => r() < 0.025);
    return (x: number, y: number, k: number) => {
        if (k === 0) return WC.bedBank;
        if (k === 1) return darker(WC.bedBank, 0.9);
        if (pebbles[y * TILE + x]) return WC.pebble[Math.floor(r() * 3)];
        if (crack.has(y * TILE + x)) return WC.bedCrack;
        return pick(r, WC.bed, [0.6, 0.25, 0.15]);
    };
}

/** 荒漠里的田：偏红的土垄。 */
export function fieldPaint(r: Rnd) {
    return (_x: number, y: number, k: number) => {
        if (k === 0) return WC.soilEdge;
        const m = y % 4;
        if (m === 0) return WC.soilLight;
        if (m === 3) return WC.soilDark;
        return r() < 0.1 ? WC.soilDark : WC.soil;
    };
}

/** 饮马塘：一圈湿泥岸，水面波光随 frame 往右挪，4 帧一圈。 */
export function pondPaint(frame: number) {
    return (x: number, y: number, k: number) => {
        if (k === 0) return WC.mud;
        if (k === 1) return WC.mudWet;
        if (k < 3) return WC.water[0];
        const dx = (x - frame * 4 + TILE * 2) % TILE;
        if ((y === 5 && (dx === 2 || dx === 6)) || (y === 6 && dx >= 3 && dx <= 5)) return WC.waterShine;
        if ((y === 11 && (dx === 10 || dx === 14)) || (y === 12 && dx >= 11 && dx <= 13)) return WC.waterShine;
        if (y === 9 + Math.round(Math.sin(((x + frame * 4) / TILE) * Math.PI * 2))) return WC.water[0];
        return k < 5 ? WC.water[1] : WC.water[2];
    };
}

/** 台地顶上：红砂岩地面，颜色素一点，偶尔一道裂纹或几粒碎石。 */
export function mesaTop(p: Pen): void {
    p.R(0, 0, TILE, TILE, WC.mesa[0]);
    for (let i = 0; i < 5; i++) p.P(Math.floor(p.r() * TILE), Math.floor(p.r() * TILE), WC.mesa[2]);
    for (let i = 0; i < 4; i++) p.P(Math.floor(p.r() * TILE), Math.floor(p.r() * TILE), WC.mesa[1]);
    if (p.r() < 0.3) {
        let x = Math.floor(p.r() * 10);
        const y = 2 + Math.floor(p.r() * 12);
        for (let s2 = 0; s2 < 5; s2++) p.P(x++, y + (s2 % 3 === 2 ? 1 : 0), WC.mesa[3]);
    }
    if (p.r() < 0.35) {
        const x = 2 + Math.floor(p.r() * 11);
        const y = 2 + Math.floor(p.r() * 11);
        p.P(x, y, WC.strata[3]);
        p.P(x, y + 1, WC.strata[4]);
    }
}

// ---------- 红岩崖壁 ----------

const ROW_INDEX = { top: 0, mid: 1, bot: 2, one: 0 } as const;

/** 红岩一格：横向岩层按在崖面上的行连贯，层线随列轻微起伏；几道竖向的雨蚀纹，偶尔一截亮岩棱。 */
function strata(p: Pen, row: number): void {
    const bands = [0, 1, 3, 1, 0, 2, 4, 2];
    const phase = p.r() * 6;
    for (let x = 0; x < TILE; x++) {
        const wob = Math.round(Math.sin((x + phase) / 2.6) * 1.2);
        for (let y = 0; y < TILE; y++) {
            const yy = row * TILE + y + wob;
            const band = bands[Math.floor((yy + 24) / 6) % bands.length];
            let c = WC.strata[band];
            if (p.r() < 0.07) c = darker(c, 0.92);
            p.P(x, y, c);
        }
    }
    // 竖向雨蚀纹：长长一道暗线，旁边一道亮线
    for (let i = 0; i < 3; i++) {
        const x = Math.floor(p.r() * 15);
        const y0 = Math.floor(p.r() * 6);
        const len = 6 + Math.floor(p.r() * 10);
        for (let j = 0; j < len && y0 + j < TILE; j++) {
            p.D(x, y0 + j, 1, 1, 0.8);
            if (p.r() < 0.6) p.D(x + 1, y0 + j, 1, 1, 1.08);
        }
    }
    // 一截突出的岩棱
    if (p.r() < 0.5) {
        const y = 3 + Math.floor(p.r() * 10);
        const x0 = Math.floor(p.r() * 8);
        const len = 3 + Math.floor(p.r() * 6);
        p.R(x0, y, len, 1, WC.rockRim);
        p.R(x0, y + 1, len, 1, darker(WC.strata[4], 0.8));
    }
}

/** 台地崖壁（高处往南落下来的那一面）：顶行压一道亮岩沿，底行压暗、堆点碎石；收口削掉外侧几列露出沙地。 */
export function mesaFace(p: Pen, row: 'top' | 'mid' | 'bot' | 'one', end: 'l' | 'm' | 'r'): void {
    sandFill(p);
    strata(p, ROW_INDEX[row]);
    if (row === 'top' || row === 'one') {
        for (let x = 0; x < TILE; x++) {
            const d = 2 + Math.floor(p.r() * 2);
            for (let y = 0; y < d; y++) p.P(x, y, WC.mesa[(x + y) % 3]);
            p.P(x, d, WC.rockRim);
            p.P(x, d + 1, WC.rockCrack);
        }
    }
    if (row === 'bot' || row === 'one') {
        for (let x = 0; x < TILE; x++) {
            p.P(x, TILE - 1, darker(WC.strata[4], 0.7));
            p.P(x, TILE - 2, darker(WC.strata[4], 0.82));
            if (p.r() < 0.3) p.P(x, TILE - 3, darker(WC.strata[4], 0.82));
        }
        for (let i = 0; i < 2; i++) {
            const x = Math.floor(p.r() * 13);
            p.R(x, TILE - 2, 3, 2, WC.strata[3]);
            p.R(x, TILE - 1, 3, 1, WC.strata[4]);
        }
    }
    if (end !== 'm') {
        for (let y = 0; y < TILE; y++) {
            const cut = row === 'top' || row === 'one' ? Math.max(1, 4 - Math.floor(y / 4)) : 1 + (y % 5 === 0 ? 1 : 0);
            for (let k = 0; k < cut; k++) {
                const x = end === 'l' ? k : TILE - 1 - k;
                p.P(x, y, WC.sand[(x + y) % 3]);
            }
            p.P(end === 'l' ? cut : TILE - 1 - cut, y, end === 'l' ? lighter(WC.strata[0], 0.25) : WC.rockCrack);
        }
    }
}

/** 崖壁上凿出的小路：夯土坡上一级级木桩台阶，整格铺满，两格并排也连成一条。 */
export function mesaStairs(p: Pen, row: 'top' | 'mid' | 'bot' | 'one'): void {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) p.P(x, y, pick(p.r, WC.street, [0.6, 0.25, 0.15]));
    for (let y = 3; y < TILE; y += 5) {
        p.R(0, y, TILE, 1, WC.woodDark);
        p.R(0, y - 1, TILE, 1, WC.woodLight);
        p.R(0, y + 1, TILE, 1, darker(WC.street[0], 0.85));
    }
    if (row === 'top' || row === 'one') p.R(0, 0, TILE, 1, WC.rockRim);
}

/** 台地顶上靠边（左右两侧低下去）的一格：一道亮沿和崖边阴影。 */
export function mesaSide(p: Pen, side: 'l' | 'r'): void {
    for (let y = 0; y < TILE; y++) {
        const x = side === 'l' ? 0 : TILE - 3;
        p.R(x, y, 3, 1, side === 'l' ? WC.strata[2] : WC.strata[4]);
        p.P(side === 'l' ? 3 : TILE - 4, y, WC.rockRim);
        if (y % 5 === 0) p.P(side === 'l' ? 1 : TILE - 2, y, WC.rockCrack);
    }
}

/** 台地北沿：一道暗线。 */
export function mesaTopEdge(p: Pen): void {
    for (let x = 0; x < TILE; x++) {
        p.P(x, 0, WC.rockCrack);
        p.P(x, 1, WC.rockRim);
    }
}

// ---------- 木楼的零件 ----------

/** 横木板墙：每 4px 一道板缝，零星风化斑。 */
function siding(p: Pen, x0: number, y0: number, w: number, h: number, col: number): void {
    for (let y = y0; y < y0 + h; y++) {
        const seam = (y - y0) % 4 === 3;
        for (let x = x0; x < x0 + w; x++) {
            let c = seam ? darker(col, 0.78) : (y - y0) % 4 === 0 ? lighter(col, 0.1) : col;
            if (!seam && p.r() < 0.035) c = p.r() < 0.5 ? darker(col, 0.9) : lighter(col, 0.12);
            p.P(x, y, c);
        }
    }
}

/** 砖墙：4px 一行，错缝。 */
function brickWall(p: Pen, x0: number, y0: number, w: number, h: number): void {
    for (let y = y0; y < y0 + h; y++) {
        const row = Math.floor((y - y0) / 4);
        for (let x = x0; x < x0 + w; x++) {
            const joint = (y - y0) % 4 === 3 || (x - x0 + (row % 2) * 4) % 8 === 0;
            p.P(x, y, joint ? WC.mortar : WC.brick[(row + Math.floor((x - x0) / 8)) % 3]);
        }
    }
}

/** 推拉窗：浅色窗框、十字窗棂、暗玻璃上一道反光，curtain 时上角挂帘。 */
function sash(p: Pen, x: number, y: number, w: number, h: number, frame: number, curtain?: number): void {
    p.R(x - 1, y - 1, w + 2, h + 2, frame);
    p.R(x, y, w, h, WC.glass);
    p.R(x + 1, y + 1, 1, 2, WC.glassShine);
    p.P(x + 2, y + 1, WC.glassShine);
    p.R(x, y + Math.floor(h / 2), w, 1, frame);
    p.R(x + Math.floor(w / 2), y, 1, h, frame);
    if (curtain) {
        for (let j = 0; j < Math.floor(h / 2); j++) {
            p.R(x, y + j, Math.max(1, 3 - Math.floor(j / 2)), 1, curtain);
            p.R(x + w - Math.max(1, 3 - Math.floor(j / 2)), y + j, Math.max(1, 3 - Math.floor(j / 2)), 1, curtain);
        }
    }
    p.R(x - 2, y + h + 1, w + 4, 1, darker(frame, 0.7));
}

/** 拱形窗（砖楼、教堂）。 */
function archWindow(p: Pen, x: number, y: number, w: number, h: number, frame: number): void {
    const r = Math.floor(w / 2);
    for (let yy = -1; yy <= h; yy++) {
        for (let xx = -1; xx <= w; xx++) {
            const top = yy < r;
            const inArc = !top || ((xx - (w - 1) / 2) ** 2 + (yy - r) ** 2 <= (r + 0.6) ** 2);
            const inInner = !top || ((xx - (w - 1) / 2) ** 2 + (yy - r) ** 2 <= (r - 0.4) ** 2);
            if (!inArc) continue;
            const inner = xx >= 0 && xx < w && yy >= 0 && yy < h && inInner;
            p.P(x + xx, y + yy, inner ? WC.glass : frame);
        }
    }
    p.R(x + Math.floor(w / 2), y + 1, 1, h - 1, frame);
    p.R(x, y + r + 2, w, 1, frame);
    p.P(x + 1, y + r, WC.glassShine);
}

/** 门：swing 沙龙的半截弹簧门，panel 带小窗的木门，double 对开大门。 */
function door(p: Pen, cx: number, base: number, kind: 'swing' | 'panel' | 'double', trim: number): void {
    const w = kind === 'double' ? 16 : 12;
    const h = 20;
    const x = Math.round(cx - w / 2);
    const y = base - h;
    p.R(x - 2, y - 2, w + 4, h + 2, trim);
    p.R(x, y, w, h, 0x24180f);
    if (kind === 'swing') {
        // 里面透出暖光，两扇半截门在中间
        p.R(x, y, w, 6, 0x5a3a20);
        p.R(x + 2, y + 1, 2, 3, 0xe8b860);
        for (const [dx, flip] of [[0, false], [w / 2, true]] as [number, boolean][]) {
            for (let yy = 0; yy < 9; yy++) {
                for (let xx = 0; xx < w / 2; xx++) {
                    const scallop = yy === 0 && (flip ? xx > w / 2 - 3 : xx < 2);
                    if (scallop) continue;
                    p.P(x + dx + xx, y + 6 + yy, yy % 3 === 0 ? WC.woodDark : xx === 0 || xx === w / 2 - 1 ? WC.woodMid : WC.woodLight);
                }
            }
        }
        return;
    }
    const leaves = kind === 'double' ? 2 : 1;
    const lw = w / leaves;
    for (let i = 0; i < leaves; i++) {
        const lx = x + i * lw;
        p.R(lx, y, lw, h, WC.woodMid);
        p.R(lx, y, 1, h, WC.woodDark);
        p.R(lx + 2, y + 2, lw - 4, 6, kind === 'panel' ? WC.glass : WC.woodDark);
        if (kind === 'panel') p.P(lx + 3, y + 3, WC.glassShine);
        p.R(lx + 2, y + 11, lw - 4, 6, darker(WC.woodMid, 0.85));
        p.R(lx + 2, y + 11, lw - 4, 1, WC.woodDark);
    }
    p.P(kind === 'double' ? x + w / 2 - 2 : x + w - 3, y + 11, WC.gold);
    if (kind === 'double') p.P(x + w / 2 + 1, y + 11, WC.gold);
}

/** 门廊雨棚：斜铺的木瓦或铁皮，下面几根柱子；返回雨棚底边 y。 */
function porch(p: Pen, x0: number, x1: number, y: number, base: number, roof: readonly number[]): number {
    const h = 6;
    for (let yy = 0; yy < h; yy++) {
        for (let x = x0; x < x1; x++) {
            const row = Math.floor(yy / 2);
            const seam = (x + row * 3) % 6 === 0;
            p.P(x, y + yy, yy === h - 1 ? darker(roof[0], 0.7) : seam ? roof[1] : yy % 2 === 0 ? roof[2] : roof[0]);
        }
    }
    const bottom = y + h;
    // 雨棚下的墙压暗一截
    p.D(x0, bottom, x1 - x0, 4, 0.72);
    p.D(x0, bottom + 4, x1 - x0, 3, 0.86);
    const posts = [x0 + 1, Math.round((x0 + x1) / 2) - 1, x1 - 3];
    for (const px of posts) {
        p.R(px, bottom, 2, base - bottom, WC.woodLight);
        p.R(px + 1, bottom, 1, base - bottom, WC.woodDark);
    }
    return bottom;
}

/** 门廊下的小货：木桶、麻袋，画在最下一行。 */
function porchGoods(p: Pen, x: number, base: number): void {
    barrelAt(p, x, base - 11, 9, 11);
    p.R(x + 10, base - 7, 7, 7, 0xd8c8a0);
    p.R(x + 10, base - 7, 7, 1, 0xeadcb4);
    p.R(x + 12, base - 8, 3, 1, 0xb8a47a);
}

function barrelAt(p: Pen, x: number, y: number, w: number, h: number): void {
    for (let yy = 0; yy < h; yy++) {
        const bulge = yy > 1 && yy < h - 2 ? 0 : 1;
        for (let xx = bulge; xx < w - bulge; xx++) {
            let c = xx % 3 === 0 ? WC.woodMid : WC.wood;
            if (xx === w - 1 - bulge || xx === w - 2 - bulge) c = WC.woodDark;
            if (xx === bulge + 1) c = WC.woodLight;
            p.P(x + xx, y + yy, c);
        }
    }
    for (const yy of [2, h - 3]) p.R(x + 1, y + yy, w - 2, 1, 0x4a4440);
    p.R(x + 1, y, w - 2, 1, WC.woodDark);
}

/** 木楼的屋顶（假门脸后面露出来的那一截），俯视看到一行行木瓦或铁皮。 */
function backRoof(p: Pen, x0: number, x1: number, y0: number, y1: number, roof: readonly number[]): void {
    for (let y = y0; y < y1; y++) {
        const inset = Math.max(0, 2 - (y - y0));
        for (let x = x0 + inset; x < x1 - inset; x++) {
            const row = Math.floor((y - y0) / 3);
            const seam = (y - y0) % 3 === 2 || (x + row * 4) % 8 === 0;
            p.P(x, y, y === y0 ? lighter(roof[2], 0.2) : seam ? roof[1] : roof[(row % 2) * 2]);
        }
    }
}

/** 星形警徽（5×5）。 */
function star(p: Pen, cx: number, cy: number, col: number): void {
    p.P(cx, cy - 2, col);
    p.R(cx - 2, cy - 1, 5, 1, col);
    p.R(cx - 1, cy, 3, 1, col);
    p.P(cx - 1, cy + 1, col);
    p.P(cx + 1, cy + 1, col);
    p.P(cx - 2, cy + 2, col);
    p.P(cx + 2, cy + 2, col);
    p.P(cx, cy, lighter(col, 0.5));
}

export interface FrontOpts {
    /** 墙板颜色 */
    siding: number;
    /** 角板、檐口、窗框颜色 */
    trim: number;
    /** 招牌字，多行用 \n */
    sign: string;
    signBg?: number;
    signInk?: number;
    floors?: 1 | 2;
    door?: 'swing' | 'panel' | 'double';
    /** 门廊雨棚，默认有 */
    porch?: boolean;
    /** 二楼阳台栏杆（两层楼才有） */
    balcony?: boolean;
    /** 砖墙门脸（银行） */
    brick?: boolean;
    /** 假门脸顶的样子：平的、两级台阶、圆拱 */
    parapet?: 'flat' | 'step' | 'arch';
    /** 一楼两边的窗：大橱窗或普通窗，jail 一边是铁栏窗 */
    windows?: 'shop' | 'plain' | 'jail';
    curtain?: number;
    /** 门廊下堆点货 */
    goods?: boolean;
    /** 门上挂警徽 */
    badge?: boolean;
    /** 门边红白条纹的理发柱 */
    pole?: boolean;
    roof?: readonly number[];
}

/**
 * 假门脸木楼：正面一堵高出屋顶的平墙挂招牌，两肩露出后面的坡屋顶；一楼门廊雨棚盖住木板人行道。
 * 两层楼的二楼一排窗，可带阳台栏杆。最下一行是门和柱脚（挡路），上面几行盖在人物头上。
 */
export function falseFront(p: Pen, w: number, h: number, o: FrontOpts): void {
    const pw = w * TILE;
    const ph = h * TILE;
    const base = ph - 2;
    const two = o.floors === 2;
    const roof = o.roof ?? WC.shingle;
    p.R(6, base, pw - 4, 2, 0x000000, 56);
    p.R(pw - 2, Math.round(ph * 0.3), 2, base - Math.round(ph * 0.3), 0x000000, 40);

    const parTop = 3;
    const roofTop = Math.round(ph * 0.12);
    const roofBot = Math.round(ph * 0.3);
    const shoulder = Math.round(pw * (o.parapet === 'step' ? 0.1 : 0.15));
    backRoof(p, 3, pw - 3, roofTop, roofBot + 1, roof);

    // 门脸：肩部从 roofBot 起，中间一截一直高到 parTop
    const fx0 = 1;
    const fx1 = pw - 1;
    const wall = (x: number, y: number, ww: number, hh: number) => (o.brick ? brickWall(p, x, y, ww, hh) : siding(p, x, y, ww, hh, o.siding));
    wall(fx0, roofBot, fx1 - fx0, base - roofBot);
    const cx0 = fx0 + shoulder;
    const cx1 = fx1 - shoulder;
    if (o.parapet === 'arch') {
        const r = Math.round((cx1 - cx0) / 2);
        const ccx = (cx0 + cx1) / 2;
        const archBase = parTop + r * 0.5;
        for (let y = parTop; y < roofBot; y++) {
            for (let x = cx0; x < cx1; x++) {
                const dy = (archBase - y) / 0.5;
                if (y < archBase && (x - ccx) ** 2 + dy ** 2 > r * r) continue;
                p.P(x, y, o.brick ? WC.brick[(Math.floor(y / 4) + Math.floor(x / 8)) % 3] : o.siding);
            }
        }
        if (o.brick) brickWall(p, cx0, Math.round(archBase), cx1 - cx0, roofBot - Math.round(archBase));
        for (let x = cx0; x < cx1; x++) {
            let top = parTop;
            while (top < roofBot && (x - ccx) ** 2 + ((archBase - top) / 0.5) ** 2 > r * r && top < archBase) top++;
            p.R(x, top, 1, 2, o.trim);
        }
    } else {
        wall(cx0, parTop, cx1 - cx0, roofBot - parTop);
        if (o.parapet === 'step') {
            const sx0 = cx0 - shoulder / 2;
            const sx1 = cx1 + shoulder / 2;
            const sy = parTop + Math.round((roofBot - parTop) * 0.45);
            wall(Math.round(sx0), sy, Math.round(cx0 - sx0), roofBot - sy);
            wall(cx1, sy, Math.round(sx1 - cx1), roofBot - sy);
            p.R(Math.round(sx0) - 1, sy - 2, Math.round(cx0 - sx0) + 1, 2, o.trim);
            p.R(cx1, sy - 2, Math.round(sx1 - cx1) + 1, 2, o.trim);
        }
        // 檐口：一道宽线条，下面一排小托架
        p.R(cx0 - 1, parTop - 1, cx1 - cx0 + 2, 3, o.trim);
        p.R(cx0 - 1, parTop + 2, cx1 - cx0 + 2, 1, darker(o.trim, 0.7));
        for (let x = cx0 + 2; x < cx1 - 1; x += 5) p.R(x, parTop + 3, 2, 2, o.trim);
    }
    // 肩部檐口
    p.R(fx0 - 1, roofBot - 1, cx0 - fx0 + 1, 2, o.trim);
    p.R(cx1, roofBot - 1, fx1 - cx1 + 1, 2, o.trim);
    // 角板和右侧阴影
    p.R(fx0, roofBot, 2, base - roofBot, o.trim);
    p.R(fx1 - 2, roofBot, 2, base - roofBot, o.trim);
    p.D(fx1 - 5, roofBot + 1, 3, base - roofBot - 1, 0.86);

    const signY = parTop + 6;
    const signBottom = signBoard(p, pw / 2, signY, o.sign, o.signBg, o.signInk);

    const hasPorch = o.porch !== false;
    const awY = base - 28;
    if (two) {
        const wy = Math.max(signBottom + 4, roofBot + 4);
        const ww = 8;
        const n = Math.max(2, Math.floor((pw - 16) / 22));
        for (let i = 0; i < n; i++) {
            const wx = Math.round(10 + ((pw - 20 - ww) * i) / (n - 1));
            sash(p, wx, wy, ww, Math.min(12, awY - wy - 4), o.trim, o.curtain);
        }
    }
    let under = roofBot;
    if (hasPorch) {
        under = porch(p, 0, pw, awY, base, o.brick ? WC.tin : roof);
        if (two && o.balcony) {
            // 阳台栏杆立在雨棚上
            const ry = awY - 6;
            p.R(1, ry, pw - 2, 1, WC.woodLight);
            p.R(1, ry + 1, pw - 2, 1, WC.woodDark);
            for (let x = 2; x < pw - 2; x += 3) p.R(x, ry + 2, 1, 4, WC.woodLight);
        }
    }
    // 一楼：门、两边窗
    const doorKind = o.door ?? 'panel';
    door(p, pw / 2, base, doorKind, o.trim);
    const winY = Math.max(under + 6, base - 20);
    const winH = base - 6 - winY;
    const leftX = 7;
    const rightX = pw / 2 + 12;
    const span = pw / 2 - 12 - leftX - 2;
    if (o.windows === 'shop') {
        sash(p, leftX, winY, span, winH, o.trim);
        sash(p, rightX, winY, span, winH, o.trim);
        // 橱窗里摆的罐子、布匹
        for (const wx of [leftX + 2, rightX + 2]) {
            p.R(wx, winY + winH - 4, 3, 4, 0xc9302c);
            p.R(wx + 4, winY + winH - 5, 3, 5, 0x3d6fb0);
            p.R(wx + 8, winY + winH - 3, 3, 3, WC.gold);
        }
    } else {
        const ww = 9;
        sash(p, leftX + Math.floor((span - ww) / 2), winY, ww, winH, o.trim, o.curtain);
        if (o.windows === 'jail') {
            const jx = rightX + Math.floor((span - ww) / 2);
            p.R(jx - 1, winY - 1, ww + 2, winH + 2, 0x4a4440);
            p.R(jx, winY, ww, winH, 0x1a1410);
            for (let x = jx + 1; x < jx + ww; x += 2) p.R(x, winY, 1, winH, 0x8a8680);
        } else {
            sash(p, rightX + Math.floor((span - ww) / 2), winY, ww, winH, o.trim, o.curtain);
        }
    }
    if (o.badge) star(p, pw / 2, base - 25, WC.gold);
    if (o.goods) porchGoods(p, 4, base);
    if (o.pole) {
        const px = pw - 9;
        for (let y = base - 18; y < base; y++) p.R(px, y, 3, 1, (y + Math.floor(y / 2)) % 4 < 2 ? 0xc9302c : 0xf1eee4);
        p.R(px - 1, base - 20, 5, 2, WC.gold);
    }
    // 门前一级台阶贴着木板路
    p.R(pw / 2 - 9, base - 1, 18, 1, WC.plankFace);
}

// ---------- 大建筑 ----------

/** 马厩：正面山墙，大对开门打 X 撑，山墙上开草料门，挂牌子。 */
export function barn(p: Pen, w: number, h: number, col: number, sign?: string): void {
    const pw = w * TILE;
    const ph = h * TILE;
    const base = ph - 2;
    const wallTop = Math.round(ph * 0.42);
    p.R(6, base, pw - 4, 2, 0x000000, 56);
    // 山墙：三角从 peak 到 wallTop，下接直墙
    const peak = 4;
    const cx = pw / 2;
    for (let y = peak; y < base; y++) {
        const half = y < wallTop ? ((y - peak) / (wallTop - peak)) * (pw / 2 - 1) : pw / 2 - 1;
        for (let x = Math.ceil(cx - half); x < cx + half; x++) {
            const board = Math.floor(x / 4) % 2 === 0;
            let c = x % 4 === 0 ? darker(col, 0.75) : board ? col : darker(col, 0.92);
            if (p.r() < 0.03) c = lighter(col, 0.12);
            p.P(x, y, c);
        }
    }
    // 屋檐：沿两条斜边压一道木瓦
    for (let y = peak - 2; y < wallTop + 3; y++) {
        const half = ((y - peak) / (wallTop - peak)) * (pw / 2 - 1);
        for (let k = -2; k < 3; k++) {
            p.P(Math.round(cx - half) + k - 1, y, k < 0 ? WC.shingle[1] : WC.shingle[0]);
            p.P(Math.round(cx + half) - k, y, k < 0 ? WC.shingle[1] : WC.shingle[0]);
        }
    }
    p.R(0, wallTop + 2, 3, 2, WC.shingle[1]);
    p.R(pw - 3, wallTop + 2, 3, 2, WC.shingle[1]);
    // 白边
    p.R(1, wallTop + 3, 2, base - wallTop - 3, WC.cream);
    p.R(pw - 3, wallTop + 3, 2, base - wallTop - 3, WC.cream);
    // 草料门 + 吊梁
    const lw = 16;
    const ly = peak + Math.round((wallTop - peak) * 0.45);
    p.R(cx - lw / 2 - 1, ly - 1, lw + 2, 15, WC.cream);
    p.R(cx - lw / 2, ly, lw, 13, 0x2a1c12);
    for (let i = 0; i < 18; i++) p.P(cx - lw / 2 + Math.floor(p.r() * lw), ly + 6 + Math.floor(p.r() * 7), WC.dry[Math.floor(p.r() * 3)]);
    p.R(cx - lw / 2, ly + 10, lw, 3, WC.dry[0]);
    p.R(cx - 1, ly - 5, 2, 4, WC.woodDark);
    p.R(cx - 3, ly - 6, 6, 2, WC.woodDark);
    if (sign) signBoard(p, cx, wallTop + 4, sign);
    // 大门：两扇，白框 X 撑
    const dw = 34;
    const dh = 30;
    const dx = Math.round(cx - dw / 2);
    const dy = base - dh;
    p.R(dx - 2, dy - 2, dw + 4, dh + 2, WC.cream);
    for (const lx of [dx, dx + dw / 2]) {
        p.R(lx, dy, dw / 2, dh, darker(col, 0.85));
        for (let k = 0; k < dh; k++) {
            const t = k / dh;
            p.R(Math.round(lx + t * (dw / 2 - 2)), dy + k, 2, 1, WC.cream);
            p.R(Math.round(lx + (1 - t) * (dw / 2 - 2)), dy + k, 2, 1, WC.cream);
        }
        p.R(lx, dy, 1, dh, WC.cream);
    }
    // 两侧小窗
    for (const wx of [8, pw - 18]) sash(p, wx, base - 24, 10, 10, WC.cream);
    p.D(pw - 6, wallTop + 4, 3, base - wallTop - 4, 0.86);
}

/** 铁匠铺：铁皮斜顶棚架，前面敞开；里面炉子发红光、铁砧、墙上挂马掌和钳子。 */
export function smithy(p: Pen, w: number, h: number): void {
    const pw = w * TILE;
    const ph = h * TILE;
    const base = ph - 2;
    p.R(4, base, pw - 2, 2, 0x000000, 56);
    // 后墙（暗木板）
    siding(p, 2, 16, pw - 4, base - 16, WC.woodGrey[1]);
    p.D(2, 16, pw - 4, base - 16, 0.6);
    // 铁皮棚顶：斜着往前伸
    for (let y = 4; y < 18; y++) {
        for (let x = 0; x < pw; x++) {
            const rib = x % 5 === 0;
            p.P(x, y, y === 17 ? darker(WC.tin[1], 0.7) : rib ? WC.tin[2] : y < 6 ? WC.tin[2] : WC.tin[(Math.floor(x / 5) + y) % 2]);
            if (p.r() < 0.02) p.P(x, y, 0xa0583a);
        }
    }
    signBoard(p, pw / 2, 0, 'BLACKSMITH', WC.ink, WC.cream, WC.woodDark);
    // 柱子
    for (const px of [2, pw - 5]) {
        p.R(px, 18, 3, base - 18, WC.woodLight);
        p.R(px + 2, 18, 1, base - 18, WC.woodDark);
    }
    // 炉子：石头砌的，口里红光
    const fx = 10;
    const fy = base - 26;
    for (let y = fy; y < base; y++) for (let x = fx; x < fx + 26; x++) p.P(x, y, ((x + Math.floor(y / 4) * 3) % 7 === 0 || y % 4 === 0) ? 0x5a5450 : 0x8a847c);
    p.R(fx + 6, fy + 8, 14, 8, 0x2a1810);
    p.R(fx + 8, fy + 10, 10, 5, 0xd8481e);
    p.R(fx + 10, fy + 11, 6, 3, 0xf8b040);
    p.R(fx + 12, fy + 12, 2, 1, 0xfff0a0);
    // 炉子上的烟囱
    p.R(fx + 10, 18, 6, fy - 18, 0x4a4440);
    // 铁砧放在树桩上
    const ax = pw - 44;
    p.R(ax + 4, base - 8, 10, 8, WC.woodMid);
    p.R(ax + 4, base - 8, 10, 1, WC.woodLight);
    p.R(ax, base - 13, 18, 3, 0x3a3a40);
    p.R(ax - 3, base - 13, 4, 2, 0x3a3a40);
    p.R(ax + 4, base - 10, 10, 2, 0x2a2a30);
    p.R(ax, base - 13, 18, 1, 0x7a7a84);
    // 墙上挂的马掌、钳子、锤子
    for (let i = 0; i < 4; i++) {
        const hx = pw - 52 + i * 9;
        p.R(hx, 24, 1, 2, 0x2a2a30);
        p.R(hx - 2, 26, 1, 4, 0x6a6a74);
        p.R(hx + 2, 26, 1, 4, 0x6a6a74);
        p.R(hx - 1, 30, 3, 1, 0x6a6a74);
    }
    p.R(pw - 16, 22, 1, 12, 0x5a3a24);
    p.R(pw - 18, 22, 5, 3, 0x5a5a64);
    // 水桶
    barrelAt(p, pw - 22, base - 9, 8, 9);
    p.R(pw - 21, base - 9, 6, 1, WC.water[1]);
}

/** 木板小教堂：白墙山墙，正中钟楼尖顶十字架，圆窗，拱门，台阶。 */
export function chapel(p: Pen, w: number, h: number): void {
    const pw = w * TILE;
    const ph = h * TILE;
    const base = ph - 2;
    const white = 0xeee8da;
    const cx = pw / 2;
    p.R(6, base, pw - 4, 2, 0x000000, 56);
    const wallTop = Math.round(ph * 0.55);
    const gableTop = Math.round(ph * 0.36);
    // 墙和山墙
    for (let y = gableTop; y < base; y++) {
        const half = y < wallTop ? ((y - gableTop) / (wallTop - gableTop)) * (pw / 2 - 3) + 2 : pw / 2 - 1;
        for (let x = Math.ceil(cx - half); x < cx + half; x++) p.P(x, y, (y - gableTop) % 4 === 3 ? 0xd4ccbc : white);
    }
    for (let y = gableTop - 1; y < wallTop + 2; y++) {
        const half = ((y - gableTop) / (wallTop - gableTop)) * (pw / 2 - 3) + 2;
        for (let k = 0; k < 3; k++) {
            p.P(Math.round(cx - half) - k, y, WC.shingle[k % 2]);
            p.P(Math.round(cx + half) + k - 1, y, WC.shingle[k % 2]);
        }
    }
    p.D(pw - 5, wallTop, 3, base - wallTop, 0.88);
    // 钟楼
    const tw = 22;
    const tx = Math.round(cx - tw / 2);
    const tTop = Math.round(ph * 0.17);
    for (let y = tTop; y < gableTop + 8; y++) for (let x = tx; x < tx + tw; x++) p.P(x, y, (y - tTop) % 4 === 3 ? 0xd4ccbc : white);
    p.R(tx + 5, tTop + 4, tw - 10, 10, 0x2a221c);
    p.R(tx + 5, tTop + 4, tw - 10, 2, WC.woodDark);
    // 钟
    p.R(cx - 3, tTop + 8, 6, 5, WC.gold);
    p.R(cx - 4, tTop + 12, 8, 1, darker(WC.gold, 0.8));
    p.R(tx - 1, tTop - 1, tw + 2, 2, WC.shingle[1]);
    // 尖顶
    const spireTop = 8;
    for (let y = spireTop; y < tTop - 1; y++) {
        const half = ((y - spireTop) / (tTop - 1 - spireTop)) * (tw / 2 + 1);
        for (let x = Math.ceil(cx - half); x < cx + half; x++) p.P(x, y, x < cx ? WC.shingle[0] : WC.shingle[1]);
    }
    p.R(cx - 1, 0, 2, 9, WC.gold);
    p.R(cx - 3, 2, 6, 2, WC.gold);
    // 圆窗
    p.E(cx, gableTop + 16, 4, 4, (dx, dy) => (dx * dx + dy * dy > 9 ? WC.woodDark : (dx === 0 || dy === 0) ? WC.woodDark : 0x6fa0c8));
    // 长拱窗
    for (const wx of [10, pw - 18]) archWindow(p, wx, wallTop + 6, 8, 20, WC.woodDark);
    // 拱门 + 台阶
    const dw = 16;
    archWindow(p, cx - dw / 2, base - 26, dw, 22, WC.woodDark);
    p.R(cx - dw / 2, base - 18, dw, 14, WC.woodMid);
    p.R(cx - 1, base - 18, 2, 14, WC.woodDark);
    p.R(cx - 14, base - 4, 28, 2, 0xb4ab9a);
    p.R(cx - 12, base - 2, 24, 2, 0xc8bfae);
}

/** 水塔：木桶水箱箍着铁圈，尖顶，四条腿交叉撑，一侧梯子。 */
export function waterTower(p: Pen, w: number, h: number): void {
    const pw = w * TILE;
    const ph = h * TILE;
    const base = ph - 2;
    groundShadow(p, pw / 2 + 2, base - 1, pw / 2 - 2, 3, 56);
    const tankTop = 20;
    const tankBot = Math.round(ph * 0.55);
    const legTop = tankBot;
    // 腿和斜撑
    for (const lx of [4, pw - 7]) p.R(lx, legTop, 3, base - legTop, WC.woodMid);
    for (const lx of [14, pw - 17]) p.R(lx, legTop, 2, base - legTop, WC.woodDark);
    const mid = Math.round((legTop + base) / 2);
    for (const [y0, y1] of [[legTop, mid], [mid, base - 2]]) {
        for (let y = y0; y < y1; y++) {
            const t = (y - y0) / (y1 - y0);
            p.P(Math.round(6 + t * (pw - 14)), y, WC.woodDark);
            p.P(Math.round(pw - 8 - t * (pw - 14)), y, WC.woodDark);
        }
        p.R(4, y1, pw - 8, 1, WC.woodDark);
    }
    // 梯子
    for (let y = tankTop + 4; y < base; y++) {
        p.P(pw - 4, y, 0x4a4440);
        p.P(pw - 1, y, 0x4a4440);
        if (y % 3 === 0) p.R(pw - 4, y, 4, 1, 0x4a4440);
    }
    // 水箱
    for (let y = tankTop; y < tankBot; y++) {
        for (let x = 3; x < pw - 3; x++) {
            let c = (x - 3) % 4 === 0 ? WC.woodMid : WC.wood;
            if (x < 6) c = WC.woodLight;
            if (x > pw - 8) c = WC.woodDark;
            p.P(x, y, c);
        }
    }
    for (const y of [tankTop + 3, Math.round((tankTop + tankBot) / 2), tankBot - 3]) p.R(2, y, pw - 4, 1, 0x3a3634);
    p.R(3, tankBot - 1, pw - 6, 2, WC.woodDark);
    // 尖顶
    for (let y = 4; y < tankTop; y++) {
        const half = ((y - 4) / (tankTop - 4)) * (pw / 2 - 1);
        for (let x = Math.ceil(pw / 2 - half); x < pw / 2 + half; x++) p.P(x, y, x < pw / 2 ? WC.shingle[2] : WC.shingle[0]);
    }
    p.R(pw / 2 - 1, 1, 2, 4, 0x4a4440);
    // 出水管
    p.R(10, tankBot, 2, 8, 0x4a4440);
    p.R(10, tankBot + 8, 6, 2, 0x4a4440);
}

/** 风车水泵：格子铁架塔，顶上一圈扇叶和尾舵，中间抽水杆。 */
export function windmill(p: Pen, w: number, h: number): void {
    const pw = w * TILE;
    const ph = h * TILE;
    const base = ph - 2;
    const iron = 0x6a6660;
    const ironL = 0x8a8680;
    groundShadow(p, pw / 2 + 2, base - 1, pw / 2 - 4, 3, 56);
    const top = 34;
    const cx = pw / 2;
    for (let y = top; y < base; y++) {
        const t = (y - top) / (base - top);
        const half = 4 + t * (pw / 2 - 6);
        p.P(Math.round(cx - half), y, iron);
        p.P(Math.round(cx + half), y, iron);
        p.P(Math.round(cx - half) + 1, y, ironL);
    }
    // 交叉斜撑
    const levels = [top, top + 18, top + 38, base - 2];
    for (let i = 0; i + 1 < levels.length; i++) {
        const y0 = levels[i];
        const y1 = levels[i + 1];
        const h0 = 4 + ((y0 - top) / (base - top)) * (pw / 2 - 6);
        const h1 = 4 + ((y1 - top) / (base - top)) * (pw / 2 - 6);
        for (let y = y0; y < y1; y++) {
            const t = (y - y0) / (y1 - y0);
            p.P(Math.round(cx - h0 + t * (h0 + h1)), y, iron);
            p.P(Math.round(cx + h0 - t * (h0 + h1)), y, iron);
        }
        p.R(Math.round(cx - h1), y1, Math.round(h1 * 2) + 1, 1, iron);
    }
    // 抽水杆
    p.R(cx, top - 4, 1, base - top + 2, 0x4a4440);
    // 尾舵
    for (let x = 0; x < 18; x++) {
        const hh = Math.round(2 + x * 0.35);
        p.R(cx + 4 + x, 20 - Math.floor(hh / 2), 1, hh, x > 12 ? 0xb03a2a : 0xd8d0c0);
    }
    p.R(cx + 2, 19, 16, 2, iron);
    // 扇叶：一圈 16 片
    const fy = 20;
    const R = 17;
    for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        for (let r = 4; r <= R; r++) {
            const x = Math.round(cx + Math.cos(ang) * r);
            const y = Math.round(fy + Math.sin(ang) * r * 0.95);
            p.P(x, y, r > R - 6 ? 0xe8e0d0 : 0xc8c0b0);
            p.P(x + 1, y, r > R - 6 ? 0xd0c8b8 : 0xb0a898);
        }
    }
    p.E(cx, fy, R, Math.round(R * 0.95), (dx, dy) => (dx * dx + dy * dy > (R - 1) ** 2 ? iron : null));
    p.E(cx, fy, 3, 3, () => 0x3a3634);
    // 底下的泵头
    p.R(cx - 3, base - 8, 7, 8, 0x5a5650);
    p.R(cx - 3, base - 8, 7, 1, ironL);
    p.R(cx + 4, base - 6, 5, 2, 0x5a5650);
}

/** 原木小屋：一根根圆木横摞，两头露截面；木瓦屋顶，右边石头烟囱，门两边带百叶的窗。 */
export function cabin(p: Pen, w: number, h: number, roofCol: readonly number[] = WC.shingle): void {
    const pw = w * TILE;
    const ph = h * TILE;
    const base = ph - 2;
    const wy = Math.round(ph * 0.45);
    p.R(6, base, pw - 4, 2, 0x000000, 56);
    // 圆木墙
    for (let y = wy; y < base; y++) {
        const k = (y - wy) % 5;
        for (let x = 2; x < pw - 2; x++) p.P(x, y, k === 0 ? WC.woodLight : k === 4 ? WC.woodDark : k === 1 ? WC.wood : WC.woodMid);
    }
    for (let y = wy; y < base; y += 5) {
        for (const x of [0, pw - 5]) {
            p.R(x, y, 5, 4, 0xc49a68);
            p.P(x + 2, y + 1, 0x9a7048);
            p.P(x + 2, y + 2, 0x9a7048);
        }
    }
    // 烟囱
    const chx = pw - 22;
    for (let y = 0; y < wy; y++) for (let x = chx; x < chx + 10; x++) p.P(x, y, ((x + Math.floor(y / 3) * 2) % 5 === 0 || y % 3 === 0) ? 0x6a645c : 0x9a948a);
    // 屋顶：从屋脊往下一行行木瓦
    for (let y = 8; y < wy + 2; y++) {
        const row = Math.floor((y - 8) / 3);
        for (let x = 0; x < pw; x++) {
            if (x >= chx && x < chx + 10 && y < wy - 6) continue;
            const seam = (y - 8) % 3 === 2 || (x + row * 3) % 7 === 0;
            p.P(x, y, y === 8 ? lighter(roofCol[2], 0.2) : y >= wy ? darker(roofCol[0], 0.7) : seam ? roofCol[1] : roofCol[(row % 2) * 2]);
        }
    }
    p.R(0, 6, pw, 2, darker(roofCol[1], 0.8));
    door(p, pw / 2, base, 'panel', WC.woodDark);
    for (const wx of [10, pw - 22]) {
        sash(p, wx, base - 20, 10, 10, WC.cream, 0xc9302c);
        p.R(wx - 4, base - 21, 3, 12, 0x5f7f5a);
        p.R(wx + 11, base - 21, 3, 12, 0x5f7f5a);
    }
    p.D(pw - 6, wy, 4, base - wy, 0.86);
}

/** 茅房：窄木板小屋，门上挖个月牙。 */
export function outhouse(p: Pen): void {
    p.R(4, 45, 26, 3, 0x000000, 56);
    siding(p, 4, 12, 24, 34, WC.woodGrey[0]);
    for (let x = 4; x < 28; x += 4) p.R(x, 12, 1, 34, WC.woodGrey[1]);
    for (let y = 6; y < 13; y++) p.R(2, y, 28, 1, y === 12 ? darker(WC.shingle[0], 0.7) : WC.shingle[(y % 2) * 2]);
    p.R(9, 20, 14, 26, WC.woodGrey[2]);
    p.R(9, 20, 1, 26, WC.woodDark);
    p.E(16, 25, 2, 3, (dx) => (dx > 0 ? null : 0x2a1c12));
    p.P(20, 33, 0x3a3634);
}

/** 矿洞口：两根立柱一根横梁撑着黑洞，铁轨伸出来，梁上挂盏油灯。 */
export function mineEntrance(p: Pen): void {
    const pw = 64;
    const base = 46;
    p.E(32, 30, 22, 18, (_dx, dy) => (dy > 14 ? null : 0x120c08));
    p.E(32, 32, 16, 13, () => 0x050302);
    for (const x of [8, pw - 14]) {
        p.R(x, 12, 6, base - 12, WC.woodMid);
        p.R(x, 12, 2, base - 12, WC.woodLight);
        p.R(x + 5, 12, 1, base - 12, WC.woodDark);
    }
    p.R(4, 8, pw - 8, 6, WC.woodMid);
    p.R(4, 8, pw - 8, 1, WC.woodLight);
    p.R(4, 13, pw - 8, 1, WC.woodDark);
    // 油灯
    p.R(30, 14, 1, 3, 0x3a3634);
    p.R(28, 17, 5, 6, 0x3a3634);
    p.R(29, 18, 3, 4, 0xf8c060);
    // 铁轨
    for (const x of [24, 38]) p.R(x, 34, 2, 14, 0x5a5650);
    for (let y = 35; y < 48; y += 3) p.R(21, y, 22, 1, WC.woodDark);
}

// ---------- 小物件 ----------

export function hitchingPost(p: Pen): void {
    p.R(2, 13, 28, 2, 0x000000, 50);
    for (const x of [3, 27]) {
        p.R(x, 3, 3, 11, WC.woodMid);
        p.R(x, 3, 1, 11, WC.woodLight);
    }
    p.R(1, 4, 30, 2, WC.wood);
    p.R(1, 4, 30, 1, WC.woodLight);
    p.R(1, 6, 30, 1, WC.woodDark);
    // 一圈缰绳
    p.R(14, 6, 1, 4, 0x6a4a2a);
    p.R(15, 9, 2, 1, 0x6a4a2a);
}

export function trough(p: Pen): void {
    p.R(2, 13, 29, 2, 0x000000, 50);
    p.R(1, 5, 30, 9, WC.woodMid);
    p.R(1, 5, 30, 1, WC.woodLight);
    p.R(3, 6, 26, 3, WC.water[1]);
    p.R(5, 6, 4, 1, WC.waterShine);
    for (const x of [1, 15, 29]) p.R(x, 5, 2, 10, WC.woodDark);
    p.R(1, 12, 30, 1, WC.woodDark);
}

export function barrel(p: Pen): void {
    groundShadow(p, 8, 14, 6, 2, 50);
    barrelAt(p, 3, 2, 10, 13);
}

export function crateW(p: Pen): void {
    p.R(2, 13, 13, 2, 0x000000, 50);
    p.R(2, 3, 12, 11, WC.woodLight);
    p.R(2, 3, 12, 1, lighter(WC.woodLight, 0.2));
    p.R(2, 3, 1, 11, WC.woodDark);
    p.R(13, 3, 1, 11, WC.woodDark);
    p.R(2, 13, 12, 1, WC.woodDark);
    for (let k = 0; k < 10; k++) p.P(3 + k, 4 + k, WC.woodMid);
    p.R(2, 8, 12, 1, WC.woodMid);
}

export function hayBale(p: Pen): void {
    p.R(1, 13, 15, 2, 0x000000, 50);
    for (let y = 4; y < 14; y++) for (let x = 1; x < 15; x++) p.P(x, y, p.r() < 0.3 ? WC.dry[1] : y < 6 ? WC.dry[2] : WC.dry[0]);
    p.R(4, 4, 1, 10, 0x8a6a30);
    p.R(11, 4, 1, 10, 0x8a6a30);
}

export function wagonWheel(p: Pen): void {
    p.E(8, 8, 7, 7, (dx, dy) => {
        const d = dx * dx + dy * dy;
        if (d > 36) return WC.woodDark;
        if (d < 3) return WC.woodMid;
        return dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy) ? WC.wood : null;
    });
}

/** 有篷马车：帆布拱篷撑着几道箍，木车厢，前小后大两个辐条轮，前面伸出车辕。 */
export function coveredWagon(p: Pen): void {
    groundShadow(p, 34, 44, 28, 3, 56);
    // 车辕
    p.R(0, 36, 14, 2, WC.woodDark);
    // 车厢
    p.R(10, 26, 48, 10, WC.wood);
    p.R(10, 26, 48, 1, WC.woodLight);
    p.R(10, 31, 48, 1, WC.woodDark);
    p.R(10, 35, 48, 1, WC.woodDark);
    // 篷
    for (let y = 4; y < 27; y++) {
        for (let x = 12; x < 56; x++) {
            const t = (x - 34) / 22;
            const top = 4 + Math.round(t * t * 6);
            if (y < top) continue;
            const hoop = [16, 25, 34, 43, 52].includes(x);
            p.P(x, y, hoop ? 0xc8bca4 : y < top + 2 ? 0xfbf6ea : x > 48 ? 0xd8cfbb : 0xefe8d8);
        }
    }
    p.E(54, 18, 2, 6, () => 0x3a2a1c);
    // 轮子
    const wheel = (cx: number, cy: number, r: number) => p.E(cx, cy, r, r, (dx, dy) => {
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > r - 1.5) return 0x3a2a1c;
        if (d < 2) return WC.woodDark;
        const a = Math.atan2(dy, dx);
        return Math.abs(Math.sin(a * 4)) < 0.25 ? WC.woodMid : null;
    });
    wheel(17, 38, 7);
    wheel(48, 36, 10);
}

/** 平板马车，装着一车干草。 */
export function hayCart(p: Pen): void {
    groundShadow(p, 24, 28, 20, 3, 56);
    p.R(0, 22, 10, 2, WC.woodDark);
    for (let y = 6; y < 19; y++) for (let x = 9 + Math.max(0, 8 - y); x < 44 - Math.max(0, 8 - y); x++) p.P(x, y, p.r() < 0.25 ? WC.dry[1] : y < 9 ? WC.dry[2] : WC.dry[0]);
    p.R(8, 18, 38, 6, WC.wood);
    p.R(8, 18, 38, 1, WC.woodLight);
    p.R(8, 23, 38, 1, WC.woodDark);
    p.E(32, 25, 6, 6, (dx, dy) => {
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 4.6) return 0x3a2a1c;
        return dx === 0 || dy === 0 ? WC.woodMid : null;
    });
}

/** 拴着的马：侧身朝左站着，鬃毛尾巴深色，背上一副鞍子。 */
export function horse(p: Pen, coat: number, mane: number, saddle?: number): void {
    groundShadow(p, 24, 30, 16, 2, 56);
    const dark = darker(coat, 0.78);
    // 腿
    for (const [x, c] of [[13, dark], [17, coat], [31, dark], [35, coat]] as [number, number][]) {
        p.R(x, 20, 3, 10, c);
        p.R(x, 29, 3, 1, 0x2a2018);
    }
    // 身子
    p.E(25, 16, 13, 6, (dx, dy) => (dy > 3 ? dark : dy < -4 ? lighter(coat, 0.15) : coat));
    // 脖子和头
    for (let k = 0; k < 9; k++) p.R(10 - Math.floor(k / 2), 12 - k, 6, 4, coat);
    p.R(2, 3, 7, 5, coat);
    p.R(1, 6, 4, 3, coat);
    p.P(2, 8, 0x2a2018);
    p.P(5, 4, 0x1a1410);
    p.R(6, 1, 2, 3, coat);
    // 鬃毛和尾巴
    for (let k = 0; k < 9; k++) p.R(13 - Math.floor(k / 2), 11 - k, 2, 2, mane);
    for (let k = 0; k < 10; k++) p.R(38 + Math.floor(k / 4), 12 + k, 2, 1, mane);
    if (saddle) {
        p.R(20, 9, 11, 4, saddle);
        p.R(20, 9, 11, 1, lighter(saddle, 0.3));
        p.R(24, 13, 2, 6, darker(saddle, 0.7));
        p.R(23, 18, 4, 2, 0x8a8680);
    }
}

/** 长角牛：侧身，白脸，两根往外翘的长角。 */
export function longhorn(p: Pen, coat: number): void {
    groundShadow(p, 17, 30, 13, 2, 56);
    const dark = darker(coat, 0.78);
    for (const x of [8, 11, 22, 25]) {
        p.R(x, 22, 3, 8, x % 2 === 0 ? dark : coat);
        p.R(x, 29, 3, 1, 0x2a2018);
    }
    p.E(18, 17, 11, 7, (dx, dy) => (dy > 4 ? dark : (dx + dy * 2) % 9 === 0 && dx > 0 ? 0xf1eee4 : coat));
    p.R(1, 12, 7, 8, 0xeee6d6);
    p.R(2, 19, 5, 2, 0xd8c4b0);
    p.P(3, 14, 0x1a1410);
    for (let k = 0; k < 7; k++) {
        p.P(4 - k, 11 - Math.floor(k / 3), 0xe8dcc0);
        p.P(6 + k, 11 - Math.floor(k / 3), 0xe8dcc0);
    }
    p.R(29, 13, 1, 9, dark);
}

/** 大仙人掌（巨柱仙人掌）：一根主干，左右各一条胳膊往上弯；arms 0/1/2。 */
export function saguaro(p: Pen, arms: 0 | 1 | 2, tall = 5): void {
    const ph = tall * TILE;
    const base = ph - 2;
    const cx = 22;
    groundShadow(p, cx + 2, base, 9, 2, 60);
    const column = (x0: number, y0: number, w: number, y1: number) => {
        for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x0 + w; x++) {
                const top = y - y0;
                const edge = x === x0 || x === x0 + w - 1;
                if (top < 2 && edge) continue;
                const rib = (x - x0) % 3 === 1;
                let c = edge ? WC.cactus[3] : rib ? WC.cactus[2] : x - x0 >= w - 3 ? WC.cactus[1] : WC.cactus[0];
                if (top === 0) c = WC.cactus[2];
                p.P(x, y, c);
            }
            if ((y - y0) % 4 === 2) p.P(x0 + 1, y, WC.spine);
        }
    };
    column(cx - 5, 4, 10, base);
    if (arms >= 1) {
        // 右胳膊：从主干伸出去再往上
        const ay = Math.round(ph * 0.48);
        p.R(cx + 5, ay, 6, 5, WC.cactus[1]);
        p.R(cx + 5, ay, 6, 1, WC.cactus[2]);
        column(cx + 8, Math.round(ph * 0.2), 7, ay + 5);
    }
    if (arms >= 2) {
        const ay = Math.round(ph * 0.58);
        p.R(cx - 11, ay, 6, 5, WC.cactus[0]);
        p.R(cx - 11, ay, 6, 1, WC.cactus[2]);
        column(cx - 16, Math.round(ph * 0.34), 7, ay + 5);
    }
    // 顶上开花
    p.P(cx - 1, 3, 0xf7f2e0);
    p.P(cx + 1, 4, 0xf7f2e0);
}

/** 小巨柱：一根没分叉的嫩柱子。 */
export function saguaroYoung(p: Pen): void {
    groundShadow(p, 9, 45, 6, 2, 60);
    for (let y = 14; y < 46; y++) {
        for (let x = 4; x < 12; x++) {
            if (y < 16 && (x === 4 || x === 11)) continue;
            p.P(x, y, x === 4 || x === 11 ? WC.cactus[3] : (x - 4) % 3 === 1 ? WC.cactus[2] : x > 8 ? WC.cactus[1] : WC.cactus[0]);
        }
        if (y % 4 === 0) p.P(5, y, WC.spine);
    }
}

/** 仙人掌（仙人掌果）：几片椭圆的掌，边上结粉红的果。 */
export function pricklyPear(p: Pen): void {
    groundShadow(p, 8, 14, 6, 2, 50);
    const pad = (cx: number, cy: number, rx: number, ry: number) => p.E(cx, cy, rx, ry, (dx, dy) => {
        if (dx * dx / (rx * rx) + dy * dy / (ry * ry) > 0.7) return WC.cactus[3];
        if ((dx * 3 + dy * 5) % 7 === 0) return WC.spine;
        return dx > 0 ? WC.cactus[1] : WC.cactus[0];
    });
    pad(5, 10, 3, 4);
    pad(11, 9, 3, 5);
    pad(8, 5, 3, 4);
    for (const [x, y] of [[6, 1], [10, 2], [13, 4]]) {
        p.R(x, y, 2, 2, 0xd0405e);
        p.P(x, y, 0xf07090);
    }
}

/** 金琥（圆滚滚的桶形仙人掌），顶上一圈黄花。 */
export function barrelCactus(p: Pen): void {
    groundShadow(p, 8, 14, 6, 2, 50);
    p.E(8, 9, 6, 5, (dx, dy) => {
        if (dx * dx / 36 + dy * dy / 25 > 0.75) return WC.cactus[3];
        return Math.abs(dx) % 3 === 0 ? WC.cactus[2] : dx > 1 ? WC.cactus[1] : WC.cactus[0];
    });
    for (let x = 4; x < 13; x += 2) p.P(x, 4 + (x % 4 === 0 ? 0 : 1), 0xf4d04a);
    p.R(7, 3, 2, 1, 0xf4a83a);
}

/** 风滚草：一团乱糟糟的枯枝球。 */
export function tumbleweed(p: Pen): void {
    groundShadow(p, 8, 14, 6, 1, 50);
    for (let i = 0; i < 70; i++) {
        const a = p.r() * Math.PI * 2;
        const r = Math.sqrt(p.r()) * 6;
        const x = Math.round(8 + Math.cos(a) * r);
        const y = Math.round(8 + Math.sin(a) * r * 0.9);
        p.P(x, y, p.r() < 0.5 ? 0xa8875a : p.r() < 0.5 ? 0x8a6a42 : 0xc4a476);
    }
}

/** 山艾灌木：一丛灰绿色的小矮树。 */
export function sagebrush(p: Pen): void {
    groundShadow(p, 8, 14, 6, 2, 50);
    for (let i = 0; i < 6; i++) {
        const cx = 3 + Math.floor(p.r() * 10);
        const cy = 6 + Math.floor(p.r() * 6);
        p.E(cx, cy, 3, 2, (dx, dy) => (dy < 0 ? WC.sage[1] : dx > 1 ? WC.sage[2] : WC.sage[0]));
    }
    p.R(7, 12, 1, 2, WC.woodDark);
}

/** 干草丛：一撮黄草。 */
export function dryGrass(p: Pen): void {
    p.R(2, 14, 12, 1, 0x000000, 40);
    for (const x of [2, 4, 6, 8, 10, 12].filter(() => p.r() < 0.85)) {
        const h = 4 + Math.floor(p.r() * 6);
        for (let j = 0; j < h; j++) {
            const lean = j > h * 0.6 ? (x < 8 ? -1 : 1) : 0;
            p.P(x + lean, 14 - j, j > h - 3 ? WC.dry[2] : WC.dry[j % 2]);
        }
    }
}

export function redRocks(p: Pen): void {
    groundShadow(p, 8, 13, 6, 2, 50);
    p.E(6, 10, 4, 3, (_dx, dy) => (dy < 0 ? WC.strata[3] : WC.strata[0]));
    p.E(11, 11, 3, 2, (_dx, dy) => (dy < 0 ? WC.strata[1] : WC.strata[4]));
    p.P(5, 8, lighter(WC.strata[3], 0.3));
}

export function boulder(p: Pen): void {
    groundShadow(p, 17, 28, 13, 3, 60);
    p.E(15, 18, 12, 10, (dx, dy) => {
        if (dy < -5 && dx < 3) return WC.strata[3];
        if (dy > 5 || dx > 7) return WC.strata[4];
        return (dx + dy) % 6 === 0 ? WC.rockCrack : WC.strata[0];
    });
    p.R(8, 13, 10, 1, WC.rockCrack);
}

/** 牛头骨：白骨，两只眼窝，长角。 */
export function cowSkull(p: Pen): void {
    groundShadow(p, 8, 13, 5, 1, 40);
    p.R(5, 6, 6, 6, 0xeee8da);
    p.R(6, 12, 4, 2, 0xeee8da);
    p.R(6, 8, 1, 2, 0x3a3030);
    p.R(9, 8, 1, 2, 0x3a3030);
    p.P(7, 12, 0x6a6060);
    p.P(8, 12, 0x6a6060);
    for (let k = 0; k < 5; k++) {
        p.P(4 - k, 6 - Math.floor(k / 2), 0xe0d6c2);
        p.P(11 + k, 6 - Math.floor(k / 2), 0xe0d6c2);
    }
}

/** 枯树：灰白扭曲的树干，几根光秃的枝杈。 */
export function deadTree(p: Pen): void {
    const base = 78;
    groundShadow(p, 25, base, 10, 2, 56);
    const grey = 0x8a7e70;
    const greyL = 0xaea292;
    const limb = (x: number, y: number, dx: number, dy: number, n: number, w: number) => {
        for (let i = 0; i < n; i++) {
            const xx = Math.round(x + dx * i);
            const yy = Math.round(y + dy * i);
            p.R(xx, yy, w, 1, i % 4 === 0 ? greyL : grey);
            if (w > 1) p.P(xx, yy, greyL);
        }
    };
    limb(22, base, 0.08, -1, 44, 5);
    limb(24, 46, 0.5, -1, 20, 3);
    limb(22, 52, -0.6, -1, 18, 3);
    limb(33, 28, 0.8, -0.6, 8, 2);
    limb(14, 36, -0.8, -0.8, 8, 2);
    limb(26, 34, -0.2, -1, 22, 2);
    limb(26, 14, 0.7, -0.5, 6, 1);
    limb(18, 40, 0.3, -1, 12, 1);
    p.R(20, base - 3, 9, 3, grey);
}

export function fenceH(p: Pen): void {
    p.R(0, 13, 16, 1, 0x000000, 40);
    p.R(1, 3, 3, 11, WC.woodGrey[1]);
    p.R(1, 3, 1, 11, WC.woodGrey[2]);
    p.R(0, 5, 16, 2, WC.woodGrey[0]);
    p.R(0, 5, 16, 1, WC.woodGrey[2]);
    p.R(0, 10, 16, 2, WC.woodGrey[0]);
    p.R(0, 11, 16, 1, WC.woodGrey[1]);
}

export function fenceV(p: Pen): void {
    p.R(6, 2, 4, 12, WC.woodGrey[1]);
    p.R(6, 2, 1, 12, WC.woodGrey[2]);
    p.R(7, 0, 2, 16, WC.woodGrey[0]);
    p.R(7, 0, 1, 16, WC.woodGrey[2]);
    p.R(4, 13, 8, 1, 0x000000, 40);
}

export function oilLamp(p: Pen): void {
    p.R(5, 30, 7, 1, 0x000000, 50);
    p.R(7, 8, 2, 23, WC.woodDark);
    p.R(7, 8, 1, 23, WC.woodMid);
    p.R(5, 2, 6, 7, 0x3a3634);
    p.R(6, 3, 4, 5, 0xf8c060);
    p.R(7, 4, 2, 2, 0xfff0b0);
    p.R(4, 1, 8, 1, 0x3a3634);
}

/** 告示栏（招工处）：小顶棚下一块木板，贴着几张告示，其中一张通缉令。 */
export function noticeBoard(p: Pen): void {
    p.R(4, 45, 42, 2, 0x000000, 56);
    for (const x of [5, 40]) {
        p.R(x, 10, 3, 36, WC.woodMid);
        p.R(x, 10, 1, 36, WC.woodLight);
    }
    for (let y = 4; y < 10; y++) p.R(1, y, 46, 1, y === 9 ? darker(WC.shingle[0], 0.7) : WC.shingle[y % 2]);
    p.R(6, 11, 36, 24, WC.woodDark);
    p.R(7, 12, 34, 22, WC.wood);
    // 通缉令：黄纸上一个头像
    p.R(9, 14, 11, 15, 0xeadcae);
    p.R(10, 15, 9, 2, WC.ink);
    p.R(12, 21, 5, 5, 0x8a6a4a);
    p.R(11, 21, 7, 1, 0x3a2418);
    // 招工的告示
    p.R(22, 14, 9, 11, 0xf3eedf);
    for (let y = 16; y < 24; y += 2) p.R(23, y, 7, 1, 0x8a7a68);
    p.R(32, 15, 7, 9, 0xe8d8b8);
    for (let y = 17; y < 23; y += 2) p.R(33, y, 5, 1, 0x8a7a68);
    for (const [x, y] of [[14, 14], [26, 14], [35, 15]]) p.P(x, y, 0xc9302c);
}

export function woodBench(p: Pen): void {
    p.R(2, 13, 28, 2, 0x000000, 50);
    p.R(1, 6, 30, 3, WC.wood);
    p.R(1, 6, 30, 1, WC.woodLight);
    p.R(1, 2, 30, 2, WC.woodMid);
    for (const x of [3, 27]) p.R(x, 2, 2, 12, WC.woodDark);
}

/** 田里的庄稼（1×2）：玉米和辣椒。 */
export function desertCrop(p: Pen, kind: 'corn' | 'chili'): void {
    if (kind === 'corn') {
        for (const x of [3, 8, 12]) {
            const top = 4 + Math.floor(p.r() * 4);
            for (let y = top; y < 30; y++) p.P(x, y, y < top + 3 ? 0xd8c070 : 0x6a9a3a);
            for (let y = top + 6; y < 28; y += 5) {
                p.R(x - 3, y, 3, 1, 0x7aab48);
                p.R(x + 1, y + 2, 3, 1, 0x5a8a30);
            }
            p.R(x + 1, top + 10, 2, 5, 0xe8c850);
        }
        return;
    }
    p.E(8, 24, 6, 5, (dx, dy) => (dy < 0 ? 0x5f9a3e : dx > 2 ? 0x3f7a2c : 0x4f8a36));
    for (const [x, y] of [[4, 24], [9, 26], [11, 21], [6, 20]]) {
        p.R(x, y, 1, 4, 0xd0302a);
        p.P(x, y - 1, 0x3f7a2c);
        p.P(x, y, 0xf05a40);
    }
}
