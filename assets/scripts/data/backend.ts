// 存档后端按平台选（规则在 core/sync.ts 的 pickBackend）。
//   web    —— 自建服务器 town.xvuln.com（部署在 ~/SERVER/像素小镇/），第一次打开输邀请码
//   wechat —— 微信云开发；data/cloud.ts 的 env 为空时只用本机存档
// 网页本地调试不连服务器：加载前设 window.__pixelTownBackend = 'local'。
import { BackendConfig } from '../core/sync';

export const BACKEND: BackendConfig = {
    web: 'server',
    wechat: 'wxcloud',
    other: 'local',
    server: {
        // 网页版和接口同源（nginx 把 /api/ 转给后端），换域名不用改这里
        base: '',
        pushEverySec: 30,
    },
};
