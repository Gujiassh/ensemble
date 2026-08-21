# M6 Agent Session and Collaboration

**状态**：产品与交互基线 v1（2026-08-20）
**范围**：Active Seats 分组、Seat 与运行实例、派生 Agent、跨 Runner 协作、Session/Terminal 双视图
**依赖**：[m6-domain-model.md](m6-domain-model.md) · [m6-run-operations.md](m6-run-operations.md) · [m6-runner-adapter.md](m6-runner-adapter.md) · [m6-execution-workspace-security.md](m6-execution-workspace-security.md) · [workspace-output-inspection.md](workspace-output-inspection.md)

## 1. 先区分三个对象

Ensemble 不把岗位、进程和一次执行混成一个“Agent”。

```text
Seat          = 编排中的稳定岗位和责任归属
AgentInstance = 某个 Runner 承载的实际运行实例
Attempt       = AgentInstance 为一个 Task 执行的一次不可变尝试
```

### Seat

Seat 属于 Organization，拥有 Role、父级 Group/Seat 和可负责的 Task。它可以长期存在，即使当前没有进程运行。

### AgentInstance

AgentInstance 属于 Run，是某个 Seat 在本次运行中的具体执行实例。它记录 Runner、运行状态、上下文和派生关系。

### Attempt

Attempt 属于一次稳定的 TaskExecution，TaskExecution 再引用其 Task 定义。Retry 和 Recovery 在原 TaskExecution 下登记 pending work，完成 provisioning 后创建新 Attempt；Rework 创建新的 TaskExecution activation，再由同一 pipeline 创建其中的首个 Attempt。历史记录都不被原地覆盖。一个 Attempt 只有一个 primary AgentInstance；transient worker 可以引用该 Attempt，但不成为 Task 的共同 owner。一个 AgentInstance 可以按 Runner 能力连续承载同一 Seat 的多个 Attempt。

连续承载只适用于同一个持久在线 Runner process handle。进程退出或恢复时重新启动 Runner，必须创建新的 AgentInstance，不能复用旧实例 ID。formal Attempt recovery 只使用 `recoveredFromAgentInstanceId + recoveredFromAttemptId`；recovered transient 同时保留当前 recovery parent/spawn triple 和旧 transient/Attempt recovery pair；coordination-only recovery 只使用自己的 lease/registration triple且不得伪造 Attempt。

## 2. Active Seats 按来源和运行态分组

Active Seats 不是另一套组织模型，而是 Run 中 AgentInstance 的投影。默认分组顺序为：

```text
Active Seats
├─ Organization path
│  └─ Seat
│     └─ current AgentInstance
└─ Spawned workers
   └─ parent Seat / parent Attempt
```

UI 必须允许按以下维度切换分组：

- Organization：按 Group、Seat 的稳定父子关系展示。
- Run：按当前 Run 和 Attempt 展示活动实例。
- Origin：按派生来源展示父 Agent、Task 和 spawn reason。
- Runner：按实际 Runner Profile 分组或筛选。
- Activity：按 `working | blocked | done | idle | unknown` 的简化活动投影筛选。

分组规则：

- 分组只改变投影，不改变 Seat、Task 或 Attempt 的语义关系。
- 派生来源显示为可点击的记录，至少能定位到 parent AgentInstance、parent Attempt 或创建它的 Event。
- 恢复来源也显示为可点击的历史记录，至少能定位到 source AgentInstance、适用的 source Attempt/coordination lease、recovery Event，以及本次重新签发的目录分配和权限授权。recovered transient 同时显示当前 parent/spawn 位置和旧 transient recovery 来源，不能丢掉任一棵树。
- Project File 不归 AgentInstance 所有；文件来源仍由 Change Set 的观察证据决定。
- 同一个 Seat 可以在不同 Run 中拥有不同 AgentInstance；不能用 Seat 名称代替实例 ID。
- 同一个 AgentInstance 的 Session、Terminal、Activity、Change Set 和 Artifact 入口必须汇聚到同一运行上下文。
- 点击 Seat 打开该 Seat 的长期 Session 聚合；点击 AgentInstance 行打开精确运行实例。Seat 同时存在多个非终态或 retained 实例时必须先显示实例选择器，不能自动选“最近活跃”或数组第一项。

Activity 只用于快速扫描，不把复杂内部状态压成新的业务真源：

- `working` 表示有可靠的活动执行信号；`blocked` 表示等待输入、权限、Attention 或其它明确阻塞；`done` 表示当前工作已有结构化终态；`idle` 表示 live formal Handle 当前没有活动 Attempt；无法可靠判断时必须显示 `unknown`。
- Run/Task/Attempt status、Run health 和 RunnerResult outcome 分开展示。`done` 不等于 `succeeded`，`blocked` 不等于 `failed`。
- 证据优先级是 canonical Runtime state、官方结构化 hook/RPC、Adapter lifecycle/receipt、已验证 provider session metadata、PTY/TUI heuristic、`unknown`。已知的 blocked/done/idle 先从 Task、Attention、Handle 和 disposition 投影；其它来源主要区分 working/unknown，不能覆盖 canonical 阻塞或终态。PTY heuristic 必须带短期过期时间，并在更高等级证据到达时被覆盖。
- Terminal 文本、光标动画、持续输出、heartbeat 和 Agent 自述不能决定 Task 成功、权限批准、Artifact validity 或恢复动作。

## 3. AgentInstance 记录派生来源

AgentInstance 最少记录：

```text
agentInstanceId
runId
seatId
activeTaskId?
activeAttemptId?
attemptIds[]
parentAgentInstanceId?
parentAttemptId?
spawnRequestId?
recoveredFromAgentInstanceId?
recoveredFromAttemptId?
recoveredFromDispatcherCoordinationLeaseId?
recoveredFromRunnerHandleRegistrationId?
createdBy                 user | workflow | agent
spawnReason
runnerProfileId
workspaceScope
contextPackageIds[]
executionWorkspaceAssignmentId?
permissionGrantId?
spawnDepth
lifecycle                 formal | transient
status                    created | provisioning | starting | running | waiting | paused | stopping | stopped | failed | interrupted
createdAt
startedAt?
stoppedAt?
```

### 3.1 Formal 与 transient

- `formal` 实例由已存在的 Seat 和 Workflow Task 启动，可以成为下游 Handoff 的正式 producer。
- `transient` 实例是某个 Agent 为当前 Attempt 临时派生的 worker。它必须有 `parentAgentInstanceId` 和 `parentAttemptId`，不能凭空出现在 Organization，也不能被其它 Task 直接指派。
- ordinary transient 只携带完整 `parentAgentInstanceId + parentAttemptId + spawnRequestId`；formal Attempt recovery 只携带完整 `recoveredFromAgentInstanceId + recoveredFromAttemptId`。recovered transient 同时携带两组：parent refs 指向本次 recovery Attempt 中实际监督它的 replacement parent，recovery pair 指向旧 transient/source Attempt，`spawnRequestId` 仍指向同一 supervised-dispatch lineage。恢复链和派生树是两种独立但可同时存在的投影。
- coordination-only recovery 只携带 `recoveredFromAgentInstanceId + recoveredFromDispatcherCoordinationLeaseId + recoveredFromRunnerHandleRegistrationId`，parent/spawn triple 和 `recoveredFromAttemptId` 必须为空；它不得创建或伪造 TaskAttempt。
- formal 实例没有活动 Attempt、待投递消息、Terminal 连接或 coordination protection 时默认空闲 30 分钟后停止；保护包括 active/rotating DispatcherCoordinationLease、面向同一 continued Handle 的 pending replacement lease/launch 和未终态 CoordinationLaunch。非终态 Direct Run 只使用自己的 idle-close timer，不并行停止 Handle，关闭后由 finalization 回收。长期 Session 继续存在，下次工作创建新的 Direct Run 和 AgentInstance。
- transient 实例在父 Attempt 交付、失败或取消收尾后停止，不因用户继续对话而转成长期 Seat。
- 如果临时 worker 需要独立负责 Task、拥有独立审批或向其它 Seat 交付，Runtime 必须创建 Run Amendment，新增正式 Seat/Task/Handoff 关系后再启动 formal 实例。
- “Active Seats” 可以显示 transient worker，但要明确标记 `Spawned worker` 和来源，不把它伪装成可复用岗位。

### 3.2 创建来源

`createdBy` 的语义：

| 值 | 含义 |
|---|---|
| `user` | 用户明确创建或批准了一个运行实例/派生 worker |
| `workflow` | 已冻结的 Workflow 调度创建了实例 |
| `agent` | 当前 Agent 请求派生 worker，Runtime 校验后创建 |

Agent 不能通过自然语言直接修改 Organization。Agent 发起的派生请求必须通过 Runner Handle 绑定的结构化 Runtime request channel 进入，写入 Event，并经过 Runner/权限/并发/Workspace scope 校验；Terminal 读屏和普通模型文本不能触发派生。

### 3.3 派生策略和默认预算

派生审批模式为 `auto | ask | deny`，默认是 `auto`。Workspace、编排和单次 Run 可以覆盖默认值；解析后的值写入 RunSnapshot。

默认预算为：

- 一个 Workspace 同时最多 4 个活动 AgentInstance。
- 一个父 Agent 同时最多 2 个直接子 worker。
- 最大派生深度为 2 层。
- 一个 Run 最多有 8 个原始实例谱系节点：首次 formal 实例和 transient spawn 各计一次，recovery replacement 不重复计数。
- 每条实例谱系默认最多 3 次 recovery replacement；超过上限创建 Attention。恢复实例仍受 Workspace active、父级活动 child 和 depth 限制。

`auto` 只表示不等待用户点击批准，仍必须执行权限、目录、Runner、并发和交付契约校验。`ask` 为每次派生创建 `spawn_approval` Attention；批准只继续 transient spawn，不生成 Amendment。`deny` 拒绝 Agent 发起的派生，但不影响 Workflow 已定义的 formal Seat。达到预算时保留请求并创建 Attention，不静默停止已有实例。`staffing_request` 只用于新增 formal Seat/Task。完整目录和权限规则见 [m6-execution-workspace-security.md](m6-execution-workspace-security.md)。

派生成功链路固定为：创建带 source/digest 的 canonical SpawnRequest 与 `agent.spawn.requested` -> 原子预留 capacity 并创建绑定 `spawnRequestId` 的 transient AgentInstance -> 从父 Grant 与 RunSnapshot 求交集得到独立 PermissionGrant -> Runtime 向父 Handle 发起绑定 worker ID/request digest 的 ExecutionWorkspaceSelectionRequest -> 父 Agent 结构化返回 selection -> 独立 ExecutionWorkspaceAssignment -> 绑定 SpawnRequest 的 worker-targeted ContextPackage/AttemptLaunch -> Adapter 两阶段 prepare/commit -> 可靠 receipt 后 `agent.context.delivered` 并把 SpawnRequest 置为 launched。父 Runner 必须同时具备 `transientSpawn`、`workspaceDispatch` 和 request dedupe。Failed 时把同一 SpawnRequest 置为 blocked/failed，追加对应 Event，终态化 worker 并释放目录/capacity；父 Attempt 继续作为唯一业务 owner，不因 worker 启动失败被改绑。WorkerResult 和 delivery 继续回指该 SpawnRequest。SpawnRequest 的 `targetWorkerAgentInstanceId` 固定指向首次 worker；进程恢复不改写它，recovered transient 以同一 `spawnRequestId` 加 parent/spawn triple 与 Attempt recovery pair 进入该 lineage。

这条链路是 supervised dispatch，不是 ownership handoff。父 Attempt 保持唯一业务 owner，worker 只能回传结果；当另一个正式 Task/Seat 接管后续责任时，Runtime 才创建携带 Artifact refs 的 Handoff。已经活动的 Task 需要换 owner 时必须通过 Run Amendment/Rework 创建新的责任关系，不能原地修改 owner 或把 worker 升格成 formal Seat。

## 4. 不同 CLI 通过 Runtime 协作

不同 CLI 不直接读取彼此的终端，也不把看板卡片当作上下文协议。formal Dispatcher Task 是普通业务 Task；其 Attempt 可以正常完成，持续目录协调由 Runtime 签发的 Run-scoped DispatcherCoordinationLease 承担。协作路径固定为：

```text
Agent A / Runner A
        ↓ event + artifact + handoff
Application Runtime
        ↓ persisted collaboration context
Agent B / Runner B
```

### 4.1 协作的 canonical 对象

| 对象 | 用途 |
|---|---|
| Task | 责任、约束、输入和验收目标 |
| Message | 用户或 Agent 的补充沟通，绑定 Task/Attempt |
| Handoff | 明确从上游 Attempt 向下游 Task 交付的关系 |
| Artifact | 按 Contract 冻结的结果和版本 |
| Change Set | 可复现的 Workspace 内容差异 |
| Attention | 需要用户或目标 Seat 决策的事项 |

看板按 Task 定义组织卡片，但每张运行中卡片的 identity 和 status 来自具体 TaskExecution 投影。拖动只有在目标列能映射为当前合法的显式 Domain Command（例如 `run.retry`、`run.rework` 或 `attention.resolve`）时才作为快捷操作；否则禁用。看板不能直接写 status、隐式生成 Handoff，也不能代替 Artifact、Diff 或验收条件。

以上是内部模型名称，默认界面使用更直接的词：

| 内部对象 | 中文界面 | 英文界面 |
|---|---|---|
| Artifact | 交付结果 | Deliverable |
| Change Set | 变更 | Changes |
| Handoff | 交给下一任务 / 已交接 | Pass on / Passed on |
| ContextPackage | 不单独展示；显示“将发送的上下文” | Context to send |

用户看到的交付结果可以是报告、补丁、测试结果、图片或数据文件。交接表示一个 Agent 把选定结果、必要上下文和未解决事项正式交给下一 Task/Agent，不等同于复制终端文字。内部 ID 和对象名只在诊断或开发视图出现。

### 4.2 Context package

Runtime 启动或交接 Agent 时，先持久化并构造 Context package：

```text
contextPackageId
targetAgentInstanceId
taskExecutionId
targetTaskId
targetAttemptId?
purpose                       primary_attempt | transient_worker | dispatcher_coordination
spawnRequestId?
dispatcherCoordinationLaunchId?
sourceHandoffIds[]
inputArtifactRefs[]
acceptedDecisionRefs[]
relevantMessageIds[]
diffReviewBundleRefs[]
workspaceScope
executionWorkspaceAssignmentId
permissionGrantId
expectedOutputContractIds[]
coordinationContractRef
operationGuideRef
allowedRuntimeOperations[]
completionReceiptSchemaRef?
parentAgentInstanceId?
returnToAgentInstanceId?
createdAt
contentDigest
```

Runner Adapter 再把这份包渲染成目标 CLI 能理解的输入。Runtime 注入只是投递机制，不是协作事实的存储位置；所有交接仍以 Task、Handoff、Artifact、Event 为准。协调合同、操作指南和 completion receipt schema 都使用 Runtime/Adapter 已协商的不可变版本；`allowedRuntimeOperations[]` 只列当前实例/Attempt 可调用的操作。版本不匹配时拒绝投递，不能依赖自然语言兼容。`completionReceiptSchemaRef` 对 primary/transient 必填，对不产出 RunnerResult 的 dispatcher coordination 必须为空。Primary 和 transient worker 不能复用同一个 ContextPackage。worker 包要求 `spawnRequestId`，其 assignment/grant 属于 worker，`returnToAgentInstanceId` 指向当前父实例，expected output contract 描述返回父实例的结构，而不是直接宣称 Task Artifact 已完成。

`purpose=dispatcher_coordination` 只用于 DispatcherCoordinationLaunch：`dispatcherCoordinationLaunchId` 必填，`targetAttemptId`、`spawnRequestId`、父子实例引用和 expected output contracts 为空。它承载冻结的 Dispatcher TaskExecution、目录策略、assignment、Grant 和协调指令，只建立 Run-scoped workspace-selection channel，不产生业务 RunnerResult、Artifact 或 Handoff。

目标 Agent 完成后，Runtime 收集结果并按 Contract 校验，成功后才创建 Handoff。下游不通过文件名、终端最后几行或“最近活跃 Agent”猜测输入。

Message 至少记录：

```text
messageId
workspaceId
runId
seatId
agentInstanceId?
taskId
attemptId?
author
messageKind             conversation | instruction
body
attachmentRefs[]
createdAt
deliveryMode             current_attempt | next_attempt | direct_task | runner_output
deliveryStatus           recorded | queued | delivering | delivered | rejected | delivery_unknown
deliveryId?
runnerReceipt?
sourceSignalId?
```

用户消息使用前三种 delivery mode。活动 Attempt 中的 conversation 和 instruction 都通过 Adapter `deliver_message` 投递，并用稳定 delivery ID、`message_receipt`、dedupe 和 unknown-state 规则更新状态；Terminal 持有输入权时 Session 不并发写入。`next_attempt` 首版只允许 instruction，queued Message 不提供撤回或原地替换，更正通过追加新 instruction。Agent 回复由 Adapter 的结构化 `assistant_message` signal 进入 Runtime，固定使用 `author=agent`、`messageKind=conversation`、`deliveryMode=runner_output` 和 `deliveryStatus=recorded`，并绑定 AgentInstance、Attempt 与来源 signal。Runtime 按 `signalId` 去重后持久化 Message 和 `agent.message.recorded`；流式 delta 只做当前 Session 的临时显示，不能替代最终或明确 interrupted 的 canonical Message。

流式显示使用 Runtime presentation stream，不写 Domain Event：

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

同一 stream 的 segment sequence 必须连续并绑定一个 Attempt/Handle generation；缺口、Attempt 变化、Handle generation 变化或 reconnect 后无法补齐时丢弃临时文本并从 Message ledger 恢复。canonical `assistant_message` 到达时通过 `sourceSignalId + attemptId` 原位替换临时占位，不能显示两条回复。流式 token 不逐 token 写历史或向读屏 live region 宣告。

点击没有活动 AgentInstance 的 Seat 时，Session 只显示历史和 **Start direct task**，不能伪装为在线对话。用户确认后创建明确的 Direct Task/Run，再启动 AgentInstance；消息使用 `direct_task` 绑定新任务。

**Start direct task** 原子发送 `direct_task.start` Command；创建前不能先发送缺少 Run/Task 归属的 `agent.message.send`。payload 至少包含：

```text
seatId
initialMessageBody
attachmentRefs[]
selectedHistoryRefs[]
runnerProfileId?
bootstrapWorkspaceMode?
permissionOverride?
outputLocale?
```

Runtime 先校验 Seat、RunnerQualification、目录和权限并预分配全部 ID，再原子持久化 `completionPolicy=explicit_close`、成功 End 和 1800 秒默认 idle timeout 的最小 RunSnapshot，以及 Run、TaskExecution、TaskAttempt、capacity-reserved AgentInstance、ExecutionWorkspaceAssignment、PermissionGrant、AttemptLaunch、首条 `messageKind=instruction` / `deliveryMode=direct_task` Message 和最小 ContextPackage。首条 Message 在事务内获得稳定 delivery ID 并进入 delivering；ContextPackage 的 `relevantMessageIds[]` 必须包含该 Message，再加明确选择的历史引用。Runtime 返回稳定 ID 后才能 prepare launch。失败时清理本次创建但尚未使用的隔离资源和 capacity reservation，不能留下无归属 Message、半创建 Run 或已启动的孤立进程。`bootstrapWorkspaceMode` 缺省时使用 `shared_workspace`；其它字段按 Workspace 默认值解析并冻结。

以上对象和首批 Event 必须在同一持久化事务提交。Event 顺序固定为：`run.created`，Start/End 的 `node.execution.created`，`task.execution.created`，`agent.instance.created`，`permission.grant.created`，`execution.workspace.assigned`，`task.attempt.created`，`agent.message.recorded`，`agent.context.created`。ContextPackage 始终存在；每个 Event 引用的父对象必须已在更早序列出现，Context 的 Message ref 不能在消息事件前悬空。事务提交后才允许进入 `run.status.changed(preparing)` 并调用 Adapter `prepare_attempt_launch`；prepared receipt 持久化后创建或确认 RunnerHandleRegistration，追加 Context/Message delivered，再 commit 同一 launch ID。可靠 LaunchReceipt 后才进入 starting；Unknown 只能查询或对账原 launch，不能创建第二进程。首条正文只存在于 Message，Adapter 的 rendered prompt 必须从 ContextPackage 引用渲染，不能再保存第二份自由文本真源。

Session 是长期存在的 Seat 交互入口，但每条消息都必须绑定一个 Task/Run：

- 用户可以在同一个长期 Session 中先后创建多个 Direct Task/Run。
- Direct Task/Run 允许自由多轮对话，不要求预先连接到 Workflow 节点，但仍有明确的创建者、目标 Seat、Runner、目录和权限。每轮用户消息对应一个不可变 Attempt；活动轮中的补充消息仍绑定当前 Attempt。
- Direct Task 不创建第二套领域对象。Runtime 生成 `Start -> Task(explicit_close) -> End(succeeded)` 的单 Task 不可变 RunSnapshot，标记 `sourceKind=direct_task`，但不写回 Workspace Draft。单轮 RunnerResult 只结束 Attempt，不自动到达 End。
- 一轮结束后 Run 保持 running/idle 并等待下一条消息；下一轮在同一事务创建 Attempt、Message、ContextPackage 和 AttemptLaunch，复用同一 live AgentInstance。`direct_task.end` 或无活动工作达到默认 30 分钟 idle timeout 后请求成功关闭；`run.cancel` 立即取消。
- 长期存在的是按 Seat 聚合的 Session 入口。终态 Direct Run 不复活；下一条消息创建新的 Direct Task/Run 和 AgentInstance，并可通过 ContextPackage 引用用户选择的历史消息和交付结果。
- 没有活动 Run 时，消息进入新 Direct Task 的创建队列，不能显示为已送达。
- 不允许产生脱离 Task/Run、无法搜索、导出或恢复的无归属聊天记录。

用户可从 Session 附加文件、选中的 Diff 行、交付结果、Task 或 Attention。附件必须带版本或完整性引用并通过权限校验；快捷键和历史规则见 [m6-execution-workspace-security.md](m6-execution-workspace-security.md)。

### 4.3 协作失败

- 上游没有有效 Artifact 时，不创建声称完整的 Handoff。
- 目标 Runner 不可用时，Handoff 保留为待投递状态并创建 Attention。
- Context package 缺字段或完整性不符时，目标 Attempt 不启动。
- 下游已经开始后，上游重做不回写旧 Handoff；新结果创建新 Artifact 版本和新 Attempt。

## 5. Session 与 Terminal 是同一个实例的两种视图

Ensemble 不为 Session 和 Terminal 启动两份 CLI。每个 supported Runner 的 AgentInstance 最多有一个 Runner process handle，两个视图共享它：

```text
AgentInstance / Attempt
          ↓
single Runner handle
   ↙                 ↘
Session projection   Terminal projection
```

### 5.1 Session 模式

Session 是 Ensemble 的基础交互面，负责：

- 对话消息和用户补充指令
- 结构化 Activity、Tool call、文件变化、Artifact 和 Attention
- Task、Attempt、Runner 状态
- Changes、Diff 和 Artifact 深链
- Run Pause、Resume、Cancel、Retry 等受 Runtime 状态机约束的控制

Session 不解析不同 CLI 的内部 slash command，也不伪造 CLI 的命令推荐。

### 5.2 Terminal 模式

Terminal 是原样 CLI 视图，负责：

- ANSI 颜色和光标控制
- CLI 自己的 `/` 命令、选择器、确认提示和全屏 TUI
- stdout、stderr、键盘输入和终端尺寸变化
- 用户需要 CLI 原生交互时的逃生路径

Terminal不会绕过Runtime写入Task、Artifact或Run状态；原始输出仍需通过Runner Adapter归集。Terminal、Artifact、用户消息和Runner输出可能自然包含路径，统一视为不可信敏感正文；Renderer/Main不得把正文中的路径、URL、命令或JSON提升为Shell capability、native selection、权限决定或外链。

### 5.3 切换和输入权

- Session 与 Terminal 切换不重新启动进程，不创建新的 Attempt，不复制上下文。
- Terminal 可见不等于拥有输入权。Client 首次聚焦可写 Terminal 或显式选择“控制终端”时，通过 Runtime presentation channel 取得 `TerminalInputLease`：`leaseId + clientId + agentInstanceId + runnerHandleRegistrationId + handleGeneration + expiresAt`。同一 Handle generation 只有一个 active input lease；detach、切回 Session、连接失效、generation 变化或 expiry 时释放。重连必须重新申请，旧 lease 不能恢复双写。
- Terminal 获得键盘输入权时，Session composer 显示明确的输入占用状态和释放动作，不能同时向同一 PTY 写入。retained Handle 的 Terminal 固定为只读，不创建 input lease。
- Session 发送补充指令时，按 Runner capability 决定实时投递或进入下一次 Attempt，语义与 [m6-run-operations.md](m6-run-operations.md) 一致。
- Runner 进程退出后，Terminal 显示冻结输出，Session 显示 canonical 终态和可用的恢复/重试动作。
- PTY/ConPTY平台差异和最终TerminalInputLease校验由Rust Runtime/Runner Adapter承担；Electron Main只做有界MessagePort字节代理，不能拥有Node PTY或独立放行输入。
- 原样 Terminal 只在该 AgentInstance 从启动时就由交互式 PTY/ConPTY 承载时可用。如果某个 CLI 的 headless/RPC 模式与原生 TUI 互斥，Adapter 必须以交互式进程作为主 Handle，或把该 CLI 标记为 unsupported；不能另启一个 TUI 进程冒充同一实例。
- 每个被 Ensemble 列为 supported 的 Runner 都必须同时提供 Session 和 Terminal 两种产品视图。需要同时保留原生 Terminal 和有限结构化 Session 的 Runner，以 PTY/ConPTY 实例为主；Session 只展示 Runtime、文件观察和 Adapter 能可靠提供的结构化事件，不解析屏幕文本猜测 Tool call。无法提供其中任一视图的 CLI 只能显示为 unsupported 或 needs configuration，不能以“部分支持”进入正式 Runner 选择。
- Terminal transcript 可以写入受限的本地诊断存储，用于当前实例回看，但不是 canonical Event，默认按大小截断并遵守秘密脱敏规则。
- 外部启动的 Terminal 没有正式 Adapter 提供的创建、控制、receipt 和 termination authority，不能附加为 AgentInstance 或进入正式 Workflow；它只能作为独立外部工具打开。

Terminal presentation state 固定为 `connecting | live | reconnecting | disconnected | frozen | retained_readonly | transcript_unavailable`。这些状态不改变 AgentInstance lifecycle、Task outcome 或 Run health。原始按键包括 `Esc`、Ctrl-C 和 CLI slash command 都优先进入拥有 input lease 的 Terminal；Ensemble 只保留一个平台明确、不会被 CLI 普遍占用的退出全屏/释放输入快捷键，并在 Shell 层配置。

### 5.4 Attempt 后的 Handle disposition

Attempt 完成后，Runtime 必须对 Handle 明确选择 `reuse | retain | release`：

- `reuse` 保持同一 formal AgentInstance 的 live Handle，等待后续正常 AttemptLaunch；不能直接把下一条业务输入写进 Terminal。
- formal Handle 处于 coordination-protected 时，Runtime 必须自动记录 `reuse(reason=active_coordination_lease | coordination_rotation_in_progress)`；active/rotating lease、面向同一 continued Handle 的 pending replacement lease/launch 或未终态 CoordinationLaunch 可靠终结前，拒绝用户 retain/release 和 idle stop。Run finalization 先终结这些保护引用，再强制 release。
- `retain` 只用于不受 coordination protection 的 formal AgentInstance，并由用户通过幂等命令明确要求现场调试/检查；transient worker 和 coordination-only Handle 必须 release。retained Handle 继续占用 capacity 并绑定原 assignment/grant，raw Terminal 变为只读/input-fenced，只允许 Adapter 声明的 typed、side-effect-free inspection operation；无法强制该边界的 Runner 不提供 retain。输出进入诊断/transcript，不接受新的业务 Message、spawn、Artifact、Handoff 或 completion receipt。
- `release` 走 typed termination 并冻结 transcript/output；可靠 stopped evidence 前不能释放 capacity。
- retained Handle 到期、用户结束、Run finalization、Grant/qualification 失效或 generation 变化时进入 release，且 expiry 优先于 Terminal attachment/idle timer。未被新 AttemptLaunch 消费且不受 coordination protection 时，初始 reuse 可以改为 retain/release；retain 只能改为 release。liveness/cleanup Unknown 创建 Attention，不能默认为 idle 或 reusable。每个 settled Attempt 都保留自己的不可变 disposition record，registration 上只投影最新记录。

### 5.5 Detach 与 restore 不是同一件事

| 场景 | UI | Conversation | Live process | Terminal transcript | Business operation |
|---|---|---|---|---|---|
| Client/Webview detach 或页面切换 | 从 Client 状态恢复 | 从 Message ledger 重载 | 不改变 | 可重新 attach 当前 live Handle | 不改变 |
| 关闭窗口到托盘 | 重开窗口恢复 | 从 ledger 重载 | Runtime/Runner 继续 | 可重新 attach | 继续由原 Attempt 拥有 |
| Runtime graceful exit | 重启后恢复 | 从 ledger 重载 | 旧 Handle 已可靠终止 | 冻结历史只读回放 | 创建新 AgentInstance/Attempt，按 recovery plan 恢复 |
| Runtime crash / 注销 / OS shutdown | 重启后恢复 | 从 durable ledger 重载 | 必须先对账，不能假定存活或终止 | 只有已落盘部分可回放 | 按副作用证据恢复或进入 Attention |
| Provider-native session resume | 不决定 | 可以作为 Adapter 私有上下文来源 | 新/重新接管的 provider session | 取决于 Adapter | 只有 matching checkpoint/receipt 才能继续；session 存在不证明 operation 状态 |
| Transcript replay | 只读查看 | 不创建 canonical Message | 不存在要求 | 只读历史 | 不恢复、不重放、不证明完成 |

`providerSessionResume` 是 Runner 可探测的可选 capability。它只能优化上下文续接；Runtime 仍创建明确的新 AgentInstance/Attempt 或完成合法 Handle control transfer，并按 RecoveryCheckpoint 判断业务 operation。UI、conversation、process、transcript 和 business operation 的恢复声明必须分别验收。

### 5.6 Session 查询与 Client view state

Runtime 的 Session read API 按 Event sequence 游标分页，支持 `seatId`、`runId?`、`agentInstanceId?`、`attemptId?` 和 message/activity 类型过滤。返回页包含 `items[] + beforeCursor? + afterCursor? + projectionSequence`；`createdAt` 只用于显示，不决定顺序。搜索返回稳定 Message/Event refs，Client 不在已加载片段中假装完成全历史搜索。

设备端 `AgentWorkspaceViewState` 至少保存：

```text
workspaceId
seatId
agentInstanceId?
selectedView                  session | terminal
attemptFilter?
timelineAnchor?
composerDraft?
attachmentDraftRefs[]
terminalScrollAnchor?
updatedAt
```

它不包含 input lease、canonical Message、delivery status、Run/Task state 或 Terminal transcript。切换 Workspace/Agent 后可以恢复滚动、草稿和附件；冷启动不得自动恢复可写 Terminal，最多恢复 Session 或只读 Terminal 位置。

## 6. Runner Adapter 的最低边界

接入一个新 CLI 不要求实现其全部内部命令。最低 Adapter 能力为：

```text
probe
prepare_attempt_launch
commit_attempt_launch
query_attempt_launch
attach_terminal
resize_terminal
write_terminal
deliver_message
request_workspace_selection
deliver_permission_decision
deliver_worker_result
pause
resume
cancel
quiesce_for_shutdown
read
collect
```

消息、结构化 Signal、目录选择、一次性权限决定、Artifact 归集和安全退出 quiescence 属于可声明能力。Runner 没有当前 binding 要求的能力时，RunnerQualification 必须明确返回 unqualified，而不是从终端文本推断成功。

Terminal 中的 Ctrl-C 或 CLI 自有 interrupt 是普通 PTY/ConPTY 输入，不是 Session Domain Command。它可以促使 Runner 产生可靠的 lifecycle signal，但 Client 和 Runtime 不能仅因写入控制字节就把 Attempt 或 Run 标记为 `interrupted`。

Runner Adapter 不提供以下职责：

- 维护 Organization、Seat 或 Group
- 选择跨 Task 的协作顺序
- 把 CLI 私有 slash command 镜像成 Ensemble 命令
- 直接写入 Handoff、Artifact 或 Run State
- 让一个 CLI 读取另一个 CLI 的私有会话

首版官方 Runner 为 `pi`、Codex CLI 和 Claude Code。三个 Adapter 都必须满足 ContextPackage、Session 和 Terminal 三项产品能力，并在 Windows、macOS、Linux 通过同一资格测试；结构化 Tool call 等深度事件按真实能力提供，不能用缺失事件伪造状态。其它 CLI 没有正式 Adapter 时不能通过 Terminal 旁路进入编排。

## 7. 验收标准

- 用户能从 Active Seats 看到 Seat、AgentInstance、Attempt 和派生来源的区别。
- 用户能从父 Agent 定位到 transient worker 的创建记录和目标上下文；recovered transient 同时能定位当前 recovery parent/spawn triple 与旧 transient/Attempt recovery pair。
- 每个 transient worker 都有独立 assignment、grant 和 target ContextPackage；ordinary transient、formal Attempt recovery、recovered transient、coordination-only recovery 逐项通过 lineage validation，`ask` 审批不会生成 formal staffing Amendment。
- 不同 CLI 可以通过统一 Task/Handoff/Artifact/Context package 协作，不需要互相读取终端。
- supported Runner 的实例在 Session 与 Terminal 间切换时不重启 CLI、不复制 Attempt、不产生第二份运行状态。
- Terminal 能保留 CLI 原生 `/` 交互；Ensemble 不需要维护这些命令的推荐列表。
- 每个 supported Runner 都同时有 Session 和 Terminal；缺少任一能力的 CLI 不被标记为 supported。
- 同一 PTY 不会被 Session 和 Terminal 同时写入。
- Agent 发起的派生请求、用户补充指令和 Handoff 都有可重放的 Event 记录。
- worker lifecycle 只终结 worker；WorkerResult 通过结构化回执交还父实例，不能从 Terminal 推断或直接终态化父 Attempt。
- 看板、Active Seats、组织图和 Session 显示的是同一批稳定领域对象，不产生平行状态。
- Activity 始终落在五个简化值之一，且用户可以区分 activity、业务 outcome 和 Run health。
- supervised dispatch 不创建 Handoff；formal ownership handoff 必须指向目标 Task/Seat 和冻结 Artifact refs。
- ContextPackage 的协调合同、操作指南和 completion receipt schema 版本不匹配时不会启动目标 Attempt。
- Handle 完成后的 reuse、retain 和 release 都可追踪；retain 不产生新业务工作且继续占用 capacity。

## 8. 实施顺序

1. 先实现通用 AgentInstance/Attempt 关联和来源记录。
2. 再实现同一进程的 Session/Terminal 视图切换。
3. 用 `pi`、Codex CLI 和 Claude Code Adapter 分别验证 ContextPackage、可靠 Signal 和原样 Terminal。
4. 在三个 Runner 之间验证双向交接、不同 Runner Profile、空闲休眠和恢复。
5. 最后按真实能力补充 Runner-specific 深度事件；不以 slash command 镜像作为接入门槛。
