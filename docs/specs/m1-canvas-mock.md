# M1 Spec — Canvas Mock（Living Org Canvas）

**状态**：Historical ACCEPT；D019 后不再作为 V2 验收  
**阶段**：M1  
**主责路径**：`apps/canvas/**`（可含 `packages/protocol/**` 初版）  
**禁止**：`services/runtime`、`src-tauri`、`runners/pi`、真 LLM/pi  
**依赖**：M0 ✅  
**审计**：Dev 完成后必须 Audit（见 [13-multi-agent-workflow](../13-multi-agent-workflow.md)）  
**设计真源**：[08](../08-design-language.md) · 协议预览 [10](../10-events-schema.md) · [11](../11-ui-commands.md)

---

## 1. Goal

在浏览器中可演示 **Living Org Canvas**：头像席位、管道信包、冒泡审批、Dossier、单 agent / 四人模板 / ≥1 层套娃。数据以 **前端 mock store** 驱动，不接 Python/Tauri。

## 2. Non-goals

- 真 Runner / pi / CrewAI  
- 多 Workspace 持久化（可做内存切换预留，不强制）  
- SSE 真服务  
- 生产级主题系统完整 token 包  

## 3. Architecture（本阶段）

```text
apps/canvas
  src/
    app/           # 布局、模式 Stage|Work
    canvas/        # xyflow 包装、布局
    nodes/         # SeatNode, GroupNode
    edges/         # PacketEdge
    bubbles/       # 节点锚定冒泡
    dossier/       # 侧抽屉
    store/         # mock org + run 状态
    fixtures/      # single | four | nested
    # 类型从 @ensemble/protocol 导入（packages/protocol）
```

**协议真源锁定**：类型只放 **`packages/protocol`**（T011）。禁止新建 `apps/canvas/src/protocol` 作为第二真源。

## 4. Functional requirements

| ID | 需求 | 优先级 |
|----|------|--------|
| M1-F01 | 深色 HUD 全画布 + 顶栏（Run 名、模式切换） | P0 |
| M1-F02 | Seat 节点：头像位、名、状态环、runner 角标可选 | P0 |
| M1-F03 | Group 节点：区域框、可折叠 | P0 |
| M1-F04 | Edge + packet 动画（flowing 光点/标签） | P0 |
| M1-F05 | Fixture：`single_agent` 仅 1 seat | P0 |
| M1-F06 | Fixture：`four_crew` PM→Res→Eng→Rev + handoff 边 | P0 |
| M1-F07 | Fixture：`nested` Eng 下 ≥1 子 seat；折叠父角标 busy/waiting/error（映射 10§4.1） | P0 |
| M1-F07b | Hover Seat：轻量浮层（goal/action）+ 高亮相关边 | P0 |
| M1-F07c | 双击 Seat/Group：聚焦子画布或 stub 面包屑（可简） | P0 |
| M1-F08 | 单击 Seat → Dossier（Now/History/Outputs/Prompt；Tools/Children defer） | P0 |
| M1-F09 | Prompt 可编辑（仅本地 state，模拟 inject） | P0 |
| M1-F10 | Bubble kind=approve：通过/驳回（本地推进 mock stage） | P0 |
| M1-F11 | 顶栏切换 fixture / 播放 handoff：四人须按 label 链 `brief→research→patch→review` | P0 |
| M1-F12 | Stage vs Work 动效强度差异（可简） | P1 |
| M1-F13 | `prefers-reduced-motion` 降级 | P1 |

## 5. Data / types（最小）

对齐 10 的字段名（即使 mock）：

- `SeatStatus`: idle | planning | working | tooling | waiting_human | waiting_peer | blocked | done | error  
- `OrgNode`: id, kind, name, parent_id, children?, role_template?, runner?  
- `Edge`: id, from, to, kind  
- `Bubble`: bubble_id, seat_id, kind, priority, title, actions  

角标派生：见 10 §4.1。

## 6. Tasks（实现清单）

### T1 — 工程脚手架

- [x] `apps/canvas` Vite + React 18 + TS  
- [x] 依赖：`@xyflow/react`、**zustand**、**tailwindcss v4**、**lucide-react**、packet 可选 **`motion`**  
- [x] 单测：**Vitest** 可装（M1 不强制用例，脚手架须可跑）  
- [x] ESLint + typescript strict  
- [x] `pnpm` workspace 根（若 monorepo）  
- [x] scripts：`dev` / `build` / `lint`  
- [x] README 片段：如何启动 canvas  

### T2 — Protocol 类型

- [x] TS types 覆盖 seat.status / edge / bubble / org node  
- [x] 与 10 命名一致（便于 M2 接线）  

### T3 — Fixtures

- [x] `single.json` / `four.json` / `nested.json`（或 TS 模块）  
- [x] 含 edges + 初始 bubbles 可选  

### T4 — Canvas 核心

- [x] ReactFlow 画布、平移缩放  
- [x] SeatNode / GroupNode 自定义  
- [x] PacketEdge + mock animate packet  
- [x] 布局：单 seat 居中；四人横向/树；nested 可展开  

### T5 — 交互

- [x] 选中 seat → Dossier  
- [x] Hover 浮层 + 边高亮  
- [x] 双击聚焦/面包屑 stub  
- [x] 折叠/展开子树 + 角标（busy=planning|working|tooling 等，见 10§4.1）  
- [x] Bubble 操作更新 store  
- [x] Prompt 编辑写回 seat 本地字段  
- [x] 四人 handoff 播放固定序列标签  

### T6 — 工程卫生

- [x] 无 `any` 泛滥；关键组件可测则测 store 纯函数  
- [x] 构建通过  

## 7. Acceptance

| # | 标准 | 验证 |
|---|------|------|
| A1 | `pnpm --filter canvas build`（或 cd apps/canvas && pnpm build）成功 | 命令 |
| A2 | dev 可开单 agent 视图 | 手动 |
| A3 | 四人模板可见 handoff 播放 | 手动 |
| A4 | nested 折叠后父角标：子 seat tooling 时父 busy≥1 | 手动清单 |
| A5 | Dossier Prompt 可改 | 手动 |
| A6 | approve bubble 可点且状态变化 | 手动 |
| A7 | lint 无 error | 命令 |
| A8 | Hover 有浮层；双击有聚焦或 stub | 手动 |
| A9 | 四人播放出现 brief→research→patch→review 标签顺序 | 手动 |

对应产品：06 验收 A/B「看得见」+ C 套娃子集。

## 8. Engineering standards（M1 强制）

- TypeScript `strict`  
- ESLint 阻断 error  
- 禁止 UI 调用 shell/pi  
- 组件单文件避免无意义膨胀；节点组件与 store 分离  
- 日志若有：flat `tag key=value`  

## 9. Audit focus

- 完成后强制报告：`docs/specs/reviews/M1-canvas-YYYY-MM-DD.md`
- 是否仍是 Org Canvas（非聊天主 UI）  
- 状态枚举与 10 一致  
- fixture 是否可被 M2 替换为 SSE  
- 规范与 build  

## 10. Progress

| 日期 | 状态 | 备注 |
|------|------|------|
| 2026-08-18 | Spec Ready | 待 Dev |
| 2026-08-18 | Spec fix | 审计 A：手势/handoff/角标 |
| 2026-08-18 | **Dev complete (M1 mock)** | build/lint/test green；待 Audit |
| 2026-08-18 | **Audit ACCEPT** | reviews/M1-canvas-2026-08-18.md；刀口已修 |
