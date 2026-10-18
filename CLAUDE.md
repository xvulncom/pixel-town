# pixel-town

方案、进度和完整约束在 Seafile `~/My Library/个人提升/像素小镇/`（`CLAUDE.md`、`HANDOFF.md`、`方案.md`），本仓库只放代码。

## 持续迭代

这个游戏会一直改进，任何新增都按"以后还会改、还会加"来做：

- 内容（作物、地域、镇民、对话、心愿、地图）放 `assets/scripts/data/` 或生成脚本，加新内容不改逻辑代码。
- 美术统一由 `tools/gen-map.ts` 或素材包产出，换图不改游戏代码。
- 存档带 `version`，新字段必须有默认值并写迁移，老存档不能坏。
- 新系统先定接口再实现，本地实现和后端实现可替换（参照 NPC 的 `DialogueProvider`、`PlanProvider`、`NpcMemory`）。
- 不写一次性硬编码；临时写死的地方注释写明之后从哪里读。
- 每次新增都补测试，`npm test` 保持全绿。

## 尺寸规范（照星露谷）

图块 16px；人物 1×2 格；树 3×5；民居 6×5、店铺 7×6；作物 1×2。地图图层：`ground` 地面、`deco` 物体底部（挡路）、`over` 物体上半部分（盖住人物）。

## 命令

- 测试 `npm test`，类型检查 `npm run typecheck`。
- 生成图块和地图 `npx tsx tools/gen-map.ts [--preview <目录>]`。图块画法在 `tools/art/`，新图块到 `tools/art/tileset.ts` 登记；地图摆放在 `tools/maps/`（`builder.ts` 通用，每个地域一个布局文件）。产物：`town-tiles.png`、`people.png`、`people-frames.json`、`<地域>.tmx`、`<地域>.walkers.json`、`buildings.png`、`buildings-frames.json`、`terrain.json`。`--preview` 另出整图、四张手机视角图和开局村庄图。
- 自己地盘加新建筑：`assets/scripts/data/buildings.ts` 加一行，`tools/art/objects.ts` 登记同名的图，跑一遍 gen-map；`npm test` 会查每种建筑都有图。新作物除了 `data/crops.ts`，还要在 `tools/art/crops.ts` 的 `LOOKS` 选个成熟样子。
- 构建 `powershell -NoProfile -ExecutionPolicy Bypass -File tools/cocos-build.ps1 -Config tools/build-wechatgame.json`（网页版换 `build-web-mobile.json`）。
