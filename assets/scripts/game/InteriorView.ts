// 屋里的画面：按 core/interior 排好的屋子铺地面、墙，摆家具和掌柜，主角在里面走。
// 图块和家具都在 interior.png（tools/gen-interiors.ts 生成），掌柜用 people.png 对应的行朝下站。
// 屋子比屏幕小时居中，四周黑底（MapView.fill = false）。点掌柜或柜台走到柜台前搭话，走到出口就出门。
// 只负责画和点按，进出门、存档由 Boot 管。

import {
    _decorator, Color, Component, Graphics, ImageAsset, JsonAsset, Node, Rect, resources, Size, Sprite, SpriteFrame,
    Texture2D, UITransform, Vec2, Vec3, view,
} from 'cc';
import { Cell } from '../core/path';
import { interiorGrid, interiorTile, InteriorLayout, InteriorRecipe, InteriorWorld } from '../core/interior';
import { Hero, sortIntoSiblings } from './Hero';
import { MapView } from './MapView';
import { INK, label, uiNode } from './ui';

const { ccclass } = _decorator;
const TILE = 16;

type Frames = Record<string, [number, number, number, number]>;

interface PeopleInfo {
    frameW: number;
    frameH: number;
    dirs: string[];
    frames: number;
    rows: string[];
}

/** 屋里图集：加载一次，商店、送礼界面的礼物图标也从这里取 */
export class InteriorAtlas {
    private constructor(private tex: Texture2D, private frames: Frames) {}
    private cache = new Map<string, SpriteFrame>();

    static load(done: (a: InteriorAtlas | null) => void): void {
        resources.load('maps/interior-frames', JsonAsset, (e1, j) => {
            resources.load('maps/interior', ImageAsset, (e2, img) => {
                if (e1 || e2 || !j || !img) {
                    console.error('室内图集加载失败', e1 ?? e2);
                    done(null);
                    return;
                }
                const tex = new Texture2D();
                tex.image = img;
                tex.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
                done(new InteriorAtlas(tex, j.json as Frames));
            });
        });
    }

    frame(name: string): SpriteFrame | null {
        const f = this.frames[name];
        if (!f) return null;
        let sf = this.cache.get(name);
        if (!sf) {
            sf = new SpriteFrame();
            sf.texture = this.tex;
            sf.rect = new Rect(f[0], f[1], f[2], f[3]);
            this.cache.set(name, sf);
        }
        return sf;
    }

    size(name: string): [number, number] {
        const f = this.frames[name];
        return f ? [f[2], f[3]] : [TILE, TILE];
    }
}

@ccclass('InteriorView')
export class InteriorView extends Component {
    world!: InteriorWorld;
    recipe!: InteriorRecipe;
    layout!: InteriorLayout;
    atlas!: InteriorAtlas;
    /** 进门站在哪 */
    spawn: Cell = [0, 0];
    /** 地图视图的边距（被顶栏挡住的部分） */
    insetTop = 0;
    insetBottom = 0;
    /** 走到柜台前（或点了掌柜）以后 */
    onKeeper: (() => void) | null = null;
    /** 走到出口 */
    onExit: (() => void) | null = null;
    /** 走完一段停下来（Boot 记位置） */
    onStopped: ((cell: Cell) => void) | null = null;

    private map: Node | null = null;
    private objects: Node | null = null;
    private hero: Hero | null = null;
    private leaving = false;

    start(): void {
        resources.load('maps/people-frames', JsonAsset, (e1, j) => {
            resources.load('maps/people', ImageAsset, (e2, img) => {
                if (!this.node.isValid) return;
                this.build(e1 || e2 || !j || !img ? null : { info: j.json as PeopleInfo, img });
            });
        });
    }

    private build(people: { info: PeopleInfo; img: ImageAsset } | null): void {
        const { layout, recipe, atlas } = this;
        const W = layout.w * TILE;
        const H = layout.h * TILE;
        // 黑底：屋子外面什么都没有
        const vis = view.getVisibleSize();
        const bg = uiNode('Dark', this.node, vis.width, vis.height);
        const g = bg.addComponent(Graphics);
        g.fillColor = new Color(14, 10, 8, 255);
        g.rect(-vis.width, -vis.height, vis.width * 2, vis.height * 2);
        g.fill();

        const map = uiNode('Room', this.node, W, H);
        this.map = map;
        const ground = uiNode('ground', map);
        for (let y = 0; y < layout.h; y++) {
            for (let x = 0; x < layout.w; x++) this.sprite(ground, interiorTile(recipe, layout, x, y), x * TILE, (y + 1) * TILE, 'tl');
        }
        // 地毯、挂件在家具下面
        const flat = uiNode('flat', map);
        const objects = uiNode('objects', map);
        this.objects = objects;
        const stand: Node[] = [];
        for (const it of layout.items) {
            const def = this.world.furniture[it.f];
            if (!def) continue;
            const cx = (it.x + def.foot[0] / 2) * TILE;
            if (def.spot === 'rug') this.sprite(flat, def.id, it.x * TILE, (it.y + def.art[1]) * TILE, 'tl');
            else if (def.spot === 'hang') this.sprite(flat, def.id, cx, (it.y + def.art[1]) * TILE, 'bc');
            else stand.push(this.sprite(objects, def.id, cx, (it.y + def.foot[1]) * TILE, 'bc'));
        }
        const keeper = recipe.keeper;
        if (keeper && layout.keeper && people) {
            const n = this.person(objects, people.info, people.img, keeper.look);
            if (n) {
                const [lx, ly] = this.footAt(layout.keeper[0], layout.keeper[1]);
                n.setPosition(lx, ly, 0);
                stand.push(n);
                // 大字缩小，放大看也清楚
                const tag = label(n, keeper.name, 40, INK, 240, 56, 'Name');
                tag.node.setScale(0.25, 0.25, 1);
                tag.node.setPosition(0, people.info.frameH + 6, 0);
            }
        }
        // 脚越靠下越后画
        stand.sort((a, b) => b.position.y - a.position.y).forEach((n, i) => n.setSiblingIndex(i));

        const mv = map.addComponent(MapView);
        mv.fill = false;
        mv.insetTop = this.insetTop;
        mv.insetBottom = this.insetBottom;
        // 一开始让整间屋子尽量放得下，像素整数倍由 MapView 取
        const fit = Math.min((vis.width - 32) / W, (vis.height - this.insetTop - this.insetBottom - 32) / H);
        mv.startZoom = Math.max(2, Math.min(4, fit));
        mv.onTap((loc) => this.onTap(loc));

        const grid = interiorGrid(this.world, layout);
        const hero = map.addComponent(Hero);
        Object.assign(hero, {
            grid: () => grid, toLocal: (x: number, y: number) => this.footAt(x, y), layer: objects, mapView: mv,
            spawn: this.spawn, spawnDir: 'up',
            onMoved: (n: Node) => sortIntoSiblings(n),
            onStopped: (c: Cell) => {
                this.onStopped?.(c);
                if (c[0] === layout.exit[0] && c[1] === layout.exit[1]) this.leave();
            },
        });
        this.hero = hero;
    }

    private leave(): void {
        if (this.leaving) return;
        this.leaving = true;
        this.onExit?.();
    }

    /** 屋里格子坐标（可带小数）换成房间节点坐标：那格底边中点 */
    footAt(x: number, y: number): [number, number] {
        const W = this.layout.w * TILE;
        const H = this.layout.h * TILE;
        return [(x + 0.5) * TILE - W / 2, H / 2 - (y + 1) * TILE];
    }

    /** 屋里坐标（左上角原点、像素）摆一张图：tl 按左下角对齐 (px, py)，bc 按底边中点对齐 */
    private sprite(parent: Node, name: string, px: number, py: number, anchor: 'tl' | 'bc'): Node {
        const n = uiNode(name, parent);
        const [w, h] = this.atlas.size(name);
        const ui = n.getComponent(UITransform)!;
        ui.setContentSize(new Size(w, h));
        ui.setAnchorPoint(anchor === 'tl' ? new Vec2(0, 0) : new Vec2(0.5, 0));
        const s = n.addComponent(Sprite);
        s.sizeMode = Sprite.SizeMode.CUSTOM;
        s.spriteFrame = this.atlas.frame(name);
        const W = this.layout.w * TILE;
        const H = this.layout.h * TILE;
        n.setPosition(px - W / 2, H / 2 - py, 0);
        return n;
    }

    /** 人物图里 look 那一行朝下站的第一帧 */
    private person(parent: Node, info: PeopleInfo, img: ImageAsset, look: string): Node | null {
        const row = info.rows.indexOf(look);
        if (row < 0) return null;
        const tex = new Texture2D();
        tex.image = img;
        tex.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
        const sf = new SpriteFrame();
        sf.texture = tex;
        const di = Math.max(0, info.dirs.indexOf('down'));
        sf.rect = new Rect(di * info.frames * info.frameW, row * info.frameH, info.frameW, info.frameH);
        const n = uiNode(`Keeper-${look}`, parent);
        const ui = n.getComponent(UITransform)!;
        ui.setContentSize(new Size(info.frameW, info.frameH));
        ui.setAnchorPoint(new Vec2(0.5, 0));
        const s = n.addComponent(Sprite);
        s.sizeMode = Sprite.SizeMode.CUSTOM;
        s.spriteFrame = sf;
        return n;
    }

    private cellAt(loc: Vec2): Cell {
        const map = this.map!;
        const ui = map.getComponent(UITransform)!;
        const vis = view.getVisibleSize();
        const canvas = this.node.parent!.getComponent(UITransform)!;
        const p = ui.convertToNodeSpaceAR(canvas.convertToWorldSpaceAR(new Vec3(loc.x - vis.width / 2, loc.y - vis.height / 2, 0)));
        return [Math.floor((p.x + ui.width / 2) / TILE), Math.floor((ui.height / 2 - p.y) / TILE)];
    }

    /** 点掌柜、柜台：走到柜台前搭话；点出口（或墙根那一排）：走出去；别处走过去。 */
    private onTap(loc: Vec2): void {
        if (this.leaving || !this.map) return;
        const [x, y] = this.cellAt(loc);
        const { layout } = this;
        const hero = this.hero?.ready ? this.hero : null;
        const c = layout.counter;
        const onKeeper = (layout.keeper && Math.abs(x - layout.keeper[0]) <= 0 && (y === layout.keeper[1] || y === layout.keeper[1] - 1))
            || (c && x >= c.x && x < c.x + c.w && y >= c.y - 1 && y < c.y + c.h);
        if (onKeeper && c && this.recipe.keeper) {
            const front = { x: c.x, y: c.y + c.h, w: c.w, h: 1 };
            if (!hero?.walkTo(front, 'onto', (ok) => ok && this.onKeeper?.())) this.onKeeper?.();
            return;
        }
        if (y >= layout.h - 1) {
            const [ex, ey] = layout.exit;
            if (!hero?.walkTo({ x: ex, y: ey, w: 1, h: 1 }, 'onto')) this.leave();
            return;
        }
        hero?.walkTo({ x, y, w: 1, h: 1 }, 'onto');
    }
}
