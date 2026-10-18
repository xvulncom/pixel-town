// 镇上走动的人：沿一条横平竖直的折线来回走，两头各停一会儿。
// 位置只由"现在是第几秒"算出来，不存状态，离线回来、切后台都不会乱。

export type Dir = 'down' | 'left' | 'right' | 'up';

export interface WalkRoute {
    /** 脚下所在的格子，按顺序走过去再原路返回 */
    path: [number, number][];
    /** 每秒走几格 */
    speed: number;
    /** 两头各停几秒，默认 1.5 */
    pause?: number;
}

export interface WalkPose {
    /** 格子坐标，可以是小数 */
    x: number;
    y: number;
    dir: Dir;
    moving: boolean;
    /** 走路帧：0 站，1 迈左脚，2 迈右脚 */
    frame: 0 | 1 | 2;
}

const STEP_SEQ: (0 | 1 | 2)[] = [0, 1, 0, 2];
/** 每走一格换几次脚 */
const STEPS_PER_TILE = 4;

function dirOf(dx: number, dy: number): Dir {
    if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right';
    return dy < 0 ? 'up' : 'down';
}

function routeLength(path: [number, number][]): number {
    let len = 0;
    for (let i = 1; i < path.length; i++) len += Math.abs(path[i][0] - path[i - 1][0]) + Math.abs(path[i][1] - path[i - 1][1]);
    return len;
}

/** 沿路线走了 d 格时的位置和朝向（不含往返）。 */
function along(path: [number, number][], d: number): { x: number; y: number; dir: Dir } {
    let left = d;
    for (let i = 1; i < path.length; i++) {
        const [x0, y0] = path[i - 1];
        const [x1, y1] = path[i];
        const seg = Math.abs(x1 - x0) + Math.abs(y1 - y0);
        if (left <= seg || i === path.length - 1) {
            const t = seg === 0 ? 0 : Math.min(1, left / seg);
            return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, dir: dirOf(x1 - x0, y1 - y0) };
        }
        left -= seg;
    }
    const [x, y] = path[0];
    return { x, y, dir: 'down' };
}

const flip: Record<Dir, Dir> = { down: 'up', up: 'down', left: 'right', right: 'left' };

/** 第 seconds 秒时人在哪、朝哪、迈哪只脚。只有一个点的路线就原地站着朝下。 */
export function poseAt(route: WalkRoute, seconds: number): WalkPose {
    const len = routeLength(route.path);
    if (route.path.length < 2 || len === 0 || route.speed <= 0) {
        const [x, y] = route.path[0] ?? [0, 0];
        return { x, y, dir: 'down', moving: false, frame: 0 };
    }
    const pause = route.pause ?? 1.5;
    const walk = len / route.speed;
    const cycle = 2 * walk + 2 * pause;
    let t = ((seconds % cycle) + cycle) % cycle;
    // 去程
    if (t < walk) return moving(route.path, t * route.speed, false);
    t -= walk;
    if (t < pause) return still(route.path, len, false);
    t -= pause;
    // 回程
    if (t < walk) return moving(route.path, len - t * route.speed, true);
    return still(route.path, 0, true);
}

function moving(path: [number, number][], d: number, back: boolean): WalkPose {
    const p = along(path, d);
    const frame = STEP_SEQ[Math.floor(d * STEPS_PER_TILE) % STEP_SEQ.length];
    return { x: p.x, y: p.y, dir: back ? flip[p.dir] : p.dir, moving: true, frame };
}

function still(path: [number, number][], d: number, back: boolean): WalkPose {
    const p = along(path, d);
    // 停下时还朝着刚才走的方向
    return { x: p.x, y: p.y, dir: back ? flip[p.dir] : p.dir, moving: false, frame: 0 };
}
