# M5 Spec — Nested LOD + Cross-Workspace Tray

**状态**：Historical ACCEPT；D019 后不再作为 V2 验收  
**阶段**：M5  
**主责**：`apps/canvas/**`（LOD/托盘）；runtime 仅在需要跨 ws 聚合时最小扩展  
**依赖**：M4 ACCEPT  
**审计**：强制 Audit  
**真源**：[06](../06-mvp.md) · [09](../09-tech-and-desktop.md) · [08](../08-design-language.md)

---

## 1. Goal

- **默认渲染集**：active path + 一层兄弟（折叠子树不挂重型节点）  
- **特效 LOD**：按可见节点数降级 packet 动画  
- **跨 Workspace 待办托盘**：聚合未解决 bubble，点击跳回正确 ws + seat  
- **压测基线**：深套娃 fixture / 生成器；折叠态可平移  

## 2. Non-goals

- Rust layout 加速  
- Electron 回退实现  
- 无限深树全展开满光效  

## 3. LOD 表（钉死自 09）

| 可见节点 | 行为 |
|----------|------|
| ≤ 40 | 满光效 |
| 41–80 | 降 packet 并发 / 简化动画 |
| > 80 | 关流水光，保留状态色 |
| > 200 | UI 提示折叠/进子画布 |

## 4. Functional requirements

| ID | 需求 | 优先级 |
|----|------|--------|
| M5-F01 | `lodLevel(visibleCount)` 纯函数 + 单测 | P0 |
| M5-F02 | PacketEdge 按 lod 降级动画 | P0 |
| M5-F03 | 可见节点 >200 时 TopBar/canvas 提示 | P0 |
| M5-F04 | 折叠子树不进入 flow nodes（已有则回归测） | P0 |
| M5-F05 | 跨 ws 待办托盘：列出 open approve/ask bubbles | P0 |
| M5-F06 | 托盘点击 → 切 workspace + selectSeat | P0 |
| M5-F07 | 深套娃 fixture depth≥4 或生成器 | P1 |
| M5-F08 | 压测文档：200 节点折叠可用说明 | P1 |

## 5. Tasks

- [x] T1 `lib/lod.ts` + tests  
- [x] T2 PacketEdge / OrgCanvas 接线 lod  
- [x] T3 可见节点超限提示  
- [x] T4 TodoTray 组件 + live/mock 数据源  
- [x] T5 深套娃 / stress fixture  
- [x] T6 文档 + 验收 C 勾选  
- [x] T7 Audit 报告  

## 6. Acceptance（脚本 C 强化）

| # | 标准 |
|---|------|
| A1 | nested 折叠父角标仍正确 |
| A2 | lod 阈值单测绿 |
| A3 | >80 可见时 packet 无流水动画类 |
| A4 | 托盘可见未解决 bubble；点击选中 seat |
| A5 | 两 workspace 切换不串状态（回归） |
| A6 | typecheck/build/lint/vitest 绿 |

## 7. Progress

| 日期 | 状态 | 备注 |
|------|------|------|
| 2026-08-18 | Spec created | after M4 ACCEPT |
| 2026-08-18 | Audit ACCEPT | M5-nested-lod-2026-08-18.md |
