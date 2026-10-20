import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD } from './world';
import { deserialize, newGame, SAVE_VERSION, serialize } from '../assets/scripts/core/game';
import { activeWild, canPlace, clearWild, E, N, occupancy, place, removeAt, S, terrainGrid, terrainMask, W, wildAt } from '../assets/scripts/core/village';
import { borderDecor, borderGround, outside } from '../assets/scripts/core/border';
import { bj } from './util';

const T0 = bj(2026, 10, 21, 8);
const fresh = () => newGame(WORLD, T0, 'p', 'jiangnan');
const wild = (id: string) => WORLD.villageWild.find((d) => d.id === id)!;

test('天然地貌：每块都在城市那么大的地盘里，互相不重叠，开局菜地路也不压着', () => {
    const [cw, ch] = WORLD.tiers.city.size;
    const seen = new Map<string, string>();
    for (const d of WORLD.villageWild) {
        assert.ok(d.x >= 0 && d.y >= 0 && d.x + d.w <= cw && d.y + d.h <= ch, `${d.id} 出界`);
        assert.ok(d.terrain === 'water' || d.sprite, `${d.id} 既不是水也没有图`);
        for (let y = d.y; y < d.y + d.h; y++) {
            for (let x = d.x; x < d.x + d.w; x++) {
                const k = `${x},${y}`;
                assert.ok(!seen.has(k), `${d.id} 和 ${seen.get(k)} 重叠在 ${k}`);
                seen.set(k, d.id);
            }
        }
    }
    const s = fresh();
    assert.deepEqual(s.village.cleared, []);
    assert.ok(activeWild(WORLD, s.village).length > 5, '村庄档就该有几处天然地貌');
    // 升档后更大的地方出现新地貌
    const before = activeWild(WORLD, s.village).length;
    s.village.tier = 'city';
    assert.ok(activeWild(WORLD, s.village).length > before);
});

test('天然地貌：没开荒不能盖，开荒扣钱后能盖；钱不够开不了', () => {
    const s = fresh();
    const rock = wild('rock_2');
    assert.deepEqual(canPlace(WORLD, s, 'jar', rock.x, rock.y), { ok: false, reason: '这里是大石头，要先开荒' });
    assert.equal(wildAt(WORLD, s.village, rock.x + 1, rock.y)?.id, 'rock_2');
    s.gold = rock.price - 1;
    assert.equal(clearWild(WORLD, s, rock.x, rock.y).ok, false);
    s.gold = 500;
    const r = clearWild(WORLD, s, rock.x + 1, rock.y);
    assert.equal(r.ok, true);
    assert.equal(s.gold, 500 - rock.price);
    assert.ok(s.village.cleared.includes('rock_2'));
    assert.equal(wildAt(WORLD, s.village, rock.x, rock.y), null);
    assert.equal(canPlace(WORLD, s, 'jar', rock.x, rock.y).ok, true);
    assert.deepEqual(clearWild(WORLD, s, rock.x, rock.y), { ok: false, reason: '这里没有要开荒的' });
});

test('天然地貌：溪水上能架木桥，别处不行；架了桥的那段溪水要先拆桥才能开荒', () => {
    const s = fresh();
    s.gold = 1000;
    const st = wild('stream_3');
    assert.deepEqual(canPlace(WORLD, s, 'bridge', 1, 1), { ok: false, reason: '木桥只能架在水上' });
    assert.equal(place(WORLD, s, 'bridge', st.x, st.y + 3).ok, true);
    assert.equal(place(WORLD, s, 'bridge', st.x + 1, st.y + 3).ok, true);
    assert.deepEqual(canPlace(WORLD, s, 'bridge', st.x, st.y + 3), { ok: false, reason: '这里已经铺过了' });
    assert.deepEqual(clearWild(WORLD, s, st.x, st.y), { ok: false, reason: '上面架着桥，先拆桥' });
    // 地面：水和桥连着，桥两头接岸
    const [w, h] = WORLD.tiers.village.size;
    const t = terrainGrid(WORLD, s.village);
    assert.equal(t[(st.y + 3) * w + st.x], 'wood');
    assert.equal(t[(st.y + 2) * w + st.x], 'water');
    assert.equal(terrainMask(t, w, h, st.x, st.y + 2) & S, S);
    // 桥横跨溪水：东西两头接岸和另一块桥板，南北临水收边
    assert.equal(terrainMask(t, w, h, st.x, st.y + 3), E | W);
    assert.equal(terrainMask(t, w, h, st.x, st.y + 3) & N, 0);
    assert.equal(removeAt(WORLD, s, st.x, st.y + 3).ok, true);
    assert.equal(removeAt(WORLD, s, st.x + 1, st.y + 3).ok, true);
    assert.equal(clearWild(WORLD, s, st.x, st.y).ok, true);
    assert.equal(terrainGrid(WORLD, s.village)[(st.y + 3) * w + st.x], null);
});

test('存档：第 5 版老地盘读进来变大，东西原地不动，压着的地貌算开过荒', () => {
    const s = fresh();
    const pond = wild('pond_1');
    const old = JSON.parse(serialize(s));
    old.version = 5;
    delete old.village.cleared;
    // 老存档 24×32 时摆不到池塘那儿；这里假装有件东西压着池塘，验证读档时不会被清掉
    old.village.items.push({ uid: 900, def: 'jar', x: pond.x, y: pond.y }, { uid: 901, def: 'house', x: 0, y: 0 });
    const loaded = deserialize(JSON.stringify(old), WORLD);
    assert.equal(loaded.version, SAVE_VERSION);
    assert.deepEqual(WORLD.tiers.village.size, [36, 44]);
    assert.ok(loaded.village.items.some((it) => it.uid === 900 && it.x === pond.x && it.y === pond.y));
    assert.ok(loaded.village.cleared.includes('pond_1'));
    assert.ok(!loaded.village.cleared.includes('stream_1'));
    const o = occupancy(WORLD, loaded.village);
    assert.equal(o.wild[pond.y * o.w + pond.x], 0);
});

test('外圈：10 格宽，下边一条河、左边稻田有土埂；树和杂草不长在河里田里', () => {
    const def = WORLD.villageBorder;
    const [w, h] = WORLD.tiers.village.size;
    assert.equal(def.margin, 10);
    assert.equal(borderGround(def, w, h, 5, h + 3), 'water');
    assert.equal(borderGround(def, w, h, -5, 1), 'soil');
    assert.equal(borderGround(def, w, h, -5, 0), 'dirt');
    assert.equal(borderGround(def, w, h, 5, -5), null);
    for (const d of borderDecor(def, w, h)) {
        assert.ok(outside(w, h, d.x, d.y) > 0, '外圈装饰跑进地盘了');
        assert.equal(borderGround(def, w, h, d.x, d.y), null, `${d.sprite} 长在 ${d.x},${d.y} 的河里或田里`);
    }
    // 上边山坡是松树为主，右边竹林
    const trees = ['tree', 'pine', 'bamboo', 'tree_peach'];
    const top = borderDecor(def, w, h).filter((d) => d.y < -2 && d.x >= 0 && d.x < w && trees.includes(d.sprite));
    assert.ok(top.length > 10);
    assert.ok(top.filter((d) => d.sprite === 'pine').length > top.length / 2);
});
