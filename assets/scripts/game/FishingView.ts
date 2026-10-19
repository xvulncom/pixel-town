// 钓鱼弹层：点一下抛竿 → 等浮漂动 → 咬钩了赶紧点 → 按住屏幕让绿条罩住鱼，进度满了钓上来。
// 一条鱼十来秒，钓完点一下接着抛。规则和溜鱼模拟在 core/fishing.ts，这里只管画和收触摸。
// 弹层大小由 Boot 给（顶栏以下整块），横竖屏都按节点大小排。

import { _decorator, Color, Component, EventTouch, Graphics, Label, Node, Sprite, UITransform } from 'cc';
import { FishDef, World } from '../core/defs';
import { GameState } from '../core/types';
import {
    biteDelayMs, fishDexProgress, fishPool, hookWindowMs, landFish, newReel, Reel, rollFish, stepReel, ZONE,
} from '../core/fishing';
import { weatherOn } from '../core/weather';
import { regionOf } from '../core/region';
import { VillageView } from './VillageView';
import { button, drawBox, GOLD, INK, label, uiNode } from './ui';

const { ccclass } = _decorator;

const BG = new Color(24, 52, 70, 255);
const BAR_BG = new Color(14, 30, 40, 255);
const ZONE_COLOR = new Color(120, 220, 120, 200);
const ZONE_OFF = new Color(220, 200, 120, 200);
const PROGRESS = new Color(255, 214, 102, 255);
/** 钓完之后多久才接受下一次点击，免得按着的手一松就又抛出去 */
const RESULT_GUARD_S = 0.5;

type Phase = 'ready' | 'wait' | 'bite' | 'reel' | 'result';

@ccclass('FishingView')
export class FishingView extends Component {
    world!: World;
    state!: GameState;
    /** 借地盘画面的图集取鱼的图 */
    icons!: VillageView;
    /** 钓上来挣了钱：存档、刷新金币 */
    onGold: (() => void) | null = null;
    onClose: (() => void) | null = null;

    private phase: Phase = 'ready';
    private t = 0;
    private biteAt = 0;
    private biteEnd = 0;
    private resultAt = 0;
    private fish: FishDef | null = null;
    private reel: Reel | null = null;
    private holding = false;

    private title!: Label;
    private status!: Label;
    private hint!: Label;
    private barNode!: Node;
    private bar!: Graphics;
    private fishIcon!: Node;
    private barW = 70;
    private barH = 400;

    start(): void {
        const ui = this.node.getComponent(UITransform)!;
        const w = ui.width;
        const h = ui.height;
        drawBox(this.node.addComponent(Graphics), w, h, BG, 0);
        this.node.on(Node.EventType.TOUCH_START, this.onDown, this);
        this.node.on(Node.EventType.TOUCH_END, this.onUp, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onUp, this);

        const top = h / 2;
        this.title = label(this.node, '', 28, INK, w - 220, 60, 'Title');
        this.title.horizontalAlign = Label.HorizontalAlign.LEFT;
        this.title.node.setPosition(-w / 2 + 16 + (w - 220) / 2, top - 40, 0);
        const close = button(this.node, '收竿', 150, 64, () => this.close(), 'Close');
        close.node.setPosition(w / 2 - 16 - 75, top - 40, 0);
        // 关闭按钮自己处理点击，不当成抛竿
        close.node.on(Node.EventType.TOUCH_START, (e: EventTouch) => {
            e.propagationStopped = true;
        });

        this.status = label(this.node, '', 34, INK, w - 40, 100, 'Status');
        this.status.node.setPosition(0, top - 130, 0);
        this.hint = label(this.node, '', 24, new Color(200, 220, 230, 255), w - 40, 40, 'Hint');
        this.hint.node.setPosition(0, -h / 2 + 30, 0);

        // 溜鱼条放在状态文字和底部提示之间
        const areaTop = top - 190;
        const areaBottom = -h / 2 + 60;
        this.barH = Math.max(200, Math.min(520, areaTop - areaBottom - 20));
        this.barNode = uiNode('Reel', this.node, this.barW + 40, this.barH);
        this.barNode.setPosition(0, (areaTop + areaBottom) / 2, 0);
        this.bar = uiNode('Bar', this.barNode).addComponent(Graphics);
        this.fishIcon = uiNode('Fish', this.barNode, 48, 48);
        const s = this.fishIcon.addComponent(Sprite);
        s.sizeMode = Sprite.SizeMode.CUSTOM;
        this.barNode.active = false;

        this.ready('点一下抛竿');
    }

    private ready(text: string): void {
        this.phase = 'ready';
        this.reel = null;
        this.barNode.active = false;
        this.status.string = text;
        this.hint.string = '鱼按季节、时辰、天气出没，每天第一条卖双倍';
        this.renderTitle();
    }

    private renderTitle(): void {
        const [got, all] = fishDexProgress(this.state, this.world);
        this.title.string = `钓鱼 · 图鉴 ${got}/${all}`;
    }

    private onDown(): void {
        this.holding = true;
        switch (this.phase) {
            case 'ready':
                this.cast();
                break;
            case 'wait':
                this.ready('太早了，鱼吓跑了\n点一下重新抛竿');
                break;
            case 'bite':
                this.hook();
                break;
            case 'result':
                if (this.t - this.resultAt >= RESULT_GUARD_S) this.cast();
                break;
            default:
                break;
        }
    }

    private onUp(): void {
        this.holding = false;
    }

    private cast(): void {
        const now = Date.now();
        const region = regionOf(this.world, this.state);
        const pool = fishPool(this.world, region.id, now, weatherOn(now, region));
        const f = rollFish(pool, Math.random());
        if (!f) {
            this.ready('这会儿水里没动静，晚点再来');
            return;
        }
        this.fish = f;
        this.phase = 'wait';
        this.biteAt = this.t + biteDelayMs(Math.random()) / 1000;
        this.status.string = '浮漂静静漂着……';
        this.hint.string = '浮漂一沉就点';
    }

    private hook(): void {
        if (!this.fish) return;
        this.reel = newReel(this.fish, Math.floor(Math.random() * 1e9));
        this.phase = 'reel';
        this.barNode.active = true;
        const name = `fish_${this.fish.id}`;
        this.fishIcon.getComponent(Sprite)!.spriteFrame = this.icons.iconFrame(name);
        // 鱼图 32×16、蟹 32×32，按比例缩进 72 见方
        const [iw, ih] = this.icons.iconSize(name);
        const k = Math.min(72 / iw, 72 / ih);
        this.fishIcon.getComponent(UITransform)!.setContentSize(iw * k, ih * k);
        this.status.string = '上钩了！';
        this.hint.string = '按住绿条往上，松开往下，罩住鱼';
        this.renderReel();
    }

    update(dt: number): void {
        this.t += dt;
        if (this.phase === 'wait' && this.t >= this.biteAt) {
            this.phase = 'bite';
            this.biteEnd = this.t + hookWindowMs(this.fish!) / 1000;
            this.status.string = '咬钩了！快点！';
        } else if (this.phase === 'bite' && this.t > this.biteEnd) {
            this.ready('没提住，鱼跑了\n点一下重新抛竿');
        } else if (this.phase === 'reel' && this.reel) {
            stepReel(this.reel, this.holding, dt);
            this.renderReel();
            if (this.reel.done) this.finish(this.reel.done === 'caught');
        }
    }

    private finish(caught: boolean): void {
        const f = this.fish!;
        this.phase = 'result';
        this.resultAt = this.t;
        if (!caught) {
            this.status.string = '鱼挣脱跑了……\n点一下再抛';
            this.hint.string = '难的鱼游得快，提前松手';
            return;
        }
        const r = landFish(this.state, this.world, f.id, Date.now());
        const extra = [r.first ? '今天第一条翻倍' : '', r.newSpecies ? '图鉴新收录' : ''].filter(Boolean).join('，');
        this.status.string = `钓到${f.name}！+${r.gold} 金${extra ? `\n${extra}` : ''}`;
        this.status.color = GOLD;
        this.scheduleOnce(() => {
            if (this.status.isValid) this.status.color = INK;
        }, 1.2);
        this.hint.string = '点一下接着抛';
        this.renderTitle();
        this.onGold?.();
    }

    /** 竖条：底色、绿条、鱼；右边细条是进度。 */
    private renderReel(): void {
        const r = this.reel;
        if (!r) return;
        const g = this.bar;
        const { barW, barH } = this;
        const x0 = -barW / 2 - 14;
        const y0 = -barH / 2;
        g.clear();
        drawRect(g, x0, y0, barW, barH, BAR_BG);
        const zh = ZONE * barH;
        const inside = Math.abs(r.fish - r.zone) <= ZONE / 2;
        drawRect(g, x0, y0 + r.zone * barH - zh / 2, barW, zh, inside ? ZONE_COLOR : ZONE_OFF);
        const px = x0 + barW + 12;
        drawRect(g, px, y0, 16, barH, BAR_BG);
        drawRect(g, px, y0, 16, barH * r.progress, PROGRESS);
        this.fishIcon.setPosition(x0 + barW / 2, y0 + r.fish * barH, 0);
    }

    private close(): void {
        this.onClose?.();
        this.node.destroy();
    }
}

function drawRect(g: Graphics, x: number, y: number, w: number, h: number, c: Color): void {
    g.fillColor = c;
    g.rect(x, y, w, h);
    g.fill();
}
