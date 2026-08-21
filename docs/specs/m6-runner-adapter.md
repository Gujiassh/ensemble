# M6 Runner Adapter Contract

**状态**：实施前基线（2026-08-20）
**默认 Runner**：`pi`
**原则**：Runner 可替换，编排逻辑不绑定具体 CLI

首版只提供随 Runtime 交付的官方 `pi`、Codex CLI 和 Claude Code Adapter。三个 CLI 本体都由用户安装、更新和完成原生登录；首版不加载第三方 Adapter。

## 1. 责任

Runner Adapter 将统一的 Run 工作转换成某个执行引擎的探测、启动、控制和输出。它不负责：

- 选择 Task 顺序或修改 Workflow
- 创建或修改 Role、Seat、Group
- 决定人工 Gate 是否通过
- 将私有 CLI 日志直接暴露给 Client
- 绕过 Runtime 写入 Artifact 或 Run State

## 2. 能力描述

每个 Adapter 必须提供稳定的描述：

```json
{
  "id": "pi",
  "displayName": "pi",
  "supportedPlatforms": ["windows", "macos", "linux"],
  "capabilities": {
    "sessionProjection": true,
    "contextDelivery": true,
    "pauseResume": false,
    "cancel": true,
    "messageDelivery": true,
    "messageDeliveryDedupe": true,
    "activityObservation": true,
    "activityEvidenceKinds": ["official_hook", "adapter_lifecycle", "provider_session"],
    "providerSessionResume": false,
    "retainedInspection": false,
    "continuedAttempts": true,
    "attemptLaunchDedupe": true,
    "terminalAttach": true,
    "terminalResize": true,
    "transientSpawn": true,
    "workerResultDelivery": true,
    "workerResultDeliveryDedupe": true,
    "workspaceDispatch": true,
    "workspaceDispatchRequestDedupe": true,
    "shutdownQuiesce": true,
    "permissionDecisionDelivery": true,
    "permissionDecisionDeliveryDedupe": true,
    "permissionEnforcement": {
      "filesystemScope": true,
      "networkPolicy": true,
      "processPolicy": true,
      "destructiveApproval": true,
      "externalPublishApproval": true
    },
    "structuredOutput": true,
    "artifactCollection": true,
    "coordinationContractVersions": ["ensemble-coordination-v1"],
    "operationGuideVersions": ["ensemble-operations-v1"],
    "completionReceiptVersions": ["ensemble-completion-v1"],
    "recoveryCheckpoint": true,
    "checkpointResume": true
  },
  "requiredConfiguration": [],
  "version": "adapter-contract-v1"
}
```

上例是 `pi` 在 F3-B 作为 Dispatcher 时必须达到并由 Spike/契约测试证明的目标描述，不是当前实现证据。缺少 `transientSpawn` 或 `workspaceDispatch` 的 Runner 仍可承担不需要这两项能力的 formal Task，但不能绑定 Dispatcher Task 或执行对应请求。

能力是事实声明，不是 UI 假设。Runtime 必须根据能力决定 Pause/Resume、消息投递等命令能否执行。正式 supported Runner 的设备探测必须同时证明 `sessionProjection=true`、`terminalAttach=true`、`contextDelivery=true` 和 `messageDelivery=true`。当前 Workspace PermissionGrant、Task、Dispatcher、派生、协调合同、操作指南、completion receipt 和恢复所需的其它 capability/version 通过独立 RunnerQualification 判断；qualification 必须分别校验 ContextPackage 引用的 `coordinationContractRef`、`operationGuideRef` 和适用的 `completionReceiptSchemaRef` 是否命中 Adapter 声明的版本集合。不合格 Profile 不能用于该 binding，但不能把设备级 RunnerInstallation 从 `available` 改成其它状态。

## 3. 探测结果

探测必须区分以下结果：

```text
available
installed_incompatible
missing_configuration
unsupported_platform
not_installed
probe_failed
```

以上值是 Domain、Adapter 和 Client 共用的设备级 canonical availability status。`probing` 只属于 Client 的瞬时请求状态，不持久化。探测结果至少包含：`runner_id`、Adapter 版本、CLI 版本、支持范围、平台、原生登录状态、可操作原因、配置字段、已探测 capability 和探测时间。`signed_out` 通常返回 `missing_configuration`，但 Adapter 不读取账号 Token。

Workspace/Task 所需 capability、合同版本和 PermissionGrant enforcement 不进入该枚举。Runtime 使用 installation probe digest、Profile、ExecutionPolicy、required capabilities 和 required contract versions 创建独立 RunnerQualification，Client 分开展示“设备不可用”和“当前 Workspace 不合格”，后者区分 missing capability 与 missing contract version reasons。

## 4. 运行接口

逻辑接口如下，传输协议由 Runtime 决定：

```text
probe(context) -> Availability
prepare_attempt_launch(handle?, request) -> PreparedLaunch | ExistingLaunch | Rejected | Unknown
commit_attempt_launch(commit_request) -> LaunchReceipt | Rejected | Unknown
query_attempt_launch(attempt_launch_id) -> PreparedLaunch | LaunchReceipt | NotFound | Unknown
prepare_coordination_launch(request) -> PreparedCoordinationLaunch | ExistingCoordinationLaunch | Rejected | Unknown
commit_coordination_launch(commit_request) -> CoordinationLaunchReceipt | Rejected | Unknown
query_coordination_launch(coordination_launch_id) -> PreparedCoordinationLaunch | CoordinationLaunchReceipt | NotFound | Unknown
terminate_launch(launch_termination_request) -> LaunchTerminationReceipt | Unknown
read(handle) -> RunnerSignal stream
attach_terminal(handle) -> TerminalStream | Unsupported
resize_terminal(handle, columns, rows) -> Accepted | Unsupported | Failed
write_terminal(handle, bytes) -> Accepted | Rejected
deliver_message(handle, message_delivery) -> Accepted | Rejected | Unknown
request_workspace_selection(selector_handle, selection_request) -> Accepted | Rejected | Unknown
deliver_permission_decision(handle, permission_decision_delivery) -> Accepted | Rejected | Unknown
deliver_worker_result(handle, worker_result_delivery) -> Accepted | Rejected | Unknown
pause(handle) -> Accepted | Unsupported | Failed
resume(handle) -> Accepted | Unsupported | Failed
cancel(handle) -> Accepted | Failed
quiesce_for_shutdown(handle, shutdown_fence) -> ShutdownFenceReceipt | Unsupported | Failed
terminate_handle(handle, handle_termination_request) -> HandleTerminationReceipt | Unknown
collect(handle, attempt_id) -> RunnerResult
```

`RunRequest` 必须包含：

```text
workspace_id
run_id
attempt_launch_id
request_digest
task_execution_id
task_id
seat_id
agent_instance_id
attempt_id
execution_workspace_assignment_ref
permission_grant_ref
execution_path
context_package_ref
spawn_request_id?
runtime_request_channel_ref?
coordination_channel_ref?
pending_dispatcher_coordination_leases[]?
recovery_contexts[]?
recovery_plan_digest?
rendered_prompt
inputs[]
expected_artifacts[]
output_locale
long_wait_policy
```

`CoordinationRequest` 只用于 DispatcherCoordinationLaunch：

```text
workspace_id
run_id
coordination_launch_id
source_dispatcher_coordination_lease_id
target_dispatcher_coordination_lease_id
request_digest
dispatcher_task_execution_id
dispatcher_task_id
seat_id
agent_instance_id
execution_workspace_assignment_ref
permission_grant_ref
execution_path
context_package_ref
coordination_channel_ref
output_locale
```

prepare receipt 落盘后由 Runtime 创建或确认 RunnerHandleRegistration；Adapter 只有在收到 typed commit request 后才知道该 Domain identity：

```text
AttemptLaunchCommitRequest
  attempt_launch_id
  request_digest
  runner_handle_registration_id
  handle_generation
  prepared_receipt_ref
  pending_dispatcher_coordination_lease_ids[]

CoordinationLaunchCommitRequest
  coordination_launch_id
  request_digest
  runner_handle_registration_id
  handle_generation
  prepared_receipt_ref
```

Adapter 必须校验 commit request 与原 prepared identity/digest/process ref 一致；Attempt commit 的 pending lease IDs 还必须与 prepare request 和 PreparedLaunch 完全一致。Adapter 将 registration ID、matching dormant channel binding 与 provider launch record 一起持久化后才返回 committed receipt。query 在 commit 前只返回 Adapter 自己已知的 prepared identity；commit 后可以返回包含 registration ID 和 matching pending lease IDs 的原 receipt。Runtime 不能要求 Adapter 在收到 commit request 之前回显本地事后创建的 registration ID。

prepare 可能已经创建 fenced process，但 Runtime 尚未收到 receipt、因此没有可信 Handle 或 RunnerHandleRegistration。safe shutdown 还需要区分已停止与只冻结的 registered Handle。两类窗口使用以下 typed receipt 收敛：

```text
ShutdownFenceReceipt
  runner_handle_registration_id
  handle_generation
  shutdown_fence_id
  result                       completed | quiesced
  last_operation_sequence
  provider_evidence_ref
  recorded_at

LaunchTerminationRequest
  launch_kind                  attempt | dispatcher_coordination
  launch_id
  request_digest
  reason_code

LaunchTerminationReceipt
  launch_kind
  launch_id
  request_digest
  result                       terminated | not_found
  process_registration_ref?
  handle_generation?
  provider_evidence_ref
  terminated_at

HandleTerminationRequest
  runner_handle_registration_id
  handle_generation
  reason_code
  shutdown_fence_id?

HandleTerminationReceipt
  runner_handle_registration_id
  handle_generation
  result                       stopped | not_found
  provider_evidence_ref
  stopped_at
```

`terminate_launch` 必须按 `launch_kind + launch_id + request_digest` 去重，先保持/建立 input fence，再终止该 launch 创建的进程树；相同 ID 不同 digest conflict。只有可靠 `terminated | not_found` receipt 才能把未 committed Domain launch 从 `pending_prepare | prepared` 置为 `rejected`，保存 `launch_reconciled_terminated | launch_reconciled_not_found`、receipt ref 和完成时间，并追加对应 `*.launch.failed(phase=reconcile)`；AttemptLaunch 还必须在同一收敛事务 revoke 其完整 `pending_dispatcher_coordination_lease_ids[]`，这些 lease ID 仍保留在原 recoverable Attempt entry 中作为后续 replacement 来源，不能转成 coordination-only owner。再次 Unknown 时 launch 和 pending lease 保持最后可靠 status 与原 Attention。已有可信 RunnerHandleRegistration 或 Domain launch 已 committed 时改用 `terminate_handle`，不能同时走两条终止路径或改写 committed launch。

`terminate_handle` 用于已登记 Handle 的 safe shutdown、finalization 和 cleanup。Adapter 按 `runner_handle_registration_id + handle_generation` 去重；相同 identity/generation 的重复请求返回原 receipt，不同 generation 或冲突的 shutdown fence/reason 返回 conflict。receipt 必须回显相同 identity/generation、`stopped | not_found`、provider evidence ref 和完成时间。只有 receipt 持久化后 Runtime 才能追加 `runner.handle.status_changed(... -> stopped)`、终态化 AgentInstance 并释放 assignment/capacity；Unknown 进入 typed cleanup Attention。

`terminate_launch` 和 `terminate_handle` 不返回裸 `NotFound`；not-found 必须是 typed receipt 的 `result`，并携带 matching identity/digest 或 registration/generation、provider evidence 和完成时间。`ShutdownFenceReceipt.result=completed` 同样必须证明匹配 registration/generation 的整个进程树已不存在，可在 ShutdownRecoveryPlan 落盘后作为 `shutdown_completed` stopped evidence；`quiesced` 只证明 fence 后不再接受 operation，仍要调用 `terminate_handle`。任一裸状态或缺证据返回都按 Unknown 处理。

`prepare_coordination_launch` 只用于没有 recoverable business Attempt owner 的 coordination-only replacement。它必须创建新的 fenced Handle，不得复用来源 generation 或绑定已终态 Attempt。Runtime 在 prepare 前已持久化 replacement AgentInstance、Grant/assignment、`purpose=dispatcher_coordination` ContextPackage、CoordinationLaunch、pending target lease 和 dormant coordination channel ref；prepared receipt 首次返回 Handle 时创建 RunnerHandleRegistration。PreparedCoordinationLaunch 至少包含 coordination launch ID、AgentInstance、target lease ID、Handle generation、process registration ref、request digest、prepared receipt ref 和 `status=prepared`。Runtime 创建 registration 后把其 ID纳入后续 commit/query 对账。若 source lease 已作为某个 recoverable Attempt 的 coupled lease，Adapter 必须拒绝独立 CoordinationRequest。

`commit_coordination_launch` 只确认 CLI 已绑定 dormant channel，不开始业务 Task 或产出 RunnerResult。CoordinationLaunchReceipt 至少包含相同 launch/AgentInstance/target lease/generation/request digest、commit request 提供的 RunnerHandleRegistration ID、commit receipt ref、`status=committed` 和 `committedAt`；Runtime 持久化 receipt 后才原子激活 target lease/token。prepare/commit/query 按 `coordination_launch_id + request_digest` 去重，query 必须返回同一 prepared/committed identity；不同 digest conflict，Unknown 只查询或终止原 ID，拒绝时 pending lease revoked。

Runner 不接收整个 Workflow，也不接收会改变历史 Snapshot 的配置。

`prepare_attempt_launch` 对首个 Attempt 创建带 `attempt_launch_id` 标记、已登记但仍被输入 fence 阻塞的新 Runner process Handle；对 continued Attempt 在原 Handle 中暂存新的 ContextPackage、expected artifacts 和 recovery contexts。Dispatcher 初次启动或 coupled recovery 的 `pending_dispatcher_coordination_leases[]` 每项至少包含 target lease ID、可选 source lease ID 和 dormant channel ref，并已绑定同一个 AgentInstance、Grant、assignment 与 request digest。Adapter 在同一个 prepared process 上暂存这些 channel binding。两种路径都不能在 `commit_attempt_launch` 前开始模型工作、发出外部 operation、启用 coordination channel 或把 Context 显示为已执行。PreparedLaunch 至少包含 launch ID、AgentInstance、Attempt、Handle generation、process registration ref、request digest、prepared receipt ref 和 matching pending lease IDs。

Runtime 必须先依据 `continuedAttempts`、Handle liveness 和相同 Workspace、Run、Seat、AgentInstance、Runner Profile、execution assignment、PermissionGrant 绑定完成复用预检；不兼容时创建新 AgentInstance。TaskAttempt、AttemptLaunch、ContextPackage、ExecutionClaim 和适用的 pending DispatcherCoordinationLease 在 prepare 前同事务持久化。prepared receipt 首次返回 Handle 时，Runtime 创建带稳定 `runnerHandleRegistrationId` 的 RunnerHandleRegistration；continued Handle 返回已有登记。prepared receipt 落盘后 Runtime 才发送包含原 launch ID/digest、registration ID、generation 和 prepared receipt ref 的 typed commit request；LaunchReceipt 绑定相同 identity、matching pending lease IDs 和 committed status。Adapter 提交同一个 business input fence 与 dormant channel binding 后返回 receipt；Runtime 持久化 receipt 的事务再激活 matching lease/token。`attemptLaunchDedupe=true` 要求 prepare、commit 和 query 对相同 ID/digest 返回原结果，不同 digest conflict。

崩溃窗口固定处理：prepare 调用前可重试；进程已创建但 prepared receipt 未持久化时，只能 query 原 ID，或用 `terminate_launch` 按同 ID/digest 终止仍 fenced 的 process；prepared 后 commit 前恢复原 typed commit request，或用可信 registration 终止 Handle；commit 回执丢失时 query 原状态。任何 Unknown 都进入 interrupted/Attention，不能新建第二 Handle、再次 commit 同一 Attempt 或在当前 Attempt 内 fallback。

`execution_workspace_assignment_ref` 和 `permission_grant_ref` 指向 Runtime 已验证的目录及权限记录。Runner 只能使用解析后的 `execution_path`，不能自行回退到 Workspace 根目录。`context_package_ref` 必须以 `targetAgentInstanceId` 指向本次 request 的实例，并引用 Runtime 已持久化的 Task、Handoff、Artifact、immutable DiffReviewBundle、决策和 Workspace scope。它还必须携带版本化 coordination contract、operation guide 和 allowed Runtime operations；primary/transient package 还必须携带 completion receipt schema，dispatcher coordination package 必须省略它。Adapter 负责将该包渲染为目标 CLI 可理解的启动输入；`rendered_prompt` 只能是该包和引用 Message 的派生传输内容，不能保存另一份自由文本协作真源。Adapter 不支持 matching contract/schema version 时必须拒绝 prepare，不能以自然语言兼容后继续。

`context_package_ref` 对所有 RunRequest 必填。无历史或上游交付时仍引用最小包，其 Handoff、Artifact、Decision 和 history arrays 可以为空，但 Task/Attempt、scope、assignment、grant 和 output contracts 不能缺失。

`runtime_request_channel_ref` 在 Adapter 需要 Attempt 内结构化 callback 时提供，包括 `transientSpawn`、parent workspace selection、`recoveryCheckpoint` 和 permission hook。它绑定 AgentInstance、Attempt、Handle generation 和 PermissionGrant；Attempt 终态或 Handle 停止后立即失效，并按请求种类签发最小 capability scope。拥有 `checkpoint_commit` 权限不等于拥有派生、目录分配或权限修改能力。

Dispatcher 使用独立 `coordination_channel_ref`。Initial Dispatcher RunRequest、带 coupled lease 的 Recovery RunRequest 和 coordination-only CoordinationRequest 可以携带预分配 pending lease 的 dormant ref，使 CLI 在对应 launch commit 中确认绑定；Runtime 在 lease active 前拒绝其调用。一个 source lease 只能选择 Attempt-coupled 或 coordination-only 其中一条启动合同，不能同时进入两次 prepare/commit。激活后 channel 绑定 lease ID、Run、Dispatcher AgentInstance、Handle generation、PermissionGrant 和 `workspace_selection` scope，不绑定已终态业务 Attempt，也不能提交 spawn、checkpoint、permission operation 或结果。lease revoke/rotate、Handle generation 变化或 Run finalization 后立即失效。两种 channel 都不是通用 Shell，也不能接受任意 Domain Event 写入。

Recovery Attempt 的 `recovery_contexts[]` 每项必须包含：

```text
sourceAttemptId
sourceAgentInstanceId
recoveryCheckpointRef
strategy                     restart_before_dispatch | restart_no_side_effect | retry_idempotent | resume_runner | continue_after_commit
operationId
operationSequence
idempotencyKey?
targetStateRef?
runnerResumeRef?
committedResultRef?
```

Runtime 从已持久化 RecoveryCheckpoint 构造按 Attempt 全局 `operationSequence` 排序的完整恢复计划，覆盖恢复边界之前所有已登记 operation，并计算 `recovery_plan_digest`。每个恢复后的 Handle 只接收 `sourceAgentInstanceId` 等于其 `recoveredFromAgentInstanceId` 的有序子集，但所有 RunRequest 携带同一个完整计划 digest；Runtime 必须先验证各 Handle 子集的并集完整且不重复，再启动任何一个 Handle。带 coupled lease 的 request 还必须与同一 ShutdownRecoveryPlan entry 的 `coupledDispatcherCoordinationLeaseIds[]` 完全一致，且这些 source lease 不得出现在任何 CoordinationRequest。可靠 committed operation 使用 `continue_after_commit` 并携带 `committedResultRef`；其它项使用明确的 restart、retry 或 resume 策略。`retry_idempotent` 必须复用原 `idempotencyKey`；`resume_runner` 只在 `capabilities.checkpointResume=true` 且 `runnerResumeRef` 能证明从已确认 operation 之后继续、不会重放更早 operation 时使用。Adapter 不得生成新键或从 Terminal 历史猜测恢复位置。任一已开始 operation 缺少安全策略时，Runtime 不启动该 Recovery Attempt。

Ensemble Runner Adapter Protocol 是 Runtime 的 canonical 边界。Adapter 内部可以使用 ACP、Runner 官方 SDK、结构化 CLI 输出或 PTY hook；这些私有协议必须转换为上述请求、Handle、RunnerSignal 和 RunnerResult，不能进入 Domain 或 Client 分支。

## 5. Session 与 Terminal 通道

Session 与 Terminal 必须绑定同一个 `Handle`：

```text
Runner Handle
├── RunnerSignal stream -> Session / Runtime Event
└── PTY/ConPTY stream   -> Terminal
```

- `attach_terminal` 不能启动第二个 CLI，也不能复制 Agent 上下文。
- Unix-like 平台使用 PTY，Windows 使用 ConPTY 或经 Spike 验证的等价能力；平台差异不能泄漏为前端业务分支。
- 只有从启动时就由交互式 PTY/ConPTY 承载的 Handle 才能声明 `terminalAttach=true`。CLI 的 headless/RPC 模式与 TUI 互斥时，该实例必须返回 Unsupported，不能另启第二个进程。
- Terminal byte stream 是用户主动打开的本地数据通道，不进入 canonical Event payload，也不作为 Task/Artifact 状态来源。
- 同一 Handle 同时只允许一个终端输入 owner。Terminal 接管输入时，Session 的 `deliver_message` 不能并发写入同一 stdin/PTY。
- CLI 原生 `/` 命令、选择器和全屏 TUI 由 Terminal 原样承载。Adapter 不需要发现、解析或镜像 CLI 命令目录。
- Adapter 不提供 `terminalAttach` 时，探测结果明确说明 Terminal unavailable，且该 CLI 不能进入正式 supported Runner 列表；不能把结构化日志伪装成原样终端。
- Adapter 不能通过解析终端屏幕位置、颜色或自由文本伪造 Tool call、Task 完成或 Artifact；结构化能力缺失时只上报可靠的进程、Workspace 和结果信号。
- Adapter 也不能通过读屏判断命令是否破坏性或是否对外发布。细粒度审批必须使用 Runner 官方 hook 或平台 broker；缺失时明确返回 Unsupported。

Session 的流式文本只通过 Runtime presentation channel 投递，固定使用以下信封：

```text
streamId
agentInstanceId
attemptId
handleGeneration
sourceSignalId?
segmentSequence
kind                         started | delta | completed | interrupted | discarded
textDelta?
observedAt
```

同一 stream 的 `segmentSequence` 必须连续并绑定一个 Attempt/Handle generation。缺口无法补齐、Attempt 或 generation 变化、连接恢复后身份不一致时，Runtime 发送或派生 `discarded`，Client 丢弃临时文本并从 Message ledger 重载。最终 `assistant_message` 通过 `sourceSignalId + attemptId` 原位替换占位；presentation segment 不写 Event ledger、搜索索引或 ContextPackage。

Terminal 输入权由 Runtime presentation channel 管理，不由 Client 或 Adapter 自行猜测。`acquire_terminal_input`、`renew_terminal_input` 和 `release_terminal_input` 使用 `TerminalInputLease`：

```text
leaseId
clientId
agentInstanceId
runnerHandleRegistrationId
handleGeneration
expiresAt
```

同一 `runnerHandleRegistrationId + handleGeneration` 最多有一个 active lease。Terminal byte input 必须携带 matching lease ID 和 generation，Adapter 在写入 PTY/ConPTY 前校验；lease 不匹配、过期、Client detach、切回 Session、连接失效、generation 变化或 retained readonly 时拒绝输入并释放或失效旧 lease。重连必须重新申请，lease 不写 Domain Event，也不从 Client view state 恢复。active lease 期间 Runtime 拒绝向同一 Handle 并发 `deliver_message`；release 后才允许 Session 重新投递。

详细产品语义见 [m6-agent-session-collaboration.md](m6-agent-session-collaboration.md)。

## 6. 状态与结果

`read(handle)` 返回带稳定信封的 RunnerSignal：

```text
signalId
kind
agentInstanceId
attemptId
occurredAt
evidenceKind                 official_hook | adapter_lifecycle | provider_session | pty_heuristic
evidenceRef?
payload
```

只有 `official_hook | adapter_lifecycle` 可以承载会写入 Domain 的 structured signal。`provider_session | pty_heuristic` 只允许产生带过期时间的 Activity observation 或诊断，不能伪装成 Message、receipt、spawn、workspace selection、Artifact candidate 或 completion。Adapter 必须保留可验证 source ref；缺少来源时 observation 回到 `unknown`。

`kind` 首版允许：

```text
lifecycle
message_receipt
assistant_message
artifact_candidate
spawn_request
execution_workspace_selection
diagnostic
```

`lifecycle` 的 payload 使用：

```text
started | working | waiting_input | produced_output |
completed | failed | canceled | interrupted
```

Runtime 可以把 lifecycle 等可靠来源归一为 `working | blocked | done | idle | unknown` 的 `AgentActivityObservation`。证据 authority 从高到低固定为 canonical Runtime state、Runner 官方结构化 hook/RPC、Adapter 管理的 lifecycle/receipt、已验证 provider session metadata、PTY/TUI heuristic、`unknown`。Runtime state 先决定已知的 blocked/done/idle，其余来源主要区分 working/unknown，不能覆盖 canonical blocking 或终态。低等级 observation 必须带过期时间，只用于展示；PTY 输出、模型自述、heartbeat 和 `produced_output` 不能决定 Attempt outcome、权限、Artifact validity 或 recovery。

`assistant_message` 至少包含：

```text
body
format                        plain_text | markdown
providerMessageRef?
completeness                  complete | interrupted
contentDigest
```

它表示一个可持久化的 Agent 回复边界，不是 token delta。Runtime 按 RunnerSignal `signalId` 去重，校验 AgentInstance/Attempt 绑定与 digest 后创建 `author=agent` 的 Message 并追加 `agent.message.recorded`。流式 delta 可以通过非 canonical presentation stream 提供给当前 Session，但不能进入 Event ledger、搜索或 ContextPackage；Terminal 文本和 `lifecycle=produced_output` 也不能代替该信号。

`artifact_candidate` 至少包含：

```text
artifactCandidateId
contractId
contentRef
contentDigest
mediaType
integrity
```

Runtime 从 RunnerSignal 信封取得 `agentInstanceId`、`attemptId`、`signalId`，从 matching RunnerHandleRegistration 取得 `handleGeneration`。只有 `official_hook | adapter_lifecycle` 来源可以提交 candidate。Runtime 校验 source、Handle generation、ContextPackage output contract 和内容完整性后，在一个事务中持久化不可变 ArtifactCandidate 并追加 `agent.artifact_candidate.recorded`；`signalId + artifactCandidateId` 是来源幂等键，完整语义和 content digest 相同的重放返回原记录，任一字段不同都返回 conflict。candidate 不是正式 Artifact，不能在验证前满足 Task、Handoff 或 Gate。

`message_receipt` 至少包含：

```text
deliveryId
messageId
messageKind                   conversation | instruction
attemptId
status                        accepted | rejected
providerReceiptRef?
receivedAt
contentDigest
```

`deliver_message` 的 payload 使用同一组 `deliveryId`、`messageId`、`messageKind`、`attemptId`，并携带 body、attachment refs 和 digest。conversation 与 instruction 使用同一 receipt、输入 owner 和 unknown-state 规则，但保留不同业务 kind。`messageDeliveryDedupe=true` 表示 Adapter 能在同一 live Handle/provider session 对相同 delivery ID 返回或查询原 receipt；不同 digest 必须 conflict。无法保证时能力为 false，Runtime 在 dispatch 后丢失 receipt 必须进入 `delivery_unknown`，不能自动重投。

`spawn_request` 至少包含：

```text
spawnRequestId
parentAgentInstanceId
parentAttemptId
sourceSignalId
reason
runnerProfileId?
requestedCapabilities[]
requestedWorkspaceMode?
requiredPathAccess[]
requestedContextRefs[]
expectedOutputContractIds[]
requestDigest
```

`runnerProfileId` 省略时继承父 AgentInstance 冻结的 Profile；显式指定时必须引用 RunSnapshot 允许的稳定 Profile 并满足 requested capabilities。不可用或不兼容时进入 blocked，Runtime 不能选择“第一个可用”或静默换 Runner。Agent 与用户发起派生使用同一解析规则，Runtime 先创建 canonical SpawnRequest；requested/blocked/resolved Event 冻结 source、requested/resolved ref、target worker/selection/context/result refs、`inherited | explicit` 来源和 digest。`expectedOutputContractIds[]` 定义 worker 返回父实例的结构，Runtime 不从 Prompt 猜测。worker AgentInstance、ContextPackage、WorkerResult 和 delivery 都回指 `spawnRequestId`。

`transientSpawn=true` 要求 Adapter 同时提供可按 `spawnRequestId` 关联的结构化 result callback；Runtime 通过 `deliver_worker_result` 向父 Handle 发送仅引用 canonical WorkerResult 的 WorkerResultDelivery。它优先复用原 Runtime request/tool callback，不占用 Terminal input owner。Adapter 内部可以复用 provider 的消息传输，但仍必须满足独立 worker-result delivery ID、输入 owner 和去重回执契约，不能把普通 Session 消息当作 WorkerResult 真源。`workerResultDeliveryDedupe=true` 表示同一 live Handle/provider session 能以原 delivery ID 查询或返回原 receipt；否则回执丢失必须进入 delivery_unknown，禁止自动重投。

Runtime 投递给 selector 的 `selection_request` 至少包含：

```text
selectionRequestId
taskExecutionId
selectorKind                   formal_dispatcher | transient_parent
selectorAgentInstanceId
selectorHandleGeneration
selectorAttemptId?
dispatcherCoordinationLeaseId?
targetTaskId
targetAgentInstanceId
baselineRef
allowedModes[]
requiredPathAccess[]
deliveryId
requestDigest
retryOfSelectionRequestId?
timeoutAt
```

selector 通过 `execution_workspace_selection` RunnerSignal 回答：

```text
selectionRequestId
selectorAgentInstanceId
selectorHandleGeneration
selectorAttemptId?
dispatcherCoordinationLeaseId?
targetTaskId
targetAgentInstanceId
selectedMode
reason
baselineRef
requiredPathAccess[]
requestDigest
```

Runtime 必须先持久化 TaskExecution、target AgentInstance、capacity reservation、PermissionGrant、SelectionRequest 和 `execution.workspace.requested`，再调用 `request_workspace_selection`。formal selector 必须使用 active DispatcherCoordinationLease 的 coordination channel，且 `selectorAttemptId` 为空；transient selector 必须使用 parent Attempt channel，且 lease ref 为空。Adapter 只能把结构化请求交给匹配 AgentInstance/Handle generation 的 selector；自由 Prompt 或 Terminal 文本不能代替 response signal。`requestDigest` 覆盖 selector/target identity 和全部请求语义；相同 response signal 或 request/digest 重放返回原结果，同 ID 不同 digest conflict。timeout、unknown receipt 或 selector/lease unavailable 进入 `execution.workspace.blocked` 和 typed Attention。`workspaceDispatchRequestDedupe=true` 表示同一 live selector/provider session 可以用原 request/delivery ID 查询投递结果；Runtime 重启后不能确认时不得新建 assignment 或默认选择。显式 retry 创建带 `retryOfSelectionRequestId` 的新 request/digest。

Permission hook 或 platform broker 在释放 `ask` operation 前，通过同步 Runtime request channel 提交：

```text
permissionOperationRequestId
agentInstanceId
attemptId
permissionGrantId
handleGeneration
operationId
operationKind
requestedCapability
operationIntentRef
operationDigest
```

Runtime 持久化 request 和 Attention 后才返回 blocked acknowledgement。用户决策通过 `deliver_permission_decision` 发送稳定 delivery ID、`approve_once | reject`、原 request/operation/digest 和 Decision ref。`permissionDecisionDeliveryDedupe=true` 表示同一 live hook 能查询原 receipt；不同 digest conflict。Adapter/broker 只有收到匹配的 approve-once 后才释放这一个 operation，不能将其缓存为 Grant。timeout、reject 或 unknown 保持阻塞；unknown 不自动重投批准，恢复仍由 RecoveryCheckpoint 判断 operation 是否越过副作用边界。

RecoveryCheckpoint 不通过上述单向 RunnerSignal 提交。具备结构化 operation hook 的 Adapter 或 platform broker 必须通过 Attempt-scoped Runtime request channel 使用同步 `checkpoint_commit` barrier。请求至少包含：

```text
operationId
operationSequence?
operationKind
sideEffectClass              none | idempotent | non_idempotent | unknown
phase                        before_dispatch | dispatched | acknowledged | committed
idempotencyKey?
targetStateRef?
runnerResumeRef?
evidenceRef
evidenceDigest
committedResultRef?
```

首次 `before_dispatch` 请求省略 `operationSequence`，由 Runtime 为该 Attempt 分配。Runtime 在同一事务中持久化 RecoveryCheckpoint 和 `run.recovery.checkpoint_recorded`，再返回包含 `recoveryCheckpointId`、`operationSequence`、Event sequence、digest 和 `durabilityAckRef` 的 CheckpointAck。后续 phase 必须回传该 sequence。每个 phase 都是追加记录；同一 operation 的 phase 只能向前推进。

`(attemptId, operationId)` 在 Attempt 内唯一，`(attemptId, operationId, phase)` 是 checkpoint commit 幂等键。请求在事务已提交但 Ack 丢失后重试时，相同 payload digest 必须返回原 CheckpointAck；同一 key 携带不同 digest、side-effect class、幂等键或 evidence ref 时返回 conflict。Adapter 只有收到可验证的原 Ack 或新 Ack 后才能越过 barrier。

外部操作必须遵守 write-ahead interlock：Adapter 或 broker 在收到 `phase=dispatched` 的 durable CheckpointAck 前不得释放对应操作。该 phase 表示“已经获准且可能已发出”，因此即使在 ack 后、实际发送前崩溃，也按更保守的 dispatched 规则恢复。无法保证 barrier 的 Runner operation 固定按 `unknown` 处理，不具备自动恢复资格。

只有 Runner 官方结构化 hook、Runtime 自有派发边界或平台 broker 能提交 checkpoint。Adapter 不能从 Terminal 文本、模型自述或文件存在推断副作用阶段。`idempotent` 没有幂等键和可验证目标状态时必须降为 `unknown`。Runtime 恢复时逐个检查所有已登记 operation，并把可靠 committed 项也放入有序恢复计划；不允许用最后一条 checkpoint 代表整个 Attempt。完整对象见 [m6-domain-model.md](m6-domain-model.md)。

Runtime 校验 Runner Handle 绑定、来源、权限、预算和请求字段后，先创建 SpawnRequest 并追加 `agent.spawn.requested`。执行目录方向相反：Runtime 先追加 `execution.workspace.requested`，formal Task 通过 DispatcherCoordinationLease、transient worker 通过 parent Attempt channel 向已绑定 selector 投递 SelectionRequest；接收有效 `execution_workspace_selection` 后追加 `execution.workspace.selection_received`，再校验并创建 assignment。Adapter 不能直接创建 AgentInstance、SpawnRequest、ExecutionWorkspaceAssignment、PermissionGrant、Attention、Artifact 或其它 Domain 对象，也不能从普通模型文本或 Terminal 屏幕推断请求或响应。

Runtime 负责将生命周期和回执信号与 Task、Seat、Run 状态关联。Adapter 不能直接决定 `succeeded`、`blocked` 或人工 Gate 结果。`message_receipt` 只能更新已持久化用户 Message 的投递状态；`assistant_message` 创建绑定来源 signal 的 Agent Message；`artifact_candidate` 必须产生不可变 ValidationRecord 和 `agent.artifact_candidate.validated` 后，valid 结果才能创建 Artifact。transient AgentInstance 的 lifecycle/RunnerResult 只终结该 worker，并创建 WorkerResult，不能直接改变父 Attempt 状态。

`RunnerResult` 至少包含：

```text
runnerResultId
agentInstanceId
attemptId
handleGeneration
outcome                       completed | failed | canceled | interrupted
summary
artifactCandidateRefs[]
changeSetRefs[]
verificationRefs[]
unresolvedItems[]
diagnosticRefs[]
exit_code?
provider_version
started_at
finished_at
contentDigest
integrity
```

`collect(handle, attempt_id)` 只返回绑定该 Handle generation、AgentInstance 和 Attempt 的结果。相同 Attempt 的重复 collect 返回相同 `runnerResultId + contentDigest`；晚到结果、ID 重用、Attempt 不匹配或相同 ID 的不同 digest 返回 conflict/diagnostic，不能套用到 Handle 当前承载的其它 Attempt。`summary` 只是描述文本，不能代替 Artifact candidate、Change Set、verification 和 unresolved item 的结构化引用。所有 `artifactCandidateRefs[]` 必须已由 matching structured signal 记录，且绑定同一 AgentInstance、Attempt、Handle generation 和 ContextPackage contract。Runtime 按固定顺序处理完成：先持久化 candidate 并追加 `agent.artifact_candidate.recorded`，再持久化引用这些 candidate 的 RunnerResult 并追加 `agent.runner.result.created`，然后按 Artifact Contract 为每个 candidate 创建不可变 ValidationRecord 并追加 `agent.artifact_candidate.validated`；只有 valid record 才能创建正式 Artifact 和 `artifact.created`，最后才裁决 Attempt/TaskExecution 成功。缺失、冲突或 invalid candidate 保留 Candidate、ValidationRecord 和诊断，但不能创建 Artifact 或推进业务成功。transient 结果按其 ContextPackage return contract 创建引用来源 RunnerResult 的 WorkerResult；父 Runner 明确采纳后仍由 primary 结果和 Task contract 决定父 Attempt 终态。

`RunnerResult.summary` 是 Task 结果摘要，不自动创建 Session Message。需要作为 Agent 回复进入长期 Session 的内容必须另有稳定的 `assistant_message` signal；Runtime 按 signal 去重，不能同时从 summary、Terminal 和 lifecycle 复制同一回复。

长时间运行遵守同一证据边界：`long_wait_policy` 只定义 observation checkpoint 与 escalation，不是 worker failure deadline；heartbeat、进程存活和持续输出只证明 liveness，不证明完成。到达 checkpoint 可以请求 reconciliation、刷新 observation 或创建 Attention，但不能终结 Attempt、启动 replacement 或释放 capacity。只有匹配 Attempt/Handle generation 的结构化 RunnerResult 经 Contract 校验后才能决定业务成功；可靠 termination evidence 只结算进程状态。超过检查点但仍有可靠活动证据时继续等待并更新观察；没有可靠证据时进入 `unknown`/Attention，而不是猜测成功或失败。

## 7. 控制语义

- Runtime 总是先停止新的派发；是否能暂停并恢复当前进程由成对的 `capabilities.pauseResume` 决定。
- `pause(handle)` 只有在 Adapter 能保留可恢复的同一 Handle 时才返回 Accepted；对应 `resume(handle)` 必须恢复该 Handle。能力为 false 时活动 Attempt 继续到安全边界，不能伪造 paused。
- Run Pause/Resume 以 Attempt 的 primary + active transient Handle 集合为聚合边界。每个 Adapter acknowledgement 只更新对应 AgentInstance；running Attempt 的全部必需 Handle 到达边界后，Runtime 才把该 Attempt 及其 TaskExecution 一次置为 paused 或 running。`waiting_attention` Attempt 在 Run Pause 时保持自身及 TaskExecution status、只暂停 Handles；未解决时 Resume 也不唤醒 Handle，deferred resolution 成功后才走 `waiting_attention -> running | failed`。
- Run Resume 先持久化 `resuming` 屏障，再逐个调用 `resume(handle)`。部分成功后的失败必须反向调用 `pause(handle)` 补偿；只对已聚合进入 running 的 Attempt 写一次 `pausing/compensating_resume_failure -> paused`，尚未离开 paused 的 Attempt 不写虚假转换。补偿失败或状态不明时由 Runtime 把相关 Attempt/Run 置为 interrupted/degraded，Adapter 不能把它当成普通 scheduler resume。
- `cancel` 是不可逆终态，Adapter 必须尽力终止子进程和子进程树。
- `deliver_message` 只有在 Adapter 声明 `messageDelivery=true`、当前 Attempt 支持且 Terminal 未持有输入 owner 时才投递 conversation 或 instruction；instruction 不支持实时投递时进入下一次 Attempt，conversation 不能伪装成已送达。
- `continuedAttempts=true` 才允许新的 AttemptLaunch 复用 live Handle；首轮和续轮都使用 `prepare_attempt_launch`、`commit_attempt_launch` 和 `query_attempt_launch`，每次仍必须接收完整 RunRequest 和 ContextPackage，不能继承上一 Attempt 的输出合同或 recovery plan。
- ContextPackage 的 coordination contract、operation guide 和 completion receipt schema 必须与 Adapter capability 中声明的版本匹配。Adapter 只渲染当前 `allowedRuntimeOperations[]`；注入 Prompt 是传输格式，不授予权限，也不允许调用未签发的 Runtime operation。
- `transientSpawn` 只表示 Runner 能通过结构化 Runtime request channel 请求派生 worker；Runtime 仍负责权限、并发、来源记录和父 Attempt 责任，Runner 不能直接创建正式 Seat。
- `workspaceDispatch` 表示 Runner 能接收 Runtime 发起、绑定稳定 request/digest/target ID 的目录选择请求，并返回结构化 selection；formal Dispatcher 使用 Run-scoped coordination lease，transient parent 使用 Attempt scope。Runtime 仍负责基线、Git、路径、权限、冲突和资源校验。
- `quiesce_for_shutdown` 必须在 Runtime 已持久化 shutdown fence 后停止该 Handle 的新 operation、Attempt request channel 和 coordination channel 写入，并返回 typed ShutdownFenceReceipt。`completed` 证明进程树已经不存在；`quiesced` 证明最后 operation sequence 之后不会再接受输入，但不证明 stopped。Adapter 不能只把 `pause(handle)` 的 acknowledgement 当作安全退出证据；idle Direct 与 coordination-only Handle 也必须返回 matching receipt。
- 派生请求只提交所需能力、目录模式和原因；Runner 不能自行创建 worktree、扩大 PermissionGrant 或绕过 `auto | ask | deny` 策略。
- 下游已开始后重跑必须创建新 Run，不复用原 Run 的执行结果。
- Attempt 收敛后 Runtime 必须选择 `reuse | retain | release`，并为拥有 registration 的该 Attempt 记录不可变 `runner.handle.disposition_recorded`。formal Handle 受 active/rotating lease、面向同一 continued Handle 的 pending replacement lease/launch 或未终态 CoordinationLaunch 保护时，必须自动记录 `reuse(reason=active_coordination_lease | coordination_rotation_in_progress)`；保护引用可靠终态前拒绝用户 retain/release 和 idle stop。只有不受 coordination protection 的 formal Handle 才允许普通 reuse 或 retain；transient Handle 必须 release，coordination-only Handle 不创建 Attempt disposition。`retain` 把 raw Terminal 置为只读/input-fenced，只允许 Adapter 明确支持的 typed、side-effect-free inspection operation，继续占用 capacity，并拒绝业务消息、spawn、Artifact、Handoff 和 completion receipt；无法强制该边界的 Runner 不支持 retain。后续业务复用仍需正常 AttemptLaunch，并引用上次 reuse disposition record。未被新 AttemptLaunch 消费且不受保护时，初始 reuse 可以显式 supersede 为 retain/release；retain 只可 supersede 为 release。`release` 继续使用 typed `terminate_handle`，可靠 stopped evidence 前不能释放资源。Run finalization、Grant 失效、qualification 失效、retain expiry 或 generation 变化都先终结保护 lease/launch，再强制 release。
- 外部启动的 Terminal 没有受支持 Adapter 提供的 creation/control authority、receipt 和 termination contract，不能登记为 formal Runner Handle。

## 8. 官方 Adapter 与 Runner Profile

`pi` 是默认推荐 Runner，但 `pi`、Codex CLI 和 Claude Code 都只存在于 Adapter 层：

- CLI 参数、进程组装、版本范围和探测集中在各自 Adapter。
- Runtime 和 Client 只依赖通用接口，不按 Runner ID 裁决业务状态。
- 三个 CLI 均由用户自行安装和登录。Ensemble 不下载 CLI、不代管升级、不读取或复制原生账号 Token。
- Adapter 声明最低版本和已验证范围。范围外返回 `installed_incompatible`；范围内仍需运行 capability probe。
- 私有日志先转换为 RunnerSignal；无法可靠转换的内容只保留在 Terminal 或脱敏诊断中。
- Pause、消息投递、结构化 Tool call、派生和权限 hook 以真实探测为准，不在产品 UI 中按品牌写死。
- 三个 Runner 都必须以交互式 PTY/ConPTY Handle 支撑原生 TUI 与 slash command；Session 从同一 Handle 的官方信号、文件观察和 Runtime 状态构建，不复制命令推荐。

RunnerProfile 只保存非敏感启动配置：

```text
profileId
runnerId
displayName
executablePath?
configurationHome?
nonSecretSettings
secretReferences[]
```

`secretReferences[]` 只引用操作系统安全存储或 Runner 原生配置位置，不包含 Token。Workspace 选择默认 Profile，Seat 可以覆盖；AgentInstance 启动时冻结具体 Profile。修改 Profile 不替换运行中的 Runner 身份。

formal AgentInstance 只有在所属 Run 非终态且可能继续派发/对话，并且没有活动 Attempt、待投递消息、Terminal 连接或 coordination protection 时开始空闲计时，默认 30 分钟后停止。非终态 Direct Run 使用自己的 idle-close timer，formal Handle 不并行执行 process-idle stop；Direct Run close 后由 finalization 停止 Handle。其它 Run 的 finalization barrier 也立即停止所有 formal/transient Handles，不等待 idle timeout。长期 Seat Session 通过持久化消息和 ContextPackage 延续，不依赖旧进程永久存活。

## 9. 契约测试

每个 Adapter 必须通过同一组测试：

- 探测结果分类正确
- Activity evidence 带 source ref；canonical Runtime blocked/done/idle 覆盖 provider/PTY working，heuristic 过期回到 unknown 且不追加业务 Event
- 三种执行目录和 PermissionGrant 边界正确
- 启动、正常结束、失败、取消和异常退出可回收
- 输出语言传入请求并写入 Run 元数据
- Artifact 路径不会越出 execution assignment 和 PermissionGrant 允许范围
- 私有日志不会成为 Client 协议
- 能力不支持时命令明确失败且不产生成功事件
- `pauseResume` 为 true 时同一 Handle 完成 pause/resume；为 false 时活动 Attempt 到安全边界，缺失 Handle 不会被伪装成恢复成功
- Terminal attach/resize/input 连接同一 Handle，切换视图不启动第二个进程
- Terminal 与 Session 输入 owner 互斥，断开后能恢复或明确终止
- Session presentation segment 按 stream/Attempt/generation 连续排序；缺口或重连身份变化丢弃临时文本，canonical Message 原位替换且不重复入库
- TerminalInputLease 在同一 Handle generation 单 owner；过期、detach、切回 Session、断线、generation 变化和 retained readonly 都拒绝旧输入，重连不恢复旧 lease
- Context package 的 digest、目标 Attempt 和 Workspace scope 在投递前后保持一致
- coordination contract、operation guide 和 completion receipt schema 版本不匹配时 prepare 被拒绝；dispatcher coordination 不要求 completion schema
- 首个 Attempt 和同一 formal Handle 上的兼容后续 Attempt 都使用稳定 AttemptLaunch 的 prepare/commit/query；prepared 后才记录 Context delivered，可靠 committed receipt 后才进入 starting，确定性失败有独立 launch/context failure Event，Unknown 不创建第二进程
- AttemptLaunch 和 DispatcherCoordinationLaunch 在 Adapter 尚未观察到 prepare 前崩溃时，都能用相同 launch ID/digest 安全重试，不创建第二个逻辑 launch
- process 已创建但 prepared receipt 未落盘时，只查询原 launch ID；查询仍 Unknown 时不创建第二进程
- prepared receipt 与 RunnerHandleRegistration 已持久化、typed commit 发送前后崩溃时，恢复只提交或查询原 commit；commit receipt 丢失不重复发送任务
- prepare、commit 和 query 对同一 launch ID/digest 返回原结果，同 ID 不同 digest 稳定 conflict；AttemptLaunch 与 DispatcherCoordinationLaunch 使用同一幂等规则
- pre-registration Unknown 通过 `terminate_launch` 使用原 launch kind/ID/digest 取得稳定 terminated/not-found receipt；AttemptLaunch 同时冻结完整 pending Dispatcher lease IDs，matching receipt 在同一事务 reject launch 并 revoke pending leases，lease 仍只属于原 recoverable Attempt owner。再次 Unknown 保留原 launch/lease 状态与 Attention，不能伪装成 failed
- post-registration cleanup 对 `quiesced` Handle 只通过 `terminate_handle` 使用 registration ID/generation 取得 stopped/not-found receipt；`completed` Handle 使用同一 ShutdownFenceReceipt 作为 stopped evidence。matching evidence 落盘前不能写 stopped、终态化 AgentInstance 或释放 assignment/capacity
- typed Attempt commit request 明确传入 Runtime 创建/确认的 RunnerHandleRegistration ID、Handle generation、prepared receipt ref 和完整 pending lease IDs；Adapter 不被要求回显未收到的本地 identity，prepared/commit/query 的 lease set 不一致时稳定 conflict
- conversation 与 instruction 都在调用 `deliver_message` 前持久化稳定 delivery ID；receipt 丢失时只有同一 live Handle/provider session 的去重能力允许查询/重放，否则进入 delivery_unknown 且不自动重复消息
- 完整和明确 interrupted 的 Agent 回复通过 `assistant_message` 各入库一次；delta、Terminal 文本和 `produced_output` 不会重复生成 Message
- 派生只能来自绑定的结构化 Attempt request channel，并先创建 SpawnRequest；formal 执行目录由 Runtime 通过 active DispatcherCoordinationLease 发起 SelectionRequest，transient 目录由 parent Attempt channel 处理，二者都以同 request ID/digest 结构化回答，伪造来源、过期 lease、自由文本和 Terminal 屏幕内容均被拒绝
- transient worker 的 Profile 按 explicit-or-inherit 规则冻结；每个 worker、assignment、父权限交集 grant、ContextPackage、WorkerResult 和 delivery 都绑定同一 SpawnRequest，缺少 return contract 时拒绝启动
- worker lifecycle/RunnerResult 只创建 WorkerResult 并终结 worker；结构化 result callback 使用稳定 WorkerResultDelivery ID，unknown receipt 不自动重投，也不直接终态化父 Attempt
- supported Runner 的 Session 与 Terminal 同时可用，且来自同一 Handle
- PermissionGrant 的每项 `allow | ask | deny` 都有真实 enforcement 证据，未支持项不会被 Prompt 或终端文本解析伪装
- 空闲 formal 实例和 transient worker 按生命周期退出，不留下无主进程；恢复使用新 AgentInstance 和 recovery Attempt
- RecoveryCheckpoint 只来自可靠结构化来源；缺失、过期或无法覆盖当前操作时，恢复稳定进入 unknown/Attention
- reused Handle 的 RunnerResult 绑定稳定 result ID、AgentInstance、Attempt 和 digest；晚到/重放结果不能完成其它 Attempt
- RunnerResult 先保存 Artifact candidate、Change Set、verification 和 unresolved refs，再为每个 candidate 保存不可变 ValidationRecord 和 validation Event；只有 valid record 创建正式 Artifact，summary 不影响结果裁决
- long-wait checkpoint、heartbeat 和持续输出不产生 terminal outcome、replacement 或 capacity release
- 每 Attempt disposition record 可重放；retain 只读/input-fenced、只允许 typed side-effect-free inspection，finalization/Grant/qualification/expiry/generation change 强制 release
- provider-native session resume 和 transcript replay 不被当作 operation completion evidence
- safe exit 先对全部非终态 Run建立 durable fence；只有存在 registration、in-flight launch 或 unknown cleanup resource 的 Run创建 ShutdownRecoveryPlan，但同 Run 内 process-free pre-Attempt aggregate 仍独立收敛，不能因已有 plan 被漏掉
- 已 paused、idle Direct 和 active coordination lease 的每个 live Handle 都有 typed `completed | quiesced` ShutdownFenceReceipt，ShutdownRecoveryPlan 不漏项，plan digest 后不能出现新 operation；quiesced 不等于 stopped
- Runtime 对 plan 中的 pre-registration launch 取得 matching LaunchTerminationReceipt，对 quiesced registration 取得 HandleTerminationReceipt，并验证 completed registration 的 stopped evidence；任一 Unknown 都保持 `resumeOnStartup=true` 且不返回安全 shutdown acknowledgement，全部收敛前不写 stopped 或释放 capacity
- recoverable Attempt 与 coordination recovery 对每个 Handle/Launch record 全局互斥；已登记 Dispatcher Handle 或尚无 registration 的 Dispatcher AttemptLaunch 同时承载 Attempt 和 lease 时都只归 Attempt entry，active/pending source lease 只通过 `coupledDispatcherCoordinationLeaseIds[]` 恢复
- coupled Dispatcher recovery 由一个 RunRequest、一个 AttemptLaunch 和一个 replacement Handle 同时提交业务输入与 dormant channel；safe shutdown 发生在 prepare 后、registration 前时，原 `pending_dispatcher_coordination_lease_ids[]` 不丢失且不再产生 CoordinationRequest。coordination-only lease 才使用 DispatcherCoordinationLaunch
- 全部 termination/cleanup 与同 Run process-free aggregate 收敛后，Runtime 必须持久化带 shutdown fence ref、适用时的 plan ref 和 `resumeOnStartup=false` 的 completion `run.status.changed`，才能返回 acknowledgement；Run status 不变时也必须有同状态 Event
- 每个 checkpoint phase 先持久化并收到 durable acknowledgement，再允许 operation 越过对应边界；崩溃发生在 ack 前、ack 后但发送前、发送后和结果提交前时都不会重复非幂等副作用
- Recovery RunRequest 携带来源 Attempt/AgentInstance、消费的 checkpoint、恢复策略及原幂等键；多个并行 operation 分别分类，不能被一条“最新 checkpoint”覆盖
- 一个 recovery Attempt 只创建一次；primary 和 transient replacement 按 source AgentInstance 获得不重叠的有序恢复子计划及相同完整计划 digest。formal primary replacement 只有 Attempt recovery pair；recovered transient 同时有当前 recovery parent/spawn triple 和旧 transient/Attempt recovery pair；coordination-only replacement 只有 coordination recovery triple。四种组合缺失或混入禁止字段时在 Adapter launch 前拒绝。可靠 committed 操作明确以 `continue_after_commit` 跳过，Runner checkpoint 只有在声明并验证 `checkpointResume` 能力后才能产生 `resume_runner`

## 10. 验收门槛

- [ ] 通用接口与 [m6-architecture.md](m6-architecture.md) 边界一致
- [ ] `pi` Adapter 通过完整契约测试
- [ ] Codex CLI Adapter 通过完整契约测试
- [ ] Claude Code Adapter 通过完整契约测试
- [ ] 至少一个 Mock Adapter 用于 Runtime 和 UI 测试
- [ ] 三个真实 Adapter 在 Windows、macOS、Linux 全部通过 Session、Terminal、ContextPackage、权限和恢复资格测试
- [ ] Runner 能力映射覆盖 Pause、Cancel、Inject、Artifact
- [ ] 三个 Runner 的 PTY/ConPTY Terminal 在三平台完成输入、resize、ANSI 和进程回收验证
- [ ] 生产打包路径符合 [m6-platform-packaging.md](m6-platform-packaging.md)
