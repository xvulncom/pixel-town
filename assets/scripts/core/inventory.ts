import { GameState, ItemId } from './types';

export function cropItem(cropId: string): ItemId {
    return `crop:${cropId}`;
}

export function seedItem(cropId: string): ItemId {
    return `seed:${cropId}`;
}

export function countOf(state: GameState, id: ItemId): number {
    return state.inventory[id] ?? 0;
}

export function addItem(state: GameState, id: ItemId, n: number = 1): void {
    state.inventory[id] = countOf(state, id) + n;
}

/** 数量不够时不扣，返回 false。 */
export function removeItem(state: GameState, id: ItemId, n: number = 1): boolean {
    const have = countOf(state, id);
    if (have < n) {
        return false;
    }
    if (have === n) {
        delete state.inventory[id];
    } else {
        state.inventory[id] = have - n;
    }
    return true;
}
