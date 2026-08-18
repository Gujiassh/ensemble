# M6 Run Operations

**状态**：Draft v1，待产品审阅

**范围**：Run、TaskAttempt、Gate、Join、Attention、Artifact、事件顺序和恢复

**依赖**：[m6-domain-model.md](m6-domain-model.md)、[m6-orchestration-interaction.md](m6-orchestration-interaction.md)
**不包含**：具体 Runner 命令、模型供应商、网络传输实现

本文定义一次执行从创建到结束的可观察业务行为。Runtime 可以替换实现，但不能改变这些状态和操作语义。

## 1. 运行时所有权

```text
RunSnapshot  = 本次执行的不可变输入
RuntimeState = Run、NodeExecution、TaskAttempt、Attention、Artifact 的变化
Event        = RuntimeState 的追加记录
```

- Runtime 只读取 RunSnapshot 调度，不回读当前 Workspace Draft 推断行为。
- Event 追加后不可修改；修正通过新 Event 表达。
- UI 是 Event 和当前快照的投影，不能从局部动画推断业务状态。
- 同一 Run 内 `sequence` 单调递增；客户端用 `eventId` 和 `sequence` 去重、补齐和重放。

## 2. Run 状态机

### 2.1 Canonical 状态

```text
created -> preparing -> running
running -> pausing | canceling | succeeded | failed | interrupted
pausing -> paused | canceling | interrupted
paused -> running | canceling
canceling -> canceled
interrupted -> running | failed | canceling
```

允许的实际转换：

| 当前状态 | 触发 | 下一状态 | 说明 |
|---|---|---|---|
| `created` | Runtime 接收创建命令 | `preparing` | 校验 Snapshot、初始化目录和调度器 |
| `preparing` | 初始化成功 | `running` | 开始调度可运行节点 |
| `preparing` | 初始化失败 | `failed` | 记录可诊断的 `resultCode` |
| `preparing` | 用户取消启动 | `canceling` | 清理已创建的运行资源 |
| `running` | 用户请求暂停 | `pausing` | 立即停止新的派发 |
| `pausing` | 所有活动尝试到达安全边界 | `paused` | 不再启动新的 Task |
| `pausing` | 用户取消 | `canceling` | 终止活动尝试 |
| `pausing` | 进程或设备异常 | `interrupted` | 等待恢复或明确结束 |
| `running` | 用户取消 | `canceling` | 停止派发并终止活动尝试 |
| `running` | 所有成功终点满足 | `succeeded` | 生成最终 Run 结果 |
| `running` | 不可恢复的失败 | `failed` | 保留所有中间产物和 Attention |
| `running` | 进程/设备异常导致无法判断活动尝试 | `interrupted` | 等待恢复或明确结束 |
| `paused` | 用户继续 | `running` | 从持久化状态继续，不重跑已完成尝试 |
| `paused` | 用户取消 | `canceling` | 仍需等待终止确认 |
| `canceling` | 活动尝试全部终止 | `canceled` | 取消不可逆 |
| `interrupted` | 恢复校验成功 | `running` | 只恢复未形成终态的工作 |
| `interrupted` | 用户明确结束 | `failed` | `resultCode=interrupted_ended` |
| `interrupted` | 用户取消 | `canceling` | 走统一取消流程 |

`succeeded`、`failed` 和 `canceled` 是终态，不能回到原 Run。再次执行使用“基于此版本重新开始”创建新 Run。

### 2.2 派生健康状态

Attention 不强行扩张 Run 状态机。Run 仍为 `running`，但健康状态可以为：

```text
healthy | needs_attention | degraded
```

- 有未解决的 blocking Attention 时为 `needs_attention`。
- Runner 不可用、事件连接断开或恢复未完成时为 `degraded`。
- UI 的“等待你处理”来自健康状态和 Attention，不把界面提示文字当作新的 Run canonical 状态。

## 3. Task 与 NodeExecution 状态机

### 3.1 TaskAttempt

同一个 Task 可以有多个不可变 Attempt。每次重试、打回重做或恢复未完成任务都创建新的 `attemptId`。

```text
pending -> ready | canceled
ready -> starting | skipped | canceled
starting -> running | failed | canceled | interrupted
running -> waiting_attention | pausing | succeeded | failed | canceled | interrupted
waiting_attention -> running | failed | canceled | interrupted
pausing -> paused | failed | canceled | interrupted
paused -> running | canceled | interrupted
```

允许的业务规则：

- `pending` 表示依赖未满足；`ready` 表示可以调度，但尚未占用 Runner。
- `starting` 只表示 Runner 已接收启动请求，不能在 UI 中伪装为 `running`。
- `waiting_attention` 表示当前 Attempt 被一个或多个 Attention 阻塞；Resolve 后回到 `running` 或进入 `failed`。
- `paused` 只在 Run 暂停边界确认后出现；Runner 不支持检查点时，活动 Attempt 可以先保持 `running`，直到自然结束再暂停 Run。
- `succeeded`、`failed`、`canceled`、`skipped`、`interrupted` 的 Attempt 不再改变；重试或恢复必须创建新 Attempt。

### 3.2 Gate 和 Join

Gate 和 Join 也有 `NodeExecution`，但不创建 Runner Attempt：

```text
pending -> ready | canceled
ready -> open | canceled
open -> resolved | rejected | blocked | canceled
```

- Gate 进入 `open` 时创建 blocking Attention；首版 Gate 不提供非阻塞模式。
- Gate 的 `approved`、`rejected`、`answered` 结果只能被一次有效 Resolve 消费。
- `all` Join 必须收到所有有效分支；不可达或失败分支会使 Join `blocked`，除非存在明确 failure Transition。
- `any` Join 在首个满足条件的分支到达后继续；其余分支不自动取消，仍按自己的状态继续，迟到的结果只作为历史 Artifact 保留。

## 4. 调度和并行

1. Runtime 根据 Snapshot 建立 NodeExecution 图，验证所有引用和能力。
2. Start 只触发一次，不占用 Runner。
3. 依赖满足的 Task 进入 `ready`，调度器根据显式 Transition 和 Runner capability 派发。
4. 同一批可运行 Task 可以并行，但每个 Task 只允许一个活动 Attempt。
5. Handoff 只有在上游产出通过 Contract 校验后才创建；不能因为节点状态变为完成就发送空交付。
6. Join 只消费显式来源，不按数组顺序或到达时间猜测业务关系。
7. 调度器在每次状态变更后重新计算可运行集合，重复命令不会重复派发。
8. Run 只有在 End 条件满足且所有已启动 Attempt 进入终态后才能结束；`any` Join 的迟到分支不能在后台留下未归档工作。

并行预算、Runner 并发限制和设备资源不足表现为 `ready` 队列，不改变 Task 的语义状态。

## 5. Pause、Resume 和 Cancel

### 5.1 Pause

用户点击 Pause 后立即发生：

1. Run 进入 `pausing` 过渡显示，调度器停止派发新的 Task。
2. 已进入 `starting` 的 Task 要么完成启动，要么明确记录启动失败。
3. 支持检查点的 Runner 收到暂停请求并把活动 Attempt 置为 `paused`。
4. 不支持暂停的 Runner 继续当前 Attempt 到下一个可安全边界；UI 明确显示“等待当前任务结束”。
5. 没有活动 Attempt 或所有活动 Attempt 到达边界后，Run 进入 `paused`。

Pause 不撤销已产生 Artifact，不关闭 Attention，也不改变 Snapshot。用户可以在暂停状态查看和处理 Attention。

### 5.2 Resume

- Resume 只对 `paused` 有效；重新启动调度器，已完成 Attempt 不重跑。
- 暂停期间 Draft 或 Workspace 设置的变化不自动进入当前 Run。
- 如果 Runner 配置已不可用，Resume 被拒绝并创建诊断 Attention，不把 Run 静默标为失败。
- Resume 命令通过 `clientOperationId` 幂等，重复点击只能得到同一结果。

### 5.3 Cancel

1. 用户必须确认取消，确认文本显示正在运行的 Task 数量和已产生 Artifact 数量。
2. Run 进入 `canceling`，停止新的 Task 派发。
3. Runtime 向活动 Runner 发送终止请求，并等待每个 Attempt 的终止结果。
4. 超过 Runner 约定超时后，记录 `termination_timeout`，再按平台能力终止进程。
5. 所有活动 Attempt 有终态后，Run 进入 `canceled`。

取消不会删除 Workspace、Run、Artifact 或日志。取消后的 Run 不可 Resume，只能基于 Snapshot 创建新 Run。

## 6. 失败、重试和打回

### 6.1 failurePolicy

Task 的 `failurePolicy` 使用稳定值：

```text
stop_run | wait_human | route_failure | continue_optional
```

- `stop_run`：任务失败后直接使 Run 失败。
- `wait_human`：任务失败后打开异常 Attention，Run 保持 `running + needs_attention`。
- `route_failure`：必须存在 `failure` Transition，沿结构化失败路径继续。
- `continue_optional`：仅允许 `optional=true` 的 Task；记录跳过原因后继续下游。

没有匹配策略或策略配置不完整时，按 `wait_human` 处理并标记配置错误，不自动猜测。

### 6.2 Retry Task

- Retry 只对 `failed` Attempt 或已解决的异常 Attention 有效。
- 新 Attempt 继承 Snapshot 中的 Task 定义，附带 `retryOfAttemptId` 和用户原因。
- 旧 Attempt 和其 Artifact 保留为历史；只有新 Attempt 通过 Contract 的输出才可作为后续输入。
- 如果下游 Task 尚未开始，Retry 可以在当前 Run 内继续。
- 如果下游已经开始并消费旧 Artifact，当前 Run 不回滚；UI 提供“基于此版本从该 Task 重新开始”，创建带 `sourceRunId` 的新 Run。

### 6.3 Gate Reject 与 Rework

- Reject 必须命中 Gate 的 `rejected` Transition，并携带用户评论或结构化原因。
- Rework 目标 Task 创建新 Attempt，`reworkIteration` 加一；上次 Artifact 的 `currentness` 标记为 `superseded`，但不可删除。
- 达到 `maxIterations` 时不再自动回环，Gate 打开阻塞 Attention，用户可以结束 Run、调整未开始部分或创建新 Run。
- Rework 不改变组织结构；需要增加 Seat 或改变未开始 Task 时使用 Run Amendment。

### 6.4 Handoff 失败

- 上游 Task 成功但 Artifact Contract 校验失败时，Task 结果为 `failed`，而不是发送不完整 Handoff。
- Handoff 发送后下游接收失败，保留上游 Artifact 和发送 Event；重试只重试传递或创建新的下游 Attempt，不能重写上游 Artifact。
- Handoff 目标已被禁用或不存在时，阻塞 Runtime 校验并创建 Attention，不按名称寻找替代 Seat。

## 7. Attention 生命周期与用户介入

### 7.1 生命周期

```text
open -> resolving -> resolved
open -> resolving -> resolve_failed -> open
```

- 一个 Attention 只能被成功 Resolve 一次。
- `attentionId + actionId` 是幂等键；重复提交返回原 Resolve 结果，不重复触发 Transition。
- 连接断开或应用重启不会把 `open` 自动变成失败。
- Attention 必须包含来源 Run、来源 Node/Task、摘要、上下文 Artifact、允许动作和创建序列。

### 7.2 操作

| Attention 类型 | 允许动作 | 结果 |
|---|---|---|
| `approval` | approve / reject | 触发 Gate Transition 或 Rework |
| `question` | answer | 写入结构化答案，解除 Gate |
| `exception` | retry / skip_optional / fail_run / amend | 按选择继续、跳过或结束 |
| `staffing_request` | approve / reject | 仅影响未开始部分，并生成 Amendment |

动作按钮必须在上下文完整时就地可用；需要查看对比 Artifact、填写评论或调整参数时在检查器中完成。

### 7.3 补充指令

补充指令不是修改 RunSnapshot 的隐式入口，分两种明确语义：

- 活动 Runner 声明支持 `accept_live_instruction` 时，发送 `human_instruction` Event，由 Runner 返回已接收或拒绝结果。
- Runner 不支持实时指令时，按钮改为“加入下次尝试”，该内容只进入下一次 Attempt 的输入，不改变当前 Attempt。

两种结果都必须记录作者、时间、目标 Attempt 和 Runner 回执；没有回执不能显示为“已发送”。

## 8. Run Amendment

运行中需要改变编排时，不直接修改 Snapshot：

1. 用户发起 Amendment，Runtime 暂停新 Task 派发，但不强制停止已运行 Task。
2. 系统检查目标 Task 是否尚未开始、是否有已执行依赖、是否会破坏 Join 和 Contract。
3. 校验通过后创建新的 Snapshot 版本，记录操作前后摘要和操作者。
4. 只把新 Snapshot 应用于尚未开始的调度；运行中和已完成的 Task 继续引用原 Attempt 定义。
5. 校验失败则拒绝 Amendment，恢复派发并保留失败原因。

允许的首版 Amendment：

- 给尚未开始的分支新增 Seat 和关联 Task，并建立显式 Transition 与 Contract。
- 禁用尚未参与执行的 Seat；它负责的未开始 Task 必须先重新指派或同时禁用。
- 给未开始 Task 修改指令或 Runner binding。
- 给未开始 Task 重新指派启用的 Seat。
- 禁用尚未开始且没有已执行下游依赖的 Task。
- 调整尚未触发 Gate 的允许动作。

禁止修改已完成/运行中 Task、已产生 Artifact 的含义、已解决 Gate 或历史 Event。

## 9. Artifact 与版本

### 9.1 创建

每个 Artifact 具备：

```text
artifactId
contractId
producerTaskId
producerAttemptId
version
mediaType
integrity
createdAt
validationStatus
currentness
consumedBy[]
```

- Artifact 是追加式版本；下游消费后不能原地覆盖。
- 同一 Contract 的新 Attempt 产出新版本，旧版本保持可查看。
- `validationStatus` 为 `valid | invalid`，`currentness` 为 `active | superseded`；消费关系单独追加到 `consumedBy`。
- Contract 校验未通过的产物可以保存为 `invalid`，但不能作为必填 Input 传递。

### 9.2 消费和重做

- Handoff 记录明确的 `artifactId` 和版本，不按文件名或数组位置猜测。
- Rework 产生新版本后，后续新 Attempt 只能消费通过校验的最新有效版本；历史 Attempt 仍显示原版本。
- Run 结束时保留最终结果、关键 Artifact、失败原因和每次 Attempt 的关系图。

## 10. 进程退出与崩溃恢复

### 10.1 正常退出

- 应用关闭前停止新派发，等待 Runtime 回报当前序列和持久化完成。
- 有运行中 Run 时显示“仍有活动 Run”，用户可以选择“暂停并退出”“取消并退出”或“保持应用打开”。“暂停并退出”等待安全边界后持久化；重启后 Run 保持 `paused`，由用户显式 Resume。首版不把 Runtime 静默留在壳层之外继续运行。
- 如果 Backend 是独立进程，壳层退出流程必须等待优雅停止结果，超时后记录终止原因。

### 10.2 意外中断

重启后对每个非终态 Run 执行：

1. 读取 RunSnapshot、最后持久化状态和 `latestSequence`。
2. 向 Runtime 请求 `sequence > latestSequence` 的事件；缺口时请求完整状态快照。
3. 检查 Runner 进程、Attempt 心跳和最后检查点。
4. 能确认已完成的 Attempt 写入缺失终态；无法确认的活动 Attempt 置为 `interrupted`。
5. Run 保持 `interrupted + degraded`，在检查器展示“恢复、结束为失败、取消”三个明确动作。

恢复不能根据 UI 最后看到的状态猜测；必须以持久化 Event、Runner 回执或检查点为依据。

### 10.3 Resume interrupted Run

- Resume 先执行快照和 Runner 能力校验；通过后只恢复没有终态的 NodeExecution。
- 已有成功 Artifact 的 Task 不重复执行；没有完整输出的 Attempt 创建新的 recovery Attempt，并记录 `recoveredFromAttemptId`。
- Runner 无法提供检查点时，从该 Task 的最后安全输入边界重新开始，并在历史中明确标记可能重复的副作用。
- 恢复失败不能覆盖原中断信息，Run 进入 `failed` 并保留恢复错误 Attention。

## 11. 事件顺序与快照对账

### 11.1 最小事件集合

Runtime 至少追加以下稳定事件：

```text
run.created
run.state_changed
task.attempt_started
task.state_changed
gate.opened
gate.resolved
attention.opened
attention.resolved
handoff.dispatched
artifact.created
run.amended
run.reconciled
```

每条事件包含：

```text
eventId
runId
sequence
occurredAt
type
payload
```

`payload` 使用稳定 code、ID、数值和 ISO 时间；显示文案由 UI Locale 生成。

### 11.2 客户端对账

- 客户端按 `sequence` 应用事件，重复 `eventId` 忽略。
- 收到大于 `lastSequence + 1` 的事件时暂停局部更新，请求缺失事件或完整 Snapshot。
- 完整 Snapshot 携带 `asOfSequence`，应用成功后再继续后续事件。
- 事件应用失败时不能继续播放后续事件；显示连接/对账错误并提供重试。
- 对账完成后才清除 `degraded` 状态，不能用动画结束作为恢复依据。

## 12. 运行画布与检查器行为

### 12.1 顶部控制

运行画布顶部只显示当前 Run 名称、健康状态、更新时间和一个主控制：

```text
Pause | Resume | Cancel | Re-run
```

按钮根据 canonical 状态和 Runner capability 显示 Disabled、Loading 或已完成结果；危险的 Cancel 进入确认菜单。

### 12.2 Task 检查器

顺序固定为：

1. Task、owner Seat、当前 Attempt 和状态。
2. 阻塞 Attention 和可用操作。
3. 输入 Artifact 与版本。
4. 当前输出、Contract 校验和 Handoff。
5. Attempt 历史、重试/打回原因。
6. Runner 回执和诊断日志（默认折叠）。

操作成功后在原上下文显示新状态；不能只发全局 Toast。

### 12.3 离开运行画布

- 切换到其它 Workspace 不停止 Run。
- 关闭检查器不影响 Run。
- 关闭应用时按正常退出或意外中断流程处理，不能把离开页面误记为 Cancel。

## 13. 失败和空状态

| 场景 | 运行状态 | UI 操作 |
|---|---|---|
| Runner 探测失败 | `preparing` 或 `failed` | 重试探测、查看诊断、取消启动 |
| Task 失败等待人 | `running + needs_attention` | Retry、跳过可选任务、Fail Run、Amend |
| Attention 已被处理 | 不变 | 显示处理人、动作和时间，不重复执行 |
| 事件连接断开 | `degraded` | 重连、请求快照、查看离线提示 |
| 进程崩溃 | `interrupted + degraded` | Resume、结束为失败、Cancel |
| Run 取消 | `canceled` | 查看历史、基于版本重新开始 |
| Run 完成 | `succeeded` / `failed` | 查看结果、Artifact、重新开始 |

## 14. 验收标准

- Pause 能保证不再启动新的 Task；活动 Runner 的差异被明确显示。
- Cancel 是不可逆且可审计的，所有中间 Artifact 保留。
- Retry、Reject/Rework、Resume 都创建新的 Attempt，不覆盖历史结果。
- Attention 的重复提交不会重复触发 Transition 或创建重复 Artifact。
- Run 启动后 Workspace Draft、Runner 默认值和 UI Locale 变化不改变 Snapshot。
- 应用重启后能通过事件序列和快照恢复；不能仅凭最后一次 UI 状态恢复。
- 事件缺口、重复和对账失败都有可见状态和重试入口。
- `zh-CN` 与 `en-US` 下状态、操作和失败原因语义一致，系统文案不把内部枚举直接展示给用户。

## 15. 待产品确认

以下选择按推荐方案写入，实现前需要最终确认：

1. Pause 采用“立即停止新派发，活动任务按 Runner 能力到安全边界”的语义。
2. 下游已开始后不在原 Run 回滚，改为基于 Snapshot 创建新 Run。
3. 补充指令区分实时发送和下一次 Attempt 输入，不静默改变 Task 定义。
4. 中断 Run 通过对账恢复，无法确认的活动 Attempt 创建 recovery Attempt。
