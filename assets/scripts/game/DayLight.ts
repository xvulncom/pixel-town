// 晨昏光照：整屏盖一层颜色，颜色由 core/lighting 按北京时间算，每 30 秒更新一次。

import { _decorator, Color, Component, Graphics, view } from 'cc';
import { tintAt } from '../core/lighting';
import { localParts } from '../core/time';

const { ccclass } = _decorator;

@ccclass('DayLight')
export class DayLight extends Component {
    /** 调试用：设了就固定在这个小时，不跟现实时间走 */
    fixedHour: number | null = null;
    private elapsed = 30;

    update(dt: number): void {
        this.elapsed += dt;
        if (this.elapsed < 30) return;
        this.elapsed = 0;
        this.redraw();
    }

    redraw(): void {
        const g = this.getComponent(Graphics);
        if (!g) return;
        const p = localParts(Date.now());
        const tint = tintAt(this.fixedHour ?? p.hour + p.minute / 60);
        const vis = view.getVisibleSize();
        g.clear();
        if (tint.a <= 0) return;
        g.fillColor = new Color(tint.r, tint.g, tint.b, Math.round(tint.a * 255));
        g.rect(-vis.width / 2, -vis.height / 2, vis.width, vis.height);
        g.fill();
    }
}
