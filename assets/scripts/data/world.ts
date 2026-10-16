// 正式游戏用的内容集合。

import { World } from '../core/defs';
import { CROPS } from './crops';
import { REGIONS } from './regions';
import { NPCS } from './npcs';
import { WISHES } from './wishes';
import { DIALOGUES } from './dialogues';

export const WORLD: World = {
    crops: CROPS,
    regions: REGIONS,
    npcs: NPCS,
    wishes: WISHES,
    dialogues: DIALOGUES,
};
