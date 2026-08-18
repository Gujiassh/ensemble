# 规范化事件最小 Schema（M0 冻结）

**状态**：M0–M5 历史协议，M6 不再冻结  
**说明**：旧事件仅供原型行为参考；M6 将重新定义 Workspace、Orchestration、Run、Event 和国际化消息协议。  
**原则**：UI **只消费**本文件事件；私有 CLI 日志必须先适配进来。  
**配合**：[03-architecture](03-architecture.md) · [09-tech-and-desktop](09-tech-and-desktop.md) · [08-design-language](08-design-language.md) · [11-ui-commands](11-ui-commands.md)

---

## 1. 公共信封

每条事件 JSON 必须包含：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | string | ✅ | 事件名 |
| `workspace_id` | string | ✅ | 工作区作用域 |
| `ts` | string (ISO8601) | ✅ | 事件时间 |
| `run_id` | string | 条件 | Run 相关必填 |
| `seat_id` | string | 条件 | 席位相关必填 |
| `event_id` | string | 建议 | 去重/回放 |

```json
{
  "event_id": "evt_001",
  "type": "seat.status",
  "workspace_id": "ws_1",
  "run_id": "run_1",
  "seat_id": "seat_eng",
  "ts": "2026-08-18T10:00:00Z"
}
```

---

## 2. 事件目录

| type | 驱动 UI |
|------|---------|
| `workspace.changed` | 切换/重命名工作区 |
| `org.node.upsert` | 席位/组增改（套娃、扩编） |
| `org.node.remove` | 移除节点 |
| `org.tree.replace` | 整树+边快照替换（慎用） |
| `org.edge.upsert` | 单条边增改 |
| `org.edge.remove` | 删边 |
| `seat.status` | 头像状态环、当前动作 |
| `edge.packet` | 管道光效 / 信包（**不建边**） |
| `bubble.upsert` | 节点冒泡 |
| `bubble.resolve` | 冒泡关闭（审批结果） |
| `run.stage` | 顶栏阶段进度 |
| `artifact.written` | Dossier Outputs / 信包可点 |
| `staffing.proposed` | 扩编建议卡 |
| `staffing.applied` | 扩编已入树 |
| `human.inject` | 用户改 prompt/指示后的回声 |

---

## 3. 字段细则

### 3.1 `seat.status`

```json
{
  "type": "seat.status",
  "workspace_id": "ws_1",
  "run_id": "run_1",
  "seat_id": "seat_eng",
  "status": "tooling",
  "goal": "实现 auth 重试",
  "current_action": "pi: edit api/base.ts",
  "runner": "pi",
  "ts": "2026-08-18T10:00:00Z"
}
```

`status` 枚举（内部）：

```text
idle | planning | working | tooling | waiting_human | waiting_peer | blocked | done | error
```

UI 文案：`waiting_human` → **waiting_you**（或「等你」）。

### 3.2 边拓扑 vs 信包

| 概念 | 来源 | 说明 |
|------|------|------|
| **Edge（管道）** | org 快照 `edges[]` 或 `org.edge.upsert` / `org.tree.replace` | 结构关系；可先于任何 packet 存在 |
| **Packet（信包）** | `edge.packet` | 只驱动光效与标签；**不创建边** |
| **视觉 idle** | 某 `edge_id` 无 `phase=flowing|ready` 的活跃 packet | 细线低对比；**不要**发明 `phase=idle` |

```json
{
  "type": "org.edge.upsert",
  "workspace_id": "ws_1",
  "edge": {
    "id": "e_pm_res",
    "from": "seat_pm",
    "to": "seat_res",
    "kind": "handoff"
  },
  "ts": "2026-08-18T09:59:00Z"
}
```

### 3.2b `edge.packet`

```json
{
  "type": "edge.packet",
  "workspace_id": "ws_1",
  "run_id": "run_1",
  "edge_id": "e_pm_res",
  "from_seat_id": "seat_pm",
  "to_seat_id": "seat_res",
  "phase": "flowing",
  "label": "01-brief.md",
  "artifact_id": "art_brief_v1",
  "ts": "2026-08-18T10:01:00Z"
}
```

`phase`: `ready | flowing | delivered | rejected`（无 idle）

### 3.3 `bubble.upsert` / `bubble.resolve`

```json
{
  "type": "bubble.upsert",
  "workspace_id": "ws_1",
  "run_id": "run_1",
  "seat_id": "seat_rev",
  "bubble_id": "b_1",
  "kind": "approve",
  "priority": 0,
  "title": "确认实现思路",
  "body": "patch 已就绪，是否通过？",
  "actions": ["approve", "reject", "comment"],
  "ts": "2026-08-18T10:05:00Z"
}
```

`kind`: `approve | ask | alert | status | chat`  
`priority`: `0` 最高（approve/ask/alert），`2` 为 status/chat（可合并）

```json
{
  "type": "bubble.resolve",
  "workspace_id": "ws_1",
  "run_id": "run_1",
  "seat_id": "seat_rev",
  "bubble_id": "b_1",
  "resolution": "approve",
  "comment": "LGTM",
  "ts": "2026-08-18T10:06:00Z"
}
```

### 3.4 `org.node.upsert`（套娃 / 扩编）

**语义（钉死）**：

- 默认 = **单节点挂载/更新**（不携带整棵 `children` 子树）  
- `parent_id` 必填（根节点可用 `null` 或约定 `parent_id: null`）  
- 子树整体替换用 `org.tree.replace`，勿用 upsert 塞深 children  
- MVP：`group_ids` 可选 tags；树归属以 `parent_id` 为准  

```json
{
  "type": "org.node.upsert",
  "workspace_id": "ws_1",
  "node": {
    "id": "seat_qa",
    "kind": "seat",
    "name": "QA",
    "parent_id": "seat_eng",
    "group_ids": ["group_eng"],
    "role_template": "qa",
    "runner": null
  },
  "ts": "2026-08-18T10:07:00Z"
}
```

### 3.5 `staffing.proposed` / `applied`

```json
{
  "type": "staffing.proposed",
  "workspace_id": "ws_1",
  "run_id": "run_1",
  "proposal_id": "sp_1",
  "role_template": "qa",
  "parent_id": "seat_eng",
  "group_ids": ["group_eng"],
  "reason": "bugfix signal",
  "source": "rule",
  "ts": "2026-08-18T10:07:00Z"
}
```

```json
{
  "type": "staffing.applied",
  "workspace_id": "ws_1",
  "run_id": "run_1",
  "proposal_id": "sp_1",
  "seat_id": "seat_qa",
  "role_template": "qa",
  "parent_id": "seat_eng",
  "group_ids": ["group_eng"],
  "source": "rule",
  "ts": "2026-08-18T10:07:01Z"
}
```

`applied` 必须在 **tree upsert 成功之后** 发出，且带最终 `seat_id`。

### 3.6 `artifact.written`

```json
{
  "type": "artifact.written",
  "workspace_id": "ws_1",
  "run_id": "run_1",
  "seat_id": "seat_eng",
  "artifact_id": "art_patch_v1",
  "path": "artifacts/03-patch.diff",
  "media": "diff",
  "version": 1,
  "ts": "2026-08-18T10:04:00Z"
}
```

### 3.7 `human.inject`

```json
{
  "type": "human.inject",
  "workspace_id": "ws_1",
  "run_id": "run_1",
  "seat_id": "seat_eng",
  "inject_kind": "prompt_append",
  "text": "先别动测试文件",
  "ts": "2026-08-18T10:03:00Z"
}
```

### 3.8 `run.stage`

```json
{
  "type": "run.stage",
  "workspace_id": "ws_1",
  "run_id": "run_1",
  "stage": "implement",
  "status": "running",
  "ts": "2026-08-18T10:02:00Z"
}
```

Stage `status`: `pending | running | waiting_human | passed | failed | rework`

---

## 4. 派生规则（非事件，UI 侧）

### 4.1 父角标映射（钉死）

对**折叠子树**内所有 seat 聚合：

| 角标 | 计入的 `seat.status` | 另计 |
|------|----------------------|------|
| **busy** | `planning` \| `working` \| `tooling` | — |
| **waiting** | `waiting_human` \| `waiting_peer` | 未 resolve 且 `priority=0` 的 bubble 数 |
| **error** | `error` \| `blocked` | — |

展示：有 error 优先红点；否则 waiting 琥珀；否则 busy 青/蓝；全 idle/done 可隐藏数字。

### 4.2 其它

| 派生 | 规则 |
|------|------|
| 折叠升泡 | 子 seat 的 P0 bubble 在父折叠时计入父角标，点开再展开 |
| LOD | 见 09：可见节点 >80 关 packet 动画 |
| 边 idle | 无活跃 packet（见 §3.2） |

---

## 5. 传输

- MVP：**SSE** `GET /workspaces/:id/events`（或 run 级订阅）  
- 可补快照：`GET /workspaces/:id/org` + `GET .../runs/:id` 后跟事件流  
- 重连：用 `event_id` / `ts` 游标  

---

## 6. 非目标

- 不把 pi raw session JSON 直接推 UI  
- 不要求每个 tool call 都 `bubble.upsert`  
- 不在 MVP 强制服务端 `org.badge.rollup` 事件  
