// 自己地盘的画面：地面按路面掩码铺图块，建筑按占地底边从上往下排（靠下的盖住靠上的），外加摆放时的虚影。
// 地盘外面画一圈树林杂草（core/border），只是装饰，点上去不算地盘里的格子。
// 只负责画，规则在 core/village，操作在 VillageBuild。

import {
    _decorator, Color, Component, Graphics, ImageAsset, JsonAsset, Label, Node, Rect, resources, Size, Sprite, SpriteFrame,
    Texture2D, tween, UIOpacity, UITransform, Vec2, Vec3, view,
} from 'cc';
import { World } from '../core/defs';
import { grassVariant, terrainGrid, terrainMask, villageSize } from '../core/village';
import { cropSprite, cropStage } from '../core/fields';
import { borderDecor, Decor } from '../core/border';
import { GameState, VillageState } from '../core/types';
import { uiNode } from './ui';

const { ccclass } = _decorator;
const TILE = 16;
const COLS = 16;

type Frames = Record<string, [number, number, number, number]>;
type TerrainTiles = Record<'grass' | 'dirt' | 'stone' | 'soil' | 'stoneFill', number[]>;

const OK_COLOR = new Color(120, 230, 120, 255);
const BAD_COLOR = new Color(240, 90, 80, 255);
const WET_COLOR = new Color(190, 175, 165, 255);
const GOLD_COLOR = new Color(255, 214, 102, 255);
/** 外圈草地压暗，和能盖房子的地方分开；tools/gen-map.ts 的预览用同一个亮度 0.86。 */
const BORDER_COLOR = new Color(219, 219, 219, 255);

@ccclass('VillageView')
export class VillageView extends Component {
    world!: World;
    state!: GameState;
    /** 素材都加载好、第一次画完后调用。 */
    onReady: (() => void) | null = null;

    private tilesTex: Texture2D | null = null;
    private objTex: Texture2D | null = null;
    private frames: Frames = {};
    private terrain: TerrainTiles | null = null;
    private tileFrames = new Map<number, SpriteFrame>();
    private objFrames = new Map<string, SpriteFrame>();
    private groundLayer: Node | null = null;
    private objectLayer: Node | null = null;
    private ghost: Node | null = null;
    private ghostSprite: Sprite | null = null;
    private ghostBox: Graphics | null = null;
    private cells: Sprite[] = [];
    private size: [number, number] = [0, 0];
    private margin = 0;
    private decor: Decor[] = [];

    start(): void {
        const done = (n: number) => {
            if (n === 4) this.build();
        };
        let loaded = 0;
        const fail = (what: string, e: unknown) => console.error(`地盘素材加载失败：${what}`, e);
        resources.load('maps/town-tiles', ImageAsset, (e, img) => {
            if (e || !img) return fail('town-tiles', e);
            this.tilesTex = nearest(img);
            done(++loaded);
        });
        resources.load('maps/buildings', ImageAsset, (e, img) => {
            if (e || !img) return fail('buildings', e);
            this.objTex = nearest(img);
            done(++loaded);
        });
        resources.load('maps/buildings-frames', JsonAsset, (e, j) => {
            if (e || !j) return fail('buildings-frames', e);
            this.frames = (j.json as { frames: Frames }).frames;
            done(++loaded);
        });
        resources.load('maps/terrain', JsonAsset, (e, j) => {
            if (e || !j) return fail('terrain', e);
            this.terrain = j.json as TerrainTiles;
            done(++loaded);
        });
    }

    get village(): VillageState {
        return this.state.village;
    }

    get isReady(): boolean {
        return this.groundLayer !== null;
    }

    private build(): void {
        this.groundLayer = uiNode('ground', this.node);
        this.objectLayer = uiNode('objects', this.node);
        this.ghost = uiNode('ghost', this.node);
        this.ghostBox = uiNode('box', this.ghost).addComponent(Graphics);
        const gs = uiNode('sprite', this.ghost);
        gs.getComponent(UITransform)!.setAnchorPoint(new Vec2(0.5, 0));
        this.ghostSprite = gs.addComponent(Sprite);
        this.ghostSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this.ghostSprite.color = new Color(255, 255, 255, 170);
        this.ghost.active = false;
        this.refresh();
        this.onReady?.();
    }

    /** 地盘内容变了（摆了、拆了、升档了）就整体重画一遍。 */
    refresh(): void {
        if (!this.groundLayer || !this.objectLayer || !this.terrain) return;
        const [w, h] = villageSize(this.world, this.village);
        if (w !== this.size[0] || h !== this.size[1]) this.resize(w, h);
        const grid = terrainGrid(this.world, this.village);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const t = grid[y * w + x];
                const id = t ? this.terrain[t][terrainMask(grid, w, h, x, y)] : this.terrain.grass[grassVariant(x, y)];
                this.cell(x, y).spriteFrame = this.tileFrame(id);
                this.cell(x, y).color = Color.WHITE;
            }
        }
        // 浇过水的菜地颜色深一点
        const now = Date.now();
        const plotOf = new Map(this.state.plots.map((p) => [p.field, p]));
        for (const it of this.village.items) {
            const p = plotOf.get(it.uid);
            if (p && p.state === 'growing' && p.wetUntil > now && it.x < w && it.y < h) {
                this.cell(it.x, it.y).color = WET_COLOR;
            }
        }
        this.objectLayer.removeAllChildren();
        const items: { name: string; x: number; y: number; foot: [number, number]; sprite: string }[] = [];
        for (const it of this.village.items) {
            const def = this.world.buildings[it.def];
            if (def?.kind === 'building' && def.sprite && this.frames[def.sprite]) {
                items.push({ name: `${def.id}#${it.uid}`, x: it.x, y: it.y, foot: def.foot, sprite: def.sprite });
            }
            // 菜地上的作物，1×1 占地，跟建筑一起按底边排
            const p = plotOf.get(it.uid);
            const stage = p && cropStage(this.world, p);
            const sprite = stage && p.cropId ? cropSprite(p.cropId, stage) : null;
            if (sprite && this.frames[sprite]) items.push({ name: `crop#${it.uid}`, x: it.x, y: it.y, foot: [1, 1], sprite });
        }
        for (const d of this.decor) {
            if (this.frames[d.sprite]) items.push({ name: 'decor', x: d.x, y: d.y, foot: [1, 1], sprite: d.sprite });
        }
        // 占地底边靠上的先画
        items.sort((a, b) => (a.y + a.foot[1]) - (b.y + b.foot[1]) || a.x - b.x);
        for (const e of items) {
            const n = uiNode(e.name, this.objectLayer);
            const ui = n.getComponent(UITransform)!;
            const [, , fw, fh] = this.frames[e.sprite];
            ui.setContentSize(new Size(fw, fh));
            ui.setAnchorPoint(new Vec2(0.5, 0));
            const s = n.addComponent(Sprite);
            s.sizeMode = Sprite.SizeMode.CUSTOM;
            s.spriteFrame = this.objFrame(e.sprite);
            const [lx, ly] = this.footBottom(e.x, e.y, e.foot);
            n.setPosition(lx, ly, 0);
        }
    }

    private resize(w: number, h: number): void {
        this.size = [w, h];
        const border = this.world.villageBorder;
        const m = (this.margin = border.margin);
        this.decor = borderDecor(border, w, h);
        this.node.getComponent(UITransform)!.setContentSize((w + 2 * m) * TILE, (h + 2 * m) * TILE);
        this.groundLayer!.removeAllChildren();
        this.cells = [];
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const n = uiNode('c', this.groundLayer!, TILE, TILE);
                n.getComponent(UITransform)!.setAnchorPoint(new Vec2(0, 1));
                const [lx, ly] = this.cellTopLeft(x, y);
                n.setPosition(lx, ly, 0);
                const s = n.addComponent(Sprite);
                s.sizeMode = Sprite.SizeMode.CUSTOM;
                this.cells.push(s);
            }
        }
        // 外圈草地只铺一次，升档变大时随地盘重建
        for (let y = -m; y < h + m; y++) {
            for (let x = -m; x < w + m; x++) {
                if (x >= 0 && y >= 0 && x < w && y < h) continue;
                const n = uiNode('b', this.groundLayer!, TILE, TILE);
                n.getComponent(UITransform)!.setAnchorPoint(new Vec2(0, 1));
                const [lx, ly] = this.cellTopLeft(x, y);
                n.setPosition(lx, ly, 0);
                const s = n.addComponent(Sprite);
                s.sizeMode = Sprite.SizeMode.CUSTOM;
                s.spriteFrame = this.tileFrame(this.terrain!.grass[grassVariant(x, y)]);
                s.color = BORDER_COLOR;
            }
        }
    }

    private cell(x: number, y: number): Sprite {
        return this.cells[y * this.size[0] + x];
    }

    /** 摆放虚影：defId 为空就藏起来。 */
    showGhost(defId: string | null, x = 0, y = 0, ok = true): void {
        if (!this.ghost || !this.ghostBox || !this.ghostSprite) return;
        if (!defId) {
            this.ghost.active = false;
            return;
        }
        const def = this.world.buildings[defId];
        this.ghost.active = true;
        this.ghost.setSiblingIndex(this.node.children.length - 1);
        const [fw, fd] = def.foot;
        const [lx, ly] = this.cellTopLeft(x, y);
        const g = this.ghostBox;
        g.clear();
        const c = ok ? OK_COLOR : BAD_COLOR;
        g.fillColor = new Color(c.r, c.g, c.b, 90);
        g.strokeColor = c;
        g.lineWidth = 1;
        g.rect(lx, ly - fd * TILE, fw * TILE, fd * TILE);
        g.fill();
        g.stroke();
        const sn = this.ghostSprite.node;
        if (def.kind === 'building' && def.sprite && this.frames[def.sprite]) {
            const [, , pw, ph] = this.frames[def.sprite];
            sn.active = true;
            sn.getComponent(UITransform)!.setContentSize(new Size(pw, ph));
            this.ghostSprite.spriteFrame = this.objFrame(def.sprite);
            const [bx, by] = this.footBottom(x, y, def.foot);
            sn.setPosition(bx, by, 0);
            this.ghostSprite.color = ok ? new Color(255, 255, 255, 190) : new Color(255, 140, 130, 170);
        } else {
            sn.active = false;
        }
    }

    /** 在某格上方飘一行字（收获的钱数等），往上飘着淡出。 */
    floatText(x: number, y: number, text: string, color: Color = GOLD_COLOR): void {
        // 字按 3 倍大小画再缩回来，地盘放大后不糊
        const n = uiNode('float', this.node, 360, 60);
        n.setScale(1 / 3, 1 / 3, 1);
        const l = n.addComponent(Label);
        l.string = text;
        l.fontSize = 30;
        l.lineHeight = 36;
        l.color = color;
        l.enableOutline = true;
        l.outlineColor = new Color(40, 30, 22, 255);
        l.outlineWidth = 3;
        const [lx, ly] = this.cellTopLeft(x, y);
        n.setPosition(lx + TILE / 2, ly + 4, 0);
        const op = n.addComponent(UIOpacity);
        tween(n).by(1.2, { position: new Vec3(0, 18, 0) }).call(() => n.destroy()).start();
        tween(op).delay(0.6).to(0.6, { opacity: 0 }).start();
    }

    /** 屏幕上的点（UI 坐标）落在哪一格，出了地盘返回 null。 */
    cellAt(ui: Vec2): [number, number] | null {
        const t = this.node.getComponent(UITransform)!;
        // UI 坐标原点在屏幕左下角，画布节点的原点在屏幕中间：先换成画布里的坐标，再转到世界、转到地盘
        const vis = view.getVisibleSize();
        const canvas = this.node.parent!.getComponent(UITransform)!;
        const world = canvas.convertToWorldSpaceAR(new Vec3(ui.x - vis.width / 2, ui.y - vis.height / 2, 0));
        const p = t.convertToNodeSpaceAR(world);
        const x = Math.floor((p.x + t.width / 2) / TILE) - this.margin;
        const y = Math.floor((t.height / 2 - p.y) / TILE) - this.margin;
        const [w, h] = this.size;
        return x >= 0 && y >= 0 && x < w && y < h ? [x, y] : null;
    }

    /** 建筑图标，建造栏用。 */
    iconFrame(sprite: string): SpriteFrame | null {
        return this.frames[sprite] ? this.objFrame(sprite) : null;
    }

    iconSize(sprite: string): [number, number] {
        const f = this.frames[sprite];
        return f ? [f[2], f[3]] : [TILE, TILE];
    }

    terrainIcon(terrain: string): SpriteFrame | null {
        const set = this.terrain?.[terrain as keyof TerrainTiles];
        return set ? this.tileFrame(set[15]) : null;
    }

    /** 地盘第 x 列第 y 行那格的底边中点（节点坐标），画人用：人的锚点在脚底。 */
    footOf(x: number, y: number): [number, number] {
        return this.footBottom(x, y, [1, 1]);
    }

    private cellTopLeft(x: number, y: number): [number, number] {
        const t = this.node.getComponent(UITransform)!;
        return [(x + this.margin) * TILE - t.width / 2, t.height / 2 - (y + this.margin) * TILE];
    }

    private footBottom(x: number, y: number, foot: [number, number]): [number, number] {
        const t = this.node.getComponent(UITransform)!;
        const m = this.margin;
        return [(x + m + foot[0] / 2) * TILE - t.width / 2, t.height / 2 - (y + m + foot[1]) * TILE];
    }

    private tileFrame(id: number): SpriteFrame {
        let sf = this.tileFrames.get(id);
        if (!sf) {
            sf = new SpriteFrame();
            sf.texture = this.tilesTex!;
            sf.rect = new Rect((id % COLS) * TILE, Math.floor(id / COLS) * TILE, TILE, TILE);
            this.tileFrames.set(id, sf);
        }
        return sf;
    }

    private objFrame(name: string): SpriteFrame {
        let sf = this.objFrames.get(name);
        if (!sf) {
            const [x, y, w, h] = this.frames[name];
            sf = new SpriteFrame();
            sf.texture = this.objTex!;
            sf.rect = new Rect(x, y, w, h);
            this.objFrames.set(name, sf);
        }
        return sf;
    }
}

function nearest(img: ImageAsset): Texture2D {
    const tex = new Texture2D();
    tex.image = img;
    tex.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
    return tex;
}
