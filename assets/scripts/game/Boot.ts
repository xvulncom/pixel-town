// 启动：主场景只是个空壳，相机、画布、地图、顶栏都在这里用代码搭，场景文件不用手工维护。
// 模块加载时注册场景启动回调，Cocos 会在启动时导入所有项目脚本。
// 画面分两处：自己的地盘（Village，开局进这里）和官方场地（Map，地域的镇子），顶栏按钮来回切。
// 横竖屏都能玩：屏幕转了（或窗口大小变了）就存档、把画布整个拆掉按新尺寸重搭，排版规则在 core/screen.ts。
// 作物和工人由常驻模拟节点 Sim 推进（开机就起，挂在常驻根节点上），画布重搭不影响它。
// 招人在镇上广场的招工告示栏（亲自去），或者让助理跑一趟后看他带回的名单。

import {
    Camera, Canvas, Color, Director, director, EventTouch, Graphics, JsonAsset, Label, Node, ResolutionPolicy,
    HorizontalTextAlignment, profiler, resources, Scene, screen, Texture2D, TiledMap, TiledMapAsset, UITransform, Vec2, Vec3,
    view,
} from 'cc';
import { MapView, TILED_MAX_CELLS } from './MapView';
import { People } from './People';
import { Hero, sortIntoSiblings } from './Hero';
import { Cell, gridFromRows } from '../core/path';
import { DoorDef, doorAt, interiorFor, interiorKey, InteriorRecipe, InteriorWorld, LOCKED_TEXT } from '../core/interior';
import { giftsOwned, ShopData } from '../core/shop';
import { FURNITURE } from '../data/furniture';
import { INTERIORS } from '../data/interiors';
import { SHOPS } from '../data/shops';
import { GIFTS } from '../data/gifts';
import { InteriorAtlas, InteriorView } from './InteriorView';
import { ShopView } from './ShopView';
import { walkGrid } from '../core/village';
import { chatWith } from '../core/chat';
import { LocalDialogueProvider } from '../core/npc';
import { TOWN_FOLK } from '../data/townFolk';
import { buildChatBox, ChatBox } from './ChatBox';
import { DayLight } from './DayLight';
import { VillageView } from './VillageView';
import { PANEL_H, VillageBuild } from './VillageBuild';
import { FishingView } from './FishingView';
import { MarketView } from './MarketView';
import { HiringView } from './HiringView';
import { WorkersView } from './WorkersView';
import { VillageWorkers } from './VillageWorkers';
import { Sim, simEvents } from './Sim';
import { prepareBackend } from './Backend';
import { CloudSync } from '../core/sync';
import { HireVia } from '../core/workers';
import { loadOrNew, saveGame, SaveStore } from './Store';
import { button, drawBox, GOLD, INK, label, PAPER, UI_LAYER, uiNode } from './ui';
import { canRotate, rotateTo, screenInsets } from './SafeArea';
import { HudLayout, Orientation, orientationOf, Rect, screenLayout, ScreenLayout } from '../core/screen';
import { WORLD } from '../data/world';
import { TOWN_PLACES, TOWN_TOURS, townChoices } from '../data/townPlaces';
import { SEASON_NAMES, solarTermAt } from '../core/calendar';
import { placeWeather } from '../core/weather';
import { villagePlace } from '../core/region';
import { PLACES, PLACE_ORDER } from '../data/places';
import { startRealWeather } from './RealWeather';
import { GameState, Weather } from '../core/types';

/** 竖屏的设计分辨率；横屏时宽高对调，按高度适配 */
const DESIGN_W = 720;
const DESIGN_H = 1280;

/** 镇民说话的来源：一期本地对话库，二期换成后端大模型（同一个 DialogueProvider 接口） */
const DIALOGUE = new LocalDialogueProvider(WORLD.dialogues);
/** 屋里的家具和配方、店里的货和礼物 */
const INTERIOR_WORLD: InteriorWorld = { furniture: FURNITURE, recipes: INTERIORS };
const SHOP_DATA: ShopData = { shops: SHOPS, gifts: GIFTS };

const WEATHER_NAMES: Record<Weather, string> = {
    sunny: '晴',
    cloudy: '多云',
    rain: '雨',
    snow: '雪',
    dust: '沙尘暴',
};

function buildCanvas(scene: Scene, orientation: Orientation): Node {
    if (orientation === 'landscape') view.setDesignResolutionSize(DESIGN_H, DESIGN_W, ResolutionPolicy.FIXED_HEIGHT);
    else view.setDesignResolutionSize(DESIGN_W, DESIGN_H, ResolutionPolicy.FIXED_WIDTH);

    const canvasNode = new Node('Canvas');
    canvasNode.layer = UI_LAYER;
    scene.addChild(canvasNode);
    canvasNode.addComponent(UITransform);

    const camNode = new Node('Camera');
    camNode.layer = UI_LAYER;
    canvasNode.addChild(camNode);
    camNode.setPosition(0, 0, 1000);
    const cam = camNode.addComponent(Camera);
    cam.projection = Camera.ProjectionType.ORTHO;
    cam.visibility = UI_LAYER;
    cam.clearFlags = Camera.ClearFlag.SOLID_COLOR;
    cam.clearColor = new Color(32, 48, 32, 255);
    cam.near = 1;
    cam.far = 2000;

    const canvas = canvasNode.addComponent(Canvas);
    canvas.cameraComponent = cam;
    canvas.alignCanvasWithScreen = true;
    return canvasNode;
}

/** 屏幕坐标（左上角原点）的矩形，摆成画布里的节点（中心原点）。 */
function placeRect(n: Node, r: Rect, W: number, H: number): void {
    n.getComponent(UITransform)!.setContentSize(r.w, r.h);
    n.setPosition(r.x + r.w / 2 - W / 2, H / 2 - (r.y + r.h / 2), 0);
}

interface Hud {
    /** 顶栏总高，地图上方让出这么多 */
    height: number;
    say(text: string): void;
    /** town 是正在逛的镇子名，不传就是老家 */
    setPlace(where: 'village' | 'town', town?: string): void;
    /** 天气和它跟着的现实地点名（顶栏写成"晴 · 苏州"） */
    setWeather(w: Weather, placeName: string): void;
}

/**
 * 顶栏：刘海屏、灵动岛机型把节气天气和金币放在岛的两侧，下面一行是地名和按钮（让开微信胶囊）；
 * 普通屏、横屏没有两侧空档，信息并进地名下面一行。微信里多一个横屏/竖屏按钮。
 */
function buildHud(canvasNode: Node, W: number, state: GameState, layout: HudLayout, orientation: Orientation,
    onToggle: () => void, onRotate: (() => void) | null): Hud {
    const H = layout.height;
    const vis = view.getVisibleSize();
    const hud = uiNode('Hud', canvasNode, W, H);
    hud.setPosition(0, vis.height / 2 - H / 2, 0);
    // 设计坐标（左上角原点）换成顶栏节点里的坐标
    const at = (x: number, y: number): [number, number] => [x - W / 2, H / 2 - y];

    const bg = hud.addComponent(Graphics);
    bg.fillColor = new Color(0, 0, 0, 140);
    bg.rect(-W / 2, -H / 2, W, H);
    bg.fill();
    // 点在顶栏上不拖地图
    hud.on(Node.EventType.TOUCH_START, () => undefined);

    const text = (name: string, x0: number, x1: number, y0: number, y1: number, size: number, align: HorizontalTextAlignment) => {
        const l = label(hud, '', size, INK, x1 - x0, y1 - y0, name);
        l.horizontalAlign = align;
        const [cx, cy] = at((x0 + x1) / 2, (y0 + y1) / 2);
        l.node.setPosition(cx, cy, 0);
        return l;
    };
    const { row, ears } = layout;
    const midY = (row.top + row.bottom) / 2;
    const btnW = 170;
    const toggle = button(hud, '去镇上', btnW, 70, onToggle, 'Toggle');
    toggle.node.setPosition(...at(row.right - btnW / 2, midY), 0);
    let titleRight = row.right - btnW - 12;
    if (onRotate) {
        const rotW = 110;
        const rot = button(hud, orientation === 'portrait' ? '横屏' : '竖屏', rotW, 70, onRotate, 'Rotate');
        rot.node.setPosition(...at(titleRight - rotW / 2, midY), 0);
        titleRight -= rotW + 12;
    }
    const title = text('Text', row.left, titleRight, row.top, row.bottom, ears ? 32 : 28, Label.HorizontalAlign.CENTER);
    const leftEar = ears ? text('EarL', ears.left[0], ears.left[1], ears.top, ears.bottom, 24, Label.HorizontalAlign.LEFT) : null;
    const rightEar = ears ? text('EarR', ears.right[0], ears.right[1], ears.top, ears.bottom, 24, Label.HorizontalAlign.RIGHT) : null;
    if (rightEar) rightEar.color = GOLD;

    const now = Date.now();
    const region = WORLD.regions[state.region];
    const term = solarTermAt(now);
    let weather: Weather = 'sunny';
    let weatherAt = '';
    let where: 'village' | 'town' = 'village';
    let townName = region.name;
    let note = '';
    const render = () => {
        const tier = WORLD.tiers[state.village.tier].name;
        const place = where === 'village' ? `我的${tier}` : `${townName} · 镇上`;
        const sky = `${WEATHER_NAMES[weather]}${weatherAt ? ` · ${weatherAt}` : ''}`;
        const info = `${term.name}（${SEASON_NAMES[term.season]}）· ${sky}`;
        if (leftEar && rightEar) {
            leftEar.string = `${term.name} · ${sky}`;
            rightEar.string = `金币 ${state.gold}`;
            title.string = note || place;
        } else {
            title.string = `${note || place}\n${info}${where === 'town' ? ' · 拖动看看' : ''}`;
        }
        toggle.label.string = where === 'village' ? '去镇上' : `回${tier}`;
    };
    return {
        height: H,
        say(t) {
            note = t;
            render();
        },
        setWeather(w, at) {
            weather = w;
            weatherAt = at;
            render();
        },
        setPlace(w, town) {
            where = w;
            if (town) townName = town;
            render();
        },
    };
}

/** 镇上能点的地方，格子坐标（gen-map 生成的 <地图>.places.json） */
interface TownPlace {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

/** 镇子地图里第 x 列第 y 行格子中心的节点坐标（地图节点以中心为原点）。 */
function townCell(mapNode: Node, x: number, y: number): [number, number] {
    const ui = mapNode.getComponent(UITransform)!;
    return [(x + 0.5) * 16 - ui.width / 2, ui.height / 2 - (y + 0.5) * 16];
}

/** 镇上点了一下之后做什么：主角走过去，到了再触发。 */
interface TownTaps {
    people: People;
    hero: () => Hero | null;
    onPlace: (id: string) => void;
    onTalk: (id: string) => void;
    /** 走到房子门口以后（进屋由 buildMain 管） */
    onDoor: (door: DoorDef) => void;
    say: (text: string) => void;
    /** 主角出来时站哪（存档记的位置），null 用地图出生点 */
    spawn: () => Cell | null;
    /** 主角出来了、走完一段停下了 */
    onHero: (hero: Hero) => void;
    onStopped: (cell: Cell) => void;
}

/**
 * 镇上能点的地方：每处头上挂个牌子，点到那块格子（含上面一行屋檐）主角就走到旁边，到了调 onPlace。
 * 点到镇民走到他旁边搭话，点到有门的房子走到门口进屋，点别处就走过去。招工处要人亲自到镇上来点，这就是"亲自前往"。
 * ready 交回一个把地图挪到某处的函数。
 */
function bindPlaces(mapNode: Node, mapPath: string, taps: TownTaps, ready: (focus: (id: string) => void) => void): void {
    // 门表（gen-interiors 生成的 <地图>.doors.json）：没有就是镇上的房子都不能进
    let doors: DoorDef[] = [];
    resources.load(`${mapPath}.doors`, JsonAsset, (err, asset) => {
        if (!err && asset) doors = asset.json as DoorDef[];
    });
    resources.load(`${mapPath}.places`, JsonAsset, (err, asset) => {
        if (err || !asset || !mapNode.isValid) return;
        const places = asset.json as TownPlace[];
        for (const p of places) {
            const def = TOWN_PLACES[p.id];
            if (def && !def.tag) continue;
            const tagNode = uiNode(`Tag-${p.id}`, mapNode, 44, 14);
            const g = tagNode.addComponent(Graphics);
            g.fillColor = new Color(150, 40, 30, 230);
            g.roundRect(-22, -7, 44, 14, 3);
            g.fill();
            label(tagNode, def?.name ?? p.id, 10, INK, 44, 14);
            const [cx, cy] = townCell(mapNode, p.x + (p.w - 1) / 2, p.y);
            tagNode.setPosition(cx, cy + 14, 0);
        }
        mapNode.getComponent(MapView)?.onTap((loc) => {
            if (!mapNode.isValid) return;
            const ui = mapNode.getComponent(UITransform)!;
            const vis = view.getVisibleSize();
            const canvas = mapNode.parent!.getComponent(UITransform)!;
            const p = ui.convertToNodeSpaceAR(canvas.convertToWorldSpaceAR(new Vec3(loc.x - vis.width / 2, loc.y - vis.height / 2, 0)));
            const tx = Math.floor((p.x + ui.width / 2) / 16);
            const ty = Math.floor((ui.height / 2 - p.y) / 16);
            const hero = taps.hero();
            const go = hero?.ready ? hero : null;
            // 先看点没点到人（人会走动，按此刻的位置），再看房子的门、地点，都不是就走过去
            const who = taps.people.walkerAt(tx, ty);
            if (who) {
                if (!go?.walkTo({ x: who.x, y: who.y, w: 1, h: 1 }, 'beside', (ok) => ok && taps.onTalk(who.id))) taps.onTalk(who.id);
                return;
            }
            const door = doorAt(doors, tx, ty);
            if (door) {
                const [fx, fy] = door.front;
                const enter = (ok: boolean) => (ok ? taps.onDoor(door) : taps.say('走不过去'));
                if (!go?.walkTo({ x: fx, y: fy, w: 1, h: 1 }, 'onto', enter)) taps.onDoor(door);
                return;
            }
            const hit = places.find((q) => tx >= q.x && tx < q.x + q.w && ty >= q.y - 1 && ty < q.y + q.h);
            if (hit) {
                const done = (ok: boolean) => (ok ? taps.onPlace(hit.id) : taps.say('走不过去'));
                if (!go?.walkTo({ x: hit.x, y: hit.y, w: hit.w, h: hit.h }, 'beside', done)) taps.onPlace(hit.id);
                return;
            }
            go?.walkTo({ x: tx, y: ty, w: 1, h: 1 }, 'onto');
        });
        ready((id) => {
            const p = places.find((q) => q.id === id);
            if (!p) return;
            const [cx, cy] = townCell(mapNode, p.x + (p.w - 1) / 2, p.y + (p.h - 1) / 2);
            mapNode.getComponent(MapView)?.focus(cx, cy);
        });
    });
}

/** 镇子地图配套的主角挡路表和出生点（gen-map 生成的 <地图>.walk.json） */
interface TownWalk {
    spawn: [number, number];
    rows: string[];
}

/** 官方场地：地域的镇子，第一次去的时候才加载。 */
function loadTown(mapNode: Node, regionId: string, hud: Hud, layout: ScreenLayout,
    taps: Omit<TownTaps, 'people' | 'hero'>, ready: (focus: (id: string) => void) => void): void {
    const mapPath = `maps/${WORLD.regions[regionId].map}`;
    resources.load(mapPath, TiledMapAsset, (err, asset) => {
        if (err || !asset) {
            console.error('地图加载失败', err);
            hud.say('地图加载失败');
            return;
        }
        if (!mapNode.isValid) return;
        resources.load(`${mapPath}.walk`, JsonAsset, (e2, walkAsset) => {
            if (e2 || !walkAsset) console.error('镇子挡路表加载失败，主角不出来', e2);
            if (mapNode.isValid) buildTown(mapNode, mapPath, asset, (walkAsset?.json as TownWalk) ?? null, hud, layout, taps, ready);
        });
    });
}

function buildTown(mapNode: Node, mapPath: string, asset: TiledMapAsset, walk: TownWalk | null, hud: Hud, layout: ScreenLayout,
    taps: Omit<TownTaps, 'people' | 'hero'>, ready: (focus: (id: string) => void) => void): void {
    // 像素风：关掉线性过滤，放大后不糊
    for (const sf of asset.spriteFrames) {
        sf.texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
    }
    const tiled = mapNode.addComponent(TiledMap);
    tiled.tmxAsset = asset;
    const mv = mapNode.addComponent(MapView);
    mv.maxCells = TILED_MAX_CELLS;
    mv.insetTop = hud.height;
    mv.insetBottom = layout.hud.bottomPad;
    const people = mapNode.addComponent(People);
    people.mapPath = mapPath;
    // 主角放进人物层，和镇民一起排前后、被 over 图层盖住头
    let hero: Hero | null = null;
    people.onLayer = (layer) => {
        if (!walk) return;
        const grid = gridFromRows(walk.rows);
        hero = mapNode.addComponent(Hero);
        Object.assign(hero, {
            grid: () => grid, toLocal: (x: number, y: number) => people.toLocal(x, y), layer, mapView: mv,
            spawn: taps.spawn() ?? walk.spawn,
            onMoved: (n: Node) => {
                if (!people.extras.includes(n)) people.extras.push(n);
            },
            onStopped: taps.onStopped,
        });
        taps.onHero(hero);
    };
    bindPlaces(mapNode, mapPath, { ...taps, people, hero: () => hero }, ready);
}

/** 主角在自己地盘的出生格：存档记着就站那里；否则第一户民居门口；还没盖房就站地盘中间。 */
function villageSpawn(state: GameState): [number, number] {
    if (state.at.scene === 'village' && state.at.x >= 0) return [state.at.x, state.at.y];
    const items = state.village.items;
    const home = items.find((it) => WORLD.hiring.housing.includes(it.def));
    if (home) {
        const def = WORLD.buildings[home.def];
        return [home.x + Math.floor(def.foot[0] / 2), home.y + def.foot[1]];
    }
    const [w, h] = WORLD.tiers[state.village.tier].size;
    return [Math.floor(w / 2), Math.floor(h / 2)];
}

/** 地盘右下角一竖排快捷玩法：巡村、钓鱼、摆摊，蹲坑时点几下就能玩一局。 */
function buildActions(canvasNode: Node, W: number, H: number, layout: ScreenLayout, items: [string, () => void][]): Node {
    const bw = 132;
    const bh = 72;
    const gap = 12;
    const m = layout.map;
    const bottom = m.y + m.h - 16 - (layout.orientation === 'landscape' ? layout.hud.bottomPad : 0);
    const r = { x: m.x + m.w - 16 - bw, y: bottom - items.length * (bh + gap) + gap, w: bw, h: items.length * (bh + gap) - gap };
    const bar = uiNode('Actions', canvasNode);
    placeRect(bar, r, W, H);
    bar.on(Node.EventType.TOUCH_START, () => undefined);
    items.forEach(([name, fn], i) => {
        const b = button(bar, name, bw, bh, fn, name);
        b.node.setPosition(0, r.h / 2 - bh / 2 - i * (bh + gap), 0);
    });
    return bar;
}

/** 选镇子的弹层：每座镇子一个按钮（老家标出来），再加一个"算了"。 */
function buildTownPicker(n: Node, r: Rect, towns: string[], home: string, go: (id: string) => void, cancel: () => void): void {
    n.on(Node.EventType.TOUCH_START, () => undefined);
    const shade = n.addComponent(Graphics);
    shade.fillColor = new Color(0, 0, 0, 140);
    shade.rect(-r.w / 2, -r.h / 2, r.w, r.h);
    shade.fill();
    const bw = Math.min(480, r.w - 64);
    const bh = 96;
    const gap = 20;
    const items: [string, () => void][] = towns.map((id) => {
        const reg = WORLD.regions[id];
        return [`${reg.name}${id === home ? '（老家）' : ''}`, () => go(id)];
    });
    items.push(['算了', cancel]);
    const total = items.length * (bh + gap) - gap + 70;
    const box = uiNode('Box', n, bw + 40, total + 40);
    drawBox(box.addComponent(Graphics), bw + 40, total + 40, PAPER, 16, INK);
    const title = label(box, '去哪座镇子？', 34, GOLD, bw, 60);
    title.node.setPosition(0, total / 2 - 30, 0);
    items.forEach(([text, fn], i) => {
        const b = button(box, text, bw, bh, fn, `Town-${i}`);
        b.node.setPosition(0, total / 2 - 70 - bh / 2 - i * (bh + gap), 0);
    });
}

/** 选一样的小弹层：标题 + 一列按钮（和掌柜、镇民说话时选买东西、聊天、送礼）。 */
function buildMenu(n: Node, r: Rect, title: string, items: [string, () => void][]): void {
    n.on(Node.EventType.TOUCH_START, () => undefined);
    const shade = n.addComponent(Graphics);
    shade.fillColor = new Color(0, 0, 0, 140);
    shade.rect(-r.w / 2, -r.h / 2, r.w, r.h);
    shade.fill();
    const bw = Math.min(420, r.w - 64);
    const bh = 88;
    const gap = 18;
    const total = items.length * (bh + gap) - gap + 70;
    const box = uiNode('Box', n, bw + 40, total + 40);
    drawBox(box.addComponent(Graphics), bw + 40, total + 40, PAPER, 16, INK);
    label(box, title, 32, GOLD, bw, 60, 'Title').node.setPosition(0, total / 2 - 30, 0);
    items.forEach(([text, fn], i) => {
        button(box, text, bw, bh, fn, `Menu-${i}`).node.setPosition(0, total / 2 - 70 - bh / 2 - i * (bh + gap), 0);
    });
}

/** 选村庄地点的弹层：第一个是"跟老家"，后面按地点表分页，两列。当前选中的高亮。 */
function buildPlacePicker(n: Node, r: Rect, state: GameState, pick: (id: string) => void, cancel: () => void): void {
    n.on(Node.EventType.TOUCH_START, () => undefined);
    const shade = n.addComponent(Graphics);
    shade.fillColor = new Color(0, 0, 0, 140);
    shade.rect(-r.w / 2, -r.h / 2, r.w, r.h);
    shade.fill();
    const home = WORLD.regions[state.region].origin ?? '';
    const ids = ['', ...PLACE_ORDER.filter((id) => id !== home)];
    const cols = 2;
    const rows = Math.max(3, Math.min(6, Math.floor((r.h - 300) / 92)));
    const per = cols * rows;
    const pages = Math.ceil(ids.length / per);
    const bw = Math.min(260, (r.w - 100) / cols);
    const bh = 76;
    const gap = 14;
    const boxW = cols * bw + (cols - 1) * gap + 40;
    const boxH = 70 + rows * (bh + gap) + 90 + 20;
    const box = uiNode('Box', n, boxW, boxH);
    drawBox(box.addComponent(Graphics), boxW, boxH, PAPER, 16, INK);
    const title = label(box, '村子的天气跟哪里？', 32, GOLD, boxW - 40, 56);
    title.node.setPosition(0, boxH / 2 - 40, 0);
    const grid = uiNode('Grid', box, boxW, rows * (bh + gap));
    grid.setPosition(0, boxH / 2 - 70 - (rows * (bh + gap)) / 2, 0);
    let page = Math.floor(Math.max(0, ids.indexOf(state.place)) / per);
    const draw = () => {
        grid.destroyAllChildren();
        ids.slice(page * per, page * per + per).forEach((id, i) => {
            const name = id ? PLACES[id].name : `跟老家（${PLACES[home]?.name ?? '随机'}）`;
            const b = button(grid, name, bw, bh, () => pick(id), `Place-${id || 'home'}`);
            b.label.fontSize = 26;
            b.setActive(id === state.place);
            b.node.setPosition((i % cols - (cols - 1) / 2) * (bw + gap), (rows - 1) / 2 * (bh + gap) - Math.floor(i / cols) * (bh + gap), 0);
        });
    };
    draw();
    const navW = (boxW - 40 - 2 * gap) / 3;
    const navY = -boxH / 2 + 20 + 40;
    [['上一页', () => { page = (page + pages - 1) % pages; draw(); }], ['算了', cancel], ['下一页', () => { page = (page + 1) % pages; draw(); }]]
        .forEach(([text, fn], i) => {
            const b = button(box, text as string, navW, 72, fn as () => void, `Nav-${i}`);
            b.node.setPosition((i - 1) * (navW + gap), navY, 0);
        });
}

let current: { orientation: Orientation; w: number; h: number; teardown: () => void } | null = null;

function buildMain(scene: Scene, state: GameState, store: SaveStore, sim: Sim): void {
    profiler.hideStats();
    const win = screen.windowSize;
    const orientation = orientationOf(win.width, win.height);
    const canvasNode = buildCanvas(scene, orientation);
    const vis = view.getVisibleSize();
    const W = vis.width;
    const H = vis.height;
    const layout = screenLayout(screenInsets(), PANEL_H);

    // 从下往上：镇子、自己的地盘、光照、建造栏、快捷玩法、顶栏、弹层
    // 每座官方小镇一个节点，第一次去的时候才加载地图
    const towns = townChoices(state.region);
    const townNodes = new Map<string, Node>();
    for (const id of towns) {
        const n = uiNode(`Map-${id}`, canvasNode);
        n.active = false;
        townNodes.set(id, n);
    }
    const village = uiNode('Village', canvasNode);
    // 屋里：进门时在这下面搭一间，出门拆掉；盖在镇子和地盘上面
    const interiorHost = uiNode('Interior', canvasNode);
    let atlas: InteriorAtlas | null = null;
    const atlasWaiting: ((a: InteriorAtlas) => void)[] = [];
    InteriorAtlas.load((a) => {
        atlas = a;
        if (a) atlasWaiting.splice(0).forEach((fn) => fn(a));
    });
    const light = uiNode('DayLight', canvasNode);
    light.addComponent(Graphics);
    light.addComponent(DayLight);
    const panel = uiNode('BuildPanel', canvasNode);

    let where: 'village' | 'town' = 'village';
    /** 正在逛的镇子（地域 id） */
    let townId = towns[0];
    const townLoaded = new Set<string>();
    let build: VillageBuild | null = null;
    let overlay: Node | null = null;
    let actions: Node | null = null;
    let townActions: Node | null = null;
    const focusTown = new Map<string, (id: string) => void>();
    let workers: VillageWorkers | null = null;
    /** 正在屋里：那间屋子的节点 */
    let inside: Node | null = null;
    let villageHero: Hero | null = null;
    const townHeroes = new Map<string, Hero>();
    /** 和镇上的人搭话：最近说过的台词记在这里避免重复（不进存档） */
    const recentLines: string[] = [];
    let chat: ChatBox | null = null;
    const talkTo = (id: string) => {
        void chatWith(state, WORLD, TOWN_FOLK, id, Date.now(), DIALOGUE, recentLines).then((r) => {
            if (!r) return;
            recentLines.push(r.lineId);
            if (recentLines.length > 8) recentLines.shift();
            // 说话框：立绘按人物 id 取，工人还能按 look 退一步，都没有就是灰色剪影
            chat?.show(id, r.name, r.text, r.gained, WORLD.workers[id]?.look);
            if (r.gained > 0) saveGame(store, state);
        });
    };
    const closeOverlay = () => {
        if (overlay?.isValid) overlay.destroy();
        overlay = null;
    };
    const showVillageUi = () => {
        const v = where === 'village' && !inside;
        panel.active = v;
        if (actions) actions.active = v && !overlay;
        if (townActions) townActions.active = where === 'town' && !inside && !overlay;
    };
    /** 镇子、地盘哪个露出来：屋里的时候都藏起来 */
    const showScene = () => {
        for (const [id, n] of townNodes) n.active = !inside && where === 'town' && id === townId;
        village.active = !inside && where === 'village';
        showVillageUi();
    };
    /** 记下主角在哪（存档里的 at）：停下来、换地方的时候 */
    const markAt = (cell: Cell | null) => {
        state.at = {
            scene: where, town: where === 'town' ? townId : state.at.town,
            x: cell ? cell[0] : -1, y: cell ? cell[1] : -1, inside: null,
        };
    };
    /** 去哪儿：village 回自己地盘，否则去那座镇子；在屋里就先出来 */
    const goWhere = (to: 'village' | string) => {
        closeOverlay();
        chat?.hide();
        if (inside) {
            inside.destroy();
            inside = null;
            hud.say('');
        }
        where = to === 'village' ? 'village' : 'town';
        if (where === 'town') townId = to;
        // 那边的主角已经出来了就记他站的格子；还没去过的镇子沿用存档（开机恢复时）或地图出生点
        const h = where === 'village' ? villageHero : townHeroes.get(townId);
        const sameAsSaved = state.at.scene === where && (where === 'village' || state.at.town === townId);
        markAt(h?.ready ? h.cell : sameAsSaved && state.at.x >= 0 ? [state.at.x, state.at.y] : null);
        if (where === 'town' && !townLoaded.has(townId)) {
            const id = townId;
            townLoaded.add(id);
            loadTown(townNodes.get(id)!, id, hud, layout, {
                onPlace: (pid) => {
                    if (pid === 'hiring') openHiring('self');
                    else if (TOWN_PLACES[pid]) hud.say(TOWN_PLACES[pid].intro);
                },
                onTalk: (pid) => talkOrGift(pid),
                onDoor: (door) => {
                    if (door.recipe) enterInterior(interiorKey(id, door), door.recipe, door.front);
                    else hud.say(door.locked ?? LOCKED_TEXT);
                },
                say: (t) => hud.say(t),
                spawn: () => (state.at.scene === 'town' && state.at.town === id && state.at.x >= 0 ? [state.at.x, state.at.y] : null),
                onHero: (hero) => townHeroes.set(id, hero),
                onStopped: (c) => {
                    if (where === 'town' && townId === id && !inside) markAt(c);
                },
            }, (f) => {
                focusTown.set(id, f);
            });
        }
        showScene();
        hud.setPlace(where, WORLD.regions[townId].name);
        refreshWeather();
    };
    /** 选去哪座镇子：只有一座就直接去 */
    const pickTown = () => {
        if (towns.length === 1) {
            goWhere(towns[0]);
            return;
        }
        openOverlay('TownPicker', (n) => buildTownPicker(n, overlayRect, towns, state.region, goWhere, () => {
            closeOverlay();
            onOverlayClosed();
        }));
    };
    const hud = buildHud(canvasNode, W, state, layout.hud, orientation, () => {
        if (where === 'village') pickTown();
        else goWhere('village');
    }, canRotate() ? () => {
        saveGame(store, state);
        rotateTo(orientation === 'portrait' ? 'landscape' : 'portrait', () => setTimeout(() => checkScreen(scene, state, store, sim), 300));
    } : null);
    hud.setPlace(where);
    /** 顶栏天气：村里跟村庄的地点，镇上跟那座镇子的原型地点；沙尘暴时整屏发黄 */
    const refreshWeather = () => {
        const now = Date.now();
        const r = where === 'village' ? WORLD.regions[state.region] : WORLD.regions[townId];
        const place = where === 'village' ? villagePlace(WORLD, state) : r.origin ?? '';
        const w = placeWeather(now, r, place);
        hud.setWeather(w, PLACES[place]?.name ?? '');
        const dl = light.getComponent(DayLight)!;
        dl.dust = w === 'dust';
        dl.redraw();
    };
    refreshWeather();
    simEvents.on('tick', refreshWeather);

    // 弹层（钓鱼、摆摊）盖住顶栏以下整块
    const overlayRect: Rect = { x: 0, y: hud.height, w: W, h: H - hud.height };
    const openOverlay = (name: string, attach: (n: Node) => void) => {
        closeOverlay();
        overlay = uiNode(name, canvasNode);
        placeRect(overlay, overlayRect, W, H);
        attach(overlay);
        showVillageUi();
    };
    const onOverlayClosed = () => {
        overlay = null;
        showVillageUi();
        build?.changed();
    };
    /** 雇人、辞退、调薪之后：推进一下、存档、重摆地盘上的人 */
    const onWorkersChanged = () => {
        sim.step();
        build?.changed();
        workers?.sync();
    };
    /** 招工处：self 是人在镇上点了告示栏，assistant 是看助理带回的名单 */
    const openHiring = (via: HireVia) => openOverlay('Hiring', (n) => {
        const v = n.addComponent(HiringView);
        Object.assign(v, { world: WORLD, state, via, onChanged: onWorkersChanged, onClose: onOverlayClosed });
    });
    // 镇上右下角：逛逛（依次把地图挪到各处风景）、去招工处（要点告示栏才能招人）
    const tours = new Map<string, number>();
    const goTo = (id: string) => {
        focusTown.get(townId)?.(id);
        hud.say(`${TOWN_PLACES[id].name}：${TOWN_PLACES[id].intro}`);
    };
    const nextSight = () => {
        const list = TOWN_TOURS[WORLD.regions[townId].map] ?? [];
        if (!list.length) return;
        const i = tours.get(townId) ?? 0;
        tours.set(townId, i + 1);
        goTo(list[i % list.length]);
    };
    townActions = buildActions(canvasNode, W, H, layout, [
        ['逛逛', nextSight],
        ['招工处', () => goTo('hiring')],
        ...(towns.length > 1 ? [['换镇子', pickTown] as [string, () => void]] : []),
    ]);
    townActions.active = false;
    // 对话框贴底，让开镇上右下角那列按钮
    const ta = townActions.getComponent(UITransform)!;
    const tp = townActions.position;
    chat = buildChatBox(canvasNode, W, H, hud.height, layout.hud.bottomPad,
        { x: tp.x + W / 2 - ta.width / 2, y: H / 2 - tp.y - ta.height / 2, w: ta.width, h: ta.height });

    const vv = village.addComponent(VillageView);
    vv.world = WORLD;
    vv.state = state;
    const mv = village.addComponent(MapView);
    mv.insetTop = hud.height;
    mv.insetBottom = layout.orientation === 'portrait' ? H - layout.panel.y : layout.hud.bottomPad;
    mv.insetRight = layout.orientation === 'landscape' ? W - layout.panel.x : 0;
    vv.onReady = () => {
        mv.relayout();
        build = panel.addComponent(VillageBuild);
        build.world = WORLD;
        build.state = state;
        build.store = store;
        build.view = vv;
        build.rect = layout.panel;
        build.mapRect = layout.map;
        build.screenW = W;
        build.screenH = H;
        build.side = layout.orientation === 'landscape';
        build.bottomPad = build.side ? 0 : layout.hud.bottomPad;
        build.onChange = () => hud.setPlace(where);
        build.report = sim.report;
        workers = village.addComponent(VillageWorkers);
        Object.assign(workers, { world: WORLD, state, view: vv });
        // 主角：放进建筑层和房子树木一起排前后；地盘摆了东西挡路表跟着变，每次出发现算
        const hero = village.addComponent(Hero);
        Object.assign(hero, {
            grid: () => walkGrid(WORLD, state.village), toLocal: (x: number, y: number) => vv.footAt(x, y),
            layer: vv.objects!, mapView: mv, spawn: villageSpawn(state),
            onMoved: (n: Node) => {
                if (!vv.actors.includes(n)) vv.actors.push(n);
                sortIntoSiblings(n);
            },
            onStopped: (c: Cell) => {
                if (where === 'village' && !inside) markAt(c);
            },
        });
        villageHero = hero;
        build.hero = hero;
        build.onDoor = (door) => {
            if (door.recipe) enterInterior(interiorKey('village', door), door.recipe, door.front);
            else build?.say(door.locked ?? LOCKED_TEXT);
        };
        actions = buildActions(canvasNode, W, H, layout, [
            ['巡村', () => build?.patrolAll()],
            ['工人', () => openOverlay('Workers', (n) => {
                const v = n.addComponent(WorkersView);
                Object.assign(v, {
                    world: WORLD, state, onChanged: onWorkersChanged, onClose: onOverlayClosed,
                    onReport: () => openHiring('assistant'),
                });
            })],
            ['钓鱼', () => openOverlay('Fishing', (n) => {
                const f = n.addComponent(FishingView);
                Object.assign(f, { world: WORLD, state, icons: vv, onGold: () => build?.changed(), onClose: onOverlayClosed });
            })],
            ['摆摊', () => openOverlay('Market', (n) => {
                const m = n.addComponent(MarketView);
                Object.assign(m, { world: WORLD, state, icons: vv, onGold: () => build?.changed(), onClose: onOverlayClosed });
            })],
            ['地点', () => openOverlay('PlacePicker', (n) => buildPlacePicker(n, overlayRect, state, (id) => {
                state.place = id;
                saveGame(store, state);
                closeOverlay();
                onOverlayClosed();
                refreshWeather();
                hud.say(`村里的天气跟着${PLACES[villagePlace(WORLD, state)]?.name ?? '老家'}走`);
            }, () => {
                closeOverlay();
                onOverlayClosed();
            }))],
        ]);
        showVillageUi();
        // 开机（或转屏重搭）时人在自家屋里：地盘画好了再进去
        if (resume && where === 'village') enterInterior(resume.key, resume.recipe, [state.at.x, state.at.y], [resume.x, resume.y]);
    };

    /** 和镇民说话：有人设的、背包里有礼物时先问聊天还是送礼 */
    const dismiss = () => {
        closeOverlay();
        onOverlayClosed();
    };
    const openGift = (npcId: string) => openOverlay('Gift', (n) => {
        const v = n.addComponent(ShopView);
        Object.assign(v, {
            world: WORLD, state, data: SHOP_DATA, icons: { village: vv, interior: atlas }, npcId, onClose: onOverlayClosed,
            onGiven: (text: string) => {
                saveGame(store, state);
                chat?.show(npcId, WORLD.npcs[npcId]?.name ?? '', text);
            },
        });
    });
    const talkOrGift = (id: string) => {
        if (!WORLD.npcs[id] || !giftsOwned(state, SHOP_DATA).length) {
            talkTo(id);
            return;
        }
        openOverlay('Talk', (n) => buildMenu(n, overlayRect, WORLD.npcs[id].name, [
            ['聊天', () => {
                dismiss();
                talkTo(id);
            }],
            ['送礼', () => openGift(id)],
            ['算了', dismiss],
        ]));
    };
    const openShop = (shopId: string, keeperName: string) => openOverlay('Shop', (n) => {
        const v = n.addComponent(ShopView);
        Object.assign(v, {
            world: WORLD, state, data: SHOP_DATA, icons: { village: vv, interior: atlas }, onClose: onOverlayClosed,
            shopId, keeperName, regionId: where === 'town' ? townId : state.region,
            onGold: () => {
                saveGame(store, state);
                build?.changed();
            },
        });
    });
    /** 点了掌柜：开店的问买东西还是聊天，有人设的还能送礼；只能聊天就直接说 */
    let keeperLine = 0;
    const keeperMenu = (recipe: InteriorRecipe) => {
        const k = recipe.keeper;
        if (!k) return;
        const npc = k.npc && WORLD.npcs[k.npc] ? k.npc : null;
        const say = () => {
            dismiss();
            if (npc) talkTo(npc);
            else chat?.show(k.look, k.name, k.lines[keeperLine++ % k.lines.length], 0, k.look);
        };
        const items: [string, () => void][] = [];
        if (recipe.shop) items.push(['买东西', () => openShop(recipe.shop!, k.name)]);
        items.push(['聊天', say]);
        if (npc && giftsOwned(state, SHOP_DATA).length) items.push(['送礼', () => openGift(npc)]);
        if (items.length === 1) {
            say();
            return;
        }
        items.push(['算了', dismiss]);
        openOverlay('Keeper', (n) => buildMenu(n, overlayRect, k.name, items));
    };
    /** 出门：拆掉屋子，回到门口朝外站 */
    const leaveInterior = () => {
        if (!inside) return;
        inside.destroy();
        inside = null;
        closeOverlay();
        chat?.hide();
        markAt([state.at.x, state.at.y]);
        saveGame(store, state);
        showScene();
        hud.say('');
        const h = where === 'village' ? villageHero : townHeroes.get(townId);
        h?.placeAt([state.at.x, state.at.y], 'down');
    };
    /**
     * 进屋：key 是这栋房子的钥匙，front 是门前那格（出来站这里），spawn 是屋里站哪（不给就是进门那格）。
     * 配方没了、自家房子拆了的（存档恢复时）就站在门外。
     */
    function enterInterior(key: string, recipeId: string, front: Cell, spawn?: Cell): void {
        const recipe = INTERIORS[recipeId];
        const gone = key.startsWith('v:') && !state.village.items.some((it) => `v:${it.uid}` === key);
        if (!recipe || gone) {
            markAt(front);
            return;
        }
        const go = (a: InteriorAtlas) => {
            if (inside) return;
            closeOverlay();
            chat?.hide();
            const room = interiorFor(INTERIOR_WORLD, state, recipeId, key);
            // 存档里 -1（或屋子排法变了出界）就站进门那格
            const ok = spawn && spawn[0] >= 0 && spawn[1] >= 0 && spawn[0] < room.w && spawn[1] < room.h;
            const at = ok ? spawn : room.entry;
            markAt(front);
            state.at.inside = { key, recipe: recipeId, x: at[0], y: at[1] };
            saveGame(store, state);
            const n = uiNode('Room', interiorHost);
            const v = n.addComponent(InteriorView);
            Object.assign(v, {
                world: INTERIOR_WORLD, recipe, layout: room, atlas: a, spawn: at,
                insetTop: hud.height, insetBottom: layout.hud.bottomPad,
                onKeeper: () => keeperMenu(recipe),
                onExit: leaveInterior,
                onStopped: (c: Cell) => {
                    if (state.at.inside) [state.at.inside.x, state.at.inside.y] = c;
                },
            });
            inside = n;
            showScene();
            hud.say(recipe.name);
        };
        if (atlas) go(atlas);
        else atlasWaiting.push(go);
    }

    // 开机（或转屏重搭）：回到存档记的地方；在镇上的屋里就直接进去，在自家屋里等地盘画好
    const resume = state.at.inside;
    if (state.at.scene === 'town' && towns.includes(state.at.town)) {
        goWhere(state.at.town);
        if (resume) enterInterior(resume.key, resume.recipe, [state.at.x, state.at.y], [resume.x, resume.y]);
    }

    current = {
        orientation, w: W, h: H, teardown: () => {
            simEvents.off('tick', refreshWeather);
            canvasNode.destroy();
        },
    };
}

/** 屏幕转了或者大小变了就重搭；只差一两个像素的不管。force 时无论如何重搭（换成了云端存档）。 */
function checkScreen(scene: Scene, state: GameState, store: SaveStore, sim: Sim, force = false): void {
    if (!current || !scene.isValid) return;
    const win = screen.windowSize;
    const o = orientationOf(win.width, win.height);
    const vis = view.getVisibleSize();
    if (!force && o === current.orientation && Math.abs(vis.width - current.w) < 2 && Math.abs(vis.height - current.h) < 2) return;
    saveGame(store, state);
    current.teardown();
    current = null;
    // 节点在这一帧末尾才真正销毁，下一帧再搭
    director.once(Director.EVENT_AFTER_UPDATE, () => buildMain(scene, state, store, sim));
}

let launching = false;

function onLaunch(scene: Scene): void {
    if (scene.name !== 'main' || scene.getChildByName('Canvas') || launching) return;
    launching = true;
    // 先定存档放哪（网页版可能要先输邀请码、拉服务器存档），再开局
    // 现实天气和存档一起准备，天气最多等几秒，免得离线这段推进用错天气
    void Promise.all([prepareBackend(), startRealWeather()]).then(([{ store, cloud }]) => {
        launching = false;
        if (scene.isValid) start(scene, store, cloud);
    });
}

function start(scene: Scene, store: SaveStore, cloud: CloudSync | null): void {
    // 新开局的老家先固定江南；选老家界面做好后在开局时选
    const state = loadOrNew(store, WORLD, 'jiangnan');
    // 常驻模拟：先把离线这段推进完再搭界面，之后每 10 秒推进一次，不跟着界面走
    const simNode = new Node('Sim');
    scene.addChild(simNode);
    director.addPersistRootNode(simNode);
    const sim = simNode.addComponent(Sim);
    Object.assign(sim, { world: WORLD, state, store, cloud });
    sim.report.value = sim.step();
    simEvents.on('replaced', () => checkScreen(scene, state, store, sim, true));
    buildMain(scene, state, store, sim);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => checkScreen(scene, state, store, sim), 150);
    };
    view.on('canvas-resize', onResize);
    // 微信转屏不一定触发画布尺寸事件，直接听转屏
    const wx = (globalThis as { wx?: { onDeviceOrientationChange?: (cb: () => void) => void } }).wx;
    wx?.onDeviceOrientationChange?.(onResize);
}

director.on(Director.EVENT_AFTER_SCENE_LAUNCH, onLaunch);
const launched = director.getScene();
if (launched) {
    onLaunch(launched);
}
