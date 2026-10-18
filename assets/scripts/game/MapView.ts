// 地图视图：单指拖动、双指缩放（开发者工具里用滚轮缩放），不让地图拖出屏幕。

import { _decorator, Component, EventMouse, EventTouch, Input, input, UITransform, Vec2, view } from 'cc';

const { ccclass } = _decorator;

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const DEFAULT_SCALE = 3;

function clamp(v: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, v));
}

@ccclass('MapView')
export class MapView extends Component {
    private zoom = DEFAULT_SCALE;
    private pinchDist = 0;

    onEnable(): void {
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        input.on(Input.EventType.MOUSE_WHEEL, this.onWheel, this);
    }

    onDisable(): void {
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        input.off(Input.EventType.MOUSE_WHEEL, this.onWheel, this);
    }

    start(): void {
        this.setZoom(DEFAULT_SCALE);
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
        const cover = ui ? Math.max(vis.width / ui.width, vis.height / ui.height) : MIN_SCALE;
        this.zoom = clamp(z, Math.max(MIN_SCALE, cover), MAX_SCALE);
        this.node.setScale(this.zoom, this.zoom, 1);
        this.moveTo(this.node.position.x, this.node.position.y);
    }

    /** 地图比屏幕大时只能拖到边缘，比屏幕小时居中。 */
    private moveTo(x: number, y: number): void {
        const ui = this.node.getComponent(UITransform);
        if (!ui) {
            return;
        }
        const vis = view.getVisibleSize();
        const maxX = Math.max(0, (ui.width * this.zoom - vis.width) / 2);
        const maxY = Math.max(0, (ui.height * this.zoom - vis.height) / 2);
        this.node.setPosition(clamp(x, -maxX, maxX), clamp(y, -maxY, maxY), 0);
    }
}
