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

/** 地图最小缩放要满足的条件，尺寸都是设计分辨率像素。 */
export interface ZoomLimits {
    visW: number;
    visH: number;
    /** 地图节点缩放前的宽高，0 表示还没加载 */
    mapW: number;
    mapH: number;
    /** 无论如何不小于这个倍数 */
    floor: number;
    /** 图块边长 */
    tile?: number;
    /** 一个图层一次最多能画多少格（引擎顶点缓冲决定），不填不限 */
    maxCells?: number;
}

/**
 * 像素对齐（照星露谷）：一个美术像素在屏幕上必须正好占整数个物理像素，地图和人物也都停在物理像素格上，
 * 否则缩放不是整数倍时像素一会宽一会窄（画面闪），人物按地图像素取整时一步跳好几个物理像素（一顿一顿）。
 * r = 每个设计像素占几个物理像素（屏幕物理宽 ÷ 设计宽），地图缩放 z 时一个美术像素占 z·r 个物理像素。
 */

/** 缩放取到物理整数倍：min、max 是设计分辨率下的上下限，取整后仍不小于 min（保证铺满、格子数不超）。 */
export function snapZoom(z: number, r: number, min: number, max: number): number {
    const lo = Math.max(1, Math.ceil(min * r - 1e-6));
    const hi = Math.max(lo, Math.floor(max * r + 1e-6));
    return Math.min(hi, Math.max(lo, Math.round(z * r))) / r;
}

/** 地图节点位置（设计像素，相对屏幕中心）取到让地图边缘落在物理像素格上。half 是屏幕物理宽或高的一半（可能带 .5）。 */
export function snapOffset(p: number, r: number, half: number): number {
    const c = half - Math.floor(half);
    return (Math.round(p * r + c) - c) / r;
}

/** 地图节点里的坐标取到物理像素格：n = 一个美术像素占几个物理像素（整数）；n 不到 1 时按地图像素取整。 */
export function snapToGrid(v: number, n: number): number {
    return n >= 1 ? Math.round(v * n) / n : Math.round(v);
}

/** 引擎裁剪时在屏幕外多画的格数（每个方向合计），按 Cocos 3.8 实测 3 格再留 1 格余量。 */
export const CULL_MARGIN = 4;

/**
 * 地图能缩到的最小倍数：取三者最大——下限、铺满屏幕不露边、一屏格子数不超过缓冲。
 * 格子数按 (屏宽/图块/倍数 + 余量) × (屏高/图块/倍数 + 余量) 算，解这个二次不等式。
 */
export function minMapZoom(l: ZoomLimits): number {
    let z = l.floor;
    if (l.mapW > 0 && l.mapH > 0) z = Math.max(z, l.visW / l.mapW, l.visH / l.mapH);
    if (l.maxCells && l.tile) {
        const a = l.visW / l.tile;
        const b = l.visH / l.tile;
        const m = CULL_MARGIN;
        const c = m * m - l.maxCells;
        // ab·u² + m(a+b)·u + (m² − N) ≤ 0，u = 1/倍数
        const u = (-m * (a + b) + Math.sqrt(m * m * (a + b) * (a + b) - 4 * a * b * c)) / (2 * a * b);
        if (u > 0) z = Math.max(z, 1 / u);
    }
    return z;
}
