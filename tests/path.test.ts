import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Cell, findPath, gridFromRows, gridToRows, nearestWalkable, planWalk, walkable, WalkGrid } from '../assets/scripts/core/path';
import { pathLength, poseAlong } from '../assets/scripts/core/walk';
import { walkGrid } from '../assets/scripts/core/village';
import { buildJiangnan } from '../tools/maps/jiangnan';
import { WORLD } from '../assets/scripts/data/world';
import { VillageState } from '../assets/scripts/core/types';

/** 路线上每一格都能走、相邻拐点横平竖直 */
function assertWalkable(g: WalkGrid, path: Cell[]): void {
    for (let i = 1; i < path.length; i++) {
        const [x0, y0] = path[i - 1];
        const [x1, y1] = path[i];
        assert.ok(x0 === x1 || y0 === y1, `第 ${i} 段是斜的`);
        const n = Math.abs(x1 - x0) + Math.abs(y1 - y0);
        for (let k = 1; k <= n; k++) {
            const x = x0 + Math.sign(x1 - x0) * k;
            const y = y0 + Math.sign(y1 - y0) * k;
            assert.ok(walkable(g, x, y), `(${x},${y}) 挡路`);
        }
    }
}

const ROOM = gridFromRows([
    '..........',
    '.####.....',
    '.#..#.###.',
    '.#..#...#.',
    '.##.#####.',
    '..........',
]);

test('寻路：绕开墙，步数最少，只留拐点', () => {
    const p = findPath(ROOM, [0, 0], (x, y) => x === 9 && y === 5)!;
    assert.ok(p);
    assertWalkable(ROOM, p);
    assert.equal(pathLength(p), 14);
    // 同样 14 步里拐弯最少：贴着外沿一个 L 形
    assert.equal(p.length, 3);
});

test('寻路：走进围起来的屋子要从缺口进', () => {
    const p = findPath(ROOM, [0, 5], (x, y) => x === 2 && y === 2)!;
    assertWalkable(ROOM, p);
    assert.deepEqual(p[p.length - 1], [2, 2]);
    assert.ok(p.some(([x, y]) => x === 3 && y >= 4), '要从下边缺口 (3,4) 进去');
});

test('寻路：起点就是目标、目标走不到', () => {
    assert.deepEqual(findPath(ROOM, [0, 0], (x, y) => x === 0 && y === 0), [[0, 0]]);
    const walled = gridFromRows(['.#.', '.#.', '.#.']);
    assert.equal(findPath(walled, [0, 0], (x, y) => x === 2 && y === 0), null);
});

test('点地面：onto 站进去；点到墙改成走到旁边；beside 停在紧挨着的格子', () => {
    const onto = planWalk(ROOM, [0, 0], { x: 6, y: 0, w: 1, h: 1 }, 'onto')!;
    assert.deepEqual(onto.path[onto.path.length - 1], [6, 0]);
    assert.ok(onto.reached);
    // 点在墙上：走到墙边
    const wall = planWalk(ROOM, [0, 0], { x: 7, y: 2, w: 1, h: 1 }, 'onto')!;
    const [ex, ey] = wall.path[wall.path.length - 1];
    assert.equal(Math.abs(ex - 7) + Math.abs(ey - 2), 1);
    // 一块 2×2 的告示栏：停在四边紧挨着的格子
    const board = planWalk(ROOM, [9, 5], { x: 6, y: 2, w: 2, h: 1 }, 'beside')!;
    const [bx, by] = board.path[board.path.length - 1];
    assert.ok(board.reached);
    assert.ok((by === 1 && bx >= 6 && bx <= 7) || (by === 3 && bx >= 6 && bx <= 7), `停在 (${bx},${by})`);
});

test('点到走不过去的地方：走到离它最近能到的格子', () => {
    const g = gridFromRows(['....#..', '....#..', '....#..']);
    const p = planWalk(g, [0, 1], { x: 6, y: 1, w: 1, h: 1 }, 'onto')!;
    assert.equal(p.reached, false);
    assert.deepEqual(p.path[p.path.length - 1], [3, 1]);
});

test('起点被盖住也能走出来；出生点被挡就找最近空格', () => {
    const g = gridFromRows(['...', '.#.', '...']);
    const p = findPath(g, [1, 1], (x, y) => x === 1 && y === 0)!;
    assert.deepEqual(p, [[1, 1], [1, 0]]);
    const n = nearestWalkable(g, 1, 1)!;
    assert.equal(Math.abs(n[0] - 1) + Math.abs(n[1] - 1), 1);
    assert.equal(nearestWalkable(gridFromRows(['##']), 0, 0), null);
});

test('沿路线走：按距离给位置朝向，到头站住', () => {
    const path: Cell[] = [[0, 0], [3, 0], [3, 2]];
    assert.deepEqual(poseAlong(path, 1.5), { x: 1.5, y: 0, dir: 'right', moving: true, frame: poseAlong(path, 1.5).frame });
    const q = poseAlong(path, 4);
    assert.equal(q.x, 3);
    assert.equal(q.y, 1);
    assert.equal(q.dir, 'down');
    const end = poseAlong(path, 99);
    assert.deepEqual([end.x, end.y, end.dir, end.moving, end.frame], [3, 2, 'down', false, 0]);
    assert.equal(poseAlong([[2, 2]], 0).moving, false);
});

test('挡路表文本来回转不丢', () => {
    assert.deepEqual(gridToRows(ROOM), gridToRows(gridFromRows(gridToRows(ROOM))));
});

// ---------- 镇子 ----------

const map = buildJiangnan();
const town = gridFromRows(map.walk);

test('江南镇子：出生点能站，镇民路线上都能走，招工处和各地点都走得到旁边', () => {
    assert.equal(town.w, map.w);
    assert.equal(town.h, map.h);
    assert.ok(walkable(town, ...map.spawn), '出生点挡路');
    for (const wk of map.walkers) assertWalkable(town, wk.path);
    for (const p of map.places) {
        const plan = planWalk(town, map.spawn, p, 'beside');
        assert.ok(plan?.reached, `从广场走不到 ${p.id} 旁边`);
        assertWalkable(town, plan!.path);
    }
});

test('江南镇子：挡路表里水面挡、桥能过、房子挡', () => {
    let water = 0;
    let solid = 0;
    for (let i = 0; i < town.block.length; i++) {
        if (town.block[i]) (map.deco[i] === -1 ? water++ : solid++);
    }
    assert.ok(water > 1000, '大河、湖面应该挡路');
    assert.ok(solid > 1000, '房子、树应该挡路');
    // 广场到河南岸要过桥：能走到就说明桥是通的
    const south = planWalk(town, map.spawn, { x: map.spawn[0], y: map.spawn[1] + 40, w: 1, h: 1 }, 'onto');
    assert.ok(south?.reached, '过不了河');
    assert.ok(south!.path[south!.path.length - 1][1] > 34 + 28, '应该走到河南岸');
});

test('江南镇子：仓库里的 walk.json 是最新生成的', () => {
    const file = JSON.parse(readFileSync(join(__dirname, '..', 'assets', 'resources', 'maps', 'jiangnan.walk.json'), 'utf8'));
    assert.deepEqual(file, { spawn: map.spawn, rows: map.walk }, '改了布局要重跑 npx tsx tools/gen-map.ts');
});

// ---------- 自己地盘 ----------

test('地盘挡路：房子和水挡，路、菜地、木桥、晒谷场能走', () => {
    const v: VillageState = {
        tier: 'town', nextUid: 10, cleared: [],
        items: [
            { uid: 1, def: 'house', x: 2, y: 2 },
            { uid: 2, def: 'field', x: 10, y: 10 },
            { uid: 3, def: 'pond', x: 12, y: 10 },
            { uid: 4, def: 'threshing', x: 20, y: 30 },
            { uid: 5, def: 'road_dirt', x: 11, y: 10 },
        ],
    };
    const g = walkGrid(WORLD, v);
    assert.ok(!walkable(g, 2, 2) && !walkable(g, 7, 3), '民居 6×2 挡路');
    assert.ok(walkable(g, 2, 1), '屋顶那几行不挡（人走到屋后被屋顶盖住）');
    assert.ok(walkable(g, 10, 10) && walkable(g, 11, 10), '菜地和路能走');
    assert.ok(!walkable(g, 12, 10), '池塘挡路');
    assert.ok(walkable(g, 21, 31), '晒谷场能走');
    // 天然地貌：没开荒的挡路，开荒后能走
    const wild = WORLD.villageWild.find((d) => d.x + d.w <= g.w && d.y + d.h <= g.h)!;
    assert.ok(!walkable(g, wild.x, wild.y), `${wild.name} 挡路`);
    const g2 = walkGrid(WORLD, { ...v, cleared: [wild.id] });
    assert.ok(walkable(g2, wild.x, wild.y), `${wild.name} 开荒后能走`);
});

test('地盘挡路：溪水上架了木桥就能过', () => {
    const stream = WORLD.villageWild.find((d) => d.terrain === 'water' && d.x + d.w <= 36 && d.y + d.h <= 44)!;
    assert.ok(stream, '村庄档里应有溪水');
    const v: VillageState = { tier: 'village', nextUid: 2, cleared: [], items: [{ uid: 1, def: 'bridge', x: stream.x, y: stream.y }] };
    const g = walkGrid(WORLD, v);
    assert.ok(walkable(g, stream.x, stream.y), '桥上能走');
    if (stream.w * stream.h > 1) {
        const other: Cell = stream.w > 1 ? [stream.x + 1, stream.y] : [stream.x, stream.y + 1];
        assert.ok(!walkable(g, ...other), '没架桥的溪水挡路');
    }
});
