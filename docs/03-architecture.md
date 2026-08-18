# [归档] 架构：壳 / 画布 / 运行时 / 执行

**状态**：M0–M5 历史架构，已被 D019 解除锁定  
**说明**：本文件只记录旧原型结构。V2 当前架构入口见 [specs/m6-architecture.md](specs/m6-architecture.md)；Runner 见 [specs/m6-runner-adapter.md](specs/m6-runner-adapter.md)。

---

## 分层总图

```text
┌──────────────────────────────────────────────┐
│  Shell: Tauri 2（Rust）                        │
│  窗口 / 权限 / 托盘 / 更新 / 进程监督            │
└────────────────────┬─────────────────────────┘
                     │ IPC
┌────────────────────▼─────────────────────────┐
│  Web UI: React + @xyflow/react                │
│  Living Org Canvas · 管道信包 · 冒泡 · Dossier │
│  Workspace · Stage/Work/Debug                 │
└────────────────────┬─────────────────────────┘
                     │ HTTP + SSE（规范化事件）
┌────────────────────▼─────────────────────────┐
│  Ensemble Runtime                             │
│  · Workspace registry                         │
│  · Org tree（编制 SSoT，无限层级）             │
│  · Orchestrator（stage + contracts + staffing）│
│  · Crew 投影（只读，不反向定义组织）            │
│  · Event bus                                  │
│  · Run store                                  │
└────────────────────┬─────────────────────────┘
                     │ RunnerJob
┌────────────────────▼─────────────────────────┐
│  Runners: pi（默认）/ mock / 其它 CLI          │
└──────────────────────────────────────────────┘
```

## 谁干什么

| 层 | 职责 | 不负责 |
|----|------|--------|
| **Shell（Rust/Tauri）** | 桌面集成、权限、路径、拉起 runtime/runner | 画布业务组件、Crew 剧本 |
| **Canvas UI（React）** | 组织图、状态、冒泡、档案、人操作 | 直接改仓库、拼 CLI |
| **Runtime** | workspace/org/run、阶段、契约、扩编、事件 | 重度 coding 会话细节 |
| **Runner** | 真改代码/跑命令、回传产物 | 全局组织剧本 |
| **Org tree** | 编制结构真相 | — |
| **Roster** | 某 Run 的编制变更审计 | 另起一套树 |

## 三层所有权（必须遵守）

| 数据 | 所有权 | 说明 |
|------|--------|------|
| **Org tree** | 编制 **SSoT** | `workspaces/<id>/org/tree.json`；Seat/Group 嵌套；跨 stage 稳定 |
| **Roster** | Run **账本** | 仅记录本 Run 的加入/停用/原因/挂载点；应用时必须先改 tree |
| **Crew** | **只读投影** | 由 active 子树生成任务图；禁止 Crew 写回组织结构 |

Staffing 写路径：

```text
validate mount(parent_id|group) → tree upsert → roster append → events
```

## CrewAI 的位置（AI 框架 · 硬锁）

**Ensemble 的 AI 多角色编排框架锁定为 [CrewAI](https://www.crewai.com/)**（Python `crewai`）。

| 项 | 锁定 |
|----|------|
| 包 | `crewai`（见 `services/runtime/pyproject.toml`） |
| 原语 | `Agent` · `Task` · `Crew` ·（可选）`Process.sequential` / `Process.hierarchical` |
| 所有权 | **只读投影**：Org tree / stage / staffing → Crew；**禁止** Crew 写回 tree |
| 执行 | 编码与工具仍走 **Runner**（pi/mock）；CrewAI tool 可封装 RunnerJob |
| 单 agent | 可不实例化满 Crew；stage loop 仍统一 |
| 多角色 | four_crew 等模板必须可投影为 CrewAI Crew |

适合：角色任务语义、sequential/hierarchical 协作剧本、可见 handoff。  

不适合单独承担：Org Canvas UI、multi-CLI 协议、workspace 隔离、套娃编制 SSoT。  

**CrewAI ⊂ Orchestrator 投影层**，不是整个 Ensemble 产品门面。

### Org → Crew 投影（原则）

- 只投影 **本 Run 相关** 且未折叠停用的子树  
- parent seat ≠ 自动变成 Crew Manager，除非标记  
- 子 seat 工具权限默认继承模板，可收紧不可默认放飞  
- 深树：按 stage 需要的子树切片投影，避免一次加载全树 agent  

## 执行侧：Runner

统一接口：

```text
RunnerJob:
  workspace_id, run_id, stage, seat_id, role_template,
  workspace_path, prompt, inputs[], expected_artifacts[],
  timeout_s, runner

RunnerResult:
  ok, summary, artifacts[], logs_path, provider, exit_code
```

默认 **pi**（非交互 `-p`，优先 `--mode json|rpc`）。  
原则：无约定产物文件 = 失败；换 runner 不改组织剧本。

进度映射：runner 日志/片段 → 规范化 `seat.status`（working/tooling）+ timeline 行；不把私有日志当 UI 主路径。

## 存储布局

```text
workspaces/<workspace_id>/
  workspace.json
  org/tree.json
  runs/<run_id>/
    state.json
    timeline.jsonl
    roster.json
    artifacts/
    sessions/
```

## 阶段机

**四人模板路径：**

```text
intake → brief → research → implement → review → gate → done|rework
```

**单 agent 路径：**

```text
intake → plan → implement → (optional self_check) → gate → done|rework
```

Stage 状态：`pending | running | waiting_human | passed | failed | rework`  
Seat 运行态：见 [10-events-schema](10-events-schema.md)（内部 `waiting_human | waiting_peer`；文案「等你 / 等同伴」）。

## 事件原则

- UI 只消费 **规范化事件**  
- 每条事件必须带 **`workspace_id`**；Run 相关带 **`run_id`**；席位相关带 **`seat_id`**  
- **Schema 真源**：[10-events-schema.md](10-events-schema.md)（09 §4.3 为摘要）  
- 父角标汇总：MVP **客户端由子树派生**；不强制服务端 rollup 事件  

## 安全与门禁

- Reviewer / 只读 seat 默认不写业务代码  
- 外部发送 / 强制推送：human approve bubble  
- Runner 在 workspace 绑定目录 / worktree 中执行（目标）  
- 自动扩编有数量上限与挂载点校验  

## 与旧表述

- 「Stageboard / 角色台 / 交付物墙」不再作为架构主词  
- 主 UI = Living Org Canvas；产物在 Dossier / Packet  
