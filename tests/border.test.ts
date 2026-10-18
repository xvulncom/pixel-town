import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WORLD } from '../assets/scripts/data/world';
import { borderDecor, outside } from '../assets/scripts/core/border';

const B = WORLD.villageBorder;
const TREES = new Set(B.trees.sprites.map(([n]) => n));

test('外圈：只摆在地盘外、外圈以内，每格最多一件，每次一样', () => {
    const [w, h] = WORLD.tiers.village.size;
    const a = borderDecor(B, w, h);
    assert.deepEqual(borderDecor(B, w, h), a);
    const seen = new Set<string>();
    for (const d of a) {
        const k = outside(w, h, d.x, d.y);
        assert.ok(k >= 1 && k <= B.margin, `${d.sprite}@${d.x},${d.y}`);
        assert.ok(!seen.has(`${d.x},${d.y}`));
        seen.add(`${d.x},${d.y}`);
    }
});

test('外圈：树不挡地盘，贴边一圈大多有杂草，树够密', () => {
    for (const tier of Object.values(WORLD.tiers)) {
        const [w, h] = tier.size;
        const a = borderDecor(B, w, h);
        const trees = a.filter((d) => TREES.has(d.sprite));
        for (const t of trees) {
            const covers = t.x + 1 >= 0 && t.x - 1 < w && t.y >= 0 && t.y - (B.treeHeight - 1) < h;
            assert.ok(!covers, `${t.sprite}@${t.x},${t.y} 挡住地盘`);
        }
        const ring = 2 * (w + h) + 4;
        const edge = a.filter((d) => outside(w, h, d.x, d.y) === 1).length;
        assert.ok(edge > ring * 0.5, `贴边只有 ${edge}/${ring}`);
        assert.ok(trees.length > ring * 0.4, `树只有 ${trees.length}`);
    }
});

test('素材：外圈用到的图都有', () => {
    const frames = JSON.parse(readFileSync(join(__dirname, '../assets/resources/maps/buildings-frames.json'), 'utf8')).frames;
    for (const layer of [B.trees, B.edge, B.scatter]) {
        for (const [name] of layer.sprites) assert.ok(frames[name], `没有 ${name} 图`);
    }
});
