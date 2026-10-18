// 存档放哪：现在是本机存储（网页和微信都能用 sys.localStorage）。接后端时实现同一个接口换掉，游戏逻辑不用改。

import { sys } from 'cc';
import { World } from '../core/defs';
import { deserialize, newGame, serialize } from '../core/game';
import { GameState } from '../core/types';

export interface SaveStore {
    load(): string | null;
    save(json: string): void;
    /** 读坏了的存档留一份，方便查。 */
    backup(json: string): void;
}

const KEY = 'pixel-town-save';

export const localStore: SaveStore = {
    load: () => sys.localStorage.getItem(KEY),
    save: (json) => sys.localStorage.setItem(KEY, json),
    backup: (json) => sys.localStorage.setItem(`${KEY}-broken-${Date.now()}`, json),
};

/** 读档，没有或读坏了就新开一局。regionId 是新开时用的老家。 */
export function loadOrNew(store: SaveStore, world: World, regionId: string): GameState {
    const json = store.load();
    if (json) {
        try {
            return deserialize(json, world);
        } catch (e) {
            console.error('存档读不了，新开一局', e);
            store.backup(json);
        }
    }
    const state = newGame(world, Date.now(), `p${Date.now().toString(36)}`, regionId);
    store.save(serialize(state));
    return state;
}

export function saveGame(store: SaveStore, state: GameState): void {
    store.save(serialize(state));
}
