// 镇上走动的人：读地图配套的路线文件和人物帧图，按 core/walk 算出的位置摆精灵。
// 人物层夹在 deco 和 over 两个图层之间：脚踩在物体底部前面，头会被树冠、屋檐挡住。

import {
    _decorator, Component, ImageAsset, JsonAsset, Node, Rect, resources, Size, Sprite, SpriteFrame, Texture2D,
    TiledMap, UITransform, Vec2,
} from 'cc';
import { Dir, poseAt, WalkRoute } from '../core/walk';
import { MapView } from './MapView';

const { ccclass } = _decorator;
const TILE = 16;

interface FrameInfo {
    frameW: number;
    frameH: number;
    dirs: Dir[];
    frames: number;
    rows: string[];
}

interface WalkerData extends WalkRoute {
    id: string;
    row: number;
}

interface Actor {
    data: WalkerData;
    node: Node;
    sprite: Sprite;
    /** [朝向][帧] */
    frames: SpriteFrame[][];
}

@ccclass('People')
export class People extends Component {
    /** 地图资源路径，如 maps/jiangnan，路线文件是 <路径>.walkers.json */
    mapPath = '';
    private actors: Actor[] = [];
    private layer: Node | null = null;
    private t0 = Date.now();
    /** 一起排前后的别的人（主角），放在 layer 下 */
    readonly extras: Node[] = [];
    /** 人物层建好后调用（主角要放进来） */
    onLayer: ((layer: Node) => void) | null = null;

    start(): void {
        const tiled = this.getComponent(TiledMap);
        if (!tiled) return;
        resources.load(`${this.mapPath}.walkers`, JsonAsset, (e1, walkers) => {
            resources.load('maps/people-frames', JsonAsset, (e2, info) => {
                resources.load('maps/people', ImageAsset, (e3, img) => {
                    if (e1 || e2 || e3 || !walkers || !info || !img) {
                        console.error('人物资源加载失败', e1 ?? e2 ?? e3);
                        return;
                    }
                    this.build(tiled, walkers.json as WalkerData[], info.json as FrameInfo, img);
                });
            });
        });
    }

    private build(tiled: TiledMap, walkers: WalkerData[], info: FrameInfo, img: ImageAsset): void {
        const tex = new Texture2D();
        tex.image = img;
        tex.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);

        // 插在 deco 图层后面，over 图层就会盖在人头上
        const layer = new Node('People');
        layer.layer = this.node.layer;
        layer.addComponent(UITransform);
        this.node.addChild(layer);
        const deco = tiled.getLayer('deco');
        if (deco) layer.setSiblingIndex(deco.node.getSiblingIndex() + 1);
        this.layer = layer;
        this.onLayer?.(layer);

        const cut = (row: number, col: number) => {
            const sf = new SpriteFrame();
            sf.texture = tex;
            sf.rect = new Rect(col * info.frameW, row * info.frameH, info.frameW, info.frameH);
            return sf;
        };
        for (const data of walkers) {
            const node = new Node(data.id);
            node.layer = this.node.layer;
            const ui = node.addComponent(UITransform);
            ui.setContentSize(new Size(info.frameW, info.frameH));
            // 锚点在脚底中间
            ui.setAnchorPoint(new Vec2(0.5, 0));
            const sprite = node.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            const frames = info.dirs.map((_, di) => Array.from({ length: info.frames }, (_, f) => cut(data.row, di * info.frames + f)));
            layer.addChild(node);
            this.actors.push({ data, node, sprite, frames });
        }
        this.update();
    }

    /** 格子坐标（脚下那格，可带小数）换成地图节点里的坐标：地图以中心为原点。 */
    toLocal(x: number, y: number): [number, number] {
        const ui = this.node.getComponent(UITransform)!;
        return [(x + 0.5) * TILE - ui.width / 2, ui.height / 2 - (y + 1) * TILE];
    }

    update(): void {
        if (!this.layer) return;
        const seconds = (Date.now() - this.t0) / 1000;
        const mv = this.node.getComponent(MapView);
        for (const a of this.actors) {
            const pose = poseAt(a.data, seconds);
            const [lx, ly] = this.toLocal(pose.x, pose.y);
            // 按物理像素取整：按地图像素取整的话放大后一步跳好几个屏幕像素，走起来一顿一顿
            a.node.setPosition(mv ? mv.snap(lx) : Math.round(lx), mv ? mv.snap(ly) : Math.round(ly), 0);
            const di = ['down', 'left', 'right', 'up'].indexOf(pose.dir);
            a.sprite.spriteFrame = a.frames[di][pose.frame];
        }
        // 靠下的人后画，挡住靠上的人
        const nodes = [...this.actors.map((a) => a.node), ...this.extras.filter((n) => n.isValid && n.parent === this.layer)];
        nodes.sort((p, q) => q.position.y - p.position.y);
        nodes.forEach((n, i) => n.setSiblingIndex(i));
    }

    /** 点到的格子上站着谁（人占脚下一格和头顶一格），返回 id 和脚下格子；没人返回 null。 */
    walkerAt(tx: number, ty: number): { id: string; x: number; y: number } | null {
        const seconds = (Date.now() - this.t0) / 1000;
        for (const a of this.actors) {
            const p = poseAt(a.data, seconds);
            const x = Math.round(p.x);
            const y = Math.round(p.y);
            if (tx === x && (ty === y || ty === y - 1)) return { id: a.data.id, x, y };
        }
        return null;
    }
}
