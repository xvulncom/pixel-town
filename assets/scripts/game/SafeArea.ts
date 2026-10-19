// 取屏幕的不安全区和微信胶囊位置，换成设计分辨率像素（原点左上角），交给 core/screen 排版。
// 微信里用 wx.getWindowInfo / getMenuButtonBoundingClientRect；网页用 Cocos 的安全区。
// 网页调试时可以在页面加载前设 window.__pixelTownInsets 模拟刘海屏（单位 pt，同微信接口）。

import { sys, view } from 'cc';
import { Box, ScreenInsets } from '../core/screen';

interface PtInsets {
    windowWidth: number;
    windowHeight: number;
    safeArea: { top: number; bottom: number };
    capsule?: Box | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function fromWechat(): PtInsets | null {
    const g = globalThis as any;
    const override = g.__pixelTownInsets as PtInsets | undefined;
    if (override) return override;
    const wx = g.wx;
    if (!wx) return null;
    try {
        const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        let capsule: Box | null = null;
        try {
            capsule = wx.getMenuButtonBoundingClientRect?.() ?? null;
        } catch {
            capsule = null;
        }
        if (!info?.safeArea) return null;
        return { windowWidth: info.windowWidth, windowHeight: info.windowHeight, safeArea: info.safeArea, capsule };
    } catch (e) {
        console.warn('读不到安全区', e);
        return null;
    }
}

export function screenInsets(): ScreenInsets {
    const vis = view.getVisibleSize();
    const pt = fromWechat();
    if (pt && pt.windowWidth > 0) {
        const k = vis.width / pt.windowWidth;
        const c = pt.capsule;
        return {
            width: vis.width,
            height: vis.height,
            safeTop: Math.max(0, pt.safeArea.top * k),
            safeBottom: Math.max(0, (pt.windowHeight - pt.safeArea.bottom) * k),
            // 有的机型胶囊接口返回全 0，当没有
            capsule: c && c.right > 0 ? { left: c.left * k, top: c.top * k, right: c.right * k, bottom: c.bottom * k } : null,
        };
    }
    // Cocos 的安全区原点在左下角
    const r = sys.getSafeAreaRect();
    return {
        width: vis.width,
        height: vis.height,
        safeTop: Math.max(0, vis.height - (r.y + r.height)),
        safeBottom: Math.max(0, r.y),
        capsule: null,
    };
}
