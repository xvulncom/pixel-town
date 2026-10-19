// 鱼的图，钓鱼和摆摊界面用，名字 fish_<鱼 id>。鱼侧面朝右 2×1 格（32×16），小龙虾俯视 2×1，大闸蟹俯视 2×2。
// 每种鱼的体形、鳍、花纹照维基共享资源上的实拍照片定（2026-10-19 对照过）：
//   白条 Hemiculter leucisculus、鲫 Carassius gibelio、鲤 Cyprinus carpio、草鱼 Ctenopharyngodon idella、
//   鳊 Megalobrama amblycephala、小龙虾 Procambarus clarkii、昂刺 Tachysurus fulvidraco、黄鳝 Monopterus albus、
//   银鱼 Salanx、鳜 Siniperca chuatsi、大闸蟹 Eriocheir sinensis、青鱼 Mylopharyngodon piceus。
// 只参考照片的形和色，图是自己一个个像素算出来的，不含照片内容。
// 新鱼在 FISH_LOOKS 加一行，npm test 会查 data/fish.ts 里每种鱼都有图。

import { Pen } from './canvas';

type Tail = 'fork' | 'deepfork' | 'round' | 'notch';
type Pattern = 'none' | 'scales' | 'net' | 'blotch' | 'marble' | 'dots';

interface FishBody {
    kind: 'fish';
    /** 身子最高处（像素，16 以内） */
    depth: number;
    /** 最高处在身长的哪里（0 尾、1 嘴） */
    peak: number;
    /** 尾柄高占身高的比例 */
    peduncle: number;
    /** 嘴往前收的程度：0.5 钝圆，1 以上尖 */
    snout: number;
    /** 背比肚子鼓多少（0 上下对称，鳊鱼那样驼背给 0.3） */
    hump: number;
    tail: Tail;
    /** 尾鳍长度（像素） */
    tailLen: number;
    /** 背鳍：从身长哪里到哪里、多高；spiny 是鳜鱼那种一根根硬刺 */
    dorsal: { from: number; to: number; h: number; spiny?: boolean };
    /** 臀鳍长度比例，0 不画 */
    anal: number;
    /** 脂鳍（鲇类背后的小肉鳍） */
    adipose?: boolean;
    mouth: 'end' | 'up' | 'big' | 'snout';
    /** 须：0 没有，1 短须（鲤），2 长须（昂刺） */
    barbels: 0 | 1 | 2;
    eye: 1 | 2;
    pattern: Pattern;
    back: number;
    flank: number;
    belly: number;
    /** 背鳍颜色 */
    fin: number;
    /** 尾鳍、臀鳍、腹鳍颜色（鲤鱼是红的），不填同 fin */
    lowerFin?: number;
    mark?: number;
}

type Look = FishBody | { kind: 'eel'; back: number; belly: number; mark: number }
    | { kind: 'crayfish' } | { kind: 'crab' };

export const FISH_LOOKS: Record<string, Look> = {
    // 白条：细长侧扁，上翘的嘴，大眼，背鳍靠后，尾深叉，银白
    baitiao: {
        kind: 'fish', depth: 7, peak: 0.6, peduncle: 0.35, snout: 0.9, hump: 0, tail: 'deepfork', tailLen: 7,
        dorsal: { from: 0.42, to: 0.55, h: 4 }, anal: 0.2, mouth: 'up', barbels: 0, eye: 2, pattern: 'none',
        back: 0x6f8084, flank: 0xc4cfd2, belly: 0xf4f7f7, fin: 0xa9b6ba,
    },
    // 鲫鱼（银鲫）：身子高，背圆，青灰带古铜，鳞片清楚，尾浅叉
    jiyu: {
        kind: 'fish', depth: 11, peak: 0.55, peduncle: 0.4, snout: 0.6, hump: 0.1, tail: 'fork', tailLen: 6,
        dorsal: { from: 0.3, to: 0.62, h: 3 }, anal: 0.14, mouth: 'end', barbels: 0, eye: 2, pattern: 'scales',
        back: 0x55553a, flank: 0xa89a68, belly: 0xd8cfa8, fin: 0x6a6448,
    },
    // 鲤鱼：金黄偏橄榄，背鳍长，尾鳍和下面的鳍橙红，嘴边有须，大鳞
    liyu: {
        kind: 'fish', depth: 10, peak: 0.55, peduncle: 0.4, snout: 0.6, hump: 0.08, tail: 'fork', tailLen: 6,
        dorsal: { from: 0.25, to: 0.6, h: 3 }, anal: 0.16, mouth: 'end', barbels: 1, eye: 2, pattern: 'scales',
        back: 0x6a5626, flank: 0xc9a046, belly: 0xead598, fin: 0x74602e, lowerFin: 0xd0623a,
    },
    // 草鱼：长筒形，头钝，背青褐、腹黄，鳞缘发黑像一张网，鳍灰褐
    caoyu: {
        kind: 'fish', depth: 8, peak: 0.6, peduncle: 0.45, snout: 0.5, hump: 0, tail: 'fork', tailLen: 6,
        dorsal: { from: 0.45, to: 0.6, h: 3 }, anal: 0.14, mouth: 'end', barbels: 0, eye: 1, pattern: 'net',
        back: 0x4a462a, flank: 0xa4924c, belly: 0xd8cb94, fin: 0x5a5234,
    },
    // 鳊鱼（武昌鱼）：又高又扁，驼背，小头，臀鳍长，尾深叉，银灰
    bianyu: {
        kind: 'fish', depth: 14, peak: 0.55, peduncle: 0.26, snout: 0.8, hump: 0.3, tail: 'deepfork', tailLen: 6,
        dorsal: { from: 0.5, to: 0.6, h: 4 }, anal: 0.38, mouth: 'end', barbels: 0, eye: 2, pattern: 'scales',
        back: 0x5c6268, flank: 0xb6babc, belly: 0xe4e4dc, fin: 0x8c9296,
    },
    xiaolongxia: { kind: 'crayfish' },
    // 昂刺鱼（黄颡鱼）：头扁，四对长须，黄底大块深褐斑，背鳍一根硬刺，有脂鳍，尾叉
    angci: {
        kind: 'fish', depth: 7, peak: 0.7, peduncle: 0.4, snout: 0.45, hump: 0.05, tail: 'fork', tailLen: 6,
        dorsal: { from: 0.6, to: 0.68, h: 5, spiny: true }, anal: 0.25, adipose: true, mouth: 'end', barbels: 2, eye: 1,
        pattern: 'blotch', back: 0x5a4418, flank: 0xc49a34, belly: 0xecd27a, fin: 0xa88a3c, mark: 0x3e2c10,
    },
    // 黄鳝：没鳍的长条，背黄褐带黑点，肚子黄
    huangshan: { kind: 'eel', back: 0x6a5226, belly: 0xc49c48, mark: 0x2e2210 },
    // 银鱼：细得像一根针，半透明发白，嘴尖，肚子一排小黑点，背鳍很靠后
    yinyu: {
        kind: 'fish', depth: 4, peak: 0.5, peduncle: 0.5, snout: 1.4, hump: 0, tail: 'fork', tailLen: 5,
        dorsal: { from: 0.2, to: 0.27, h: 2 }, anal: 0.18, mouth: 'snout', barbels: 0, eye: 1, pattern: 'dots',
        back: 0xd2d8d6, flank: 0xeef1ef, belly: 0xfcfcfa, fin: 0xd8dedc, mark: 0x7a8486,
    },
    // 鳜鱼：身高，大嘴，背鳍前半一排硬刺，黄绿底上深褐云斑和黑点，尾圆
    guiyu: {
        kind: 'fish', depth: 11, peak: 0.55, peduncle: 0.42, snout: 0.7, hump: 0.15, tail: 'round', tailLen: 6,
        dorsal: { from: 0.25, to: 0.72, h: 4, spiny: true }, anal: 0.2, mouth: 'big', barbels: 0, eye: 2,
        pattern: 'marble', back: 0x585026, flank: 0xb0a052, belly: 0xe2dab0, fin: 0x8a7a40, mark: 0x3a3016,
    },
    dazhaxie: { kind: 'crab' },
    // 青鱼：草鱼的身形，背青黑，鳍全黑，腹灰白
    qingyu: {
        kind: 'fish', depth: 8, peak: 0.58, peduncle: 0.45, snout: 0.55, hump: 0.02, tail: 'fork', tailLen: 6,
        dorsal: { from: 0.45, to: 0.6, h: 3 }, anal: 0.14, mouth: 'end', barbels: 0, eye: 1, pattern: 'net',
        back: 0x1c242c, flank: 0x56626a, belly: 0xb4bcbe, fin: 0x181c22,
    },
};

/** 图有几格大，objects.ts 登记用。 */
export function fishSize(l: Look): [number, number] {
    return l.kind === 'crab' ? [2, 2] : [2, 1];
}

function shade(c: number, k: number): number {
    const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
    return (f(c >> 16) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255);
}

function mix(a: number, b: number, t: number): number {
    const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
    return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** 固定的伪随机（画斑点用），同样的坐标每次一样。 */
function noise(x: number, y: number, k: number): number {
    let h = Math.imul(x * 374761393 + y * 668265263 + k * 2246822519, 3266489917);
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

const W = 32;
const H = 16;
const EYE = 0x101010;

function paintFish(p: Pen, f: FishBody): void {
    const lowerFin = f.lowerFin ?? f.fin;
    const xs = f.tailLen; // 尾柄
    const xe = W - 1; // 嘴尖
    const cy = 8 + f.hump * 1.5;
    const half = f.depth / 2;
    const len = xe - xs;
    const tOf = (x: number) => (x - xs) / len;
    const hOf = (t: number) => {
        if (t < 0 || t > 1) return 0;
        if (t < f.peak) return half * (f.peduncle + (1 - f.peduncle) * Math.sin((Math.PI / 2) * (t / f.peak)));
        return half * Math.pow(Math.max(0, 1 - ((t - f.peak) / (1 - f.peak)) ** 2), f.snout);
    };
    const topY = (x: number) => cy - hOf(tOf(x)) * (1 + f.hump);
    const botY = (x: number) => cy + hOf(tOf(x)) * (1 - f.hump * 0.6);
    const inside = (x: number, y: number) => x >= xs && x <= xe && y + 0.5 >= topY(x + 0.5) && y + 0.5 <= botY(x + 0.5);
    // 某一列身子最上、最下那格，鳍贴着它长
    const colTop = (x: number) => {
        for (let y = 0; y < H; y++) if (inside(x, y)) return y;
        return Math.round(cy);
    };
    const colBot = (x: number) => {
        for (let y = H - 1; y >= 0; y--) if (inside(x, y)) return y;
        return Math.round(cy);
    };
    let snoutX = xe;
    for (let x = xe; x > xs; x--) {
        if ([...Array(H).keys()].some((y) => inside(x, y))) {
            snoutX = x;
            break;
        }
    }

    // 尾鳍：从尾柄往左展开
    const ped = hOf(0) + 0.5;
    const spread = Math.max(ped + 1, half * 0.95);
    for (let dx = 1; dx <= f.tailLen; dx++) {
        const x = xs - dx;
        const k = dx / f.tailLen;
        let reach = ped + (spread - ped) * (f.tail === 'round' ? Math.sin(k * Math.PI * 0.6) : k);
        if (f.tail === 'round' && dx === f.tailLen) reach -= 1;
        for (let y = Math.floor(cy - reach); y <= Math.ceil(cy + reach); y++) {
            const d = Math.abs(y + 0.5 - cy);
            if (d > reach) continue;
            if ((f.tail === 'fork' || f.tail === 'deepfork') && dx > f.tailLen * (f.tail === 'deepfork' ? 0.3 : 0.5)
                && d < reach * (f.tail === 'deepfork' ? 0.75 : 0.55) * k) continue;
            if (f.tail === 'notch' && dx === f.tailLen && d < 1) continue;
            const edge = d > reach - 1 || dx === f.tailLen;
            // 鳍条：隔一行深一点
            p.P(x, y, edge ? shade(lowerFin, 0.75) : (y % 2 ? lowerFin : shade(lowerFin, 1.1)));
        }
    }

    // 背鳍
    const d0 = Math.round(xs + f.dorsal.from * len);
    const d1 = Math.round(xs + f.dorsal.to * len);
    for (let x = d0; x <= d1; x++) {
        const k = (x - d0) / Math.max(1, d1 - d0);
        // 前缘高、往后变矮；硬刺一高一矮
        let h = f.dorsal.h * (f.dorsal.spiny ? (k < 0.55 ? 1 : 0.7) : 1 - k * 0.6);
        if (f.dorsal.spiny && x % 2) h -= 1.5;
        const base = colTop(x);
        for (let i = 1; i <= Math.round(h); i++) p.P(x, base - i, i === Math.round(h) ? shade(f.fin, 0.7) : f.fin);
    }
    if (f.adipose) {
        const x = Math.round(xs + 0.22 * len);
        p.R(x - 1, colTop(x) - 1, 3, 1, f.fin);
    }
    // 臀鳍、腹鳍
    const fins: [number, number, number][] = [];
    if (f.anal > 0) fins.push([0.12, 0.12 + f.anal, 3]);
    fins.push([0.48, 0.56, 2]);
    for (const [a, b, h] of fins) {
        const x0 = Math.round(xs + a * len);
        const x1 = Math.round(xs + b * len);
        for (let x = x0; x <= x1; x++) {
            const base = colBot(x);
            const hh = Math.max(1, Math.round(h * (1 - ((x - x0) / Math.max(1, x1 - x0)) * 0.5)));
            for (let i = 1; i <= hh; i++) p.P(x - Math.floor((i - 1) / 2), base + i, i === hh ? shade(lowerFin, 0.75) : lowerFin);
        }
    }

    // 身子：背、侧、腹三段，交界处棋盘格过渡，边缘描深色
    const gillX = Math.round(xe - Math.max(4, len * 0.22));
    for (let x = xs; x <= xe; x++) {
        const t0 = topY(x + 0.5);
        const b0 = botY(x + 0.5);
        for (let y = 0; y < H; y++) {
            if (!inside(x, y)) continue;
            const v = (y + 0.5 - t0) / Math.max(1, b0 - t0);
            const dith = (x + y) % 2 === 0 ? 0.06 : -0.06;
            let c = v + dith < 0.36 ? f.back : v + dith < 0.66 ? f.flank : f.belly;
            // 背上靠近边缘一行提亮，像反光
            if (v < 0.36 && !inside(x, y - 1)) c = shade(f.back, 0.6);
            else if (v > 0.66 && !inside(x, y + 1)) c = shade(f.belly, 0.72);
            else if (!inside(x - 1, y) || !inside(x + 1, y)) c = shade(c, 0.7);
            else if (v >= 0.36 && v < 0.46 && x > xs + len * 0.25 && x < gillX) c = mix(c, 0xffffff, 0.25);
            c = applyPattern(f, x, y, v, c, gillX);
            p.P(x, y, c);
        }
    }

    // 鳃盖：一道弯的深线
    for (let y = 0; y < H; y++) {
        if (!inside(gillX, y)) continue;
        const v = (y + 0.5 - topY(gillX)) / Math.max(1, botY(gillX) - topY(gillX));
        if (v < 0.15 || v > 0.9) continue;
        const x = gillX + (Math.abs(v - 0.55) > 0.25 ? 1 : 0);
        p.P(x, y, shade(f.flank, 0.6));
    }
    // 胸鳍：鳃盖后面一小片
    const px = gillX - 1;
    const py = Math.round(cy + half * 0.35);
    p.P(px, py, lowerFin);
    p.P(px - 1, py, lowerFin);
    p.P(px - 2, py + 1, shade(lowerFin, 0.8));

    // 眼睛
    const ex = snoutX - Math.max(3, Math.round(len * (f.mouth === 'snout' ? 0.12 : 0.09)));
    const ey = Math.round(cy - half * (f.hump > 0.2 ? 0.05 : 0.2)) - (f.eye === 2 ? 1 : 0);
    if (f.eye === 2) {
        p.R(ex - 1, ey, 2, 2, EYE);
        p.P(ex - 1, ey, 0xf4f4f0);
    } else {
        p.P(ex, ey, EYE);
        p.P(ex, ey - 1, mix(f.back, 0xffffff, 0.4));
    }
    // 嘴
    const mx = snoutX;
    const my = Math.min(colBot(mx), Math.max(colTop(mx), Math.round(cy + (f.mouth === 'up' ? -1 : f.mouth === 'big' ? 1 : 0))));
    p.P(mx, my, shade(f.flank, 0.45));
    if (f.mouth === 'big') {
        p.P(mx - 1, my, shade(f.flank, 0.45));
        p.P(mx - 2, my, shade(f.flank, 0.55));
    }
    // 须
    if (f.barbels === 1) {
        p.P(mx - 1, my + 1, shade(f.flank, 0.55));
        p.P(mx - 2, my + 2, shade(f.flank, 0.55));
    } else if (f.barbels === 2) {
        const c = shade(f.back, 0.8);
        for (let i = 1; i <= 4; i++) p.P(mx - 1 - i, colBot(mx - 1) + Math.ceil(i / 2), c);
        for (let i = 1; i <= 3; i++) p.P(mx - 1 - i, colTop(mx - 1) - Math.ceil(i / 2), c);
        p.P(mx + 1, my + 1, c);
    }
}

function applyPattern(f: FishBody, x: number, y: number, v: number, c: number, gillX: number): number {
    const body = x < gillX - 1 && v > 0.12 && v < 0.88;
    switch (f.pattern) {
        case 'scales':
            // 鳞：斜着错开的小弧，背和侧上看得出
            if (body && v < 0.75 && (x + (y % 2) * 2) % 4 === 0 && y % 2 === 0) return shade(c, 0.82);
            return c;
        case 'net':
            if (body && v < 0.8 && ((x + (y % 2) * 2) % 4 === 0 || (y % 2 === 1 && x % 4 === 1))) return shade(c, 0.72);
            return c;
        case 'blotch': {
            if (!body || v > 0.7) return c;
            const n = noise(Math.floor(x / 3), Math.floor((y + (x % 6 < 3 ? 0 : 1)) / 3), 7);
            return n < 0.45 ? f.mark! : c;
        }
        case 'marble': {
            if (!body || v > 0.8) return c;
            const n = noise(Math.floor(x / 2), Math.floor(y / 2), 3);
            if (n < 0.28) return f.mark!;
            if (noise(x, y, 11) < 0.08) return 0x1a160a;
            return c;
        }
        case 'dots':
            if (v > 0.7 && x % 2 === 0 && x < gillX) return f.mark!;
            return c;
        default:
            return c;
    }
}

function paintEel(p: Pen, l: { back: number; belly: number; mark: number }): void {
    const line = shade(l.back, 0.55);
    // 弯一道 S 形的长身子，头在右，尾巴越来越细
    const yAt = (x: number) => 8 + Math.sin(x * 0.33 + 0.6) * 3.2;
    for (let x = 1; x <= 30; x++) {
        const thick = x < 8 ? 1 + (x / 8) * 2.5 : x > 27 ? 3.5 - (x - 27) * 0.5 : 3.5;
        const yc = yAt(x);
        const top = Math.round(yc - thick / 2);
        const bot = Math.round(yc + thick / 2);
        for (let y = top; y <= bot; y++) {
            let c = y === top ? line : y === bot ? shade(l.belly, 0.7) : y - top < (bot - top) / 2 ? l.back : l.belly;
            if (y > top && y - top < (bot - top) / 2 && noise(x, y, 5) < 0.3) c = l.mark;
            p.P(x, y, c);
        }
    }
    const hy = Math.round(yAt(29));
    p.P(28, hy - 1, EYE);
    p.P(30, hy + 1, line);
    p.P(31, hy, shade(l.back, 0.7));
}

function paintCrayfish(p: Pen): void {
    const red = 0xb4261c;
    const dark = 0x6a140e;
    const light = 0xe0503a;
    const spot = 0xf2905e;
    // 尾扇
    p.R(0, 5, 1, 6, dark);
    p.R(1, 4, 2, 8, red);
    p.P(1, 4, dark);
    p.P(1, 11, dark);
    // 腹部一节一节，往前变宽
    for (let s = 0; s < 5; s++) {
        const x = 3 + s * 2;
        const hh = 2 + Math.min(2, Math.floor(s / 2));
        p.R(x, 8 - hh, 2, hh * 2, red);
        p.R(x, 8 - hh, 2, 1, light);
        p.R(x + 1, 8 - hh, 1, hh * 2, dark);
    }
    // 头胸甲，前面一根额角
    for (let x = 13; x <= 22; x++) {
        const hh = x < 20 ? 3 : 3 - (x - 19);
        p.R(x, 8 - hh, 1, hh * 2, red);
        p.P(x, 8 - hh, light);
        p.P(x, 7 + hh, dark);
        if ((x + 1) % 3 === 0) p.P(x, 7, spot);
    }
    p.R(23, 7, 2, 2, dark);
    // 腿：两边几根小短线
    for (const x of [14, 16, 18]) {
        p.P(x, 4, dark);
        p.P(x - 1, 3, dark);
        p.P(x, 11, dark);
        p.P(x - 1, 12, dark);
    }
    // 两只大钳子，往前伸
    for (const [y0, dir] of [[3, -1], [12, 1]] as [number, number][]) {
        // 胳膊
        for (let i = 0; i < 4; i++) p.P(20 + i, y0 + (dir > 0 ? -1 : 1) * Math.max(0, 1 - i), red);
        // 钳子：粗的一片，前端分叉
        p.R(23, y0 - 1, 6, 3, red);
        p.R(23, y0 - 1, 6, 1, dir < 0 ? light : red);
        p.R(23, y0 + 1, 6, 1, dir < 0 ? red : dark);
        p.P(24, y0, spot);
        p.P(26, y0, spot);
        p.R(29, y0 - 1, 2, 1, dark);
        p.R(29, y0 + 1, 3, 1, dark);
    }
    // 触须
    for (let i = 0; i < 6; i++) {
        p.P(25 + i, 6 - Math.floor(i / 2), 0x8a2a1c);
        p.P(25 + i, 9 + Math.floor(i / 2), 0x8a2a1c);
    }
    p.P(22, 6, EYE);
    p.P(22, 9, EYE);
}

function paintCrab(p: Pen): void {
    const shell = 0x4c5634;
    const shellLight = 0x6e7a4a;
    const shellDark = 0x2a301c;
    const leg = 0x5e6842;
    const hair = 0x8a6a36;
    const hairDark = 0x56401e;
    const cx = 16;
    const cy = 19;
    const line = (x0: number, y0: number, x1: number, y1: number, c: number) => {
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        for (let i = 0; i <= n; i++) p.P(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c);
    };
    // 腿：两边各四条，先往外伸再往下折，最后一节颜色深
    for (let i = 0; i < 4; i++) {
        for (const s of [-1, 1]) {
            const bx = cx + s * 8;
            const by = cy - 2 + i * 2;
            const kx = bx + s * (5 - Math.abs(i - 1.5));
            const ky = by - 2 + i;
            line(bx, by, kx, ky, leg);
            line(bx, by + 1, kx, ky + 1, shade(leg, 0.8));
            line(kx + s, ky + 1, kx + s * 2, ky + 5, shellDark);
        }
    }
    // 背甲：前宽后窄的圆角块，上半提亮
    for (let y = cy - 7; y <= cy + 6; y++) {
        const t = (y - (cy - 7)) / 13;
        const hw = Math.round(9.5 * Math.sqrt(Math.max(0, 1 - ((t - 0.4) / 0.62) ** 2)));
        for (let x = cx - hw; x <= cx + hw - 1; x++) {
            const edge = x === cx - hw || x === cx + hw - 1 || y === cy - 7 || y === cy + 6;
            let c = edge ? shellDark : y < cy - 3 ? shellLight : shell;
            if (!edge && noise(x, y, 9) < 0.1) c = shade(shell, 0.8);
            p.P(x, y, c);
        }
    }
    // 背甲上的 H 形沟纹
    for (let y = cy - 3; y <= cy + 2; y++) {
        p.P(cx - 3, y, shade(shell, 0.85));
        p.P(cx + 2, y, shade(shell, 0.85));
    }
    p.R(cx - 2, cy, 4, 1, shade(shell, 0.85));
    // 前缘的齿和两只眼
    for (const dx of [-7, -5, 4, 6]) p.P(cx + dx, cy - 8, shellDark);
    p.P(cx - 2, cy - 8, 0x101010);
    p.P(cx + 1, cy - 8, 0x101010);
    // 两只大螯：从背甲前角往上伸，掌上一团绒毛（大闸蟹的毛钳）
    for (const s of [-1, 1]) {
        const ax = cx + s * 6;
        line(ax, cy - 7, ax + s * 3, cy - 10, leg);
        line(ax + s, cy - 7, ax + s * 4, cy - 10, shade(leg, 0.8));
        const px = cx + s * 10;
        const py = cy - 13;
        for (let y = py - 3; y <= py + 3; y++) {
            for (let x = px - 3; x <= px + 3; x++) {
                if ((x - px) ** 2 / 10 + (y - py) ** 2 / 12 > 1) continue;
                p.P(x, y, noise(x, y, 4) < 0.45 ? hairDark : hair);
            }
        }
        // 钳指：两根往里弯
        line(px - s, py - 4, px - s * 3, py - 7, shellLight);
        line(px + s, py - 4, px - s, py - 8, shellDark);
    }
}

export function fishArt(p: Pen, l: Look): void {
    if (l.kind === 'fish') paintFish(p, l);
    else if (l.kind === 'eel') paintEel(p, l);
    else if (l.kind === 'crayfish') paintCrayfish(p);
    else paintCrab(p);
}
