// 我的工人弹层：每个工人在干什么、心情、今天干了几件、付了多少、欠多少；能调薪、辞退、派助理去招工处。
// 下面是工人动态（只有你看着的时候才会记下谁在偷懒）。常驻模拟每推进一次就刷新一次。

import { _decorator, Color, Component, Graphics, Label, Node, UITransform } from 'cc';
import { World } from '../core/defs';
import { GameState, Worker, WorkerActivity } from '../core/types';
import { fire, housingCap, sendErrand, setOffer } from '../core/workers';
import { dayKey, localParts } from '../core/time';
import { simEvents } from './Sim';
import { button, drawBox, GOLD, INK, label, MUTED, PAPER, uiNode } from './ui';

const { ccclass } = _decorator;

const BG = new Color(40, 46, 38, 255);
const ROW_H = 132;
const DOING: Record<WorkerActivity, string> = {
    off: '下工了', work: '在干活', idle: '没活干，站着', slack: '在偷懒', errand: '去招工处了',
};

function mood(m: number): string {
    return m >= 80 ? '高兴' : m >= 55 ? '还行' : m >= 30 ? '有怨气' : '快不干了';
}

function hhmm(ms: number): string {
    const p = localParts(ms);
    return `${p.hour}:${String(p.minute).padStart(2, '0')}`;
}

@ccclass('WorkersView')
export class WorkersView extends Component {
    world!: World;
    state!: GameState;
    onChanged: (() => void) | null = null;
    onClose: (() => void) | null = null;
    /** 打开助理带回的名单 */
    onReport: (() => void) | null = null;

    private w = 0;
    private h = 0;
    private title!: Label;
    private list!: Node;
    private logText!: Label;
    private msg!: Label;
    private reportBtn!: ReturnType<typeof button>;

    start(): void {
        const ui = this.node.getComponent(UITransform)!;
        this.w = ui.width;
        this.h = ui.height;
        const { w, h } = this;
        drawBox(this.node.addComponent(Graphics), w, h, BG, 0);
        this.node.on(Node.EventType.TOUCH_START, () => undefined);
        this.title = label(this.node, '', 30, INK, w - 220, 56, 'Title');
        this.title.horizontalAlign = Label.HorizontalAlign.LEFT;
        this.title.node.setPosition(-w / 2 + 16 + (w - 220) / 2, h / 2 - 40, 0);
        button(this.node, '关上', 150, 64, () => this.close(), 'Close').node.setPosition(w / 2 - 91, h / 2 - 40, 0);
        this.msg = label(this.node, '', 24, GOLD, w - 32, 40, 'Msg');
        this.msg.node.setPosition(0, h / 2 - 92, 0);

        const logH = Math.min(260, h * 0.3);
        this.reportBtn = button(this.node, '看助理带回的名单', 320, 60, () => this.onReport?.(), 'Report');
        this.reportBtn.node.setPosition(0, -h / 2 + logH + 46, 0);
        this.logText = label(this.node, '', 22, INK, w - 32, logH, 'Log');
        this.logText.horizontalAlign = Label.HorizontalAlign.LEFT;
        this.logText.verticalAlign = Label.VerticalAlign.TOP;
        this.logText.overflow = Label.Overflow.CLAMP;
        this.logText.node.setPosition(0, -h / 2 + logH / 2 + 8, 0);
        const top = h / 2 - 116;
        const bottom = -h / 2 + logH + 84;
        this.list = uiNode('List', this.node, w, top - bottom);
        this.list.setPosition(0, (top + bottom) / 2, 0);
        simEvents.on('tick', this.render, this);
        this.render();
    }

    onDestroy(): void {
        simEvents.off('tick', this.render, this);
    }

    private render(): void {
        if (!this.list?.isValid) return;
        const s = this.state;
        this.title.string = `我的工人 ${s.workers.length}/${housingCap(s, this.world)}`;
        this.list.removeAllChildren();
        const lt = this.list.getComponent(UITransform)!;
        const cols = this.w >= 1000 ? 2 : 1;
        const cw = (this.w - 32 - (cols - 1) * 12) / cols;
        if (s.workers.length === 0) {
            const l = label(this.list, '还没雇人。去镇上广场的招工告示栏招人；\n先雇个助理，以后可以派他替你去。', 26, MUTED, this.w - 40, 120);
            l.node.setPosition(0, lt.height / 2 - 70, 0);
        }
        s.workers.forEach((w, i) => {
            const card = uiNode(w.id, this.list, cw, ROW_H);
            card.setPosition(-this.w / 2 + 16 + cw / 2 + (i % cols) * (cw + 12), lt.height / 2 - ROW_H / 2 - Math.floor(i / cols) * (ROW_H + 10), 0);
            drawBox(card.addComponent(Graphics), cw, ROW_H, PAPER, 12, INK);
            this.row(card, w, cw);
        });
        const today = dayKey(Date.now());
        this.reportBtn.node.active = s.hireReport?.day === today;
        this.logText.string = s.workerLog.slice(-8).reverse().map((e) => `${hhmm(e.t)}  ${e.text}`).join('\n') || '还没有动静';
    }

    private row(card: Node, w: Worker, cw: number): void {
        const def = this.world.workers[w.id];
        const textW = cw - 200;
        const line = (text: string, y: number, size: number, color: Color) => {
            const l = label(card, text, size, color, textW, size + 8);
            l.horizontalAlign = Label.HorizontalAlign.LEFT;
            l.node.setPosition(-cw / 2 + 12 + textW / 2, y, 0);
        };
        const pay = w.pay === 'day' ? `日薪 ${w.wage}` : `每件 ${w.wage}`;
        line(`${def.name} · ${DOING[w.doing]} · 心情${mood(w.morale)}`, 38, 26, INK);
        line(`${pay} 金 · 上工 ${def.workHours[0]}～${def.workHours[1]} 点`, 4, 22, INK);
        const owed = w.owed > 0 ? ` · 欠他 ${w.owed}` : '';
        line(`今天干了 ${w.today.done} 件 · 付了 ${w.today.paid} 金${owed}`, -32, 22, w.owed > 0 ? new Color(240, 140, 120, 255) : GOLD);

        const bx = cw / 2 - 12 - 85;
        const offers = this.world.hiring.offers;
        const next = offers[(offers.findIndex((o) => o.rate === w.rate) + 1) % offers.length];
        const btns: [string, () => void][] = [
            [`改${next.name}`, () => this.act(setOffer(this.state, this.world, w.id, next.id, Date.now()))],
            ['辞退', () => this.act(fire(this.state, this.world, w.id, Date.now()), `辞退了${def.name}`)],
        ];
        if (def.role === 'assistant') {
            btns.unshift(['去招工处', () => this.act(sendErrand(this.state, this.world, w.id, Date.now()))]);
        }
        const bh = (ROW_H - 16 - (btns.length - 1) * 6) / btns.length;
        btns.forEach(([t, fn], i) => {
            const b = button(card, t, 170, bh, fn, t);
            b.label.fontSize = 24;
            b.node.setPosition(bx, ROW_H / 2 - 8 - bh / 2 - i * (bh + 6), 0);
        });
    }

    private act(r: { ok: true } | { ok: false; reason: string }, okText = ''): void {
        this.msg.string = r.ok ? okText || (this.state.workerLog[this.state.workerLog.length - 1]?.text ?? '') : r.reason;
        if (r.ok) this.onChanged?.();
        this.render();
    }

    private close(): void {
        this.onClose?.();
        this.node.destroy();
    }
}
