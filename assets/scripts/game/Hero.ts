// 主角小人：点哪里走到哪里。路线由 core/path 的 planWalk 算，沿路走的样子由 core/walk 的 poseAlong 算，这里只摆精灵。
// 镇上和自己地盘共用：挂到哪个地图上由调用方给挡路表、格子换坐标的函数和放人的图层。
// 人物图共用 people.png（第 HERO_ROW 行，四向三帧）。镜头跟随交给 MapView.follow。

import {
    _decorator, Component, ImageAsset, JsonAsset, Node, Rect, resources, Size, Sprite, SpriteFrame, Texture2D, UITransform, Vec2,
} from 'cc';
import { Area, Cell, nearestWalkable, planWalk, WalkGrid, WalkMode } from '../core/path';
import { Dir, poseAlong, pathLength } from '../core/walk';
import { MapView } from './MapView';

const { ccclass } = _decorator;
/** 人物图里主角那一行的名字（tools/art/people.ts 的 PEOPLE） */
const HERO_LOOK = 'hero';
/** 每秒走几格 */
const SPEED = 4;
const DIRS: Dir[] = ['down', 'left', 'right', 'up'];

interface FrameInfo {
    frameW: number;
    frameH: number;
    dirs: Dir[];
    frames: number;
    rows: string[];
}

@ccclass('Hero')
export class Hero extends Component {
    /** 当前地图的挡路表；地盘摆了东西会变，所以每次出发前现取 */
    grid!: () => WalkGrid;
    /** 格子坐标（脚下那格，可带小数）换成 layer 里的坐标：脚底中点 */
    toLocal!: (x: number, y: number) => [number, number];
    /** 人放在哪个节点下 */
    layer!: Node;
    /** 镜头跟随用 */
    mapView: MapView | null = null;
    /** 出生格子（被挡住就找最近的空格） */
    spawn: Cell = [0, 0];
    /** 每帧摆好位置后调用（地盘里要按脚底高低重新排前后） */
    onMoved: ((node: Node) => void) | null = null;
    /** 走完一段停下来时调用（Boot 记进存档的位置） */
    onStopped: ((cell: Cell) => void) | null = null;
    /** 出生时面朝哪边 */
    spawnDir: Dir = 'down';

    private node2: Node | null = null;
    private sprite: Sprite | null = null;
    private frames: SpriteFrame[][] = [];
    private x = 0;
    private y = 0;
    private dir: Dir = 'down';
    private path: Cell[] | null = null;
    private len = 0;
    private d = 0;
    private arrive: ((reached: boolean) => void) | null = null;
    private reached = true;
    private face: Cell | null = null;

    start(): void {
        resources.load('maps/people-frames', JsonAsset, (e1, info) => {
            resources.load('maps/people', ImageAsset, (e2, img) => {
                if (e1 || e2 || !info || !img || !this.node.isValid) return;
                this.build(info.json as FrameInfo, img);
            });
        });
    }

    get ready(): boolean {
        return this.node2 !== null;
    }

    /** 主角节点（排前后、测试用） */
    get actor(): Node | null {
        return this.node2;
    }

    /** 脚下的格子（走路途中取最近的那格） */
    get cell(): Cell {
        return [Math.round(this.x), Math.round(this.y)];
    }

    get walking(): boolean {
        return this.path !== null;
    }

    private build(info: FrameInfo, img: ImageAsset): void {
        const tex = new Texture2D();
        tex.image = img;
        tex.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
        const row = Math.max(0, info.rows.indexOf(HERO_LOOK));
        this.frames = info.dirs.map((_, di) => Array.from({ length: info.frames }, (_, f) => {
            const sf = new SpriteFrame();
            sf.texture = tex;
            sf.rect = new Rect((di * info.frames + f) * info.frameW, row * info.frameH, info.frameW, info.frameH);
            return sf;
        }));
        const n = new Node('Hero');
        n.layer = this.layer.layer;
        const ui = n.addComponent(UITransform);
        ui.setContentSize(new Size(info.frameW, info.frameH));
        ui.setAnchorPoint(new Vec2(0.5, 0));
        const s = n.addComponent(Sprite);
        s.sizeMode = Sprite.SizeMode.CUSTOM;
        this.layer.addChild(n);
        this.node2 = n;
        this.sprite = s;
        const at = nearestWalkable(this.grid(), this.spawn[0], this.spawn[1]) ?? this.spawn;
        [this.x, this.y] = at;
        this.dir = this.spawnDir;
        this.render(0);
        this.mapView?.follow(() => (this.node2?.isValid ? [this.node2.position.x, this.node2.position.y + 8] : null));
    }

    /**
     * 走到一块地方：onto 站进去（点空地面），beside 走到旁边（菜地、告示栏、镇民）。
     * 到了调 onArrive(reached)：reached 为 false 是走不过去、只走到了最近的地方。
     * 走路途中再点就从当前位置改道，上一次的 onArrive 不再调。还没加载好或完全走不了返回 false。
     */
    walkTo(area: Area, mode: WalkMode, onArrive: ((reached: boolean) => void) | null = null): boolean {
        if (!this.node2) return false;
        const from = this.cell;
        const plan = planWalk(this.grid(), from, area, mode);
        if (!plan) return false;
        // 从当前（可能在两格之间的）位置先走回最近的格子，再沿路线走，不会瞬移
        const path: Cell[] = this.x !== from[0] || this.y !== from[1] ? [[this.x, this.y], ...plan.path] : plan.path;
        this.path = path;
        this.len = pathLength(path);
        this.d = 0;
        this.arrive = onArrive;
        this.reached = plan.reached;
        // 到了以后面朝目标
        this.face = [area.x + (area.w - 1) / 2, area.y + (area.h - 1) / 2];
        this.mapView?.resumeFollow();
        return true;
    }

    update(dt: number): void {
        if (!this.node2) return;
        if (this.path) {
            this.d += SPEED * dt;
            this.render(this.d);
            if (this.d >= this.len) {
                const cb = this.arrive;
                const reached = this.reached;
                this.path = null;
                this.arrive = null;
                this.turnToFace();
                this.onStopped?.(this.cell);
                cb?.(reached);
            }
        }
    }

    /** 直接站到某格（进出门用）：停下正在走的路，不调上一次的 onArrive。还没加载好就改出生格。 */
    placeAt(cell: Cell, dir: Dir = 'down'): void {
        this.path = null;
        this.arrive = null;
        this.face = null;
        if (!this.node2) {
            this.spawn = cell;
            this.spawnDir = dir;
            return;
        }
        [this.x, this.y] = nearestWalkable(this.grid(), cell[0], cell[1]) ?? cell;
        this.dir = dir;
        this.place(0);
        this.mapView?.resumeFollow();
    }

    private turnToFace(): void {
        if (!this.face) return;
        const dx = this.face[0] - this.x;
        const dy = this.face[1] - this.y;
        if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
            this.dir = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
        }
        this.face = null;
        this.place(0);
    }

    private render(d: number): void {
        if (this.path) {
            const pose = poseAlong(this.path, d);
            this.x = pose.x;
            this.y = pose.y;
            this.dir = pose.dir;
            this.place(pose.frame);
        } else {
            this.place(0);
        }
    }

    private place(frame: number): void {
        const n = this.node2!;
        const [lx, ly] = this.toLocal(this.x, this.y);
        // 按物理像素取整（见 MapView.snap），镜头跟着它走，主角在屏幕上不抖
        const mv = this.mapView;
        n.setPosition(mv ? mv.snap(lx) : Math.round(lx), mv ? mv.snap(ly) : Math.round(ly), 0);
        this.sprite!.spriteFrame = this.frames[DIRS.indexOf(this.dir)][frame];
        this.onMoved?.(n);
    }

    onDestroy(): void {
        if (this.node2?.isValid) this.node2.destroy();
    }
}

/** 按脚底高低把 n 插到兄弟节点里：脚越靠下越后画（盖住后面的东西），兄弟节点已按这个顺序排好。 */
export function sortIntoSiblings(n: Node): void {
    const parent = n.parent;
    if (!parent) return;
    const y = n.position.y;
    let idx = 0;
    for (const c of parent.children) {
        if (c !== n && c.position.y > y) idx++;
    }
    if (n.getSiblingIndex() !== idx) n.setSiblingIndex(idx);
}
