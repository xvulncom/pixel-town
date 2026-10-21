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

/**
 * 镇上能点的地方：每处头上挂个牌子，点到那块格子（含上面一行屋檐）就调 onPlace。
 * 招工处要人亲自到镇上来点，这就是"亲自前往"。ready 交回一个把地图挪到某处的函数。
 */
function bindPlaces(mapNode: Node, mapPath: string, onPlace: (id: string) => void, ready: (focus: (id: string) => void) => void): void {
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
        let start: Vec2 | null = null;
        mapNode.on(Node.EventType.TOUCH_START, (e: EventTouch) => {
            start = e.getAllTouches().length === 1 ? e.getUILocation() : null;
        });
        mapNode.on(Node.EventType.TOUCH_END, (e: EventTouch) => {
            const s = start;
            start = null;
            if (!s || Vec2.distance(s, e.getUILocation()) > 12) return;
            const ui = mapNode.getComponent(UITransform)!;
            const vis = view.getVisibleSize();
            const canvas = mapNode.parent!.getComponent(UITransform)!;
            const loc = e.getUILocation();
            const p = ui.convertToNodeSpaceAR(canvas.convertToWorldSpaceAR(new Vec3(loc.x - vis.width / 2, loc.y - vis.height / 2, 0)));
            const tx = Math.floor((p.x + ui.width / 2) / 16);
            const ty = Math.floor((ui.height / 2 - p.y) / 16);
            const hit = places.find((q) => tx >= q.x && tx < q.x + q.w && ty >= q.y - 1 && ty < q.y + q.h);
            if (hit) onPlace(hit.id);
        });
        ready((id) => {
            const p = places.find((q) => q.id === id);
            if (!p) return;
            const [cx, cy] = townCell(mapNode, p.x + (p.w - 1) / 2, p.y + (p.h - 1) / 2);
            mapNode.getComponent(MapView)?.focus(cx, cy);
        });
    });
}

/** 官方场地：地域的镇子，第一次去的时候才加载。 */
function loadTown(mapNode: Node, regionId: string, hud: Hud, layout: ScreenLayout,
    onPlace: (id: string) => void, ready: (focus: (id: string) => void) => void): void {
    resources.load(`maps/${WORLD.regions[regionId].map}`, TiledMapAsset, (err, asset) => {
        if (err || !asset) {
            console.error('地图加载失败', err);
            hud.say('地图加载失败');
            return;
        }
        if (!mapNode.isValid) return;
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
        people.mapPath = `maps/${WORLD.regions[regionId].map}`;
        bindPlaces(mapNode, people.mapPath, onPlace, ready);
    });
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
    const closeOverlay = () => {
        if (overlay?.isValid) overlay.destroy();
        overlay = null;
    };
    const showVillageUi = () => {
        const v = where === 'village';
        panel.active = v;
        if (actions) actions.active = v && !overlay;
        if (townActions) townActions.active = !v && !overlay;
    };
    /** 去哪儿：village 回自己地盘，否则去那座镇子 */
    const goWhere = (to: 'village' | string) => {
        closeOverlay();
        where = to === 'village' ? 'village' : 'town';
        if (where === 'town') townId = to;
        if (where === 'town' && !townLoaded.has(townId)) {
            const id = townId;
            townLoaded.add(id);
            loadTown(townNodes.get(id)!, id, hud, layout, (pid) => {
                if (pid === 'hiring') openHiring('self');
                else if (TOWN_PLACES[pid]) hud.say(TOWN_PLACES[pid].intro);
            }, (f) => {
                focusTown.set(id, f);
            });
        }
        for (const [id, n] of townNodes) n.active = where === 'town' && id === townId;
        village.active = where === 'village';
        showVillageUi();
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
    };

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
