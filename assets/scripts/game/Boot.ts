// 启动：主场景只是个空壳，相机、画布、地图、顶栏都在这里用代码搭，场景文件不用手工维护。
// 模块加载时注册场景启动回调，Cocos 会在启动时导入所有项目脚本。
// 画面分两处：自己的地盘（Village，开局进这里）和官方场地（Map，地域的镇子），顶栏按钮来回切。

import {
    Camera, Canvas, Color, Director, director, Graphics, Label, Node, ResolutionPolicy,
    profiler, resources, Scene, Texture2D, TiledMap, TiledMapAsset, UITransform, view,
} from 'cc';
import { MapView } from './MapView';
import { People } from './People';
import { DayLight } from './DayLight';
import { VillageView } from './VillageView';
import { PANEL_H, VillageBuild } from './VillageBuild';
import { loadOrNew, localStore } from './Store';
import { button, UI_LAYER, uiNode } from './ui';
import { WORLD } from '../data/world';
import { SEASON_NAMES, solarTermAt } from '../core/calendar';
import { weatherOn } from '../core/weather';
import { GameState, Weather } from '../core/types';

const DESIGN_W = 720;
const DESIGN_H = 1280;
const HUD_H = 120;

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
    label: Label;
    setPlace(where: 'village' | 'town'): void;
}

function buildHud(canvasNode: Node, state: GameState, onToggle: () => void): Hud {
    const hud = uiNode('Hud', canvasNode, DESIGN_W, HUD_H);
    // 代码搭的节点 Widget 不生效，手动贴顶，屏幕尺寸变了再贴一次
    const stickTop = () => {
        // 换场景后节点已销毁，监听要跟着撤掉
        if (!hud.isValid) {
            view.off('canvas-resize', stickTop);
            return;
        }
        hud.setPosition(0, view.getVisibleSize().height / 2 - HUD_H / 2, 0);
    };
    stickTop();
    view.on('canvas-resize', stickTop);

    const bg = hud.addComponent(Graphics);
    bg.fillColor = new Color(0, 0, 0, 140);
    bg.rect(-DESIGN_W / 2, -HUD_H / 2, DESIGN_W, HUD_H);
    bg.fill();
    // 点在顶栏上不拖地图
    hud.on(Node.EventType.TOUCH_START, () => undefined);

    const textNode = uiNode('Text', hud, DESIGN_W - 220, HUD_H);
    textNode.setPosition(-90, 0, 0);
    const label = textNode.addComponent(Label);
    label.fontSize = 28;
    label.lineHeight = 40;
    label.color = new Color(255, 248, 225, 255);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.overflow = Label.Overflow.SHRINK;

    const toggle = button(hud, '去镇上', 170, 70, onToggle, 'Toggle');
    toggle.node.setPosition(DESIGN_W / 2 - 100, 0, 0);

    const now = Date.now();
    const region = WORLD.regions[state.region];
    const term = solarTermAt(now);
    const weather = weatherOn(now, region);
    const day = `${term.name}（${SEASON_NAMES[term.season]}）· ${WEATHER_NAMES[weather]}`;
    return {
        label,
        setPlace(where) {
            const tier = WORLD.tiers[state.village.tier].name;
            label.string = where === 'village' ? `我的${tier}\n${day}` : `${region.name} · 镇上\n${day} · 拖动看看`;
            toggle.label.string = where === 'village' ? '去镇上' : `回${tier}`;
        },
    };
}

/** 官方场地：地域的镇子，第一次去的时候才加载。 */
function loadTown(mapNode: Node, regionId: string, hud: Hud): void {
    resources.load(`maps/${WORLD.regions[regionId].map}`, TiledMapAsset, (err, asset) => {
        if (err || !asset) {
            console.error('地图加载失败', err);
            hud.label.string = '地图加载失败';
            return;
        }
        // 像素风：关掉线性过滤，放大后不糊
        for (const sf of asset.spriteFrames) {
            sf.texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
        }
        const tiled = mapNode.addComponent(TiledMap);
        tiled.tmxAsset = asset;
        mapNode.addComponent(MapView).insetTop = HUD_H;
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
    const hud = buildHud(canvasNode, state, () => {
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
    mv.insetTop = HUD_H;
    mv.insetBottom = PANEL_H;
    vv.onReady = () => {
        mv.relayout();
        const build = panel.addComponent(VillageBuild);
        build.world = WORLD;
        build.state = state;
        build.store = store;
        build.view = vv;
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
