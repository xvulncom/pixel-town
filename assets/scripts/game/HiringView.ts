// 招工处弹层：两种来法。
// - self：人在镇上点了招工告示栏，看到今天来的人，口碑按"当面看"的眼力给，当场签约。
// - assistant：助理跑腿带回的名单，口碑是助理的评价（眼力差的会看走眼），由助理代签。
// 选一个人，定计时还是计件、压价照价还是加价，点「签约」。规则在 core/workers.ts。

import { _decorator, Color, Component, Graphics, Label, Node, UITransform } from 'cc';
import { World } from '../core/defs';
import { GameState, PayMode } from '../core/types';
import { candidatesToday, hire, HireVia, housingCap, rumorOf, wageFor } from '../core/workers';
import { dayKey } from '../core/time';
import { button, Button, drawBox, GOLD, INK, label, MUTED, PAPER, ACCENT, uiNode } from './ui';

const { ccclass } = _decorator;

const BG = new Color(52, 40, 30, 255);
const CARD_H = 112;
const ROLE: Record<string, string> = { farmhand: '帮工', assistant: '助理' };

@ccclass('HiringView')
export class HiringView extends Component {
    world!: World;
    state!: GameState;
    via: HireVia = 'self';
    onChanged: (() => void) | null = null;
    onClose: (() => void) | null = null;

    private w = 0;
    private h = 0;
    private list!: Node;
    private info!: Label;
    private msg!: Label;
    private wageText!: Label;
    private signBtn!: Button;
    private payBtns: Record<PayMode, Button> = {} as Record<PayMode, Button>;
    private offerBtns: Record<string, Button> = {};
    private picked: string | null = null;
    private pay: PayMode = 'day';
    private offer = 'fair';
    private cols = 1;

    start(): void {
        const ui = this.node.getComponent(UITransform)!;
        this.w = ui.width;
        this.h = ui.height;
        const { w, h } = this;
        drawBox(this.node.addComponent(Graphics), w, h, BG, 0);
        this.node.on(Node.EventType.TOUCH_START, () => undefined);

        const title = label(this.node, '', 30, INK, w - 220, 56, 'Title');
        title.horizontalAlign = Label.HorizontalAlign.LEFT;
        title.node.setPosition(-w / 2 + 16 + (w - 220) / 2, h / 2 - 40, 0);
        button(this.node, '离开', 150, 64, () => this.close(), 'Close').node.setPosition(w / 2 - 91, h / 2 - 40, 0);
        if (this.via === 'self') {
            title.string = '招工处 · 当面看人';
        } else {
            const by = this.world.workers[this.state.hireReport?.by ?? '']?.name ?? '助理';
            title.string = `${by}带回的名单 · 他的评价`;
        }
        this.info = label(this.node, '', 24, GOLD, w - 32, 36, 'Info');
        this.info.node.setPosition(0, h / 2 - 92, 0);

        // 底部签约区：两排按钮 + 工钱 + 提示
        const by = -h / 2;
        const row1 = by + 230;
        const row2 = by + 150;
        const bw = Math.min(150, (w - 64) / 4);
        this.payBtns.day = button(this.node, '计时', bw, 60, () => this.setPay('day'), 'PayDay');
        this.payBtns.piece = button(this.node, '计件', bw, 60, () => this.setPay('piece'), 'PayPiece');
        this.payBtns.day.node.setPosition(-w / 2 + 16 + bw / 2, row1, 0);
        this.payBtns.piece.node.setPosition(-w / 2 + 28 + bw * 1.5, row1, 0);
        this.wageText = label(this.node, '', 28, GOLD, w / 2 - 32, 60, 'Wage');
        this.wageText.node.setPosition(w / 4, row1, 0);
        this.world.hiring.offers.forEach((o, i) => {
            const b = button(this.node, o.name, bw, 60, () => this.setOffer(o.id), `Offer-${o.id}`);
            b.node.setPosition(-w / 2 + 16 + bw / 2 + i * (bw + 12), row2, 0);
            this.offerBtns[o.id] = b;
        });
        this.signBtn = button(this.node, '签约', Math.min(200, w - 64 - 3 * (bw + 12)), 60, () => this.sign(), 'Sign');
        this.signBtn.node.setPosition(w / 2 - 16 - 100, row2, 0);
        this.msg = label(this.node, '', 24, INK, w - 32, 70, 'Msg');
        this.msg.node.setPosition(0, by + 60, 0);

        const top = h / 2 - 120;
        const bottom = by + 270;
        this.cols = w >= 1000 ? 2 : 1;
        this.list = uiNode('List', this.node, w, top - bottom);
        this.list.setPosition(0, (top + bottom) / 2, 0);
        this.render();
    }

    private ids(): { id: string; rumor: string }[] {
        const now = Date.now();
        if (this.via === 'self') {
            const day = dayKey(now);
            return candidatesToday(this.state, this.world, now)
                .map((id) => ({ id, rumor: rumorOf(this.state, this.world, id, this.world.hiring.inPersonEye, `self:${day}`) }));
        }
        const rep = this.state.hireReport;
        if (!rep || rep.day !== dayKey(now)) return [];
        return rep.candidates.filter((c) => !this.state.workers.some((w) => w.id === c.id));
    }

    private render(): void {
        const items = this.ids();
        if (this.picked && !items.some((c) => c.id === this.picked)) this.picked = null;
        if (!this.picked && items.length) this.picked = items[0].id;
        this.info.string = `住处 ${this.state.workers.length}/${housingCap(this.state, this.world)} · 金币 ${this.state.gold}`;
        this.list.removeAllChildren();
        const lt = this.list.getComponent(UITransform)!;
        const cw = (this.w - 32 - (this.cols - 1) * 12) / this.cols;
        if (items.length === 0) {
            label(this.list, this.via === 'self' ? '今天的人都招完了，明天再来' : '名单过期了，明天再派助理去', 28, MUTED, this.w - 40, 60);
        }
        items.forEach((c, i) => {
            const def = this.world.workers[c.id];
            const col = i % this.cols;
            const row = Math.floor(i / this.cols);
            const card = uiNode(c.id, this.list, cw, CARD_H);
            card.setPosition(-this.w / 2 + 16 + cw / 2 + col * (cw + 12), lt.height / 2 - CARD_H / 2 - row * (CARD_H + 10), 0);
            drawBox(card.addComponent(Graphics), cw, CARD_H, c.id === this.picked ? ACCENT : PAPER, 12, INK);
            const line = (text: string, y: number, size: number, color: Color) => {
                const l = label(card, text, size, color, cw - 24, size + 8);
                l.horizontalAlign = Label.HorizontalAlign.LEFT;
                l.node.setPosition(0, y, 0);
            };
            line(`${def.name} · ${ROLE[def.role] ?? def.role} · 要日薪 ${def.ask} 金 · ${def.workHours[0]}～${def.workHours[1]} 点`, 34, 26, INK);
            line(`"${def.intro}"`, 0, 22, INK);
            line(c.rumor, -34, 22, GOLD);
            card.on(Node.EventType.TOUCH_END, () => {
                this.picked = c.id;
                this.render();
            });
        });
        this.renderContract();
    }

    private renderContract(): void {
        for (const k of Object.keys(this.payBtns) as PayMode[]) this.payBtns[k].setActive(k === this.pay);
        for (const [k, b] of Object.entries(this.offerBtns)) b.setActive(k === this.offer);
        const def = this.picked ? this.world.workers[this.picked] : null;
        this.signBtn.setEnabled(!!def);
        if (!def) {
            this.wageText.string = '';
            return;
        }
        const rate = this.world.hiring.offers.find((o) => o.id === this.offer)?.rate ?? 1;
        const wage = wageFor(this.world, def, this.pay, rate);
        this.wageText.string = this.pay === 'day' ? `日薪 ${wage} 金` : `每件 ${wage} 金`;
    }

    private setPay(p: PayMode): void {
        this.pay = p;
        this.msg.string = p === 'day'
            ? '计时：每天下工发日薪，活多活少一个价，没人看着容易偷懒'
            : '计件：每干一件当场付钱，不太偷懒，可活太少他挣不够会走';
        this.renderContract();
    }

    private setOffer(id: string): void {
        this.offer = id;
        this.msg.string = id === 'low' ? '压价省钱，可他会更懒，心气高的直接不干'
            : id === 'high' ? '加价多花钱，人更勤快、心情也好' : '照他要的价给';
        this.renderContract();
    }

    private sign(): void {
        if (!this.picked) return;
        const name = this.world.workers[this.picked].name;
        const r = hire(this.state, this.world, this.picked, this.pay, this.offer, Date.now(), this.via);
        if (!r.ok) {
            this.msg.string = r.reason;
            return;
        }
        this.msg.string = `和${name}签好了，到他的上工时间就来干活`;
        this.picked = null;
        this.onChanged?.();
        this.render();
    }

    private close(): void {
        this.onClose?.();
        this.node.destroy();
    }
}
