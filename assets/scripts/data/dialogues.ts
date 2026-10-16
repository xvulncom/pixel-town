// 一期对话库。按 人设 × 好感度 × 季节 × 天气 × 节气 × 时段 组织，条件越多越优先被选中。
// 后续批量扩写：用 npcs.ts 里的 bio 让大模型按同样的字段生成，人工抽检后追加到这里。

import { DialogueLine } from '../core/defs';

export const DIALOGUES: DialogueLine[] = [
    // ---- 桂姨 ----
    { id: 'gui_001', npcId: 'gui', text: '哎哟，娃儿真回来啦？我还当你妈跟我开玩笑呢。', maxHearts: 1 },
    { id: 'gui_002', npcId: 'gui', text: '镇上年轻人走得差不多了，你回来，我这铺子总算有人说话了。', maxHearts: 2 },
    { id: 'gui_003', npcId: 'gui', text: '缺啥跟桂姨说，种子我这儿都有，给你算便宜点。', maxHearts: 3 },
    { id: 'gui_004', npcId: 'gui', text: '早啊！吃了没？柜台上有刚蒸的馒头，自己拿。', timeOfDay: ['morning'] },
    { id: 'gui_005', npcId: 'gui', text: '这个点还不睡？年轻人熬夜伤身体，我家小满也是，说了也不听。', timeOfDay: ['night'] },
    { id: 'gui_006', npcId: 'gui', text: '下雨天没人来买东西，正好，陪我坐会儿。', weather: ['rain'] },
    { id: 'gui_007', npcId: 'gui', text: '这雪下的，地里的菜别冻坏了，你回去盖一盖。', weather: ['snow'] },
    { id: 'gui_008', npcId: 'gui', text: '开春了，草莓苗我进了一批，红得早的那种，你要不要？', seasons: ['spring'] },
    { id: 'gui_009', npcId: 'gui', text: '热死了热死了，等冷饮柜摆上，我先给自己来一瓶。', seasons: ['summer'] },
    { id: 'gui_010', npcId: 'gui', text: '秋天的葡萄最甜，你种了没？种了记得给桂姨留一串。', seasons: ['autumn'] },
    { id: 'gui_011', npcId: 'gui', text: '快过年了，小满说今年早点回来。也不知道是不是哄我。', seasons: ['winter'] },
    { id: 'gui_012', npcId: 'gui', text: '清明了，回来的人多，铺子里香烛卖得快。你也去看看你爷爷吧。', terms: ['清明'] },
    { id: 'gui_013', npcId: 'gui', text: '冬至吃饺子，晚上来我家，我包了一大盆。', terms: ['冬至'] },
    { id: 'gui_014', npcId: 'gui', text: '你天天来，我倒像多了个闺女……哦不对，多了个娃。', minHearts: 4 },
    { id: 'gui_015', npcId: 'gui', text: '小满昨天视频，我跟她说镇上热闹起来了，她都不信。', minHearts: 3 },
    { id: 'gui_016', npcId: 'gui', text: '老周那个倔老头，你多去看看他，他嘴上不说，心里高兴着呢。', minHearts: 2 },
    { id: 'gui_017', npcId: 'gui', text: '跟你说个事你别往外传啊……算了，你肯定已经知道了。', minHearts: 5 },
    { id: 'gui_018', npcId: 'gui', text: '你把这镇子弄得有模有样的，我跟你说，你爸妈在的话肯定骄傲。', minHearts: 7 },
    { id: 'gui_019', npcId: 'gui', text: '下午这会儿最犯困，你看我眼睛都快睁不开了。', timeOfDay: ['afternoon'] },
    { id: 'gui_020', npcId: 'gui', text: '晚上跟小满视频，她说城里租的房子又涨价了。唉。', timeOfDay: ['evening'], minHearts: 2 },

    // ---- 老周 ----
    { id: 'zhou_001', npcId: 'zhou', text: '……嗯。老林家的娃？长这么高了。', maxHearts: 1 },
    { id: 'zhou_002', npcId: 'zhou', text: '回来干啥，镇上又没出路。', maxHearts: 1 },
    { id: 'zhou_003', npcId: 'zhou', text: '别站着挡光。要坐就坐，那个凳子是我自己打的，结实。', maxHearts: 2 },
    { id: 'zhou_004', npcId: 'zhou', text: '起这么早？年轻人难得。', timeOfDay: ['morning'] },
    { id: 'zhou_005', npcId: 'zhou', text: '下雨天，木头会潮。刨子得擦，不擦就锈。', weather: ['rain'] },
    { id: 'zhou_006', npcId: 'zhou', text: '雪天路滑，你走慢点，摔了没人扶。', weather: ['snow'] },
    { id: 'zhou_007', npcId: 'zhou', text: '春天了，河边的柳条能编筐。你不会？……我教你也行。', seasons: ['spring'], minHearts: 2 },
    { id: 'zhou_008', npcId: 'zhou', text: '这天热得木头都要裂了。', seasons: ['summer'] },
    { id: 'zhou_009', npcId: 'zhou', text: '秋天烤红薯最香。你种了红薯没有？', seasons: ['autumn'] },
    { id: 'zhou_010', npcId: 'zhou', text: '冬天就该在屋里烤火，出来瞎转悠啥。', seasons: ['winter'] },
    { id: 'zhou_011', npcId: 'zhou', text: '霜降了，柿子该摘了。再不摘鸟都吃光了。', terms: ['霜降'] },
    { id: 'zhou_012', npcId: 'zhou', text: '那间木工坊？关了。没人学，开着干啥。', maxHearts: 2 },
    { id: 'zhou_013', npcId: 'zhou', text: '小树那孩子手巧，就是心野。城里装修队，能学到啥。', minHearts: 2 },
    { id: 'zhou_014', npcId: 'zhou', text: '你种的那片地，垄打得歪了。……下次我给你看看。', minHearts: 3 },
    { id: 'zhou_015', npcId: 'zhou', text: '木工坊的屋顶，要是有三十根好木料……算了，说这个干啥。', minHearts: 3 },
    { id: 'zhou_016', npcId: 'zhou', text: '你这孩子，倒是比我想的能吃苦。', minHearts: 5 },
    { id: 'zhou_017', npcId: 'zhou', text: '下午下棋又输了，那老李头肯定偷换了子。', timeOfDay: ['afternoon'] },
    { id: 'zhou_018', npcId: 'zhou', text: '喝一口？不喝也好。你还年轻。', timeOfDay: ['evening'], minHearts: 4 },
    { id: 'zhou_019', npcId: 'zhou', text: '这么晚了还不睡，明天地里的活谁干。', timeOfDay: ['night'] },
    { id: 'zhou_020', npcId: 'zhou', text: '你爷爷当年也是这样，一声不吭，把事干完。', minHearts: 7 },
];
