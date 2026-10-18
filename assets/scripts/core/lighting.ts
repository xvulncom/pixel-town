// 晨昏光照：按北京时间给画面盖一层颜色。清晨偏橙、白天不盖、傍晚橙紫、夜里深蓝。
// 以后接天气（阴天、下雨压暗）时在这里叠加，画面层只管按结果画。

export interface Tint {
    r: number;
    g: number;
    b: number;
    /** 0～1，0 表示不盖 */
    a: number;
}

/** 关键时刻（小时，可带小数）和当时的颜色，中间线性插值，首尾相接成一天。 */
const KEYS: [number, Tint][] = [
    [0, { r: 20, g: 30, b: 80, a: 0.42 }],
    [4.5, { r: 20, g: 30, b: 80, a: 0.42 }],
    [6, { r: 255, g: 150, b: 80, a: 0.22 }],
    [8, { r: 255, g: 200, b: 140, a: 0 }],
    [16, { r: 255, g: 200, b: 140, a: 0 }],
    [17.5, { r: 255, g: 140, b: 60, a: 0.2 }],
    [19, { r: 120, g: 60, b: 120, a: 0.3 }],
    [20.5, { r: 20, g: 30, b: 80, a: 0.42 }],
    [24, { r: 20, g: 30, b: 80, a: 0.42 }],
];

export function tintAt(hour: number): Tint {
    const h = ((hour % 24) + 24) % 24;
    for (let i = 1; i < KEYS.length; i++) {
        const [h1, c1] = KEYS[i];
        if (h <= h1) {
            const [h0, c0] = KEYS[i - 1];
            const t = h1 === h0 ? 0 : (h - h0) / (h1 - h0);
            const mix = (a: number, b: number) => a + (b - a) * t;
            return { r: Math.round(mix(c0.r, c1.r)), g: Math.round(mix(c0.g, c1.g)), b: Math.round(mix(c0.b, c1.b)), a: mix(c0.a, c1.a) };
        }
    }
    return KEYS[0][1];
}
