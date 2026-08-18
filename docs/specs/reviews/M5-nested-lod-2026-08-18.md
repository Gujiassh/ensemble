# M5 Audit — Nested LOD + Todo tray

**日期**：2026-08-18  
**范围**：`apps/canvas` LOD / layout / TodoTray / deep fixture；protocol `FixtureId`  
**初判**：**ACCEPT**

## 严重
无。

## 中等
无。

## 轻微（接受）
- 跨 Workspace 托盘在 live 模式当前只聚合**当前已加载 ws** 的 open bubbles（切换后刷新）；未做多 ws 并行 SSE 订阅聚合 — MVP 可点跳 seat，多 ws 全量轮询留后续
- 200 节点压力生成器未做；`deep` fixture depth≈5 + LOD 单测覆盖阈值
- reduced motion 与 LOD static 叠加属预期

## 检查表

| 项 | 结果 |
|----|------|
| M5-F01 lodLevel 单测 | pass |
| M5-F02 PacketEdge LOD | pass |
| M5-F03 >200 提示 | pass（banner） |
| M5-F04 折叠不挂子节点 | pass（layout.lod.test） |
| M5-F05/F06 TodoTray | pass |
| M5-F07 deep fixture | pass |
| vitest | **17 passed** |
| typecheck/build/lint | pass |

## 结论：**ACCEPT**

M0–M5 文档 MVP 线完成。后续为产品打磨 / 可选增强，不再默认自动开新里程碑。
