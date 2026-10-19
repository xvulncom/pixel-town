// 自己地盘上的工人：常驻模拟每推进一次就看看每个人在干什么、在哪格菜地，人走过去。
// 干活的弯腰（来回换帧），偷懒的头上冒 zz，没活干的站在原地，下工和跑腿的不在地盘上。
// 人物图和帧信息共用镇上的 people.png / people-frames.json，工人用哪一行看 data/workers.ts 的 look。

import {
    _decorator, Color, Component, ImageAsset, JsonAsset, Label, Node, Rect, resources, Size, Sprite, SpriteFrame,
    Texture2D, UITransform, Vec2,
} from 'cc';
import { World } from '../core/defs';
import { GameState, Worker } from '../core/types';
import { simEvents } from './Sim';
import { VillageView } from './VillageView';
import { label, uiNode } from './ui';

const { ccclass } = _decorator;
const TILE = 16;
/** 每秒走几格 */
const SPEED = 3;

interface FrameInfo {
    frameW: number;
    frameH: number;
    dirs: string[];
    frames: number;
    rows: string[];
}

interface Actor {
    node: Node;
    sprite: Sprite;
    zz: Label;
    frames: SpriteFrame[][];
    target: [number, number];
    /** 已经摆上过位置（第一次直接放到目标处，不从原点走过去） */
    placed: boolean;
}

@ccclass('VillageWorkers')
export class VillageWorkers extends Component {
    world!: World;
    state!: GameState;
    view!: VillageView;
    private layer: Node | null = null;
    private info: FrameInfo | null = null;
    private tex: Texture2D | null = null;
    private actors = new Map<string, Actor>();
    private t = 0;

    start(): void {
        resources.load('maps/people-frames', JsonAsset, (e1, info) => {
            resources.load('maps/people', ImageAsset, (e2, img) => {
                if (e1 || e2 || !info || !img || !this.node.isValid) return;
                this.info = info.json as FrameInfo;
                this.tex = new Texture2D();
                this.tex.image = img;
                this.tex.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
                this.layer = uiNode('Workers', this.node);
                simEvents.on('tick', this.sync, this);
                this.sync();
            });
        });
    }

    onDestroy(): void {
        simEvents.off('tick', this.sync, this);
    }

    /** 按存档摆人：雇了的加上，走了的拿掉，目标格子更新。工人表变了（签约、辞退）之后也调这个。 */
    sync(): void {
        if (!this.layer || !this.info) return;
        const ids = new Set(this.state.workers.map((w) => w.id));
        for (const [id, a] of this.actors) {
            if (!ids.has(id)) {
                a.node.destroy();
                this.actors.delete(id);
            }
        }
        this.layer.setSiblingIndex(this.node.children.length - 1);
        for (const w of this.state.workers) {
            const a = this.actors.get(w.id) ?? this.make(w);
            if (!a) continue;
            const cell = this.cellOf(w);
            a.node.active = w.doing !== 'off' && w.doing !== 'errand' && cell !== null;
            a.zz.node.active = w.doing === 'slack';
            if (cell) {
                const [x, y] = this.view.footOf(cell[0], cell[1]);
                // 站在菜地下边一格，不挡住庄稼
                a.target = [x, y - TILE];
                if (!a.node.active || !a.placed) a.node.setPosition(a.target[0], a.target[1], 0);
                a.placed = true;
            }
        }
    }

    /** 他该站哪格：最近干活的那格菜地；还没干过活就站在第一户民居门口。 */
    private cellOf(w: Worker): [number, number] | null {
        const items = this.state.village.items;
        const field = w.at === null ? undefined : items.find((it) => it.uid === w.at);
        if (field) return [field.x, field.y];
        const home = items.find((it) => this.world.hiring.housing.includes(it.def));
        if (!home) return null;
        const def = this.world.buildings[home.def];
        return [home.x + Math.floor(def.foot[0] / 2), home.y + def.foot[1]];
    }

    private make(w: Worker): Actor | null {
        const info = this.info!;
        const look = this.world.workers[w.id]?.look ?? 'hero';
        const row = Math.max(0, info.rows.indexOf(look));
        const node = uiNode(w.id, this.layer!, info.frameW, info.frameH);
        node.getComponent(UITransform)!.setAnchorPoint(new Vec2(0.5, 0));
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        node.getComponent(UITransform)!.setContentSize(new Size(info.frameW, info.frameH));
        const frames = info.dirs.map((_, di) => Array.from({ length: info.frames }, (_, f) => {
            const sf = new SpriteFrame();
            sf.texture = this.tex!;
            sf.rect = new Rect((di * info.frames + f) * info.frameW, row * info.frameH, info.frameW, info.frameH);
            return sf;
        }));
        sprite.spriteFrame = frames[0][0];
        const zz = label(node, 'z z', 10, new Color(220, 230, 255, 255), 24, 12, 'zz');
        zz.node.setPosition(8, info.frameH + 4, 0);
        const a: Actor = { node, sprite, zz, frames, target: [0, 0], placed: false };
        this.actors.set(w.id, a);
        return a;
    }

    update(dt: number): void {
        this.t += dt;
        for (const [id, a] of this.actors) {
            if (!a.node.active) continue;
            const w = this.state.workers.find((x) => x.id === id);
            const p = a.node.position;
            const dx = a.target[0] - p.x;
            const dy = a.target[1] - p.y;
            const d = Math.hypot(dx, dy);
            const step = SPEED * TILE * dt;
            if (d > 0.5) {
                const k = Math.min(1, step / d);
                a.node.setPosition(p.x + dx * k, p.y + dy * k, 0);
                // 朝向：down left right up
                const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy > 0 ? 3 : 0;
                a.sprite.spriteFrame = a.frames[dir][1 + (Math.floor(this.t * 6) % 2)];
            } else if (w?.doing === 'work') {
                // 干活：朝上（对着菜地）慢慢换帧
                a.sprite.spriteFrame = a.frames[3][Math.floor(this.t * 2) % 2 === 0 ? 0 : 1];
            } else {
                a.sprite.spriteFrame = a.frames[0][0];
            }
            a.zz.node.setPosition(8, (this.info?.frameH ?? 32) + 2 + Math.sin(this.t * 3) * 2, 0);
        }
    }
}
