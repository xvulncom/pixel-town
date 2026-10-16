import { HOUR } from '../assets/scripts/core/time';

/** 北京时间转毫秒。 */
export function bj(y: number, m: number, d: number, h: number = 0, min: number = 0): number {
    return Date.UTC(y, m - 1, d, h, min) - 8 * HOUR;
}

export const sunny = () => 'sunny' as const;
export const rainy = () => 'rain' as const;
