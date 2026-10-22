// 对话框排版（设计分辨率像素，左上角原点）：左边立绘，右边上面名字、下面台词。
// 贴屏幕底边（让开底部横条），横竖屏都按同一规则：宽度封顶居中；要是和右下角的按钮列压在一起，
// 先试着缩到按钮左边，太窄就整个抬到按钮上面。

import { Rect } from './screen';

export const CHAT_MARGIN = 16;
export const CHAT_PAD = 16;
/** 立绘放大倍数（48 像素 × 3 = 144） */
export const CHAT_PORTRAIT_SCALE = 3;
export const CHAT_MAX_W = 820;
/** 台词区至少这么宽，否则不往按钮左边挤 */
export const CHAT_MIN_TEXT_W = 300;
export const CHAT_NAME_H = 40;

export interface ChatBoxLayout {
    box: Rect;
    portrait: Rect;
    name: Rect;
    text: Rect;
}

const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * W、H 屏幕设计尺寸；top 顶栏高度（框不能盖到顶栏）；bottomPad 底部横条；avoid 要让开的按钮列（没有传 null）；
 * portraitPx 立绘原图边长。
 */
export function chatBoxLayout(W: number, H: number, top: number, bottomPad: number, avoid: Rect | null, portraitPx: number): ChatBoxLayout {
    const M = CHAT_MARGIN;
    const P = CHAT_PAD;
    const ps = portraitPx * CHAT_PORTRAIT_SCALE;
    const h = ps + P * 2;
    let w = Math.min(CHAT_MAX_W, W - M * 2);
    let x = (W - w) / 2;
    let y = H - bottomPad - M - h;
    if (avoid && overlap({ x, y, w, h }, avoid)) {
        const room = avoid.x - M * 2;
        if (room - ps - P * 3 >= CHAT_MIN_TEXT_W) {
            w = Math.min(CHAT_MAX_W, room);
            x = M + (room - w) / 2;
        } else {
            y = avoid.y - M - h;
        }
    }
    y = Math.max(top + M, y);
    const portrait = { x: x + P, y: y + P, w: ps, h: ps };
    const tx = portrait.x + ps + P;
    const tw = x + w - P - tx;
    return {
        box: { x, y, w, h },
        portrait,
        name: { x: tx, y: y + P, w: tw, h: CHAT_NAME_H },
        text: { x: tx, y: y + P + CHAT_NAME_H + 8, w: tw, h: h - P * 2 - CHAT_NAME_H - 8 },
    };
}
