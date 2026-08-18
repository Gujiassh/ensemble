# UI → Runtime 命令面（与事件成对）

**状态**：M0–M5 历史命令面，M6 将重做  
**说明**：本文件不再约束新 Backend API；新命令必须与 M6 Domain model 同步定义。  
**原则**：事件（[10](10-events-schema.md)）是 **下行**（Runtime→UI）；本文件是 **上行**（UI→Runtime）。  
**传输**：浏览器 dev 用 HTTP；桌面用 Tauri `invoke` 转发到同一 Runtime API。

---

## 1. 命令一览

| 命令 | 用途 | 成功后典型事件 |
|------|------|----------------|
| `run.start` | 在 workspace 开 Run | `run.stage`, `seat.status`, … |
| `run.cancel` | 取消当前 Run | `run.stage` failed/cancelled |
| `bubble.act` | 审批/回答冒泡 | `bubble.resolve` (+ 后续 stage) |
| `human.inject` | 改/追加 prompt 或指示 | `human.inject` 回声 + `seat.status` |
| `staffing.confirm` | L1 确认扩编 | `org.node.upsert` → `staffing.applied` |
| `staffing.reject` | 驳回扩编建议 | （可选）proposal 关闭事件后置 |
| `org.focus` | 仅 UI 也可本地处理 | 可不打 Runtime |
| `workspace.open` | 切换/打开工作区 | `workspace.changed` + org 快照 |

幂等：客户端带 `client_op_id`；Runtime 对相同 id 在窗口内去重。

---

## 2. 形状示例

### 2.1 `bubble.act`

```http
POST /workspaces/{workspace_id}/runs/{run_id}/bubbles/{bubble_id}/act
```

```json
{
  "client_op_id": "op_1",
  "action": "approve",
  "comment": "LGTM"
}
```

`action`: `approve | reject | comment | choose`（ask 类带 `choice` 字段）

### 2.2 `human.inject`

```http
POST /workspaces/{workspace_id}/runs/{run_id}/seats/{seat_id}/inject
```

```json
{
  "client_op_id": "op_2",
  "inject_kind": "prompt_append",
  "text": "先别动测试文件"
}
```

`inject_kind`（v1）：

| 值 | 含义 |
|----|------|
| `prompt_append` | 追加指示 |
| `prompt_replace` | 替换可编辑段 |
| `goal_set` | 改当前 goal 文案 |
| `rerun` | 请求该 seat 当前 stage 重跑 |

### 2.3 `staffing.confirm`

```http
POST /workspaces/{workspace_id}/runs/{run_id}/staffing/{proposal_id}/confirm
```

```json
{
  "client_op_id": "op_3",
  "parent_id": "seat_eng",
  "group_ids": ["group_eng"]
}
```

可覆盖 proposal 默认挂载点。

### 2.4 `run.start`

```http
POST /workspaces/{workspace_id}/runs
```

```json
{
  "client_op_id": "op_4",
  "title": "fix auth retry",
  "prompt": "…",
  "template": "four_crew" ,
  "template_note": "four_crew | single_agent"
}
```

---

## 3. 快照（非命令，配套）

| GET | 用途 |
|-----|------|
| `/workspaces/{id}/org` | `tree` + `edges[]` 全量 |
| `/workspaces/{id}/runs/{run_id}` | state + 最近 artifacts 索引 |
| `/workspaces/{id}/events?after=` | **SSE only**；`after=` 为断线重连游标（非 HTTP 轮询通道） |

连接顺序：快照 → 订事件 → 发命令。

---

## 4. Tauri 映射（目标）

| 前端 | Tauri | Runtime |
|------|-------|---------|
| `fetch` / SSE | 开发态直连 localhost | Python HTTP |
| `invoke('ensemble_cmd', {…})` | Rust 转发 | 同 API |
| 选目录 / 开 pi | Rust 命令 | — |

---

## 5. 非目标（v1）

- 不在命令里塞完整 tool trace  
- 不让 UI 直接拼 pi CLI  
- 不在 v1 做跨 workspace 事务命令  
