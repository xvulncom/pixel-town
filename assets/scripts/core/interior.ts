// 室内：进门之后的屋里。不依赖引擎。
// 每栋房子的屋里按"配方 + 种子"现排：配方（data/interiors.ts）定风格、大小范围、摆哪些家具、有没有掌柜和货；
// 种子是这栋房子的钥匙（镇上 `<地图>:<门的格子>`，自己地盘 `v:<建筑 uid>`），同一配方的两栋房子摆得不一样，
// 同一栋每次进去都一样。家具画法在 tools/art/interior.ts，图名就是家具 id。
// 存档留了口子：state.interiors[钥匙].items 有值就用它，不现排（以后自己家摆家具用）。
//
// 格子：最上 WALL_ROWS 行是墙（第 0 行墙头，下面是墙面），左右各一列墙边，最下一行墙根，正中一格是出口。
// 地面是 x ∈ [1, w-2]、y ∈ [WALL_ROWS, h-2]。靠墙的家具占地压在地面第一行，图往上盖住墙面。

import { Area, Cell, findPath, WalkGrid, walkable } from './path';
import { hashString, mulberry32 } from './rng';
import { BuildingDef } from './defs';
import { GameState, Placement } from './types';

export type InteriorStyle = 'jiangnan' | 'western';

/**
 * 家具摆在哪：wall 靠里墙（占地在地面第一行）；floor 地面中间；corner 地面四角；
 * hang 挂在墙面上（不占地）；rug 地毯（铺在地上，能踩）。
 */
export type FurnitureSpot = 'wall' | 'floor' | 'corner' | 'hang' | 'rug';

export interface FurnitureDef {
    id: string;
    name: string;
    /** 占地（格）：挡路的那块，图的底边对齐占地底边、左右居中 */
    foot: [number, number];
    /** 图的大小（格） */
    art: [number, number];
    spot: FurnitureSpot;
}

export interface KeeperDef {
    /** 人物图里的行名（tools/art/people.ts 的 PEOPLE） */
    look: string;
    name: string;
    /** 点掌柜时说的话，轮着说 */
    lines: string[];
    /** 掌柜是有人设的镇民（data/npcs.ts）：搭话走对话库、加好感，能送礼；lines 只在对话库没台词时用 */
    npc?: string;
}

export interface RecipeItem {
    f: string;
    /** 摆几件，默认 1 */
    n?: number;
    /** 摆的概率，默认 1（每件单独掷） */
    chance?: number;
}

export interface InteriorRecipe {
    id: string;
    /** 进门时顶栏显示的名字 */
    name: string;
    style: InteriorStyle;
    /** 总宽、总高（含墙）的范围，按种子在里面取 */
    size: { w: [number, number]; h: [number, number] };
    /** 地面、墙面的图块名（tools/art/interior.ts 的 TILE_SETS） */
    floor: string;
    wall: string;
    /** 柜台家具 id：横放在地面第三行，掌柜站在柜台后面 */
    counter?: string;
    keeper?: KeeperDef;
    /** 卖东西：data/shops.ts 的 id，点掌柜打开 */
    shop?: string;
    items: RecipeItem[];
}

export interface PlacedFurniture {
    f: string;
    /** 占地左上角 */
    x: number;
    y: number;
}

export interface InteriorLayout {
    recipe: string;
    w: number;
    h: number;
    items: PlacedFurniture[];
    /** 出口那格（墙根正中），站上去就出门 */
    exit: Cell;
    /** 进门后站的格子（出口里面一格） */
    entry: Cell;
    /** 掌柜站的格子，没有掌柜为 null */
    keeper: Cell | null;
    /** 柜台占地，点掌柜时走到柜台旁边 */
    counter: Area | null;
}

/** 室内存档：items 有值时用它，不按配方现排。存档第 8 版加入，现在都是空的。 */
export interface InteriorSave {
    items?: PlacedFurniture[];
}

export const WALL_ROWS = 3;
/** 柜台放在地面第几行（从 0 数）：后面留两行给货架和掌柜 */
const COUNTER_ROW = 2;
/** 每件家具最多试几次位置 */
const TRIES = 40;

export interface InteriorWorld {
    furniture: Record<string, FurnitureDef>;
    recipes: Record<string, InteriorRecipe>;
}

/** 门：镇上由 gen-map 写进 `<地图>.doors.json`，自己地盘由 villageDoors 现算。 */
export interface DoorDef {
    /** 镇上是门前那格的 "x,y"，自己地盘是 "v:<uid>"；和地图名拼成钥匙 */
    id: string;
    /** 整栋房子在地图上盖住的格子（含屋顶），点到这块就走去门口 */
    x: number;
    y: number;
    w: number;
    h: number;
    /** 门前站人的格子：走到这里就进门，出来也站在这里 */
    front: Cell;
    /** 室内配方；null 是有门进不去（门锁着） */
    recipe: string | null;
    /** 进不去时说的话，默认"门锁着" */
    locked?: string;
}

export const LOCKED_TEXT = '门锁着，进不去';

/** 这栋房子的钥匙：存档、种子都用它。 */
export function interiorKey(map: string, door: DoorDef): string {
    return door.id.startsWith('v:') ? door.id : `${map}:${door.id}`;
}

function inFloor(w: number, h: number, x: number, y: number): boolean {
    return x >= 1 && x <= w - 2 && y >= WALL_ROWS && y <= h - 2;
}

/** 按配方和钥匙排一间屋子。同样的输入永远排出同样的屋子。 */
export function layoutInterior(world: InteriorWorld, recipeId: string, key: string): InteriorLayout {
    const recipe = world.recipes[recipeId];
    if (!recipe) throw new Error(`没有室内配方 ${recipeId}`);
    const rnd = mulberry32(hashString(`interior|${recipeId}|${key}`));
    const between = ([a, b]: [number, number]) => a + Math.floor(rnd() * (b - a + 1));
    const w = between(recipe.size.w);
    const h = between(recipe.size.h);
    const ex = Math.floor(w / 2);
    const exit: Cell = [ex, h - 1];
    const entry: Cell = [ex, h - 2];
    /** 0 空地，1 家具，2 留着不放东西（进门那条道、柜台前面） */
    const occ = new Uint8Array(w * h);
    const keepFree = (x: number, y: number) => {
        if (inFloor(w, h, x, y)) occ[y * w + x] = 2;
    };
    keepFree(ex, h - 2);
    keepFree(ex, h - 3);
    const items: PlacedFurniture[] = [];
    /** 墙面上哪几列已经被靠墙家具的图或挂件盖住了 */
    const wallUsed = new Uint8Array(w);
    const fits = (def: FurnitureDef, x: number, y: number) => {
        const [fw, fh] = def.foot;
        for (let yy = y; yy < y + fh; yy++) {
            for (let xx = x; xx < x + fw; xx++) if (!inFloor(w, h, xx, yy) || occ[yy * w + xx] !== 0) return false;
        }
        return true;
    };
    const put = (def: FurnitureDef, x: number, y: number) => {
        for (let yy = y; yy < y + def.foot[1]; yy++) for (let xx = x; xx < x + def.foot[0]; xx++) occ[yy * w + xx] = 1;
        items.push({ f: def.id, x, y });
    };

    let counter: Area | null = null;
    let keeper: Cell | null = null;
    if (recipe.counter) {
        const def = world.furniture[recipe.counter];
        const cy = WALL_ROWS + COUNTER_ROW;
        const span = w - 2 - def.foot[0];
        const cx = 1 + Math.floor(span / 2) + Math.round((rnd() - 0.5) * Math.min(4, span));
        put(def, cx, cy);
        counter = { x: cx, y: cy, w: def.foot[0], h: def.foot[1] };
        // 柜台前面一行留空，客人站这里
        for (let x = cx; x < cx + def.foot[0]; x++) keepFree(x, cy + def.foot[1]);
        if (recipe.keeper) {
            keeper = [cx + Math.floor(def.foot[0] / 2), cy - 1];
            occ[keeper[1] * w + keeper[0]] = 1;
        }
    }

    const defsOf = (spot: FurnitureSpot) => {
        const list: FurnitureDef[] = [];
        for (const it of recipe.items) {
            const def = world.furniture[it.f];
            if (!def) throw new Error(`配方 ${recipeId} 用了没有的家具 ${it.f}`);
            if (def.spot !== spot) continue;
            for (let k = 0; k < (it.n ?? 1); k++) if (rnd() < (it.chance ?? 1)) list.push(def);
        }
        return list;
    };

    // 靠墙的：从左到右随机挑空位
    for (const def of defsOf('wall')) {
        const cands: number[] = [];
        for (let x = 1; x + def.foot[0] <= w - 1; x++) if (fits(def, x, WALL_ROWS)) cands.push(x);
        if (!cands.length) continue;
        const x = cands[Math.floor(rnd() * cands.length)];
        put(def, x, WALL_ROWS);
        const ax = x + Math.floor((def.foot[0] - def.art[0]) / 2);
        for (let k = Math.max(0, ax); k < Math.min(w, ax + def.art[0]); k++) wallUsed[k] = 1;
    }
    // 挂在墙面上的：不压靠墙家具的图
    for (const def of defsOf('hang')) {
        const cands: number[] = [];
        for (let x = 1; x + def.art[0] <= w - 1; x++) {
            let ok = true;
            for (let k = x - 1; k <= x + def.art[0]; k++) if (k >= 0 && k < w && wallUsed[k]) ok = false;
            if (ok) cands.push(x);
        }
        if (!cands.length) continue;
        const x = cands[Math.floor(rnd() * cands.length)];
        for (let k = x; k < x + def.art[0]; k++) wallUsed[k] = 1;
        items.push({ f: def.id, x, y: 1 });
    }
    // 地毯：铺在地面中间一块，能踩，不占格
    for (const def of defsOf('rug')) {
        const [fw, fh] = def.foot;
        const x0 = 1 + Math.floor((w - 2 - fw) / 2) + Math.round((rnd() - 0.5) * 2);
        const y0 = WALL_ROWS + Math.floor((h - 1 - WALL_ROWS - fh) / 2) + (counter ? 1 : 0);
        if (x0 >= 1 && x0 + fw <= w - 1 && y0 >= WALL_ROWS && y0 + fh <= h - 1) items.push({ f: def.id, x: x0, y: y0 });
    }

    /** 放下以后，地面的空格还都连着进门那格；柜台前和掌柜旁边还走得到 */
    const stillOpen = () => {
        const grid = gridOf(w, h, occ, exit);
        const free: Cell[] = [];
        for (let y = WALL_ROWS; y <= h - 2; y++) for (let x = 1; x <= w - 2; x++) if (!occ[y * w + x]) free.push([x, y]);
        const seen = reach(grid, entry);
        // 柜台后面那两行不算：那是掌柜的地方，走不进去也行
        const back = (x: number, y: number) => counter !== null && y < counter.y && x >= counter.x - 1 && x <= counter.x + counter.w;
        return free.every(([x, y]) => back(x, y) || seen[y * w + x]);
    };
    const tryFloor = (def: FurnitureDef, cells: Cell[]) => {
        for (let t = 0; t < Math.min(TRIES, cells.length * 2); t++) {
            const [x, y] = cells[Math.floor(rnd() * cells.length)];
            if (!fits(def, x, y)) continue;
            put(def, x, y);
            if (stillOpen()) return;
            // 堵路了，撤回
            items.pop();
            for (let yy = y; yy < y + def.foot[1]; yy++) for (let xx = x; xx < x + def.foot[0]; xx++) occ[yy * w + xx] = 0;
        }
    };
    const top = counter ? counter.y + counter.h + 1 : WALL_ROWS + 1;
    const corners = (def: FurnitureDef): Cell[] => [
        [1, counter ? top : WALL_ROWS], [w - 1 - def.foot[0], counter ? top : WALL_ROWS],
        [1, h - 1 - def.foot[1]], [w - 1 - def.foot[0], h - 1 - def.foot[1]],
    ];
    for (const def of defsOf('corner')) tryFloor(def, corners(def));
    const floorCells: Cell[] = [];
    for (let y = top; y <= h - 2; y++) for (let x = 2; x <= w - 3; x++) floorCells.push([x, y]);
    for (const def of defsOf('floor')) tryFloor(def, floorCells);

    return { recipe: recipeId, w, h, items, exit, entry, keeper, counter };
}

function gridOf(w: number, h: number, occ: Uint8Array, exit: Cell): WalkGrid {
    const block = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = y * w + x;
            block[i] = !inFloor(w, h, x, y) || occ[i] === 1 ? 1 : 0;
        }
    }
    block[exit[1] * w + exit[0]] = 0;
    return { w, h, block };
}

function reach(g: WalkGrid, from: Cell): Uint8Array {
    const seen = new Uint8Array(g.w * g.h);
    if (!walkable(g, from[0], from[1])) return seen;
    const q = [from[1] * g.w + from[0]];
    seen[q[0]] = 1;
    for (let i = 0; i < q.length; i++) {
        const x = q[i] % g.w;
        const y = (q[i] - x) / g.w;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx;
            const ny = y + dy;
            if (!walkable(g, nx, ny) || seen[ny * g.w + nx]) continue;
            seen[ny * g.w + nx] = 1;
            q.push(ny * g.w + nx);
        }
    }
    return seen;
}

/** 屋里的挡路表：墙、家具（地毯、挂件除外）、掌柜挡路，出口那格能站。 */
export function interiorGrid(world: InteriorWorld, layout: InteriorLayout): WalkGrid {
    const { w, h } = layout;
    const occ = new Uint8Array(w * h);
    for (const it of layout.items) {
        const def = world.furniture[it.f];
        if (!def || def.spot === 'rug' || def.spot === 'hang') continue;
        for (let y = it.y; y < it.y + def.foot[1]; y++) for (let x = it.x; x < it.x + def.foot[0]; x++) if (x < w && y < h) occ[y * w + x] = 1;
    }
    if (layout.keeper) occ[layout.keeper[1] * w + layout.keeper[0]] = 1;
    return gridOf(w, h, occ, layout.exit);
}

/** 这栋房子的屋子：存档里摆过就用存档的家具，否则按配方现排。 */
export function interiorFor(world: InteriorWorld, state: GameState, recipeId: string, key: string): InteriorLayout {
    const layout = layoutInterior(world, recipeId, key);
    const saved = state.interiors[key]?.items;
    if (saved) layout.items = saved.filter((it) => world.furniture[it.f]);
    return layout;
}

/** 进门那格能不能走到每件要点的东西（测试用）：出口、柜台。 */
export function interiorReachable(world: InteriorWorld, layout: InteriorLayout): boolean {
    const g = interiorGrid(world, layout);
    if (!findPath(g, layout.entry, (x, y) => x === layout.exit[0] && y === layout.exit[1])) return false;
    if (layout.counter) {
        const c = layout.counter;
        const near = (x: number, y: number) => x >= c.x && x < c.x + c.w && y === c.y + c.h;
        if (!findPath(g, layout.entry, near)) return false;
    }
    return true;
}

/**
 * (x, y) 这格画哪张图块（室内图集 interior.png 的图名）：墙头、墙面上下两行、地板（贴墙那行带墙脚影子）、
 * 左右墙边、墙根、出口。同一格永远是同一张，几张变体按格子错开。
 */
export function interiorTile(recipe: InteriorRecipe, layout: InteriorLayout, x: number, y: number): string {
    const { w, h } = layout;
    const v = (n: number) => (x * 7 + y * 13) % n;
    if (y === h - 1) {
        if (x === layout.exit[0]) return `exit_${recipe.style}`;
        return x === 0 ? 'edge_bl' : x === w - 1 ? 'edge_br' : 'edge_b';
    }
    if (x === 0) return y === 0 ? 'edge_top' : 'edge_l';
    if (x === w - 1) return y === 0 ? 'edge_top' : 'edge_r';
    if (y === 0) return `wall_${recipe.wall}_cap`;
    if (y < WALL_ROWS) return `wall_${recipe.wall}_f${y}_${v(2)}`;
    if (y === WALL_ROWS) return `floor_${recipe.floor}_top${v(2)}`;
    return `floor_${recipe.floor}_${v(3)}`;
}

/** 自己地盘上盖的房子的门：配了 interior（或标了 null 进不去）的建筑才有门，门在占地底边正中，门前是下面一格。 */
export function villageDoors(buildings: Record<string, BuildingDef>, items: Placement[], artH: (def: BuildingDef) => number): DoorDef[] {
    const doors: DoorDef[] = [];
    for (const it of items) {
        const def = buildings[it.def];
        if (!def || def.interior === undefined) continue;
        const [fw, fh] = def.foot;
        const ah = Math.max(fh, artH(def));
        doors.push({
            id: `v:${it.uid}`,
            x: it.x, y: it.y + fh - ah, w: fw, h: ah,
            front: [it.x + Math.floor(fw / 2), it.y + fh],
            recipe: def.interior,
            locked: def.locked,
        });
    }
    return doors;
}

/** 点到 (x, y) 的是哪扇门的房子（门前那格也算） */
export function doorAt(doors: DoorDef[], x: number, y: number): DoorDef | null {
    return doors.find((d) => (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) || (x === d.front[0] && y === d.front[1])) ?? null;
}
