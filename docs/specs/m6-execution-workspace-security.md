# M6 Execution Workspace, Permissions, and History

**状态**：产品与实施基线 v1（2026-08-20）
**范围**：执行目录隔离、Agent 派生预算、文件与系统权限、秘密处理、历史保留、搜索与导出
**依赖**：[m6-domain-model.md](m6-domain-model.md) · [m6-run-operations.md](m6-run-operations.md) · [m6-runner-adapter.md](m6-runner-adapter.md) · [m6-agent-session-collaboration.md](m6-agent-session-collaboration.md)

## 1. 核心规则

- Ensemble 支持共享 Workspace、独立 Git worktree 和临时隔离目录三种执行方式。
- 负责分发工作的 Agent 选择执行方式并说明原因；Runtime 校验策略、能力和资源后才创建目录。
- 执行目录、权限、派生预算和历史策略在 Run 启动时解析并写入不可变 RunSnapshot。
- 父 Agent 不能给派生 worker 扩大自己的目录、权限、网络或发布范围。
- 不同 Agent 的修改冲突必须进入检查或 Attention，不能静默覆盖。
- 密钥不进入普通业务记录。完全权限不会关闭秘密脱敏。
- Terminal、Artifact、用户和Runner正文可能自然包含路径，必须按不可信敏感内容处理；该内容通道不能被提升为Shell selection、权限或外链。结构化bootstrap/platform/DTO边界仍禁止raw token/port/path/process/env泄露。

## 2. 三种执行目录

Canonical 值为：

```text
shared_workspace | git_worktree | temporary_directory
```

这三个值是完整枚举：Git 和非 Git 项目都使用 `shared_workspace` 表示项目根；`git_worktree` 只在 Git Workspace 可用；`temporary_directory` 适用于两者。创建 worker 不隐式创建 worktree，目录模式始终由 Dispatcher/parent 在允许集合内显式选择并由 Runtime 校验。

| 模式 | 适用工作 | 隔离边界 | 结果进入项目的方式 |
|---|---|---|---|
| `shared_workspace` | 串行修改、同一 Agent 的连续任务、需要即时共享文件状态的协作 | 直接使用 Workspace 项目目录 | 修改立即出现在 Workspace Change Set |
| `git_worktree` | 并行代码修改、独立评审和可合并任务 | 每个 AgentInstance 使用独立 worktree 和分支 | 通过明确的合并、挑选或补丁应用进入目标基线 |
| `temporary_directory` | 调研、实验、一次性生成和不应直接污染项目的任务 | 从冻结输入创建临时目录 | 选定结果作为交付结果或经检查后导入 Workspace |

### 2.1 选择和校验

多 formal Task Workflow 必须明确哪个 formal Seat 负责分发；transient worker 由发起 spawn 的父 Agent 分发。Runtime 不按最近活跃实例或 Seat 名称猜测分发者。

根 Dispatcher 自己没有上游 Agent。它在 Run 启动时使用已冻结的 bootstrap mode：默认 `shared_workspace`，权限来自 RunSnapshot；Runtime 据此创建 bootstrap assignment，用户可在启动预览覆盖。Runtime 在 Dispatcher AttemptLaunch prepare 前预分配 pending DispatcherCoordinationLease 和 dormant channel ref；Handle reliable committed 后才激活 lease/token。其业务 Attempt 可以正常完成，后续 formal Agent 的模式通过 lease-scoped channel 选择。transient worker 仍由明确父 Agent 的 active Attempt channel 选择。

Runtime 发起的 SelectionRequest 至少包含：

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

`requiredPathAccess[]` 使用已登记 FileRoot 或 PermissionGrant scope 引用，不把绝对路径写入 Domain Event。Runtime 在目录选择前先原子预留 capacity、创建 target AgentInstance 和独立 PermissionGrant，再持久化 SelectionRequest 与 `execution.workspace.requested`。因此 request 投递前已经有稳定 target ID。

Runtime 对 formal Task 通过 active DispatcherCoordinationLease channel 投递，对 transient worker 通过 parent Attempt channel 投递；Agent 只能用相同 request ID/digest 的结构化 `execution_workspace_selection` RunnerSignal 回答 selected mode 和 reason。Runtime 校验 selector kind、AgentInstance、Handle generation，以及互斥的 lease/parent Attempt ref；普通模型文本、Prompt 声明和 Terminal 屏幕内容都不能创建目录分配。

Runtime 按以下顺序处理：

1. 校验 response request ID/digest、selector Handle generation 和 target refs。
2. 校验 formal selector 的 active coordination lease，或 transient selector 的 active parent Attempt，并验证目录选择能力。
3. 校验目标项目、Runner、Git 状态、磁盘空间和平台能力。
4. 校验所选模式能否忠实包含 `baselineRef`，包括 Run 启动前已有的未提交内容。
5. 追加 `execution.workspace.selection_received`，创建并记录 `ExecutionWorkspaceAssignment`。
6. 目录准备完成后再创建 Attempt/Context 和两阶段 launch。

Runtime 不能静默改用另一种模式。投递/response 超时、lease/parent unavailable、同 request 冲突响应或所选模式不可用时，TaskExecution 进入 `blocked`，target 实例保持 provisioning，追加 blocked Event 并创建 `workspace_selection_blocked` Attention；相同 ID/digest 重放返回原结果，同 ID 不同 digest conflict。用户重试时创建带 `retryOfSelectionRequestId` 的新 request，或通过 `execution.workspace.override` 明确覆盖，不能自动使用默认模式。safe shutdown 收敛未被任何 process/plan owner 覆盖的 pre-Attempt aggregate 时，旧 request 不再接收 response，关联的 open Attention 必须以 Runtime 系统动作 `superseded_by_safe_exit_before_launch` resolve且不创建 DecisionRecord；该规则与同 Run 是否存在 ShutdownRecoveryPlan 无关。`continue_pre_attempt` 的新 request 若再次 blocked，创建新的 Attention。

### 2.2 默认建议

分发 Agent 可以根据任务覆盖默认建议：

- 并行写代码默认选择 `git_worktree`。
- 串行或需要观察同一实时目录的任务选择 `shared_workspace`。
- 调研、试验和可丢弃生成选择 `temporary_directory`。

选择结果和原因必须可查看、可搜索。用户可以在启动前覆盖；Run 启动后变更模式需要创建新的 Attempt 和目录分配，不能原地移动运行中进程。

### 2.3 共享目录冲突

- Runtime 记录文件观察来源，但不能把“最后活跃 Agent”当作修改作者。
- 两个可写 AgentInstance 同时使用共享目录时，启动预览必须明确显示共享写入风险。
- 文件内容或目标基线冲突时停止自动整合，创建 Review 或 Attention。
- 用户修改和外部程序修改与 Agent 修改同等对待，不能被自动覆盖。

### 2.4 Worktree 和临时目录生命周期

- Worktree 的来源 ref、分支、目录、创建者和目标集成基线必须记录。
- 非 Git Workspace 不能选择 `git_worktree`。
- 标准 worktree 无法忠实包含冻结基线时，Runtime 必须先物化该基线或拒绝启动，不能丢弃未提交内容。
- 临时目录从不可变输入清单创建；未明确选择的外部目录不自动复制进去。
- AgentInstance 停止后，Runtime 先冻结 Change Set、交付结果和诊断引用，再按保留策略清理隔离目录。
- 清理只能删除 Runtime 创建且仍由其登记的目录，不能删除 Workspace 项目目录或用户选择的外部目录。

### 2.5 结果整合

隔离目录的结果整合策略为：

```text
review | auto_if_clean | manual
```

默认是 `review`：Attempt 完成后冻结 Change Set 和交付结果，Runtime 持久化 ResultReviewRequest 并通过 `execution.result.review_requested` 分配稳定 `resultReviewRequestId`；用户或 Review Gate 随后选择要应用的文件项、valid Artifact 或两者。`auto_if_clean` 只在选择并集非空、所选 Change Set entries（存在时）完整、所选 Artifact（存在时）已通过交付契约和完整性校验、目标基线未漂移且应用无冲突时自动整合。`manual` 永不修改目标项目，只保留 Diff、补丁或交付结果供外部处理。

规则：

- `shared_workspace` 的修改已经位于目标目录，不执行第二次整合；Review 只决定是否接受业务结果。
- `git_worktree` 把选中的冻结 Change Set entries 应用到记录的 `integrationTargetRef`，并按 Artifact Contract 支持的目标表达整合选中的 valid Artifact；两类选择不要求同时存在。文件实现可以使用受控 merge/cherry-pick/patch，但 UI 命令和审计记录必须保持统一语义。
- `temporary_directory` 只导入 Review 明确选择的文件或交付结果，不复制整个临时目录。
- 目标基线漂移、文件冲突、完整性不足或验证失败时停止整合并创建 Attention；不能自动选择“ours/theirs”。
- 整合先在受控 staging 状态验证，再写入目标。失败不能留下部分应用的文件；平台或 Adapter 无法保证这一点时，`auto_if_clean` 必须报告 unsupported。
- **拒绝** 直接引用仍为 `review_requested` 且没有非终态 Apply attempt 的 `resultReviewRequestId`，并终态化 ResultReviewRequest；初始 Reject 不需要、也不创建 ResultIntegrationAttempt。每次实际 **应用结果** 才由 Runtime 创建回指该 request 的不可变 ResultIntegrationAttempt，记录 selected Change Set entries、selected valid Artifacts、目标基线、request digest 和结果。首次 Apply 要求 request 尚无 attempt；已有 failed attempt 后只能按原 selection Retry，不能无 retry ref 重新选择。`selectedChangeSetEntryRefs[]` 与 `selectedArtifactRefs[]` 的合并基数必须至少为一，任一数组可以为空；file-only、Artifact-only 和组合整合都是合法输入。`auto_if_clean` 由 Runtime 在创建 attempt 时把全部 eligible entries/Artifacts 冻结为 selected refs；不允许 Client 或 Adapter 隐式补选，也不允许 Client 生成 integration identity。
- 写入回执不明时进入 `integration_unknown`，只按原 integration ID/digest 对账，不能自动再次应用。Result integration Retry 只允许 source `ResultIntegrationAttempt.status == failed`；`integration_unknown` 必须先对账并被 canonical 归类为 `failed`。不得从 `integrated`、`requested`、`staging`、`reconciling` 或 `integration_unknown` Retry；ResultReviewRequest 已为 `integrated | rejected` 时也不得创建 Apply。Retry 必须使用新 command ID 创建新的不可变 ResultIntegrationAttempt，以 `retryOfIntegrationAttemptId` 引用 source failed attempt，并重新执行正常的 target、expected baseline、selection、integrity 和 policy validation；source 一旦成为 `integrated`，Runtime 永远不得发起第二次 target write。
- 首版提供 **应用结果**、**稍后处理**、**拒绝** 和 **在外部工具中打开**。稍后处理只关闭当前 Review 并保持 `review_requested`，不新增持久化 disposition。

## 3. Agent 派生策略

派生审批模式为：

```text
auto | ask | deny
```

默认使用 `auto`。Workspace、Workflow 模板和单次 Run 可以覆盖该值，解析优先级为：

```text
Run override > Workflow override > Workspace default
```

默认预算：

| 配置 | 默认值 | 计数方式 |
|---|---:|---|
| Workspace 同时活动的 AgentInstance | 4 | 当前 Workspace 所有未释放 `capacityReservationId`，覆盖 provisioning 到 stopping 全周期 |
| 单个父 Agent 同时活动的子 worker | 2 | 该父实例直接派生且未停止的子实例 |
| 最大派生深度 | 2 | formal AgentInstance 为 0，每向下派生一层加 1 |
| 单个 Run 的原始实例谱系节点 | 8 | 首次 formal 实例和 transient spawn 各计一次；recovery replacement 不重复计数 |
| 单条实例谱系的恢复代次 | 3 | 每次进程退出后的 replacement 加一；超过上限进入 Attention |

规则：

- 默认预算必须可在 Workspace 设置和 Run 启动预览中调整。
- 每个新 formal、transient 和 recovery replacement 都在创建 AgentInstance 的同一 SQLite 事务重验预算并占用 capacity reservation；并发 provisioning 不能先分别通过检查再超卖。reservation 在目录选择 blocked、starting、running、waiting、paused 和 stopping 期间都计数，只有确认 Handle 与目录资源释放后才原子释放。
- `auto` 只跳过人工确认，不跳过权限、预算、Runner、目录和 Contract 校验。
- Agent 自发派生必须通过 Runner Handle 绑定的结构化 `spawn_request` RunnerSignal 或等价 Runtime tool callback；自由文本不能触发派生。
- `ask` 为每次派生创建 `spawn_approval` Attention；批准后仍需重新校验当时资源，不生成 Amendment。`staffing_request` 只用于新增 formal Seat/Task。
- Recovery replacement 不消耗单 Run 原始实例谱系预算，但仍受 Workspace active、父级活动 child、depth 和独立 recovery generation 上限约束。
- `deny` 拒绝 Agent 发起的派生，但不禁止 Workflow 已定义的 formal Seat。
- 达到预算时不自动停止已有实例。派生请求进入 blocked 状态，并提供等待、提高预算或拒绝三个动作。
- 提高运行中预算必须形成可审计的 Run Amendment。

## 4. 权限模型

Ensemble 提供四个预设档位：

```text
read_only | workspace_write | selected_paths | full_access
```

| 档位 | 文件系统默认范围 |
|---|---|
| `read_only` | 可读取 Workspace 和明确选择的目录，不可写入 |
| `workspace_write` | 可读写 Workspace 项目目录，外部目录默认拒绝 |
| `selected_paths` | 仅按 `pathGrants[]` 读取或写入用户通过原生选择器添加的目录 |
| `full_access` | 不限制文件系统和本地进程范围；界面持续显示高权限标记 |

`pathGrants[]`在Rust Runtime内部继续使用平台原生绝对路径，并分别记录`read | write`和`attempt | run | workspace`有效期；该持久化合同与save meaning不变。Renderer/Shell shared DTO只使用`selectionRef/displayName/access/expiresAt`，Workspace create字段固定为`projectSelectionRef`和`pathGrantSelections[]`，不能与持久化FileRoot/PathGrant ref混名。Electron Main将selectionRef绑定来源/purpose/access/expiry/immutable commandId并解析为现有Runtime输入。用户可以选择Workspace外目录；选择目录不等于永久授权，过期后必须重新授权。

文件权限之外，以下能力分别配置：

```text
networkAccess
externalProcessExecution
writesOutsideWorkspace
destructiveCommands
externalPublish
```

每项使用：

```text
allow | ask | deny
```

`externalPublish` 包含 Git push、创建远端 PR、上传、发消息和其它离开本机的写操作。`full_access` 预设可以将以上能力设为 `allow`，但用户仍可逐项收紧。

默认使用：

```text
allowedWorkspaceModes       shared_workspace | git_worktree | temporary_directory
resultIntegrationPolicy     review
profile                    workspace_write
networkAccess              allow
externalProcessExecution   allow
writesOutsideWorkspace     deny
destructiveCommands        ask
externalPublish            ask
```

这组默认值允许正常安装依赖、运行构建和调用网络服务，但不允许静默写出 Workspace。删除大量文件、重写 Git 历史等破坏性操作，以及 push、创建 PR、上传或发消息等对外写操作默认要求确认。用户可以在 Workspace 创建或设置中改为其它策略；`full_access` 默认把五项能力设为 `allow`。

### 4.1 权限解析

- Workspace 保存默认权限策略；RunSnapshot 保存解析后的有效策略。
- Task 或 Seat 可以请求更小范围。请求扩大范围时，启动前必须由用户明确确认或匹配已保存的 Workspace 授权。
- transient worker 继承父实例和当前 Run 的交集，只能缩小范围。
- Rust Runtime唯一拥有PermissionGrant策略解析、operation decision与扩大/拒绝裁决；Runtime、Runner Adapter和Rust/平台sandbox或broker共同执行技术限制。Electron Main只提供具名native picker/平台primitive并代理opaque selection，不能评估、扩大PermissionGrant或批准operation。Prompt中写“不要访问”不能代替技术限制。
- 平台无法可靠执行某项限制时，Runner 探测结果必须标记 unsupported，不能把提示词约束显示为已隔离。
- 文件和网络范围优先由Rust Runtime控制的Rust/平台sandbox或broker执行；破坏性命令和外部发布审批优先使用Runtime经Runner Adapter调用的CLI官方permission hook、RPC或结构化tool callback。Electron Main不参与decision。
- Ensemble 不解析 Terminal 屏幕或自由文本来猜测命令是否危险。Adapter 没有可靠 hook，平台 broker 也无法拦截时，`destructiveCommands=ask` 或 `externalPublish=ask` 对该 Runner 是 unsupported capability。
- 用户在已打开的 Terminal 中亲自输入并确认命令属于直接用户操作，但仍受文件、网络和进程硬边界限制；它不会永久扩大 Agent 的 PermissionGrant。

### 4.2 `ask` 操作的一次性审批

可靠 hook/broker 在 operation 执行前提交绑定 Run、AgentInstance、Attempt、Handle generation、PermissionGrant、operation ID/kind/digest 和脱敏 intent ref 的 PermissionOperationRequest。Runtime 先持久化 request、`permission.operation.requested` 和 `permission_operation` Attention，再返回 blocked acknowledgement；在此之前 hook 不得释放 operation。

用户只能选择 `approve_once | reject`。批准记录精确 request/operation/digest 和 DecisionRecord，创建稳定 PermissionDecisionDelivery 并交还同一 hook；它不替换 PermissionGrant、不修改 Snapshot，也不授权下一次类似操作。receipt delivered 后才恢复 Attempt。请求超时在事务内转为 `expired`、以 system action 解决 Attention、创建 reject delivery，但不创建用户 DecisionRecord；相同 request/digest、timeout 和 delivery 重放返回原结果，不同 digest conflict。

活动 Attempt/Handle 的 PermissionGrant 禁止原地扩大或轮换。尚无 AttemptLaunch、live Handle、coordination lease 或 operation 的 TaskExecution/AgentInstance，可以通过 `run.amend(replace_unstarted_permission_grant)` 原子创建新 Grant、撤销旧 Grant并追加 replacement Event。普通 Retry 沿用原 TaskExecution 的冻结 permission policy；活动工作需要更大允许路径或能力时，唯一合法路径是 `amend_and_rework`：在同一事务终结旧 Attempt/TaskExecution、为 Snapshot 后代和新 TaskExecution activation 冻结新 policy，再由统一 provisioning pipeline 创建新 AgentInstance 和不可变 PermissionGrant。`approve_once` 只能放行当前 Grant 已标为 `ask` 的同一 operation，不能代替 `amend_and_rework`、添加路径或扩大 capability。不提供隐式热更新 token 的旁路。

批准 delivery unknown 时 operation 保持 blocked，并创建 `permission_decision_delivery_unknown` Attention。只有同一 live hook 的 dedupe/query 能力可以确认原 receipt；禁止自动重新批准。Runtime 恢复时同时检查 request、decision delivery 和 operation RecoveryCheckpoint：已批准不等于已执行，receipt unknown 或副作用阶段 unknown 时必须等待用户核对，不能从 Terminal、文件存在或 Agent 自述猜测。

## 5. 秘密处理

默认策略：

1. Token、密码、私钥和登录态存入操作系统凭据存储；Workspace 和 RunnerProfile 只保存引用。
2. 完整环境变量值不写入 Event、Message、交付结果元数据、ContextPackage、普通日志或导出文件。
3. 结构化输出在持久化前按已知 token、key、password 和私钥模式脱敏。
4. `.env`、凭据目录、私钥和平台认证文件默认不出现在文件搜索、附件选择器和 ContextPackage 自动收集结果中。
5. 用户显式附加疑似秘密文件时，界面显示风险并要求确认；原文件权限不因此改变。
6. Terminal 原始输出只能做尽力脱敏。打开或导出 Terminal transcript 时必须提示：CLI 可能已经输出未识别的秘密。
7. `full_access` 不关闭日志脱敏、附件风险提示或秘密文件默认隐藏。

秘密文件隐藏只限制 Ensemble 的浏览、索引和自动附加，不代表完全权限 Runner 无法读取该文件。需要强隔离时，用户必须使用受限权限档位和不包含秘密的目录授权。

## 6. 历史、搜索、导出和恢复

### 6.1 默认保留

- Message、DecisionRecord、Agent 谱系、Attention、交付结果、Change Set、ResultReviewRequest 和 ResultIntegrationAttempt 的内容随 Run 历史保留，直到用户按明确策略删除；canonical Event row 和仍被引用的 typed identity row 永不删除。
- Archive 只从默认列表隐藏，不删除历史。
- 原始 Terminal/stdout 诊断数据默认保留 30 天，并限制为每个 Run 100 MB；任一上限触发时优先清理最旧片段。
- 用户固定的证据片段先经过脱敏，再创建 EvidencePin，不受原始 transcript 自动清理影响。
- 保留时长和容量可在 Workspace 设置中调整，变更不追溯删除已经固定的 EvidencePin。

### 6.2 搜索

搜索至少覆盖：

- 当前 Seat Session 和 AgentInstance 历史
- 当前 Run 的 Message、Task、Attention、交付结果和文件路径
- 当前 Workspace 的 Run、Seat、Task 和交付结果元数据

搜索结果必须保留来源并可定位到 Session 消息、Task、文件、Diff 行、交付结果或 Attention。秘密文件内容和已脱敏原文不进入普通全文索引。

### 6.3 导出

用户可以导出选中的 Session 或完整 Run。每次请求创建 Workspace 级 HistoryExportRecord，记录选择清单、是否包含 Terminal、结果引用、digest 和失败原因；记录本身不保存导出正文或秘密。导出包包含清单、来源 ID、时间、消息、状态、选定交付结果、Change Set 引用和验证结果。默认不包含：

- 未经选择的项目文件
- Runner 密钥和环境变量
- 原始 Terminal transcript
- Workspace 外部目录内容

添加 Terminal transcript 或外部文件时必须单独选择并再次执行脱敏检查。

### 6.4 删除与清理

- Archive 不是删除。永久清理只能从明确的历史维护入口发起，预览受影响的 Session、终态 Run、transcript、EvidencePin、content blob 和 typed tombstone；非终态 Run 或恢复计划引用的内容不能删除。
- 删除请求使用 `history.delete.request`；Runtime 在执行前创建 `status=requested` 的 Workspace 级 HistoryDeletionRecord，完成或失败后更新其状态并追加对应 Event。成功记录保留目标 ID、范围摘要、策略、操作者、时间和 tombstone manifest digest。
- V2 canonical Workspace Event ledger 永不删行、重排、改 sequence 或用 projection checkpoint 截断。Event payload 不保存被清理正文；清理删除独立 content/blob/index，并把所有仍被 Event、ContextPackage、Handoff、Decision、Artifact 或谱系引用的对象转换为最小 typed tombstone，保留 ID、kind、lineage、创建/删除时间和 deletion record ref。
- HistoryDeletionRecord 和 typed tombstone 不保存被删除正文、Terminal 字节、可恢复输入或秘密。内部引用返回 tombstone 而不是 404/悬空外键；搜索和导出忽略内容，历史 UI 显示已删除。
- 自动 transcript 过期属于保留策略执行，仍记录范围和清理时间；它不删除 canonical Event、Message、DecisionRecord、Attention、交付结果或 Change Set 引用。
- Projection checkpoint 只能压缩可重建索引；SQLite 可以回收 content blob 空间，但账本和 tombstone identity 保持完整，因此重启对账不会把合法清理误判为 sequence corruption。
- 固定 EvidencePin 在用户明确取消固定或选中删除前不受 transcript 自动清理影响。

### 6.5 恢复

- 应用重启后先恢复持久化 Run、消息和 AgentInstance 谱系，再判断 Runner 进程是否仍有效。
- 不能恢复的进程保留 Session 历史，并按运行状态机创建 recovery Attempt 或结束动作。
- 恢复不会重新启动已完成 Task，也不会把当前文件内容伪装成历史 Change Set。
- 自动恢复只适用于无副作用、可验证幂等或有可靠 Runner checkpoint 的工作；已发送但回执不明的提交、发布、删除和外部写入必须创建 Attention。
- 计划后台运行只使用 ScheduleLaunchTemplate 引用的 ExecutionPolicyVersion 与当前 Workspace policy 的交集。没有 Client 连接时，`ask` 保持等待，不自动变成 `allow` 或 `deny`。
- 关闭窗口到托盘、ScheduleFire 幂等、ExecutionClaim 和进程回收的完整规则见 [m6-local-runtime-scheduling.md](m6-local-runtime-scheduling.md)。

## 7. Session 附件与快捷操作

Session 消息可以附加：

```text
project_file | selected_diff_lines | deliverable | task | attention
```

- 附件保存稳定引用、版本或完整性摘要，不把“当前路径”当作历史内容。
- 发送前显示目标 Agent、Task/Run、权限影响和内容摘要。
- 文件或 Diff 超出目标 Agent 的目录范围时，先调整授权或移除附件，不能靠 Prompt 绕过。

默认快捷键：

| 快捷键 | 动作 |
|---|---|
| `Cmd/Ctrl+K` | 全局搜索 |
| `Cmd/Ctrl+Enter` | 发送 Session 消息 |
| `Shift+Enter` | 消息换行 |
| `Cmd/Ctrl+Shift+T` | 在同一 AgentInstance 的 Session 与 Terminal 间切换 |
| `Cmd/Ctrl+Shift+A` | 附加文件、Diff、交付结果、Task 或 Attention |

快捷键必须支持平台映射和用户配置。输入法组合、Terminal 键盘输入和系统保留快捷键优先，不得误触发 Session 动作。

## 8. 验收标准

- 分发 Agent 能选择三种执行目录，Runtime 能验证并持久化选择原因和基线。
- 两个并行写代码 Agent 默认使用独立 worktree，整合冲突不会静默覆盖。
- 派生默认自动批准，实例/恢复预算、审批模式和运行中调整都可配置、可审计。
- 用户能使用四个权限档位、原生目录选择器和五项独立能力策略。
- transient worker 不能扩大父实例权限或绕过派生预算。
- 活动工作需要更大路径或 capability 时只能 `amend_and_rework` 并创建新 Snapshot/TaskExecution/AgentInstance/PermissionGrant；热扩大 Grant 和用 `approve_once` 代替都被拒绝。
- 完全权限有持续可见标记，且不会关闭秘密脱敏。
- 业务历史可搜索、可导出、可恢复；原始 Terminal 受 30 天和每 Run 100 MB 默认上限约束。
- Session 可以附加文件、Diff 行、交付结果、Task 和 Attention，并保持版本与来源。
- worktree/临时目录结果默认先检查再应用；`execution.result.review_requested` 先创建稳定 ResultReviewRequest，初始 Reject 只引用其 ID 且不创建 Apply attempt。file-only、Artifact-only 和组合选择均可整合，合并选择至少一项；自动整合只在适用于所选类型的完整性/契约校验通过、基线未漂移且无冲突时发生，失败不留下部分写入。
- Allowed paths 作为独立文件根显示；`full_access` 的未登记 root 外变化只能标记为 partial。
