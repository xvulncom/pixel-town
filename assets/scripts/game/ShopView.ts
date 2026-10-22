// 店里买东西、给镇民送礼的弹层（一个组件两种用法：shopId 给了是开店，npcId 给了是送礼）。
// 规则在 core/shop.ts（货单、买）和 core/npc.ts（送礼涨好感）。
// 一行一件：图标、名字、价钱、已有几件、按钮；放不下就翻页。
// 图标：种子和建造物在建筑图集（VillageView），礼物在室内图集（InteriorAtlas）。

import { _decorator, Color, Component, Graphics, Label, Node, Size, Sprite, SpriteFrame, UITransform } from 'cc';
import { World } from '../core/defs';
import { GameState, ItemId } from '../core/types';
import { buy, describeItem, giftsOwned, GoodsLine, ShopData, shopGoods } from '../core/shop';
import { countOf } from '../core/inventory';
import { giveGift, GiftReaction } from '../core/npc';
import { InteriorAtlas } from './InteriorView';
import { VillageView } from './VillageView';
import { button, drawBox, GOLD, INK, label, MUTED, PAPER, uiNode } from './ui';

const { ccclass } = _decorator;

const BG = new Color(52, 40, 30, 255);
const ROW_H = 96;
const KIND: Record<string, string> = { seed: '种子', build: '回村摆放', gift: '礼物' };
const REACTION: Record<GiftReaction, string> = {
    love: '高兴坏了',
    like: '挺喜欢',
    neutral: '收下了',
    dislike: '不太喜欢',
};

/** 图标从哪取 */
export interface ItemIcons {
    village: VillageView | null;
    interior: InteriorAtlas | null;
}

function iconOf(icons: ItemIcons, line: GoodsLine): { sf: SpriteFrame | null; size: [number, number] } {
    if (line.atlas === 'interior') return { sf: icons.interior?.frame(line.sprite) ?? null, size: icons.interior?.size(line.sprite) ?? [16, 16] };
    return { sf: icons.village?.iconFrame(line.sprite) ?? null, size: icons.village?.iconSize(line.sprite) ?? [16, 16] };
}

@ccclass('ShopView')
export class ShopView extends Component {
    world!: World;
    state!: GameState;
    data!: ShopData;
    icons: ItemIcons = { village: null, interior: null };
    onClose: (() => void) | null = null;
    /** 开店：哪家店、店所在镇子的地域（按它卖当季种子）、掌柜叫什么 */
    shopId = '';
    regionId = '';
    keeperName = '';
    /** 买了东西（金币变了） */
    onGold: (() => void) | null = null;
    /** 送礼：送给谁；送完调 onGiven（存档、说一句）后关掉 */
    npcId = '';
    onGiven: ((text: string) => void) | null = null;

    private w = 0;
    private h = 0;
    private list!: Node;
    private info!: Label;
    private msg!: Label;
    private page = 0;
    private perPage = 1;
    private goods: GoodsLine[] = [];

    private get gifting(): boolean {
        return !this.shopId;
    }

    start(): void {
        const ui = this.node.getComponent(UITransform)!;
        this.w = ui.width;
        this.h = ui.height;
        const { w, h } = this;
        if (!this.gifting) this.goods = shopGoods(this.world, this.data, this.shopId, this.regionId, Date.now());
        drawBox(this.node.addComponent(Graphics), w, h, BG, 0);
        this.node.on(Node.EventType.TOUCH_START, () => undefined);
        const title = this.gifting
            ? `送给${this.world.npcs[this.npcId]?.name ?? '他'}什么？`
            : `${this.data.shops[this.shopId]?.name ?? '小店'}${this.keeperName ? ` · ${this.keeperName}` : ''}`;
        const t = label(this.node, title, 30, INK, w - 220, 56, 'Title');
        t.horizontalAlign = Label.HorizontalAlign.LEFT;
        t.node.setPosition(-w / 2 + 16 + (w - 220) / 2, h / 2 - 40, 0);
        button(this.node, '离开', 150, 64, () => this.close(), 'Close').node.setPosition(w / 2 - 91, h / 2 - 40, 0);
        this.info = label(this.node, '', 24, GOLD, w - 32, 36, 'Info');
        this.info.node.setPosition(0, h / 2 - 92, 0);
        this.msg = label(this.node, this.gifting ? '每人每天收一份礼，挑他喜欢的' : '种子回村种地；建造物放进仓库，回村摆一件不扣钱；礼物送给镇上的熟人',
            24, INK, w - 32, 60, 'Msg');
        this.msg.node.setPosition(0, -h / 2 + 130, 0);
        const navY = -h / 2 + 56;
        const nb = Math.min(200, (w - 64) / 2);
        button(this.node, '上一页', nb, 64, () => this.turn(-1), 'Prev').node.setPosition(-nb / 2 - 8, navY, 0);
        button(this.node, '下一页', nb, 64, () => this.turn(1), 'Next').node.setPosition(nb / 2 + 8, navY, 0);
        const top = h / 2 - 120;
        const bottom = -h / 2 + 170;
        this.perPage = Math.max(1, Math.floor((top - bottom) / (ROW_H + 10)));
        this.list = uiNode('List', this.node, w, top - bottom);
        this.list.setPosition(0, (top + bottom) / 2, 0);
        this.render();
        this.icons.village?.loadIcons(() => this.node.isValid && this.render());
    }

    private lines(): GoodsLine[] {
        if (!this.gifting) return this.goods;
        return giftsOwned(this.state, this.data)
            .map((g) => describeItem(this.world, this.data, g.item))
            .filter((l): l is GoodsLine => l !== null);
    }

    private turn(d: number): void {
        const pages = Math.max(1, Math.ceil(this.lines().length / this.perPage));
        this.page = (this.page + d + pages) % pages;
        this.render();
    }

    private render(): void {
        const all = this.lines();
        const pages = Math.max(1, Math.ceil(all.length / this.perPage));
        this.page = Math.min(this.page, pages - 1);
        const pageText = pages > 1 ? ` · 第 ${this.page + 1}/${pages} 页` : '';
        this.info.string = `${this.gifting ? '背包里的礼物' : `金币 ${this.state.gold}`}${pageText}`;
        this.list.removeAllChildren();
        const lh = this.list.getComponent(UITransform)!.height;
        const rw = this.w - 32;
        all.slice(this.page * this.perPage, (this.page + 1) * this.perPage).forEach((line, i) => {
            const row = uiNode(`Row-${line.item}`, this.list, rw, ROW_H);
            row.setPosition(0, lh / 2 - ROW_H / 2 - i * (ROW_H + 10), 0);
            drawBox(row.addComponent(Graphics), rw, ROW_H, PAPER, 12);
            const ic = uiNode('Icon', row);
            const { sf, size } = iconOf(this.icons, line);
            const s = ic.addComponent(Sprite);
            s.sizeMode = Sprite.SizeMode.CUSTOM;
            s.spriteFrame = sf;
            const k = Math.min(72 / size[0], 72 / size[1], 4);
            ic.getComponent(UITransform)!.setContentSize(new Size(Math.round(size[0] * k), Math.round(size[1] * k)));
            ic.setPosition(-rw / 2 + 50, 0, 0);
            const textW = rw - 100 - 170;
            const name = label(row, line.name, 28, INK, textW, 36, 'Name');
            name.horizontalAlign = Label.HorizontalAlign.LEFT;
            name.node.setPosition(-rw / 2 + 100 + textW / 2, 18, 0);
            const have = countOf(this.state, line.item);
            const sub = label(row, `${KIND[line.kind]} · ${line.price} 金${have ? ` · 已有 ${have}` : ''}`, 22, have ? GOLD : MUTED, textW, 30, 'Sub');
            sub.horizontalAlign = Label.HorizontalAlign.LEFT;
            sub.node.setPosition(-rw / 2 + 100 + textW / 2, -20, 0);
            const b = this.gifting
                ? button(row, '送', 150, 64, () => this.give(line.item), 'Act')
                : button(row, '买', 150, 64, () => this.buy(line), 'Act');
            if (!this.gifting) b.setEnabled(this.state.gold >= line.price);
            b.node.setPosition(rw / 2 - 85, 0, 0);
        });
        if (!all.length) label(this.list, '空空的', 28, MUTED, rw, 60, 'Empty');
    }

    private buy(line: GoodsLine): void {
        const r = buy(this.state, line, 1);
        this.msg.string = r.ok ? `买了${line.name}` : (r as { reason: string }).reason;
        if (r.ok) this.onGold?.();
        this.render();
    }

    private give(item: ItemId): void {
        const npc = this.world.npcs[this.npcId];
        const r = giveGift(this.state, this.world, this.npcId, item, Date.now());
        if (!r.ok) {
            this.msg.string = (r as { reason: string }).reason;
            return;
        }
        const name = describeItem(this.world, this.data, item)?.name ?? '';
        this.onGiven?.(`${npc?.name ?? ''}收到${name}，${REACTION[r.reaction]}（好感 ${r.delta >= 0 ? '+' : ''}${r.delta}）`);
        this.close();
    }

    private close(): void {
        this.node.destroy();
        this.onClose?.();
    }
}
