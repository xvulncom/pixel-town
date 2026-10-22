// 建造栏：竖屏在底部一排建筑卡片，横屏在右侧一列（卡片排成网格）；位置大小由 core/screen 的 screenLayout 给。
// 选中卡片后在地图上点格子摆放；路和菜地点一下铺一格，房子先出虚影再点「放这里」。
// 「拆除」模式下点哪拆哪，退一半钱；点到大石头、老树、溪水这些天然地貌是花钱开荒。没选东西时点菜地种菜、浇水、收获卖钱。每次改动都存档。
// 作物生长和工人由常驻模拟（Sim）推进，这里只听它的 'tick' 刷新画面；开局时把离线这段的结果说一句。「巡村」一键把整片地收、浇、种一遍。
// 屏幕转了由 Boot 整个重搭，这里不监听尺寸变化。

import { _decorator, Color, Component, EventTouch, Graphics, Label, Node, Size, Sprite, UITransform, Vec2 } from 'cc';
import { BuildingDef, World } from '../core/defs';
import { GameState } from '../core/types';
import { plotIndexAt, seedChoices, tend } from '../core/fields';
import { OfflineReport, simulate } from '../core/simulate';
import { patrol, patrolSummary } from '../core/patrol';
import { Rect } from '../core/screen';
import { anchorFromCell, canPlace, clearWild, occupancy, place, removeAt, storedCount, tierUnlocked, wildAt } from '../core/village';
import { DoorDef, doorAt, villageDoors } from '../core/interior';
import { saveGame, SaveStore } from './Store';
import { simEvents } from './Sim';
import { VillageView } from './VillageView';
import { MapView } from './MapView';
import { Hero } from './Hero';
import { ACCENT, button, Button, drawBox, GOLD, INK, label, MUTED, PAPER, uiNode } from './ui';

const { ccclass } = _decorator;

/** 竖屏时建造栏的高度 */
export const PANEL_H = 330;
const PANEL_BG = new Color(40, 30, 22, 225);
const IDLE_HINT = '点哪里走到哪里；点菜地走过去种菜，熟了点一下就卖钱';

type Mode = { kind: 'idle' } | { kind: 'place'; def: BuildingDef; x: number; y: number } | { kind: 'remove' };

@ccclass('VillageBuild')
export class VillageBuild extends Component {
    world!: World;
    state!: GameState;
    store!: SaveStore;
    view!: VillageView;
    /** 建造栏和地图露出的区域、整个屏幕的大小（设计像素，原点左上角，见 core/screen.ts） */
    rect: Rect = { x: 0, y: 0, w: 720, h: PANEL_H };
    mapRect: Rect = { x: 0, y: 0, w: 720, h: 950 };
    screenW = 720;
    screenH = 1280;
    /** 竖屏时底部横条的高度，底色往下铺这么多；横屏时为 0 */
    bottomPad = 0;
    /** 横屏：放在右侧一列 */
    side = false;
    /** 金币、地盘变了之后通知顶栏。 */
    onChange: (() => void) | null = null;
    /** 开机时离线那段的结算，第一次打开时说一句，说完清掉 */
    report: { value: OfflineReport | null } = { value: null };

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
    /** 点空菜地时种什么，作物 id；存在存档里，工人也按它种。 */
    private get seed(): string {
        return this.state.farmSeed;
    }

    private set seed(v: string) {
        this.state.farmSeed = v;
    }
    /** 主角；Boot 在地盘画好后挂上 */
    hero: Hero | null = null;
    /** 走到自家房子门口以后（进屋由 Boot 管） */
    onDoor: ((door: DoorDef) => void) | null = null;
    private cardW = 140;
    private cardH = 170;
    private cols = 4;
    private rows = 1;

    start(): void {
        const panel = this.node;
        const { w, h } = this.rect;
        panel.getComponent(UITransform)!.setContentSize(w, h);
        panel.setPosition(this.rect.x + w / 2 - this.screenW / 2, this.screenH / 2 - (this.rect.y + h / 2), 0);
        const g = panel.addComponent(Graphics);
        drawBox(g, w, h, PANEL_BG, 0);
        // 横条那段也铺上底色，按钮留在横条上面
        if (this.bottomPad > 0) {
            g.fillColor = PANEL_BG;
            g.rect(-w / 2, -h / 2 - this.bottomPad, w, this.bottomPad);
            g.fill();
        }
        // 点在建造栏上的触摸不往下传给地图
        panel.on(Node.EventType.TOUCH_START, (e: EventTouch) => {
            e.propagationStopped = true;
        });
        if (this.side) this.layoutSide();
        else this.layoutBottom();

        // 已解锁的排前面，同档按数据里的顺序
        const all = Object.values(this.world.buildings);
        this.defs = [
            ...all.filter((d) => tierUnlocked(this.state.village.tier, d.tier)),
            ...all.filter((d) => !tierUnlocked(this.state.village.tier, d.tier)),
        ];

        this.view.node.getComponent(MapView)?.onTap((loc) => {
            if (this.isValid) this.onTap(loc);
        });

        this.renderCards();
        this.setMode({ kind: 'idle' });
        this.nextSeed(0);
        this.greet();
        simEvents.on('tick', this.onTick, this);
    }

    onDestroy(): void {
        simEvents.off('tick', this.onTick, this);
    }

    /** 面板里的坐标：x、y 从面板左上角量，换成节点里的（原点在中心）。 */
    private at(n: Node, x: number, y: number): void {
        n.setPosition(x - this.rect.w / 2, this.rect.h / 2 - y, 0);
    }

    /** 竖屏：上面一行提示和金币，中间一排卡片两边翻页，下面一排按钮。 */
    private layoutBottom(): void {
        const { w, h } = this.rect;
        const panel = this.node;
        this.cardW = 140;
        this.cardH = 170;
        this.cols = Math.max(1, Math.floor((w - 124 + 12) / (this.cardW + 12)));
        this.rows = 1;
        this.msg = label(panel, '', 26, INK, w - 240, 44, 'Msg');
        this.at(this.msg.node, 16 + (w - 240) / 2, 30);
        this.gold = label(panel, '', 28, GOLD, 200, 44, 'Gold');
        this.at(this.gold.node, w - 116, 30);
        const cy = h / 2 - 20;
        this.cards = uiNode('Cards', panel, w, this.cardH);
        this.at(this.cards, w / 2, cy);
        this.at(button(panel, '◀', 50, this.cardH, () => this.turn(-1), 'Prev').node, 30, cy);
        this.at(button(panel, '▶', 50, this.cardH, () => this.turn(1), 'Next').node, w - 30, cy);
        const by = h - 45;
        this.removeBtn = button(panel, '拆除', 180, 64, () => this.toggleRemove(), 'Remove');
        this.at(this.removeBtn.node, w / 2 - 230, by);
        this.okBtn = button(panel, '放这里', 200, 64, () => this.confirm(), 'Ok');
        this.at(this.okBtn.node, w / 2, by);
        this.cancelBtn = button(panel, '取消', 180, 64, () => this.setMode({ kind: 'idle' }), 'Cancel');
        this.at(this.cancelBtn.node, w / 2 + 230, by);
        this.seedBtn = button(panel, '', 260, 64, () => this.nextSeed(), 'Seed');
        this.at(this.seedBtn.node, w / 2 + 60, by);
    }

    /** 横屏：上面两行提示和金币，中间卡片网格，下面翻页和两排按钮。 */
    private layoutSide(): void {
        const { w, h } = this.rect;
        const panel = this.node;
        const pad = 12;
        const gap = 10;
        this.cardW = 116;
        this.cardH = 150;
        this.msg = label(panel, '', 24, INK, w - 2 * pad, 80, 'Msg');
        this.at(this.msg.node, w / 2, 48);
        this.gold = label(panel, '', 28, GOLD, w - 2 * pad, 36, 'Gold');
        this.at(this.gold.node, w / 2, 106);
        const top = 134;
        const btnH = 64;
        const bottomH = 2 * (btnH + 12) + 8;
        const pagerH = 60;
        this.cols = Math.max(1, Math.floor((w - 2 * pad + gap) / (this.cardW + gap)));
        this.rows = Math.max(1, Math.floor((h - top - pagerH - bottomH - 8 + gap) / (this.cardH + gap)));
        const gridH = this.rows * (this.cardH + gap) - gap;
        this.cards = uiNode('Cards', panel, w, gridH);
        this.at(this.cards, w / 2, top + gridH / 2);
        const py = top + gridH + 8 + pagerH / 2;
        const half = (w - 2 * pad - 12) / 2;
        this.at(button(panel, '◀ 上一页', half, pagerH - 8, () => this.turn(-1), 'Prev').node, pad + half / 2, py);
        this.at(button(panel, '下一页 ▶', half, pagerH - 8, () => this.turn(1), 'Next').node, w - pad - half / 2, py);
        const row2 = h - 8 - btnH / 2;
        const row1 = row2 - btnH - 12;
        this.okBtn = button(panel, '放这里', w - 2 * pad, btnH, () => this.confirm(), 'Ok');
        this.at(this.okBtn.node, w / 2, row1);
        this.seedBtn = button(panel, '', w - 2 * pad, btnH, () => this.nextSeed(), 'Seed');
        this.at(this.seedBtn.node, w / 2, row1);
        this.removeBtn = button(panel, '拆除', half, btnH, () => this.toggleRemove(), 'Remove');
        this.at(this.removeBtn.node, pad + half / 2, row2);
        this.cancelBtn = button(panel, '取消', half, btnH, () => this.setMode({ kind: 'idle' }), 'Cancel');
        this.at(this.cancelBtn.node, w - pad - half / 2, row2);
    }

    /** 巡村：熟了的收、干了的浇、空了的种上当前选的种子，每天第一次巡还有签到钱。 */
    patrolAll(): void {
        const now = Date.now();
        simulate(this.state, this.world, now);
        const r = patrol(this.state, this.world, this.seed, now);
        this.setMode({ kind: 'idle' });
        this.say(patrolSummary(r));
        this.changed();
    }

    /** 开局说一句：空地盘教怎么起步，离开过就说说这段时间地里怎样了。 */
    private greet(): void {
        const r = this.report.value;
        this.report.value = null;
        if (this.state.village.items.length === 0) {
            this.say('一块空地，只有你自己。先铺几格菜地种菜挣钱，盖了民居才能雇人');
        } else if (r && r.withered > 0) {
            this.say(`换季了，${r.withered} 块地的苗枯了，点一下清掉`);
        } else if (r && r.matured > 0) {
            this.say(`离开这段时间熟了 ${r.matured} 块地，点一下就能卖`);
        }
        this.view.refresh();
    }

    /** 常驻模拟推进了一次：重画地里、刷新金币。 */
    private onTick(): void {
        if (!this.node.isValid) return;
        this.view.refresh();
        this.refreshGold();
        this.onChange?.();
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

    private turn(d: number): void {
        const pages = Math.ceil(this.defs.length / this.perPage);
        this.page = (this.page + d + pages) % pages;
        this.renderCards();
    }

    private get perPage(): number {
        return this.cols * this.rows;
    }

    private renderCards(): void {
        if (!this.cards || !this.view.isReady) return;
        this.cards.removeAllChildren();
        const per = this.perPage;
        const { cardW: CW, cardH: CH, cols } = this;
        const gap = this.side ? 10 : 12;
        const rows = Math.ceil(Math.min(per, this.defs.length) / cols);
        const slice = this.defs.slice(this.page * per, (this.page + 1) * per);
        slice.forEach((def, i) => {
            const unlocked = tierUnlocked(this.state.village.tier, def.tier);
            const selected = this.mode.kind === 'place' && this.mode.def.id === def.id;
            const card = uiNode(def.id, this.cards!, CW, CH);
            const col = i % cols;
            const row = Math.floor(i / cols);
            card.setPosition((col - (cols - 1) / 2) * (CW + gap), ((rows - 1) / 2 - row) * (CH + gap), 0);
            drawBox(card.addComponent(Graphics), CW, CH, selected ? ACCENT : PAPER, 12, unlocked ? INK : MUTED);
            this.icon(card, def, unlocked);
            label(card, def.name, 24, unlocked ? INK : MUTED, CW - 8, 30, 'Name').node.setPosition(0, -CH / 2 + 46, 0);
            // 店里买过放在仓库的，摆一件不扣钱
            const stored = storedCount(this.state, def.id);
            const sub = !unlocked ? `${this.world.tiers[def.tier].name}解锁` : stored > 0 ? `仓库 ${stored} 件` : `${def.price} 金`;
            label(card, sub, 22, unlocked ? GOLD : MUTED, CW - 8, 28, 'Price').node.setPosition(0, -CH / 2 + 18, 0);
            card.on(Node.EventType.TOUCH_END, () => {
                if (!unlocked) {
                    this.say(`地盘升到${this.world.tiers[def.tier].name}才能盖${def.name}`);
                    return;
                }
                this.select(def);
            });
        });
    }

    /** 卡片上的小图：按比例缩进卡片上半截（最大 96×96）。 */
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
        const box = Math.min(96, this.cardW - 20, this.cardH - 90);
        const k = Math.min(box / w, box / h, 4);
        n.getComponent(UITransform)!.setContentSize(new Size(Math.round(w * k), Math.round(h * k)));
        n.setPosition(0, this.cardH / 2 - 8 - box / 2, 0);
        if (!unlocked) s.color = new Color(120, 120, 120, 160);
    }

    private select(def: BuildingDef): void {
        // 虚影先放在地图露出部分中间那格（UI 坐标原点在左下角）
        const m = this.mapRect;
        const center = this.view.cellAt(new Vec2(m.x + m.w / 2, this.screenH - (m.y + m.h / 2))) ?? [0, 0];
        const [x, y] = anchorFromCell(def, center[0], center[1]);
        this.setMode({ kind: 'place', def, x, y });
        this.say(def.kind === 'ground' ? `点地面铺${def.name}，可以连着点` : `点地面挪位置，再点「放这里」`);
    }

    private toggleRemove(): void {
        this.setMode(this.mode.kind === 'remove' ? { kind: 'idle' } : { kind: 'remove' });
        if (this.mode.kind === 'remove') this.say('点要拆的东西退一半钱；点石头、老树、竹丛、溪水是花钱开荒');
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

    /** 地图上点了一下（MapView 已经分好点按和拖动）。建造、拆除时直接作用在格子上；平时主角走过去。 */
    private onTap(loc: Vec2): void {
        const m = this.mode;
        if (m.kind === 'idle') {
            this.walkTo(this.view.cellAtAny(loc));
            return;
        }
        const cell = this.view.cellAt(loc);
        if (!cell) return;
        if (m.kind === 'remove') {
            // 空地上的天然地貌：花钱开荒（溪水上架了桥的先拆桥）
            const [cx, cy] = cell;
            const o = occupancy(this.world, this.state.village);
            const i = cy * o.w + cx;
            if (!o.objects[i] && !o.ground[i] && wildAt(this.world, this.state.village, cx, cy)) {
                const c = clearWild(this.world, this.state, cx, cy);
                this.say(c.ok ? `${c.wild.name}清掉了，花了 ${c.wild.price} 金，这块地能盖东西了` : c.reason);
                if (c.ok) this.changed();
                return;
            }
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

    /** 地盘上有门的房子（配了室内或标了进不去的建筑），图多高按建筑图集量 */
    doors(): DoorDef[] {
        return villageDoors(this.world.buildings, this.state.village.items,
            (def) => (def.sprite ? Math.ceil(this.view.iconSize(def.sprite)[1] / 16) : def.foot[1]));
    }

    /** 平时点地面：点到房子走到门口进屋；点到菜地就走到旁边再种、浇、收；别处就走过去。主角还没出来时直接种。 */
    private walkTo([x, y]: [number, number]): void {
        const field = plotIndexAt(this.state, this.world, x, y) >= 0;
        const hero = this.hero;
        const door = field ? null : doorAt(this.doors(), x, y);
        if (door) {
            const [fx, fy] = door.front;
            const enter = (ok: boolean) => (ok ? this.onDoor?.(door) : this.say('走不到门口，先铺条路过去'));
            if (!hero?.walkTo({ x: fx, y: fy, w: 1, h: 1 }, 'onto', enter)) this.onDoor?.(door);
            return;
        }
        if (!hero?.ready) {
            if (field) this.tendAt(x, y);
            return;
        }
        if (!field) {
            hero.walkTo({ x, y, w: 1, h: 1 }, 'onto');
            return;
        }
        const ok = hero.walkTo({ x, y, w: 1, h: 1 }, 'beside', (reached) => {
            if (!this.isValid) return;
            if (reached) this.tendAt(x, y);
            else this.say('走不到那块菜地，先铺条路过去');
        });
        if (!ok) this.tendAt(x, y);
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

    /** 存档、重画、通知顶栏；钓鱼摆摊挣了钱之后也调这个。 */
    changed(): void {
        saveGame(this.store, this.state);
        this.view.refresh();
        this.refreshGold();
        this.onChange?.();
    }

    private refreshGold(): void {
        this.gold.string = `金币 ${this.state.gold}`;
    }

    say(text: string): void {
        this.msg.string = text;
    }
}
