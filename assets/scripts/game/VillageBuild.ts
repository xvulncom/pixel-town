// 建造栏：底部一排建筑卡片，选中后在地图上点格子摆放；路和菜地点一下铺一格，房子先出虚影再点「放这里」。
// 「拆除」模式下点哪拆哪，退一半钱。没选东西时点菜地种菜、浇水、收获卖钱。每次改动都存档。
// 作物生长按真实时间走：开局先结算离线这段，之后每半分钟推进一次。

import { _decorator, Color, Component, EventTouch, Graphics, Label, Node, Size, Sprite, UITransform, Vec2, view } from 'cc';
import { BuildingDef, World } from '../core/defs';
import { GameState } from '../core/types';
import { plotIndexAt, seedChoices, tend } from '../core/fields';
import { simulate } from '../core/simulate';
import { anchorFromCell, canPlace, place, removeAt, tierUnlocked } from '../core/village';
import { saveGame, SaveStore } from './Store';
import { VillageView } from './VillageView';
import { MapView } from './MapView';
import { ACCENT, button, Button, drawBox, INK, label, MUTED, PAPER, uiNode } from './ui';

const { ccclass } = _decorator;

export const PANEL_H = 330;
const CARD_W = 140;
const CARD_H = 170;
const PER_PAGE = 4;
/** 手指移动不超过这么多算点了一下，超过算拖地图。 */
const TAP_SLOP = 12;
/** 在线时推进作物生长的间隔（秒）。 */
const TICK_S = 30;
const IDLE_HINT = '点菜地种菜，熟了点一下就卖钱';

type Mode = { kind: 'idle' } | { kind: 'place'; def: BuildingDef; x: number; y: number } | { kind: 'remove' };

@ccclass('VillageBuild')
export class VillageBuild extends Component {
    world!: World;
    state!: GameState;
    store!: SaveStore;
    view!: VillageView;
    /** 底部横条的高度，底栏垫高这么多（见 core/screen.ts）。 */
    bottomPad = 0;
    /** 金币、地盘变了之后通知顶栏。 */
    onChange: (() => void) | null = null;

    private mode: Mode = { kind: 'idle' };
    private page = 0;
    private defs: BuildingDef[] = [];
    private cards: Node | null = null;
    private msg!: Label;
    private gold!: Label;
    private removeBtn: Button | null = null;
    private okBtn: Button | null = null;
    private cancelBtn: Button | null = null;
    private seedBtn: Button | null = null;
    /** 点空菜地时种什么，作物 id。 */
    private seed = '';
    private touchStart: Vec2 | null = null;

    start(): void {
        const panel = this.node;
        panel.getComponent(UITransform)!.setContentSize(720, PANEL_H);
        const g = panel.addComponent(Graphics);
        drawBox(g, 720, PANEL_H, new Color(40, 30, 22, 225), 0);
        // 横条那段也铺上底色，按钮留在横条上面
        if (this.bottomPad > 0) {
            g.fillColor = new Color(40, 30, 22, 225);
            g.rect(-360, -PANEL_H / 2 - this.bottomPad, 720, this.bottomPad);
            g.fill();
        }
        // 点在建造栏上的触摸不往下传给地图
        panel.on(Node.EventType.TOUCH_START, (e: EventTouch) => {
            e.propagationStopped = true;
        });
        this.stickBottom();
        view.on('canvas-resize', this.stickBottom, this);

        this.msg = label(panel, '选一样东西，点地面摆放', 26, INK, 480, 44, 'Msg');
        this.msg.node.setPosition(-110, PANEL_H / 2 - 30, 0);
        this.gold = label(panel, '', 28, new Color(255, 214, 102, 255), 200, 44, 'Gold');
        this.gold.node.setPosition(250, PANEL_H / 2 - 30, 0);

        this.cards = uiNode('Cards', panel, 720, CARD_H);
        this.cards.setPosition(0, 20, 0);
        const prev = button(panel, '◀', 50, CARD_H, () => this.turn(-1), 'Prev');
        prev.node.setPosition(-330, 20, 0);
        const next = button(panel, '▶', 50, CARD_H, () => this.turn(1), 'Next');
        next.node.setPosition(330, 20, 0);

        const by = -PANEL_H / 2 + 45;
        this.removeBtn = button(panel, '拆除', 180, 64, () => this.toggleRemove(), 'Remove');
        this.removeBtn.node.setPosition(-230, by, 0);
        this.okBtn = button(panel, '放这里', 200, 64, () => this.confirm(), 'Ok');
        this.okBtn.node.setPosition(0, by, 0);
        this.cancelBtn = button(panel, '取消', 180, 64, () => this.setMode({ kind: 'idle' }), 'Cancel');
        this.cancelBtn.node.setPosition(230, by, 0);
        this.seedBtn = button(panel, '', 260, 64, () => this.nextSeed(), 'Seed');
        this.seedBtn.node.setPosition(60, by, 0);

        // 已解锁的排前面，同档按数据里的顺序
        const all = Object.values(this.world.buildings);
        this.defs = [
            ...all.filter((d) => tierUnlocked(this.state.village.tier, d.tier)),
            ...all.filter((d) => !tierUnlocked(this.state.village.tier, d.tier)),
        ];

        const mapNode = this.view.node;
        mapNode.on(Node.EventType.TOUCH_START, this.onMapStart, this);
        mapNode.on(Node.EventType.TOUCH_END, this.onMapEnd, this);
        const mv = mapNode.getComponent(MapView);
        if (mv) mv.insetBottom = PANEL_H + this.bottomPad;

        this.renderCards();
        this.setMode({ kind: 'idle' });
        this.nextSeed(0);
        this.tick(true);
        this.schedule(() => this.tick(false), TICK_S);
    }

    /** 推进作物生长；开局那次把离线期间熟了多少告诉玩家。 */
    private tick(first: boolean): void {
        const r = simulate(this.state, this.world, Date.now());
        if (first && r.matured > 0) this.say(`离开这段时间熟了 ${r.matured} 块地，点一下就能卖`);
        if (first && r.withered > 0) this.say(`换季了，${r.withered} 块地的苗枯了，点一下清掉`);
        saveGame(this.store, this.state);
        this.view.refresh();
    }

    /** 换下一种种子（d=0 只校正当前选择，比如换季后原来的种不了了）。 */
    private nextSeed(d = 1): void {
        const list = seedChoices(this.state, this.world, Date.now());
        if (list.length === 0) {
            this.seed = '';
            if (this.seedBtn) this.seedBtn.label.string = '这季没种子';
            return;
        }
        const i = list.indexOf(this.seed);
        this.seed = list[i < 0 ? 0 : (i + d) % list.length];
        const c = this.world.crops[this.seed];
        if (this.seedBtn) this.seedBtn.label.string = `种：${c.name} ${c.seedPrice}金`;
        if (d && this.mode.kind === 'idle') this.say(`${c.name}：约 ${c.growHours} 小时熟，卖 ${c.sellPrice} 金`);
    }

    onDestroy(): void {
        view.off('canvas-resize', this.stickBottom, this);
    }

    private stickBottom(): void {
        if (!this.node.isValid) return;
        this.node.setPosition(0, -view.getVisibleSize().height / 2 + this.bottomPad + PANEL_H / 2, 0);
    }

    private turn(d: number): void {
        const pages = Math.ceil(this.defs.length / PER_PAGE);
        this.page = (this.page + d + pages) % pages;
        this.renderCards();
    }

    private renderCards(): void {
        if (!this.cards || !this.view.isReady) return;
        this.cards.removeAllChildren();
        const slice = this.defs.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE);
        slice.forEach((def, i) => {
            const unlocked = tierUnlocked(this.state.village.tier, def.tier);
            const selected = this.mode.kind === 'place' && this.mode.def.id === def.id;
            const card = uiNode(def.id, this.cards!, CARD_W, CARD_H);
            card.setPosition((i - (PER_PAGE - 1) / 2) * (CARD_W + 12), 0, 0);
            drawBox(card.addComponent(Graphics), CARD_W, CARD_H, selected ? ACCENT : PAPER, 12, unlocked ? INK : MUTED);
            this.icon(card, def, unlocked);
            label(card, def.name, 24, unlocked ? INK : MUTED, CARD_W - 8, 30, 'Name').node.setPosition(0, -CARD_H / 2 + 46, 0);
            const sub = unlocked ? `${def.price} 金` : `${this.world.tiers[def.tier].name}解锁`;
            label(card, sub, 22, unlocked ? new Color(255, 214, 102, 255) : MUTED, CARD_W - 8, 28, 'Price')
                .node.setPosition(0, -CARD_H / 2 + 18, 0);
            card.on(Node.EventType.TOUCH_END, () => {
                if (!unlocked) {
                    this.say(`地盘升到${this.world.tiers[def.tier].name}才能盖${def.name}`);
                    return;
                }
                this.select(def);
            });
        });
    }

    /** 卡片上的小图：按比例缩到 96×96 里。 */
    private icon(card: Node, def: BuildingDef, unlocked: boolean): void {
        const n = uiNode('Icon', card);
        const s = n.addComponent(Sprite);
        s.sizeMode = Sprite.SizeMode.CUSTOM;
        let w = 16;
        let h = 16;
        if (def.kind === 'building' && def.sprite) {
            s.spriteFrame = this.view.iconFrame(def.sprite);
            [w, h] = this.view.iconSize(def.sprite);
        } else if (def.terrain) {
            s.spriteFrame = this.view.terrainIcon(def.terrain);
        }
        const k = Math.min(96 / w, 96 / h, 4);
        n.getComponent(UITransform)!.setContentSize(new Size(Math.round(w * k), Math.round(h * k)));
        n.setPosition(0, 26, 0);
        if (!unlocked) s.color = new Color(120, 120, 120, 160);
    }

    private select(def: BuildingDef): void {
        // 虚影先放在屏幕中间那格
        const vis = view.getVisibleSize();
        const center = this.view.cellAt(new Vec2(vis.width / 2, (vis.height + PANEL_H + this.bottomPad) / 2)) ?? [0, 0];
        const [x, y] = anchorFromCell(def, center[0], center[1]);
        this.setMode({ kind: 'place', def, x, y });
        this.say(def.kind === 'ground' ? `点地面铺${def.name}，可以连着点` : `点地面挪位置，再点「放这里」`);
    }

    private toggleRemove(): void {
        this.setMode(this.mode.kind === 'remove' ? { kind: 'idle' } : { kind: 'remove' });
        if (this.mode.kind === 'remove') this.say('点要拆的东西，退一半钱');
    }

    private setMode(m: Mode): void {
        this.mode = m;
        this.removeBtn?.setActive(m.kind === 'remove');
        const placing = m.kind === 'place' && m.def.kind === 'building';
        if (this.okBtn) this.okBtn.node.active = placing;
        if (this.cancelBtn) this.cancelBtn.node.active = m.kind !== 'idle';
        if (this.seedBtn) this.seedBtn.node.active = m.kind === 'idle';
        if (m.kind === 'place') {
            const ok = canPlace(this.world, this.state, m.def.id, m.x, m.y);
            this.okBtn?.setEnabled(ok.ok);
            // 铺路是点一下铺一格，不用虚影
            this.view.showGhost(m.def.kind === 'building' ? m.def.id : null, m.x, m.y, ok.ok);
            if (!ok.ok && m.def.kind === 'building') this.say(ok.reason);
        } else {
            this.view.showGhost(null);
            if (m.kind === 'idle') this.say(IDLE_HINT);
        }
        this.renderCards();
        this.refreshGold();
    }

    private onMapStart(e: EventTouch): void {
        this.touchStart = e.getAllTouches().length === 1 ? e.getUILocation() : null;
    }

    private onMapEnd(e: EventTouch): void {
        const start = this.touchStart;
        this.touchStart = null;
        if (!start || Vec2.distance(start, e.getUILocation()) > TAP_SLOP) return;
        const cell = this.view.cellAt(e.getUILocation());
        if (!cell) return;
        const m = this.mode;
        if (m.kind === 'idle') {
            this.tendAt(cell[0], cell[1]);
        } else if (m.kind === 'remove') {
            const r = removeAt(this.world, this.state, cell[0], cell[1]);
            if (!r.ok) {
                this.say(r.reason);
                return;
            }
            this.say(`拆了${this.world.buildings[r.item.def]?.name ?? ''}，退回 ${r.refund} 金`);
            this.changed();
        } else if (m.kind === 'place') {
            const [x, y] = anchorFromCell(m.def, cell[0], cell[1]);
            if (m.def.kind === 'ground') {
                const r = place(this.world, this.state, m.def.id, x, y);
                if (!r.ok) this.say(r.reason);
                else this.changed();
                this.setMode({ kind: 'place', def: m.def, x, y });
            } else {
                this.setMode({ kind: 'place', def: m.def, x, y });
                if (canPlace(this.world, this.state, m.def.id, x, y).ok) this.say('位置可以，点「放这里」');
            }
        }
    }

    private tendAt(x: number, y: number): void {
        const i = plotIndexAt(this.state, this.world, x, y);
        if (i < 0) {
            this.say(IDLE_HINT);
            return;
        }
        // 先把生长推进到此刻，免得刚熟的点了说没熟
        simulate(this.state, this.world, Date.now());
        const r = tend(this.state, this.world, i, this.seed, Date.now());
        if (!r.ok) {
            this.say(r.reason);
            return;
        }
        this.say(r.message);
        if (r.action === 'wait') return;
        this.changed();
        if (r.gold > 0) this.view.floatText(x, y, `+${r.gold}`);
        else if (r.gold < 0) this.view.floatText(x, y, `${r.gold}`, new Color(240, 140, 120, 255));
    }

    private confirm(): void {
        const m = this.mode;
        if (m.kind !== 'place') return;
        const r = place(this.world, this.state, m.def.id, m.x, m.y);
        if (!r.ok) {
            this.say(r.reason);
            return;
        }
        this.changed();
        this.setMode({ kind: 'idle' });
        this.say(`盖好了${m.def.name}`);
    }

    private changed(): void {
        saveGame(this.store, this.state);
        this.view.refresh();
        this.refreshGold();
        this.onChange?.();
    }

    private refreshGold(): void {
        this.gold.string = `金币 ${this.state.gold}`;
    }

    private say(text: string): void {
        this.msg.string = text;
    }
}
