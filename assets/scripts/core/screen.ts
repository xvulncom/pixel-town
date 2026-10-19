// 界面怎么摆：竖屏顶栏在上、建造栏在下；横屏顶栏在上、建造栏在右侧一列。
// 同时让开刘海、灵动岛、微信右上角胶囊和 iPhone 底部的横条。
// 输入输出都是设计分辨率下的像素，原点在屏幕左上角；平台怎么取这些数在 game/SafeArea.ts。

export interface Box {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

export interface ScreenInsets {
    width: number;
    height: number;
    /** 顶部不安全区的高度（刘海、灵动岛、状态栏） */
    safeTop: number;
    /** 底部不安全区的高度（iPhone 底部横条） */
    safeBottom: number;
    /** 左右不安全区（横屏时刘海在侧边），不填当 0 */
    safeLeft?: number;
    safeRight?: number;
    /** 微信右上角胶囊按钮，网页上没有 */
    capsule: Box | null;
}

export type Orientation = 'portrait' | 'landscape';

export interface HudLayout {
    /** 顶栏从屏幕顶边往下的总高度，地图上方要让出这么多 */
    height: number;
    /** 灵动岛（刘海）两侧的空档，放节气天气和金币；顶部太窄时为 null，信息挪进主行 */
    ears: { top: number; bottom: number; left: [number, number]; right: [number, number] } | null;
    /** 主行：左边地名，右边按钮；right 是按钮右边能到的位置（让开胶囊） */
    row: { top: number; bottom: number; left: number; right: number };
    /** 底栏下面要垫高多少，让开底部横条 */
    bottomPad: number;
}

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface ScreenLayout {
    orientation: Orientation;
    hud: HudLayout;
    /** 建造栏：竖屏在底部（不含底下垫的横条），横屏在右侧 */
    panel: Rect;
    /** 地图露出来的区域（没被顶栏、建造栏挡住的部分） */
    map: Rect;
}

export const MARGIN = 16;
export const ROW_H = 100;
/** 顶部不安全区至少这么高才在两侧放字（刘海屏、灵动岛约 80～110，普通状态栏约 40） */
export const EAR_MIN_H = 64;
/** 两侧空档各占屏幕宽的比例：刘海最宽的机型两边约剩 23%，留点余量 */
export const EAR_RATIO = 0.22;
/** 横屏时右侧建造栏的宽度 */
export const SIDE_W = 400;

export function orientationOf(width: number, height: number): Orientation {
    return width > height ? 'landscape' : 'portrait';
}

export function hudLayout(s: ScreenInsets): HudLayout {
    const sl = s.safeLeft ?? 0;
    const sr = s.safeRight ?? 0;
    // 横屏时刘海在侧边，顶上没有空档
    const ears = s.safeTop >= EAR_MIN_H && orientationOf(s.width, s.height) === 'portrait'
        ? {
            top: 0,
            bottom: s.safeTop,
            left: [MARGIN, s.width * EAR_RATIO] as [number, number],
            right: [s.width * (1 - EAR_RATIO), s.width - MARGIN] as [number, number],
        }
        : null;
    let top = s.safeTop;
    let right = s.width - MARGIN - sr;
    const cap = s.capsule;
    if (cap) {
        // 胶囊挡住主行右边：按钮放到胶囊左边；胶囊比主行还低时主行下移，跟胶囊居中对齐
        right = Math.min(right, cap.left - 12);
        const capMid = (cap.top + cap.bottom) / 2;
        top = Math.max(top, capMid - ROW_H / 2);
    }
    const row = { top, bottom: top + ROW_H, left: MARGIN + sl, right };
    return { height: row.bottom + 8, ears, row, bottomPad: s.safeBottom };
}

/** panelH 是竖屏建造栏的高度（横屏时建造栏占满顶栏以下的右侧）。 */
export function screenLayout(s: ScreenInsets, panelH: number): ScreenLayout {
    const orientation = orientationOf(s.width, s.height);
    const hud = hudLayout(s);
    if (orientation === 'portrait') {
        const panel = { x: 0, y: s.height - hud.bottomPad - panelH, w: s.width, h: panelH };
        return { orientation, hud, panel, map: { x: 0, y: hud.height, w: s.width, h: panel.y - hud.height } };
    }
    const sr = s.safeRight ?? 0;
    const panel = { x: s.width - sr - SIDE_W, y: hud.height, w: SIDE_W, h: s.height - hud.height - s.safeBottom };
    return { orientation, hud, panel, map: { x: 0, y: hud.height, w: panel.x, h: s.height - hud.height } };
}
