// 现实天气表：网页版从自建服务器 /api/weather 拉（服务端每小时从 Open-Meteo 更新），拉到后交给 core/realWeather。
// 开机先等一下（最多几秒）再推进离线这段，免得开头几天用错天气；之后每小时刷新一次。
// 本机缓存一份，断网开机也能用上次的。微信版暂时没有能访问的后端（域名要 ICP 备案），退回地域随机天气。

import { sys } from 'cc';
import { setRealWeather, WeatherTable } from '../core/realWeather';
import { BACKEND } from '../data/backend';

const CACHE_KEY = 'pixel-town-weather';
const FIRST_WAIT_MS = 4000;
const REFRESH_MS = 3600_000;

function readCache(): WeatherTable | null {
    try {
        const t = JSON.parse(sys.localStorage.getItem(CACHE_KEY) ?? 'null');
        return t && typeof t === 'object' ? (t as WeatherTable) : null;
    } catch {
        return null;
    }
}

async function pull(base: string): Promise<boolean> {
    try {
        const r = await fetch(`${base}/api/weather`, { cache: 'no-store' });
        if (!r.ok) return false;
        const body = (await r.json()) as { table?: WeatherTable };
        if (!body.table || typeof body.table !== 'object') return false;
        setRealWeather(body.table);
        try {
            sys.localStorage.setItem(CACHE_KEY, JSON.stringify(body.table));
        } catch {
            // 本机存储满了也不要紧
        }
        return true;
    } catch {
        return false;
    }
}

let started = false;

/** 开机调一次：先用缓存，再拉服务器（最多等几秒），之后每小时刷新。onChange 在拉到新表后调。 */
export async function startRealWeather(onChange: () => void = () => undefined): Promise<void> {
    if (started || !sys.isBrowser || sys.platform === sys.Platform.WECHAT_GAME) return;
    started = true;
    const cached = readCache();
    if (cached) setRealWeather(cached);
    const g = globalThis as { __pixelTownServer?: unknown };
    const base = typeof g.__pixelTownServer === 'string' ? g.__pixelTownServer : BACKEND.server.base;
    await Promise.race([pull(base), new Promise((r) => setTimeout(r, FIRST_WAIT_MS))]);
    setInterval(() => {
        void pull(base).then((ok) => ok && onChange());
    }, REFRESH_MS);
}
