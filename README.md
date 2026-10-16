# 像素小镇

2D 像素风小镇经营养成微信小游戏。方案和进度在 Seafile `~/My Library/个人提升/像素小镇/`。

## 目录

| 路径 | 内容 |
|---|---|
| `assets/scripts/core/` | 与引擎无关的核心逻辑：节气日历、地域、天气、地块、镇民好感与对话、镇民打工、心愿、时间推进与离线结算、存档。不 import `cc`，用 node 直接测试 |
| `assets/scripts/data/` | 内容数据：作物、地域（老家）、镇民人设、对话库、心愿 |
| `tests/` | 核心逻辑测试 |

Cocos Creator 工程文件（场景、渲染脚本、`settings/` 等）在装好 Cocos 后合并进来，渲染层只调用 `core/` 的函数。

## 命令

```bash
npm install
npm test
npm run typecheck
```

## 约定

- 游戏时间跟现实走，按北京时间切日；离线结算和在线推进都走 `core/simulate.ts`。
- 随机数全部用 `core/rng.ts` 的可复现随机，测试结果稳定。
- 镇民对话、计划、记忆只通过 `DialogueProvider`、`PlanProvider`、`NpcMemory` 接入，二期换大模型只换实现。
- AppSecret 等凭据不进仓库。
