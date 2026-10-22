import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WORLD } from './world';
import { bj } from './util';
import { deserialize, newGame, serialize, SAVE_VERSION } from '../assets/scripts/core/game';
import {
    doorAt, interiorFor, interiorGrid, interiorKey, interiorReachable, interiorTile, InteriorWorld, layoutInterior, villageDoors, WALL_ROWS,
} from '../assets/scripts/core/interior';
import { buy, describeItem, giftsOwned, ShopData, shopGoods } from '../assets/scripts/core/shop';
import { canPlace, place, storedCount } from '../assets/scripts/core/village';
import { countOf } from '../assets/scripts/core/inventory';
import { giveGift } from '../assets/scripts/core/npc';
import { findPath, gridFromRows } from '../assets/scripts/core/path';
import { FURNITURE } from '../assets/scripts/data/furniture';
import { INTERIORS } from '../assets/scripts/data/interiors';
import { SHOPS } from '../assets/scripts/data/shops';
import { GIFTS } from '../assets/scripts/data/gifts';
import { buildJiangnan } from '../tools/maps/jiangnan';
import { buildWestern } from '../tools/maps/western';

const T0 = bj(2026, 10, 21, 10);
const IW: InteriorWorld = { furniture: FURNITURE, recipes: INTERIORS };
const SD: ShopData = { shops: SHOPS, gifts: GIFTS };
const MAPS = join(__dirname, '..', 'assets', 'resources', 'maps');
const read = (f: string) => JSON.parse(readFileSync(join(MAPS, f), 'utf8'));
const fresh = () => newGame(WORLD, T0, 'p', 'jiangnan');
const KEYS = Array.from({ length: 12 }, (_, i) => `test:${i * 7},${i * 3}`);

test('室内：同一栋每次排得一样，同一配方不同房子排得不一样', () => {
    for (const id of Object.keys(INTERIORS)) {
        assert.deepEqual(layoutInterior(IW, id, 'a'), layoutInterior(IW, id, 'a'), id);
    }
    const shapes = new Set(KEYS.map((k) => JSON.stringify(layoutInterior(IW, 'jn_home', k))));
    assert.ok(shapes.size > KEYS.length / 2, `jn_home 只排出 ${shapes.size} 种`);
});

test('室内：每个配方在大小范围内，家具不出地面、不重叠，进门那格到出口和柜台前都走得到', () => {
    for (const recipe of Object.values(INTERIORS)) {
        for (const key of KEYS) {
            const L = layoutInterior(IW, recipe.id, key);
            assert.ok(L.w >= recipe.size.w[0] && L.w <= recipe.size.w[1] && L.h >= recipe.size.h[0] && L.h <= recipe.size.h[1], recipe.id);
            assert.deepEqual(L.exit, [Math.floor(L.w / 2), L.h - 1]);
            const used = new Set<string>();
            for (const it of L.items) {
                const def = FURNITURE[it.f];
                if (def.spot === 'hang') {
                    assert.ok(it.y === 1 && it.x >= 1 && it.x + def.art[0] <= L.w - 1, `${recipe.id} 的 ${it.f} 挂出墙了`);
                    continue;
                }
                for (let y = it.y; y < it.y + def.foot[1]; y++) {
                    for (let x = it.x; x < it.x + def.foot[0]; x++) {
                        assert.ok(x >= 1 && x <= L.w - 2 && y >= WALL_ROWS && y <= L.h - 2, `${recipe.id}/${key} 的 ${it.f} 出了地面`);
                        if (def.spot === 'rug') continue;
                        assert.ok(!used.has(`${x},${y}`), `${recipe.id}/${key} 的 ${it.f} 和别的家具重叠`);
                        used.add(`${x},${y}`);
                    }
                }
            }
            assert.ok(interiorReachable(IW, L), `${recipe.id}/${key} 有地方走不到`);
            assert.equal(!!recipe.keeper, !!L.keeper, `${recipe.id} 掌柜`);
            assert.equal(!!recipe.counter, !!L.counter, `${recipe.id} 柜台`);
        }
    }
});

test('室内：配方用的家具、掌柜、商店、图块、图集都对得上', () => {
    const frames = read('interior-frames.json') as Record<string, number[]>;
    const rows = (read('people-frames.json') as { rows: string[] }).rows;
    for (const f of Object.values(FURNITURE)) {
        assert.ok(frames[f.id], `家具 ${f.id} 不在 interior.png 里，重跑 npx tsx tools/gen-interiors.ts`);
        assert.deepEqual(frames[f.id].slice(2), [f.art[0] * 16, f.art[1] * 16], `${f.id} 图的大小`);
        assert.ok(f.art[0] >= f.foot[0] && (f.spot === 'hang' || f.art[1] >= f.foot[1]), `${f.id} 图比占地小`);
    }
    for (const r of Object.values(INTERIORS)) {
        for (const it of r.items) assert.ok(FURNITURE[it.f], `${r.id} 用了没有的家具 ${it.f}`);
        if (r.counter) assert.ok(FURNITURE[r.counter], `${r.id} 的柜台 ${r.counter}`);
        if (r.keeper) assert.ok(rows.includes(r.keeper.look), `${r.id} 的掌柜 ${r.keeper.look} 不在 people.png 里`);
        if (r.keeper?.npc) assert.ok(WORLD.npcs[r.keeper.npc], `${r.id} 的掌柜 ${r.keeper.npc} 不是镇民`);
        if (r.shop) assert.ok(SHOPS[r.shop], `${r.id} 的店 ${r.shop}`);
        for (const key of KEYS.slice(0, 3)) {
            const L = layoutInterior(IW, r.id, key);
            for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
                const name = interiorTile(r, L, x, y);
                assert.ok(frames[name], `${r.id} 用的图块 ${name} 不在 interior.png 里`);
            }
        }
    }
    for (const g of Object.values(GIFTS)) assert.ok(frames[g.sprite], `礼物 ${g.id} 没有图标`);
});

test('门：doors.json 是最新的，门前格都从出生点走得到，配方都有', () => {
    for (const [name, map] of [['jiangnan', buildJiangnan()], ['western', buildWestern()]] as const) {
        assert.deepEqual(read(`${name}.doors.json`), map.doors, '改了布局要重跑 npx tsx tools/gen-interiors.ts');
        assert.ok(map.doors.length >= 8, `${name} 只有 ${map.doors.length} 扇门`);
        const grid = gridFromRows(map.walk);
        const ids = new Set<string>();
        for (const d of map.doors) {
            assert.ok(!ids.has(d.id), `${name} 门 ${d.id} 重复`);
            ids.add(d.id);
            if (d.recipe !== null) assert.ok(INTERIORS[d.recipe], `${name} 门 ${d.id} 的配方 ${d.recipe} 没有`);
            const [fx, fy] = d.front;
            assert.equal(map.walk[fy][fx], '.', `${name} 门 ${d.id} 门前 (${fx},${fy}) 被挡住`);
            assert.ok(findPath(grid, map.spawn, (x, y) => x === fx && y === fy), `${name} 门 ${d.id} 走不到`);
            assert.equal(doorAt(map.doors, fx, fy), d);
        }
    }
});

test('门：自家房子有室内的才有门，鸡舍这类说进不去', () => {
    const homes = Object.values(WORLD.buildings).filter((b) => b.interior !== undefined);
    assert.ok(homes.some((b) => b.interior) && homes.some((b) => b.interior === null));
    const items = [
        { uid: 1, def: 'house', x: 2, y: 2 },
        { uid: 2, def: 'well', x: 9, y: 2 },
    ];
    const doors = villageDoors(WORLD.buildings, items, (def) => def.foot[1] + 1);
    assert.equal(doors.length, 1);
    const d = doors[0];
    assert.equal(d.id, 'v:1');
    assert.equal(interiorKey('village', d), 'v:1');
    assert.equal(d.recipe, WORLD.buildings.house.interior);
    const [fw, fh] = WORLD.buildings.house.foot;
    assert.deepEqual(d.front, [2 + Math.floor(fw / 2), 2 + fh]);
    assert.equal(doorAt(doors, 2, 2 + fh - 1), d);
    assert.equal(doorAt(doors, 2, 2 - 1), d, '点屋顶也算');
    assert.equal(interiorKey('jiangnan', { ...d, id: '3,4' }), 'jiangnan:3,4');
});

test('存档第 8 版：记人在哪，屋里摆过的家具优先；第 7 版存档迁移成站在自己地盘', () => {
    assert.equal(SAVE_VERSION, 8);
    const s = fresh();
    assert.deepEqual(s.at, { scene: 'village', town: '', x: -1, y: -1, inside: null });
    assert.deepEqual(s.interiors, {});
    s.at = { scene: 'town', town: 'jiangnan', x: 10, y: 20, inside: { key: 'jiangnan:1,2', recipe: 'jn_home', x: 3, y: 5 } };
    s.interiors['v:1'] = { items: [{ f: 'jn_bed', x: 1, y: 3 }, { f: 'nope', x: 5, y: 5 }] };
    const back = deserialize(serialize(s), WORLD);
    assert.deepEqual(back, s);
    const L = interiorFor(IW, back, 'jn_home', 'v:1');
    assert.deepEqual(L.items, [{ f: 'jn_bed', x: 1, y: 3 }], '存档的家具优先，认不出的丢掉');

    const v7 = JSON.parse(serialize(fresh()));
    v7.version = 7;
    delete v7.at;
    delete v7.interiors;
    const m = deserialize(JSON.stringify(v7), WORLD);
    assert.equal(m.version, 8);
    assert.deepEqual(m.at, { scene: 'village', town: '', x: -1, y: -1, inside: null });
    assert.deepEqual(m.interiors, {});

    const bad = JSON.parse(serialize(fresh()));
    bad.at = { scene: 'town', town: '没有这座镇', x: 3.7, y: 'x', inside: { key: 1 } };
    assert.deepEqual(deserialize(JSON.stringify(bad), WORLD).at, { scene: 'village', town: '', x: -1, y: -1, inside: null });
    bad.at = { scene: 'town', town: 'jiangnan', x: 3.7, y: 'x', inside: { key: 'k', recipe: 'jn_home', x: 2, y: 4 } };
    assert.deepEqual(deserialize(JSON.stringify(bad), WORLD).at,
        { scene: 'town', town: 'jiangnan', x: 3, y: -1, inside: { key: 'k', recipe: 'jn_home', x: 2, y: 4 } });
});

test('商店：货都认得出，种子按季节、价格排；买了进背包扣钱，钱不够不买', () => {
    for (const shop of Object.values(SHOPS)) {
        for (const g of shop.goods) assert.ok(describeItem(WORLD, SD, g.item), `${shop.id} 卖的 ${g.item} 认不出`);
        const lines = shopGoods(WORLD, SD, shop.id, 'jiangnan', T0);
        assert.ok(lines.length > 0, `${shop.id} 什么都不卖`);
    }
    const seeds = shopGoods(WORLD, SD, 'jn_grocery', 'jiangnan', T0).filter((l) => l.kind === 'seed');
    assert.ok(seeds.length > 0, '杂货铺不卖种子');
    for (let i = 1; i < seeds.length; i++) assert.ok(seeds[i].price >= seeds[i - 1].price);
    const s = fresh();
    s.gold = 30;
    const tea = describeItem(WORLD, SD, 'gift:longjing')!;
    assert.deepEqual(buy(s, tea, 1), { ok: false, reason: '金币不够' });
    s.gold = 200;
    assert.equal(buy(s, tea, 2).ok, true);
    assert.equal(s.gold, 200 - 2 * tea.price);
    assert.equal(countOf(s, 'gift:longjing'), 2);
    assert.deepEqual(giftsOwned(s, SD).map((g) => [g.item, g.n]), [['gift:longjing', 2]]);
});

test('建造物：仓库里有就不扣钱，摆一件少一件；没有照常扣钱', () => {
    const s = fresh();
    s.gold = 0;
    assert.equal(canPlace(WORLD, s, 'well', 1, 1).ok, false);
    s.inventory['build:well'] = 1;
    assert.equal(storedCount(s, 'well'), 1);
    assert.equal(canPlace(WORLD, s, 'well', 1, 1).ok, true);
    assert.equal(place(WORLD, s, 'well', 1, 1).ok, true);
    assert.equal(s.gold, 0);
    assert.equal(storedCount(s, 'well'), 0);
    s.gold = WORLD.buildings.well.price;
    assert.equal(place(WORLD, s, 'well', 5, 5).ok, true);
    assert.equal(s.gold, 0);
});

test('送礼：桂姨最爱桂花糕，一天只收一份', () => {
    const s = fresh();
    s.inventory['gift:osmanthus_cake'] = 2;
    const before = s.npcs.gui.affinity;
    const r = giveGift(s, WORLD, 'gui', 'gift:osmanthus_cake', T0);
    assert.ok(r.ok && r.reaction === 'love');
    assert.ok(s.npcs.gui.affinity > before);
    assert.equal(giveGift(s, WORLD, 'gui', 'gift:osmanthus_cake', T0).ok, false);
    assert.equal(countOf(s, 'gift:osmanthus_cake'), 1);
});

test('室内挡路表：出口能站，墙和掌柜挡路', () => {
    const L = layoutInterior(IW, 'jn_grocery', 'jiangnan:1,1');
    const g = interiorGrid(IW, L);
    assert.equal(g.block[L.exit[1] * L.w + L.exit[0]], 0);
    assert.equal(g.block[0], 1);
    assert.equal(g.block[(L.h - 1) * L.w], 1);
    assert.ok(L.keeper);
    assert.equal(g.block[L.keeper![1] * L.w + L.keeper![0]], 1);
});
