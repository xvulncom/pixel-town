// 生成占位像素图块和江南水乡地图（Tiled .tmx）。正式美术到位前先用它跑通显示和拖动。
// 用法：npx tsx tools/gen-map.ts
// 输出：assets/resources/maps/town-tiles.png、assets/resources/maps/jiangnan.tmx

import { deflateSync, crc32 } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mulberry32 } from '../assets/scripts/core/rng';

const TILE = 16;
const COLS = 8;
const ROWS = 3;

// ---------- PNG ----------

class Canvas {
    readonly w: number;
    readonly h: number;
    readonly px: Uint8Array;

    constructor(w: number, h: number) {
        this.w = w;
        this.h = h;
        this.px = new Uint8Array(w * h * 4);
    }

    set(x: number, y: number, c: number): void {
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
        const i = (y * this.w + x) * 4;
        this.px[i] = (c >> 16) & 0xff;
        this.px[i + 1] = (c >> 8) & 0xff;
        this.px[i + 2] = c & 0xff;
        this.px[i + 3] = 0xff;
    }

    toPng(): Buffer {
        const stride = this.w * 4;
        const raw = Buffer.alloc((stride + 1) * this.h);
        for (let y = 0; y < this.h; y++) {
            raw[y * (stride + 1)] = 0;
            Buffer.from(this.px.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
        }
        const chunk = (type: string, data: Buffer): Buffer => {
            const len = Buffer.alloc(4);
            len.writeUInt32BE(data.length);
            const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
            const crc = Buffer.alloc(4);
            crc.writeUInt32BE(crc32(td));
            return Buffer.concat([len, td, crc]);
        };
        const ihdr = Buffer.alloc(13);
        ihdr.writeUInt32BE(this.w, 0);
        ihdr.writeUInt32BE(this.h, 4);
        ihdr[8] = 8;
        ihdr[9] = 6;
        return Buffer.concat([
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
            chunk('IHDR', ihdr),
            chunk('IDAT', deflateSync(raw)),
            chunk('IEND', Buffer.alloc(0)),
        ]);
    }
}

/** 在第 index 个图块里画画，坐标是图块内 0～15。 */
type Painter = (set: (x: number, y: number, c: number) => void, rnd: () => number) => void;

function fill(set: (x: number, y: number, c: number) => void, rnd: () => number, base: number, dark: number, light: number, pd = 0.12, pl = 0.08): void {
    for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
            const r = rnd();
            set(x, y, r < pd ? dark : r < pd + pl ? light : base);
        }
    }
}

function disc(set: (x: number, y: number, c: number) => void, cx: number, cy: number, r: number, c: number): void {
    for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
            if (x * x + y * y <= r * r + r * 0.6) set(cx + x, cy + y, c);
        }
    }
}

const GRASS = (s: Parameters<Painter>[0], r: () => number) => fill(s, r, 0x5fae3a, 0x4e9631, 0x78c64d);

const WALL = (s: Parameters<Painter>[0], r: () => number) => {
    fill(s, r, 0xefebe2, 0xe2ddd2, 0xf7f4ee, 0.08, 0.05);
    for (let x = 0; x < TILE; x++) {
        s(x, 13, 0xd6d0c2);
        s(x, 14, 0xc9c2b2);
        s(x, 15, 0x9b9485);
    }
};

const TILES: Painter[] = [
    // 0 草地
    GRASS,
    // 1 草丛
    (s, r) => {
        GRASS(s, r);
        for (const [x, y] of [[3, 5], [10, 3], [7, 11], [13, 12]]) {
            s(x, y, 0x3f7f28); s(x + 1, y - 1, 0x3f7f28); s(x + 2, y, 0x3f7f28);
        }
    },
    // 2 野花
    (s, r) => {
        GRASS(s, r);
        const flowers: [number, number, number][] = [[4, 4, 0xffffff], [11, 6, 0xf26b6b], [6, 12, 0xf7d54a]];
        for (const [x, y, c] of flowers) {
            s(x - 1, y, c); s(x + 1, y, c); s(x, y - 1, c); s(x, y + 1, c); s(x, y, 0xf7d54a);
        }
    },
    // 3 土路
    (s, r) => fill(s, r, 0xc29a63, 0xa88252, 0xd4ad76, 0.15, 0.1),
    // 4 耕地
    (s, r) => {
        fill(s, r, 0x6e4529, 0x5e3b23, 0x7a4e30, 0.1, 0.06);
        for (let y = 1; y < TILE; y += 4) {
            for (let x = 0; x < TILE; x++) {
                s(x, y, 0x86573a);
                s(x, y + 2, 0x4f311d);
            }
        }
    },
    // 5 水面
    (s, r) => {
        fill(s, r, 0x3d7fd6, 0x3570c0, 0x4a8be0, 0.1, 0.1);
        for (let i = 0; i < 4; i++) {
            const x = Math.floor(r() * 12);
            const y = Math.floor(r() * 15);
            for (let k = 0; k < 4; k++) s(x + k, y, 0x8fc0f5);
        }
    },
    // 6 石板地
    (s, r) => {
        for (let y = 0; y < TILE; y++) {
            for (let x = 0; x < TILE; x++) {
                const off = Math.floor(y / 8) % 2 === 0 ? 0 : 4;
                const edge = y % 8 === 7 || (x + off) % 8 === 7;
                s(x, y, edge ? 0x85807a : r() < 0.1 ? 0x9b958c : 0xaba59c);
            }
        }
    },
    // 7 木桥（竖向过河）
    (s, r) => {
        fill(s, r, 0xa0703e, 0x8e6235, 0xad7c48, 0.1, 0.08);
        for (let y = 3; y < TILE; y += 4) for (let x = 0; x < TILE; x++) s(x, y, 0x7a5230);
        for (let y = 0; y < TILE; y++) { s(0, y, 0x5c3c22); s(1, y, 0x6d4a2b); s(14, y, 0x6d4a2b); s(15, y, 0x5c3c22); }
    },
    // 8 树（透明底）
    (s) => {
        for (let y = 11; y < 16; y++) { s(7, y, 0x6d4c2f); s(8, y, 0x5a3e26); }
        disc(s, 8, 6, 6, 0x1f5a24);
        disc(s, 8, 6, 5, 0x2f7d32);
        disc(s, 6, 4, 2, 0x4caf50);
        s(10, 7, 0x256b29);
    },
    // 9 灌木
    (s) => {
        disc(s, 8, 11, 4, 0x2a6e2d);
        disc(s, 8, 11, 3, 0x3d8b40);
        s(7, 9, 0x5cb860); s(9, 10, 0xf26b6b);
    },
    // 10 篱笆
    (s) => {
        for (const x of [2, 13]) for (let y = 5; y < 16; y++) { s(x, y, 0x8a5c33); s(x + 1, y, 0x6d4729); }
        for (const y of [8, 12]) for (let x = 0; x < TILE; x++) { s(x, y, 0xa8763f); s(x, y + 1, 0x7a5230); }
    },
    // 11 红瓦屋顶
    (s, r) => {
        fill(s, r, 0xb5413a, 0xa63a34, 0xc24d45, 0.08, 0.06);
        for (let y = 3; y < TILE; y += 4) for (let x = 0; x < TILE; x++) s(x, y, 0x8e2f2a);
        for (let y = 0; y < TILE; y++) s(((Math.floor(y / 4) % 2) * 4 + 7) % 16, y, 0x9c3530);
    },
    // 12 黛瓦屋顶（江南）
    (s, r) => {
        fill(s, r, 0x4d5361, 0x454b58, 0x58606e, 0.08, 0.06);
        for (let y = 3; y < TILE; y += 4) for (let x = 0; x < TILE; x++) { s(x, y, 0x30343d); s(x, y - 1, 0x66707f); }
    },
    // 13 白墙
    WALL,
    // 14 白墙 + 门
    (s, r) => {
        WALL(s, r);
        for (let y = 5; y < 16; y++) for (let x = 5; x < 11; x++) s(x, y, x === 5 || x === 10 || y === 5 ? 0x4a2d19 : 0x6b4226);
        s(9, 10, 0xe0b84a);
    },
    // 15 白墙 + 窗
    (s, r) => {
        WALL(s, r);
        for (let y = 3; y < 11; y++) for (let x = 4; x < 12; x++) {
            const frame = x === 4 || x === 11 || y === 3 || y === 10 || x === 7 || x === 8 || y === 6;
            s(x, y, frame ? 0x6b4226 : 0x9fd3ef);
        }
    },
    // 16 红砖墙（东北）
    (s) => {
        for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
            const off = Math.floor(y / 4) % 2 === 0 ? 0 : 4;
            s(x, y, y % 4 === 3 || (x + off) % 8 === 7 ? 0xd8bfa8 : 0xa64b3c);
        }
    },
    // 17 菜苗（透明底，种在耕地上）
    (s) => {
        for (const [cx, cy] of [[4, 6], [12, 6], [4, 14], [12, 14]]) {
            s(cx, cy, 0x2f7d32); s(cx, cy - 1, 0x2f7d32);
            s(cx - 1, cy - 2, 0x5cb860); s(cx + 1, cy - 2, 0x5cb860); s(cx - 2, cy - 3, 0x5cb860); s(cx + 2, cy - 3, 0x5cb860);
        }
    },
    // 18 红灯笼（透明底）
    (s) => {
        for (let y = 0; y < 4; y++) s(8, y, 0x3a2a1a);
        disc(s, 8, 8, 4, 0xc8302a);
        for (let y = 5; y < 12; y++) s(8, y, 0xe0504a);
        for (let x = 6; x < 11; x++) { s(x, 4, 0xe0b84a); s(x, 12, 0xe0b84a); }
        for (let y = 13; y < 16; y++) s(8, y, 0xe0b84a);
    },
];

export const T = {
    grass: 0, tuft: 1, flowers: 2, dirt: 3, soil: 4, water: 5, stone: 6, bridge: 7,
    tree: 8, bush: 9, fence: 10, roofRed: 11, roofGrey: 12, wall: 13, wallDoor: 14, wallWindow: 15,
    brick: 16, sprout: 17, lantern: 18,
} as const;

function drawTileset(): Canvas {
    const c = new Canvas(COLS * TILE, ROWS * TILE);
    TILES.forEach((paint, i) => {
        const ox = (i % COLS) * TILE;
        const oy = Math.floor(i / COLS) * TILE;
        const rnd = mulberry32(1000 + i);
        paint((x, y, col) => {
            if (x >= 0 && y >= 0 && x < TILE && y < TILE) c.set(ox + x, oy + y, col);
        }, rnd);
    });
    return c;
}

// ---------- 地图 ----------

const W = 48;
const H = 32;
const EMPTY = -1;

function buildJiangnan(): { ground: number[]; deco: number[] } {
    const rnd = mulberry32(20261016);
    const ground = new Array<number>(W * H).fill(T.grass);
    const deco = new Array<number>(W * H).fill(EMPTY);
    const at = (x: number, y: number) => y * W + x;
    const setG = (x: number, y: number, t: number) => { if (x >= 0 && y >= 0 && x < W && y < H) ground[at(x, y)] = t; };
    const setD = (x: number, y: number, t: number) => { if (x >= 0 && y >= 0 && x < W && y < H) deco[at(x, y)] = t; };
    const rect = (x0: number, y0: number, w: number, h: number, f: (x: number, y: number) => void) => {
        for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) f(x, y);
    };

    // 草地变化
    for (let i = 0; i < W * H; i++) {
        const r = rnd();
        ground[i] = r < 0.12 ? T.tuft : r < 0.16 ? T.flowers : T.grass;
    }
    // 河：横穿小镇
    rect(0, 15, W, 3, (x, y) => setG(x, y, T.water));
    // 道路
    rect(4, 10, 41, 2, (x, y) => setG(x, y, T.dirt));
    rect(4, 21, 41, 2, (x, y) => setG(x, y, T.dirt));
    for (const x of [12, 33]) {
        rect(x, 3, 2, 26, (xx, y) => setG(xx, y, y >= 15 && y <= 17 ? T.bridge : T.dirt));
    }
    // 镇中心石板广场
    rect(18, 2, 12, 7, (x, y) => setG(x, y, T.stone));
    for (const x of [18, 21, 26, 29]) setD(x, 2, T.lantern);

    // 民居：两排黛瓦，屋顶两行、墙一行
    const house = (x: number, y: number, roof: number) => {
        rect(x, y, 3, 2, (xx, yy) => setD(xx, yy, roof));
        setD(x, y + 2, T.wallWindow);
        setD(x + 1, y + 2, T.wallDoor);
        setD(x + 2, y + 2, T.wallWindow);
    };
    for (const x of [3, 7, 14]) house(x, 5, T.roofGrey);
    for (const x of [31, 36, 41]) house(x, 5, T.roofGrey);
    // 桂姨的杂货铺：红瓦，靠河
    house(22, 12, T.roofRed);
    // 老周的木工坊：河对岸
    house(38, 18, T.roofGrey);

    // 农田：六块，每块 3×2，篱笆围起来
    rect(15, 24, 13, 1, (x, y) => setD(x, y, T.fence));
    rect(15, 30, 13, 1, (x, y) => setD(x, y, T.fence));
    for (const [px, py] of [[16, 25], [20, 25], [24, 25], [16, 28], [20, 28], [24, 28]]) {
        rect(px, py, 3, 2, (x, y) => setG(x, y, T.soil));
    }
    rect(16, 25, 3, 2, (x, y) => setD(x, y, T.sprout));

    // 树：四周一圈，空地零星几棵
    const free = (x: number, y: number) =>
        deco[at(x, y)] === EMPTY && [T.grass, T.tuft, T.flowers].includes(ground[at(x, y)] as 0 | 1 | 2);
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const border = x < 2 || x >= W - 2 || y < 2 || y >= H - 1;
            const p = border ? 0.65 : 0.04;
            if (free(x, y) && rnd() < p) setD(x, y, rnd() < 0.8 ? T.tree : T.bush);
        }
    }
    return { ground, deco };
}

function layerData(tiles: number[]): string {
    const buf = Buffer.alloc(tiles.length * 4);
    tiles.forEach((t, i) => buf.writeUInt32LE(t === EMPTY ? 0 : t + 1, i * 4));
    return buf.toString('base64');
}

function toTmx(map: { ground: number[]; deco: number[] }): string {
    const layer = (id: number, name: string, tiles: number[]) =>
        `  <layer id="${id}" name="${name}" width="${W}" height="${H}">\n`
        + `    <data encoding="base64">${layerData(tiles)}</data>\n`
        + '  </layer>\n';
    return '<?xml version="1.0" encoding="UTF-8"?>\n'
        + `<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" width="${W}" height="${H}" tilewidth="${TILE}" tileheight="${TILE}" infinite="0" nextlayerid="3" nextobjectid="1">\n`
        + `  <tileset firstgid="1" name="town" tilewidth="${TILE}" tileheight="${TILE}" tilecount="${COLS * ROWS}" columns="${COLS}">\n`
        + `    <image source="town-tiles.png" width="${COLS * TILE}" height="${ROWS * TILE}"/>\n`
        + '  </tileset>\n'
        + layer(1, 'ground', map.ground)
        + layer(2, 'deco', map.deco)
        + '</map>\n';
}

/** 把整张地图拼成一张图，方便不开 Cocos 也能看效果。 */
function renderPreview(tiles: Canvas, map: { ground: number[]; deco: number[] }, scale: number): Canvas {
    const c = new Canvas(W * TILE * scale, H * TILE * scale);
    const blit = (t: number, tx: number, ty: number) => {
        const sx = (t % COLS) * TILE;
        const sy = Math.floor(t / COLS) * TILE;
        for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
            const i = ((sy + y) * tiles.w + sx + x) * 4;
            if (tiles.px[i + 3] === 0) continue;
            const col = (tiles.px[i] << 16) | (tiles.px[i + 1] << 8) | tiles.px[i + 2];
            for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
                c.set((tx * TILE + x) * scale + dx, (ty * TILE + y) * scale + dy, col);
            }
        }
    };
    for (let i = 0; i < W * H; i++) {
        blit(map.ground[i], i % W, Math.floor(i / W));
        if (map.deco[i] !== EMPTY) blit(map.deco[i], i % W, Math.floor(i / W));
    }
    return c;
}

const out = join(__dirname, '..', 'assets', 'resources', 'maps');
mkdirSync(out, { recursive: true });
const tileset = drawTileset();
const jiangnan = buildJiangnan();
writeFileSync(join(out, 'town-tiles.png'), tileset.toPng());
writeFileSync(join(out, 'jiangnan.tmx'), toTmx(jiangnan));
console.log(`written to ${out}`);

const previewIdx = process.argv.indexOf('--preview');
if (previewIdx > 0) {
    const dir = process.argv[previewIdx + 1];
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'jiangnan-preview.png'), renderPreview(tileset, jiangnan, 2).toPng());
    console.log(`preview written to ${dir}`);
}
