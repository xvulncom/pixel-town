// 存档放哪：本机存储（网页和微信都能用 sys.localStorage），是主缓存，读写同步。
// 后端那份（自建服务器或云开发）是异步同步的，见 core/sync.ts 的 CloudSync 和 game/Backend.ts。

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

/** 本机存储里的一份存档。网页版连服务器时按玩家分开放（同一个浏览器换邀请码不串档）。 */
export function localStoreAt(key: string): SaveStore {
    return {
        load: () => sys.localStorage.getItem(key),
        save: (json) => sys.localStorage.setItem(key, json),
        backup: (json) => sys.localStorage.setItem(`${key}-broken-${Date.now()}`, json),
    };
}

export const localStore: SaveStore = localStoreAt(KEY);
export const playerStore = (playerId: string): SaveStore => localStoreAt(`${KEY}-${playerId}`);

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
