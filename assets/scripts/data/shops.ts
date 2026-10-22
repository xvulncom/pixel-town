// 镇上各店卖什么。店挂在室内配方上（data/interiors.ts 的 shop），点掌柜打开。
// seeds: true 卖店所在镇子的当季种子；goods 里 build:<建筑> 是回村免费摆一件，gift:<礼物> 是送人的。加货加一行。

import { ShopDef } from '../core/shop';

const LIST: ShopDef[] = [
    // ---------- 江南 ----------
    {
        id: 'jn_grocery', name: '杂货铺', seeds: true,
        goods: [{ item: 'build:jar' }, { item: 'build:pot' }, { item: 'build:lantern' }, { item: 'gift:candy' }],
    },
    {
        id: 'jn_carpenter', name: '木工坊',
        goods: [
            { item: 'build:bench' }, { item: 'build:tea_table' }, { item: 'build:fence' }, { item: 'build:woodpile' },
            { item: 'build:laundry' }, { item: 'build:bridge' }, { item: 'build:beehive' }, { item: 'gift:wood_comb' },
        ],
    },
    { id: 'jn_tea', name: '茶馆', goods: [{ item: 'gift:longjing' }, { item: 'gift:osmanthus_cake' }, { item: 'build:tea_table' }] },
    { id: 'jn_cloth', name: '布庄', goods: [{ item: 'gift:silk_hanky' }, { item: 'gift:indigo_cloth' }, { item: 'build:stall_cloth' }] },
    {
        id: 'jn_rice', name: '米铺', seeds: true,
        goods: [{ item: 'gift:glutinous_rice' }, { item: 'gift:rice_cake' }, { item: 'build:haystack' }, { item: 'build:scarecrow' }],
    },
    // ---------- 西部 ----------
    {
        id: 'w_general', name: '杂货店', seeds: true,
        goods: [{ item: 'build:jar' }, { item: 'build:lantern' }, { item: 'build:fence' }, { item: 'gift:jerky' }, { item: 'gift:candy' }],
    },
    {
        id: 'w_feed', name: '饲料店', seeds: true,
        goods: [{ item: 'build:haystack' }, { item: 'build:coop' }, { item: 'build:duck_shed' }, { item: 'build:scarecrow' }],
    },
    { id: 'w_saloon', name: '酒馆', goods: [{ item: 'gift:root_beer' }, { item: 'gift:jerky' }] },
    { id: 'w_cafe', name: '咖啡馆', goods: [{ item: 'gift:coffee' }, { item: 'gift:apple_pie' }] },
    { id: 'w_smithy', name: '铁匠铺', goods: [{ item: 'gift:horseshoe' }, { item: 'build:stone_lamp' }, { item: 'build:well' }] },
    { id: 'w_post', name: '邮局', goods: [{ item: 'gift:postcard' }] },
    { id: 'w_assay', name: '化验所', goods: [{ item: 'gift:gold_nugget' }] },
    { id: 'w_doctor', name: '诊所', goods: [{ item: 'gift:herb_tea' }] },
    { id: 'w_hotel', name: '旅馆', goods: [{ item: 'gift:apple_pie' }, { item: 'build:bench' }] },
    { id: 'w_stage', name: '驿站', goods: [{ item: 'gift:postcard' }, { item: 'build:woodpile' }] },
];

export const SHOPS: Record<string, ShopDef> = Object.fromEntries(LIST.map((d) => [d.id, d]));
