// 现实地点：天气跟这些地方当天的真实天气走。官方小镇绑原型地点（regions.ts 的 origin），
// 玩家自己的村庄在"地点"里从这张表挑一个（不定位，不碰隐私）。
// 新增地点在这里加一行；服务端每小时按这张表去 Open-Meteo 拉天气，不用改别处。

import { PlaceDef } from '../core/realWeather';

const CN = 'Asia/Shanghai';

const list: PlaceDef[] = [
    // 各镇原型
    { id: 'suzhou', name: '苏州', lat: 31.30, lon: 120.62, tz: CN },
    { id: 'guangzhou', name: '广州', lat: 23.13, lon: 113.26, tz: CN },
    { id: 'harbin', name: '哈尔滨', lat: 45.80, lon: 126.53, tz: CN },
    { id: 'chengdu', name: '成都', lat: 30.66, lon: 104.07, tz: CN },
    { id: 'yanan', name: '延安', lat: 36.59, lon: 109.49, tz: CN },
    { id: 'tombstone', name: '墓碑镇（美国）', lat: 31.71, lon: -110.07, tz: 'America/Phoenix', abroad: true },
    // 国内
    { id: 'beijing', name: '北京', lat: 39.90, lon: 116.40, tz: CN },
    { id: 'shanghai', name: '上海', lat: 31.23, lon: 121.47, tz: CN },
    { id: 'tianjin', name: '天津', lat: 39.13, lon: 117.20, tz: CN },
    { id: 'chongqing', name: '重庆', lat: 29.56, lon: 106.55, tz: CN },
    { id: 'shenzhen', name: '深圳', lat: 22.54, lon: 114.06, tz: CN },
    { id: 'hangzhou', name: '杭州', lat: 30.27, lon: 120.15, tz: CN },
    { id: 'nanjing', name: '南京', lat: 32.06, lon: 118.80, tz: CN },
    { id: 'wuhan', name: '武汉', lat: 30.59, lon: 114.31, tz: CN },
    { id: 'xian', name: '西安', lat: 34.34, lon: 108.94, tz: CN },
    { id: 'changsha', name: '长沙', lat: 28.23, lon: 112.94, tz: CN },
    { id: 'zhengzhou', name: '郑州', lat: 34.75, lon: 113.63, tz: CN },
    { id: 'jinan', name: '济南', lat: 36.65, lon: 117.12, tz: CN },
    { id: 'qingdao', name: '青岛', lat: 36.07, lon: 120.38, tz: CN },
    { id: 'shenyang', name: '沈阳', lat: 41.80, lon: 123.43, tz: CN },
    { id: 'dalian', name: '大连', lat: 38.91, lon: 121.61, tz: CN },
    { id: 'changchun', name: '长春', lat: 43.82, lon: 125.32, tz: CN },
    { id: 'kunming', name: '昆明', lat: 25.04, lon: 102.71, tz: CN },
    { id: 'guiyang', name: '贵阳', lat: 26.65, lon: 106.63, tz: CN },
    { id: 'nanning', name: '南宁', lat: 22.82, lon: 108.37, tz: CN },
    { id: 'haikou', name: '海口', lat: 20.04, lon: 110.32, tz: CN },
    { id: 'sanya', name: '三亚', lat: 18.25, lon: 109.51, tz: CN },
    { id: 'xiamen', name: '厦门', lat: 24.48, lon: 118.09, tz: CN },
    { id: 'fuzhou', name: '福州', lat: 26.07, lon: 119.30, tz: CN },
    { id: 'hefei', name: '合肥', lat: 31.82, lon: 117.23, tz: CN },
    { id: 'nanchang', name: '南昌', lat: 28.68, lon: 115.86, tz: CN },
    { id: 'taiyuan', name: '太原', lat: 37.87, lon: 112.55, tz: CN },
    { id: 'shijiazhuang', name: '石家庄', lat: 38.04, lon: 114.51, tz: CN },
    { id: 'hohhot', name: '呼和浩特', lat: 40.84, lon: 111.75, tz: CN },
    { id: 'lanzhou', name: '兰州', lat: 36.06, lon: 103.83, tz: CN },
    { id: 'xining', name: '西宁', lat: 36.62, lon: 101.78, tz: CN },
    { id: 'yinchuan', name: '银川', lat: 38.49, lon: 106.23, tz: CN },
    { id: 'urumqi', name: '乌鲁木齐', lat: 43.83, lon: 87.62, tz: CN },
    { id: 'lhasa', name: '拉萨', lat: 29.65, lon: 91.17, tz: CN },
    { id: 'dunhuang', name: '敦煌', lat: 40.14, lon: 94.66, tz: CN },
    // 国外
    { id: 'tokyo', name: '东京', lat: 35.68, lon: 139.69, tz: 'Asia/Tokyo', abroad: true },
    { id: 'seoul', name: '首尔', lat: 37.57, lon: 126.98, tz: 'Asia/Seoul', abroad: true },
    { id: 'singapore', name: '新加坡', lat: 1.35, lon: 103.82, tz: 'Asia/Singapore', abroad: true },
    { id: 'sydney', name: '悉尼', lat: -33.87, lon: 151.21, tz: 'Australia/Sydney', abroad: true },
    { id: 'london', name: '伦敦', lat: 51.51, lon: -0.13, tz: 'Europe/London', abroad: true },
    { id: 'newyork', name: '纽约', lat: 40.71, lon: -74.01, tz: 'America/New_York', abroad: true },
    { id: 'losangeles', name: '洛杉矶', lat: 34.05, lon: -118.24, tz: 'America/Los_Angeles', abroad: true },
];

export const PLACES: Record<string, PlaceDef> = Object.fromEntries(list.map((p) => [p.id, p]));
/** 选地点界面里的顺序 */
export const PLACE_ORDER: string[] = list.map((p) => p.id);
