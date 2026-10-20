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
};

/** 镇上"逛逛"按钮依次去的地方 */
export const TOWN_TOUR: string[] = ['teahill', 'dock', 'teahouse', 'lake', 'paddy', 'temple', 'hiring'];
