// 地图视图：单指拖动、双指缩放（开发者工具里用滚轮缩放），不让地图拖出屏幕。
// 触摸挂在地图节点上：点在顶栏、建造栏这些界面上时不会拖动地图。

import { _decorator, Component, EventMouse, EventTouch, Node, UITransform, Vec2, view } from 'cc';

const { ccclass } = _decorator;

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const DEFAULT_SCALE = 3;

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
    private zoom = DEFAULT_SCALE;
    private pinchDist = 0;

    onEnable(): void {
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        this.node.on(Node.EventType.MOUSE_WHEEL, this.onWheel, this);
    }

    onDisable(): void {
        this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        this.node.off(Node.EventType.MOUSE_WHEEL, this.onWheel, this);
    }

    start(): void {
        this.setZoom(DEFAULT_SCALE);
    }

    /** 地图内容大小变了（比如地盘升档）之后调用，重新算缩放和边界。 */
    relayout(): void {
        this.setZoom(this.zoom);
    }

    private onTouchMove(e: EventTouch): void {
        const touches = e.getAllTouches();
        if (touches.length >= 2) {
            const d = Vec2.distance(touches[0].getUILocation(), touches[1].getUILocation());
            if (this.pinchDist > 0) {
                this.setZoom(this.zoom * (d / this.pinchDist));
            }
            this.pinchDist = d;
            return;
        }
        this.pinchDist = 0;
        const delta = e.getUIDelta();
        const p = this.node.position;
        this.moveTo(p.x + delta.x, p.y + delta.y);
    }

    private onTouchEnd(): void {
        this.pinchDist = 0;
    }

    private onWheel(e: EventMouse): void {
        this.setZoom(this.zoom * (e.getScrollY() > 0 ? 1.1 : 1 / 1.1));
    }

    private setZoom(z: number): void {
        // 最小缩放至少要铺满屏幕，长屏手机上不露边
        const ui = this.node.getComponent(UITransform);
        const vis = view.getVisibleSize();
        const cover = ui && ui.width > 0 ? Math.max(vis.width / ui.width, vis.height / ui.height) : MIN_SCALE;
        this.zoom = clamp(z, Math.max(MIN_SCALE, cover), MAX_SCALE);
        this.node.setScale(this.zoom, this.zoom, 1);
        this.moveTo(this.node.position.x, this.node.position.y);
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
        this.node.setPosition(clamp(x, -maxX - this.insetRight, maxX + this.insetLeft), clamp(y, -maxY - this.insetTop, maxY + this.insetBottom), 0);
    }
}
