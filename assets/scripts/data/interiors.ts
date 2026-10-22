// 室内配方：每种房子屋里什么样。镇上每扇门在布局里（tools/maps/）指一个配方，自己地盘的建筑在 data/buildings.ts 的 interior 指。
// 同一配方的每栋房子按自己的钥匙排家具、取大小，长得不一样（core/interior 的 layoutInterior）。
// 新房子类型要有室内：这里加一行配方，房子那边指过来。没配的房子点门说"门锁着"。
// floor / wall 是图块名（tools/art/interior.ts 的 TILE_SETS），家具 id 见 data/furniture.ts。

import { InteriorRecipe, KeeperDef } from '../core/interior';

const keeper = (look: string, name: string, ...lines: string[]): KeeperDef => ({ look, name, lines });

const LIST: InteriorRecipe[] = [
    // ---------- 江南 ----------
    {
        id: 'jn_home', name: '人家', style: 'jiangnan', size: { w: [10, 12], h: [9, 10] }, floor: 'jn_wood', wall: 'jn_plaster',
        items: [
            { f: 'jn_bed' }, { f: 'jn_wardrobe', chance: 0.7 }, { f: 'jn_stove' }, { f: 'jn_table' }, { f: 'jn_stool', n: 2 },
            { f: 'jn_jar', chance: 0.8 }, { f: 'jn_plant', chance: 0.6 }, { f: 'jn_rug', chance: 0.5 },
            { f: 'jn_scroll', n: 2, chance: 0.7 }, { f: 'jn_window' },
        ],
    },
    {
        id: 'jn_home_big', name: '人家', style: 'jiangnan', size: { w: [12, 14], h: [10, 11] }, floor: 'jn_wood', wall: 'jn_plaster',
        items: [
            { f: 'jn_bed' }, { f: 'jn_wardrobe' }, { f: 'jn_curio', chance: 0.7 }, { f: 'jn_altar', chance: 0.6 }, { f: 'jn_table' },
            { f: 'jn_stool', n: 3 }, { f: 'jn_screen', chance: 0.6 }, { f: 'jn_desk', chance: 0.6 }, { f: 'jn_jar' },
            { f: 'jn_plant', n: 2 }, { f: 'jn_rug' }, { f: 'jn_scroll', n: 2 }, { f: 'jn_window', n: 2 }, { f: 'jn_lantern', n: 2 },
        ],
    },
    {
        id: 'jn_grocery', name: '杂货铺', style: 'jiangnan', size: { w: [12, 14], h: [10, 11] }, floor: 'jn_brick', wall: 'jn_wood_wall',
        counter: 'jn_counter', shop: 'jn_grocery',
        keeper: { ...keeper('gui', '桂姨', '油盐酱醋、种子小件，要什么自己挑。', '种子都是今年新收的。'), npc: 'gui' },
        items: [
            { f: 'jn_goods', n: 3 }, { f: 'jn_rice_sacks' }, { f: 'jn_jar', n: 2 }, { f: 'jn_plant', chance: 0.5 },
            { f: 'jn_lantern', n: 2 }, { f: 'jn_table', chance: 0.5 }, { f: 'jn_stool', n: 2, chance: 0.5 },
        ],
    },
    {
        id: 'jn_carpenter', name: '木工坊', style: 'jiangnan', size: { w: [12, 14], h: [10, 11] }, floor: 'jn_brick', wall: 'jn_wood_wall',
        counter: 'jn_counter', shop: 'jn_carpenter',
        keeper: { ...keeper('zhou', '老周', '凳子桌子篱笆，都是我闲着打的，要就拿去。', '好木头要阴干三年。'), npc: 'zhou' },
        items: [
            { f: 'jn_tools', n: 2 }, { f: 'jn_workbench', n: 2 }, { f: 'jn_lumber', n: 2 }, { f: 'jn_stool', n: 2 },
            { f: 'jn_jar', chance: 0.5 }, { f: 'jn_window' },
        ],
    },
    {
        id: 'jn_tea', name: '茶馆', style: 'jiangnan', size: { w: [14, 16], h: [11, 12] }, floor: 'jn_wood', wall: 'jn_plaster',
        counter: 'jn_counter', shop: 'jn_tea',
        keeper: keeper('auntie', '茶馆老板娘', '新到的明前龙井，带一包回去？', '坐下歇歇脚。', '桂花糕是早上现蒸的。'),
        items: [
            { f: 'jn_tea_jars', n: 2 }, { f: 'jn_curio' }, { f: 'jn_tea_table', n: 4 }, { f: 'jn_stool', n: 6 }, { f: 'jn_plant', n: 2 },
            { f: 'jn_screen', chance: 0.5 }, { f: 'jn_scroll', n: 3 }, { f: 'jn_lantern', n: 3 },
        ],
    },
    {
        id: 'jn_cloth', name: '布庄', style: 'jiangnan', size: { w: [11, 13], h: [10, 11] }, floor: 'jn_wood', wall: 'jn_wood_wall',
        counter: 'jn_counter', shop: 'jn_cloth',
        keeper: keeper('girl', '沈掌柜', '蓝印花布是镇上自己染的。', '手帕送人最体面。', '摸摸看，这料子多软。'),
        items: [
            { f: 'jn_cloth_rack', n: 3 }, { f: 'jn_bolts', n: 2 }, { f: 'jn_table' }, { f: 'jn_plant', chance: 0.6 },
            { f: 'jn_screen', chance: 0.5 }, { f: 'jn_lantern', n: 2 },
        ],
    },
    {
        id: 'jn_rice', name: '米铺', style: 'jiangnan', size: { w: [11, 13], h: [10, 11] }, floor: 'jn_brick', wall: 'jn_wood_wall',
        counter: 'jn_counter', shop: 'jn_rice',
        keeper: keeper('grandpa', '米铺陈老板', '新米到了，糯米也有。', '稻种要不要？今年收成好。', '年糕过年吃，平时也香。'),
        items: [
            { f: 'jn_rice_bins', n: 2 }, { f: 'jn_rice_sacks', n: 3 }, { f: 'jn_jar', n: 2 }, { f: 'jn_window' },
        ],
    },
    // ---------- 西部 ----------
    {
        id: 'w_cabin', name: '小木屋', style: 'western', size: { w: [9, 11], h: [8, 9] }, floor: 'w_planks', wall: 'w_log',
        items: [
            { f: 'w_bed' }, { f: 'w_stove' }, { f: 'w_dresser', chance: 0.6 }, { f: 'w_table' }, { f: 'w_chair', n: 2 },
            { f: 'w_barrel', chance: 0.6 }, { f: 'w_rug', chance: 0.6 }, { f: 'w_window' }, { f: 'w_antlers', chance: 0.5 },
        ],
    },
    {
        id: 'w_saloon', name: '酒馆', style: 'western', size: { w: [15, 17], h: [11, 12] }, floor: 'w_planks', wall: 'w_paper_red',
        counter: 'w_bar', shop: 'w_saloon',
        keeper: keeper('bartender', '酒保', '沙士汽水管够，酒就算了，你还要干活。', '牛肉干配汽水，绝了。', '镇上的事，问我就对了。'),
        items: [
            { f: 'w_bottles', n: 2 }, { f: 'w_piano' }, { f: 'w_round', n: 3 }, { f: 'w_chair', n: 6 }, { f: 'w_barrel', n: 2 },
            { f: 'w_lamp', n: 3 }, { f: 'w_wanted' }, { f: 'w_antlers' },
        ],
    },
    {
        id: 'w_hotel', name: '旅馆', style: 'western', size: { w: [13, 15], h: [10, 11] }, floor: 'w_planks', wall: 'w_paper_green',
        counter: 'w_counter', shop: 'w_hotel',
        keeper: keeper('cowgirl', '旅馆老板娘', '楼上客满了，楼下坐坐。', '苹果派是我妈的方子。', '远道来的？'),
        items: [
            { f: 'w_dresser' }, { f: 'w_mirror' }, { f: 'w_table', n: 2 }, { f: 'w_chair', n: 4 }, { f: 'w_cactus', n: 2 },
            { f: 'w_rug' }, { f: 'w_lamp', n: 2 }, { f: 'w_window' },
        ],
    },
    {
        id: 'w_store', name: '杂货店', style: 'western', size: { w: [13, 15], h: [10, 11] }, floor: 'w_planks', wall: 'w_planks',
        counter: 'w_counter', shop: 'w_general',
        keeper: keeper('lady', '杂货店太太', '种子、钉子、糖，什么都有一点。', '这里的地干，种辣椒最好。', '下回进货多给你留点。'),
        items: [
            { f: 'w_shelf', n: 3 }, { f: 'w_sacks', n: 2 }, { f: 'w_barrel', n: 2 }, { f: 'w_crate', n: 2 }, { f: 'w_lamp', n: 2 },
        ],
    },
    {
        id: 'w_feed', name: '饲料店', style: 'western', size: { w: [13, 15], h: [10, 11] }, floor: 'w_planks', wall: 'w_barn',
        counter: 'w_counter', shop: 'w_feed',
        keeper: keeper('rancher', '饲料店老板', '鸡舍鸭棚都能订，拉回去就能用。', '玉米种子耐旱。', '牲口吃饱了才肯干活。'),
        items: [{ f: 'w_hay', n: 2 }, { f: 'w_sacks', n: 3 }, { f: 'w_shelf' }, { f: 'w_barrel', n: 2 }, { f: 'w_crate', n: 2 }],
    },
    {
        id: 'w_bank', name: '银行', style: 'western', size: { w: [13, 15], h: [10, 11] }, floor: 'w_planks', wall: 'w_brick',
        counter: 'w_teller',
        keeper: keeper('cowboy', '银行柜员', '存钱？这镇子还没人信得过银行。', '保险柜里是镇上的工钱。', '有金子先去化验所看成色。'),
        items: [{ f: 'w_safe', n: 2 }, { f: 'w_desk' }, { f: 'w_chair', n: 2 }, { f: 'w_cactus' }, { f: 'w_lamp', n: 2 }, { f: 'w_window' }],
    },
    {
        id: 'w_sheriff', name: '警长办公室', style: 'western', size: { w: [11, 13], h: [9, 10] }, floor: 'w_planks', wall: 'w_planks',
        items: [
            { f: 'w_cell', n: 2 }, { f: 'w_desk' }, { f: 'w_chair', n: 2 }, { f: 'w_stove' }, { f: 'w_wanted', n: 3 }, { f: 'w_lamp' },
        ],
    },
    {
        id: 'w_barber', name: '理发店', style: 'western', size: { w: [10, 12], h: [9, 10] }, floor: 'w_planks', wall: 'w_paper_green',
        items: [{ f: 'w_mirror', n: 2 }, { f: 'w_barber', n: 2 }, { f: 'w_chair', n: 2 }, { f: 'w_cactus' }, { f: 'w_lamp', n: 2 }],
    },
    {
        id: 'w_post', name: '邮局', style: 'western', size: { w: [10, 12], h: [9, 10] }, floor: 'w_planks', wall: 'w_planks',
        counter: 'w_counter', shop: 'w_post',
        keeper: keeper('prospector', '邮差', '明信片寄回老家，三天就到。', '驿站的车一周来两趟。', '有你的信？我看看……没有。'),
        items: [{ f: 'w_mail', n: 2 }, { f: 'w_sacks' }, { f: 'w_crate', n: 2 }, { f: 'w_wanted' }, { f: 'w_lamp' }],
    },
    {
        id: 'w_assay', name: '化验所', style: 'western', size: { w: [10, 12], h: [9, 10] }, floor: 'w_planks', wall: 'w_planks',
        counter: 'w_counter', shop: 'w_assay',
        keeper: keeper('prospector', '化验师', '金子成色我一眼就看得出来。', '小金块送人，那可是大礼。', '矿洞里还有没有金子，谁知道呢。'),
        items: [{ f: 'w_shelf' }, { f: 'w_safe' }, { f: 'w_desk' }, { f: 'w_crate', n: 2 }, { f: 'w_lamp', n: 2 }],
    },
    {
        id: 'w_cafe', name: '咖啡馆', style: 'western', size: { w: [11, 13], h: [9, 10] }, floor: 'w_planks', wall: 'w_paper_red',
        counter: 'w_counter', shop: 'w_cafe',
        keeper: keeper('cowgirl', '咖啡馆老板娘', '咖啡刚煮好。', '苹果派要趁热。', '牛仔们早上都来这里。'),
        items: [{ f: 'w_stove' }, { f: 'w_shelf' }, { f: 'w_table', n: 3 }, { f: 'w_chair', n: 5 }, { f: 'w_cactus' }, { f: 'w_window' }],
    },
    {
        id: 'w_doctor', name: '诊所', style: 'western', size: { w: [10, 12], h: [9, 10] }, floor: 'w_planks', wall: 'w_paper_green',
        counter: 'w_counter', shop: 'w_doctor',
        keeper: keeper('lady', '医生', '草药茶，治不了大病，但喝着舒服。', '晒多了太阳要喝水。', '有哪儿不舒服？'),
        items: [{ f: 'w_medicine', n: 2 }, { f: 'w_bed' }, { f: 'w_chair' }, { f: 'w_lamp' }, { f: 'w_window' }],
    },
    {
        id: 'w_stage', name: '驿站', style: 'western', size: { w: [13, 15], h: [10, 11] }, floor: 'w_planks', wall: 'w_planks',
        counter: 'w_counter', shop: 'w_stage',
        keeper: keeper('cowboy', '驿站站长', '去城里的车明早出发。', '路上风沙大，带块头巾。', '柴火便宜卖了。'),
        items: [{ f: 'w_mail' }, { f: 'w_pew', n: 2 }, { f: 'w_crate', n: 3 }, { f: 'w_sacks' }, { f: 'w_wanted', n: 2 }, { f: 'w_lamp' }],
    },
    {
        id: 'w_smithy', name: '铁匠铺', style: 'western', size: { w: [12, 14], h: [9, 10] }, floor: 'w_dirt', wall: 'w_barn',
        counter: 'w_counter', shop: 'w_smithy',
        keeper: keeper('smith', '铁匠', '马蹄铁挂门上，保平安。', '石灯、井栏我都能打。', '小心，炉子烫。'),
        items: [{ f: 'w_forge' }, { f: 'w_anvil', n: 2 }, { f: 'w_barrel', n: 2 }, { f: 'w_crate', n: 2 }],
    },
    {
        id: 'w_livery', name: '马厩', style: 'western', size: { w: [14, 16], h: [10, 11] }, floor: 'w_dirt', wall: 'w_barn',
        items: [{ f: 'w_stall', n: 3 }, { f: 'w_hay', n: 3 }, { f: 'w_barrel', n: 2 }, { f: 'w_sacks' }, { f: 'w_lamp', n: 2 }],
    },
    {
        id: 'w_chapel', name: '小教堂', style: 'western', size: { w: [11, 13], h: [12, 13] }, floor: 'w_planks', wall: 'w_planks',
        items: [{ f: 'w_organ' }, { f: 'w_pulpit' }, { f: 'w_pew', n: 6 }, { f: 'w_window', n: 2 }, { f: 'w_lamp', n: 2 }],
    },
];

export const INTERIORS: Record<string, InteriorRecipe> = Object.fromEntries(LIST.map((d) => [d.id, d]));

/** 自己地盘上的房子用的配方：同镇上的样子，只是没有掌柜、不卖东西（自己家）。 */
function own(base: string, id: string, name: string): InteriorRecipe {
    const { keeper: _k, shop: _s, ...rest } = INTERIORS[base];
    return { ...rest, id, name };
}

for (const r of [own('jn_home', 'v_home', '我家'), own('jn_home_big', 'v_home_big', '我家'), own('jn_carpenter', 'v_workshop', '木工坊'),
    own('jn_grocery', 'v_shop', '杂货铺')]) INTERIORS[r.id] = r;
