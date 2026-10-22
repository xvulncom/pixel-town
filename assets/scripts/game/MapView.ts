// 地图视图：单指拖动、双指缩放（开发者工具里用滚轮缩放），不让地图拖出屏幕。
// 触摸挂在地图节点上：点在顶栏、建造栏这些界面上时不会拖动地图。
// 点按也在这里分：单指移动不超过 TAP_SLOP 算点了一下，交给 onTap 登记的处理；超过算拖动，双指算缩放。
// 镜头跟随：follow 给一个目标（主角），每帧把它挪到地图露出部分的中间；手动拖动就停，resumeFollow 再接上。
// 像素对齐（照星露谷）：缩放只取"一个美术像素 = 整数个物理像素"的档，地图位置停在物理像素格上；
// 地图上的人物用 snap() 取整。拖动和跟随先在 pos 里连续累加，显示时才取整，慢慢拖也拖得动。规则在 core/screen.ts。

import { _decorator, Component, EventMouse, EventTouch, macro, Node, screen, UITransform, Vec2, view } from 'cc';
import { minMapZoom, snapOffset, snapToGrid, snapZoom } from '../core/screen';

const { ccclass } = _decorator;

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const DEFAULT_SCALE = 3;
/** 手指移动不超过这么多（设计像素）算点了一下，超过算拖地图。 */
export const TAP_SLOP = 12;
/** 镜头跟随的快慢：每秒追上剩余距离的比例 */
const FOLLOW_RATE = 6;

/**
 * 瓦片地图每个图层把一屏的格子塞进一块顶点缓冲。引擎默认 144KB 只够约 1000 格，
 * 镇子缩到 1 倍时一屏约 4000 格，申请失败后每帧报错、画面卡死（2026-10-21 缩小后拖不动）。
 * 这里调到 1MB（上限 2303KB），必须在第一张瓦片地图渲染前设，所以放在模块加载时。
 */
const TILED_MEM_KB = 1024;
macro.BATCHER2D_MEM_INCREMENT = TILED_MEM_KB;
/** 一个图层最多能画的格数：每格 4 个顶点，每个顶点 36 字节（位置 3、UV 2、颜色 4 个 float）。 */
export const TILED_MAX_CELLS = Math.floor((TILED_MEM_KB * 1024) / 36 / 4);

function clamp(v: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, v));
}

@ccclass('MapView')
export class MapView extends Component {
    /** 屏幕四边被界面挡住的宽度（设计分辨率像素），地图能多拖一点，边上的格子不会藏在界面底下。 */
    insetTop = 0;
    insetBottom = 0;
    insetLeft = 0;
    insetRight = 0;
    /** 瓦片地图填 TILED_MAX_CELLS，最小缩放会让一屏格子数不超过它；不是瓦片地图不填。 */
    maxCells = 0;
    /** 最小缩放要不要铺满屏幕。屋里地图小，不铺满，比屏幕小时居中，四周黑底。 */
    fill = true;
    /** 一开始的缩放 */
    startZoom = DEFAULT_SCALE;
    /** 实际用的缩放（物理整数倍），pinch 在 rawZoom 上连续累加 */
    private zoom = DEFAULT_SCALE;
    private rawZoom = DEFAULT_SCALE;
    /** 地图节点没取整的位置 */
    private pos = new Vec2();
    private pinchDist = 0;
    /** 这次触摸单指按下的位置；第二根手指落下或拖过 TAP_SLOP 后就不算点按了 */
    private touchStart: Vec2 | null = null;
    private dragging = false;
    private multi = false;
    private taps: ((ui: Vec2) => void)[] = [];
    private followTarget: (() => [number, number] | null) | null = null;
    private following = false;

    onEnable(): void {
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        this.node.on(Node.EventType.MOUSE_WHEEL, this.onWheel, this);
    }

    onDisable(): void {
        this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        this.node.off(Node.EventType.MOUSE_WHEEL, this.onWheel, this);
    }

    start(): void {
        this.setZoom(this.startZoom);
    }

    /** 地图内容大小变了（比如地盘升档）之后调用，重新算缩放和边界。 */
    relayout(): void {
        this.setZoom(this.zoom);
    }

    /** 一个美术像素占几个物理像素（整数） */
    get pixelScale(): number {
        return Math.round(this.zoom * this.ratio());
    }

    /** 地图节点里的坐标取到物理像素格；人物每帧摆位置时用它，不再按地图像素取整。 */
    snap(v: number): number {
        return snapToGrid(v, this.pixelScale);
    }

    /** 每个设计像素占几个物理像素 */
    private ratio(): number {
        const vis = view.getVisibleSize();
        const r = vis.width > 0 ? screen.windowSize.width / vis.width : 1;
        return r > 0 ? r : 1;
    }

    /** 登记点按处理：参数是 UI 坐标（原点在屏幕左下角）。 */
    onTap(fn: (ui: Vec2) => void): void {
        this.taps.push(fn);
    }

    /** 镜头跟着 target 给的点（地图节点里的坐标）走；target 返回 null 时不动。 */
    follow(target: () => [number, number] | null): void {
        this.followTarget = target;
        this.following = true;
    }

    /** 手动拖开之后，主角再动起来时接着跟。 */
    resumeFollow(): void {
        this.following = true;
    }

    private onTouchStart(e: EventTouch): void {
        if (e.getAllTouches().length === 1) {
            this.touchStart = e.getUILocation();
            this.dragging = false;
            this.multi = false;
        } else {
            this.multi = true;
        }
    }

    private onTouchMove(e: EventTouch): void {
        const touches = e.getAllTouches();
        if (touches.length >= 2) {
            this.multi = true;
            const d = Vec2.distance(touches[0].getUILocation(), touches[1].getUILocation());
            if (this.pinchDist > 0) {
                this.setZoom(this.rawZoom * (d / this.pinchDist));
            }
            this.pinchDist = d;
            return;
        }
        this.pinchDist = 0;
        // 没超过 TAP_SLOP 前地图不动，松手还算点按
        if (!this.dragging && !this.multi) {
            if (!this.touchStart || Vec2.distance(this.touchStart, e.getUILocation()) <= TAP_SLOP) return;
            this.dragging = true;
        }
        this.following = false;
        const delta = e.getUIDelta();
        this.moveTo(this.pos.x + delta.x, this.pos.y + delta.y);
    }

    private onTouchEnd(e: EventTouch): void {
        this.pinchDist = 0;
        const tap = this.touchStart !== null && !this.dragging && !this.multi
            && Vec2.distance(this.touchStart, e.getUILocation()) <= TAP_SLOP;
        if (e.getAllTouches().length <= 1) this.touchStart = null;
        if (!tap) return;
        const loc = e.getUILocation();
        for (const fn of this.taps) fn(loc);
    }

    update(dt: number): void {
        if (!this.following || !this.followTarget) return;
        const t = this.followTarget();
        if (!t) return;
        // 放到地图露出部分的中间：上下左右被界面挡住的宽度不同，中心跟着偏
        const tx = -t[0] * this.zoom + (this.insetLeft - this.insetRight) / 2;
        const ty = -t[1] * this.zoom + (this.insetBottom - this.insetTop) / 2;
        const p = this.pos;
        const k = Math.min(1, dt * FOLLOW_RATE);
        if (Math.abs(tx - p.x) < 0.5 && Math.abs(ty - p.y) < 0.5) return;
        this.moveTo(p.x + (tx - p.x) * k, p.y + (ty - p.y) * k);
    }

    private onWheel(e: EventMouse): void {
        // 滚轮一格换一档（一个美术像素多或少一个物理像素）
        const r = this.ratio();
        this.setZoom((this.pixelScale + (e.getScrollY() > 0 ? 1 : -1)) / r);
    }

    private setZoom(z: number): void {
        // 最小缩放：铺满屏幕不露边，瓦片地图还要一屏格子数不超过缓冲
        const ui = this.node.getComponent(UITransform);
        const vis = view.getVisibleSize();
        const min = minMapZoom({
            visW: vis.width, visH: vis.height, mapW: this.fill ? ui?.width ?? 0 : 0, mapH: this.fill ? ui?.height ?? 0 : 0,
            floor: MIN_SCALE, tile: 16, maxCells: this.maxCells,
        });
        const max = Math.max(min, MAX_SCALE);
        this.rawZoom = clamp(z, min, max);
        const old = this.zoom;
        this.zoom = snapZoom(this.rawZoom, this.ratio(), min, max);
        this.node.setScale(this.zoom, this.zoom, 1);
        // 以屏幕中心为准缩放：中心对着的地图点不变
        this.moveTo(this.pos.x * this.zoom / old, this.pos.y * this.zoom / old);
    }

    /** 把地图节点里的点 (lx, ly) 移到屏幕中间（拖不过去的地方停在边上）。 */
    focus(lx: number, ly: number): void {
        this.following = false;
        this.moveTo(-lx * this.zoom, -ly * this.zoom);
    }

    /** 地图比屏幕大时只能拖到边缘（四边各多让出被界面挡住的那段），比屏幕小时居中。 */
    private moveTo(x: number, y: number): void {
        const ui = this.node.getComponent(UITransform);
        if (!ui) {
            return;
        }
        const vis = view.getVisibleSize();
        const maxX = Math.max(0, (ui.width * this.zoom - vis.width) / 2);
        const maxY = Math.max(0, (ui.height * this.zoom - vis.height) / 2);
        this.pos.set(clamp(x, -maxX - this.insetRight, maxX + this.insetLeft), clamp(y, -maxY - this.insetTop, maxY + this.insetBottom));
        const r = this.ratio();
        const win = screen.windowSize;
        this.node.setPosition(snapOffset(this.pos.x, r, win.width / 2), snapOffset(this.pos.y, r, win.height / 2), 0);
    }
}
