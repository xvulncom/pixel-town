// 自己地盘的画面：地面按路面掩码铺图块，建筑按占地底边从上往下排（靠下的盖住靠上的），外加摆放时的虚影。
// 只负责画，规则在 core/village，操作在 VillageBuild。

import {
    _decorator, Color, Component, Graphics, ImageAsset, JsonAsset, Node, Rect, resources, Size, Sprite, SpriteFrame,
    Texture2D, UITransform, Vec2, Vec3, view,
} from 'cc';
import { World } from '../core/defs';
import { grassVariant, terrainGrid, terrainMask, villageSize } from '../core/village';
import { VillageState } from '../core/types';
import { uiNode } from './ui';

const { ccclass } = _decorator;
const TILE = 16;
const COLS = 16;

type Frames = Record<string, [number, number, number, number]>;
type TerrainTiles = Record<'grass' | 'dirt' | 'stone' | 'soil' | 'stoneFill', number[]>;

const OK_COLOR = new Color(120, 230, 120, 255);
const BAD_COLOR = new Color(240, 90, 80, 255);

@ccclass('VillageView')
export class VillageView extends Component {
    world!: World;
    village!: VillageState;
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
                this.cells[y * w + x].spriteFrame = this.tileFrame(id);
            }
        }
        this.objectLayer.removeAllChildren();
        const items = this.village.items
            .map((it) => ({ it, def: this.world.buildings[it.def] }))
            .filter((e) => e.def?.kind === 'building' && e.def.sprite && this.frames[e.def.sprite]);
        // 占地底边靠上的先画
        items.sort((a, b) => (a.it.y + a.def.foot[1]) - (b.it.y + b.def.foot[1]) || a.it.x - b.it.x);
        for (const { it, def } of items) {
            const n = uiNode(`${def.id}#${it.uid}`, this.objectLayer);
            const ui = n.getComponent(UITransform)!;
            const [, , fw, fh] = this.frames[def.sprite!];
            ui.setContentSize(new Size(fw, fh));
            ui.setAnchorPoint(new Vec2(0.5, 0));
            const s = n.addComponent(Sprite);
            s.sizeMode = Sprite.SizeMode.CUSTOM;
            s.spriteFrame = this.objFrame(def.sprite!);
            const [lx, ly] = this.footBottom(it.x, it.y, def.foot);
            n.setPosition(lx, ly, 0);
        }
    }

    private resize(w: number, h: number): void {
        this.size = [w, h];
        this.node.getComponent(UITransform)!.setContentSize(w * TILE, h * TILE);
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

    /** 屏幕上的点（UI 坐标）落在哪一格，出了地盘返回 null。 */
    cellAt(ui: Vec2): [number, number] | null {
        const t = this.node.getComponent(UITransform)!;
        // UI 坐标原点在屏幕左下角，画布节点的原点在屏幕中间：先换成画布里的坐标，再转到世界、转到地盘
        const vis = view.getVisibleSize();
        const canvas = this.node.parent!.getComponent(UITransform)!;
        const world = canvas.convertToWorldSpaceAR(new Vec3(ui.x - vis.width / 2, ui.y - vis.height / 2, 0));
        const p = t.convertToNodeSpaceAR(world);
        const x = Math.floor((p.x + t.width / 2) / TILE);
        const y = Math.floor((t.height / 2 - p.y) / TILE);
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

    private cellTopLeft(x: number, y: number): [number, number] {
        const t = this.node.getComponent(UITransform)!;
        return [x * TILE - t.width / 2, t.height / 2 - y * TILE];
    }

    private footBottom(x: number, y: number, foot: [number, number]): [number, number] {
        const t = this.node.getComponent(UITransform)!;
        return [(x + foot[0] / 2) * TILE - t.width / 2, t.height / 2 - (y + foot[1]) * TILE];
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
