// 摆摊弹层：一轮一分钟，顾客一个个来要摊上的某样货，点对就卖掉，连着点对有加成，等太久顾客就走。
// 每卖一单金币当场到账，一天能摆几轮看 data/market.ts。规则在 core/market.ts，这里只管画和收点击。
// 弹层大小由 Boot 给（顶栏以下整块），横竖屏都按节点大小排：宽屏货摆一排，窄屏摆两排。

import { _decorator, Color, Component, Graphics, Label, Node, Size, Sprite, UITransform } from 'cc';
import { World } from '../core/defs';
import { GameState, ItemId } from '../core/types';
import {
    advanceMarket, itemName, MarketRound, newMarket, openMarket, patienceOf, roundsLeft, serve, wantOf,
} from '../core/market';
import { weatherOn } from '../core/weather';
import { regionOf } from '../core/region';
import { VillageView } from './VillageView';
import { button, Button, drawBox, GOLD, INK, label, PAPER, uiNode } from './ui';

const { ccclass } = _decorator;

const BG = new Color(70, 46, 30, 255);
const BAR_BG = new Color(40, 26, 18, 255);
const PATIENCE = new Color(120, 220, 120, 255);
const PATIENCE_LOW = new Color(240, 110, 90, 255);
const BAD = new Color(240, 140, 120, 255);

@ccclass('MarketView')
export class MarketView extends Component {
    world!: World;
    state!: GameState;
    /** 借地盘画面的图集取菜和鱼的图 */
    icons!: VillageView;
    onGold: (() => void) | null = null;
    onClose: (() => void) | null = null;

    private round: MarketRound | null = null;
    private w = 0;
    private h = 0;
    private title!: Label;
    private info!: Label;
    private ask!: Label;
    private want!: Sprite;
    private wantNode!: Node;
    private patience!: Graphics;
    private feedback!: Label;
    private goods!: Node;
    private startBtn!: Button;
    private cols = 4;
    private rows = 1;
    /** 内容区顶部（节点坐标），整块内容在弹层里竖着居中 */
    private top = 0;

    start(): void {
        const ui = this.node.getComponent(UITransform)!;
        this.w = ui.width;
        this.h = ui.height;
        const { w, h } = this;
        drawBox(this.node.addComponent(Graphics), w, h, BG, 0);
        // 点在弹层上不拖地图
        this.node.on(Node.EventType.TOUCH_START, () => undefined);

        this.title = label(this.node, '', 28, INK, w - 220, 60, 'Title');
        this.title.horizontalAlign = Label.HorizontalAlign.LEFT;
        this.title.node.setPosition(-w / 2 + 16 + (w - 220) / 2, h / 2 - 40, 0);
        button(this.node, '收摊', 150, 64, () => this.close(), 'Close').node.setPosition(w / 2 - 16 - 75, h / 2 - 40, 0);

        // 货的排法：宽屏一排四样，窄屏两排
        const n = this.world.market.goods;
        const cols = w >= n * 180 + 32 ? n : Math.ceil(n / 2);
        const rows = Math.ceil(n / cols);
        const gh = rows * 152 - 12;
        const contentH = 50 + 170 + 40 + gh;
        // 标题栏以下到底边之间竖着居中，放不下就贴着标题栏
        this.top = Math.min(h / 2 - 80, (h / 2 - 80 + (-h / 2 + 16)) / 2 + contentH / 2);
        const y = this.top;

        this.info = label(this.node, '', 26, GOLD, w - 40, 44, 'Info');
        this.info.node.setPosition(0, y - 22, 0);
        this.ask = label(this.node, '', 30, INK, w - 40, 50, 'Ask');
        this.ask.node.setPosition(0, y - 80, 0);
        this.wantNode = uiNode('Want', this.node, 160, 96);
        this.wantNode.setPosition(0, y - 160, 0);
        this.want = this.wantNode.addComponent(Sprite);
        this.want.sizeMode = Sprite.SizeMode.CUSTOM;
        const pn = uiNode('Patience', this.node);
        pn.setPosition(0, y - 228, 0);
        this.patience = pn.addComponent(Graphics);
        this.feedback = label(this.node, '', 30, GOLD, 300, 44, 'Feedback');
        this.feedback.node.setPosition(Math.min(w / 2 - 160, 240), y - 150, 0);
        this.goods = uiNode('Goods', this.node, w, gh);
        this.goods.setPosition(0, y - 260 - gh / 2, 0);
        this.cols = cols;
        this.rows = rows;

        this.startBtn = button(this.node, '开张', 260, 90, () => this.begin(), 'Start');
        this.startBtn.node.setPosition(0, y - 260 - gh / 2, 0);
        this.idle('一分钟里顾客一个个来，点他要的货\n连着点对有加成，等太久顾客就走');
    }

    private idle(text: string): void {
        this.round = null;
        this.goods.removeAllChildren();
        this.goods.active = false;
        this.wantNode.active = false;
        this.patience.clear();
        this.startBtn.node.active = true;
        this.ask.string = text;
        this.info.string = '';
        this.feedback.string = '';
        this.renderTitle();
    }

    private renderTitle(): void {
        const left = roundsLeft(this.state, this.world, Date.now());
        this.title.string = left > 0 ? `摆摊 · 今天还能摆 ${left} 轮` : '摆摊 · 今天集市散了';
        this.startBtn.setEnabled(left > 0);
    }

    private begin(): void {
        const now = Date.now();
        if (roundsLeft(this.state, this.world, now) <= 0) {
            this.idle('今天集市散了，明天再来');
            return;
        }
        const region = regionOf(this.world, this.state);
        this.round = newMarket(this.state, this.world, now, weatherOn(now, region), Math.floor(Math.random() * 1e9));
        if (this.round.goods.length === 0) {
            this.idle('今天没什么货可卖');
            return;
        }
        openMarket(this.state, now);
        this.renderTitle();
        this.startBtn.node.active = false;
        this.goods.active = true;
        this.wantNode.active = true;
        this.renderGoods();
        this.render();
    }

    private renderGoods(): void {
        const r = this.round!;
        const { cols, rows } = this;
        const bw = Math.min(200, (this.w - 32 - (cols - 1) * 12) / cols);
        const bh = 140;
        this.goods.removeAllChildren();
        r.goods.forEach((item, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const n = uiNode(item, this.goods, bw, bh);
            n.setPosition((col - (cols - 1) / 2) * (bw + 12), ((rows - 1) / 2 - row) * (bh + 12), 0);
            drawBox(n.addComponent(Graphics), bw, bh, PAPER, 12, INK);
            const icon = this.icon(n, item, Math.min(bw - 30, 120), 76);
            icon.setPosition(0, 18, 0);
            label(n, itemName(this.world, item), 24, INK, bw - 8, 30, 'Name').node.setPosition(0, -bh / 2 + 22, 0);
            n.on(Node.EventType.TOUCH_END, () => this.pick(item));
        });
    }

    /** 物品的小图，按比例缩进 boxW×boxH。 */
    private icon(parent: Node, item: ItemId, boxW: number, boxH: number): Node {
        const [kind, id] = item.split(':');
        const name = `${kind}_${id}`;
        const n = uiNode('Icon', parent);
        const s = n.addComponent(Sprite);
        s.sizeMode = Sprite.SizeMode.CUSTOM;
        s.spriteFrame = this.icons.iconFrame(name);
        const [iw, ih] = this.icons.iconSize(name);
        const k = Math.min(boxW / iw, boxH / ih);
        n.getComponent(UITransform)!.setContentSize(new Size(Math.round(iw * k), Math.round(ih * k)));
        return n;
    }

    private pick(item: ItemId): void {
        const r = this.round;
        if (!r || r.over) return;
        const got = serve(this.state, this.world, r, item, r.t);
        if (got > 0) this.onGold?.();
        this.feedback.string = got > 0 ? `+${got}` : '不对，顾客走了';
        this.feedback.color = got > 0 ? GOLD : BAD;
        this.unschedule(this.clearFeedback);
        this.scheduleOnce(this.clearFeedback, 0.8);
        this.render();
    }

    private clearFeedback(): void {
        if (this.feedback.isValid) this.feedback.string = '';
    }

    update(dt: number): void {
        const r = this.round;
        if (!r) return;
        advanceMarket(this.world, r, r.t + dt);
        if (r.over) {
            this.finish();
            return;
        }
        this.render();
    }

    private render(): void {
        const r = this.round;
        if (!r) return;
        const left = Math.max(0, Math.ceil(this.world.market.roundSec - r.t));
        this.info.string = `剩 ${left} 秒 · 挣 ${r.earned} 金 · 连对 ${r.streak}`;
        const want = wantOf(r);
        this.ask.string = `第 ${r.idx + 1} 位顾客想要：${itemName(this.world, want)}`;
        const [kind, id] = want.split(':');
        const name = `${kind}_${id}`;
        this.want.spriteFrame = this.icons.iconFrame(name);
        const [iw, ih] = this.icons.iconSize(name);
        const k = Math.min(160 / iw, 96 / ih);
        this.wantNode.getComponent(UITransform)!.setContentSize(new Size(Math.round(iw * k), Math.round(ih * k)));
        // 耐心条：这位顾客还能等多久
        const p = Math.max(0, 1 - (r.t - r.arrivedAt) / patienceOf(this.world, r));
        const bw = Math.min(400, this.w - 80);
        const g = this.patience;
        g.clear();
        g.fillColor = BAR_BG;
        g.rect(-bw / 2, -8, bw, 16);
        g.fill();
        g.fillColor = p > 0.3 ? PATIENCE : PATIENCE_LOW;
        g.rect(-bw / 2, -8, bw * p, 16);
        g.fill();
    }

    private finish(): void {
        const r = this.round!;
        this.idle(`收摊：卖出 ${r.served} 单，错过 ${r.missed} 位，挣了 ${r.earned} 金`);
        this.startBtn.label.string = '再来一轮';
    }

    private close(): void {
        this.onClose?.();
        this.node.destroy();
    }
}
