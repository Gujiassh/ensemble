# M6 Run Operations

**状态**：实施基线 v1（2026-08-20）

**范围**：Run、TaskExecution、TaskAttempt、Gate、Join、Attention、Artifact、执行目录、事件顺序和恢复

**依赖**：[m6-domain-model.md](m6-domain-model.md)、[m6-orchestration-interaction.md](m6-orchestration-interaction.md)、[m6-agent-session-collaboration.md](m6-agent-session-collaboration.md)
**不包含**：具体 Runner 命令、模型供应商、网络传输实现

本文定义一次执行从创建到结束的可观察业务行为。Runtime 可以替换实现，但不能改变这些状态和操作语义。

## 1. 运行时所有权

```text
RunSnapshot  = 本次执行的不可变输入
RuntimeState = Run、NodeExecution、TaskExecution、TaskAttempt、Attention、Artifact 的变化
Event        = RuntimeState 的追加记录
```

- Runtime 只读取 RunSnapshot 调度，不回读当前 Workspace Draft 推断行为。
- Event 追加后不可修改；修正通过新 Event 表达。
- UI 是 Event 和当前快照的投影，不能从局部动画推断业务状态。
- 同一 Workspace 事件流内 `sequence` 单调递增；Run 级 Event 携带 `runId`，Workspace 级历史事件可以为空。客户端用 `eventId` 和 `sequence` 去重、补齐和重放。

## 2. Run 状态机

### 2.1 Canonical 状态

```text
created -> preparing -> running
preparing -> failed | canceling | interrupted
running -> pausing | canceling | succeeded | failed | interrupted
pausing -> paused | failed | canceling | interrupted
paused -> resuming | canceling
resuming -> running | paused | failed | interrupted | canceling
canceling -> canceled
canceling -> interrupted
interrupted -> preparing | running | failed | canceling
```

允许的实际转换：

| 当前状态 | 触发 | 下一状态 | 说明 |
|---|---|---|---|
| `created` | Runtime 接收创建命令 | `preparing` | 校验 Snapshot、初始化目录和调度器 |
| `preparing` | 初始化成功 | `running` | 开始调度可运行节点 |
| `preparing` | 初始化失败 | `failed` | 记录可诊断的 `resultCode` |
| `preparing` | 用户取消启动 | `canceling` | 清理已创建的运行资源 |
| `preparing` | 进程/设备异常或安全退出中止初始化 | `interrupted` | 保存初始化阶段与恢复策略，不伪装成 paused |
| `running` | 用户请求暂停 | `pausing` | 立即停止新的派发 |
| `pausing` | 所有活动尝试到达安全边界 | `paused` | 不再启动新的 Task |
| `pausing` | 已冻结的失败 End 或 fatal Runtime result 完成 finalization | `failed` | 暂停请求不能覆盖已经成立的业务失败 |
| `pausing` | 用户取消 | `canceling` | 终止活动尝试 |
| `pausing` | 进程或设备异常 | `interrupted` | 等待恢复或明确结束 |
| `running` | 用户取消 | `canceling` | 停止派发并终止活动尝试 |
| `running` | 显式成功 End 候选满足且执行图收敛 | `succeeded` | 通过 finalization barrier 后生成最终 Run 结果 |
| `running` | 显式失败 End 到达或不可恢复的 fatal failure | `failed` | 通过 finalization barrier 后保留所有中间产物和 Attention |
| `running` | 进程/设备异常导致无法判断活动尝试 | `interrupted` | 等待恢复或明确结束 |
| `paused` | 用户继续 | `resuming` | 持久化恢复屏障，调度器仍停止 |
| `paused` | 用户取消 | `canceling` | 仍需等待终止确认 |
| `resuming` | 所有 paused Handle 恢复确认 | `running` | 启动调度器，不重跑已完成尝试 |
| `resuming` | 恢复失败且补偿性 re-pause 全部确认 | `paused` | 保持暂停并创建 Attention |
| `resuming` | 恢复期间已冻结的失败 End 或 fatal Runtime result 完成 finalization | `failed` | 只用于恢复前已成立或恢复过程中可靠产生的业务 fatal outcome |
| `resuming` | re-pause 失败、进度不明或 Runtime 中断 | `interrupted` | 停止调度并进入风险感知恢复 |
| `resuming` | 用户取消 | `canceling` | 终止已恢复和仍暂停的 Handle |
| `canceling` | 活动尝试全部终止 | `canceled` | 取消不可逆 |
| `canceling` | Handle 或资源清理状态不明 | `interrupted` | 保留 `terminationIntent=cancel` 和 `resultCode=cancel_cleanup_unknown` |
| `interrupted` | 初始化阶段恢复校验成功 | `preparing` | 幂等继续 Snapshot、目录、Runner 和调度器初始化 |
| `interrupted` | 执行阶段恢复校验成功 | `running` | 只恢复未形成终态的工作 |
| `interrupted` | `run.end_failed` 完成资源收敛 | `failed` | `resultCode=interrupted_ended` |
| `interrupted` | 用户取消 | `canceling` | 走统一取消流程 |

`succeeded`、`failed` 和 `canceled` 是终态，不能回到原 Run。再次执行使用“基于此版本重新开始”创建新 Run。

Pause/Resume 屏障不能吞掉并发业务 outcome。若 failure End 或可靠 fatal Runtime result 在 `pausing | resuming` 期间成立，Runtime 先用 intent-only `run.status.changed` 原子冻结 `finalizationOutcome=failed`、稳定 result code、typed source ref 和当前 sequence，再停止 pause/resume 调度并转入同一 Run-finalization barrier；资源全部收敛后允许当前过渡态直接提交 `failed`。若 cleanup 状态不明则进入 `interrupted + degraded` 并保留 finalization intent，后续恢复只能继续 finalization，不能恢复业务执行或改写成普通 `interrupted_ended`。普通 recovery 尝试自身失败不属于新的 fatal outcome，仍保持 interrupted 等待用户决定。

`run.status.changed` 的 from/to 相同只允许表达不改变 canonical status 的 durable barrier：冻结 finalization intent，或为原本已 `paused`、idle Direct（Run 仍为 `running`）和已 `interrupted` 的 Run记录 safe-shutdown completion。除 idle Direct 外，任何 `running` Run（包括 active Direct round 和 Gate/Task 间隙）都不能使用 `running -> running` 绕过状态机，必须先 `running -> pausing`，再以 `pausing -> paused` 完成。

### 2.2 派生健康状态

Attention 不强行扩张 Run 状态机。Run 仍为 `running`，但健康状态可以为：

```text
healthy | needs_attention | degraded
```

- 有未解决的 blocking Attention 时为 `needs_attention`。
- Runner 不可用、事件连接断开或恢复未完成时为 `degraded`。
- UI 的“等待你处理”来自健康状态和 Attention，不把界面提示文字当作新的 Run canonical 状态。

## 3. TaskExecution、TaskAttempt 与 NodeExecution 状态机

### 3.1 TaskExecution

每次 Task activation 先创建 TaskExecution；它在 Attempt 之前承载依赖、capacity、目录选择和预启动阻塞：

```text
pending -> ready | canceled
ready -> provisioning | failed | canceled | interrupted
provisioning -> blocked | running | failed | canceled | interrupted
blocked -> provisioning | failed | canceled | interrupted
running -> waiting_attention | pausing | idle | succeeded | failed | skipped | canceled | interrupted
waiting_attention -> provisioning | running | failed | skipped | canceled | interrupted
pausing -> paused | failed | canceled | interrupted
paused -> provisioning | running | canceled | interrupted
idle -> provisioning | running | succeeded | canceled | interrupted
interrupted -> provisioning | failed | canceled
```

Retry 和 Recovery 在同一 TaskExecution 中更换 current Attempt；Rework 创建新的 TaskExecution activation。首次派发、Retry、Recovery 和 Direct 新轮次在 Attempt 创建前都由 TaskExecution 的 pending attempt 字段承载，并走同一 provisioning pipeline。预启动 `fail_task` 直接终结 TaskExecution，不需要伪造不存在的 Attempt。每次 TaskExecution 状态变化追加 `task.execution.status.changed`，所有 blocked Attention 必须引用该对象和具体 SelectionRequest/资源。

显式安全退出发生在 Attempt/launch 之前时，`ready | provisioning | blocked -> interrupted` 可以保留完整 pending attempt refs，并追加 `task.execution.status.changed(reasonCode=safe_exit_before_launch)`；在此之前必须用各自的 lifecycle Event 阻塞旧 SelectionRequest、释放 assignment、撤销 Grant、终态化从未启动的 AgentInstance并释放 capacity。TaskExecution Event 再释放 claim、清空旧 target refs；这组 pending refs 仍是唯一 pre-Attempt owner。下次用户 Resume 通过 `continue_pre_attempt` target继续同一 pending work，不创建第二个 pending owner。该例外只适用于当前 TaskExecution aggregate 没有 process/cleanup candidate 或 plan owner的情况；同 Run 可以同时拥有其它 Task 的 ShutdownRecoveryPlan，不能用该例外跳过普通 provisioning 或失败处理。

安全退出收敛 source Attempt 后，TaskExecution 可以暂时没有 `currentAttemptId` 和 pending Attempt：原本处于 `running | pausing | paused` 的执行按 `running -> pausing -> paused` 收敛，无法合法进入 paused 的 `provisioning | blocked | waiting_attention` 执行进入 `interrupted`。这两种状态都由 `shutdownRecoveryPlanId` 指向的 ShutdownRecoveryPlan 独占后续恢复责任；用户 Resume 才登记新的 `pendingAttemptKind=recovery`。Attempt 和 TaskExecution 必须分别追加 Event：TaskExecution 发生状态转换时在转换 Event 中清除 `currentAttemptId`；若它原本已 paused，则追加 `task.execution.status.changed(paused -> paused, reasonCode=safe_shutdown_recovery_owner_transferred, currentAttemptId=null)` 记录 owner 转移，不能只靠 Attempt Event 暗改投影。

### 3.2 TaskAttempt

一个 Task 可以被多次激活并拥有多个不可变 TaskExecution；每个 TaskExecution 又可以保留多个不可变 Attempt。Retry 和 Recovery 在原 TaskExecution 登记 pending work 后创建新的 `attemptId`；Rework 先创建带 pending first work 的新 TaskExecution activation，完成 provisioning 后才在其中创建首个 Attempt。

TaskAttempt 每次状态变化必须追加 `task.attempt.status.changed`；TaskExecution 同步变化时在同一事务另行追加 `task.execution.status.changed`。两类 Event 必须分别携带自己的 from/to status，不能只更新当前投影后丢失历史 Attempt 的终态。

```text
pending -> ready | canceled | interrupted
ready -> starting | skipped | failed | canceled | interrupted
starting -> running | skipped | failed | canceled | interrupted
running -> waiting_attention | pausing | succeeded | skipped | failed | canceled | interrupted
waiting_attention -> running | skipped | failed | canceled | interrupted
pausing -> paused | failed | canceled | interrupted
paused -> running | canceled | interrupted
```

允许的业务规则：

- `pending` 和 `ready` 只属于已经完成 assignment、正在创建 Context/launch 的短事务边界；依赖未满足、等待 capacity、目录选择和预启动 blocked 由 TaskExecution 承载。
- `pending | ready -> interrupted` 只用于 Runtime/设备中断或安全退出收敛已经创建的 Attempt/AttemptLaunch；它必须保存稳定 `resultCode`，不能作为普通 Adapter 拒绝或用户 Retry 的捷径。
- `ready -> failed` 只用于 Attempt 已创建后的 ContextPackage 或 Adapter 接收失败；目录/权限在 Attempt 创建前失败时终结或阻塞 TaskExecution，不能伪造 Attempt。
- `starting` 只表示 Runner 已接收启动请求，不能在 UI 中伪装为 `running`。
- `skipped` 只允许 Snapshot 中 `optional=true` 的 Task。`continue_optional` 可以在 Runner 失败信号尚未提交 failed 终态时执行 `starting | running -> skipped`；人工 `skip_optional` 执行 `waiting_attention -> skipped`。已进入 `failed` 的 Attempt 不可改写，Retry 必须创建新 Attempt。
- `waiting_attention` 表示当前 Attempt 被一个或多个 Attention 阻塞。Run 为 `running` 时，Resolve 后才可回到 `running` 或进入 `failed`；Run 为 `paused | resuming` 时 TaskAttempt 始终保持单一 `waiting_attention` status，只有对应 AgentInstance/Handle 进入 paused。Resolution 只记录为 deferred，不得提前唤醒 Runner。
- `paused` 只在 Run 暂停边界确认后出现；Runner 不支持 `pauseResume` 时，活动 Attempt 保持 `running`，直到自然结束再暂停 Run。RecoveryCheckpoint 能力不能替代同一 Handle 的 pause/resume acknowledgement。
- `succeeded`、`failed`、`canceled`、`skipped`、`interrupted` 的 Attempt 不再改变；重试或恢复必须创建新 Attempt。

### 3.3 End、Gate 和 Join

Start、End、Gate 和 Join 使用各自的 `NodeExecution` 状态机，不创建 Runner Attempt：

```text
Start: pending -> reached -> completed
       pending | reached -> canceled

End:   pending -> ready -> reached -> completed
       pending | ready | reached -> canceled

Gate:  pending -> ready | canceled
       ready -> open | canceled
       open -> resolved | rejected | canceled

Join:  pending -> ready | canceled
       ready -> open | canceled
       open -> resolved | blocked | canceled
       blocked -> open | canceled
```

End NodeExecution 的 `nodeId` 必须引用带显式 `outcome=succeeded | failed` 的 EndDefinition。Runtime 不能从入边 trigger、节点名称或画布位置推断 Run 结果：

- 失败 End 到达后立即冻结 `outcome=failed` 和其 `resultCode`，停止新派发并进入 Run-finalization barrier；其它活动分支只做收敛和清理。
- 成功 End 到达只记录成功候选。只有至少一个成功 End 已完成、没有失败 End 已完成、所有已激活 NodeExecution/TaskAttempt 已终态，且不存在仍可产生 activation 的 eligible Transition 时，才进入成功 finalization。
- `any` Join 的迟到分支必须在成功提交前收敛；迟到分支在此期间到达失败 End 时失败优先。未激活的替代分支不参与等待。
- Direct Task 的最小 Workflow 固定创建一个 `outcome=succeeded` End；执行失败仍由 Task failurePolicy 或 fatal Runtime code 决定，不能把普通 End 当成隐式失败终点。

- Gate 和 Join 的每条有效入边先追加 `node.execution.input.recorded`；同一个 `nodeExecutionId + transitionRef` 重复到达只返回原结果，不重复计数。
- `all` Join 在部分分支到达时可以保持 `open`，但到达集合仍由输入事件推进；`any` Join 记录首条满足输入后再进入 `resolved`。
- Gate 进入 `open` 时创建 blocking Attention；首版 Gate 不提供非阻塞模式。
- Gate 缺少所需输入时保持 `pending`，输入完整后原子进入 `ready`；首版没有无恢复出口的 `blocked` 状态。
- Gate 的 `approved`、`rejected`、`answered` 结果只能被一次有效 Resolve 消费。
- Join 不接受人工 `rejected` 结果。`all` Join 的必需输入被证明不可达时进入 `blocked`，并在同一事务创建引用 Join NodeExecution 和缺失来源的 `join_blocked` Attention；Run 保持 `running + needs_attention`，不能停在没有可用动作的非终态。
- `join_blocked` 允许 Retry/Rework 可恢复的来源，或 `fail_run`。成功的新 Handoff 到达后执行 `blocked -> open` 并继续正常聚合；无法恢复时 `fail_run` 以 `resultCode=join_blocked` 进入 Run-finalization。重复 resolution 不重复激活 Join。
- `all` Join 必须收到所有有效分支；存在明确 Task `failure`/`skipped` Transition 绕过该 Join 时，对应未激活分支不计为 Join 缺失输入。Runtime 不能按超时或数组位置猜测不可达。
- `any` Join 在首个满足条件的分支到达后继续；其余分支不自动取消，仍按自己的状态继续，迟到的结果只作为历史 Artifact 保留。

## 4. 调度和并行

1. Runtime 根据 Snapshot 建立 NodeExecution 图，验证所有引用和能力。
2. Start 只触发一次，不占用 Runner。
3. 有效 Transition 到达 Task 时，Runtime 原子创建 TaskExecution 和 `task.execution.created`；依赖满足后它进入 `ready`，调度器根据显式 Transition 和 Runner capability 派发。
4. 创建 TaskAttempt 前，Runtime 根据 `continuedAttempts` capability、Handle liveness 和不可变 Runner Profile、execution assignment、PermissionGrant 绑定预检能否复用现有 formal AgentInstance。全部绑定一致时复用既有 assignment；否则在同一 SQLite 事务重验 Workspace/Run/parent 预算、预留 active capacity、创建 `created|provisioning` 的新 AgentInstance 和独立 PermissionGrant，并把 TaskExecution 置为 `provisioning`，不创建 Attempt。目录选择期间 reservation 仍计入上限。
5. 对新 target 实例，Runtime 创建带稳定 `selectionRequestId + requestDigest` 的 ExecutionWorkspaceSelectionRequest，冻结 TaskExecution、target Task/AgentInstance、selector binding、baseline、allowed modes 和 required path refs，先追加 `execution.workspace.requested`，再投递给 selector。formal Task 使用 active DispatcherCoordinationLease 的 Run-scoped coordination channel；transient worker 使用父 Attempt-scoped channel。selector 用同一 request ID/digest 的结构化 `execution_workspace_selection` 回答；Runtime 追加 `execution.workspace.selection_received` 并校验，成功后才创建 ExecutionWorkspaceAssignment。超时、lease/parent unavailable、回执 unknown 或冲突响应让 TaskExecution 进入 blocked + Attention，不回退默认模式。根 Dispatcher 的冻结 bootstrap assignment 是唯一免请求入口。
6. Runtime 为每个 TaskAttempt 在同一事务绑定 TaskExecution 和 `primaryAgentInstanceId`，创建 primary ContextPackage、`status=pending_prepare` 的 AttemptLaunch 和 ExecutionClaim，并依次追加 `task.attempt.created` 与 `agent.context.created`；即使没有 Handoff、Artifact、Decision 或历史选择也不能省略。新/复用 Handle 都先调用 Adapter `prepare_attempt_launch`，持久化绑定 launch ID、Attempt、Handle generation 和 digest 的 prepared receipt，再追加 `agent.context.delivered`；随后 `commit_attempt_launch` 的可靠 receipt 才允许 Attempt 和 TaskExecution 进入 running，并分别追加两类 status Event。Unknown 通过同 launch ID 查询并创建 typed `attempt_launch_unknown` Attention，不能启动第二 Handle、重复提交 Attempt 或在当前 Attempt 内 fallback。prepare 确定拒绝追加 `agent.attempt.launch.failed(phase=prepare)` 与 `agent.context.delivery_failed`，并让 Attempt/TaskExecution 进入 `failed/context_delivery_failed`；commit 确定拒绝只追加 `agent.attempt.launch.failed(phase=commit)` 并进入 `failed/attempt_launch_commit_failed`，不能改写已经 delivered 的 Context。两种确定失败都分别追加 Attempt 与 TaskExecution 的 status Event。transient worker 不复用该包，按下述派生链路建立自己的 target ContextPackage。
7. 同一批可运行 TaskExecution 可以并行，但每个 TaskExecution 只允许一个活动 Attempt。
8. Handoff 只有在上游产出通过 Contract 校验后才创建；不能因为节点状态变为完成就发送空交付。
9. Join 只消费显式来源，不按数组顺序或到达时间猜测业务关系。
10. 调度器在每次状态变更后重新计算可运行集合，重复命令不会重复派发。
11. Run 只有在显式 End outcome 规则满足、所有已激活 TaskExecution、已启动 Attempt 和 AgentInstance 进入终态、WorkerResult/Change Set 已冻结且 ExecutionWorkspaceAssignment 已释放后才能结束；`any` Join 的迟到分支或 transient worker 不能在后台留下未归档工作或继续副作用。

根 Dispatcher 的普通业务 Attempt 在 prepare 前由 Runtime 原子创建 pending DispatcherCoordinationLease，并通过 RunRequest 投递 dormant coordination channel ref；reliable Handle commit receipt 落盘后才执行 `pending -> active` 并启用 token。Dispatcher Attempt 可以按普通 success Transition 终态化；后续 formal Task 目录请求只使用 lease-scoped coordination channel，不复用已经失效的 Attempt token。active lease 阻止该 Handle 进入普通 idle stop。Handle generation、Grant、资格或 Run 生命周期变化时先 revoke；replacement Handle 必须预分配更高 generation 的新 lease，旧 request unknown 不自动重投。

Agent 派生 transient worker 时，通过绑定 Runner Handle 的结构化 `spawn_request` 进入 Runtime。Runtime 必须先创建 canonical SpawnRequest，冻结父 AgentInstance/Attempt、source signal/command、reason、Runner Profile 请求、执行目录建议、requested context refs、worker output contract、workspace scope 和 request digest，再追加请求事件。Profile 省略时继承父实例，显式指定时只能使用 RunSnapshot 允许且满足 capability 的稳定 ref；不可用时 blocked，不选择“第一个可用”。`auto | ask | deny`、并发、深度和 Run 总数通过后，固定链路为：原子预留 capacity 并创建绑定 `spawnRequestId` 的 transient AgentInstance -> 创建父 Grant 与 RunSnapshot 交集的独立 PermissionGrant -> 创建并向父 Handle投递绑定 request/digest 的 ExecutionWorkspaceSelectionRequest -> 接收结构化 selection -> 创建独立 ExecutionWorkspaceAssignment -> 创建绑定 SpawnRequest 的 worker ContextPackage/AttemptLaunch -> Adapter 两阶段 prepare/commit。可靠 LaunchReceipt 后追加 `agent.context.delivered` 并把 SpawnRequest 置为 launched。选择、Context 或启动失败时终态化 worker、释放资源和 capacity reservation，并把同一 SpawnRequest 置为 failed；unknown 保持 blocked + typed Attention，不改绑父 Attempt。`requestedWorkspaceMode` 只是进入 SelectionRequest 的建议，不能越过 request/response 关联与目录校验。spawn-capable 父 Runner 必须同时具备 `transientSpawn`、`workspaceDispatch` 和 request dedupe。worker 仍由父 Attempt 承担业务责任；需要独立负责 Workflow Task 时必须先完成 Run Amendment。

transient worker 的 completed/failed/canceled/interrupted lifecycle 只更新 worker AgentInstance、同一 SpawnRequest 和绑定 `spawnRequestId` 的 WorkerResult，不能直接改变父 Attempt 终态。Runtime 按 worker ContextPackage 的 return contract 校验后，用稳定 delivery ID 通过原 `spawnRequestId` 的结构化 result callback 向 `returnToAgentInstanceId` 投递；只有可靠 receipt 才显示 delivered。回执不明且 Adapter 无法去重查询时进入 `worker_result_delivery_unknown` Attention，禁止自动重投。父 Agent 采纳结果后仍必须由自己的 RunnerResult 和 Task Artifact Contract 满足 Task 成功条件。

父 Attempt 请求 succeeded/failed/canceled 等终态时，Runtime 先关闭该 Attempt 的新 spawn。仍活动的 worker 按冻结 return contract 标记为“等待结果”或“无需结果并 cancel”；所有 worker Handle 都已确认终态或被平台强制回收，且对应 WorkerResult、Change Set 和目录释放结果已持久化后，父 Attempt 才能提交终态。超时或回收状态不明时父 Attempt/Run 进入 interrupted/degraded 并创建 cleanup Attention，不能先终态化后让 worker 在后台继续写入。

End 到达或 fatal failure 决定 Run 终态时进入 Run-finalization barrier：关闭新派发、spawn、消息投递和 Attempt launch，收敛尚未终态的分支，停止全部 formal/transient Handles，冻结最终 WorkerResult、Artifact 和 Change Set，并释放 ExecutionClaim、assignment、capacity reservation 和临时资源。全部确认后才能追加 Run 的 `succeeded | failed | canceled`；Direct Run 的 30 分钟 idle timeout 只适用于仍非终态且可能继续对话的 Run，不能拖延已经开始的终态提交。

默认预算为 Workspace 同时活动 4 个实例、单父实例同时活动 2 个子 worker、派生深度 2、单 Run 8 个原始实例谱系节点，以及每条谱系最多 3 次 recovery replacement。恢复 replacement 不重复占用原始实例计数，但仍受活动/子级/depth 和 recovery generation 上限约束；超限创建 Attention。预算可配置，提高运行中预算需要 Amendment。并行预算、Runner 并发限制和设备资源不足表现为 `ready` 队列，不改变 Task 的语义状态。完整规则见 [m6-execution-workspace-security.md](m6-execution-workspace-security.md)。

### 4.1 计划触发

- Scheduler 只从 Schedule 引用的不可变 ScheduleLaunchTemplate 读取 OrchestrationVersion、输入、Runner 绑定、transient Profile allow-list、输出语言和 ExecutionPolicyVersion，不读取当前 Draft 或 Workspace 默认值。
- 每次计划时间先创建唯一 ScheduleFire，从 template 复制 RunLaunchSpec 并创建 RunQueueItem，再走与手动 `run.start` 相同的 Snapshot 和 Run 创建事务。
- live/catch-up pass 与 `schedule.update | enable | disable | archive | run_now` 共用 per-schedule SQLite 写事务。pass 只有在 enabled、archivedAt、generation、config digest、template、cursor 和 pending cutoff 全部仍等于计算快照时才能提交；否则整批重算，不能留下部分 fire 或推进 cursor。
- Run 记录 `launchSource=schedule` 和 `scheduleFireId`；手动与计划启动共用状态机、权限校验和 Event，不建立第二套运行模型。
- Runtime 停止期间错过的计划默认只补最新一次；`skip | latest | all`、补跑上限和重叠策略见 [m6-local-runtime-scheduling.md](m6-local-runtime-scheduling.md)。
- 计划的预授权不足时，ScheduleFire 保持 blocked 并创建 Attention；无人在线不能把 `ask` 自动变成 `allow`。

## 5. Pause、Resume 和 Cancel

### 5.1 Pause

用户点击 Pause 后立即发生：

1. Run 进入 `pausing` 过渡显示，调度器停止派发新的 Task。
2. 已进入 `starting` 的 Task 要么完成启动，要么明确记录启动失败。Runtime 为每个 Attempt 冻结 primary 与所有活动 transient Handle 的必需集合。
3. 只有一个 running Attempt 的全部必需 Handle 都声明 `pauseResume=true` 时，Runtime 才把该 Attempt 及其 TaskExecution 置为 pausing，并逐 Handle 调用 `pause(handle)`；`waiting_attention` Attempt 不改变自身及 TaskExecution status，只暂停其 Handle。每个 acknowledgement 只追加对应 `agent.instance.status.changed(paused)`。
4. running Attempt 的全部必需 Handle acknowledged 后分别只追加一次 `task.attempt.status.changed(paused)` 和 `task.execution.status.changed(paused)`；waiting_attention Attempt 的全部 Handle acknowledged 后两者仍保持 waiting_attention。任一 Handle 不支持暂停时，整个 TaskExecution/Attempt 保持原 status，各 Handle 继续到下一个可安全边界；UI 明确显示“等待当前任务结束”，不能先暂停一部分制造聚合死锁。
5. 没有活动 Attempt，或每个活动 Attempt 都处于 paused/终态，或处于 `waiting_attention` 且全部必需 Handle 已 paused 时，Run 才进入 `paused`。

用户发起的 Pause 只有在 Run 确认进入 `paused` 时，才在同一事务设置 `resumeOnStartup=false` 并追加 Run Event；`pausing` 期间仍保持 `true`。Pause 不撤销已产生 Artifact，不关闭 Attention，也不改变 Snapshot。用户可以在暂停状态查看和处理 Attention。

### 5.2 Resume

- Resume 只对 `paused` 有效，使用以下受控屏障；已完成 Attempt 不重跑。
- Runtime 先在一个事务内把 Run 置为 `resuming`、设置 `resumeOnStartup=true`，并在 `run.status.changed` payload 冻结有序的目标 Attempt/AgentInstance/coordination lease/TaskExecution refs 及 `live_handle | restart_from_safe_boundary | restart_coordination | continue_pre_attempt | deferred_attention_resolution` 类型。调度器保持停止；之后才允许调用任何 Adapter。
- `live_handle` 按冻结顺序调用 `resume(handle)`；每个 acknowledgement 只追加对应 `agent.instance.status.changed(running)`。普通 paused Attempt 的全部必需 Handle 成功后，分别只追加一次 Attempt 与 TaskExecution 的 running status Event。未解决的 waiting_attention Attempt 不恢复 Handle、不改变 TaskExecution status；已解决的 deferred resolution 先恢复所需 Handle并投递 resolution，再合法执行 `waiting_attention -> running | failed`，并分别记录两类 status Event。`restart_from_safe_boundary` 必须验证 `shutdownRecoveryPlanId`，按 plan 的 recoverable Attempt 顺序冻结该 Attempt 的全部 shutdown Handle/Launch records 和 operation。Runtime 预分配 ID，并在第一个事务幂等确认旧 Attempt 已终态化为 `interrupted/safe_shutdown_process_closed`、旧 AgentInstance 已 stopped、`currentAttemptId` 已清除，再把原 TaskExecution 以 `pendingAttemptKind=recovery`、`pendingFromAttemptId` 和 Resume `pendingCommandId` 从 `paused | interrupted` 置为 provisioning。统一 pre-Attempt pipeline 随后重新占用 capacity，并为 replacement primary 建立独立 Grant/assignment；全部必需 assignment 就绪后，创建唯一 recovery Attempt、primary ContextPackage、AttemptLaunch 和 claim，清除 pending 字段，再按原父子关系为需要继续的 transient Handle 建立新 worker AgentInstance、独立 grant/assignment、worker ContextPackage 和 AttemptLaunch。每个新实例的 recovery refs 指向对应旧实例，来源授权只作校验输入。事务提交后按冻结顺序执行 `prepare_attempt_launch`，持久化每个 prepared receipt 和 `agent.attempt.launch.prepared` 后才追加对应 `agent.context.delivered`，再执行 `commit_attempt_launch`；只有全部必需 LaunchReceipt 可靠落盘并追加 `agent.attempt.launch.committed` 后，replacement AgentInstance、recovery Attempt 和 TaskExecution 才进入 running。Unknown 只能查询原 launch ID 或进入 interrupted/Attention。不能要求已销毁的旧 Handle、复用旧授权或为同一 source Attempt 创建多个 recovery Attempt。
- `continue_pre_attempt` 只引用 process-free safe shutdown 留下的 TaskExecution 和原 pending refs。Runtime 校验它仍为 `interrupted`、`currentAttemptId` 为空、reason 为 `safe_exit_before_launch`，并确认旧 SelectionRequest/assignment/Grant/AgentInstance/capacity/claim 已按 Event 收敛且当前 TaskExecution 没有 ShutdownRecoveryPlan owner后，执行 `interrupted -> provisioning`。同 Run 存在其它 plan recovery target不构成冲突。统一 pre-Attempt pipeline 创建新的 capacity、无 recovery lineage 的普通 AgentInstance、Grant、SelectionRequest/assignment 和 claim；新 SelectionRequest 以 `retryOfSelectionRequestId` 引用 shutdown blocked 的旧请求，旧请求已 assigned 时仅用该 ID 记录 causation。原 `pendingAttemptKind/pendingFromAttemptId/pendingCommandId` 保持同一 owner；Resume command 只作为本次 causation，不覆盖 owner command，也不创建第二组 pending work。成功创建 Attempt 的事务才清空 pending refs；blocked/Unknown 仍绑定同一个 TaskExecution。
- `restart_from_safe_boundary` 的 source Attempt entry 如果包含 `coupledDispatcherCoordinationLeaseIds[]`，Runtime 在同一个 recovery AttemptLaunch prepare 前创建 matching pending replacement lease和 dormant channel。AttemptLaunch 的 prepared registration 与 committed receipt 同时绑定业务 Attempt和这些 leases；Runtime 在 commit 事务激活 lease/token。该 source lease 不得再出现于 `restart_coordination` target。
- `restart_coordination` 对 ShutdownRecoveryPlan 的每个 `coordinationRecoveries[]` entry 冻结全部 shutdown Handle/Launch records，只创建一个 replacement formal AgentInstance、capacity reservation、新 Grant/assignment、`purpose=dispatcher_coordination` ContextPackage、DispatcherCoordinationLaunch 和 pending target lease。Runtime 把 dormant channel ref 放入 CoordinationRequest，并按稳定 launch ID 执行 `prepare_coordination_launch -> commit_coordination_launch -> query_coordination_launch`；可靠 commit 后只激活该 lease/token。该路径不创建 TaskAttempt、ExecutionClaim、RunnerResult 或业务 Artifact，Unknown 创建 `coordination_launch_unknown` Attention 并禁止第二 Handle。
- 所有 live/restart/coordination/pre-Attempt 目标成功或稳定 blocked 后，Runtime 才把 Run 置为 `running`、清除已消费的 `shutdownRecoveryPlanId` 并重新启动调度器。plan 两组 recovery entry 为空但存在 `continue_pre_attempt` 时仍走 Resume；只有完整 target set 为空时不建立 resuming 屏障。idle Direct Run 的下一轮消息按新 AgentInstance 路径消费 plan。
- 任一 Handle 恢复失败时，Runtime 按相反顺序补偿已恢复或新启动的 Handle。每个 Handle 的 acknowledgement 只更新 AgentInstance。仅对已经聚合进入 running 的 Attempt，在首次补偿前追加一次 `task.execution.status.changed(pausing/compensating_resume_failure)`，全部必需 Handle 重新暂停后再追加一次 paused；尚保持 paused 的 Attempt 不写虚假转换。跨进程新 Handle 按能力选择 pause 或 cancel，但不能产生第二个 recovery Attempt。全部补偿确认后 Run 回到 `paused`、`resumeOnStartup=false` 并创建 Attention。
- 任一 re-pause 失败、新 recovery Attempt/CoordinationLaunch 启动失败、Handle 进度不明或 Runtime 在 `resuming` 期间中断时，不得宣称 paused。Runtime 把相关 Attempt/coordination recovery 和 Run 置为 interrupted/blocked 事实、保持 `resumeOnStartup=true`、健康状态置为 `degraded`，并进入正常恢复/Attention 流程。
- `deferred_attention_resolution` 来自 `attention.resolved(deferredUntilRunResume=true)` 的稳定引用，只适用于保持 `waiting_attention` 的 Attempt。Runtime 在 resuming 屏障内先恢复对应 Handle，再用独立 delivery ID 投递 resolution；全部成功的最终事务把 Attempt 从 `waiting_attention` 置为 `running | failed`，并允许 Run 进入 running。未解决的 blocking Attention 继续保持 `waiting_attention` 且 Handle paused；delivery unknown 创建新的 Attention，不能让原 Attempt 静默运行。
- 暂停期间 Draft 或 Workspace 设置的变化不自动进入当前 Run。
- 如果 Runner 配置已不可用，在进入 `resuming` 前拒绝 Resume 并创建诊断 Attention，不把 Run 静默标为失败。
- Resume 命令通过 `commandId` 幂等；同一命令重放返回当前屏障结果，其它 Resume 在 `resuming` 时返回 conflict。

`run.resume` 同时接受 `paused` 和 `interrupted`，但不共用一套实现：本节只定义 `paused -> resuming` 的 Handle 屏障；`interrupted` 必须走 10.3 的证据校验和 recovery Attempt 流程。其它状态返回 conflict。

### 5.3 Cancel

1. 用户必须确认取消，确认文本显示正在运行的 Task 数量和已产生 Artifact 数量。
2. Run 进入 `canceling`，停止新的 Task 派发。
3. Runtime 向所有 primary 和 transient Runner Handle 发送终止请求，并关闭新 spawn；每个 Handle 的结果只更新对应 AgentInstance。
4. 超过 Runner 约定超时后，记录 `termination_timeout`，再按平台能力终止进程。
5. 所有活动 AgentInstance 已确认终态、WorkerResult/Change Set 已冻结、assignment 已释放且 Attempt 已终态后，Run 进入 `canceled`。任一 Handle 无法确认回收时合法执行 `canceling -> interrupted`，保留 `terminationIntent=cancel`、`resultCode=cancel_cleanup_unknown` 和 cleanup Attention，不能宣称 canceled。

取消不会删除 Workspace、Run、Artifact 或日志。取消后的 Run 不可 Resume，只能基于 Snapshot 创建新 Run。

带 `terminationIntent=cancel` 的 interrupted Run 不允许 `run.resume` 或 `run.end_failed`；再次 `run.cancel` 只重试原终止/资源收敛，确认后经过 `interrupted -> canceling -> canceled`。Runtime 不能恢复业务工作或把取消意图改成普通失败。

## 6. 失败、重试和打回

### 6.1 failurePolicy

Task 的 `failurePolicy` 使用稳定值：

```text
stop_run | wait_human | route_failure | continue_optional
```

- `stop_run`：Runner 失败信号使 Attempt 进入 `failed`，关闭新派发并让其它并行 Attempt/worker 进入 Run-finalization cleanup；全部 Handle 和资源收敛后 Run 才失败，不能让并行分支继续副作用。
- `wait_human`：Runner 失败信号先把 Attempt 置为 `waiting_attention` 并打开异常 Attention，Run 保持 `running + needs_attention`；此时尚未提交不可变 `failed` 终态。
- `route_failure`：必须存在 `failure` Transition，沿结构化失败路径继续。
- `continue_optional`：仅允许 `optional=true` 且存在 `skipped` Transition 的 Task；Runner 失败信号使 Attempt 以稳定原因执行 `starting | running -> skipped`，再沿所有匹配的 `skipped` Transition 继续。

没有匹配策略或策略配置不完整时，按 `wait_human` 处理并标记配置错误，不自动猜测。

人工 `skip_optional` 只允许处理仍为 `waiting_attention` 的 Optional Attempt，并在同一事务执行 `waiting_attention -> skipped`、记录 Decision、resolve Attention 和激活显式 `skipped` Transition。Attempt 已是 `failed` 时该动作返回 conflict；Runtime 不把失败历史改写成跳过。Optional Task 没有有效 skipped 出边时 Workflow 校验阻止启动。

### 6.2 Retry Task

- Retry 只允许来源 Attempt 已终态但其 TaskExecution 仍为 `waiting_attention`，或来源 Attempt 正处于 exception `waiting_attention` 并走下节原子 disposition；已经终态化为 `failed` 的 TaskExecution 不可复活，改用 Rework 或从该 Task 创建新 Run。
- Retry 的原子事务终结旧 Attempt、清除 `currentAttemptId`，并在同一 TaskExecution 写入 `pendingAttemptKind=retry`、`pendingFromAttemptId` 和 `pendingCommandId` 后进入 provisioning；它不越过异步目录选择直接创建新 Attempt。后续统一 pipeline 成功后创建带 `retryOfAttemptId` 的新 Attempt，并使用该 TaskExecution 的 `effectiveSnapshotId`。
- 旧 Attempt 和其 Artifact 保留为历史；只有新 Attempt 通过 Contract 的输出才可作为后续输入。
- 如果下游 Task 尚未开始，Retry 可以在当前 Run 内继续。
- 如果下游已经开始并消费旧 Artifact，当前 Run 不回滚；UI 提供“基于此版本从该 Task 重新开始”，创建带 `sourceRunId` 的新 Run。

### 6.3 Gate Reject 与 Rework

- Reject 必须命中 Gate 的 `rejected` Transition，并携带用户评论或结构化原因。
- Rework 重新激活目标 Task，创建带 `pendingAttemptKind=first` 的新 TaskExecution，完成统一 provisioning 后才创建首个 Attempt；`activationIndex`、`reworkIteration` 分别加一。上次 Artifact 的 `currentness` 标记为 `superseded`，但不可删除。
- 达到 `maxIterations` 时不再自动回环，Gate 打开阻塞 Attention，用户可以结束 Run、调整未开始部分或创建新 Run。
- Rework 不改变组织结构；需要增加 Seat 或改变未开始 Task 时使用 Run Amendment。

### 6.4 Handoff 失败

- 上游 Task 成功但 Artifact Contract 校验失败时，Task 结果为 `failed`，而不是发送不完整 Handoff。
- Handoff 发送后下游接收失败，保留上游 Artifact 和发送 Event；重试创建引用同一 Artifact refs 的新 Handoff，并以 `handoff.superseded` 关闭旧失败项，不能重写上游 Artifact。
- Handoff 目标已被禁用或不存在时，阻塞 Runtime 校验并创建 Attention，不按名称寻找替代 Seat。
- 上游重做替换尚未消费的 queued/failed Handoff 时，在同一事务创建替代 Handoff 并追加旧项的 `handoff.superseded`；已 delivered 的 Handoff 保持不变。

## 7. Attention 生命周期与用户介入

### 7.1 生命周期

```text
open -> resolved
```

- 一个 Attention 只能被成功 Resolve 一次。
- `commandId` 是请求幂等键；Runtime 以 Attention 当前状态做事务内 compare-and-set。相同命令重放返回原结果，新命令处理已 resolved 项返回 `conflict/already_resolved`，不重复触发 Transition。
- Resolve 的业务操作或校验失败时保持 `open`，只返回可操作错误；Client 可以显示瞬时 submitting/error，但不能持久化 `resolving` 或 `resolve_failed`。
- Run-scoped Attention 产生业务判断的有效 Resolve 同时创建 DecisionRecord 并追加 `decision.recorded`；Agent 文本不能直接成为已接受决定。
- Run 为 `paused | resuming` 时，Resolve 只持久化 Decision、Attention 结果和 `deferredUntilRunResume=true`，不改变 `waiting_attention` Attempt，也不向 Runner 写入。Run Resume 时再恢复其 Handle 并用稳定 resolution delivery ID 投递；未解决的 blocking Attention 让 Attempt 保持 `waiting_attention` 且 Handle paused。
- Queue-scoped `launch_blocked` Attention 属于 Workspace 启动治理，只能更新 Runner Profile、为该项创建新的 ExecutionPolicyVersion 与 RunLaunchSpec、重试或取消队列项，不创建可注入 ContextPackage 的业务 DecisionRecord。
- 连接断开或应用重启不会把 `open` 自动变成失败。
- Attention 必须包含 Workspace scope、摘要、允许动作和创建序列。Run-scoped 项还包含来源 Run/Node/Task/Attempt 和上下文 Artifact；Queue-scoped 项包含 queue item、可选 ScheduleFire 和启动阻塞原因。

### 7.2 操作

| Attention 类型 | 允许动作 | 结果 |
|---|---|---|
| `approval` | approve / reject | 触发 Gate Transition 或 Rework |
| `question` | answer | 写入结构化答案，解除 Gate |
| `exception` | retry / skip_optional / fail_run / amend_and_rework | Retry 先终结旧 Attempt 并登记唯一 pending retry；skip 进入显式 `skipped` Transition；fail 进入 finalization；amend_and_rework 原子应用 Snapshot 后代并创建新的 TaskExecution activation |
| `join_blocked` | retry_source / rework_source / fail_run | 恢复缺失来源后重新打开 Join，或以 `join_blocked` 结束 Run |
| `spawn_approval` | approve / reject | 只重验来源、预算、目录和权限后继续或拒绝 transient spawn，不生成 Amendment |
| `staffing_request` | approve / reject | 新增 formal Seat/Task，仅影响未开始部分并生成 Amendment |
| `workspace_selection_blocked` | retry / choose_mode / fail_task | 创建新 SelectionRequest、经用户显式覆盖选择，或结束目标 Task；不自动使用默认目录 |
| `permission_operation` | approve_once / reject | 只裁决被拦截的 operation ID + digest，不扩大 PermissionGrant |
| `permission_decision_delivery_unknown` | inspect / terminate_attempt | 保留 unknown 事实并核对 operation checkpoint；不自动重发批准 |
| `message_delivery_unknown` | acknowledge / enqueue_new_attempt | 保留原 unknown 记录；或创建引用原 Message 的新 queued Message 和新 delivery ID |
| `worker_result_delivery_unknown` | acknowledge / redeliver | 保留原 unknown 事实；显式重交付创建新 delivery ID 并引用原 WorkerResult |
| `attempt_launch_unknown` | reconcile_original / terminate_attempt | 只查询原 launch ID；有 registration 时终止 Handle，没有时按原 launch ID/digest 终止 fenced process。可靠 receipt 后把 Attempt 明确置为 interrupted，不创建第二 launch |
| `coordination_launch_unknown` | reconcile_original / terminate_coordination | 只查询原 coordination launch ID；有 registration 时终止 Handle，没有时按原 launch ID/digest 终止 fenced process。可靠 receipt 后撤销 pending lease，保留 coordination recovery 待后续 Resume |
| `cleanup_unknown` | retry_cleanup / record_verified_cleanup / continue_cancel / continue_finalization | 对相同 typed resources 重试/记录人工验证证据，或按既存 cancel/finalization intent 继续原 barrier；不恢复业务或改写 outcome |

process-free safe shutdown disposition 使旧 SelectionRequest 不再可继续时，Runtime 必须用 `superseded_by_safe_exit_before_launch` 系统动作 resolve 其 open `workspace_selection_blocked` Attention。该治理动作追加 `attention.resolved` 但不创建 DecisionRecord；旧 retry/choose_mode/fail_task 入口随之失效，新 SelectionRequest 若再次 blocked 才建立新 Attention。
| `launch_blocked` | retry / update_profile / update_permission / cancel_queue_item | 修复或终止尚未创建 Run 的队列项 |

动作按钮必须在上下文完整时就地可用；需要查看对比 Artifact、填写评论或调整参数时在检查器中完成。

exception Attention 的每个动作都必须在一个受控事务给出旧 Attempt 的 disposition，不能先 resolve blocker 再留下活动的 `waiting_attention`：

- `retry`：同一事务执行旧 Attempt `waiting_attention -> failed/user_retry_requested`、分别追加 Attempt/TaskExecution status Event、清除 `currentAttemptId`、写入稳定 pending retry 字段并把 TaskExecution 置为 provisioning、记录 Decision、resolve Attention；任一步失败全部不应用。事务提交后才停止/复用旧 Handle并走 capacity、Grant、SelectionRequest、assignment、ContextPackage 和 AttemptLaunch 的统一 pipeline；失败时 TaskExecution 进入 blocked + 新 Attention，不复活原 blocker，也不创建无 assignment 的 Attempt。
- `amend_and_rework`：先建立 per-run scheduling barrier，再在一个 SQLite 事务完成旧 Attempt/TaskExecution 终结、Decision/Attention resolution、`run.amend` 全部校验、Snapshot 后代写入，以及引用来源 Attempt 的新 TaskExecution activation；`update_rework_task` 可以只为新 activation 改变权限/Runner/指令，不能热改旧 Grant。新 TaskExecution 以 `pendingAttemptKind=first` 进入统一 pre-Attempt pipeline，事务内不创建尚缺 assignment 的 Attempt。任一步失败时旧 Attempt、Attention、active Snapshot 和 activation 全部不变。
- `skip_optional`：只对 Optional Task 原子执行 `waiting_attention -> skipped`、TaskExecution `skipped`、Decision、Attention resolution 和显式 skipped Transition。
- `fail_run`：冻结 fatal result 并进入 Run-finalization，旧 Attempt 在同一事务终结为 failed；Attention 随 Decision 一并 resolved。

规格不提供只修改 Snapshot 后就 resolve 当前 exception 的裸 `amend` 动作。Amendment 只影响未开始工作；当前 Attempt 若要继续，必须由其它明确 resolution 证明原 blocker 已解除。

Unknown/cleanup resolution 也必须原子且保守：

- `reconcile_original` 只能调用对应 launch 的 query，并核对原 ID/digest/AgentInstance/registration。只有得到可靠 prepared、committed、rejected 或 not-found 证据时才 resolve Attention 并推进原状态；再次 Unknown 时 Attention 保持 open。
- `terminate_attempt | terminate_coordination` 先检查原 launch 是否已经有可信 RunnerHandleRegistration：有则调用 `terminate_handle` 并要求 matching stopped/not-found receipt；没有则调用 `terminate_launch(launchKind, launchId, requestDigest)` 并要求 matching terminated/not-found receipt。可靠 receipt、launch reconcile Event 和相应 Attempt disposition/pending lease revoke 在同一受控事务关联；任何终止状态不明都转为/保留引用原 launch/registration 的 `cleanup_unknown`，不能创建替代 Handle。
- `retry_cleanup` 只重试 Attention subjectRefs 中的同一 registration/assignment/capacity/delivery 清理；确认全部收敛后才 resolve。`record_verified_cleanup` 必须携带用户、时间、非空平台证据 refs 和逐资源结论，并在同一事务写入终态/释放 Event；`attention.resolved` 保存 `resolutionEvidenceRefs[]` 和对应 `resultEventIds[]`，确保重放能关联每项 subject、验证证据和最终资源 Event。无证据不能用此动作。
- `continue_cancel` 只接受 `terminationIntent=cancel`；`continue_finalization` 只接受已冻结 `finalizationOutcome`。两者复用原 barrier、result code 和 source ref，不能启动业务 Recovery。动作成功但清理仍 Unknown 时原 Attention 保持 open 或由同一资源的新 cleanup Attention supersede，不能宣称终态。

### 7.3 Session 消息与补充指令

Session 的 conversation 和 instruction 共用一个可审计投递合同；补充指令不是修改 RunSnapshot 的隐式入口：

- 有活动 Attempt 时，`agent.message.send` 持久化 `messageKind=conversation`，`human.inject` 持久化 `messageKind=instruction`。Runtime 先绑定 Message、目标 Attempt 和稳定 `deliveryId`，再把状态置为 `delivering` 并调用 Adapter `deliver_message`；两者都必须收到结构化 `message_receipt`，通过 `agent.message.delivery_changed` 记录 delivered、rejected 或 unknown。
- Runner 不支持实时指令时，按钮改为“加入下次尝试”。Runtime 持久化 `messageKind=instruction`、`deliveryMode=next_attempt`、`deliveryStatus=queued` 的 Message；此时 `attemptId` 和 `runnerReceipt` 为空。下次 Attempt 创建后再绑定 `attemptId` 并通过 `agent.message.delivery_changed` 记录投递结果，不改变当前 Attempt。
- Agent 回复只通过 Adapter 的结构化 `assistant_message` signal 入库。Runtime 校验来源并按 `signalId` 去重后持久化 `author=agent`、`deliveryMode=runner_output` 的 Message 和 `agent.message.recorded`；流式 delta、Terminal 文本和 `produced_output` lifecycle 不创建重复消息。

Runtime 在 `deliveryStatus=delivering` 时崩溃或丢失回执，只能在同一 live Handle/provider session 且 Adapter 声明 `messageDeliveryDedupe=true` 时，用原 `deliveryId` 重放并查询原 receipt。其它情况转为 `delivery_unknown`、追加 delivery Event 并创建 Attention，禁止自动重投；用户可明确把内容加入新 Attempt，但那会生成新的 delivery ID 和审计记录。Terminal 拥有输入权时，两种 Session 消息都不能并发写入。

实时路径必须记录作者、时间、目标 Attempt 和 Runner 回执；排队路径在 Attempt 创建前只显示“已加入下次尝试”，不能显示为已发送。两条路径都通过 Message 与投递事件回放，不能从 UI 文案推断状态。

Session 中的普通消息先持久化并绑定目标 Seat、Task 和 Run；有活动 Attempt 时按上述能力投递。长期 Seat Session 可以包含多个 Direct Task/Run 并允许自由对话，但不保存无 Task/Run 归属的消息。用户切换视图不会创建新 Attempt。

新 Direct Task 生成 `completionPolicy=explicit_close` 的单 Task RunSnapshot、新的 formal AgentInstance 和第一轮 Attempt。每轮 RunnerResult 只终结该 Attempt；Run 进入可继续对话的 idle 状态，并追加 `direct_task.idle_changed(idle)`，不激活 success End。idle Direct Run 收到 `agent.message.send` 时，在一个事务预分配下一 Attempt、Message、ContextPackage 和 delivery ID，复用同一 live formal Handle，按 `task.attempt.created -> agent.message.recorded/delivery_changed(delivering) -> agent.context.created` 入账；Context accepted 同时形成 Context 和 Message receipt，然后开始新一轮。历史上下文只能通过持久化 ContextPackage 选择性带入。

`direct_task.end` 是显式成功关闭入口，必须携带 `expected_sequence`。没有活动 Attempt/worker/Attention 时立即追加 `direct_task.close_requested(user)` 并激活成功 End；有活动 Attempt 时只冻结 close request、拒绝新消息/spawn，并等待当前回复和 worker 收敛后激活 End。`run.cancel` 仍是立即取消语义。idle 且没有 queued Message、活动 worker 或 open blocking Attention 达到 Snapshot 冻结的 timeout（默认 1800 秒）时，Runtime 追加 `direct_task.close_requested(idle_timeout)` 并走相同成功 finalization。关闭后的下一条 Seat Session 消息必须创建新 Direct Run。

消息可附加带版本引用的文件、Diff 行、交付结果、Task 或 Attention。附件超出目标 PermissionGrant 时拒绝投递并提示调整授权，不能只把路径写进 Prompt。

### 7.4 一次性权限审批

Runner 官方 hook 或平台 broker 拦截 `ask` operation 后，通过绑定 Handle/Attempt 的 Runtime request channel 提交稳定 `permissionOperationRequestId`、operation ID/kind/digest、PermissionGrant 和脱敏 intent ref。Runtime 在同步 barrier 中先持久化 `permission.operation.requested` 和 typed Attention，再让 Attempt 进入 `waiting_attention`；持久化完成前不得释放 operation。

`attention.resolve(approve_once|reject)` 使用 compare-and-set，同时创建 DecisionRecord、终结原 Attention/PermissionOperationRequest，并创建稳定 PermissionDecisionDelivery。`approve_once` 只适用于同 Handle generation 的同一 operation digest，不替换 Grant、不授权下一次相似命令。Adapter/broker 以相同 delivery ID 返回结构化 receipt 后，Runtime 才执行 `waiting_attention -> running | failed`；Run paused 时按 deferred resolution 屏障处理。

相同请求/decision/delivery digest 重放返回原结果，不同 digest conflict。审批超时等同 reject。批准 receipt unknown 时创建 `permission_decision_delivery_unknown` Attention 并保持 Attempt blocked；只有同 live hook 声明 dedupe/query 能力时可查询原 delivery，禁止自动重发批准。崩溃恢复同时检查 request、decision receipt 和 RecoveryCheckpoint；缺一项时不能推断外部操作已经执行或安全重试。

## 8. Run Amendment

运行中需要改变编排时，Client 发送 `run.amend`，canonical payload 为：

```text
runId
expected_sequence
baseSnapshotId
reason
operations[]
```

Runtime 先建立 per-run scheduling barrier，暂停新 Task 派发但不停止已运行 Task。随后在同一个 SQLite 写事务内校验 sequence、`activeSnapshotId == baseSnapshotId`、Run 状态和全部结构化 operation；成功时创建 RunAmendment 与新的不可变 RunSnapshot、更新 `activeSnapshotId` 并追加 `run.amended`。新 Snapshot 只用于尚未开始部分，既有 Attempt 保持原 `effectiveSnapshotId`。任何校验或写入失败都不创建 Amendment、不前移 active Snapshot、不追加 Event、不部分应用，并在释放 barrier 后恢复派发。相同 `commandId` 重放返回同一结果。

允许的 operation 固定为 `add_formal_seat | disable_unstarted_seat | add_task | disable_unstarted_task | update_unstarted_task | update_rework_task | update_untriggered_gate | add_transient_runner_profile_binding | increase_execution_budget | replace_unstarted_permission_grant`。它们覆盖新增 formal Seat/Task、修改未开始 Task、为 `amend_and_rework` 的新 activation 冻结配置、增加 transient Profile allow-list、提高运行中预算，以及为没有 AttemptLaunch、live Handle、coordination lease 或 operation 的未启动 TaskExecution/AgentInstance 原子替换 PermissionGrant；禁用 Seat 时必须原子处理其未开始 Task。禁止修改已完成/运行中 Task、已产生 Artifact 的含义、已解决 Gate、历史 Event，或降低正在使用的预算；活动 Attempt/Handle 不得原地扩大 Grant。`attention.resolve(approve staffing_request)` 必须调用同一事务入口，不能产生第二套 Amendment 语义。

## 9. Artifact 与版本

Project File、Change Set 和 Artifact 的边界及检查交互见 [workspace-output-inspection.md](workspace-output-inspection.md)。Run 启动时必须先捕获可复现的 Workspace baseline；启动前已有的未提交修改属于 baseline，不得归为本次 Agent 产出。

### 9.1 创建

每个 Artifact 具备：

```text
artifactId
runId
contractId
producerTaskId
producerAttemptId
producerAgentInstanceId
version
name
mediaType
contentRef
contentDigest
integrity
createdAt
validationStatus
currentness
supersedesArtifactId?
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
- 每个 Attempt 完成时冻结其 Change Set target；Run 累计 Change Set 必须能追溯到对应 Attempt，或明确标记为用户、外部程序、共同修改或未知来源。
- worktree 或临时目录结果按 `review | auto_if_clean | manual` 处理，默认 review。目标基线漂移或应用冲突创建 Attention，不能自动覆盖。

Message、Task Event、DecisionRecord、谱系、Attention、Artifact 和 Change Set 引用随 Run 历史保留。原始 Terminal/stdout 默认保留 30 天且每个 Run 最多 100 MB；EvidencePin 经脱敏后独立保留，导出和清理由 Workspace 级 HistoryExportRecord、HistoryDeletionRecord 审计。搜索、导出、清理和恢复遵循 [m6-execution-workspace-security.md](m6-execution-workspace-security.md)。

## 10. 进程退出与崩溃恢复

### 10.1 正常退出

- 关闭主窗口只等待编辑命令落盘，然后隐藏到系统托盘。Runtime、Runner、队列和计划继续运行，不改变 Run 状态。
- 用户从托盘显式退出时显示活动 Run 摘要，默认动作为“安全暂停并退出”；也可以取消 Run 后退出或返回应用。
- 安全退出先选择当前 data root 的全部非终态 Run，而不是先按进程存在性过滤。Runtime 为每个 Run 持久化唯一 `shutdownFenceId`，随即停止计划触发、新派发、spawn、新 AttemptLaunch/DispatcherCoordinationLaunch 的 prepare/commit、Session/Terminal 输入和 request channel 新 operation；fence 后到达的请求按稳定 code 拒绝。除 idle Direct 外，`running` Run 在建立 fence 的事务先追加 `running -> pausing` 的 `run.status.changed(reasonCode=safe_shutdown_requested)`；已经 `pausing | paused` 的 Run 不重复制造转换。`interrupted | canceling | resuming | preparing` Run 仍按各自 canonical barrier 收敛，不能因没有 Handle 或状态名跳过 fence。
- Runtime 独立计算每个 Run 的 process/Unknown reconciliation set 与 process-free pre-Attempt aggregate set，不把两者作为 Run 级互斥路径。存在非 stopped RunnerHandleRegistration、可能已创建 process 的 in-flight launch，或 unresolved cleanup resource 时创建 ShutdownRecoveryPlan。Runtime 对每个已登记 Handle 调用 `quiesce_for_shutdown(handle, fence)`，包括没有活动 Attempt 的 idle Direct Handle 和承载 DispatcherCoordinationLease 的 Handle。Adapter 必须返回绑定 RunnerHandleRegistration、Handle generation、fence 和最后 operation sequence 的 typed ShutdownFenceReceipt；`completed` 证明进程树已不存在，`quiesced` 只证明不再接受 operation。单一 `pauseResume` acknowledgement 不是 shutdown evidence。所有 receipt/checkpoint 与 fenced/quiesced lifecycle Event 先持久化，Runtime 再确认没有更高 operationSequence，并冻结 ShutdownRecoveryPlan：`liveHandles[]` 覆盖 fence 时全部 registered Handle，`inFlightLaunches[]` 覆盖无 registration 的 process candidate；attempt-kind record 同时冻结对应 AttemptLaunch 的 `pendingDispatcherCoordinationLeaseIds[]`，`unresolvedCleanupSubjectRefs[]` 覆盖其它 Unknown。没有这些 candidate 时不创建空 plan。
- `recoverableAttempts[]` 通过 handle/launch record arrays 覆盖每个允许业务恢复的 source Attempt；`coordinationRecoveries[]` 只覆盖没有可恢复业务 Attempt owner、但仍需要恢复的 source lease。两组对每个 shutdown Handle/Launch record 全局互斥，允许恢复的 record 恰好属于一个 owner。同一个 Dispatcher process candidate 同时承载 Attempt 和 lease 时，无论它是已登记 Handle 还是 pre-registration AttemptLaunch，该 record 都只归 source Attempt；active/pending lease 写入该 entry 的 `coupledDispatcherCoordinationLeaseIds[]`，不得再创建 coordination recovery entry。cancel/finalization intent 已冻结的 Run 不创建业务 recovery work。
- plan 与 `run.shutdown.recovery_plan_created` 落盘的同一事务把 `resumeOnStartup` 设置或保持为 true，registration 此时最多为 quiesced。Runtime 随后对 in-flight launch 调用 `terminate_launch`，对 quiesced registration 调用 `terminate_handle`，completed registration 使用原 receipt 作为 stopped evidence；所有 not-found 必须来自 typed receipt。matching evidence 落盘后才追加 launch reconcile、registration stopped、AgentInstance stopped、lease revoke 和资源 release Event。
- 列入 `recoverableAttempts[]` 的 source Attempt 在 matching process evidence 落盘后只终态化一次为 `interrupted/safe_shutdown_process_closed`；`pending | ready` 也使用 canonical shutdown 转换，不能伪装成 failed/canceled。Runtime 在独立的 `task.execution.status.changed` 中清除 `currentAttemptId`：原本处于 `running | pausing | paused` 的 TaskExecution 按 canonical 路径收敛到 paused，其它非终态 TaskExecution 进入 interrupted；已 paused 的 TaskExecution 使用 `paused -> paused / safe_shutdown_recovery_owner_transferred` self-event。两类状态都不登记 pending Attempt，plan 在用户 Resume 前是该 Attempt 的唯一恢复 owner。列入 `coordinationRecoveries[]` 的 pending CoordinationLaunch 被终止后撤销 target lease，但保留 source lease/TaskExecution owner；coupled active lease 跟随其 Attempt Handle 一次性收敛，pre-registration AttemptLaunch 的 pending coupled lease 则随 matching launch termination revoked，并保留在原 Attempt entry 中作为下次 replacement 来源。
- 无论 Run 是否创建 plan，Runtime 都要对未被任何 shutdown Handle/Launch record 或 plan owner 覆盖、且资源状态明确的 process-free pre-Attempt aggregate 执行相同 disposition。它在有界事务按适用的 `execution.workspace.blocked(safe_exit_before_launch)`、旧 selection Attention 的 `attention.resolved(superseded_by_safe_exit_before_launch)`、`execution.workspace.released`、`permission.grant.status_changed(... -> revoked)`、`agent.instance.stopped(lifecycleEvidenceKind=not_started, capacityReleasedAt)`、`task.execution.status.changed(... -> interrupted, releasedExecutionClaimId, cleared target refs)` 顺序收敛。只有 `pending_delivery | awaiting_selection | validating` 请求进入 blocked；旧请求已 blocked 或 assigned 时保留其状态，但该 request/target 的所有 open `workspace_selection_blocked` Attention 都必须由 Runtime 终结，assigned 只释放 assignment。最后一个 TaskExecution Event 保留原 pending owner。任一资源 Unknown 都进入 plan 的 `unresolvedCleanupSubjectRefs[]` 或拒绝 acknowledgement，不能留下非终态孤儿对象或仍可操作的旧 Attention。
- 所有 process/Unknown reconciliation 和 process-free aggregate 都收敛后，Run 才执行一次 canonical disposition：`pausing -> paused`、`preparing | resuming -> interrupted`、paused/idle Direct/interrupted 同状态，或继续既有 cancel/finalization 到终态。没有 pending work 的非 idle Direct `running | pausing` Run 进入 paused。`preparing` Run 若从未创建 TaskAttempt/AttemptLaunch且 pre-Attempt owner 完整，以 `preparing -> interrupted`、`resultCode=safe_exit_before_launch` 完成。`resuming` Run 若尚未为某个 target 创建新 Attempt/CoordinationLaunch/Handle，则撤销该未启动 aggregate；process recovery 回到原 plan owner，process-free work 回到 interrupted pending owner。
- 下次 Resume 的 target set 可以同时包含 plan recovery 和 `continue_pre_attempt`。后者只要求该 TaskExecution 的 aggregate 没有 plan owner，不要求整个 Run 没有 plan；它创建无 recovery lineage 的新实例并继续原 pending owner。带 coupled lease 的 recovery Attempt 在同一个 AttemptLaunch prepare 前创建 replacement pending lease和 dormant channel，并由同一个 registration/commit 激活，不创建 DispatcherCoordinationLaunch。只有 coordination-only entry 才建立独立 AgentInstance、DispatcherCoordinationLaunch 和 Handle。
- 默认优雅退出期限为 30 秒。每个选中 Run 的两类收敛工作完成后，Runtime 都必须追加唯一 `run.status.changed(reasonCode=safe_shutdown_completed, shutdownFenceId, shutdownRecoveryPlanId?, resumeOnStartup=false)`；存在 plan 时必须携带 plan ref。该 Event durable 后才算该 Run 完成；全部选中 Run 都完成后才返回 shutdown acknowledgement，Shell 随后只结束 Runtime sidecar/自身进程树。任一 termination 或 cleanup Unknown 都不返回安全 acknowledgement，保持 `resumeOnStartup=true` 并进入强制退出/marker 对账。
- 超时强制退出时，Runtime 若可响应，由 Runtime 把未确认 Attempt 置为 `interrupted` 并保持 `resumeOnStartup=true`。Runtime 不响应时，Shell 只写 supervisor shutdown marker 和诊断后终止进程树；下次 Runtime 对账时补写业务状态。Shell 不能直接修改 Attempt 或 Run。
- 注销、关机、崩溃和未确认 shutdown 的 Run 保持 `resumeOnStartup=true`，下次登录时自动进入风险感知恢复。

### 10.2 意外中断

重启后对每个非终态 Run 执行：

1. Runtime 读取 RunSnapshot、最后持久化状态、Workspace Event ledger 和各持久化投影游标。
2. Runtime 校验 Event sequence 连续性并从账本重建过期投影；账本损坏或出现无法解释的缺口时停止自动恢复并记录诊断，不能向自身请求事件或用 Client 快照补业务真相。
3. 从 `node.execution.*` 重建 Start/End/Gate/Join 的 activation、到达集合和终态，不从画布位置或 Attention 是否可见猜测 Join。
4. 检查 Runner 进程登记、ExecutionClaim、可靠 Runner 回执和各 operation 的 checkpoint set。
5. 能确认已完成的 Attempt 写入缺失终态；无法确认的活动 Attempt 置为 `interrupted`。
6. 对可证明无副作用、幂等或可从可靠 checkpoint 恢复的工作自动创建 recovery Attempt；其它 Run 保持 `interrupted + degraded`，在检查器展示“恢复、结束为失败、取消”三个明确动作。

恢复不能根据 UI 最后看到的状态猜测；必须以持久化 Event、Runner 回执或检查点为依据。

### 10.3 Resume interrupted Run

- 没有 `finalizationOutcome` 且没有 `terminationIntent=cancel` 时，`run.resume` 才是 interrupted Run 的业务恢复入口。Resume 先执行快照、Runner Profile、CLI 版本、权限、ExecutionClaim 和 Runner 能力校验；通过后只恢复没有终态的 NodeExecution/TaskExecution。存在 frozen finalization intent 时，同一命令只幂等继续原 finalization barrier，不创建 recovery Attempt、不恢复 Node/Task；cancel intent 可由重复 `run.cancel` 或 `attention.resolve(continue_cancel)` 幂等路由到同一个 frozen cancel barrier，两者不能建立第二套 outcome/source/cleanup work。
- `resultCode=startup_interrupted | safe_exit_before_launch` 只有在从未创建 TaskAttempt/AttemptLaunch、且 TaskExecution 仍保存完整 pre-Attempt pending owner 时可用。Runtime 先对账并清理仅属于该 Run 的部分初始化资源，再通过 `continue_pre_attempt` 幂等执行 `interrupted -> provisioning`；安全退出留下的 `resumeOnStartup=false` 必须由用户命令显式恢复为 `true`。任何已被 ShutdownRecoveryPlan 引用的 source Attempt 都只能从 `recoverableAttempts[]` 创建新的 recovery Attempt；coordination-only work 只能从 `coordinationRecoveries[]` 重建。其它 interrupted Run 追加 `run.recovery.started`、创建完整 recovery Attempt 后才进入 `running`。
- 已有成功 Artifact 的 Task 不重复执行；没有完整输出的 Attempt 只有在恢复边界之前所有已登记 operation 均可安全分类时才创建新的 recovery Attempt，并记录 `recoveredFromAttemptId` 和完整有序的 `recoveryContexts[]`。可靠 committed 项也必须作为 `continue_after_commit` 进入计划。
- 来源 Runner 进程已退出时必须创建新的 AgentInstance，并用独立 recovery refs 连接原 AgentInstance/Attempt；Runtime 在创建 recovery Attempt/ContextPackage 前重新建立有效 ExecutionWorkspaceAssignment 和独立 PermissionGrant。目录或授权无法按冻结策略重建时创建 Attention 并保持 interrupted/degraded。
- Runner 无法提供检查点时，只有无副作用或可验证幂等的操作可以自动从最后安全输入边界重新开始。
- 已发送但没有可靠回执的提交、发布、删除、外部写入和其它非幂等操作必须创建 Attention；Runtime 不能根据文件存在、Terminal 尾行或模型自述猜测成功。
- 恢复校验、目录/授权重建或 replacement 启动失败不能覆盖原中断信息，也不能自动把 Run 变为 failed。Run 保持 `interrupted + degraded` 并创建 typed Attention；用户修复后重试 Resume，或显式使用 `run.end_failed`/Cancel。

`run.end_failed` 是没有既存 `terminationIntent=cancel` 且没有 `finalizationOutcome` 的 interrupted Run 的唯一“结束为失败”命令。它必须携带 `runId`、`expected_sequence` 和非空 `reason`，先用 intent-only `run.status.changed(interrupted -> interrupted)` 持久化 `terminationIntent=fail`、`finalizationOutcome=failed`、`finalizationResultCode=interrupted_ended`、source ref 和 `reasonCode=end_failed_requested`，关闭恢复、派发、spawn 和消息入口，再执行与其它终态相同的 Handle/worker/assignment 收敛。全部资源确认终态后才提交 `interrupted -> failed`；状态不明时 Run 保持 `interrupted + degraded` 并创建 cleanup Attention。已有 finalization intent 时返回 `conflict/finalization_already_frozen`，由 Resume/`continue_finalization` 继续原 barrier，不能覆盖为 `interrupted_ended`。它不能替代语义为 canceled 的 `run.cancel`，也不要求先伪造 exception Attention。相同 `commandId` 重放返回原结果。

## 11. 事件顺序与快照对账

### 11.1 最小事件集合

Runtime 至少追加以下稳定事件：

```text
run.created
run.status.changed
run.shutdown.recovery_plan_created
direct_task.idle_changed
direct_task.close_requested
schedule.created
schedule.updated
schedule.archived
schedule.fire.created
schedule.fire.status_changed
run.queue.item.created
run.queue.item.reordered
run.queue.item.launch_spec_replaced
run.queue.item.status_changed
node.execution.created
node.execution.input.recorded
node.execution.status.changed
task.execution.created
task.execution.status.changed
task.attempt.created
task.attempt.status.changed
gate.opened
gate.resolved
attention.created
attention.resolved
decision.recorded
handoff.created
handoff.delivered
handoff.failed
handoff.superseded
artifact.created
artifact.superseded
artifact.consumed
run.amended
run.recovery.started
run.recovery.checkpoint_recorded
run.recovery.completed
agent.instance.created
agent.instance.status.changed
agent.instance.stopped
runner.handle.registered
runner.handle.status_changed
dispatcher.coordination.launch.created
dispatcher.coordination.launch.prepared
dispatcher.coordination.launch.committed
dispatcher.coordination.launch.failed
dispatcher.coordination.lease.created
dispatcher.coordination.lease.status_changed
agent.attempt.launch.prepared
agent.attempt.launch.committed
agent.attempt.launch.failed
agent.runner.result.created
seat.status.changed
agent.message.recorded
agent.message.delivery_changed
agent.context.created
agent.context.delivered
agent.context.delivery_failed
agent.spawn.requested
agent.spawn.blocked
agent.spawn.resolved
agent.worker.result.created
agent.worker.result.validation_changed
agent.worker.result.delivery_changed
execution.workspace.requested
execution.workspace.selection_received
execution.workspace.blocked
execution.workspace.assigned
execution.workspace.released
execution.result.review_requested
execution.result.integrated
execution.result.rejected
execution.result.integration_failed
permission.grant.created
permission.grant.replaced
permission.grant.status_changed
permission.operation.requested
permission.operation.resolved
permission.operation.delivery_changed
history.evidence.pinned
history.evidence.unpinned
history.export.requested
history.export.completed
history.export.failed
history.deletion.requested
history.deletion.completed
history.deletion.failed
```

每条事件包含：

```text
schema_version
event_id
event_type
occurred_at
workspace_id
run_id?
sequence
causation_id?
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
Pause | Resume | Cancel | End direct task | End interrupted as failed | Re-run
```

按钮根据 canonical 状态、Run source 和 Runner capability 显示 Disabled、Loading 或已完成结果；**End direct task** 只对非终态 Direct Run 显示，**End as failed** 只对 interrupted Run 显示，危险的 Cancel 进入确认菜单。

### 12.2 Task 检查器

顺序固定为：

1. Task、owner Seat、当前 Attempt 和状态。
2. 阻塞 Attention 和可用操作。
3. 输入 Artifact 与版本。
4. 当前输出、Contract 校验和 Handoff。
5. Attempt 历史、重试/打回原因。
6. Runner 回执和诊断日志（默认折叠）。
7. 关联 Change Set、文件 Diff 和 Artifact 预览入口。

操作成功后在原上下文显示新状态；不能只发全局 Toast。

### 12.3 离开运行画布

- 切换到其它 Workspace 不停止 Run。
- 关闭检查器不影响 Run。
- 关闭应用时按正常退出或意外中断流程处理，不能把离开页面误记为 Cancel。

AgentInstance 的 Session、Terminal、Activity、Changes 和 Artifacts 是同一运行上下文的不同投影。详细行为见 [m6-agent-session-collaboration.md](m6-agent-session-collaboration.md)。

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
- Retry、Reject/Rework 和跨进程 Recovery 都创建新的 Attempt，不覆盖历史结果；同一 live Handle 的 paused Resume 保持原 Attempt。
- Attention 的重复提交不会重复触发 Transition 或创建重复 Artifact。
- Optional skip 只能进入显式 `skipped` Transition；blocked Join 必须有可重试来源或 `fail_run` Attention，不能形成无动作死锁。
- End outcome、Direct Task 逐轮 Attempt/显式关闭和 interrupted `run.end_failed` 都可以从 Event 重放，不依赖 UI 推断。
- Run 启动后 Workspace Draft、Runner 默认值和 UI Locale 变化不改变 Snapshot。
- 应用重启后能通过事件序列和快照恢复；不能仅凭最后一次 UI 状态恢复。
- 事件缺口、重复和对账失败都有可见状态和重试入口。
- `zh-CN` 与 `en-US` 下状态、操作和失败原因语义一致，系统文案不把内部枚举直接展示给用户。
- 三种执行目录、派生预算和 PermissionGrant 在启动前完成校验，冲突或权限不足不会静默改模式或扩大范围。
- ExecutionWorkspaceSelectionRequest 从 Runtime 发起并绑定稳定 target ID；超时、重复冲突和重启恢复不会创建错误 assignment 或绕过容量预留。
- 长期 Seat Session 的消息、附件、搜索和恢复都能回到明确 Task/Run。

## 15. 实施约束

以下选择作为实现约束：

1. Pause 采用“立即停止新派发，活动任务按 Runner 能力到安全边界”的语义。
2. 下游已开始后不在原 Run 回滚，改为基于 Snapshot 创建新 Run。
3. 补充指令区分实时发送和下一次 Attempt 输入，不静默改变 Task 定义。
4. 中断 Run 通过对账恢复，无法确认的活动 Attempt 创建 recovery Attempt。
