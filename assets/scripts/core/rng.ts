// 可复现的随机数：同样的输入永远得到同样的结果，离线结算和测试都靠它。

/** FNV-1a 32 位字符串哈希。 */
export function hashString(s: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

export function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** 由若干键确定的 [0, 1) 随机数。 */
export function rand01(...parts: (string | number)[]): number {
    return mulberry32(hashString(parts.join('|')))();
}
