// 启动：主场景只是个空壳，相机、画布、地图、顶栏都在这里用代码搭，场景文件不用手工维护。
// 模块加载时注册场景启动回调，Cocos 会在启动时导入所有项目脚本。

import {
    Camera, Canvas, Color, Director, director, Graphics, Label, Layers, Node, ResolutionPolicy,
    profiler, resources, Scene, Texture2D, TiledMap, TiledMapAsset, UITransform, view,
} from 'cc';
import { MapView } from './MapView';
import { WORLD } from '../data/world';
import { SEASON_NAMES, solarTermAt } from '../core/calendar';
import { weatherOn } from '../core/weather';
import { Weather } from '../core/types';

const DESIGN_W = 720;
const DESIGN_H = 1280;
const UI = Layers.Enum.UI_2D;
const HUD_H = 120;

const WEATHER_NAMES: Record<Weather, string> = {
    sunny: '晴',
    cloudy: '多云',
    rain: '雨',
    snow: '雪',
};

function uiNode(name: string, parent: Node): Node {
    const n = new Node(name);
    n.layer = UI;
    parent.addChild(n);
    n.addComponent(UITransform);
    return n;
}

function buildCanvas(scene: Scene): Node {
    view.setDesignResolutionSize(DESIGN_W, DESIGN_H, ResolutionPolicy.FIXED_WIDTH);

    const canvasNode = new Node('Canvas');
    canvasNode.layer = UI;
    scene.addChild(canvasNode);
    canvasNode.addComponent(UITransform);

    const camNode = new Node('Camera');
    camNode.layer = UI;
    canvasNode.addChild(camNode);
    camNode.setPosition(0, 0, 1000);
    const cam = camNode.addComponent(Camera);
    cam.projection = Camera.ProjectionType.ORTHO;
    cam.visibility = UI;
    cam.clearFlags = Camera.ClearFlag.SOLID_COLOR;
    cam.clearColor = new Color(32, 48, 32, 255);
    cam.near = 1;
    cam.far = 2000;

    const canvas = canvasNode.addComponent(Canvas);
    canvas.cameraComponent = cam;
    canvas.alignCanvasWithScreen = true;
    return canvasNode;
}

function buildHud(canvasNode: Node, regionId: string): Label {
    const hud = uiNode('Hud', canvasNode);
    hud.getComponent(UITransform)!.setContentSize(DESIGN_W, HUD_H);
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

    const textNode = uiNode('Text', hud);
    textNode.getComponent(UITransform)!.setContentSize(DESIGN_W - 40, HUD_H);
    const label = textNode.addComponent(Label);
    label.fontSize = 28;
    label.lineHeight = 40;
    label.color = new Color(255, 248, 225, 255);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.overflow = Label.Overflow.SHRINK;

    const now = Date.now();
    const region = WORLD.regions[regionId];
    const term = solarTermAt(now);
    const weather = weatherOn(now, region);
    label.string = `像素小镇 · ${region.name}\n${term.name}（${SEASON_NAMES[term.season]}）· ${WEATHER_NAMES[weather]} · 拖动看看，双指缩放`;
    return label;
}

function buildMap(canvasNode: Node, regionId: string, hudLabel: Label): void {
    const mapNode = uiNode('Map', canvasNode);
    mapNode.setSiblingIndex(1);
    resources.load(`maps/${WORLD.regions[regionId].map}`, TiledMapAsset, (err, asset) => {
        if (err || !asset) {
            console.error('地图加载失败', err);
            hudLabel.string = '地图加载失败';
            return;
        }
        // 像素风：关掉线性过滤，放大后不糊
        for (const sf of asset.spriteFrames) {
            sf.texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
        }
        const tiled = mapNode.addComponent(TiledMap);
        tiled.tmxAsset = asset;
        mapNode.addComponent(MapView);
    });
}

function buildMain(scene: Scene): void {
    profiler.hideStats();
    // 一期只有江南地图；选老家界面做好后从存档读地域
    const regionId = 'jiangnan';
    const canvasNode = buildCanvas(scene);
    const hudLabel = buildHud(canvasNode, regionId);
    buildMap(canvasNode, regionId, hudLabel);
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
