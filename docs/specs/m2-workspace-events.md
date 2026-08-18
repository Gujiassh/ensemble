# M2 Spec — Workspace + Event Bus

**状态**：Historical ACCEPT；D019 后不再作为 V2 验收  
**阶段**：M2  
**可并行**：M1 ACCEPT 后可与 Canvas 接线 lane / Runtime lane 并行（见 13）  
**路径所有权**：  
- Runtime：`services/runtime/**`  
- Canvas 接线：`apps/canvas/src/**`（api client、workspace UI）  
- Protocol：共享类型；语义变更需 Main  

**依赖**：M1 ACCEPT  
**审计**：Runtime lane 与 Canvas lane **各一次** Audit；合并后 **强制** 集成总审计  
**真源**：[10](../10-events-schema.md) · [11](../11-ui-commands.md) · [09](../09-tech-and-desktop.md)

---

## 1. Goal

- 多 **Workspace** 切换且状态隔离  
- **Group** 框与过滤  
- UI 由 **SSE 规范化事件** 驱动（可先假 Runtime 推真实 shape 的事件）  
- 接通最小 **命令面**（run.start / bubble.act）

## 2. Non-goals

- 真 pi / Crew 满编排  
- tree 长期持久化完善（可写临时 JSON，完整契约在 M3）  
- 打回产物 v2（**M3**）  
- Tauri  
- LOD 极限压测  

## 3. Architecture

```text
apps/canvas
  → GET /workspaces/:id/org          快照
  → GET /workspaces/:id/events SSE   事件 10
  → POST .../runs | bubbles/act      命令 11

services/runtime
  → **FastAPI** + uvicorn + sse-starlette（HTTP + SSE；非 WS）
  → 内存或 data/workspaces 简易存储
  → mock 事件发射器（播放 handoff）
```

## 4. Functional requirements

| ID | 需求 | 优先级 |
|----|------|--------|
| M2-F01 | 至少 2 个 workspace 可切换 | P0 |
| M2-F02 | 切换后 org/run 不串 | P0 |
| M2-F03 | `GET .../org` 返回 tree+edges（09 形状） | P0 |
| M2-F04 | SSE 推送 `seat.status` / `edge.packet` / `bubble.*` | P0 |
| M2-F05 | 每事件含 `workspace_id` | P0 |
| M2-F06 | Canvas 去掉纯 setInterval 假驱动（或降为 fallback） | P0 |
| M2-F07 | `POST /workspaces/{ws}/runs` 开始 mock 播放（body 对齐 11：`client_op_id`,`template`） | P0 |
| M2-F08 | `POST /workspaces/{ws}/runs/{run}/bubbles/{id}/act` → `bubble.resolve`（对齐 11） | P0 |
| M2-F09 | **≥2 Group 可区分并过滤**（06 验收 C） | P0 |
| M2-F10 | 全局待办托盘列出 P0 bubble | P1（可简，不可阻塞 M2 ACCEPT） |
| M2-F11 | SSE 事件含信封 `type,workspace_id,ts`（建议 `event_id`）；可含 `run.stage` | P0 |
| M2-F12 | 连接顺序：org 快照 → SSE → 命令；禁止 `edge.packet.phase=idle` | P0 |

## 5. Tasks

### Runtime lane（只写 `services/runtime/**`）

- [x] T1 项目 `services/runtime`（Python 3.11+，**FastAPI 锁定** T017；依赖在该目录 pyproject）  
- [x] T2 Workspace registry 内存/文件  
- [x] T3 `GET /workspaces/{id}/org` 快照（tree+edges）  
- [x] T4 SSE `GET /workspaces/{id}/events`；推送 seat.status / edge.packet / bubble.* / run.stage  
- [x] T5 命令对齐 11：`POST .../runs`、`POST .../bubbles/{id}/act`（`client_op_id`）  
- [x] T6 单元测试：信封 type/workspace_id/ts；workspace 隔离；phase 无 idle  

### Canvas lane（只写 `apps/canvas/**`，优先 `src/api|store|workspace|canvas`）

- [x] T7 API client + SSE 解析（apply 事件到 store）  
- [x] T8 store：「快照 + 事件 apply」；去掉主路径 setInterval 假驱动  
- [x] T9 Workspace 切换 UI  
- [x] T10 **≥2 Group 过滤**  
- [x] T11 命令按钮对接 11 路径  

### Main 集成（只写根脚本 / fixtures / protocol 语义）

- [x] T12 一键 dev 脚本（根 `scripts/dev.sh` 或 package.json）— **仅 Main**  
- [x] T13 契约样例 JSON → `docs/specs/fixtures/` — **仅 Main**  
- [x] T14 集成总审计报告 `docs/specs/reviews/M2-integration-*.md` — **强制**  

## 6. Acceptance

| # | 标准 |
|---|------|
| A1 | 两 workspace 切换数据不串 |
| A2 | `POST /workspaces/{ws}/runs` 后出现 `run.stage` + seat/packet 动画 |
| A3 | `POST .../bubbles/{id}/act` 后 `bubble.resolve`，bubble 关闭 |
| A4 | ≥2 Group 可过滤 |
| A5 | runtime 测试通过；canvas build 通过 |
| A6 | 事件 assert：每条含 type/workspace_id/ts；packet.phase ∈ ready|flowing|delivered|rejected |
| A7 | 双 lane 各有 reviews 报告 + 集成总审计报告 |

## 7. Audit focus

- 事件是否只走 10，无私货字段当主路径  
- 命令是否与 11 对齐  
- 双 lane 是否越权改对方目录  
- 无密钥提交  

## 8. Progress

| 日期 | 状态 | 备注 |
|------|------|------|
| 2026-08-18 | Spec Ready | 门禁：完整 M1 ACCEPT 后开工 |
| 2026-08-18 | Spec fix | 审计 A/C：11 路径、Group P0、总审计强制 |
| 2026-08-18 | **Dev + Audit ACCEPT** | runtime+canvas-wire+integration reviews |
