// 店里买东西：镇上各店的掌柜卖三类货，都接现有玩法——
// 种子（seed:<作物>）进背包，回村种地；建造物（build:<建筑>）进仓库，回村摆一件不再扣钱；
// 礼物（gift:<礼物>）进背包，点有人设的镇民时可以送，按他的喜好涨好感（core/npc 的 giveGift）。
// 货单在 data/shops.ts，礼物在 data/gifts.ts，加货加一行。不依赖引擎。

import { World } from './defs';
import { GameState, ItemId, Result } from './types';
import { addItem, countOf } from './inventory';
import { inSeason, sellsSeed } from './region';
import { seasonAt } from './calendar';

export interface GiftDef {
    id: string;
    name: string;
    price: number;
    /** 室内图集（interior.png）里的图名，商店和送礼界面画图标用 */
    sprite: string;
}

export interface ShopDef {
    id: string;
    name: string;
    /** 卖不卖本地种子：按店所在镇子的地域、当季 */
    seeds?: boolean;
    /** 其余的货：build:<建筑 id>、gift:<礼物 id>，price 不填用建筑价、礼物价 */
    goods: { item: ItemId; price?: number }[];
}

export interface ShopData {
    shops: Record<string, ShopDef>;
    gifts: Record<string, GiftDef>;
}

export type GoodsKind = 'seed' | 'build' | 'gift';

export interface GoodsLine {
    item: ItemId;
    kind: GoodsKind;
    name: string;
    price: number;
    /** 图标：atlas 是哪张图集，sprite 是图名（种子用作物成熟图） */
    atlas: 'buildings' | 'interior';
    sprite: string;
}

export const buildItem = (id: string): ItemId => `build:${id}`;
export const giftItem = (id: string): ItemId => `gift:${id}`;

/** 物品是哪一类、名字、图标；认不出来的返回 null。 */
export function describeItem(world: World, data: ShopData, item: ItemId): GoodsLine | null {
    const [kind, id] = item.split(':');
    if (kind === 'seed' && world.crops[id]) {
        const c = world.crops[id];
        return { item, kind, name: `${c.name}种子`, price: c.seedPrice, atlas: 'buildings', sprite: `crop_${id}` };
    }
    if (kind === 'build' && world.buildings[id]) {
        const b = world.buildings[id];
        return { item, kind, name: b.name, price: b.price, atlas: 'buildings', sprite: b.sprite ?? '' };
    }
    if (kind === 'gift' && data.gifts[id]) {
        const g = data.gifts[id];
        return { item, kind, name: g.name, price: g.price, atlas: 'interior', sprite: g.sprite };
    }
    return null;
}

/** 这家店今天卖什么。regionId 是店所在镇子的地域（种子按它卖、按它的季节）。 */
export function shopGoods(world: World, data: ShopData, shopId: string, regionId: string, nowMs: number): GoodsLine[] {
    const shop = data.shops[shopId];
    if (!shop) return [];
    const lines: GoodsLine[] = [];
    const region = world.regions[regionId];
    if (shop.seeds && region) {
        const season = seasonAt(nowMs);
        const crops = Object.values(world.crops)
            .filter((c) => sellsSeed(region, c.id) && inSeason(world, region, c.id, season))
            .sort((a, b) => a.seedPrice - b.seedPrice);
        for (const c of crops) lines.push(describeItem(world, data, `seed:${c.id}`)!);
    }
    for (const g of shop.goods) {
        const d = describeItem(world, data, g.item);
        if (d) lines.push({ ...d, price: g.price ?? d.price });
    }
    return lines;
}

/** 买 n 件：钱不够不买。 */
export function buy(state: GameState, line: GoodsLine, n = 1): Result {
    const cost = line.price * n;
    if (state.gold < cost) return { ok: false, reason: '金币不够' };
    state.gold -= cost;
    addItem(state, line.item, n);
    return { ok: true };
}

/** 背包里的礼物，按名字排（送礼界面用） */
export function giftsOwned(state: GameState, data: ShopData): { item: ItemId; gift: GiftDef; n: number }[] {
    return Object.values(data.gifts)
        .map((gift) => ({ item: giftItem(gift.id), gift, n: countOf(state, giftItem(gift.id)) }))
        .filter((g) => g.n > 0);
}
