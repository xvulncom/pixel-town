// 启动：主场景只是个空壳，相机、画布、地图、顶栏都在这里用代码搭，场景文件不用手工维护。
// 模块加载时注册场景启动回调，Cocos 会在启动时导入所有项目脚本。
// 画面分两处：自己的地盘（Village，开局进这里）和官方场地（Map，地域的镇子），顶栏按钮来回切。
// 横竖屏都能玩：屏幕转了（或窗口大小变了）就存档、把画布整个拆掉按新尺寸重搭，排版规则在 core/screen.ts。

import {
    Camera, Canvas, Color, Director, director, Graphics, Label, Node, ResolutionPolicy,
    HorizontalTextAlignment, profiler, resources, Scene, screen, Texture2D, TiledMap, TiledMapAsset, UITransform, view,
} from 'cc';
import { MapView } from './MapView';
import { People } from './People';
import { DayLight } from './DayLight';
import { VillageView } from './VillageView';
import { PANEL_H, VillageBuild } from './VillageBuild';
import { FishingView } from './FishingView';
import { MarketView } from './MarketView';
import { loadOrNew, localStore, saveGame, SaveStore } from './Store';
import { button, GOLD, INK, label, UI_LAYER, uiNode } from './ui';
import { canRotate, rotateTo, screenInsets } from './SafeArea';
import { HudLayout, Orientation, orientationOf, Rect, screenLayout, ScreenLayout } from '../core/screen';
import { WORLD } from '../data/world';
import { SEASON_NAMES, solarTermAt } from '../core/calendar';
import { weatherOn } from '../core/weather';
import { GameState, Weather } from '../core/types';

/** 竖屏的设计分辨率；横屏时宽高对调，按高度适配 */
const DESIGN_W = 720;
const DESIGN_H = 1280;

const WEATHER_NAMES: Record<Weather, string> = {
    sunny: '晴',
    cloudy: '多云',
    rain: '雨',
    snow: '雪',
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
    setPlace(where: 'village' | 'town'): void;
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
    const weather = weatherOn(now, region);
    const day = `${term.name} · ${WEATHER_NAMES[weather]}`;
    let where: 'village' | 'town' = 'village';
    let note = '';
    const render = () => {
        const tier = WORLD.tiers[state.village.tier].name;
        const place = where === 'village' ? `我的${tier}` : `${region.name} · 镇上`;
        const info = `${term.name}（${SEASON_NAMES[term.season]}）· ${WEATHER_NAMES[weather]}`;
        if (leftEar && rightEar) {
            leftEar.string = day;
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
        setPlace(w) {
            where = w;
            render();
        },
    };
}

/** 官方场地：地域的镇子，第一次去的时候才加载。 */
function loadTown(mapNode: Node, regionId: string, hud: Hud, layout: ScreenLayout): void {
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
        mv.insetTop = hud.height;
        mv.insetBottom = layout.hud.bottomPad;
        const people = mapNode.addComponent(People);
        people.mapPath = `maps/${WORLD.regions[regionId].map}`;
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

let current: { orientation: Orientation; w: number; h: number; teardown: () => void } | null = null;

function buildMain(scene: Scene, state: GameState, store: SaveStore): void {
    profiler.hideStats();
    const win = screen.windowSize;
    const orientation = orientationOf(win.width, win.height);
    const canvasNode = buildCanvas(scene, orientation);
    const vis = view.getVisibleSize();
    const W = vis.width;
    const H = vis.height;
    const layout = screenLayout(screenInsets(), PANEL_H);

    // 从下往上：镇子、自己的地盘、光照、建造栏、快捷玩法、顶栏、弹层
    const town = uiNode('Map', canvasNode);
    town.active = false;
    const village = uiNode('Village', canvasNode);
    const light = uiNode('DayLight', canvasNode);
    light.addComponent(Graphics);
    light.addComponent(DayLight);
    const panel = uiNode('BuildPanel', canvasNode);

    let where: 'village' | 'town' = 'village';
    let townLoaded = false;
    let build: VillageBuild | null = null;
    let overlay: Node | null = null;
    let actions: Node | null = null;
    const closeOverlay = () => {
        if (overlay?.isValid) overlay.destroy();
        overlay = null;
    };
    const showVillageUi = () => {
        const v = where === 'village';
        panel.active = v;
        if (actions) actions.active = v && !overlay;
    };
    const hud = buildHud(canvasNode, W, state, layout.hud, orientation, () => {
        closeOverlay();
        where = where === 'village' ? 'town' : 'village';
        if (where === 'town' && !townLoaded) {
            townLoaded = true;
            loadTown(town, state.region, hud, layout);
        }
        town.active = where === 'town';
        village.active = where === 'village';
        showVillageUi();
        hud.setPlace(where);
    }, canRotate() ? () => {
        saveGame(store, state);
        rotateTo(orientation === 'portrait' ? 'landscape' : 'portrait', () => setTimeout(() => checkScreen(scene, state, store), 300));
    } : null);
    hud.setPlace(where);

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
        actions = buildActions(canvasNode, W, H, layout, [
            ['巡村', () => build?.patrolAll()],
            ['钓鱼', () => openOverlay('Fishing', (n) => {
                const f = n.addComponent(FishingView);
                Object.assign(f, { world: WORLD, state, icons: vv, onGold: () => build?.changed(), onClose: onOverlayClosed });
            })],
            ['摆摊', () => openOverlay('Market', (n) => {
                const m = n.addComponent(MarketView);
                Object.assign(m, { world: WORLD, state, icons: vv, onGold: () => build?.changed(), onClose: onOverlayClosed });
            })],
        ]);
        showVillageUi();
    };

    current = { orientation, w: W, h: H, teardown: () => canvasNode.destroy() };
}

/** 屏幕转了或者大小变了就重搭；只差一两个像素的不管。 */
function checkScreen(scene: Scene, state: GameState, store: SaveStore): void {
    if (!current || !scene.isValid) return;
    const win = screen.windowSize;
    const o = orientationOf(win.width, win.height);
    const vis = view.getVisibleSize();
    if (o === current.orientation && Math.abs(vis.width - current.w) < 2 && Math.abs(vis.height - current.h) < 2) return;
    saveGame(store, state);
    current.teardown();
    current = null;
    // 节点在这一帧末尾才真正销毁，下一帧再搭
    director.once(Director.EVENT_AFTER_UPDATE, () => buildMain(scene, state, store));
}

function onLaunch(scene: Scene): void {
    if (scene.name !== 'main' || scene.getChildByName('Canvas')) return;
    const store = localStore;
    // 新开局的老家先固定江南；选老家界面做好后在开局时选
    const state = loadOrNew(store, WORLD, 'jiangnan');
    buildMain(scene, state, store);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => checkScreen(scene, state, store), 150);
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
