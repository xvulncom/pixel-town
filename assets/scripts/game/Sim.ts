// 常驻的模拟节点：开机就起，挂在常驻根节点上，不跟着界面走（镇上、钓鱼、摆摊、转屏重搭时都在跑）。
// 每 TICK_S 秒把作物和工人推进到此刻、存档、推云端，然后发 'tick' 事件让界面刷新。
// 游戏开着时记 lastSeen，工人据此知道"有人看着"；切到后台不记，切回来先拉云端再接着跑。

import { _decorator, Component, EventTarget, game, Game } from 'cc';
import { World } from '../core/defs';
import { deserialize } from '../core/game';
import { OfflineReport, simulate } from '../core/simulate';
import { GameState } from '../core/types';
import { CloudSync } from '../core/sync';
import { saveGame, SaveStore } from './Store';

const { ccclass } = _decorator;
export const TICK_S = 10;

/** 'tick'：推进了一次；'replaced'：换成了云端那份存档，界面要整个重搭。 */
export const simEvents = new EventTarget();

@ccclass('Sim')
export class Sim extends Component {
    world!: World;
    state!: GameState;
    store!: SaveStore;
    cloud: CloudSync | null = null;
    /** 开机时离线那段的结算结果，地盘界面第一次打开时提示一次（Boot 填，VillageBuild 读完清掉） */
    report: { value: OfflineReport | null } = { value: null };
    private shown = true;
    private pulling = false;

    start(): void {
        this.schedule(() => this.step(), TICK_S);
        game.on(Game.EVENT_HIDE, this.onHide, this);
        game.on(Game.EVENT_SHOW, this.onShow, this);
        void this.syncCloud();
    }

    onDestroy(): void {
        game.off(Game.EVENT_HIDE, this.onHide, this);
        game.off(Game.EVENT_SHOW, this.onShow, this);
    }

    /** 推进到此刻、存档、推云端。界面上的操作改了存档后也可以直接调。 */
    step(): OfflineReport {
        const now = Date.now();
        if (this.shown) this.state.lastSeen = now;
        const r = simulate(this.state, this.world, now);
        saveGame(this.store, this.state);
        if (!this.pulling) this.cloud?.push(this.state);
        simEvents.emit('tick', r);
        return r;
    }

    private onHide(): void {
        this.step();
        this.shown = false;
        // 切到后台、关页面：马上推一次，后端从这一刻接着推进工人
        if (!this.pulling) this.cloud?.flush?.(this.state);
    }

    private onShow(): void {
        this.shown = true;
        void this.syncCloud().then(() => this.step());
    }

    /** 拉云端：云端推进得更靠后就换成云端那份（玩家关着游戏时工人是在云端干的活）。 */
    private async syncCloud(): Promise<void> {
        if (!this.cloud) return;
        this.pulling = true;
        try {
            const doc = await this.cloud.pull();
            if (doc && doc.lastTick > this.state.lastTick) {
                const next = deserialize(doc.json, this.world);
                for (const k of Object.keys(this.state)) delete (this.state as unknown as Record<string, unknown>)[k];
                Object.assign(this.state, next);
                saveGame(this.store, this.state);
                simEvents.emit('replaced');
            }
        } catch (e) {
            console.warn('拉后端存档失败', e);
        } finally {
            this.pulling = false;
        }
    }
}
