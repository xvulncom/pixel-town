// 启动：主场景只是个空壳，相机、画布、地图、顶栏都在这里用代码搭，场景文件不用手工维护。
// 模块加载时注册场景启动回调，Cocos 会在启动时导入所有项目脚本。
// 画面分两处：自己的地盘（Village，开局进这里）和官方场地（Map，地域的镇子），顶栏按钮来回切。

import {
    Camera, Canvas, Color, Director, director, Graphics, Label, Node, ResolutionPolicy,
    HorizontalTextAlignment, profiler, resources, Scene, Texture2D, TiledMap, TiledMapAsset, UITransform, view,
} from 'cc';
import { MapView } from './MapView';
import { People } from './People';
import { DayLight } from './DayLight';
import { VillageView } from './VillageView';
import { PANEL_H, VillageBuild } from './VillageBuild';
import { loadOrNew, localStore } from './Store';
import { button, INK, label, UI_LAYER, uiNode } from './ui';
import { screenInsets } from './SafeArea';
import { hudLayout, HudLayout } from '../core/screen';
import { WORLD } from '../data/world';
import { SEASON_NAMES, solarTermAt } from '../core/calendar';
import { weatherOn } from '../core/weather';
import { GameState, Weather } from '../core/types';

const DESIGN_W = 720;
const DESIGN_H = 1280;

const GOLD = new Color(255, 214, 102, 255);

const WEATHER_NAMES: Record<Weather, string> = {
    sunny: '晴',
    cloudy: '多云',
    rain: '雨',
    snow: '雪',
};

function buildCanvas(scene: Scene): Node {
    view.setDesignResolutionSize(DESIGN_W, DESIGN_H, ResolutionPolicy.FIXED_WIDTH);

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

interface Hud {
    /** 顶栏总高，地图上方让出这么多 */
    height: number;
    say(text: string): void;
    setPlace(where: 'village' | 'town'): void;
}

/**
 * 顶栏：刘海屏、灵动岛机型把节气天气和金币放在岛的两侧，下面一行是地名和切换按钮（让开微信胶囊）；
 * 普通屏没有两侧空档，信息并进地名下面一行。排版规则在 core/screen.ts。
 */
function buildHud(canvasNode: Node, state: GameState, layout: HudLayout, onToggle: () => void): Hud {
    const H = layout.height;
    const hud = uiNode('Hud', canvasNode, DESIGN_W, H);
    // 代码搭的节点 Widget 不生效，手动贴顶，屏幕尺寸变了再贴一次
    const stickTop = () => {
        // 换场景后节点已销毁，监听要跟着撤掉
        if (!hud.isValid) {
            view.off('canvas-resize', stickTop);
            return;
        }
        hud.setPosition(0, view.getVisibleSize().height / 2 - H / 2, 0);
    };
    stickTop();
    view.on('canvas-resize', stickTop);
    // 设计坐标（左上角原点）换成顶栏节点里的坐标
    const at = (x: number, y: number): [number, number] => [x - DESIGN_W / 2, H / 2 - y];

    const bg = hud.addComponent(Graphics);
    bg.fillColor = new Color(0, 0, 0, 140);
    bg.rect(-DESIGN_W / 2, -H / 2, DESIGN_W, H);
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
    const btnW = 170;
    const toggle = button(hud, '去镇上', btnW, 70, onToggle, 'Toggle');
    const [bx, by] = at(row.right - btnW / 2, (row.top + row.bottom) / 2);
    toggle.node.setPosition(bx, by, 0);
    const title = text('Text', row.left, row.right - btnW - 12, row.top, row.bottom, ears ? 32 : 28, Label.HorizontalAlign.CENTER);
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
function loadTown(mapNode: Node, regionId: string, hud: Hud): void {
    resources.load(`maps/${WORLD.regions[regionId].map}`, TiledMapAsset, (err, asset) => {
        if (err || !asset) {
            console.error('地图加载失败', err);
            hud.say('地图加载失败');
            return;
        }
        // 像素风：关掉线性过滤，放大后不糊
        for (const sf of asset.spriteFrames) {
            sf.texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
        }
        const tiled = mapNode.addComponent(TiledMap);
        tiled.tmxAsset = asset;
        mapNode.addComponent(MapView).insetTop = hud.height;
        const people = mapNode.addComponent(People);
        people.mapPath = `maps/${WORLD.regions[regionId].map}`;
    });
}

function buildMain(scene: Scene): void {
    profiler.hideStats();
    const store = localStore;
    // 新开局的老家先固定江南；选老家界面做好后在开局时选
    const state = loadOrNew(store, WORLD, 'jiangnan');
    const canvasNode = buildCanvas(scene);
    const layout = hudLayout(screenInsets());

    // 从下往上：镇子、自己的地盘、光照、建造栏、顶栏
    const town = uiNode('Map', canvasNode);
    town.active = false;
    const village = uiNode('Village', canvasNode);
    const light = uiNode('DayLight', canvasNode);
    light.addComponent(Graphics);
    light.addComponent(DayLight);
    const panel = uiNode('BuildPanel', canvasNode, DESIGN_W, PANEL_H);

    let where: 'village' | 'town' = 'village';
    let townLoaded = false;
    const hud = buildHud(canvasNode, state, layout, () => {
        where = where === 'village' ? 'town' : 'village';
        if (where === 'town' && !townLoaded) {
            townLoaded = true;
            loadTown(town, state.region, hud);
        }
        town.active = where === 'town';
        village.active = panel.active = where === 'village';
        hud.setPlace(where);
    });
    hud.setPlace(where);

    const vv = village.addComponent(VillageView);
    vv.world = WORLD;
    vv.state = state;
    const mv = village.addComponent(MapView);
    mv.insetTop = hud.height;
    mv.insetBottom = PANEL_H + layout.bottomPad;
    vv.onReady = () => {
        mv.relayout();
        const build = panel.addComponent(VillageBuild);
        build.world = WORLD;
        build.state = state;
        build.store = store;
        build.view = vv;
        build.bottomPad = layout.bottomPad;
        build.onChange = () => hud.setPlace(where);
    };
}

function onLaunch(scene: Scene): void {
    if (scene.name === 'main' && !scene.getChildByName('Canvas')) {
        buildMain(scene);
    }
}

director.on(Director.EVENT_AFTER_SCENE_LAUNCH, onLaunch);
const current = director.getScene();
if (current) {
    onLaunch(current);
}
