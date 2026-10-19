import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD } from '../assets/scripts/data/world';
import { OBJECTS } from '../tools/art/objects';

test('素材：每种作物有成熟图，每种鱼有图', () => {
    for (const id of Object.keys(WORLD.crops)) assert.ok(OBJECTS[`crop_${id}`], `${id} 没有成熟图`);
    for (const id of Object.keys(WORLD.fish)) assert.ok(OBJECTS[`fish_${id}`], `${id} 没有鱼的图`);
});
