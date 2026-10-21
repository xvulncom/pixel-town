// 镇子上能点的地方：名字、点到时说的话、头上挂不挂牌子。格子位置由 gen-map 生成在 <地图>.places.json。
// 现在只有江南一座镇子；以后加地域时按地域分组（之后从 regions 里的 map 名取对应的一组）。
// 码头、古寺、茶馆的玩法以后接上，现在点到先弹介绍。

export interface TownPlaceDef {
    name: string;
    /** 点到时顶栏说的话 */
    intro: string;
    /** 头上挂名字牌（风景点不挂，免得满地牌子） */
    tag: boolean;
}

export const TOWN_PLACES: Record<string, TownPlaceDef> = {
    hiring: { name: '招工处', intro: '广场东边的告示栏就是招工处，点它', tag: true },
    teahouse: { name: '茶馆', intro: '码头边的茶馆，跑船的人歇脚喝茶、打听消息的地方', tag: true },
    dock: { name: '码头', intro: '货船从这里装米、装酒往外运，岸上堆着刚卸的货', tag: true },
    temple: { name: '古寺', intro: '竹林深处的老寺，香火不断，旁边一座五层砖塔', tag: true },
    teahill: { name: '茶山', intro: '镇北的梯田茶园，爬到山顶亭子能看见整个镇子', tag: false },
    lake: { name: '荷花湖', intro: '东南的荷花湖，走九曲桥能到湖心亭', tag: false },
    paddy: { name: '稻田', intro: '镇南大片稻田，小溪上的水车日夜转着', tag: false },
    // 西部牛仔镇（western.places.json）
    livery: { name: '马厩', intro: '主街西头的马厩，赶路的人在这儿寄马、租马', tag: true },
    smithy: { name: '铁匠铺', intro: '打马掌、修车轮的铁匠铺，炉火一整天不灭', tag: true },
    store: { name: '杂货铺', intro: '面粉、咖啡、子弹、铁锹，镇上缺什么都来这儿买', tag: true },
    bank: { name: '银行', intro: '砖砌的银行，矿上淘到的金沙都存在这里的保险柜', tag: true },
    sheriff: { name: '警长办公室', intro: '警长办公室，后屋有两间铁栏牢房，墙上贴着悬赏令', tag: true },
    saloon: { name: '沙龙酒馆', intro: '主街正中的沙龙，弹簧门一推就开，二楼是客房', tag: true },
    waterTower: { name: '水塔', intro: '镇子的水全靠这座木水塔，驿站马车也在这儿加水', tag: false },
    chapel: { name: '小教堂', intro: '镇北坡上的白色小教堂，礼拜天整条街的人都来', tag: true },
    mine: { name: '矿洞', intro: '北边红岩下的老矿洞，镇子就是因为这里出过金子才建起来的', tag: true },
    mesa: { name: '瞭望台', intro: '爬上红岩台地顶，整个镇子和远处的孤丘都看得见', tag: false },
    ranch: { name: '牧场', intro: '镇东的牧场，风车把地下水抽上来，畜栏里养着长角牛', tag: false },
    arroyo: { name: '干河床', intro: '镇南的干河床，平时一滴水没有，夏天雷雨一来就涨成河', tag: false },
};

/** 镇上"逛逛"按钮依次去的地方 */
export const TOWN_TOUR: string[] = ['teahill', 'dock', 'teahouse', 'lake', 'paddy', 'temple', 'hiring'];

/** 各座镇子"逛逛"依次去的地方，按地图名取（Boot 现在还只用 TOWN_TOUR，之后改成从这里按地域取） */
export const TOWN_TOURS: Record<string, string[]> = {
    jiangnan: TOWN_TOUR,
    western: ['mesa', 'mine', 'chapel', 'saloon', 'bank', 'sheriff', 'ranch', 'arroyo', 'hiring'],
};
