# M6 Events and Commands Contract

**状态**：实施前基线（2026-08-20）
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
  "command_type": "run.pause",
  "created_at": "2026-08-18T10:00:00Z",
  "workspace_id": "ws_01J...",
  "run_id": "run_01J...",
  "expected_sequence": 41,
  "payload": {}
}
```

`run_id` 对 Workspace 级命令可为空；所有已有 Run 的操作命令必须携带。`run.start` 和 `direct_task.start` 在创建前属于 Workspace scope，成功后通过 Event 返回新 `run_id`。Draft 写命令按需携带 `expected_revision`，Run 操作按需携带 `expected_sequence`；两者不能用一个含义模糊的 `expected_version` 代替。`sequence` 在单一 Workspace 事件流内单调递增。

Domain 中唯一的命令标识名为 `commandId`；JSON 信封使用其 snake_case 表示 `command_id`。Event 的 `causation_id` 引用同一个值。协议不再定义 `clientOperationId` 或第二个幂等键。

## 3. 当前事件目录

| 事件 | 语义 |
|------|------|
| `workspace.created` / `workspace.updated` | Workspace 配置变化 |
| `workflow.updated` / `workflow.validation.changed` | 编排配置和校验变化 |
| `run.queue.item.created` / `run.queue.item.reordered` / `run.queue.item.launch_spec_replaced` / `run.queue.item.status_changed` | 手动或计划来源的持久化启动队列项、优先级调整、不可变 LaunchSpec 替换和生命周期 |
| `schedule.created` / `schedule.updated` / `schedule.archived` | 计划创建、配置、启用、禁用或归档 |
| `schedule.fire.created` / `schedule.fire.status_changed` | 一次计划时间的幂等触发、排队、阻塞、跳过或 Run 创建结果 |
| `run.created` / `run.status.changed` | Run 生命周期变化 |
| `run.shutdown.recovery_plan_created` | 安全退出销毁全部 live Handle 前冻结的不可变记账与跨进程恢复计划 |
| `direct_task.idle_changed` / `direct_task.close_requested` | Direct Run 每轮 Attempt 之间的 idle 状态和显式/超时关闭请求 |
| `node.execution.created` / `node.execution.input.recorded` / `node.execution.status.changed` | Start、End、Gate 和 Join 每次激活、入边到达和状态的可回放生命周期 |
| `task.execution.created` / `task.execution.status.changed` / `task.attempt.created` / `task.attempt.status.changed` | Task activation、预启动/运行状态和 Attempt 历史 |
| `gate.opened` / `gate.resolved` | Gate 打开和一次有效处理 |
| `seat.status.changed` | Seat 当前运行态和动作变化 |
| `agent.instance.created` / `agent.instance.status.changed` / `agent.instance.stopped` | AgentInstance 生命周期和派生来源变化 |
| `runner.handle.registered` / `runner.handle.status_changed` | opaque Runner Handle 的稳定登记、shutdown fence 和终止状态 |
| `dispatcher.coordination.launch.created` / `dispatcher.coordination.launch.prepared` / `dispatcher.coordination.launch.committed` / `dispatcher.coordination.launch.failed` | 没有业务 Attempt owner 时恢复或轮换 Dispatcher 协调 Handle 的两阶段启动 |
| `dispatcher.coordination.lease.created` / `dispatcher.coordination.lease.status_changed` | 与 Dispatcher 业务 Attempt 终态解耦的 Run 级目录协调 lease 生命周期 |
| `agent.attempt.launch.prepared` / `agent.attempt.launch.committed` / `agent.attempt.launch.failed` | 带稳定 launch ID 的两阶段 Attempt 接收与崩溃对账结果 |
| `agent.runner.result.created` | 绑定 AgentInstance、Attempt、result ID 和 digest 的 RunnerResult |
| `agent.message.recorded` / `agent.message.delivery_changed` / `agent.context.created` / `agent.context.delivered` / `agent.context.delivery_failed` | 用户消息与结构化 Agent 回复入库、Runner 投递回执，以及 Context package 创建、成功投递或失败结果 |
| `agent.spawn.requested` / `agent.spawn.blocked` / `agent.spawn.resolved` | 派生请求、预算/权限阻塞和最终处理结果 |
| `agent.worker.result.created` / `agent.worker.result.validation_changed` / `agent.worker.result.delivery_changed` | transient worker 结果、return contract 校验和向父 Handle 的结构化投递事实 |
| `execution.workspace.requested` / `execution.workspace.selection_received` / `execution.workspace.blocked` / `execution.workspace.assigned` / `execution.workspace.released` | Runtime 发起目录选择、Dispatcher 结构化响应、校验阻塞、assignment 和释放生命周期 |
| `execution.result.review_requested` / `execution.result.integrated` / `execution.result.rejected` / `execution.result.integration_failed` | 隔离结果等待检查、成功应用、拒绝或冲突失败 |
| `permission.grant.created` / `permission.grant.replaced` / `permission.grant.status_changed` | 实例有效权限建立、未启动工作经 Amendment 原子替换，以及普通撤销/到期 |
| `permission.operation.requested` / `permission.operation.resolved` / `permission.operation.delivery_changed` | `ask` operation 的一次性请求、决定和向原 hook 的回执状态 |
| `handoff.created` / `handoff.delivered` / `handoff.failed` / `handoff.superseded` | Artifact 交付关系、投递结果和未消费旧交付被明确替代 |
| `attention.created` / `attention.resolved` | 用户待办变化 |
| `decision.recorded` | 用户显式记录或通过 Attention resolution 接受的不可变决定 |
| `artifact.created` / `artifact.superseded` / `artifact.consumed` | Artifact 生命周期变化 |
| `run.recovery.started` / `run.recovery.checkpoint_recorded` / `run.recovery.completed` | 崩溃恢复、结构化副作用证据和事件对账 |
| `run.amended` | 新 Snapshot 后代已创建并用于未开始部分 |
| `runtime.diagnostic` | 不改变业务状态的诊断信息 |
| `history.evidence.pinned` / `history.evidence.unpinned` | 脱敏证据固定或取消固定 |
| `history.export.requested` / `history.export.completed` / `history.export.failed` | 选择性历史导出的生命周期 |
| `history.deletion.requested` / `history.deletion.completed` / `history.deletion.failed` | 显式历史清理和 Workspace tombstone 生命周期 |

事件 payload 必须引用 M6 Domain model 中的对象，不复制一份可写 Workflow。

### 3.1 关键事件 payload

以下字段是逻辑协议名；JSON 传输层统一转换为 snake_case。Event 可以增加向后兼容的诊断字段，但不能省略这些身份、谱系和完整性字段。

| Event | 必填 payload |
|------|--------------|
| `run.created` | `runId`、`baseSnapshotId`、`activeSnapshotId`、`launchSource`，以及适用的 `scheduleFireId`、`sourceRunId`、`restartFromTaskId`、`sourceAttemptId` |
| `run.status.changed` | `runId`、`fromStatus`、`toStatus`、`resultCode?`、`reasonCode?`、`terminationIntent?`、`finalizationOutcome?`、`finalizationResultCode?`、`finalizationSourceKind?`、`finalizationSourceRef?`、`finalizationFrozenAtSequence?`、`shutdownFenceId?`、`shutdownRecoveryPlanId?`、`resumeTargets[]?`、`resumeOnStartup`；进入 `resuming` 时 targets 必填 |
| `run.amended` | `runId`、`amendmentId`、`baseSnapshotId`、`newSnapshotId`、`operationDigest` |
| `run.shutdown.recovery_plan_created` | `runId`、`shutdownRecoveryPlanId`、`shutdownFenceId`、全部 `shutdownHandleRecordId/runnerHandleRegistrationId/agentInstanceId/handleGeneration/shutdownEvidenceKind/shutdownEvidenceRef`、`inFlightLaunches[]`、`unresolvedCleanupSubjectRefs[]`、带 handle/launch record refs 与 `coupledDispatcherCoordinationLeaseIds[]` 的 `recoverableAttempts[]`、`coordinationRecoveries[]`、`contentDigest`；attempt-kind `inFlightLaunches[]` 必须冻结对应 AttemptLaunch 的 `pendingDispatcherCoordinationLeaseIds[]`，两类 owner 对 record 全局互斥，只为存在 process/cleanup candidate 的 Run创建，此时 `resumeOnStartup` 仍为 true |
| `direct_task.idle_changed` | `runId`、`taskId`、`idle`、`idleSince?`、`idleTimeoutSeconds` |
| `direct_task.close_requested` | `runId`、`reason=user | idle_timeout`、`requestedAt` |
| `agent.instance.created` | `agentInstanceId`、`seatId`、`lifecycle`、`runnerProfileId`、`capacityReservationId`，以及互斥且完整的 spawn refs、Attempt recovery refs 或 coordination recovery lease/registration refs |
| `agent.instance.status.changed` | `agentInstanceId`、`fromStatus`、`toStatus`、`reasonCode?`、`lifecycleEvidenceKind?`、`lifecycleEvidenceRef?`、`effectiveAt` |
| `agent.instance.stopped` | `agentInstanceId`、`fromStatus`、`toStatus=stopped`、`reasonCode`、`lifecycleEvidenceKind=handle_termination | platform_not_found | shutdown_completed | not_started`、`lifecycleEvidenceRef?`、`stoppedAt`、`capacityReservationId`、`capacityReleasedAt`、适用的 released assignment/Grant refs；`not_started` 只允许从未创建 AttemptLaunch/registration/process 的实例 |
| `runner.handle.registered` / `runner.handle.status_changed` | `runnerHandleRegistrationId`、Run/AgentInstance/Profile refs、`handleGeneration`、互斥的 AttemptLaunch/CoordinationLaunch ref、from/to status、`processRegistrationRef`、reason/effective time；status Event 还必须携带 `lifecycleEvidenceKind` 与 `lifecycleEvidenceRef` |
| `dispatcher.coordination.launch.created` / `dispatcher.coordination.launch.prepared` / `dispatcher.coordination.launch.committed` / `dispatcher.coordination.launch.failed` | `dispatcherCoordinationLaunchId`、source/target lease、Run/TaskExecution/Task/AgentInstance/Context/assignment/Grant refs、`requestDigest`、`runnerHandleRegistrationId?`、from/to status、receipt ref 或稳定 result code；按 launch ID 终止时 failed/reconcile payload 必须携带 `fromStatus=pending_prepare | prepared`、`toStatus=rejected`、LaunchTerminationReceipt ref 和 `finishedAt` |
| `dispatcher.coordination.lease.created` | `dispatcherCoordinationLeaseId`、Run/TaskExecution/Task/AgentInstance/Grant refs、`generation`、`initialStatus=pending`、互斥的 source Attempt/CoordinationLaunch ref、`replacesLeaseId?`、`contentDigest`；Handle generation/registration 尚为空，Attempt-coupled recovery 必须携带 source lease ref |
| `dispatcher.coordination.lease.status_changed` | 相同 lease identity、from/to status、`handleGeneration?`、`runnerHandleRegistrationId?`、reason/effective time、`contentDigest`；进入 active/rotating 时两项必填 |
| `task.execution.created` | `taskExecutionId`、`taskId`、`effectiveSnapshotId`、`activationIndex`、`initialStatus`、`currentAttemptId?`、pending attempt refs、`selectionRequestId?` |
| `task.execution.status.changed` | `taskExecutionId`、`taskId`、`effectiveSnapshotId`、`activationIndex`、`fromStatus`、`toStatus`、`currentAttemptId?`、pending attempt refs、`selectionRequestId?`、`targetAgentInstanceId?`、`clearedSelectionRequestId?`、`clearedTargetAgentInstanceId?`、`releasedExecutionClaimId?`、`blockedReasonCode?`、`resultCode?`、`reasonCode?` |
| `task.attempt.created` | `attemptId`、`taskExecutionId`、`taskId`、`effectiveSnapshotId`、`primaryAgentInstanceId`、`attemptLaunchId`、`primaryContextPackageId`、`initialStatus`、retry/rework/recovery refs |
| `task.attempt.status.changed` | `attemptId`、`taskExecutionId`、`fromStatus`、`toStatus`、`resultCode?` |
| `execution.workspace.requested` | `selectionRequestId`、`taskExecutionId`、selector kind/AgentInstance/Handle generation、互斥的 lease/parent Attempt ref、`targetTaskId`、`targetAgentInstanceId`、`baselineRef`、`allowedModes[]`、`requiredPathAccess[]`、`deliveryId`、`requestDigest`、`retryOfSelectionRequestId?`、`timeoutAt` |
| `execution.workspace.selection_received` | `selectionRequestId`、`responseSignalId`、selector/target refs、`selectedMode`、`requestDigest` |
| `execution.workspace.blocked` | `selectionRequestId`、target refs、`fromStatus`、`toStatus=blocked`、`reasonCode`、`attentionId?`、`requestDigest`；`safe_exit_before_launch` 不创建 Attention且关闭该 request 的 response 入口 |
| `execution.workspace.assigned` | `selectionRequestId?`、`executionWorkspaceAssignmentId`、`targetAgentInstanceId`、`mode`、`baselineRef`、相对路径或 opaque path refs |
| `execution.workspace.released` | `executionWorkspaceAssignmentId`、`agentInstanceId`、`fromStatus=active`、`toStatus=released`、`reasonCode`、`releasedAt` |
| `agent.attempt.launch.prepared` | `attemptLaunchId`、`agentInstanceId`、`attemptId`、`runnerHandleRegistrationId`、`handleGeneration`、`pendingDispatcherCoordinationLeaseIds[]`、`requestDigest`、`preparedReceiptRef` |
| `agent.attempt.launch.committed` | 与 prepared 相同的 identity/registration/pending lease IDs/digest，以及 `commitReceiptRef`、`committedAt`；matching lease activation 与该 receipt 在同一 Runtime 事务投影 |
| `agent.attempt.launch.failed` | 同一 launch identity/digest、`pendingDispatcherCoordinationLeaseIds[]`、`phase=prepare | commit | reconcile`、稳定 `resultCode`、`launchTerminationReceiptRef?`；matching pending leases 必须 revoked，reconcile 必须携带 `fromStatus=pending_prepare | prepared`、`toStatus=rejected` 和 `finishedAt`，Unknown 不使用此事件伪装为失败，只有可靠 terminated/not-found 才能以 reconcile 终结 |
| `agent.runner.result.created` | `runnerResultId`、`agentInstanceId`、`attemptId`、`handleGeneration`、`outcome`、`contentDigest` |
| `agent.spawn.requested` / `agent.spawn.blocked` / `agent.spawn.resolved` | `spawnRequestId`、parent refs、source signal/command ref、requested/resolved Profile、target worker/selection/context/result refs、from/to status、`requestDigest`、稳定 reason/result code |
| `agent.message.recorded` | `messageId`、Run/Task/Seat refs、`agentInstanceId?`、`attemptId?`、`author`、`messageKind`、`deliveryMode`、`deliveryStatus`、`contentDigest` |
| `agent.message.delivery_changed` | `messageId`、`deliveryId`、`attemptId`、`fromStatus`、`toStatus`、`runnerReceiptRef?`、`contentDigest` |
| `permission.operation.requested` | `permissionOperationRequestId`、AgentInstance/Attempt/Grant refs、`handleGeneration`、`operationId`、`requestedCapability`、`operationDigest` |
| `permission.operation.resolved` | 原 request/operation/digest、`resolution=approve_once | reject | expired`、`decisionId?`、`permissionDecisionDeliveryId`；expired 不得伪造用户 Decision |
| `permission.operation.delivery_changed` | request 和 delivery refs、`fromStatus`、`toStatus`、`providerReceiptRef?`、`operationDigest` |
| `permission.grant.created` | `permissionGrantId`、`agentInstanceId`、profile/path/capability policy refs 或 digest、`inheritedFromPermissionGrantId?`、`replacesPermissionGrantId?`、`initialStatus=active`、`approvedBy?`、`createdAt`、`contentDigest` |
| `permission.grant.replaced` | `oldPermissionGrantId`、`newPermissionGrantId`、`agentInstanceId`、`amendmentId`、`sourceCommandId`、old/new 双向 link、`fromStatus=active`、`toStatus=revoked`、`reasonCode=amendment_replacement`、`effectiveAt`、old/new content digest |
| `permission.grant.status_changed` | `permissionGrantId`、`agentInstanceId`、`fromStatus`、`toStatus=revoked | expired`、`reasonCode`、`effectiveAt`；replacement 使用专用 Event |
| `attention.created` / `attention.resolved` | `attentionId`、`scopeKind`、`subjectRefs[]`、`kind`、`blocking`、稳定 action/result code；resolved 还包含 `resolvedBy`、`resolvedAt`、`resolvedDecisionId?`，`record_verified_cleanup` 必须包含非空 `resolutionEvidenceRefs[]` 与对应 `resultEventIds[]`；正文使用 `messageKey` 和 `messageParams` |

`subjectRefs[]` 的每项固定为 `{ subjectKind, subjectId }`。目录、权限、消息、worker result 和启动问题必须引用对应 request/delivery/launch 对象，不能只引用 Run 或放一段自由文本说明。

`agent.instance.created` 中 `parentAgentInstanceId + parentAttemptId + spawnRequestId` 只表示 transient spawn；`recoveredFromAgentInstanceId + recoveredFromAttemptId` 表示业务 Attempt replacement；`recoveredFromAgentInstanceId + recoveredFromDispatcherCoordinationLeaseId + recoveredFromRunnerHandleRegistrationId` 表示 coordination-only replacement。三组互斥，最后一组不得伪造 Attempt。capacity reservation 在同一创建事务占用，直到 Handle 和目录资源确认释放后才能释放。

`agent.runner.result.created` 只接受 Adapter `collect(handle, attempt_id)` 返回、且与当前 Handle generation 的 `agentInstanceId + attemptId` 完全一致的 RunnerResult。重复 collect 必须得到相同 `runnerResultId + contentDigest`；晚到结果不能完成该 Handle 后续承载的其它 Attempt。

`terminationIntent` 和决定性的 finalization intent 都必须在 cleanup 前持久化。失败 End/fatal、Cancel、`run.end_failed` 或收敛后的 success 使用 intent-only `run.status.changed` 冻结 outcome、result code、typed source ref 和 sequence；该组字段不可被后续 Pause/Resume/Cancel 或 success candidate 覆盖。`run.cancel` 通过进入 `canceling` 的 Event 同时携带 `terminationIntent=cancel` 和 canceled finalization intent；`run.end_failed` 的 cleanup 期间 Run 仍为 interrupted，因此先追加一次 `fromStatus=interrupted`、`toStatus=interrupted`、`terminationIntent=fail`、`finalizationOutcome=failed`、`finalizationResultCode=interrupted_ended`、`reasonCode=end_failed_requested` 的 Event。cleanup unknown 后两类 intent 都保留，恢复只能继续原 finalization。

显式安全退出先为全部非终态 Run建立 fence。除 idle Direct 外，`running` Run在 fence 事务先追加 `run.status.changed(running -> pausing, reasonCode=safe_shutdown_requested)`。只有存在 process/cleanup candidate 的 Run才追加 plan-created Event；该 Event 只建立第一阶段屏障并保持 `resumeOnStartup=true`。plan 是否存在与 process-free aggregate cleanup 正交：同一 Run 可以同时追加 plan recovery Event 和多个 `safe_exit_before_launch` aggregate Event。process/Unknown 与 process-free aggregate 全部收敛后，每个 Run 的最终事务才追加唯一 `run.status.changed(reasonCode=safe_shutdown_completed)`，携带同一 `shutdownFenceId`、适用时的 `shutdownRecoveryPlanId` 和 `resumeOnStartup=false`；canonical status 为 `pausing -> paused`、`preparing | resuming -> interrupted`、paused/idle Direct/interrupted 同状态或既有 finalization 终态。全部选中 Run的 completion Event 未 durable 前不能返回 shutdown acknowledgement。

安全退出终态化 recoverable source Attempt 时，`task.attempt.status.changed` 和 `task.execution.status.changed` 必须分别追加。`pending | ready` Attempt 可以用 `resultCode=safe_shutdown_process_closed` 进入 `interrupted`；已 paused 的 TaskExecution 清除 `currentAttemptId` 时必须追加 from/to 均为 paused、`reasonCode=safe_shutdown_recovery_owner_transferred`、`currentAttemptId=null` 且 pending attempt refs 为空的 self-event。其它 TaskExecution 使用自己的 canonical 状态转换携带相同 reason，不能由 Attempt Event 暗改。同一 Dispatcher process candidate 的 active lease 或 pre-registration AttemptLaunch pending lease 若列入 source Attempt 的 `coupledDispatcherCoordinationLeaseIds[]`，它由该 Attempt owner 一次性收敛；pending lease 在 matching launch termination 事务中 revoked，但仍作为该 entry 后续 replacement 的来源。同一个 shutdown record 或 source lease 不得再出现在 coordination recovery Event payload。

safe shutdown 中，未被任何 shutdown Handle/Launch record 或 plan owner 覆盖、且带完整 pending refs 的 `ready | provisioning | blocked` TaskExecution 必须在一个受控事务按顺序追加：`pending_delivery | awaiting_selection | validating` SelectionRequest 的 `execution.workspace.blocked(reasonCode=safe_exit_before_launch)`；旧 request/target 的 open `workspace_selection_blocked` Attention 对应的 `attention.resolved(resolvedBy=runtime, resolvedAction=superseded_by_safe_exit_before_launch, resolvedDecisionId=null)`；适用的 `execution.workspace.released`；active Grant 的 `permission.grant.status_changed(active -> revoked, reasonCode=safe_exit_before_launch)`；旧 `created | provisioning` target 的 `agent.instance.stopped(lifecycleEvidenceKind=not_started, reasonCode=safe_exit_before_launch)` 并释放 capacity；最后是 `task.execution.status.changed(toStatus=interrupted, reasonCode=safe_exit_before_launch)`，携带 cleared target/selection refs 和 `releasedExecutionClaimId`，同时保留相同 `pendingAttemptKind/pendingFromAttemptId/pendingCommandId`。旧 blocked/assigned request 不自转换，但不能留下 open selection Attention。任一状态 Unknown 时整个 Run不得提交 completion。后续 Resume 的 `run.status.changed(... -> resuming)` 可以同时冻结 plan recovery 与 `continue_pre_attempt + taskExecutionId + pending refs` target；后者只要求当前 TaskExecution 没有 plan owner，并创建无 recovery lineage 的新 AgentInstance、新 Grant和引用旧请求的新 SelectionRequest。新请求再次 blocked 时创建新的 Attention。

`toStatus=resuming` 的 `resumeTargets[]` 按执行顺序保存 `targetKind=live_handle | restart_from_safe_boundary | restart_coordination | continue_pre_attempt | deferred_attention_resolution` 和该类型所需的 AgentInstance、source Attempt、source lease、TaskExecution、pending owner、Attention、shutdown plan/record refs。`restart_from_safe_boundary` 必须携带 plan Attempt owner与 coupled lease IDs，`restart_coordination` 必须携带 coordination owner，`continue_pre_attempt` 必须携带 `planOwnerRef=null` 和原 pending refs。同一个 shutdown record、source lease 或 TaskExecution 不能被两个 target 重复拥有；同 Run 同时包含 plan target 与 `continue_pre_attempt` 是合法 payload。Runtime 在 resuming 时崩溃后必须重放该数组，不能按当前投影重新猜测目标集合。

## 4. 当前命令目录

| 命令 | 作用 |
|------|------|
| `workspace.create` / `workspace.update` | 创建或修改 Workspace 配置 |
| `workflow.create` / `workflow.update` / `workflow.validate` | 编辑和校验编排 |
| `run.queue.add` / `run.queue.cancel` | 用不可变 RunLaunchSpec 加入持久化队列，或取消尚未创建 Run 的队列项 |
| `run.queue.reorder` | 调整合法 queued 项的优先级，不绕过依赖、权限、Runner 或资源预算 |
| `schedule.create` / `schedule.update` | 创建或修改引用不可变 ScheduleLaunchTemplate 的计划 |
| `schedule.enable` / `schedule.disable` | 启用或禁用未来触发，不取消已创建 Run |
| `schedule.run_now` | 为计划创建一次明确的即时 ScheduleFire，仍经过权限、重叠和资源校验 |
| `schedule.archive` | 归档计划并停止未来触发；保留历史 ScheduleFire、Queue Item 和 Run |
| `run.start` | 从当前编排创建不可变 Snapshot 并启动 Run |
| `direct_task.start` | 为目标 Seat 原子创建最小 Snapshot、Run、TaskExecution、首轮 Attempt、AgentInstance 和首条绑定消息 |
| `run.pause` / `run.resume` | 暂停 Run；从 paused Handle 屏障或 interrupted recovery 恢复执行 |
| `run.cancel` | 取消 Run，进入不可逆终态 |
| `run.end_failed` | 将没有 cancel intent 的 interrupted Run 经资源收敛明确结束为失败 |
| `run.amend` | 原子创建 RunAmendment 和新不可变 Snapshot，只影响未开始部分 |
| `run.retry` / `run.rework` | Retry 在原 TaskExecution 登记 pending work 后走统一 pre-Attempt pipeline；Rework 按下游消费边界创建新 TaskExecution activation 或后代 Run |
| `direct_task.end` | 请求当前 Direct Run 在活动轮次/worker 收敛后成功关闭 |
| `attention.resolve` | 处理 Run-scoped 业务待办或 Queue-scoped 启动阻塞；后者不伪造 Run/Task DecisionRecord |
| `decision.record` | 记录绑定 Run/Task 的显式用户决定，可引用被取代的旧决定 |
| `human.inject` | 持久化 `messageKind=instruction`，向当前 Attempt 投递或明确加入下一次 Attempt |
| `agent.message.send` | 持久化 `messageKind=conversation` 且已绑定 Task/Run 的 Session 消息和附件，再按 Runner 能力投递 |
| `agent.spawn.request` | 用户从 Client 明确请求创建带父实例、父 Attempt 和 scope 的 transient worker |
| `execution.workspace.override` | 在实例启动前由用户覆盖分发 Agent 提议的执行目录模式 |
| `execution.result.integrate` / `execution.result.reject` | 应用或拒绝 worktree/临时目录冻结结果 |
| `history.evidence.pin` / `history.evidence.unpin` | 固定或取消固定一个脱敏证据引用 |
| `history.export.request` | 导出选中的 Session 或 Run 历史 |
| `history.delete.request` | 通过明确维护流程删除选定历史并保留最小 tombstone |

画布平移、缩放、选择和临时展开不发送业务命令；层级变化必须使用明确的 `workflow.update` 操作。

`schedule.update | schedule.enable | schedule.disable | schedule.archive | schedule.run_now` 的 payload 必须携带 `expected_generation`。相同 `commandId` 的重放先返回原结果；新命令的 generation 不匹配时返回 conflict，不创建 ScheduleFire、不推进 cursor，也不做部分配置更新。

Agent 自发派生不伪装成 Client Command，而是通过绑定 Runner Handle 的 `spawn_request` RunnerSignal 进入 Runtime。目录选择由 Runtime 创建 ExecutionWorkspaceSelectionRequest，并通过 Adapter `request_workspace_selection` 投递给 Dispatcher；Dispatcher 只用 `execution_workspace_selection` RunnerSignal 回答。用户主动派生仍使用 `agent.spawn.request`，两种 spawn 来源必须在 Event payload 中区分。

Agent RunnerSignal 与用户 `agent.spawn.request` 使用同一 SpawnRequest payload 核心：稳定 `spawnRequestId`、parent AgentInstance/Attempt、source signal/command、reason、可选 `runnerProfileId`、requested capabilities/workspace mode/path/context refs、必填 worker expected output contracts 和 `requestDigest`。Profile 省略时继承父实例；显式值必须来自 RunSnapshot 的 `allowedTransientRunnerProfileBindings[]`。运行中新增未冻结 Profile 需要 Amendment。worker AgentInstance、SelectionRequest、ContextPackage、WorkerResult 和 delivery 必须回指该 SpawnRequest。

Terminal 的 resize、字节输入和输出不属于 Domain Command/Event；它们通过绑定 AgentInstance/Runner Handle 的本地 Terminal 数据通道传输。终端输出不能直接改变 Task、Artifact 或 Handoff 状态。

搜索属于只读查询，不产生业务命令。导出、固定证据和删除历史使用上表的明确命令与事件；Event 只引用 EvidencePin、HistoryExportRecord 或 HistoryDeletionRecord，不包含原始 Terminal 字节和已删除正文。具体保留和脱敏规则见 [m6-execution-workspace-security.md](m6-execution-workspace-security.md)。

### 4.1 `run.amend`

canonical payload：

```text
runId
expected_sequence
baseSnapshotId
reason
operations[]
```

`operations[]` 只允许 `add_formal_seat | disable_unstarted_seat | add_task | disable_unstarted_task | update_unstarted_task | update_rework_task | update_untriggered_gate | add_transient_runner_profile_binding | increase_execution_budget | replace_unstarted_permission_grant`。最后一项只适用于尚无 AttemptLaunch、live Handle、active DispatcherCoordinationLease 或 operation 的 TaskExecution/AgentInstance；Runtime 在同一事务创建新 Grant、建立 old/new 双向 link、撤销旧 Grant，先追加新 Grant 的 `permission.grant.created`，再追加 `permission.grant.replaced`，不再追加含义重复的普通 status Event。`update_rework_task` 只与 `amend_and_rework` 同事务作用于新的 TaskExecution activation；活动 Attempt/Handle/coordination lease 不允许扩大权限。Runtime 先建立 per-run scheduling barrier，再在一个 SQLite 写事务中校验 sequence、`Run.activeSnapshotId == baseSnapshotId`、Run 状态和全部 operation。成功事务必须同时创建 RunAmendment、新的不可变 RunSnapshot、更新 `activeSnapshotId` 并追加 `run.amended`。任一校验或写入失败时不创建对象、不前移 Snapshot、不追加 Event，也不部分应用 operation。

### 4.2 `run.end_failed`

payload 必须包含 `runId`、`expected_sequence` 和非空 `reason`。命令只接受没有 `terminationIntent=cancel` 且没有 `finalizationOutcome` 的 `interrupted` Run，并先冻结 `terminationIntent=fail`、`finalizationOutcome=failed`、`finalizationResultCode=interrupted_ended` 和 source ref，关闭恢复、新派发、spawn 和消息入口。Runtime 使用 Run-finalization barrier 收敛 Handle、worker、assignment、capacity reservation 和临时资源；全部确认后才追加 `run.status.changed(failed)`。清理状态不明时 Run 保持 `interrupted + degraded` 并创建 typed cleanup Attention。已有 finalization intent 返回 conflict，并由 Resume/cleanup resolution 继续原 outcome。

### 4.3 `direct_task.start` 与 `direct_task.end`

`direct_task.start` 至少包含 `seatId`、首条消息、附件、选择的历史引用，以及可选 Runner Profile、bootstrap 目录模式、权限覆盖和输出语言。Runtime 在一个事务内创建 `completionPolicy=explicit_close` 的最小 Snapshot、Run、TaskExecution、第一轮 Attempt、capacity-reserved AgentInstance、PermissionGrant、ExecutionWorkspaceAssignment、AttemptLaunch、首条 Message 和 ContextPackage。失败不能留下无归属 Message、半创建 Run 或已启动的进程。

`direct_task.end` 必须包含 `runId` 和 `expected_sequence`。idle Run 立即追加 `direct_task.close_requested(user)` 并激活成功 End；有活动 Attempt 或 worker 时先冻结 close request、拒绝新消息和 spawn，待当前工作收敛后激活成功 End。终态 Direct Run 不复活，后续 Seat Session 消息创建新的 Direct Run。

### 4.4 Session 消息与一次性权限决定

`agent.message.send` 和 `human.inject` 分别创建 `messageKind=conversation | instruction` 的 Message，但都使用 Adapter `deliver_message`、同一种 `message_receipt`、稳定 delivery ID、dedupe 和 unknown-state 规则。Terminal 持有输入权时两者都不能并发写入。没有活动 Attempt 的 instruction 可以明确进入 `next_attempt`；conversation 不能成为无 Run/Task 归属的聊天记录。

`ask` 权限不新增第二个用户命令。Runner hook 先创建 PermissionOperationRequest 和 `permission_operation` Attention；用户通过 `attention.resolve(approve_once | reject)` 原子创建 DecisionRecord、终结 request/Attention 并创建 PermissionDecisionDelivery。`approve_once` 只匹配相同 request、Handle generation、operation ID 和 digest，不替换或扩大 PermissionGrant。批准回执 Unknown 时禁止自动重发。请求到期由 Runtime 原子写入 `resolution=expired`、system Attention resolution 和 reject delivery，不创建用户 DecisionRecord。

## 5. 幂等与并发

- Runtime 按 canonical `commandId`（传输字段 `command_id`）保存命令结果，重复提交返回同一结果。
- Scheduler 以 `scheduleId + occurrenceKey` 创建唯一 ScheduleFire；scheduled/catch-up key 来自 canonical UTC occurrence，manual key 来自 `commandId`，重复 tick、补跑扫描、命令重试和重启恢复返回同一 fire。
- Schedule 修改命令、Run now 和 live/catch-up pass 共用 per-schedule SQLite 写事务。pass 提交时重验 enabled、archivedAt、generation、config digest、launchTemplateRef、evaluationCursor 和 pendingCatchUpCutoff；stale pass 整批 abort/retry，不能留下部分 fire、Queue Item 或 cursor 更新。
- Draft 写命令可带 `expected_revision`，Run 操作可带 `expected_sequence`；不匹配时返回冲突，不静默合并。
- `attention.resolve` 通过事务内 compare-and-set 保证一个 Attention 只有一个有效 resolution。相同 `commandId` 重放返回原结果；使用新 `commandId` 处理已 resolved 项返回 `conflict/already_resolved` 并附现有结果，不追加第二个 Event。命令失败时状态保持 `open`，允许新命令重试。
- Attempt 启动先持久化 `status=pending_prepare`，再按稳定 `attemptLaunchId + requestDigest` 执行 `prepare_attempt_launch -> commit_attempt_launch`。prepared receipt 落盘前新进程保持 input fence；commit 回执丢失时只允许 `query_attempt_launch` 原 ID，不能创建第二 Handle 或把 Unknown 写成 failed。prepare 确定拒绝同时追加 `agent.attempt.launch.failed(phase=prepare)` 和 `agent.context.delivery_failed`；commit 确定拒绝只追加 `agent.attempt.launch.failed(phase=commit)`，因为已 staged 的 Context 历史不能被改写成未投递。
- 目录选择按 `selectionRequestId + requestDigest` 去重。formal Task 请求绑定 active DispatcherCoordinationLease；transient 请求绑定 parent Attempt。Runtime 在发请求前持久化 TaskExecution、target AgentInstance 和 capacity reservation；冲突响应、超时、lease/parent unavailable、投递 Unknown 或重启后无法确认原请求时进入 `workspace_selection_blocked`，不使用默认目录。重试创建带 `retryOfSelectionRequestId` 的新请求，不改写旧 request。
- Message、WorkerResult 和 PermissionDecision 的 delivery ID 各自唯一并绑定内容 digest。只有 Adapter 明确支持同一 live provider session 的 dedupe/query 时才能查询原回执；否则 Unknown 是持久化事实，禁止自动重投。
- PermissionOperationRequest 绑定 `permissionOperationRequestId + handleGeneration + operationId + operationDigest`。任何字段变化都是新 operation，不能复用旧的 `approve_once`。
- RunnerResult 绑定 `runnerResultId + agentInstanceId + attemptId + handleGeneration + contentDigest`。同一结果 ID 或 Attempt 出现不同 digest 时 conflict，不能推进 Task。
- 事件缺口通过 `after=sequence` 重连，无法补齐时先拉取快照再继续事件流。
- Event ID、Command ID、Artifact ID 和 Run ID 永不复用。

## 6. 传输

逻辑协议与传输解耦：

| 场景 | 命令 | 事件 |
|------|------|------|
| 开发预览 | HTTP | SSE |
| 桌面应用 Client -> Shell | typed Tauri IPC | Shell 转发的 typed stream |
| Shell -> Runtime | authenticated loopback HTTP | authenticated WebSocket |

生产不依赖固定 Vite Origin、固定端口或 Client 持有 Runtime token。Runtime 使用随机 loopback 端口，业务命令响应只确认接受、拒绝或冲突，结果通过 WebSocket Event stream 返回。断线通过 `sequence` 补齐，不用轮询制造业务状态。Terminal 使用独立的二进制 WebSocket channel，不进入本表的 Domain Event stream。完整连接规则见 [m6-local-runtime-scheduling.md](m6-local-runtime-scheduling.md)。

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

### 8.1 标准 Task 启动与成功结束

```text
run.start
  -> run.created
  -> node.execution.created(start)
  -> node.execution.created(gate)
  -> node.execution.created(end)
  -> run.status.changed(preparing)
  -> run.status.changed(running)
  -> node.execution.status.changed(start: reached)
  -> node.execution.status.changed(start: completed)
  -> task.execution.created(ready)
  -> agent.instance.created
  -> permission.grant.created
  -> execution.workspace.requested
  -> execution.workspace.selection_received
  -> execution.workspace.assigned
  -> task.attempt.created
  -> agent.context.created
  -> agent.attempt.launch.prepared
  -> agent.context.delivered
  -> agent.attempt.launch.committed
  -> task.attempt.status.changed(running)
  -> task.execution.status.changed(running)
  -> seat.status.changed(working)
  -> agent.message.recorded(agent reply)
  -> agent.runner.result.created
  -> artifact.created
  -> task.attempt.status.changed(succeeded)
  -> task.execution.status.changed(succeeded)
  -> handoff.created
  -> handoff.delivered
  -> node.execution.input.recorded(gate)
  -> node.execution.status.changed(gate: ready)
  -> node.execution.status.changed(gate: open)
  -> gate.opened
  -> attention.created(approval)
  -> attention.resolve(approve)
  -> decision.recorded(accepted)
  -> attention.resolved
  -> gate.resolved(approved)
  -> node.execution.status.changed(gate: resolved)
  -> node.execution.input.recorded(end)
  -> node.execution.status.changed(end: ready)
  -> node.execution.status.changed(end: reached)
  -> node.execution.status.changed(end: completed)
  -> run.status.changed(succeeded)
```

上例使用需要 Dispatcher 选择目录的新 target 实例。根 Dispatcher 的冻结 bootstrap assignment 不产生 requested/selection_received；其 AttemptLaunch prepare 前创建 pending Run-scoped DispatcherCoordinationLease 并投递 dormant channel ref，Handle reliable committed 后才激活 lease/token。普通 Dispatcher Attempt 可以完成，后续 formal selection 绑定该 lease，而不是已终态 Attempt。已通过全部绑定一致性预检的 live formal AgentInstance 可以复用已有 assignment，但每个新 Attempt 仍创建新的 AttemptLaunch、ContextPackage 和 RunnerResult。

### 8.2 Run Amendment

```text
run.amend(expected_sequence, baseSnapshotId, operations[])
  -> establish per-run scheduling barrier
  -> atomically create RunAmendment
  -> atomically create immutable descendant RunSnapshot
  -> atomically update Run.activeSnapshotId
  -> run.amended(old/new snapshot refs + operation digest)
  -> release scheduling barrier
```

Event 之前的任一步失败都回滚整个事务。已有 Attempt 保留原 `effectiveSnapshotId`，只有未开始部分读取新 Snapshot。

### 8.3 Direct Task 多轮与关闭

```text
direct_task.start(initial message)
  -> run.created(sourceKind=direct_task)
  -> node.execution.created(start/end)
  -> task.execution.created(ready)
  -> agent.instance.created
  -> permission.grant.created
  -> execution.workspace.assigned
  -> task.attempt.created(round 1)
  -> agent.message.recorded(instruction, direct_task)
  -> agent.context.created
  -> agent.attempt.launch.prepared
  -> agent.message.delivery_changed(delivered)
  -> agent.context.delivered
  -> agent.attempt.launch.committed
  -> task.attempt.status.changed(running: round 1)
  -> task.execution.status.changed(running: round 1)
  -> agent.runner.result.created(round 1)
  -> task.attempt.status.changed(succeeded: round 1)
  -> task.execution.status.changed(idle: round 1)
  -> direct_task.idle_changed(idle)

agent.message.send(round 2)
  -> task.attempt.created(round 2)
  -> agent.message.recorded(conversation)
  -> agent.message.delivery_changed(delivering)
  -> agent.context.created
  -> agent.attempt.launch.prepared(same live AgentInstance)
  -> agent.message.delivery_changed(delivered)
  -> agent.context.delivered
  -> agent.attempt.launch.committed
  -> task.attempt.status.changed(running: round 2)
  -> task.execution.status.changed(running: round 2)
  -> agent.runner.result.created(round 2)
  -> task.attempt.status.changed(succeeded: round 2)
  -> task.execution.status.changed(idle: round 2)
  -> direct_task.idle_changed(idle)

direct_task.end(expected_sequence)
  -> direct_task.close_requested(user)
  -> node.execution.status.changed(end: ready/reached/completed)
  -> run.status.changed(succeeded)
```

一轮 RunnerResult 只结束该轮 Attempt，不自动结束 Direct Run。idle timeout 使用同一关闭链路，只把 close reason 改为 `idle_timeout`。

### 8.4 `ask` operation 的 approve-once

```text
Runner permission hook blocks operation
  -> permission.operation.requested
  -> attention.created(permission_operation, typed subject refs)
  -> task.attempt.status.changed(waiting_attention)
  -> task.execution.status.changed(waiting_attention)

attention.resolve(approve_once)
  -> decision.recorded
  -> permission.operation.resolved(approve_once)
  -> attention.resolved
  -> permission.operation.delivery_changed(delivering)
  -> permission.operation.delivery_changed(delivered)
  -> task.attempt.status.changed(running)
  -> task.execution.status.changed(running)
```

只有 matching receipt 可以解除 operation。delivery Unknown 创建新的 `permission_decision_delivery_unknown` Attention，原 Attempt 保持阻塞；恢复还必须检查 RecoveryCheckpoint，不能仅凭审批记录重放副作用。

### 8.5 interrupted Run 结束为失败

```text
run.end_failed(expected_sequence, reason)
  -> run.status.changed(interrupted -> interrupted, terminationIntent=fail, finalizationOutcome=failed/interrupted_ended)
  -> freeze finalization barrier
  -> stop/reconcile primary and transient Handles
  -> freeze RunnerResult/WorkerResult/Artifact/Change Set evidence
  -> release assignments, claims, capacity, and temporary resources
  -> run.status.changed(interrupted -> failed, resultCode=interrupted_ended)
```

若任何 cleanup 状态不明，不追加最终状态事件；Run 保持 `interrupted + degraded` 并创建引用具体 Handle、assignment 或 delivery 的 Attention。

`run.queue.reorder` 只允许触及事务提交时仍为 `queued` 的项。它与 Scheduler 的 `queued -> preparing` 领取使用同一 SQLite 写事务；任一目标项已被领取时，整个命令返回 conflict 且不做部分排序。priority 越大越优先，合法 eligible 集合按 `priority DESC, COALESCE(notBefore, createdAt) ASC, createdAt ASC, queueItemId ASC` 领取。`run.queue.item.reordered` payload 携带所有受影响项的 `queueItemId`、`oldPriority`、`newPriority` 和完整 `resultingQueuedOrder[]`；事件回放和重启后的领取不得依赖当前数组或 SQLite 行顺序。

`schedule.created/updated/archived` payload 携带 new generation/config digest 及适用的 old 值；`schedule.fire.created` 携带 `sourceScheduleGeneration`、`scheduleConfigDigest`、launchTemplateRef 和 occurrenceKey。`agent.instance.created` 使用三组互斥谱系：transient spawn 携带 parent AgentInstance/Attempt/SpawnRequest refs；Attempt recovery 携带 recovered AgentInstance/Attempt refs；coordination-only recovery 携带 recovered AgentInstance/DispatcherCoordinationLease/RunnerHandleRegistration refs，且不创建 TaskAttempt。跨进程 Attempt recovery 中，`permission.grant.created` 与 `execution.workspace.assigned` 必须先于新 `task.attempt.created` 和 `agent.context.created`；coordination-only recovery 中两者先于 `agent.context.created` 与 `dispatcher.coordination.launch.created`。

`agent.spawn.requested/blocked/resolved` payload 必须投影 canonical SpawnRequest，冻结 `spawnRequestId`、请求与最终选择的 Runner Profile ref、`inherited | explicit` 来源、parent/source refs、target worker/selection/context/result refs、requested context refs、expected output contracts 和 `requestDigest`。`agent.worker.result.created/validation_changed` 引用稳定 WorkerResult 和 SpawnRequest；`agent.worker.result.delivery_changed` 引用 WorkerResultDelivery、SpawnRequest 和 delivery ID，不复制结果内容。worker lifecycle 只能改变 worker AgentInstance/SpawnRequest，不能直接产生父 `task.execution.status.changed(succeeded|failed)`。回执不明时创建 `worker_result_delivery_unknown` Attention，禁止自动重投。

`run.created` payload 至少携带 `runId`、`baseSnapshotId`、`activeSnapshotId`、`launchSource`，以及适用的 `scheduleFireId`、`sourceRunId`、`restartFromTaskId` 和 `sourceAttemptId`。从 Task 重新开始的谱系引用必须指向同一来源 Run，且新 Attempt 的输入 Artifact refs 已冻结。

需要人工确认交付结果时使用 Gate/Attention 及 `attention.resolve`，Artifact 自身只保存 Contract validation 和 currentness，不定义第二套人工 accept/reject 状态机。

`seat.status.changed(working)` 是 Seat 的用户界面投影，不是 TaskAttempt canonical status。客户端只根据事件更新业务投影；handoff 脉冲和检查器打开属于事件驱动的表现层行为。

## 9. 验收门槛

- [ ] 所有命令和事件都有稳定 ID、版本和作用域
- [ ] Snapshot、Runtime State、Artifact 和 Workflow 没有混写
- [ ] 断线重连、快照回退和重复命令有测试
- [ ] Amendment、AttemptLaunch、目录选择、消息/权限 delivery 和 RunnerResult 的崩溃窗口有去重与 Unknown-state 测试
- [ ] `uiLocale` 与 `outputLocale` 在协议中保持分离
- [ ] 执行目录、权限、派生请求和 Session 附件事件不包含绝对路径、密钥或完整环境变量
- [ ] [m6-domain-model.md](m6-domain-model.md)、[m6-run-operations.md](m6-run-operations.md) 与本协议字段一致
