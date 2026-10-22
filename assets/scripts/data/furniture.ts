// 屋里的家具。id 就是室内图集 interior.png 里的图名，画法在 tools/art/interior.ts（加家具在两边各加一行）。
// foot 占地（挡路的那块），art 图的大小，都按格；spot 摆在哪见 core/interior 的 FurnitureSpot。
// 前缀 jn_ 江南、w_ 西部，配方（data/interiors.ts）只挑同风格的用。

import { FurnitureDef, FurnitureSpot } from '../core/interior';

const f = (id: string, name: string, foot: [number, number], art: [number, number], spot: FurnitureSpot): FurnitureDef =>
    ({ id, name, foot, art, spot });

const LIST: FurnitureDef[] = [
    // ---------- 江南 ----------
    f('jn_bed', '架子床', [3, 2], [3, 4], 'wall'),
    f('jn_wardrobe', '衣柜', [2, 1], [2, 3], 'wall'),
    f('jn_stove', '灶台', [3, 1], [3, 3], 'wall'),
    f('jn_curio', '博古架', [2, 1], [2, 3], 'wall'),
    f('jn_altar', '供桌', [3, 1], [3, 3], 'wall'),
    f('jn_goods', '杂货架', [3, 1], [3, 3], 'wall'),
    f('jn_cloth_rack', '布匹架', [3, 1], [3, 3], 'wall'),
    f('jn_tea_jars', '茶叶罐架', [2, 1], [2, 3], 'wall'),
    f('jn_rice_bins', '米斗', [3, 1], [3, 2], 'wall'),
    f('jn_tools', '工具墙', [3, 1], [3, 3], 'wall'),
    f('jn_counter', '柜台', [4, 1], [4, 2], 'floor'),
    f('jn_table', '八仙桌', [2, 1], [2, 2], 'floor'),
    f('jn_tea_table', '茶桌', [2, 1], [2, 2], 'floor'),
    f('jn_stool', '方凳', [1, 1], [1, 1], 'floor'),
    f('jn_desk', '书案', [2, 1], [2, 2], 'floor'),
    f('jn_screen', '屏风', [3, 1], [3, 3], 'floor'),
    f('jn_workbench', '木工台', [3, 1], [3, 2], 'floor'),
    f('jn_lumber', '木料', [2, 1], [2, 2], 'corner'),
    f('jn_rice_sacks', '米袋', [2, 1], [2, 2], 'corner'),
    f('jn_bolts', '布匹', [2, 1], [2, 2], 'corner'),
    f('jn_jar', '水缸', [1, 1], [1, 2], 'corner'),
    f('jn_plant', '盆景', [1, 1], [1, 2], 'corner'),
    f('jn_rug', '地毯', [3, 2], [3, 2], 'rug'),
    f('jn_scroll', '字画', [1, 2], [1, 2], 'hang'),
    f('jn_window', '花窗', [2, 2], [2, 2], 'hang'),
    f('jn_lantern', '宫灯', [1, 1], [1, 1], 'hang'),
    // ---------- 西部 ----------
    f('w_bed', '铁架床', [2, 2], [2, 3], 'wall'),
    f('w_dresser', '五斗柜', [2, 1], [2, 2], 'wall'),
    f('w_stove', '铸铁炉', [1, 1], [1, 3], 'wall'),
    f('w_shelf', '货架', [3, 1], [3, 3], 'wall'),
    f('w_bottles', '酒架', [3, 1], [3, 3], 'wall'),
    f('w_piano', '钢琴', [3, 1], [3, 3], 'wall'),
    f('w_safe', '保险柜', [2, 1], [2, 2], 'wall'),
    f('w_cell', '牢房', [3, 1], [3, 3], 'wall'),
    f('w_forge', '炉子', [3, 1], [3, 3], 'wall'),
    f('w_mail', '信格', [3, 1], [3, 3], 'wall'),
    f('w_medicine', '药柜', [2, 1], [2, 3], 'wall'),
    f('w_stall', '马栏', [3, 1], [3, 2], 'wall'),
    f('w_mirror', '镜台', [2, 1], [2, 3], 'wall'),
    f('w_organ', '风琴', [2, 1], [2, 3], 'wall'),
    f('w_bar', '吧台', [5, 1], [5, 2], 'floor'),
    f('w_counter', '柜台', [4, 1], [4, 2], 'floor'),
    f('w_teller', '柜台', [5, 1], [5, 3], 'floor'),
    f('w_table', '方桌', [2, 1], [2, 2], 'floor'),
    f('w_round', '圆桌', [2, 1], [2, 2], 'floor'),
    f('w_chair', '椅子', [1, 1], [1, 2], 'floor'),
    f('w_desk', '书桌', [2, 1], [2, 2], 'floor'),
    f('w_barber', '理发椅', [1, 1], [1, 2], 'floor'),
    f('w_anvil', '铁砧', [2, 1], [2, 1], 'floor'),
    f('w_pew', '长椅', [3, 1], [3, 1], 'floor'),
    f('w_pulpit', '讲台', [2, 1], [2, 2], 'floor'),
    f('w_barrel', '木桶', [1, 1], [1, 2], 'corner'),
    f('w_crate', '木箱', [1, 1], [1, 1], 'corner'),
    f('w_sacks', '麻袋', [2, 1], [2, 2], 'corner'),
    f('w_hay', '干草', [2, 1], [2, 2], 'corner'),
    f('w_cactus', '仙人掌盆', [1, 1], [1, 2], 'corner'),
    f('w_rug', '花毯', [3, 2], [3, 2], 'rug'),
    f('w_window', '窗', [2, 2], [2, 2], 'hang'),
    f('w_antlers', '鹿角', [1, 1], [1, 1], 'hang'),
    f('w_wanted', '告示', [1, 1], [1, 1], 'hang'),
    f('w_lamp', '油灯', [1, 1], [1, 1], 'hang'),
];

export const FURNITURE: Record<string, FurnitureDef> = Object.fromEntries(LIST.map((d) => [d.id, d]));
