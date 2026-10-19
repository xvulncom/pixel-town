// 一键巡村：熟了的收了卖掉，干了的浇水，枯了的清掉，空地按所选种子种上（钱不够就不种了）。
// 每块地走的都是 fields.tend，规则和一块块点一样。金币只在买种子、卖菜时变，巡村本身不给钱。

import { World } from './defs';
import { GameState } from './types';
import { tend } from './fields';

export interface PatrolReport {
    harvested: number;
    watered: number;
    cleared: number;
    planted: number;
    /** 卖菜收入减去买种子的钱 */
    gold: number;
}

export function patrol(state: GameState, world: World, cropId: string, nowMs: number): PatrolReport {
    const r: PatrolReport = { harvested: 0, watered: 0, cleared: 0, planted: 0, gold: 0 };
    let canPlant = !!cropId;
    state.plots.forEach((plot, i) => {
        // 一块地最多走两步：收完或清完接着种
        for (let k = 0; k < 2; k++) {
            if (plot.state === 'empty' && !canPlant) return;
            if (plot.state === 'growing' && plot.wetUntil > nowMs) return;
            const t = tend(state, world, i, cropId, nowMs);
            if (!t.ok) {
                if (state.plots[i].state === 'empty') canPlant = false;
                return;
            }
            r.gold += t.gold;
            if (t.action === 'harvest') r.harvested++;
            else if (t.action === 'water') r.watered++;
            else if (t.action === 'clear') r.cleared++;
            else if (t.action === 'plant') r.planted++;
            if (t.action !== 'harvest' && t.action !== 'clear') return;
            plot = state.plots[i];
        }
    });
    return r;
}

/** 巡村结果说成一句话。 */
export function patrolSummary(r: PatrolReport): string {
    const parts: string[] = [];
    if (r.harvested) parts.push(`收了 ${r.harvested} 块`);
    if (r.watered) parts.push(`浇了 ${r.watered} 块`);
    if (r.cleared) parts.push(`清了 ${r.cleared} 块枯苗`);
    if (r.planted) parts.push(`种了 ${r.planted} 块`);
    const body = parts.length ? parts.join('，') : '地里都挺好，没什么要干的';
    const money = r.gold ? `，${r.gold > 0 ? '赚' : '花'}了 ${Math.abs(r.gold)} 金` : '';
    return `${body}${money}`;
}
