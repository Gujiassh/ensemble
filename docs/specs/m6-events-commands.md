# M6 Events and Commands Contract

**状态**：实施前基线（2026-08-18）
**方向**：Runtime 产生事件，Client 发送命令
**旧文档**：[10-events-schema.md](../10-events-schema.md) · [11-ui-commands.md](../11-ui-commands.md)（已归档）

## 1. 设计原则

- 事件是 Runtime 状态变化的可重放记录，不是 UI 动画指令。
- 命令表达用户意图，Runtime 负责校验、幂等和状态转换。
- 业务状态使用稳定 code；自然语言通过 `message_key` 和参数本地化。
- 所有跨层对象使用稳定 ID，不使用名称或列表顺序推断语义。
- Client 可以缓存投影，但不能成为 Workflow、Run 或 Artifact 的权威来源。

## 2. 公共信封

### Event

```json
{
  "schema_version": 1,
  "event_id": "evt_01J...",
  "event_type": "run.status.changed",
  "occurred_at": "2026-08-18T10:00:00Z",
  "workspace_id": "ws_01J...",
  "run_id": "run_01J...",
  "sequence": 42,
  "causation_id": "cmd_01J...",
  "payload": {}
}
```

### Command

```json
{
  "schema_version": 1,
  "command_id": "cmd_01J...",
  "command_type": "run.start",
  "created_at": "2026-08-18T10:00:00Z",
  "workspace_id": "ws_01J...",
  "expected_version": 7,
  "payload": {}
}
```

`run_id` 对 Workspace 级命令可为空；所有 Run 级命令必须携带。`sequence` 在单一 Workspace 事件流内单调递增。

## 3. 当前事件目录

| 事件 | 语义 |
|------|------|
| `workspace.created` / `workspace.updated` | Workspace 配置变化 |
| `workflow.updated` / `workflow.validation.changed` | 编排配置和校验变化 |
| `run.created` / `run.status.changed` | Run 生命周期变化 |
| `task.status.changed` | Task 状态、Attempt 和阻塞原因变化 |
| `seat.status.changed` | Seat 当前运行态和动作变化 |
| `handoff.created` / `handoff.delivered` | Artifact 交付关系变化 |
| `attention.created` / `attention.resolved` | 用户待办变化 |
| `artifact.created` / `artifact.superseded` / `artifact.consumed` | Artifact 生命周期变化 |
| `run.recovery.started` / `run.recovery.completed` | 崩溃恢复和事件对账 |
| `runtime.diagnostic` | 不改变业务状态的诊断信息 |

事件 payload 必须引用 M6 Domain model 中的对象，不复制一份可写 Workflow。

## 4. 当前命令目录

| 命令 | 作用 |
|------|------|
| `workspace.create` / `workspace.update` | 创建或修改 Workspace 配置 |
| `workflow.create` / `workflow.update` / `workflow.validate` | 编辑和校验编排 |
| `run.start` | 从当前编排创建不可变 Snapshot 并启动 Run |
| `run.pause` / `run.resume` | 暂停或恢复新派发 |
| `run.cancel` | 取消 Run，进入不可逆终态 |
| `run.retry` / `run.rework` | 创建符合规则的新 Attempt 或后代 Run |
| `attention.resolve` | 审批、回答、打回或确认扩编 |
| `human.inject` | 向当前 Attempt 追加或替换指令 |
| `artifact.accept` / `artifact.reject` | 处理需要人工确认的交付物 |

画布平移、缩放、选择和临时展开不发送业务命令；层级变化必须使用明确的 `workflow.update` 操作。

## 5. 幂等与并发

- Runtime 按 `command_id` 保存命令结果，重复提交返回同一结果。
- 客户端可带 `expected_version`；版本不匹配时返回冲突，不静默合并。
- 同一 Attention 只能有一个有效 resolution；重复 resolution 返回已处理结果。
- 事件缺口通过 `after=sequence` 重连，无法补齐时先拉取快照再继续事件流。
- Event ID、Command ID、Artifact ID 和 Run ID 永不复用。

## 6. 传输

逻辑协议与传输解耦：

| 场景 | 命令 | 事件 |
|------|------|------|
| 开发预览 | HTTP | SSE |
| 桌面应用 | Tauri IPC 或同一 Runtime API | Shell 转发的事件流 |

生产不依赖固定 Vite 端口或固定 Origin。SSE 只承载事件，不承担命令轮询；命令响应只确认接受、拒绝或冲突，业务结果通过事件流返回。

## 7. 本地化

事件不得把确定性 UI 文案写死在 `title` 或 `body` 中：

```json
{
  "event_type": "attention.created",
  "payload": {
    "kind": "approval",
    "message_key": "attention.reviewApprovalRequired",
    "message_params": {
      "seatName": "Reviewer",
      "artifactName": "patch.diff"
    }
  }
}
```

用户输入、Agent 输出和 Artifact 内容原样保存；界面通过 `uiLocale` 翻译稳定消息，Run 通过 `outputLocale` 控制 Agent 输出。

## 8. 端到端示例

```text
run.start
  -> run.created
  -> run.status.changed(running)
  -> task.status.changed(started)
  -> seat.status.changed(working)
  -> artifact.created
  -> handoff.created
  -> attention.created(approval)
  -> attention.resolve(approve)
  -> task.status.changed(succeeded)
  -> run.status.changed(succeeded)
```

客户端只根据事件更新业务投影；handoff 脉冲和检查器打开属于事件驱动的表现层行为。

## 9. 验收门槛

- [ ] 所有命令和事件都有稳定 ID、版本和作用域
- [ ] Snapshot、Runtime State、Artifact 和 Workflow 没有混写
- [ ] 断线重连、快照回退和重复命令有测试
- [ ] `uiLocale` 与 `outputLocale` 在协议中保持分离
- [ ] [m6-domain-model.md](m6-domain-model.md)、[m6-run-operations.md](m6-run-operations.md) 与本协议字段一致
