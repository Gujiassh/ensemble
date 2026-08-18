# [归档] 技术选型与桌面壳

**状态**：M0–M5 历史选型，已被 D019 解除锁定  
**产品**：Ensemble  
**说明**：本文件记录 M0–M5 的历史选型，不再约束 V2。当前架构见 [specs/m6-architecture.md](specs/m6-architecture.md)，Runner 见 [specs/m6-runner-adapter.md](specs/m6-runner-adapter.md)，平台 Spike 见 [specs/m6-platform-packaging.md](specs/m6-platform-packaging.md)。

---

## 1. 选型结论（已锁定）

| 层 | **锁定** | 说明 |
|----|----------|------|
| **桌面壳** | **Tauri 2（Rust）** | 窗口、权限、FS、托盘、sidecar、调用本地进程 |
| **主 UI** | **Web：React 18 + TypeScript + Vite 6**（MVP 不升 19） | Living Org Canvas 主战场 |
| **节点图** | **@xyflow/react**（React Flow） | Seat/Group 自定义节点、Packet 边、冒泡锚点 |
| **动效** | **CSS 优先** + **`motion`**（仅 packet/边） | 状态环 CSS；`prefers-reduced-motion` 必降级 |
| **纯 Rust GUI** | **不做主界面** | egui/iced/Slint 不承载 Org Canvas |
| **Electron** | **仅回退** | Linux WebView 大图不可用时再评估 |
| **编排 Runtime** | **Python 3.11+** | 可由 Tauri 拉起子进程 / sidecar |
| **AI 编排框架** | **CrewAI**（锁定） | `Agent` / `Task` / `Crew`；process=`sequential`\|`hierarchical`；Org→Crew **只读投影** |
| **执行** | Runner 适配层，默认 **pi** | 多 CLI 协议 |
| **实时** | **SSE** 推送规范化事件 | 见 10-events-schema |
| **本地存储** | **文件系统** `workspaces/*/…` | tree/runs/artifacts；**SQLite MVP 不做** |

**一句话栈**：

```text
Tauri 2 (Rust shell)
  └── React + TS + Vite + @xyflow/react  (Living Org Canvas)
        └── SSE/HTTP → Python Runtime
              ├── CrewAI（多角色编排框架，锁定）
              └── Runners (pi, mock, …)
```

**核心理由**：设计语言依赖节点图、光效、冒泡、抽屉、diff——Web 最强；壳要轻、要管进程/文件——**Tauri/Rust** 优于 Electron；纯 Rust UI 做 OA 级交互成本过高。

---

## 2. 为何是 Tauri + Rust（壳），不是纯 Rust UI / Electron

| 维度 | **Tauri 2 + Rust** | Electron | 纯 Rust GUI |
|------|--------------------|----------|-------------|
| Living Org Canvas | Web 层轻松实现 | 同左，更重 | 很难 |
| 包体积 / 内存 / 启动 | **优** | 差 | 最好但 UI 生态弱 |
| 调 pi / 子进程 / FS | **Rust 命令与 sidecar 干净** | Node 熟 | 可以 |
| 跨平台渲染 | 系统 WebView（Linux 需测） | Chromium 最稳 | 自绘 |
| 结论 | **主推并锁定** | 回退 | **排除主 UI** |

### 2.1 Electron 回退条件（非默认）

- 目标 Linux 上 WebKitGTK 对大图不可接受  
- 必须像素级一致且不愿测多 WebView  

回退检查点：M1/M5 大图压测（见 §5）。

### 2.2 Rust 在本项目中的职责边界

| Rust（Tauri）做 | Rust 不做 |
|-----------------|-----------|
| 窗口 / 安全权限 / 打开目录 | 主界面业务组件 |
| 拉起/监督 Python runtime、pi | CrewAI 剧本本身 |
| 可选：大树 layout 计算命令 | 替换 xyflow 画布 |
| 自动更新 / 托盘 | — |

前端业务与画布交互 **100% 在 React**；Rust 是壳与系统边界。

---

## 3. 逻辑架构

```text
┌──────────────────────────────────────────┐
│  Shell: Tauri 2 (Rust)                    │
│  窗口 / 权限 / 托盘 / 更新 / 进程管理       │
└───────────────────┬──────────────────────┘
                    │ IPC (invoke / events)
┌───────────────────▼──────────────────────┐
│  Web UI (React + @xyflow/react)           │
│  Living Org Canvas · Dossier · 待办托盘    │
│  Workspace · Group/套娃 · Stage/Work/Debug │
└───────────────────┬──────────────────────┘
                    │ HTTP + SSE (localhost)
┌───────────────────▼──────────────────────┐
│  Ensemble Runtime (Python)                │
│  · Workspace registry                     │
│  · Org tree SSoT（无限层级）               │
│  · Orchestrator + **CrewAI 投影**（锁定）  │
│  · Staffing · Event bus · Run store       │
└───────────────────┬──────────────────────┘
                    │ RunnerJob
┌───────────────────▼──────────────────────┐
│  Runners: pi / mock / (claude|codex|…)    │
└──────────────────────────────────────────┘
```

建议仓库形态：

```text
ensemble/
  apps/canvas/          # React + Vite + xyflow
  src-tauri/            # Tauri 2 / Rust
  services/runtime/     # Python orchestrator
  runners/              # pi adapter 等
  docs/
```

---

## 4. 数据模型（套娃 / 多区 / 多组 / 单 agent）

### 4.1 目录布局（T020）

| 环境 | 根路径 |
|------|--------|
| **dev 默认** | 仓库内 `data/`（gitignore） |
| **prod / 桌面** | `~/.ensemble/` |
| **覆盖** | 环境变量 `ENSEMBLE_DATA_DIR` 优先 |

```text
<data_root>/
  workspaces/
    <workspace_id>/
      workspace.json
      org/tree.json
      runs/<run_id>/
        state.json
        timeline.jsonl
        roster.json
        artifacts/
        sessions/
  app.json
```

### 4.2 `tree.json` 全形（钉死）

```json
{
  "root": {
    "id": "group_default",
    "kind": "group",
    "name": "Default",
    "parent_id": null,
    "children": [
      {
        "id": "seat_eng",
        "kind": "seat",
        "name": "Engineer",
        "parent_id": "group_default",
        "role_template": "engineer",
        "runner": "pi",
        "tags": [],
        "children": [
          {
            "id": "seat_eng_test",
            "kind": "seat",
            "name": "Sub-Test",
            "parent_id": "seat_eng",
            "role_template": "qa",
            "runner": null,
            "children": []
          }
        ]
      }
    ]
  },
  "edges": [
    { "id": "e_eng_test", "from": "seat_eng", "to": "seat_eng_test", "kind": "delegate" }
  ]
}
```

规则：

- **节点权威**：`root` 下 `children` 嵌套；`parent_id` 冗余校验  
- **边权威**：顶层 `edges[]`（`id/from/to/kind`），允许跨层；**不**只靠 packet 建边  
- `kind`: `group | seat`；**无 max depth**  
- 单 agent = `root.children` 仅一个 seat（可无 group 框，或单 Default group 对用户隐藏）  
- MVP：**单主 parent 树**；`tags` 可选；多主 `group_ids` 后置  
- 增量：`org.node.upsert` 单节点；整树用 `org.tree.replace`；边用 `org.edge.upsert`  

### 4.3 事件

完整 schema 见 **[10-events-schema.md](10-events-schema.md)**。  
摘要：`seat.status` / `edge.packet` / `bubble.*` / `org.node.*` / `staffing.*`；每条必带 `workspace_id`。

### 4.4 三层所有权

| 数据 | 职责 |
|------|------|
| Org tree | 编制 **SSoT** |
| Roster | 本 Run 变更 **账本**（须含 parent 挂载） |
| Crew | **只读投影**，禁止写回组织 |

Staffing：`tree upsert → roster append → events`。

---

## 5. 无限套娃性能策略

| 策略 | 说明 |
|------|------|
| 默认渲染集 | **active path + 一层兄弟** |
| 子画布聚焦 | 双击进入子图（主性能路径） |
| 侧栏虚拟列表 | 编制树与画布展开集联动 |
| 特效 LOD | 见阈值 |
| 布局异步 | Web Worker；可选 Tauri/Rust 算 layout |
| 监控 | `visible_node_count` / `fps` / `layout_ms` / `depth` |

**LOD（指导）**

| 可见节点 | 行为 |
|----------|------|
| ≤ 40 | 满光效 |
| 41–80 | 降 packet 并发 |
| > 80 | 关流水光，保留状态色 |
| > 200 | 提示折叠/进子画布 |

---

## 6. 前端实现锁定

| 项 | 锁定 |
|----|------|
| 语言 | **TypeScript**（strict） |
| 框架 | **React 18**（MVP 不升 19） |
| 构建 | **Vite 6** |
| 包管理 | **pnpm 9**；Node **≥20** |
| 图库 | **@xyflow/react** v12 |
| 客户端状态 | **zustand**（唯一；禁并行第二状态库） |
| 协议类型 | **`packages/protocol`**（唯一 TS 真源；禁止 `apps/canvas/src/protocol` 长期双源） |
| 样式 | **Tailwind CSS v4** + CSS 变量 HUD token；深色指挥室 |
| 动效 | CSS 优先；**`motion`** 仅限 packet/边 |
| 图标 | **lucide-react** |
| 字体 MVP | 系统栈 `ui-sans-serif` / `ui-monospace` |
| 状态源 | 服务端事件为源（M2+）+ 本地 org store（zustand） |
| 自定义节点 | `SeatNode` · `GroupNode` · `PacketEdge` |
| 前端单测 | **Vitest**（M2 apply 事件强制；M1 可选） |

**不再开放**：Vue / Vue Flow；Emotion 默认；Redux/Jotai 与 zustand 并行主线。  
**全表真源**：[ssot/stack.md](ssot/stack.md)

---

## 7. 运行时与执行

| 组件 | 锁定 |
|------|------|
| **AI 框架** | **CrewAI**（`crewai` 包；Agent/Task/Crew） |
| HTTP | **FastAPI** + **uvicorn** + **sse-starlette**（不用裸 Starlette 主线） |
| 模型校验 | **Pydantic v2** |
| Orchestrator | Python；stage + staffing；**CrewAI = Org 只读投影** |
| Crew 投影 | `services/runtime/ensemble_runtime/crew/`；禁止 Crew 写回 tree |
| LLM（live） | OpenAI-compatible env；默认 `ENSEMBLE_CREWAI_MODE=mock\|off` |
| Runner 协议 | `RunnerJob` / `RunnerResult`（CrewAI tool 可封装 Runner） |
| 默认 runner | `pi -p` + json/rpc |
| 启动 | Tauri 负责拉起 runtime（dev 可独立起 Python） |
| 数据根 | dev=`data/`；prod=`~/.ensemble` 或 `ENSEMBLE_DATA_DIR` |
| 单 agent | 可跳过满 Crew；仍用同一 stage/契约路径；M3 可用 mock 顺序任务 |
| 多角色 | M4+ 用 CrewAI sequential/hierarchical 投影 four_crew 等模板 |

---

## 8. MVP 技术切片

| 里程碑 | 交付 |
|--------|------|
| M0 | 文档 + 事件 schema + **栈锁定（本文）** |
| M1 | `apps/canvas` mock：单 seat + 四人 + ≥1 套娃 + 冒泡 + Dossier；**性能预算见下** |
| M2 | Workspace 切换 + Group + SSE + 命令面（11） |
| M3 | Runtime 真树 + 单 agent Run + rework |
| M4 | **src-tauri 包装** + 拉起 Python + PiRunner |
| M5 | 深套娃 LOD 压测 + 跨区待办托盘 |

**M1 性能预算（指导）**：可见节点 ≤40、深度展开 ≤3 时交互 ≥50fps；禁止把折叠子树节点全量挂重型 React 订阅（store 裁剪，非仅 `display:none`）。  
**M5 压测场景**：200 节点 / 深度 8 / 80 边，折叠态可平移；全展开允许降级到关光效。  

M1 可先浏览器跑 canvas；M4 套 Tauri，不阻塞画布验证。

---

## 9. 风险与缓解

| 风险 | 缓解 |
|------|------|
| Linux WebView 大图卡 | 早测；LOD；Electron 回退条款 |
| xyflow 大图非虚拟列表 | 默认渲染集 + 子画布；勿全量挂载 |
| Rust/Python 双运行时 | Tauri 统一生命周期；dev 脚本一键起 |
| 冒泡过多 | 分级；折叠升父角标 |
| Crew 与树双写 | tree SSoT；Crew 只读投影 |

---

## 10. 明确不选

- Electron 作默认壳  
- 纯 Rust GUI 作主界面  
- Vue + Vue Flow 作主线前端（已锁 React）  
- 产品层 max_depth  
- UI 直连各家 CLI、无 Runner 协议  
- **WebSocket** 作默认事件通道（SSE 锁定）  
- **SQLite** 作 MVP 主存储  
- **Starlette 裸应用** 替代 FastAPI 主线  
- 第二客户端状态库与 zustand 并行  
- `apps/canvas/src/protocol` 与 `packages/protocol` 双真源  
- 用 LangGraph/AutoGen 等替换 CrewAI（见 T009）  

---

## 11. 决策 ID

| ID | 内容 |
|----|------|
| T001 | 桌面壳 **锁定 Tauri 2（Rust）** |
| T002 | 主 UI **锁定 React + TS + Vite + @xyflow/react** |
| T003 | 纯 Rust UI 不做主界面 |
| T004 | 编排 Python + Runner；默认 pi |
| T005 | Org 无限深；折叠/LOD/子画布 |
| T006 | 多 workspace / group / 单 seat 一等 |
| T007 | M1 可先 Web，M4 套 Tauri |
| T008 | Electron 仅回退，非平行主线 |
| **T009** | **AI 编排框架锁定 CrewAI**；Org tree 仍为编制 SSoT；Crew 只读投影 |
| **T010** | React **18** + **pnpm 9** + Node≥20 + **zustand** 唯一客户端 store |
| **T011** | TS 协议真源 **`packages/protocol`**（禁止 canvas 本地双源） |
| **T012** | 样式 **Tailwind CSS v4** + CSS 变量 HUD token |
| **T013** | 动效 CSS 优先；**motion** 仅 packet/边；reduced-motion 必降级 |
| **T014** | 图标 **lucide-react** |
| **T015** | MVP 字体系统栈；自托管字体后置 |
| **T016** | 前端单测 **Vitest**（M2 强制） |
| **T017** | Runtime HTTP **FastAPI** + uvicorn + sse-starlette |
| **T018** | CrewAI live LLM = OpenAI-compatible env；默认 mock/off |
| **T019** | SQLite **MVP 不做**；主存储纯文件 |
| **T020** | 数据根 dev=`data/` · prod=`~/.ensemble` · `ENSEMBLE_DATA_DIR` |
| **T021** | 开源许可默认 **MIT** |
| **T022** | Python 环境 MVP：**venv + pip + setuptools**（不强制 poetry/uv） |
| **T023** | Runner 适配代码在仓库根 **`runners/`**（runtime 只 dispatch） |
