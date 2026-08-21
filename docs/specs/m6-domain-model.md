# M6 Domain Model

**状态**：实施基线 v1（2026-08-20）
**范围**：业务对象、关系、版本、所有权和不变量  
**不包含**：具体编程语言、数据库、HTTP 路由和组件实现

## 1. 核心裁决

### 1.1 Organization 与 Workflow 分离

```text
Organization = 谁参与、职责是什么、组织关系是什么
Workflow     = 做什么、何时做、依赖什么、如何交付和决策
RunSnapshot  = 某次执行冻结的 Organization + Workflow + Runner 配置
RuntimeState = 执行期间不断变化的状态、事件、Attention 和 Artifact
```

组织层级不能直接充当执行顺序。两者可以在 UI 中相互投影，但必须是独立模型。

### 1.2 业务不变量

- 一个 Seat 只有一个语义父节点
- Seat 是稳定岗位，AgentInstance 是 Run 中的实际 Runner 实例，TaskAttempt 是一次执行；三者不能共用一个 ID 或生命周期
- 一个 Task 只有一个负责 Seat
- 一个 Run 以一个不可变 RunSnapshot 启动；Amendment 只能追加新的不可变 Snapshot 后代，不能原地改写
- Run 启动后，Workspace 设置变化不能修改该 Run
- Runner 密钥、Token 和登录态不进入 Workspace 或 Run 文件
- Canvas 坐标不进入 Organization 或 Workflow 业务对象
- Artifact 一旦被下游消费，不允许原地覆盖
- Project File 属于 Workspace 当前文件系统视图，不属于 Seat 或 Agent
- Change Set、Artifact 和 Project File 是三个不同概念；文件变更不能自动推断成 Artifact
- 每个启动中的 AgentInstance 必须有已验证的执行目录分配和有效权限；transient worker 不能扩大父实例范围
- 每条 Session Message 必须绑定 Task 和 Run；长期 Seat Session 不能产生无归属聊天记录
- 系统状态使用稳定 code，不使用本地化文字作为业务值
- 动态修改 Run 必须形成 Amendment，不能静默改写快照
- End 的成功或失败结果必须由 Snapshot 显式定义，不能从节点名称、入边 trigger 或画布位置推断

---

## 2. 聚合边界

```text
Device
  ├── DevicePreferences
  ├── RunnerInstallation[]
  └── RunnerProfile[]

Workspace
  ├── WorkspaceConfig
  ├── RunnerQualification[]
  ├── OrchestrationDraft
  │     ├── OrganizationDraft
  │     ├── WorkflowDraft
  │     └── PresentationDraft
  ├── OrchestrationVersion[]
  ├── TemplateReference[]
  ├── ExecutionPolicyVersion[]
  ├── ScheduleLaunchTemplate[]
  ├── RunQueueItem[]
  ├── Schedule[]
  ├── ScheduleFire[]
  ├── Attention[]
  ├── HistoryExportRecord[]
  ├── HistoryDeletionRecord[]
  └── Run[]

Run
  ├── RunSnapshot
  ├── NodeExecution[]
  ├── TaskExecution[]
  ├── AgentInstance[]
  ├── ExecutionClaim[]
  ├── RecoveryCheckpoint[]
  ├── ShutdownRecoveryPlan[]
  ├── RunnerHandleRegistration[]
  ├── DispatcherCoordinationLaunch[]
  ├── DispatcherCoordinationLease[]
  ├── SpawnRequest[]
  ├── TaskAttempt[]
  ├── AttemptLaunch[]
  ├── ArtifactCandidate[]
  ├── ArtifactCandidateValidationRecord[]
  ├── RunnerResult[]
  ├── Message[]
  ├── ContextPackage[]
  ├── WorkerResult[]
  ├── WorkerResultDelivery[]
  ├── DecisionRecord[]
  ├── Handoff[]
  ├── ExecutionWorkspaceSelectionRequest[]
  ├── ExecutionWorkspaceAssignment[]
  ├── ResultReviewRequest[]
  ├── ResultIntegrationAttempt[]
  ├── PermissionGrant[]
  ├── PermissionOperationRequest[]
  ├── PermissionDecisionDelivery[]
  ├── Artifact[]
  ├── EvidencePin[]
  ├── Event[]
  └── RunAmendment[]
```

Device、Workspace 和 Run 是三个主要所有权边界。

---

## 3. 标识、时间和版本

- 所有持久化对象使用稳定、不可复用的 ID
- 显示名称可以修改，不能作为引用键
- 所有时间写入 UTC ISO 8601，显示时本地化
- 可编辑文档包含单调递增的 `revision`
- 不可变版本包含 `versionId` 和内容摘要
- 命令包含唯一的 `commandId`，用于因果关联和幂等处理；传输字段名为 `command_id`，不再维护第二个 Client operation ID
- Event 包含单调递增的 Workspace 事件流 `sequence`；Run 级 Event 额外携带 `runId`

不允许使用数组顺序表达业务依赖或阶段语义。

---

## 4. Device Domain

### 4.1 DevicePreferences

```text
uiLocale
themeMode
themeId
density
motionPreference
contrastPreference
lastWorkspaceId?
launchAtLogin
```

该对象属于当前设备，不进入 Workspace。`launchAtLogin` 默认 `true`；关闭时，恢复和错过计划等待用户手动启动 Ensemble。

### 4.2 RunnerInstallation

表示当前设备检测到的执行引擎：

```text
runnerId
adapterId
displayName
version?
adapterVersion
supportedVersionRange
availabilityStatus
authenticationStatus          signed_in | signed_out | unknown | not_applicable
capabilities[]
executablePath?
lastCheckedAt
diagnosticCode?
```

`availabilityStatus`：

```text
available | not_installed | installed_incompatible | missing_configuration | unsupported_platform | probe_failed
```

`probing` 只属于 Client 的瞬时请求状态，不写入 RunnerInstallation。探测完成后，Domain、Runner Adapter 和 Client 必须保存或传递以上同一组 canonical 值。`available` 只表示当前设备上的 Adapter、CLI 版本、平台、配置和原生登录探测通过，不包含任何 Workspace 权限或 Workflow capability 判断。`signed_out` 通常映射为 `missing_configuration`；Ensemble 只记录状态和诊断 code，不读取 CLI 的账号 Token。

### 4.3 RunnerProfile

设备级 Runner 配置：

```text
profileId
runnerId
displayName
executablePath?
configurationHome?
nonSecretSettings
secretReferences[]
```

秘密值保存到平台安全存储，`secretReferences` 只保存引用。Runner 的账号 Token 和登录刷新由 CLI 原生配置管理，Ensemble 不复制凭据。Workspace 有默认 Profile，Seat 可以覆盖；AgentInstance 启动时冻结具体 Profile。

### 4.4 RunnerQualification

RunnerQualification 是 Workspace 对一个设备 Profile 在明确需求集合下的派生资格，不改写 RunnerInstallation：

```text
qualificationId
scopeKind                    workspace_creation | workspace | run_preview
workspaceId?
runnerProfileId
installationProbeDigest
policyDigest
requiredCapabilities[]
requiredContractVersions
requirementsDigest
status                        qualified | unqualified
missingCapabilities[]
missingContractVersions[]
reasonCodes[]
evaluatedAt
```

`requiredContractVersions` 至少包含 `coordinationContractVersion`、`operationGuideVersion` 和按 ContextPackage purpose 可选的 `completionReceiptVersion`。同一个可用 installation 可以在不同 Workspace、policy、Task requirements 或合同版本下产生不同 qualification。`workspace_creation` 在 Workspace ID 分配前使用当前表单解析出的 policy digest，结果只存在于创建事务/Client 请求上下文；创建成功后 Runtime 用已保存 Workspace policy digest 生成持久化 `workspace` qualification。Run 预览按冻结候选 policy 生成 `run_preview` qualification。Workspace 创建、Run 预览和 Snapshot 解析只选择 `qualified` binding，并展示不合格的稳定原因；`missingContractVersions[]` 使用 typed contract kind、required version 和 Adapter advertised versions，不能压入自由文本 reason。不得把 Workspace-specific 失败写回设备级 `availabilityStatus`。RunSnapshot 冻结最终 Runner binding、capabilities、contract versions 和 qualification digest，运行中不回读新的派生结果。

---

## 5. Workspace Domain

### 5.1 WorkspaceConfig

```text
workspaceId
name
projectRoot
defaultRunnerProfileId
defaultOutputLocale
executionPolicy
createdAt
updatedAt
archivedAt?
```

规则：

- `projectRoot` 必须是用户明确选择且当前平台可访问的目录
- 创建时默认 Runner Profile 的设备 installation 必须可用，且基于当前表单 policy digest 的 `scopeKind=workspace_creation` RunnerQualification 必须为 `qualified`
- Workspace 后续仍可在 Runner 丢失时打开和编辑，但不能启动 Run
- 修改默认 Runner 只影响之后创建的 RunSnapshot
- 修改执行目录、派生、权限或历史默认值只影响之后创建的 RunSnapshot
- Archive 不删除 Run 和 Artifact

### 5.2 OrchestrationDraft

Workspace 中当前可编辑内容：

```text
draftId
revision
organization
workflow
presentation
lastSavedAt
lastValidatedAt?
validationSummary?
```

Draft 自动持久化，不要求用户依赖手动保存按钮防止数据丢失。所有修改通过同一 `orchestration.draft.apply` 入口提交结构化 `operations[]`；一个批次要么完整推进 revision，要么完全不改变 Draft。操作只能引用稳定对象 ID 和已声明字段，不接受 JSON Patch、任意字段路径或组件私有状态。

`revision` 和 `lastSavedAt` 只随 matching `orchestration.draft.applied` Event，或包含同一已应用 command 结果的权威 Snapshot 推进。传输层 accepted 只证明 Runtime 已把完整 `commandId + expectedRevision + operationDigest + operations[]` 写入 durable command ledger 并接管后续执行/对账，不表示业务已保存，也不能提前推进 revision、lastSavedAt 或清除 overlay。Client 的全局 operation registry 按 `commandId` 跟踪该 durable command；页面离开不会取消它。graceful quit 在 sidecar-wide command-admission fence 后必须让每条 already-accepted Draft row 得到 canonical applied/rejected/conflict result；Force quit/crash 后 Runtime 在 write-ready 前以原 identity/payload 幂等恢复未终态 row。两条路径都不创建新的 Domain object、command 或 persistence field。

尚未形成 canonical Event 的 `LocalDraftBatch`、表单输入和 promoted overlay 可以写入设备级 Client Draft recovery journal，以便导航或进程重启后恢复。该 journal 只使用既有 `workspaceId + draftId + localBatchId/commandId` 索引，不是第二份 OrchestrationDraft：恢复时必须先加载 canonical Draft，再对原 command 查账，并对仍未发送的 batch 重新投影和校验；journal 内容不得推进 revision、创建 Version 或显示为 saved。

`validationSummary` 引用与当前 `revision` 绑定的校验投影。每条 `ValidationIssue` 至少包含：

```text
issueId
code
severity                     warning | blocking_error
scope                        organization | workflow | presentation
objectId?
fieldPath?
relatedRefs[]
messageKey
messageParams
revision
```

`issueId` 在同一 revision 内稳定；排序固定为 `blocking_error` 优先，再按 scope、object ID、field path 和 issue ID。校验结果 revision 旧于当前 Draft 时只能显示为过期结果，不能决定 Run 是否可启动。悬空引用没有目标对象时，`objectId` 指向仍存在的 owner，缺失目标放在 `relatedRefs[]`，让 Client 能定位到修复入口而不是猜最近对象。

Draft operation kind 固定为 `create_object | update_object | delete_object | move_ownership | set_layout | auto_layout | upsert_artifact_binding | delete_artifact_binding | set_dispatcher`。`delete_object` 和会替换 Dispatcher、移动子项或移除 Binding 的操作必须携带由 Runtime 对当前 revision 计算的 `impactDigest` 与 `resolutionPlan[]`。影响预览返回 typed reference graph：目标对象、引用来源、可达性变化、受影响 Binding、需要提升/移动的子项和合法修复 action。提交时 impact 已变化则 conflict，不能级联猜测或部分删除。

Undo/redo 不保存为另一套业务状态。尚未发送的批次可以从本地队列移除；已经 applied 的操作必须用新 `commandId` 提交 Runtime 生成或验证的 inverse operations。对象删除、ownership move、批量布局、Dispatcher 替换和 Binding 修改各自保持一个原子撤销单元。

### 5.3 OrchestrationVersion

不可变版本：

```text
versionId
workspaceId
sourceDraftRevision
organization
workflow
presentation
createdAt
createdBy
reason
contentDigest
```

创建时机：

- 启动 Run 前
- 保存为 Template 前
- 用户显式创建版本时

删除 Draft 对象不能删除已经存在的 OrchestrationVersion。

### 5.4 Project File 与 Change Set

`FileRoot` 是 Workspace 项目目录或 PermissionGrant 明确选择的外部目录；`ProjectFile` 是某个 FileRoot 下当前文件系统的只读投影，不作为独立业务实体复制给每个 Seat。

```text
fileRootId
kind                         project | authorized_path
permissionGrantRef?
displayName
localPath                    Runtime-local only
access                       read | write
scope                        attempt | run | workspace
```

`ChangeSet` 表达两个明确内容状态之间的差异：

```text
changeSetId
workspaceId
runId?
attemptId?
baselineRef
targetRef
fileRootRefs[]
entries[]
observedSources[]
createdAt
integrity
```

规则：

- 默认 Run Change Set 的 baseline 是 Run 启动瞬间的完整 Workspace 内容状态，包含启动前已有的未提交修改。
- `entries[]` 使用 `rootRef + relativePath` 记录文件状态、旧/新完整性和 Diff 引用；不把绝对平台路径写入跨层业务事件。
- `observedSources[]` 可以关联多个 Attempt、用户操作、外部修改或 `unknown`。来源必须来自 Runner/文件观察证据，不能按最后活跃 Agent 猜测。
- Change Set 是检查证据，不是 Artifact Contract 的隐式输出。只有 TaskAttempt 明确声明并通过 Contract 处理的结果才是 Artifact。
- 历史 Change Set 必须可复现；不能重新读取当前文件系统伪装成历史 Diff。
- `integrity` 为 `complete | partial`。`full_access` 下未登记 root 外的观察结果必须是 `partial`，不能用于声称覆盖全部修改的 Review Gate。

`DiffReviewThread` 把评审意见固定到一个不可变 Change Set，而不是固定到会继续变化的当前文件：

```text
diffReviewThreadId
changeSetId
baselineRef
targetRef
fileRootRef
relativePath
side                         baseline | target
lineNumber
anchorDigest
status                       open | resolved
createdBy
createdAt
resolvedAt?
```

每条 `DiffReviewComment` 是不可变追加记录，至少包含 `diffReviewCommentId`、`diffReviewThreadId`、`authorKind=user | agent`、`authorRef`、`body` 和 `createdAt`。Thread 的 baseline、target 和行锚点创建后不可改写；`outdated` 是在另一个 Change Set 上查看旧 anchor 时的派生 applicability，不写回 thread status，也不能按相同行号静默迁移。

Rework 不直接引用仍会追加评论的 live thread，而是冻结 `DiffReviewBundle`：

```text
diffReviewBundleId
changeSetId
threadSnapshots[]            threadId + selectedCommentIds[] + statusAtCapture + anchorDigest
capturedAtEventSequence
createdBy
createdAt
contentDigest
```

用户从 Review 发起 Rework 时，Client 只能提交可选的结构化选择，不能提交或复用 Runtime 生成的 Bundle ID：

```text
reviewSelection? {
  changeSetId
  threadSelections[] {
    threadId
    commentIds[]
  }
}
```

`reviewSelection` 存在时 `threadSelections[]` 必须非空，thread ID 在请求内不得重复，每个 `commentIds[]` 必须非空且去重。Runtime 在 `expected_sequence` 对应的同一 `run.rework` 事务内重新校验 Change Set 属于当前 Run/Rework plan，所有 thread 都绑定该 Change Set 且仍为 `open`，所有 comment 都存在、属于所声明 thread，并且 plan、Snapshot、Gate/Transition 和迭代上限仍可用。验证成功后 Runtime 生成唯一 `DiffReviewBundle`，以当前 accepted event sequence 冻结选中 ID、thread status、anchor 和 digest，追加 `diff.review.bundle.created`，并把生成的 Bundle ref 与该命令结果和新 Rework pending owner 一起持久化。任一前置条件失效时整个命令 conflict，不创建 Bundle、Snapshot、后代 Run 或 TaskExecution。

统一 pre-Attempt pipeline 后续创建新 Attempt 时，必须通过 TaskExecution 的 `pendingCommandId` 读取同一幂等命令结果，并且只把 Runtime 生成的 Bundle ref 写入新 ContextPackage 的 `diffReviewBundleRefs[]`。该 Attempt 与 ContextPackage 必须在同一创建事务中绑定此 ref；无法由原命令结果解析到唯一 matching Bundle，或 Bundle digest/Change Set 与 pending owner 不匹配时，整个 Attempt/ContextPackage 创建事务中止。`reviewSelection` 缺省时不生成 Bundle，该 ContextPackage 的此数组为空。如果 provisioning 后续 blocked，Bundle 仍由原 `commandId` 和 pending owner 唯一引用；重试同一命令返回同一 Bundle，不得再生成一份。后续评论或 resolve 不改变已投递 Bundle；评论本身也不直接修改文件、Task 状态或 Gate 结果。

完整交互见 [workspace-output-inspection.md](workspace-output-inspection.md)。

### 5.5 WorkspaceExecutionPolicy

Workspace 保存可覆盖的执行默认值：

```text
allowedWorkspaceModes[]
workspaceModeSelector          dispatcher
spawnApprovalMode             auto | ask | deny
maxWorkspaceActiveInstances
maxConcurrentChildrenPerParent
maxSpawnDepth
maxSpawnedInstancesPerRun
maxRecoveryGenerationsPerLineage
formalAgentIdleTimeoutSeconds
defaultPermissionProfile
defaultPathGrants[]
capabilityPolicies
historyRetentionPolicy
resultIntegrationPolicy
```

默认值和完整语义见 [m6-execution-workspace-security.md](m6-execution-workspace-security.md)。这些设置是策略，不代表当前 Run 已获得权限；Runtime 在启动 Run 时解析平台能力和用户授权，并把有效值写入 RunSnapshot。

队列或计划需要长期保存执行选择时，创建不可变的 ExecutionPolicyVersion：

```text
executionPolicyVersionId
workspaceId
allowedWorkspaceModes[]
bootstrapWorkspaceMode
spawnApprovalMode             auto | ask | deny
maxWorkspaceActiveInstances
maxConcurrentChildrenPerParent
maxSpawnDepth
maxSpawnedInstancesPerRun
maxRecoveryGenerationsPerLineage
formalAgentIdleTimeoutSeconds
permissionProfile             read_only | workspace_write | selected_paths | full_access
pathGrantRefs[]
capabilityPolicies
resultIntegrationPolicy       review | auto_if_clean | manual
createdFromWorkspaceRevision
createdAt
contentDigest
```

`maxSpawnedInstancesPerRun` 默认 `8`，只计算首次 formal 实例和 transient spawn 形成的原始谱系节点；同一节点因进程退出创建的 recovery replacement 不再次占用该计数，但仍受 Workspace active、父级 child 和 depth 限制。`maxRecoveryGenerationsPerLineage` 默认 `3`，可配置 `0..20`；每条 AgentInstance recovery 链独立计数，超过上限时创建 Attention，不能用普通 spawn 总数永久阻断合法恢复。

`formalAgentIdleTimeoutSeconds` 默认 `1800`，允许配置 `60..86400`。计时只在 formal AgentInstance 没有活动 Attempt、待投递消息或 Terminal 连接时开始；它控制进程休眠，不删除长期 Seat Session。非终态 Direct Run 的 idle 由 `directTaskIdleTimeoutSeconds` 单独拥有；其 formal Handle 不再启动第二个 process-idle timer，而是在 Direct Run close/finalization 时停止，避免同一时刻出现“Run 仍可对话但 Handle 已休眠”的竞态。

ExecutionPolicyVersion 冻结一次启动所需的目录模式、派生预算、formal Agent idle timeout、权限和结果整合策略。它不包含秘密或绝对路径，只保存稳定的 path grant / secret reference；不能原地修改。计划执行时仍与当前 Workspace policy 和平台能力求交集，只能保持或收紧，不能因旧计划保留已经被 Workspace 撤销的权限。每个 AgentInstance 仍从有效结果创建独立 PermissionGrant。

### 5.6 RunQueueItem

手动加入队列和计划触发共用一个持久化启动队列：

```text
queueItemId
workspaceId
sourceKind                   manual | schedule_fire
orchestrationVersionId
scheduleFireId?
launchSpecRef
notBefore?
priority
status                       queued | preparing | run_created | blocked | canceled
runId?
reasonCode?
createdAt
updatedAt
```

- `sourceKind=schedule_fire` 时 `scheduleFireId` 必填，一个 ScheduleFire 最多创建一个 RunQueueItem。
- 队列项只引用不可变 OrchestrationVersion。取消队列项不删除版本，也不取消已经创建的 Run。
- `priority` 为有符号整数，默认 `0`，值越大越先领取。Scheduler 先筛选 `status=queued`、`notBefore` 为空或不晚于当前 instant，且依赖、权限、Runner 和并发预算均满足的项，再按 `priority DESC, COALESCE(notBefore, createdAt) ASC, createdAt ASC, queueItemId ASC` 领取；SQLite 查询不能依赖未声明的行顺序。
- 重排只修改合法 `queued` 项的 `priority`，并与 Scheduler 的 `queued -> preparing` 领取使用同一 SQLite 写事务。成功时 `run.queue.item.reordered` 同时保存所有受影响项的 old/new priority，以及按 canonical comparator 计算的 `resultingQueuedOrder[]`；相同队列快照在重启和事件回放后必须得到相同领取顺序。
- 队列项允许 `queued -> preparing -> run_created`、`queued | preparing -> blocked`、`blocked -> queued` 和未创建 Run 前的 `queued | preparing | blocked -> canceled`。取消与 `run_created` 竞争时由同一事务决定唯一终点；`run_created`、`canceled` 是队列项终态。
- 取消 `sourceKind=schedule_fire` 的 Queue Item 时，同一事务必须把关联的非终态 ScheduleFire 置为 `skipped/canceled_by_user` 并追加两者的 status Event。若 `run_created` 已先提交，取消返回 conflict，不能留下 canceled item 指向已创建 Run。
- Queue Item 进入 `run_created | canceled` 时，同一事务自动 resolve 所有关联 open `launch_blocked` Attention，并追加 `attention.resolved`。`resolvedBy=runtime`，`resolvedAction` 使用 `target_run_created | target_canceled | superseded_by_newer_fire` 等稳定 code；该治理终结不创建 DecisionRecord。

`launchSpecRef` 指向创建队列项时冻结的 RunLaunchSpec：

```text
launchSpecId
orchestrationVersionId
inputRef
runnerProfileBindings[]
allowedTransientRunnerProfileBindings[]
outputLocale
executionPolicyVersionId
scheduleLaunchTemplateRef?
createdAt
contentDigest
```

Runner Profile 的逻辑绑定、transient allow-list 和非敏感启动配置在 LaunchSpec 中冻结；`inputRef` 必须指向不可变内容，不能回读可变 preset。实际 CLI 安装、原生登录和 capability 在创建 Run 前重新探测。探测失败使队列项 blocked，不能静默换成另一个 Profile。

修复 blocked Queue Item 的权限或 Runner 配置时，不修改旧 RunLaunchSpec。Runtime 创建新的 ExecutionPolicyVersion 和 RunLaunchSpec，在同一事务内把尚未创建 Run 的 Queue Item 指向新 ref，并追加 `run.queue.item.launch_spec_replaced`，payload 同时保存 old/new ref 和原因；旧对象继续可审计。计划来源的单次修复只影响该 fire。要修改未来 fire，必须另行创建新的 ScheduleLaunchTemplate 并执行 `schedule.update`。

### 5.7 ScheduleLaunchTemplate、Schedule 与 ScheduleFire

ScheduleLaunchTemplate 是计划每次触发都复用的不可变启动输入：

```text
scheduleLaunchTemplateId
workspaceId
orchestrationVersionId
inputRef
runnerProfileBindings[]
allowedTransientRunnerProfileBindings[]
outputLocale
executionPolicyVersionId
createdAt
contentDigest
```

`runnerProfileBindings[]` 必须包含每个 Seat/Task 目标、Runner ID、Profile ID、非敏感启动配置和配置 digest。`allowedTransientRunnerProfileBindings[]` 使用同样的稳定 Profile/Runner/config digest 结构，但只定义 worker 可显式选择的 Profile；父 Profile 的继承不需要重复。ScheduleLaunchTemplate 不保存当前 Draft、可变 input preset、秘密或“启动时读取 Workspace 默认值”的指令。修改编排版本、输入、Runner、transient allow-list、输出语言或执行策略会创建新的 template，再由 Schedule 显式改指向。

Schedule 保存触发配置并引用一个 ScheduleLaunchTemplate：

```text
scheduleId
workspaceId
name
generation
configDigest
launchTemplateRef
trigger                      cron | interval
cronExpression?
intervalSeconds?
intervalAnchorAt?
timezone
enabled
evaluationCursor
pendingCatchUpCutoff?
misfirePolicy                skip | latest | all
maxCatchUpRuns
overlapPolicy                queue_latest | allow_parallel | skip
archivedAt?
createdAt
updatedAt
```

`name` 是必填、trim 后非空的人类可读身份；同一 Workspace 可以重名，但列表必须同时显示 trigger 摘要与稳定对象引用。不能用 Workflow 名称、Cron 表达式或下一次触发时间代替 Schedule identity。创建和更新名称都推进 generation 并进入 config digest。

ScheduleFire 表示一次计划时间的幂等触发：

```text
scheduleFireId
scheduleId
sourceScheduleGeneration
scheduleConfigDigest
launchTemplateRef
triggerKind                  scheduled | catch_up | manual
occurrenceKey
scheduledFor
status                       queued | preparing | run_created | blocked | skipped
queueItemId?
runId?
reasonCode?
createdAt
updatedAt
```

规则：

- `scheduleId + occurrenceKey` 唯一。Scheduled/catch-up 使用 `scheduled:<canonical UTC scheduledFor>`，同一计划时间无论由 live 还是 catch-up pass 发现都映射到同一 key；Run now 使用 `manual:<commandId>`。重复 tick、命令重试或 Runtime 重启不能创建第二个 fire。
- `generation` 创建时为 `1`，每次成功的 `schedule.update | enable | disable | archive` 单调加一；`schedule.run_now` 校验但不推进 generation。`configDigest` 覆盖 `name`、`launchTemplateRef`、trigger 字段、timezone、enabled、misfire/overlap 配置和 archived 状态，不包含 cursor、generation 或时间戳。每个 ScheduleFire 冻结提交事务读取的 generation 和 digest。
- 一个 fire 最多绑定一个 RunQueueItem 和一个 Run；三者的引用必须在同一启动事务中对账。
- `evaluationCursor` 是 Runtime 已经完整判定到的 UTC instant。创建或重新启用计划时设置为当前 instant；禁用期间不补跑。Runtime 启动或收到平台 resume 信号时先持久化 `pendingCatchUpCutoff=now`，完成该固定窗口后再清空；崩溃后继续同一 cutoff，不能按新的墙钟时间改写选择结果。
- 默认 `misfirePolicy=latest`、`maxCatchUpRuns=10`、`overlapPolicy=queue_latest`；`maxCatchUpRuns` 只在 `all` 时生效，合法范围 `1..100`。
- `trigger=cron` 时只允许五字段、分钟粒度的 `cronExpression`，并要求 `intervalSeconds` 和 `intervalAnchorAt` 为空。字段顺序为 minute、hour、day-of-month、month、day-of-week；只支持数字、`*`、列表、范围和 step，Sunday 为 `0`。day-of-month 和 day-of-week 同时受限时按 Vixie cron 的 OR 语义匹配；不支持名称、秒、`L/W/#` 或 `@daily` 一类别名。
- `trigger=interval` 时要求 `intervalSeconds >= 60` 和 UTC `intervalAnchorAt`，并要求 `cronExpression` 为空。Interval 按 UTC elapsed duration 计算，不受 DST 影响；`timezone` 只用于展示计划时间。
- Cron 按保存的 IANA timezone 计算。DST gap 中不存在的本地时间跳过；DST fold 中重复的本地时间只在较早的那个 instant 触发一次。
- Schedule 不能引用当前 Draft 或脱离 Task/Run 的自由 Prompt；单任务计划使用不可变的单 Task OrchestrationVersion 和对应 template。
- Schedule 被禁用或归档只阻止未来 fire，不取消已创建的队列项或 Run。`schedule.archive` 幂等设置 `archivedAt` 且 `enabled=false`；归档是终态，不能再次启用或编辑，普通界面不提供永久删除。
- 修改 trigger、cron expression、interval 或 timezone 时，将 `evaluationCursor` 原子重置为修改生效的当前 instant 并清空旧 catch-up window，不按旧定义补跑。`schedule.run_now` 为未归档计划创建 `triggerKind=manual` 的 fire，`scheduledFor` 使用命令首次被 Runtime 接受的 UTC instant；重复 `commandId` 返回同一 fire，不推进 evaluation cursor，仍应用 overlap 和权限规则。
- `schedule.update | enable | disable | archive | run_now` 必须携带 `expected_generation`。这些命令和 live/catch-up pass 共用 per-schedule SQLite 写事务；tick 提交前必须重新校验 enabled、archivedAt、generation、configDigest、launchTemplateRef、evaluationCursor 和 pendingCatchUpCutoff。任一值变化时整批放弃并从新快照重算，不能部分创建 fire、取消 Queue Item 或推进 cursor。
- ScheduleLaunchTemplate 的 ExecutionPolicyVersion 只能等于或收紧创建时的 Workspace policy；修改计划权限会创建新 policy version 和新 template，每次启动仍创建独立 PermissionGrant。
- Catch-up pass 为 `evaluationCursor < scheduledFor <= pendingCatchUpCutoff` 的每个 occurrence 创建 `triggerKind=catch_up` 的 ScheduleFire，并应用 misfire policy。Runtime 正常活动期间的 live due pass 为 `evaluationCursor < scheduledFor <= tickCutoff` 的每个 occurrence 创建 `triggerKind=scheduled` 的 fire，不应用 misfire policy。未选中执行的 occurrence 使用 `status=skipped` 和稳定 reason code，不能只推进游标后丢失判断证据。
- ScheduleFire 允许 `queued -> preparing -> run_created`、`queued | preparing -> blocked`、`blocked -> queued` 和 `queued | preparing | blocked -> skipped`。`run_created`、`skipped` 是 fire 终态。
- 详细触发、补跑和后台审批语义见 [m6-local-runtime-scheduling.md](m6-local-runtime-scheduling.md)。

Runtime 提供 canonical `ScheduleListProjection`，Client 不自行解释 Cron、DST、ScheduleFire 顺序或 Run 结果：

```text
scheduleId
workspaceId
name
generation
enabled
archived
nextOccurrenceAt?
lastOccurrenceSummary?       fireId + scheduledFor + status + queueItemId? + runId? + runStatus?
activeQueueItemCount
activeRunCount
openAttentionIds[]
readinessCode?
projectionSequence
```

`lastOccurrenceSummary` 表示最近一次 canonical occurrence，可以是 skipped、blocked、queued、running 或 Run 终态；不能只取最近成功 Run。`nextOccurrenceAt` 和未来 occurrence 预览由 Runtime 使用同一 Cron/interval/timezone 实现计算，Client 只格式化显示。

---

## 6. Organization Domain

### 6.1 RoleDefinition

Role 是可复用职责，不是运行中的 Agent：

```text
roleId
name
purpose
instructions
capabilityRequirements[]
defaultOutputContracts[]
```

要求：

- `purpose` 只表达一项主要职责
- Role 不能直接引用设备上的秘密值

### 6.2 GroupDefinition

```text
groupId
name
parentId?
description?
```

Group 可以包含 Group 或 Seat。

### 6.3 SeatDefinition

```text
seatId
name
roleId
parentId?
instructionOverride?
runnerProfileOverrideId?
enabled
```

规则：

- `parentId` 可以引用 Group 或另一个 Seat
- Seat 不能形成父子环
- `runnerProfileOverrideId` 是高级配置；缺省时使用 Workspace 默认 Runner
- 禁用 Seat 不能被新 Task 指派
- 修改 Role 不自动重写已经存在的 Seat override

### 6.4 Organization 校验

阻塞错误：

- 重复 ID
- 悬空 Role 或 Parent 引用
- 父子环
- 启用 Seat 引用不存在的 Role
- Seat Runner Override 在当前设备不可用

警告：

- Role 没有任何 Seat 使用
- Seat 没有任何 Workflow Task
- 同层名称重复

---

## 7. Presentation Domain

Canvas 表现与业务结构分开：

```text
nodeLayouts: {
  objectId,
  x,
  y,
  width?,
  height?
}[]
groupVisualOrder[]
```

规则：

- 移动节点只改变 Presentation，不改变父子关系
- 调整归属必须使用明确的 Move 操作
- RunSnapshot 可以保存 Presentation 副本，用于历史 Run 复现
- Zoom、Viewport、当前选择、焦点和展开/折叠属于设备级 `WorkspaceViewState`，不进入 OrchestrationDraft、OrchestrationVersion 或 RunSnapshot

---

## 8. Workflow Domain

### 8.1 WorkflowDefinition

```text
workflowId
name
dispatcherTaskId?
executionPolicyOverride?
nodes[]
transitions[]
artifactContracts[]
artifactBindings[]
```

包含多个 formal Task 的 Workflow 必须设置 `dispatcherTaskId`。它引用一个普通 Task；该 Task 的 Attempt 正常产出业务结果并终态化，不靠永久活动的 Attempt 承担协调。其 formal AgentInstance 启动后由 Runtime 建立独立的 Run-scoped DispatcherCoordinationLease，后续为其它 formal Task 选择执行目录。单一 Task 和 Direct Task 可以省略；transient worker 由发起 spawn 的父 Agent 通过自己的 Attempt-scoped request channel 响应 SelectionRequest，不经过 root Dispatcher。

`executionPolicyOverride` 可以覆盖允许的目录模式、派生审批和预算，也可以把默认权限收紧；不能把 Workspace 未授权的路径或能力写进模板。解析优先级为 `Run override > Workflow override > Workspace default`，有效结果写入 RunSnapshot。

### 8.2 Node 类型

首版支持：

| 类型 | 作用 |
|------|------|
| `start` | 唯一入口，不执行 Runner |
| `task` | 由一个 Seat 执行 |
| `gate` | 等待用户审批或回答 |
| `join` | 汇合并行分支 |
| `end` | 成功或失败终点 |

不提供任意脚本节点。

#### 8.2.1 EndDefinition

```text
endId
name
outcome                       succeeded | failed
resultCode?
```

`outcome` 是 Run 终态的唯一业务来源。`outcome=failed` 时 `resultCode` 必填并使用稳定 code；成功 End 不携带失败 code。Workflow 必须至少有一个从 Start 可达的成功 End。Runtime 不能从 End 名称、入边 trigger、拓扑位置或“最后完成的 Task”猜测结果。

失败 End 一旦到达就成为决定性的失败候选并启动 Run-finalization。成功 End 到达只形成成功候选；Runtime 必须等到所有已激活 NodeExecution/TaskAttempt 都进入终态、且没有仍可产生新 activation 的 eligible Transition 后，才能在“至少一个成功 End 已完成且没有失败 End 已完成”时提交 `Run.status=succeeded`。`any` Join 的迟到分支也必须先收敛；若其在成功提交前到达失败 End，失败优先。未激活的替代分支不参与等待。

### 8.3 TaskDefinition

```text
taskId
name
ownerSeatId
instructions
inputSlots[]                  inputSlotId + name + contractId + cardinality + required
outputContractIds[]
runnerProfileOverrideId?
failurePolicy
longWaitPolicy?
optional
completionPolicy              attempt_success | explicit_close
```

`failurePolicy`：

```text
stop_run | wait_human | route_failure | continue_optional
```

`longWaitPolicy` 只定义观察检查点和升级方式，例如首次检查时长、重复间隔，以及 `observe | attention`。到达检查点可以刷新 activity/liveness、请求 Adapter reconciliation 或创建 Attention，但不能单独把 Attempt 置为 failed/canceled、启动 replacement、释放 capacity 或宣称完成。只有结构化 completion receipt 通过 Contract 校验才能决定业务成功；typed termination evidence 只决定进程状态。

`continue_optional` 仅允许 `optional=true` 且存在匹配 `skipped` Transition 的 Task；`route_failure` 必须存在匹配的 `failure` Transition。`skipped` 表示业务明确放弃本次可选工作，不等同于 `failed`。

规则：

- 每个 Task 只有一个 owner Seat
- 多 Seat 协作必须拆成多个 Task 和 Handoff
- Input 绑定 Artifact Contract，不绑定某个平台文件路径
- Task 级 Runner Override 是高级能力；优先级高于 Seat 和 Workspace 默认值
- `completionPolicy=attempt_success` 是普通 Workflow 唯一合法值；`explicit_close` 只允许 Runtime 生成的 `sourceKind=direct_task` Snapshot，单次 Attempt 成功不会自动激活 Task 的 success Transition

Runner 解析优先级：

```text
Task override > Seat override > Workspace default
```

解析后的 Runner 写入 RunSnapshot。

### 8.4 GateDefinition

```text
gateId
name
kind
requestedBySeatId?
requiredArtifactContractIds[]
allowedActions[]
blocking
```

`kind`：

```text
approval | question
```

首版 `blocking` 固定为 `true`。需要提醒但不阻断流程的事项使用普通 Runtime Event，不使用 Gate 伪装。

### 8.5 JoinDefinition

```text
joinId
name
policy
```

`policy`：

```text
all | any
```

`all` 等待所有到达分支，`any` 在首个满足条件的分支到达后继续，其余分支继续执行，不自动取消；迟到结果只作为历史 Artifact 保留。

### 8.6 TransitionDefinition

```text
transitionId
fromNodeId
toNodeId
trigger
reworkPolicy?
```

`trigger` 只允许结构化值：

```text
success | failure | skipped | approved | rejected | answered | always
```

来源节点与 trigger 的合法组合：

| 来源 | 允许 trigger |
|---|---|
| Start | `always` |
| Task | `success`, `failure`, `skipped`（仅 `optional=true`） |
| Approval Gate | `approved`, `rejected` |
| Question Gate | `answered` |
| Join | `always` |
| End | 无出边 |

首版不允许用户编写表达式或脚本条件。

### 8.7 并行和循环

- 一个节点可以有多个相同 trigger 的出边，表示并行启动
- 并行分支通过 Join 显式汇合
- 普通环是阻塞错误
- 只有 Gate 的 `rejected` Transition 可以形成 Rework 环
- Rework 环必须配置 `maxIterations`
- 超过上限后产生阻塞 Attention，不自动继续

### 8.8 ArtifactContract

```text
contractId
name
mediaType
required
cardinality
description?
validationRule?
```

`cardinality`：`one | many`。

Artifact Contract 说明交付意义，不规定本地物理路径。

`validationRule` 只能引用已注册的结构化 Validator 和参数，不允许嵌入任意脚本。

### 8.9 ArtifactBinding

`ArtifactBinding` 是 Workflow 中唯一可写的输入映射对象；Task 和 Transition 不各自保存另一份可修改 Binding：

```text
artifactBindingId
producerTaskId
outputContractId
consumerTaskId
consumerInputSlotId
cardinality                   one | many
```

`outputContractId` 必须属于 producer Task，`consumerInputSlotId` 必须属于 consumer Task 且引用兼容 Contract。一个 `cardinality=one` 的 input slot 只能有一个 Binding；`many` 可以有多个不同 producer。Transition 只决定何时激活下游 Node，ArtifactBinding 决定哪些通过验证的 Artifact 可以成为输入，两者不能互相推断。创建、修改和删除 Binding 都是 Draft 原子 operation，并进入删除影响分析。

---

## 9. Workflow 校验

阻塞错误：

- Start 数量不是一个
- 没有可达 End
- 没有从 Start 可达的 `outcome=succeeded` End，或失败 End 缺少稳定 `resultCode`
- 存在不可达 Node
- Transition 引用不存在的 Node
- Task 引用不存在或禁用的 Seat
- 必填 Input 没有来源
- Output Contract 重复或悬空
- 普通环或无上限 Rework 环
- Join 没有足够的入边
- Gate Action 与出边 Trigger 不匹配
- 来源 Node 与 Transition Trigger 组合不合法
- 非 Optional Task 使用 `skipped` Transition，或 `continue_optional` 没有匹配的 `skipped` Transition
- 可编辑 Workflow 使用 `completionPolicy=explicit_close`
- Gate 的 `blocking` 不是 `true`
- Runner 无法满足 Task capability requirement
- 多 formal Task Workflow 没有有效 `dispatcherTaskId`
- Dispatcher Task 不可从 Start 到达，或它依赖自己应分发的下游 Task
- Dispatcher Task 绑定的 Runner 不提供 `workspaceDispatch`
- 允许 Agent 自行派生 worker 的 Task 所绑定 Runner 不同时提供 `transientSpawn`、`workspaceDispatch` 和 `workspaceDispatchRequestDedupe`

警告：

- Gate 没有提供决策所需的上下文或 Artifact
- Optional Task 的 Artifact 被下游作为必填输入
- End 只有失败路径可达
- 并行分支写入同一独占资源

只有阻塞错误为零才能启动 Run。

---

## 10. Run Domain

### 10.1 RunSnapshot

```text
snapshotId
workspaceId
sourceKind                    workflow_version | direct_task
orchestrationVersionId?
organization
workflow
presentation
resolvedRunnerBindings[]
allowedTransientRunnerProfileBindings[]
outputLocale
projectRoot
resolvedExecutionPolicy
bootstrapWorkspaceMode
runInput
directTaskIdleTimeoutSeconds?
createdAt
contentDigest
```

`resolvedRunnerBindings[]` 只绑定已知 Seat/Task。`allowedTransientRunnerProfileBindings[]` 冻结 worker 可以显式选择的稳定 Profile ref、Runner ID、非敏感启动配置和 digest；省略 worker Profile 时继承父实例。运行中要加入未冻结 Profile 必须通过 Run Amendment，Runtime 不能回读 Device 当前安装列表或选择第一个可用 Runner。

Snapshot 是深拷贝业务快照。运行时不得回读 Workspace Draft 推断当前行为。

`workflow_version` 必须引用 `orchestrationVersionId`。`direct_task` 由 Runtime 创建最小 `Start -> Task -> End` Workflow 和所选 Seat 的 Organization 投影，不写回 Draft；其 Task 固定 `completionPolicy=explicit_close`，End 固定 `outcome=succeeded`，`directTaskIdleTimeoutSeconds` 默认 1800 且可在 Workspace 配置中调整。它仍完整冻结 Runner、目录、权限、输出语言和输入。

### 10.2 Run

```text
runId
baseSnapshotId
activeSnapshotId
launchSource                  manual | schedule
scheduleFireId?
sourceRunId?
restartFromTaskId?
sourceAttemptId?
shutdownRecoveryPlanId?
resumeOnStartup
status
terminationIntent?             cancel | fail
finalizationOutcome?           succeeded | failed | canceled
finalizationResultCode?
finalizationSourceKind?        end_node_execution | fatal_runtime | cancel | end_failed | direct_close
finalizationSourceRef?
finalizationFrozenAtSequence?
directTaskIdleSince?
directTaskCloseRequestedAt?
directTaskCloseReason?
startedAt?
finishedAt?
latestSequence
resultCode?
```

详细状态机见 [m6-run-operations.md](m6-run-operations.md)。

`baseSnapshotId` 永远指向启动版本；`activeSnapshotId` 只在 Amendment 成功后前移。每个 TaskAttempt 记录自己的 `effectiveSnapshotId`，已运行部分不随 active Snapshot 变化。`launchSource=schedule` 时 `scheduleFireId` 必填，并且该 fire 只能绑定一个 Run。正在运行的 Run 默认 `resumeOnStartup=true`；用户手动 Pause，或 Runtime 确认托盘退出已覆盖全部非终态 Run、完成适用的进程与资源收敛，并追加 safe-shutdown completion `run.status.changed` 后改为 `false`。没有 process/cleanup candidate 的 Run 也必须写该 completion Event，不能因无 Handle 而保留自动恢复。Resume 在进入 `resuming` 屏障的事务先恢复为 `true`；只有失败后的补偿性 re-pause 全部确认并回到 `paused` 时才能再次设为 `false`。强制退出、shutdown 未确认、系统注销、关机、崩溃中断或 resuming 状态不明时保持 `true`。

Run 的最终 `resultCode` 只能来自已冻结的失败 End、明确的 fatal Runtime code、`run.end_failed` 或其它已定义终结规则。决定性 outcome 在清理前先以 `finalizationOutcome + finalizationResultCode + finalizationSourceKind/sourceRef + finalizationFrozenAtSequence` 持久化，并通过 `run.status.changed` 的 intent-only payload 重放。该组字段一旦冻结不可清除或改写；cleanup unknown 转为 interrupted 后仍只能继续同一个 finalization，不得恢复业务执行。失败 End 或 fatal intent 一旦存在，后到的 Pause、Resume、Cancel 或成功候选不能覆盖；Cancel 只有在没有已冻结失败 intent 时才能冻结 canceled，之后 finalization barrier 不再接收新的业务结果。成功只在图已收敛且没有失败 intent 时冻结。详细语义见 [m6-run-operations.md](m6-run-operations.md)。

`run.cancel` 在进入 `canceling` 前持久化 `terminationIntent=cancel`。清理状态不明而转入 interrupted 时该意图仍保留，`run.resume` 不得恢复业务执行；后续 `run.cancel` 只能继续原 cleanup。`run.end_failed` 使用 `terminationIntent=fail`。终态提交后意图保留作审计，不得被其它命令覆盖。

`sourceKind=direct_task` 的每轮用户消息对应一个 Attempt。Attempt 完成后 Run 保持 `running` 并设置 `directTaskIdleSince`，不会自动激活 success Transition；`direct_task.end`、`run.cancel` 或无活动 Attempt/worker/Attention 时达到冻结 idle timeout 才请求关闭。关闭请求通过 Event 设置 `directTaskCloseRequestedAt/reason`，活动 Attempt 可以完成当前回复，随后 success End 才被激活。已结束 Direct Run 的下一条 Seat Session 消息创建新的 Direct Run，不复活终态 Run。

显式安全退出为全部非终态 Run 建立 durable shutdown fence。`shutdownRecoveryPlanId` 只在该 Run 需要终止 live Handle、in-flight launch 或对账 cleanup Unknown 时设置，引用退出事务冻结的不可变 ShutdownRecoveryPlan；没有这些 candidate 时不创建空 plan。`pauseResume` 只保证同一 live Handle 暂停/继续，不足以创建该计划；fence evidence 和计划冻结只完成第一阶段。Runtime 还必须收敛适用的 process candidate、Unknown cleanup 和同 Run 内的 process-free pre-Attempt aggregate，并为每个 Run追加带 fence、可选 plan ref、`resumeOnStartup=false` 的 completion `run.status.changed`，才能确认安全退出。用户下次 Resume 时只为每个明确列入 `recoverableAttempts[]` 的来源 Attempt 创建一个 recovery Attempt；没有活动 Attempt 的 idle Direct Handle 只被关闭和记账，不制造 recovery Attempt。该 Direct Run 保持 idle，下一轮消息创建 replacement AgentInstance 和新的 AttemptLaunch。

普通启动不设置 `sourceRunId`、`restartFromTaskId` 或 `sourceAttemptId`。基于既有 Run 全量重新开始时只设置 `sourceRunId`；从某个 Task 重新开始时三项都必填，Task 和 Attempt 必须属于来源 Run。新 RunSnapshot 深拷贝来源 Run 的 `activeSnapshotId`，并把明确选择的上游 Artifact 版本写入新 Attempt 的 `inputArtifactRefs[]`；不能回读当前 Draft、文件系统“最新结果”或来源 Run 的可变投影猜测输入。`run.created` Event 必须携带这些可选谱系字段和新旧 Snapshot ref。

### 10.3 NodeExecution

NodeExecution 记录不由 Runner 承载的 Start、End、Gate 和 Join 每次激活状态。Task 使用独立 TaskExecution，不重复创建 Task NodeExecution：

```text
nodeExecutionId
runId
nodeId
nodeKind                     start | end | gate | join
effectiveSnapshotId
activationIndex
status
incomingTransitionRefs[]
selectedOutgoingTransitionRef?
blockedReasonCode?
createdAt
openedAt?
finishedAt?
```

`activationIndex` 区分有限 Rework 中同一 Node 的多次激活。合法状态按 kind 固定：Start 使用 `pending | reached | completed | canceled`；End 使用 `pending | ready | reached | completed | canceled`；Gate 使用 `pending | ready | open | resolved | rejected | canceled`；Join 使用 `pending | ready | open | resolved | blocked | canceled`，不能进入 `rejected`。首版 Gate 没有 `blocked` 状态：缺少所需输入时保持 `pending`，输入完整后原子进入 `ready`；打开后用 approval/question Attention 表达唯一阻塞。合法转换见 [m6-run-operations.md](m6-run-operations.md)。每次创建和状态变化都必须追加 `node.execution.created` 或 `node.execution.status.changed`；每条有效入边到达必须追加幂等的 `node.execution.input.recorded`，即使 Node status 没有变化。`incomingTransitionRefs[]` 只能由这些输入事件投影，以便恢复 Join 的部分到达集合、Gate 终态和 End 是否满足。`gate.opened/resolved` 继续记录 Attention/Decision 语义，不能替代通用 NodeExecution 生命周期。

#### 10.3.1 TaskExecution

TaskExecution 是一次 Task activation 的稳定执行实体，在选择目录或创建 Attempt 之前就存在：

```text
taskExecutionId
runId
taskId
effectiveSnapshotId
activationIndex
status                        pending | ready | provisioning | blocked | running | waiting_attention | pausing | paused | idle | succeeded | failed | skipped | canceled | interrupted
incomingTransitionRefs[]
currentAttemptId?
attemptIds[]
pendingAttemptKind?           first | retry | recovery | direct_round
pendingFromAttemptId?
pendingCommandId?
targetAgentInstanceId?
selectionRequestId?
selectedOutgoingTransitionRefs[]
blockedReasonCode?
resultCode?
createdAt
startedAt?
finishedAt?
```

有效 Transition 激活 Task 时，Runtime 在同一事务创建 TaskExecution、记录输入并追加 `task.execution.created`；从该时刻起，capacity reservation、目录选择、预启动阻塞和用户动作都引用 `taskExecutionId`。目录选择成功后才创建 TaskAttempt，并把它追加到 `attemptIds[]`。Retry 和跨进程 Recovery 在同一 TaskExecution 下登记 pending work 并创建新 Attempt；Rework 激活新的 TaskExecution、增加 `activationIndex`，并在该 activation 完成 provisioning 后创建首个 Attempt。一个 TaskExecution 同时最多有一个活动 Attempt。TaskExecution 和 TaskAttempt 的状态分别通过 `task.execution.status.changed` 与 `task.attempt.status.changed` 重放，不能用一个对象的 Event 暗改另一个对象。

`pendingAttemptKind/pendingFromAttemptId/pendingCommandId` 让 TaskExecution 在 Attempt 尚不存在时持久化唯一的 pre-Attempt owner。首次派发、Retry、Recovery 和 Direct 新轮次都先写入这组字段并进入 `ready | provisioning | blocked`，再走统一的 capacity、AgentInstance、Grant、SelectionRequest 和 assignment pipeline；成功创建 Attempt 的事务设置 `currentAttemptId` 并清空 pending 字段。相同 command 重放返回原 pending work，新的并发命令 conflict。旧 Handle 需要停止或授权/assignment 不可复用时，TaskExecution 保持 provisioning，直到旧资源收敛后才创建新实例；异步失败转 blocked + typed Attention，不得凭空创建 Attempt。显式 safe shutdown 可以把没有任何 process/plan owner 的 `ready | provisioning | blocked` aggregate 置为 `interrupted/safe_exit_before_launch` 并保留完整 pending refs；下次用户 Resume 通过 `continue_pre_attempt` 继续同一 owner，不能创建第二组 pending work。

除 Direct Task 正常轮次间的 `idle` 外，安全退出是允许非终态 TaskExecution 同时没有 `currentAttemptId` 和 pending Attempt owner 的额外屏障：source Attempt 已终态化后，原本处于 `running | pausing | paused` 的 TaskExecution 按 canonical 路径收敛到 `paused`，其它非终态 TaskExecution 进入 `interrupted`；`shutdownRecoveryPlanId` 指向的 ShutdownRecoveryPlan 是用户 Resume 前的唯一恢复 owner。Attempt 和 TaskExecution 分别追加 Event；已 paused 的 TaskExecution 通过 `task.execution.status.changed(paused -> paused, reasonCode=safe_shutdown_recovery_owner_transferred, currentAttemptId=null)` 重放 owner 转移。Resume 事务随后从 `paused | interrupted` 登记 `pendingAttemptKind=recovery`，不能提前保留或重建旧 pending owner。

`fail_task` 等预启动动作可以在没有 Attempt 时把 TaskExecution 原子终结为 `failed/prelaunch_*`，再按冻结 failure policy 激活显式 failure Transition 或 Run finalization。Direct Task 的 TaskExecution 在每轮 Attempt 之间使用 `idle`，直到显式关闭或 idle timeout 才进入 `succeeded`。界面中的 Task 当前状态只是 TaskExecution Event 的投影，不存在脱离稳定执行对象的独立 Task 状态事件。

### 10.4 TaskAttempt

TaskAttempt 是一个 Task 的一次不可变执行。Retry、Rework 和 Recovery 都创建新记录，不能覆盖旧 Attempt：

```text
attemptId
runId
taskExecutionId
taskId
effectiveSnapshotId
primaryAgentInstanceId?
status
inputArtifactRefs[]
primaryContextPackageId
workerContextPackageIds[]
attemptLaunchId
outputArtifactRefs[]
runnerResultId?
changeSetRefs[]
spawnedWorkerAgentInstanceIds[]
recoveryCheckpointRefs[]
retryOfAttemptId?
reworkOfAttemptId?
recoveredFromAttemptId?
recoveryContexts[]
reworkIteration
resultCode?
createdAt
startedAt?
finishedAt?
```

`recoveryContexts[]` 按 `operationSequence` 升序组成来源 Attempt 的恢复执行计划。每项包含 `sourceAgentInstanceId`、`recoveryCheckpointRef`、`operationId`、`operationSequence`、`strategy`、可选原 `idempotencyKey`、`targetStateRef`、`runnerResumeRef` 和 `committedResultRef`。`strategy` 使用 `restart_before_dispatch | restart_no_side_effect | retry_idempotent | resume_runner | continue_after_commit`。

`status` 使用 [m6-run-operations.md](m6-run-operations.md) 的 canonical TaskAttempt 状态，每次转换都追加绑定 `attemptId + taskExecutionId` 的 `task.attempt.status.changed`。安全退出或 Runtime/设备中断可以把已经创建 AttemptLaunch 的 `pending | ready` Attempt 终态化为 `interrupted`，以封闭 process 已创建但 registration 尚未可靠落盘的窗口；普通 Adapter 拒绝或 Retry 不能借用该转换。一个 TaskExecution 同时最多有一个活动 Attempt；每个 Attempt 创建时都必须为 primary 实例绑定 `primaryContextPackageId`，进入 `starting` 前还必须绑定 `primaryAgentInstanceId`。它是业务责任主体，transient worker 只能通过 `spawnedWorkerAgentInstanceIds[]` 参与该 Attempt，并各自在 `workerContextPackageIds[]` 中拥有目标化的 ContextPackage。输入、输出和 Change Set 必须引用冻结版本，不能用当前文件路径或“最新产物”替代。`skipped` 仅适用于 Snapshot 中 `optional=true` 的 Task，并通过显式 `skipped` Transition 继续；Runtime 不能把失败 Attempt 改写为 skipped。Recovery Attempt 必须同时保存来源 Attempt，以及恢复边界之前每个已登记 operation 的分类；可靠 committed operation 也必须以 `continue_after_commit` 和 `committedResultRef` 进入计划，确保 Runner 明确跳过而不重放。不能只写 `recoveredFromAttemptId` 后重新猜测恢复位置。任一已开始 operation 无法安全分类时，不自动创建整个 recovery Attempt。

### 10.5 AgentInstance

AgentInstance 是某个 Runner 在 Run 中为 Seat 承载的实际运行实例：

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
createdBy
spawnReason
runnerProfileId
workspaceScope
contextPackageIds[]
executionWorkspaceAssignmentId?
permissionGrantId?
runnerHandleRegistrationId?
capacityReservationId
capacityReservedAt
capacityReleasedAt?
spawnDepth
lifecycle
status
createdAt
startedAt?
stoppedAt?
```

规则：

- `lifecycle` 为 `formal | transient`。formal 实例来自正式 Seat/Task；transient 实例必须引用父 AgentInstance、父 Attempt 和 canonical SpawnRequest。
- lineage validation 固定为四种组合：ordinary transient 只携带完整 `parentAgentInstanceId + parentAttemptId + spawnRequestId`；formal Attempt recovery 只携带完整 `recoveredFromAgentInstanceId + recoveredFromAttemptId`；recovered transient 同时携带前述 parent/spawn triple 与 Attempt recovery pair；coordination-only recovery 只携带完整 `recoveredFromAgentInstanceId + recoveredFromDispatcherCoordinationLeaseId + recoveredFromRunnerHandleRegistrationId`，且 parent/spawn triple 与 `recoveredFromAttemptId` 均为空。普通、未恢复的 formal 实例四组字段都为空。
- recovered transient 的 parent refs 指向本次 recovery Attempt 中实际监督它的 replacement parent，Attempt recovery pair 指向被替换的旧 transient/source Attempt；`spawnRequestId` 继续指向该 transient lineage 的 canonical supervised-dispatch 请求。Runtime 必须验证该 SpawnRequest 的原 parent Attempt 与当前 recovery parent 的来源 Attempt 属于同一恢复链，不能把 parent 字段当 recovery pair，也不能为 coordination-only recovery 伪造 Attempt lineage。
- `createdBy` 为 `user | workflow | agent`；`status` 为 `created | provisioning | starting | running | waiting | paused | stopping | stopped | failed | interrupted`，只表示 Runner 进程生命周期，不代替 TaskAttempt 状态。
- 一个 TaskAttempt 只有一个 primary AgentInstance；transient worker 可以引用父 Attempt，但不成为 Task 的共同 owner。一个 AgentInstance 可以按 Runner 能力连续承载同一 Seat 的多个 Attempt，但仅限 Run 仍非终态且允许继续派发；Run-finalization barrier 开始后不得再 prepare 或 commit 新的 AttemptLaunch。
- `contextPackageIds[]` 由目标为该实例的 `agent.context.created` Event 追加投影；创建 AgentInstance 时可以为空，不能把另一个实例的 ContextPackage 复制进来。
- `capacityReservationId` 在创建 AgentInstance 的同一 SQLite 事务内占用 Workspace active slot，并在目录选择、启动、运行和 stopping 全周期保持有效。只有确认 Handle 不存在或已终止、selection/assignment 等资源已经释放后才能设置 `capacityReleasedAt`；AgentInstance status 不能单独证明容量已释放。
- Runtime 在创建 TaskAttempt/ContextPackage 前用 Adapter `continuedAttempts`、Handle liveness 和冻结绑定决定复用或新建 AgentInstance。`primaryAgentInstanceId` 持久化后不可 fallback 改绑；AttemptLaunch 的确定性 prepare/commit 失败使该 Attempt 终态失败，Retry 才能选择新实例。Unknown 必须查询原 launch 或进入 interrupted/Attention，不能改绑后重试。`runnerHandleRegistrationId` 只指向该实例当前 generation 的持久化 Handle 登记；generation 变化必须创建新 AgentInstance 和新登记，不能原地换 ID。
- 连续承载只适用于同一个持久在线 Runner process handle；进程退出或恢复时重新启动 Runner，必须创建新的 AgentInstance，并使用前述四种合法 lineage 组合引用来源，不能原地更换 generation。
- transient 实例不进入 Organization，也不能被其它 Task 直接指派。需要独立负责 Task 时，先通过 Run Amendment 创建正式 Seat/Task 关系。
- AgentInstance 停止后保留来源、Runner、Context package 和终态记录，不能因进程退出删除谱系。
- transient 的 `workspaceScope` 和权限不得超过父实例与 RunSnapshot 的交集，只能保持或缩小。需要更大范围时必须由父/正式 Task 通过 Amendment 建立新的 formal 执行关系，不能用 Gate 扩大 worker Grant。
- Runtime 可以先创建 `status=created` 的 AgentInstance 以获得稳定目标 ID，但必须在进入 `starting` 前以同一受控事务绑定 `executionWorkspaceAssignmentId` 和 `permissionGrantId`；目录或授权无效时实例保持 `created` 或 `provisioning` 并产生 blocked Event，不能启动进程。
- safe shutdown 收敛没有 AttemptLaunch、RunnerHandleRegistration 或 process evidence 的 aggregate 时，必须用 `agent.instance.stopped(fromStatus, toStatus=stopped, reasonCode=safe_exit_before_launch, lifecycleEvidenceKind=not_started)` 终态化其 `created | provisioning` 实例。该 Event 同时投影 `stoppedAt`、`capacityReleasedAt` 和已收敛的 assignment/Grant refs；不能只释放 capacity 或清除 TaskExecution 的 target ref 后留下非终态 AgentInstance。后续 `continue_pre_attempt` 创建的是同一 pending owner 下的普通新实例，全部 parent/spawn、Attempt recovery 和 coordination recovery lineage refs 均为空。

`AgentActivityObservation` 是 Client/Runtime 的短期展示投影，不是新的聚合或 canonical Event：

```text
agentInstanceId
activity                     working | blocked | done | idle | unknown
evidenceKind                 runtime_state | official_hook | adapter_lifecycle | provider_session | pty_heuristic | none
evidenceRefs[]
observedAt
expiresAt?
```

它只回答“这个 Agent 现在看起来在做什么”。TaskAttempt status、Run health、RunnerResult outcome 和 Attention 仍是独立事实。证据优先级固定为 canonical Runtime state、official hook/RPC、Adapter lifecycle/receipt、已验证 provider session metadata、PTY/TUI heuristic、`unknown`。`blocked`、`done` 和 `idle` 优先从 TaskExecution/TaskAttempt、Attention、Handle 和 disposition 的 canonical 状态投影；其余证据主要区分 `working` 与 `unknown`，不能覆盖 Runtime 已知的阻塞或终态。低等级观察过期或互相冲突时回到 `unknown`。PTY 文本、动画、模型自述和 heartbeat 不得创建业务 Event，也不得决定成功、权限、Artifact validity 或 recovery。

完整交互和跨 Runner 规则见 [m6-agent-session-collaboration.md](m6-agent-session-collaboration.md)。

#### 10.5.1 ExecutionClaim

ExecutionClaim 防止同一工作在并发 tick、重连或 Runtime 恢复时被重复派发：

```text
executionClaimId
runId
nodeExecutionId?
taskExecutionId?
attemptId?
ownerRuntimeId
generation
acquiredAt
leaseExpiresAt
releasedAt?
releaseReason?
```

`nodeExecutionId | taskExecutionId | attemptId` 必须且只能存在一个。领取和续租使用 SQLite 原子事务；同一 NodeExecution、处于 provisioning 的 TaskExecution 或 Attempt 同时最多有一个有效 claim。TaskExecution claim 在创建首个 Attempt 或预启动终态时释放，Attempt 使用自己的新 claim；process-free safe shutdown disposition 以 `releaseReason=safe_exit_before_launch` 释放 pre-Attempt claim，并在同一 `task.execution.status.changed` 中携带 `releasedExecutionClaimId`。失去租约的 owner 不能提交业务终态。租约过期只表示执行所有权待对账，不直接证明 Runner 成功或失败。

#### 10.5.2 RecoveryCheckpoint

RecoveryCheckpoint 是自动恢复所需的结构化副作用证据，不是 Terminal 摘要：

```text
recoveryCheckpointId
runId
attemptId
agentInstanceId
operationId
operationSequence             monotonic within Attempt
operationKind
sideEffectClass              none | idempotent | non_idempotent | unknown
phase                        before_dispatch | dispatched | acknowledged | committed
idempotencyKey?
targetStateRef?
runnerResumeRef?
source                       runtime | adapter | platform_broker
evidenceRef
evidenceDigest
committedResultRef?
durabilityAckRef
recordedAt
```

规则：

- `runtime` 只能证明 Runtime 自己控制的派发边界；`adapter` 必须来自 Runner 官方结构化 hook；`platform_broker` 必须来自实际拦截结果。
- 同一 Attempt 的 `operationSequence` 在首次登记 operation 时分配并单调递增；同一 operation 的 phase 只能向前追加，不能原地覆盖或用更晚 operation 隐式取代。
- `(attemptId, operationId)` 唯一标识一个 operation，`(attemptId, operationId, phase)` 唯一标识一次 phase commit。同 phase、同 payload digest 的重试返回原 CheckpointAck；同 key 但 digest 或语义字段不同必须返回 conflict，不能分配新 sequence 或覆盖旧证据。
- Terminal 文本、模型自述、文件存在或“最后一条输出”不能创建 RecoveryCheckpoint。
- `sideEffectClass=idempotent` 必须同时提供 `idempotencyKey` 和可验证的目标状态；否则按 `unknown` 处理。
- `evidenceRef` 指向不可变的结构化 Runner receipt、Runtime dispatch record 或 platform broker record；`evidenceDigest` 校验其完整性。Terminal 文本和自由模型输出不能成为该引用。
- `durabilityAckRef` 证明 Domain 对象和 `run.recovery.checkpoint_recorded` 已在同一事务持久化。Adapter 或 broker 在收到 `phase=dispatched` 的 durable acknowledgement 前不得释放外部操作；不能执行该 interlock 的来源没有自动恢复资格。
- `phase=committed` 只有在 `committedResultRef` 可验证时才能跳过操作重放；它仍不自动证明 Task Artifact Contract 已满足。
- 恢复必须逐个检查 Attempt 中所有没有可靠 `committed` 终点的 operation；不能只读取最新时间、最后一个数组元素或最高 operationSequence。Runner 启动后没有覆盖某个已开始 operation 的 checkpoint 时，该 operation 固定为 `unknown`。

#### 10.5.3 ShutdownRecoveryPlan

显式安全退出先为全部非终态 Run 建立 shutdown fence。ShutdownRecoveryPlan 只为存在 live Handle、in-flight launch 或 cleanup Unknown 的 process-reconciliation 子集创建，是销毁 Runner Handle 前冻结的 Run-level 记账和恢复入口；没有这些 candidate 时不创建空 plan：

```text
shutdownRecoveryPlanId
runId
shutdownFenceId
fencedAtSequence
liveHandles[]
  shutdownHandleRecordId
  sourceAgentInstanceId
  sourceAttemptId?
  runnerHandleRegistrationId
  handleGeneration
  role                         primary | transient | coordination
  parentSourceAgentInstanceId?
  sourceContextPackageId?
  runnerProfileId
  executionWorkspaceAssignmentId
  permissionGrantId
  dispatcherCoordinationLeaseId?
  shutdownEvidenceKind          completed | quiesced
  shutdownEvidenceRef
  lastFencedOperationSequence
  recoveryContexts[]
inFlightLaunches[]
  shutdownLaunchRecordId
  launchKind                    attempt | dispatcher_coordination
  launchId
  requestDigest
  sourceAttemptId?
  pendingDispatcherCoordinationLeaseIds[]
  sourceDispatcherCoordinationLeaseId?
  targetDispatcherCoordinationLeaseId?
unresolvedCleanupSubjectRefs[]
recoverableAttempts[]
  sourceAttemptId
  shutdownHandleRecordIds[]
  shutdownLaunchRecordIds[]
  coupledDispatcherCoordinationLeaseIds[]
coordinationRecoveries[]
  sourceDispatcherCoordinationLeaseId
  shutdownHandleRecordIds[]
  shutdownLaunchRecordIds[]
  dispatcherTaskExecutionId
createdAt
contentDigest
```

`liveHandles[]` 独立于 Attempt，覆盖 fence 时每个 primary、transient 或 coordination Handle，包括已处于 `paused` 的 Handle、Attempt 已终态但仍等待下一轮的 idle Direct Handle，以及承载 active DispatcherCoordinationLease 的 Handle。`sourceAttemptId` 对 idle/coordination-only Handle 可以为空。每个记录保存一个 typed `shutdownEvidenceKind + shutdownEvidenceRef`：`completed` 证明匹配 registration/generation 的进程树已经不存在；`quiesced` 只证明 fence 后不会再接受新 operation。两类 ShutdownFenceReceipt 都必须绑定 RunnerHandleRegistration、Handle generation、fence 和 `lastFencedOperationSequence`。只有 `completed` 可在 plan 落盘后直接作为 stopped evidence；`quiesced` 仍必须取得 HandleTerminationReceipt。普通 pause acknowledgement 不能充当任一证据。

`inFlightLaunches[]` 覆盖 fence 时所有尚无可信 RunnerHandleRegistration、但 Adapter 可能已经创建 process 的 AttemptLaunch/DispatcherCoordinationLaunch。Attempt kind 必须携带 `sourceAttemptId` 和该 AttemptLaunch 冻结的 `pendingDispatcherCoordinationLeaseIds[]`；普通 Attempt 该数组为空。coordination kind 必须携带 source/target lease IDs，且 target lease 仍为 pending。`unresolvedCleanupSubjectRefs[]` 保存 fence 时仍未收敛的 launch、registration、assignment、capacity、delivery 或 shutdown resource typed refs。in-flight 记录本身只表达进程候选；其逻辑恢复 owner 必须由 `recoverableAttempts[]` 或 `coordinationRecoveries[]` 显式引用。两个 owner 集合对 `shutdownHandleRecordId` 和 `shutdownLaunchRecordId` 全局互斥：同一 record 最多出现一次；允许恢复的 process candidate 必须恰好出现一次。idle cleanup、cancel 或 finalization record 可以没有业务恢复 owner，但不能同时归入两个 entry。

每个有 `sourceAttemptId` 的 Handle 之 `recoveryContexts[]` 按 Attempt 全局 `operationSequence` 排序；同一 recoverable Attempt 所列 Handle 的并集必须恰好覆盖 fence 之前的全部 operation，不能遗漏或重复，可靠 committed 项也必须以 `continue_after_commit` 保存。`recoverableAttempts[]` 对 fence 时允许业务恢复的每个来源 Attempt 只保留一个 entry，并通过 handle/launch record arrays 覆盖该 Attempt 的全部 process candidate；两组 record 数组至少一组非空。AttemptLaunch 已创建但尚无 registration 时，source Attempt 也必须通过 `shutdownLaunchRecordIds[]` 进入该 entry，不能回退到已经清空的 pre-Attempt pending owner。idle Handle 不进入该数组，也不创建 recovery Attempt。

同一个 Dispatcher process candidate 可以同时承载 recoverable business Attempt 和 coordination lease：已登记 Handle 对应 active/rotating lease，in-flight AttemptLaunch 对应尚未激活的 pending lease。该 Handle/Launch record 只进入 source Attempt 的 `recoverableAttempts[]` entry，matching lease ID 进入该 entry 的 `coupledDispatcherCoordinationLeaseIds[]`，并从 `coordinationRecoveries[]` 排除。每个 coupled lease 必须能通过 `liveHandles[].dispatcherCoordinationLeaseId` 或 attempt-kind `inFlightLaunches[].pendingDispatcherCoordinationLeaseIds[]` 唯一关联到该 entry 的 primary record；同一 lease 不能关联两个 record或出现在多个 recoverable Attempt entry。

只有不存在可恢复业务 Attempt owner 的 lease 才进入 `coordinationRecoveries[]`。Run 仍需要该协调职责时，每个 source lease 只保留一个 entry，并通过 handle/launch record arrays 覆盖 active/rotating Handle 和 pending replacement launch；两组数组至少一组非空。source lease 即使已在先前恢复屏障中 revoked，pending CoordinationLaunch 仍必须通过 `shutdownLaunchRecordIds[]` 保留同一协调恢复 owner。DispatcherCoordinationLaunch 不得在仍有可恢复业务 Attempt 能承载 replacement Handle 时启动，因此合法计划不会把一个 rotation 中的 source lease 同时拆给两类 owner。Runtime 只有在全部 fence evidence 已持久化并再次确认没有更高 operationSequence 后，才能计算 plan digest。来源 assignment/grant/lease ref 只用于恢复校验和审计，不能直接绑定给新的 AgentInstance。计划不保存秘密、绝对路径或可变 Workspace 默认值。

Runtime 先在一个事务冻结计划、追加 `run.shutdown.recovery_plan_created`、设置 `shutdownRecoveryPlanId`，并把 `resumeOnStartup` 设置或保持为 true；registration 此时最多到 quiesced，不能提前终态化 AgentInstance 或释放 capacity。事务提交后，Runtime 对 `inFlightLaunches[]` 逐项调用 `terminate_launch`；`shutdownEvidenceKind=quiesced` 的 registration 调用 `terminate_handle`，`completed` 的 registration 使用原 ShutdownFenceReceipt 作为 stopped evidence。只有可靠 terminated/not-found 或 stopped/not-found/completed receipt 落盘后，才能追加 launch reconcile failure、registration stopped、AgentInstance stopped、lease revoke、assignment/capacity release 等 Event。创建 plan 只决定哪些 process/Unknown 需要这种对账，不会排除同一 Run 内未被任何 Handle/Launch record 覆盖的 process-free pre-Attempt aggregate；后者仍按下述 Event disposition 独立收敛。

每个被收敛且列入 `recoverableAttempts[]` 的 source Attempt 只终态化一次为 `interrupted/safe_shutdown_process_closed`；`pending | ready` Attempt 也使用显式 canonical shutdown 转换。Runtime 通过独立的 `task.execution.status.changed` 清除 `currentAttemptId`：原本处于 `running | pausing | paused` 的 TaskExecution 按 canonical 路径收敛到 `paused`，其它非终态 TaskExecution 进入 `interrupted`，已 paused 的 TaskExecution 使用 `paused -> paused / safe_shutdown_recovery_owner_transferred` self-event。两类状态都不提前创建 pending Attempt，ShutdownRecoveryPlan 在用户 Resume 前是该 Attempt 的唯一恢复 owner。每个被收敛且列入 `coordinationRecoveries[]` 的 CoordinationLaunch 必须撤销 target pending lease，但保留 entry 的 source lease/TaskExecution 责任；Attempt entry 的 active 或 pending coupled lease 随其 Handle/Launch termination revoked，并保留在该 entry 中作为下一次 replacement 来源，不另建协调 owner。除 idle Direct 外，`running` Run 在建立 shutdown fence 时先追加 `running -> pausing`。有 plan 的 Run 必须先完成 process/Unknown 对账，再完成同 Run 内全部 process-free aggregate disposition；两类工作都完成后，Run 才能按 `pausing -> paused`、`preparing | resuming -> interrupted`、paused/idle Direct/interrupted 同状态或既有 cancel/finalization 终态追加 completion Event。最终 Event 携带 `reasonCode=safe_shutdown_completed`、fence/plan refs 和 `resumeOnStartup=false`。任一终止或 aggregate cleanup Unknown 都保持 true、创建/保留 cleanup Attention，并进入强制退出或下次 marker 对账，不能声称安全退出完成。

有未终态工作的普通 Run 保持或置为 `paused`；没有活动 Attempt 的 idle Direct Run 保持 `running + idle`。cancel/finalization intent 已冻结的 Run 不创建业务 recovery Attempt，只在下次入口继续原 barrier。idle Direct Run 下次收到消息时先在原 TaskExecution 登记 `pendingAttemptKind=direct_round` 并进入 provisioning，再创建新的 formal AgentInstance、新 PermissionGrant/assignment、Attempt 和 AttemptLaunch，最后清除 pending 字段与已消费的 plan ref；不能恢复已销毁 Handle 或为已终态上一轮创建 recovery Attempt。

process-free pre-Attempt aggregate disposition 只在该 aggregate 的全部 pre-launch 资源状态明确、且没有任何 Handle/Launch record 或其它 plan recovery owner 时使用。它不要求整个 Run 没有 ShutdownRecoveryPlan。Runtime 在同一受控事务按固定 Event 顺序收敛每个 eligible aggregate：`pending_delivery | awaiting_selection | validating` 的 SelectionRequest 追加 `execution.workspace.blocked(reasonCode=safe_exit_before_launch)`，已 `blocked` 的请求保持原状态；随后把该旧 request/target 的所有 open `workspace_selection_blocked` Attention 以 `resolvedBy=runtime`、`resolvedAction=superseded_by_safe_exit_before_launch` 追加 `attention.resolved`，不创建 DecisionRecord。之后为已存在 assignment 追加 `execution.workspace.released`，为 active Grant 追加 `permission.grant.status_changed(active -> revoked, reasonCode=safe_exit_before_launch)`，为 `created | provisioning` 且从未启动的 target AgentInstance 追加 `agent.instance.stopped(... -> stopped, lifecycleEvidenceKind=not_started, reasonCode=safe_exit_before_launch)` 并释放 capacity，最后追加 `task.execution.status.changed(... -> interrupted)` 释放 pre-Attempt ExecutionClaim、清空旧 target AgentInstance/selection refs并保留原 `pendingAttemptKind/pendingFromAttemptId/pendingCommandId`。已 assigned 的 SelectionRequest 保留历史 `assigned`，由 assignment release 表达资源收敛；任何状态不明都必须进入 plan 的 `unresolvedCleanupSubjectRefs[]` 或拒绝 acknowledgement。

全部 process candidate、Unknown cleanup 和 process-free aggregate 都收敛后，没有 pending work 的非 idle Direct `running | pausing` Run 进入 paused；paused、idle Direct 和 interrupted Run使用同状态 Event。带完整 pending refs 的 `ready | provisioning | blocked` TaskExecution 使用上述 `safe_exit_before_launch` disposition，所属 running Run进入 paused；preparing Run以 `preparing -> interrupted/safe_exit_before_launch` 完成。后续 Resume 用 `continue_pre_attempt + taskExecutionId + pending refs` 执行 `interrupted -> provisioning`，沿统一 pipeline 创建无 recovery lineage 的新 AgentInstance、Grant、SelectionRequest/assignment 和 capacity，不创建 recovery Attempt、复用旧资源或建立第二 pending owner。该 target 只要求当前 TaskExecution 的 pre-Attempt aggregate 没有 plan owner，可以与同 Run 的 `recoverableAttempts[]` 或 `coordinationRecoveries[]` 同时存在。新 SelectionRequest 通过 `retryOfSelectionRequestId` 引用被 shutdown blocked 的旧请求；旧请求已经 assigned 时引用其 ID 仅作 causation，不改写旧终态。尚未创建新 Attempt/CoordinationLaunch/Handle 的 resuming Run按相同 aggregate 顺序撤销本轮未启动资源，把 pre-Attempt work 恢复为 interrupted pending owner、把 process recovery 恢复给原 plan owner（存在时），再以 `resuming -> paused` 完成。每条 Run completion Event 都携带 `reasonCode=safe_shutdown_completed`、`shutdownFenceId`、适用时的 plan ref和 `resumeOnStartup=false`。

跨重启 `run.resume` 的 target set 可以同时包含 `recoverableAttempts[]`、`coordinationRecoveries[]` 和 `continue_pre_attempt` targets：先把 Run 置为 `resuming`，在该 `run.status.changed.resumeTargets[]` 中冻结每个 source Attempt 的全部 shutdown Handle/Launch records、operation 计划、coupled leases、每个 coordination recovery，以及每个 pre-Attempt TaskExecution 的原 pending refs，并验证所有 target 的 TaskExecution/record owner 互不重叠。Runtime 依据冻结 RunSnapshot/ExecutionPolicy、source assignment/grant、当前 Workspace 上限和平台能力重新校验目录与权限；每个新 AgentInstance 必须获得新的有效 ExecutionWorkspaceAssignment 和独立 PermissionGrant。对每个 source Attempt 预分配全部新 ID，并在第一个事务幂等确认旧 Attempt 已为 `interrupted/safe_shutdown_process_closed`、旧 AgentInstance 已 stopped、`currentAttemptId` 已清除，再把原 TaskExecution 以 `pendingAttemptKind=recovery`、`pendingFromAttemptId` 和 Resume `pendingCommandId` 从 `paused | interrupted` 置为 provisioning。`continue_pre_attempt` 不改写原 pending owner，只把对应 TaskExecution 从 interrupted 置为 provisioning并重建资源。统一 pre-Attempt pipeline 先按父对象/Event 顺序建立带 recovery refs 的新 primary AgentInstance、capacity reservation、独立 grant/assignment；全部必需 assignment 就绪后才创建绑定 primary 与 `primaryContextPackageId` 的唯一 recovery Attempt、primary ContextPackage、AttemptLaunch 和 claim，并清除 pending 字段。需要继续的 transient Handle 随后创建 recovered transient AgentInstance：Attempt recovery pair 指向旧 worker/source Attempt，parent/spawn triple 指向对应新父实例、新 recovery Attempt和原 canonical SpawnRequest；两组 lineage 缺一即拒绝。随后分别创建 grant、assignment、worker-targeted ContextPackage 和 AttemptLaunch。新 ContextPackage 只能引用已分配的新 Attempt、assignment 和 grant。

recoverable Attempt 带有 `coupledDispatcherCoordinationLeaseIds[]` 时，Runtime 在该 recovery AttemptLaunch prepare 前为每个 source lease 预创建更高 generation 的 pending replacement lease 和 dormant coordination channel；lease 使用 `createdFromAttemptId=<new recovery Attempt>`、`replacesLeaseId=<source lease>`，并绑定同一个 replacement AgentInstance、Grant 和 assignment。AttemptLaunch request 同时携带这些 dormant refs；同一个 prepared receipt/RunnerHandleRegistration 和 committed receipt 既提交业务 Attempt，也原子激活 matching replacement lease/token。失败或补偿时 pending lease 随 AttemptLaunch 一起 revoked。此路径不创建 DispatcherCoordinationLaunch，也不创建第二个 formal AgentInstance、Handle 或 registration。

每个 coordination-only recovery 才独立创建 replacement formal AgentInstance、capacity reservation、新 Grant/assignment、`purpose=dispatcher_coordination` ContextPackage、DispatcherCoordinationLaunch 和 pending target lease；它引用来源 lease/TaskExecution，不创建 TaskAttempt 或 RunnerResult。两阶段 coordination launch committed 后只激活已投递的 target lease/token。无法重建目录、授权或任一 launch 时不启动/继续其它业务，保留可重放的 resuming barrier并创建 Attention，Run 进入 interrupted/degraded。全部 AttemptLaunch、CoordinationLaunch、Context delivery 和 coupled lease activation 可靠 committed 后 Run 才能进入 running；任一失败按已启动新 Handle 的相反顺序补偿，不能为同一 source Attempt 创建多个 recovery Attempt，也不能为同一 source lease 同时创建 Attempt-coupled replacement 与 coordination launch。

#### 10.5.4 ArtifactCandidate 与 RunnerResult

ArtifactCandidate 是 Runner 在正式 Artifact Contract 校验前提交的不可变交付候选：

```text
artifactCandidateId
agentInstanceId
attemptId
handleGeneration
contractId
contentRef
contentDigest
mediaType
integrity
sourceSignalId
createdAt
```

Runtime 只接受 `official_hook | adapter_lifecycle` 的 `artifact_candidate` RunnerSignal，并校验 signal、AgentInstance、Attempt、Handle generation、ContextPackage expected output contract 和 content digest 一致。ArtifactCandidate 与来源 signal 在一个事务持久化并追加 `agent.artifact_candidate.recorded`；对象创建后不可原地修改，也不能在 Artifact Contract 校验前被 Handoff、Gate 或 Task success 消费。

`artifactCandidateId` 全局唯一，`sourceSignalId + artifactCandidateId` 是来源幂等键。相同 key 和完全相同语义/content digest 的重放返回原对象；同一 source signal 指向不同 candidate ID，或同一 candidate ID 出现不同 AgentInstance、Attempt、generation、contract、content ref/digest、media type 或 integrity 时返回 conflict 并记录诊断。不同 candidate 声明同一 `contractId` 不是“最后一个生效”；是否允许多个候选及其顺序由 Artifact Contract 明确定义，Runtime 不能按到达顺序、数组位置或文件名选择。

每次 Contract 校验创建不可变 `ArtifactCandidateValidationRecord`：

```text
artifactCandidateValidationId
artifactCandidateId
runnerResultId
contractId
status                        valid | invalid
validatorRef
diagnosticRefs[]
validatedAt
contentDigest
```

`artifactCandidateId + runnerResultId` 唯一；相同校验输入重放返回原记录，不同结果为 conflict 并记录诊断。Runtime 必须在同一事务持久化 ValidationRecord 并追加 `agent.artifact_candidate.validated`；Event payload 引用该记录的稳定 ID、Candidate/RunnerResult/Contract 引用、结果、validator、诊断、时间和 digest。没有 ValidationRecord 表示 `pending_validation`；`invalid` 只保留 Candidate、ValidationRecord 和诊断，不创建正式 Artifact。Client 可以把来源冲突派生显示为 `conflict`，但不能伪造 validation status。

RunnerResult 是 Adapter 对一次明确 Attempt 的稳定收集结果：

```text
runnerResultId
runId
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
exitCode?
providerVersion
startedAt
finishedAt
contentDigest
integrity
```

Runtime 只能把结果绑定到同一 `agentInstanceId + attemptId` 的 Handle generation，并把 `runnerResultId` 写入该 TaskAttempt。`summary` 只用于描述；Artifact candidate、Change Set、验证证据和未解决事项必须使用结构化引用。RunnerResult 只能引用已持久化且绑定同一 AgentInstance、Attempt、Handle generation 和 ContextPackage contract 的 ArtifactCandidate，不能引用尚未创建的 Domain Artifact。固定结算顺序为：持久化 ArtifactCandidate 与 `agent.artifact_candidate.recorded`；持久化 RunnerResult 与 `agent.runner.result.created`；按 contract 校验所有 referenced candidate，对每个 candidate 持久化唯一 ArtifactCandidateValidationRecord 并追加 `agent.artifact_candidate.validated`；只为 `status=valid` 的 candidate 创建正式 Artifact 与 `artifact.created`；完成 worker barrier、Change Set 和其它 Task 条件；最后才提交 Attempt/TaskExecution success。每个阶段必须对相同 Attempt/generation 和上一阶段的持久化 ID 做事务内预检；缺失、冲突或验证无效的 candidate 作为审计证据保留，但不能创建 Artifact 或推进 success。重复 collect 必须返回相同 ID 和 digest；同一 ID/Attempt 出现不同 digest，或晚到结果指向当前 Handle 的其它 Attempt 时返回 conflict 并记录诊断，不能完成错误 Attempt。transient worker 的 WorkerResult 必须引用其来源 RunnerResult。

#### 10.5.5 AttemptLaunch

每个 Attempt 在 Adapter 接收前都创建稳定的两阶段启动记录：

```text
attemptLaunchId
runId
agentInstanceId
attemptId
launchKind                    new_handle | continued_handle
handleGeneration?
sourceReuseDispositionRecordId?
pendingDispatcherCoordinationLeaseIds[]
requestDigest
status                        pending_prepare | prepared | committed | rejected
processRegistrationRef?
runnerHandleRegistrationId?
preparedReceiptRef?
commitReceiptRef?
resultCode?
launchTerminationReceiptRef?
createdAt
committedAt?
finishedAt?
```

Runtime 先在 SQLite 中以 `status=pending_prepare` 创建 AttemptLaunch、TaskAttempt、ContextPackage 和 ExecutionClaim，再调用 Adapter `prepare_attempt_launch`。Dispatcher 初次启动或带 coupled lease 的 recovery 在同一事务预创建 pending replacement lease，并把其 ID 写入 `pendingDispatcherCoordinationLeaseIds[]`；普通 Attempt 该数组为空。新进程必须以 `attemptLaunchId` 登记并保持 input fence；prepared receipt 首次返回 Handle 时，Runtime 在同一事务创建 RunnerHandleRegistration 并回填 `runnerHandleRegistrationId`，continued Handle 则引用已有登记并暂存新 Context。二者在 `commit_attempt_launch` 前都不能开始模型工作或外部 operation，pending coordination channel 也保持 dormant。prepared receipt 持久化后，Runtime 才发送包含原 launch ID/digest、registration ID、Handle generation、prepared receipt ref 和相同 pending lease IDs 的 typed commit request。Adapter 对 prepare/commit/query 按 ID 和 digest 去重；相同 ID 不同 digest 返回 conflict。可靠 committed receipt 落盘时，Runtime 在同一事务激活该 launch 的 matching pending leases；launch rejected 或终止时在同一收敛事务 revoke 它们。

合法转换固定为 `pending_prepare -> prepared | rejected`、`prepared -> committed | rejected`；`committed | rejected` 为终态。崩溃恢复按 `attemptLaunchId` 查询：prepare 前可安全重试；进程创建但 receipt 未落盘时只能接管或用同 ID/digest 的 `terminate_launch` 终止 fenced process，不能创建第二 Handle；prepared 未 commit 时继续原 typed commit request，或在尚无可信 registration 时终止原 launch；commit 回执丢失时查询原状态，不能再次发送任务。可靠 LaunchTerminationReceipt 让未 committed launch 原子进入 `rejected`，保存 `resultCode=launch_reconciled_terminated | launch_reconciled_not_found`、receipt ref 和 `finishedAt`，并追加 `agent.attempt.launch.failed(phase=reconcile)`。已有可信 RunnerHandleRegistration 或 status 已 committed 时只能使用 `terminate_handle`，不能改写 launch 终态。Adapter 返回 Unknown 时 Attempt/AgentInstance 进入 interrupted 并创建 typed Attention，AttemptLaunch 保留最后可靠 status；Unknown 不是可伪装成 failed 或单独写入对象的状态。

#### 10.5.6 RunnerHandleRegistration

RunnerHandleRegistration 是 Runtime 对 opaque Adapter Handle 的持久化身份，也是 cleanup Attention、shutdown fence 和 capacity release 的稳定引用：

```text
runnerHandleRegistrationId
runId
agentInstanceId
runnerProfileId
handleGeneration
ownerKind                    attempt | dispatcher_coordination
sourceAttemptLaunchId?
sourceCoordinationLaunchId?
processRegistrationRef
creatorRuntimeInstanceId
adapterHandleAuthorityRef
controllerRuntimeInstanceId
controllerEpoch
status                       registered | fenced | quiesced | stopping | stopped | unknown
latestDispositionRecordId?
latestPostAttemptDisposition? reuse | retain | release
lastLifecycleEvidenceKind?
lastLifecycleEvidenceRef?
registeredAt
stoppedAt?
```

`sourceAttemptLaunchId | sourceCoordinationLaunchId` 必须且只能存在一个。`creatorRuntimeInstanceId + adapterHandleAuthorityRef` 记录首次创建、查询、input fence 和终止该 Handle 的正式 authority；无法提供该 authority 的外部 Terminal 不能登记为编排 Handle。`controllerRuntimeInstanceId + controllerEpoch` 记录当前 data-root owner；Runtime 重启后只有先取得 datastore lock、递增 owner epoch，并通过 Adapter 按原 registration/generation 对账成功，才能追加 `runner.handle.control_transferred` 接管。`processRegistrationRef` 是平台/Adapter 的 opaque 进程引用，不直接作为 Domain identity；所有 Attention 和 ShutdownRecoveryPlan 使用 `runnerHandleRegistrationId`。创建登记追加 `runner.handle.registered`，之后每次 fenced、quiesced、stopping、stopped 或 unknown 转换追加带 typed lifecycle evidence 的 `runner.handle.status_changed`，并投影最后一组 evidence 字段。`quiesced -> stopped` 必须有 `handle_termination | platform_not_found` evidence；ShutdownFenceReceipt 的 `completed` 可以用 `shutdown_completed` 直接证明 stopped。Shell 尚未终止进程树、普通 pause acknowledgement 或 `quiesced` receipt 都不能单独证明 stopped。相同 AgentInstance 只能有一个未 stopped 的 registration，generation 不可原地改变。只有 registration 已 stopped，且 assignment/临时资源已释放后才能释放 capacity reservation。

每个拥有 RunnerHandleRegistration 的 Attempt 收敛时必须创建一条不可变 `RunnerHandleDispositionRecord`，registration 上的 `latest*` 字段只做最新投影；从未创建/登记 Handle 的 Attempt 不创建伪 disposition。`ownerKind=dispatcher_coordination` 的 coordination-only Handle 没有 settled Attempt，不使用这套 record，只能按 lease rotation/finalization 合同继续或 release：

```text
runnerHandleDispositionRecordId
runnerHandleRegistrationId
settledAttemptId
disposition                  reuse | retain | release
reason
supersedesDispositionRecordId?
retainExpiresAt?
createdAt
```

每条记录追加 `runner.handle.disposition_recorded`。每个 `registration + settledAttempt` 恰有一条 `supersedesDispositionRecordId=null` 的初始决定；后续当前记录形成显式 supersede 链，只允许未被新 AttemptLaunch 消费且 registration 不受 coordination protection 的 `reuse -> retain | release`，以及同样不受保护的 `retain -> release`，其它改写拒绝。registration 在被任一 `active | rotating` DispatcherCoordinationLease、面向同一 continued Handle 的 pending replacement lease/launch，或未终态 DispatcherCoordinationLaunch 引用时属于 coordination-protected。`reuse` 被下一次 Attempt 消费时，新 AttemptLaunch 以 `sourceReuseDispositionRecordId` 引用它；该 Attempt 收敛后创建自己的初始 disposition record，不能覆盖上一 Attempt 的历史。

- `reuse`：Handle 保持 live 和原 assignment/grant 绑定，但新业务输入仍必须通过正常 AttemptLaunch、ContextPackage 和 capability 校验。
- `retain`：仅供用户现场调试/检查。它继续占用 capacity、沿用原 assignment/grant，并把 raw Terminal 置为只读/input-fenced；只有 Adapter 明确支持的 typed、side-effect-free inspection operation 可以执行。其输出只能进入诊断/transcript，不能创建新的 Message、RunnerResult、Artifact、Handoff、SpawnRequest 或业务 operation。无法强制只读和 inspection scope 的 Runner 不支持 retain。到期或用户结束后必须进入 release。
- `release`：Runtime 使用 typed termination 流程回收 Handle；可靠 stopped evidence 前不释放 capacity。
- disposition、liveness 或 cleanup 不明时 status/disposition 保持最后可靠值并创建 Attention，不能推断为 reusable 或 released。
- Run finalization、Grant 撤销/到期、RunnerQualification 失效或 Handle generation 变化都会强制 `release`；`reuse` 和 `retain` 不能跨越这些边界。retained expiry 优先于 Terminal attachment 和普通 idle timer，必须进入 release。
- formal AgentInstance 的业务 Attempt 收敛时可以 reuse。若 Handle 处于 coordination-protected，Runtime 必须自动记录 `reuse(reason=active_coordination_lease | coordination_rotation_in_progress)` 并继续阻止 idle stop；只要保护引用尚未可靠终态，用户 retain/release 都拒绝。Run finalization、Grant/qualification 失效或 generation 变化必须先撤销/终结保护它的 lease、pending replacement 和 launch，再强制 release。
- `retain` 只适用于不受 coordination protection 的 formal AgentInstance。transient worker 收敛时必须 release，不能阻塞父 Attempt；coordination-only Handle 没有 Attempt disposition，由 lease rotation/finalization 决定继续或 release。

#### 10.5.7 DispatcherCoordinationLaunch

DispatcherCoordinationLaunch 只在没有活动业务 Attempt 可以合法创建 replacement Handle 时恢复或轮换 Run 级目录协调职责：

```text
dispatcherCoordinationLaunchId
runId
dispatcherTaskExecutionId
dispatcherTaskId
agentInstanceId
sourceDispatcherCoordinationLeaseId
targetDispatcherCoordinationLeaseId
contextPackageId
executionWorkspaceAssignmentId
permissionGrantId
requestDigest
status                       pending_prepare | prepared | committed | rejected
runnerHandleRegistrationId?
preparedReceiptRef?
commitReceiptRef?
resultCode?
launchTerminationReceiptRef?
createdAt
committedAt?
finishedAt?
```

Runtime 在一个事务创建带 coordination recovery refs 的 replacement formal AgentInstance、capacity reservation、新 Grant/assignment、`purpose=dispatcher_coordination` ContextPackage、DispatcherCoordinationLaunch、`status=pending` 的 target DispatcherCoordinationLease 和对应 created Events，再调用 Adapter 的两阶段 coordination launch。request 携带 target lease 的 dormant coordination channel ref；commit 前 Runtime 拒绝该 channel 的所有调用。CoordinationLaunch 不创建 TaskAttempt、ExecutionClaim、RunnerResult 或业务 Artifact。prepared receipt 首次返回 Handle 时创建 RunnerHandleRegistration；Runtime 再通过 typed commit request 把 registration identity 交给 Adapter，可靠 committed 后才原子执行 target lease `pending -> active` 并启用 channel token。合法转换同样固定为 `pending_prepare -> prepared | rejected`、`prepared -> committed | rejected`，两种终态不可改写。相同 source lease 在一个 ShutdownRecoveryPlan 中最多有一个未终态 CoordinationLaunch；尚无可信 registration 时，可靠 LaunchTerminationReceipt 让未 committed launch 进入 `rejected`，保存 reconcile result code、receipt ref 和 `finishedAt`，追加 `dispatcher.coordination.launch.failed(phase=reconcile)` 并撤销 target pending lease。Adapter 返回 Unknown 时 launch 保留最后可靠 status，只能 query/terminate 原 launch ID 或创建 `coordination_launch_unknown` Attention，禁止回退为虚构 Attempt；已有可信 registration 或 committed status 时只能使用 `terminate_handle`。

#### 10.5.8 DispatcherCoordinationLease

DispatcherCoordinationLease 让普通 Dispatcher Task 的业务 Attempt 可以终态化，同时保留受控的 Run 级目录协调能力：

```text
dispatcherCoordinationLeaseId
runId
dispatcherTaskExecutionId
dispatcherTaskId
dispatcherAgentInstanceId
handleGeneration?
runnerHandleRegistrationId?
permissionGrantId
generation
capabilityScope[]              workspace_selection
status                         pending | active | rotating | revoked | expired
createdFromAttemptId?
createdFromCoordinationLaunchId?
replacesLeaseId?
replacedByLeaseId?
createdAt
activatedAt?
finishedAt?
contentDigest
```

`createdFromAttemptId | createdFromCoordinationLaunchId` 必须且只能存在一个。Runtime 在 initial/recovery Dispatcher AttemptLaunch 或 coordination-only DispatcherCoordinationLaunch 的 prepare 前预分配 `status=pending` lease 和 dormant channel ref，并追加 `dispatcher.coordination.lease.created`；RunnerQualification、Grant、assignment 和已知绑定在该事务先验证。recovery Attempt-coupled lease 还必须设置 `replacesLeaseId`，且 source lease 只能来自该 plan entry 的 `coupledDispatcherCoordinationLeaseIds[]`。pending 时 `handleGeneration/runnerHandleRegistrationId` 为空。Prepared receipt 返回并持久化 registration 后，激活事务必须校验 launch/AgentInstance/Grant/request digest 一致，冻结 generation 与 registration ID，再在 reliable commit receipt 已落盘时追加 `dispatcher.coordination.lease.status_changed(pending -> active)` 并原子启用 channel token；active/rotating 状态两字段必填，launch 拒绝/终止则撤销 pending lease。Dispatcher 的业务 TaskAttempt 随后可以按普通 Artifact/Transition 规则完成；Attempt-scoped request token 立即失效，但 coordination token 继续有效。该 token 只绑定 lease ID、Dispatcher AgentInstance、Handle generation、PermissionGrant、Run 和 `workspace_selection` scope，不能提交 spawn、checkpoint、permission operation 或 Task result。

coordination-protected registration 不进入普通 process-idle stop，也不接受用户 retain/release。保护集合包括引用该 registration 的 `active | rotating` lease、面向同一 continued Handle 的 pending replacement lease/launch，以及未终态 DispatcherCoordinationLaunch；只有 rotation commit/abort、launch 终态和旧 lease revoke/expire 已可靠落盘后才重新判断。Run finalization、安全退出、Handle generation 变化、Grant 失效或资格变化会先终结 pending/launch barrier、revoke lease 并关闭 coordination channel，再释放 Handle。需要继续协调时，Runtime 必须在 replacement/continued Handle 完成一致性校验后创建更高 generation 的新 lease；旧 lease 不原地换绑。已经通过旧 lease 投递但回执不明的 SelectionRequest 进入 blocked/Attention，不能自动转交新 lease或重复选择。

#### 10.5.9 SpawnRequest

SpawnRequest 是 transient worker 从请求到结果回传的 canonical 聚合：

```text
spawnRequestId
runId
parentAgentInstanceId
parentAttemptId
sourceKind                     runner_signal | user_command
sourceSignalId?
sourceCommandId?
reason
requestedRunnerProfileId?
resolvedRunnerProfileId?
runnerProfileSource            inherited | explicit
requestedCapabilities[]
requestedWorkspaceMode?
requestedPathAccess[]
requestedContextRefs[]
expectedOutputContractIds[]
targetWorkerAgentInstanceId?
selectionRequestId?
targetContextPackageId?
workerResultId?
status                         requested | awaiting_approval | provisioning | blocked | launched | completed | failed | rejected | canceled
blockedReasonCode?
resultCode?
requestDigest
createdAt
resolvedAt?
```

`spawnRequestId` 对 Runner signal 或用户命令分别与 `sourceSignalId/sourceCommandId` 建立唯一键；相同 ID/digest 重放返回原对象，不同 digest conflict。Runtime 先持久化 SpawnRequest 和 `agent.spawn.requested`，再进行 approval、预算、Profile、capacity、目录和权限流程。worker AgentInstance、SelectionRequest、ContextPackage、WorkerResult 和 WorkerResultDelivery 都必须回指同一 `spawnRequestId`。`agent.spawn.blocked/resolved` 只投影该聚合的合法状态转换；Runtime 重启后不能从 parent 列表、最近 worker 或 Terminal 文本重建关联。

`targetWorkerAgentInstanceId` 固定为首次 supervised dispatch 创建的 worker，不在进程恢复时改写。recovered transient 通过同一 `spawnRequestId` 保留原 dispatch identity，再由自身 parent/spawn triple 与 Attempt recovery pair连接当前监督父实例和旧 worker；查询该 SpawnRequest 的完整实例链必须按这些稳定 refs 展开，不能把单数 target 字段改写成“最新 worker”。

`launched` 只表示 worker AttemptLaunch 已可靠 committed；worker lifecycle 收敛并冻结 WorkerResult 后才进入 `completed | failed | canceled`。审批拒绝使用 `rejected`。选择、Context 或 launch 的确定失败终态化已创建 worker 并进入 `failed`；unknown 保持 `blocked` 和 typed Attention。SpawnRequest 的终态不会直接终结父 Attempt。

### 10.6 Message、ContextPackage 与 DecisionRecord

Message 是用户或 Agent 的补充沟通，不等同于 Task 定义：

```text
messageId
workspaceId
runId
seatId
agentInstanceId?
taskId
attemptId?
author
messageKind
body
attachmentRefs[]
deliveryMode
deliveryStatus
deliveryId?
runnerReceipt?
sourceSignalId?
sourceMessageId?
createdAt
```

`author` 为 `user | agent`；`messageKind` 为 `conversation | instruction`。用户消息的 `deliveryMode` 为 `current_attempt | next_attempt | direct_task`，`deliveryStatus` 为 `recorded | queued | delivering | delivered | rejected | delivery_unknown`。`next_attempt` 在目标 Attempt 创建前保持 `attemptId=null`、`runnerReceipt=null` 和 `deliveryStatus=queued`；没有 Runner 回执时不能显示为 delivered。每次向活动 Attempt 实际投递 conversation 或 instruction 都先冻结唯一 `deliveryId` 并进入 `delivering`，再调用 Adapter 的通用 `deliver_message`；崩溃后无法从同一 live Handle/provider session 以该 ID 重放 receipt 时进入 `delivery_unknown`，禁止自动重投。`direct_task` 的首条 Message 和 idle 后新一轮 Message 必须先于引用它的 Context Event 入账，由 Adapter 接收该 Context 的结构化 receipt 同时证明消息投递；正文不能另存为第二份启动 Prompt。Agent 回复固定使用 `messageKind=conversation`、`deliveryMode=runner_output` 和 `deliveryStatus=recorded`，并且 `agentInstanceId`、`attemptId`、`sourceSignalId` 必填。`attachmentRefs[]` 只能引用带版本或完整性摘要的文件、Diff 行、交付结果、Task 或 Attention。

`runnerReceipt` 至少保存 `deliveryId`、`messageId`、`messageKind`、`attemptId`、`status=accepted | rejected`、可选 provider receipt ref、接收时间和 content digest。活动 Attempt 的 receipt 只能来自 Adapter 的结构化 `message_receipt`；新 Attempt/Direct Task 的首条消息由同 digest 的 Context delivery receipt 证明，并同时追加 `agent.message.delivery_changed`。`delivery_unknown` 是投递事实未知，不等于 rejected；必须保留原 Message 和 delivery ID 供用户核对。

用户选择把 `delivery_unknown` 内容加入新 Attempt 时创建新的 Message，使用新 `messageId`、新 delivery ID 和 `sourceMessageId` 指向原记录；原 Message 保持 unknown，不能原地改成 queued 或 delivered。

Runtime 只接受 Adapter 的结构化 `assistant_message` RunnerSignal 创建 Agent 回复，并按 `signalId` 去重；Terminal 文本、生命周期 `produced_output` 或模型自述不能直接生成 Message。流式 delta 可以用于当前视图，但不是 canonical Message；每个完整回复或被明确标记为 interrupted 的部分回复都必须形成一条稳定信号和 `agent.message.recorded` Event，才能进入长期 Session、搜索、导出和 ContextPackage。

Seat Session 是按 `workspaceId + seatId` 查询 Message、Task 和 Run 的长期投影，不创建第二套聊天真源。Direct Task 允许自由对话，但 Message 的 `runId` 和 `taskId` 仍为必填。

ContextPackage 是 Runtime 向不同 Runner 投递协作上下文的不可变包：

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

Adapter 可以把 ContextPackage 渲染成 CLI Prompt 或结构化请求，但渲染结果不取代该对象。`coordinationContractRef` 和 `operationGuideRef` 必须是 Runtime 与 Adapter 已协商的不可变版本；`allowedRuntimeOperations[]` 是该实例/Attempt 可调用的最小 Runtime 操作集合，仍受 request channel、PermissionGrant 和 capability scope 约束。`completionReceiptSchemaRef` 对 primary/transient 必填，对 `dispatcher_coordination` 必须为空，因为后者不产生 RunnerResult。版本不匹配时 Context delivery 失败，不能发送一份“尽力而为”的 Prompt 后继续。

每个 TaskAttempt 都有一个 `purpose=primary_attempt` 的 ContextPackage，并以 `targetAgentInstanceId` 绑定 primary 实例。没有 Handoff、Artifact、Decision 或历史选择时，对应数组为空，但包仍包含目标 Task/Attempt、Workspace scope、ExecutionWorkspaceAssignment、PermissionGrant 和 expected output contracts，并在 Runner 启动前持久化。普通 Workflow、Direct Task、Retry、Rework 和 Recovery 使用同一规则：创建 Attempt 的事务必须同时创建 primary ContextPackage，并依次追加 `task.attempt.created`、`agent.context.created`；Adapter 成功接收后再追加 `agent.context.delivered`。失败必须追加 `agent.context.delivery_failed` 并终止新 Attempt，不能把未投递的包显示为 delivered。`selectedHistoryRefs[]` 只增加 `relevantMessageIds[]` 等可选上下文，不决定是否创建包。

每个 transient worker 使用独立的 `purpose=transient_worker` ContextPackage，`spawnRequestId` 必填，`targetAgentInstanceId` 指向 worker，`parentAgentInstanceId` 和 `returnToAgentInstanceId` 指向其当前父实例，assignment/grant 必须属于 worker。`expectedOutputContractIds[]` 此时定义 worker 返回父实例的结构，不直接满足 Task Artifact Contract；只有父 Attempt 明确采纳并产出有效 Artifact 后才进入正式 Handoff。一个 ContextPackage 不能同时投递给 primary 和 worker，也不能因它们属于同一 Attempt 而复用目录或权限引用。

`purpose=dispatcher_coordination` 只用于 DispatcherCoordinationLaunch：`dispatcherCoordinationLaunchId` 必填、`targetAttemptId` 和 `spawnRequestId` 为空，`expectedOutputContractIds[]` 为空。它只包含冻结的 Dispatcher Task/TaskExecution、Run 目录策略、允许模式、assignment、Grant 和协调指令，不能要求业务 Artifact 或产生 RunnerResult。一个 ContextPackage 只能有一种 purpose。

WorkerResult 是 transient worker 按 ContextPackage return contract 交还父实例的持久化结果，不是 TaskAttempt 的 RunnerResult，也不自动成为 Artifact：

```text
workerResultId
spawnRequestId
runId
parentAttemptId
workerAgentInstanceId
sourceRunnerResultId
returnToAgentInstanceId
sourceContextPackageId
contractIds[]
outcome                       completed | failed | canceled | interrupted
contentRefs[]
contentDigest
validationStatus              pending | valid | invalid
validationDiagnostics[]
createdAt
validatedAt?
```

`workerAgentInstanceId + sourceContextPackageId` 唯一。worker 的 lifecycle 只更新该 AgentInstance 并创建/终结 WorkerResult，绝不能直接把父 Attempt 置为 succeeded/failed。Runtime 先按 ContextPackage 的 return contract 校验内容，再通过独立 WorkerResultDelivery 投递，不复制结果正文：

```text
workerResultDeliveryId
spawnRequestId
workerResultId
returnToAgentInstanceId
parentAttemptId
deliveryId                    unique
status                        queued | delivering | delivered | rejected | delivery_unknown
runnerReceipt?
sourceDeliveryId?
createdAt
deliveredAt?
```

首次投递和每次用户明确重新交付都创建新的 WorkerResultDelivery；`sourceDeliveryId` 在重交付时引用原 unknown/rejected delivery。Runtime 使用稳定 `deliveryId` 通过父 Handle 的结构化 worker-result callback 投递，回执必须绑定 delivery、WorkerResult、父 AgentInstance 和父 Attempt。回执丢失且 Adapter 无法按同一 delivery ID 去重查询时，当前 delivery 进入 `delivery_unknown` 并创建 `worker_result_delivery_unknown` Attention，禁止自动重投；原 unknown 记录永不改写。

父 Runner 可以采纳、拒绝或要求 worker 重做，但采纳只进入父实例上下文；父 Attempt 仍必须由 primary RunnerResult 和 Task Artifact Contract 决定终态。WorkerResult 只有被父 Attempt 明确转化或引用为通过校验的 Artifact 后，才能进入正式 Handoff。

DecisionRecord 是已接受或已明确拒绝的业务判断，不是从聊天文本推断出的摘要：

```text
decisionId
runId
taskId?
attemptId?
attentionId?
origin                        attention_resolution | explicit_user
author
outcomeCode
disposition                   accepted | rejected
comment?
evidenceRefs[]
supersedesDecisionId?
createdAt
```

`origin=attention_resolution` 时 `attentionId` 必填；`origin=explicit_user` 由 `decision.record` Command 创建且 `taskId` 必填。首版 `author` 必须是当前本地用户；Agent 的建议先作为 Message 或交付结果存在，未经用户显式记录或解决 Attention 不能成为 accepted DecisionRecord。`acceptedDecisionRefs[]` 只能引用 `disposition=accepted` 且没有被后续 DecisionRecord 的 `supersedesDecisionId` 取代的当前记录；rejected 或 superseded 记录只能留在历史，不能注入 ContextPackage/Handoff 的 accepted 集合。修改决定必须新增记录并通过 superseding reference 说明关系，不能原地改写已进入历史的记录。

### 10.7 Handoff

Handoff 表达一次明确的跨 Task/Seat 交付：

```text
handoffId
runId
sourceAttemptId
sourceAgentInstanceId
targetTaskId
targetSeatId
artifactRefs[]
changeSetRefs[]
acceptedDecisionRefs[]
unresolvedItems[]
status
supersededByHandoffId?
createdAt
deliveredAt?
failureCode?
```

规则：

- `status` 为 `queued | delivered | failed | superseded`。
- 合法转换为 `queued -> delivered | failed | superseded` 和 `failed -> superseded`。`delivered` 与 `superseded` 是终态；投递失败后的重试创建引用同一 Artifact refs 的新 Handoff，不把旧项改回 queued。
- Handoff 必须包含目标 Task/Seat 和满足 Contract 的 Artifact；不能用看板列、终端输出或自然语言 Agent 名称替代引用。
- Runtime 先持久化 Handoff，再为目标 Attempt 构造 ContextPackage；Prompt 注入只是投递机制。
- 目标 Runner 不可用时保留 queued/failed 记录并创建 Attention，不静默改派其它 Seat。
- 上游重做产生新的 Artifact 和 Handoff；已经消费的 Handoff 不原地改写。尚未交付的旧 Handoff 与替代 Handoff 在同一事务创建/关联，旧项通过 `handoff.superseded` 进入终态并设置 `supersededByHandoffId`。
- transient supervised dispatch 不创建 Handoff：父 Attempt 继续拥有业务责任，worker 只通过 SpawnRequest、WorkerResult 和 WorkerResultDelivery 回传。只有目标 Task/Seat 接管后续责任时才创建正式 Handoff；活动 Task 改 owner 仍必须通过 Amendment/Rework，不能用 Handoff 或实例重绑静默变更。

### 10.8 Attention

Attention 是 Workspace 拥有、需要用户明确处理的持久化待办；Run 只通过 scope 查询自己的 Attention：

```text
attentionId
workspaceId
scopeKind                    run | queue_item
runId?
queueItemId?
scheduleFireId?
sourceNodeId?
sourceTaskId?
sourceAttemptId?
subjectRefs[]
kind
status
messageKey
messageParams
contextArtifactRefs[]
contextMessageIds[]
allowedActions[]
blocking
createdSequence
createdAt
resolvedAction?
resolvedDecisionId?
resolvedBy?
resolvedAt?
resolutionEvidenceRefs[]?
resultEventIds[]?
```

`subjectRefs[]` 的每项固定为 `{ subjectKind, subjectId }`；kind 至少包含 `run | node_execution | task_execution | task_attempt | agent_instance | dispatcher_coordination_lease | dispatcher_coordination_launch | spawn_request | attempt_launch | runner_handle_registration | workspace_selection_request | execution_workspace_assignment | permission_grant | permission_operation_request | permission_decision_delivery | capacity_reservation | shutdown_fence | shutdown_recovery_plan | recovery_operation | message | message_delivery | worker_result | worker_result_delivery | queue_item | schedule_fire | change_set | artifact_candidate | artifact_candidate_validation | artifact | result_review_request | result_integration_attempt`。Event 只复制这些 typed refs，不复制 subject 内容。`sourceNodeId/sourceTaskId/sourceAttemptId` 表示产生 Attention 的上下文，不能替代实际 subject。

`kind` 至少包含 `approval | question | exception | join_blocked | long_wait | spawn_approval | staffing_request | workspace_selection_blocked | permission_operation | permission_decision_delivery_unknown | message_delivery_unknown | worker_result_delivery_unknown | attempt_launch_unknown | coordination_launch_unknown | cleanup_unknown | result_integration_unknown | recovery_operation_unknown | launch_blocked`，持久化 `status` 只使用 `open | resolved`。Client 的提交中和失败提示属于本地请求状态，不写入 Domain；`attention.resolve` 失败时 Attention 保持 `open`，可以用新的 `commandId` 重试。`long_wait` 只允许 `keep_waiting | reconcile`，不能开放 Retry/Skip/Fail；`join_blocked` 必须引用 NodeExecution 和缺失来源；`spawn_approval` 必须引用 SpawnRequest；`workspace_selection_blocked` 必须引用 SelectionRequest 和 target AgentInstance；`permission_operation` 必须引用 PermissionOperationRequest；`attempt_launch_unknown` 必须引用 AttemptLaunch、AgentInstance 和 RunnerHandleRegistration（存在时）；`coordination_launch_unknown` 必须引用 DispatcherCoordinationLaunch、source lease 和 RunnerHandleRegistration（存在时）；`cleanup_unknown` 必须逐项引用状态不明的 original launch（registration 尚不存在时）、RunnerHandleRegistration、assignment、capacity reservation、shutdown fence 或 delivery；`result_integration_unknown` 必须引用 ResultIntegrationAttempt 和 Change Set；`recovery_operation_unknown` 必须引用 RecoveryCheckpoint 中的具体 operation 及其最后可靠证据。unknown delivery kinds 必须引用原业务对象和 delivery ID。`scopeKind=run` 时 `runId` 必填且 `queueItemId` 为空；`scopeKind=queue_item` 时 `queueItemId` 必填、`runId` 为空，`scheduleFireId` 只在计划来源时设置。一个 Attention 只能产生一个有效 resolution。`record_verified_cleanup`、`record_operation_completed` 和 `record_operation_not_completed_and_retry` 必须保存非空 `resolutionEvidenceRefs[]`；前两者还必须通过 `resultEventIds[]` 指向同一事务追加的 typed reconcile、验证结果或资源收敛 Event。用户陈述不能伪造成 Runner/provider receipt。

Run 范围内产生业务判断的 resolution 写入 DecisionRecord，并由 `resolvedDecisionId` 引用。Runtime 为资源治理关闭不再可执行的入口时不创建 DecisionRecord：safe shutdown 的 process-free aggregate disposition 必须把旧 SelectionRequest/target 的 open `workspace_selection_blocked` Attention 以 `resolvedBy=runtime`、`resolvedAction=superseded_by_safe_exit_before_launch` 终结，并在同一事务追加 `attention.resolved`；后续新 SelectionRequest 若再次 blocked，创建新的 Attention。Queue 范围的 `launch_blocked` 只允许修复 Runner Profile、为该项创建新的 ExecutionPolicyVersion 与 RunLaunchSpec、重试或取消队列项；它是启动治理动作，不创建可注入 Agent Context 的业务 DecisionRecord。Queue Item 通过用户命令或 scheduler 竞争进入终态时，Runtime 可用稳定 system action 自动 resolve 关联 Attention；这仍必须追加 `attention.resolved`，不能只从列表隐藏。

### 10.9 Artifact

Artifact 是通过 Artifact Contract 冻结的交付结果，不等于 Project File、Change Set 或任意日志：

```text
artifactId
runId
contractId
sourceArtifactCandidateId
sourceValidationRecordId
producerTaskId
producerAttemptId
producerAgentInstanceId
version
name
mediaType
contentRef
contentDigest
integrity
validationStatus              valid
currentness
supersedesArtifactId?
consumedBy[]
createdAt
```

Artifact 内容不可原地修改。正式 Artifact 只能是 `validationStatus=valid`，`currentness` 为 `active | superseded`；无效结果只存在于 ArtifactCandidate/ValidationRecord。新的 Retry 或 Rework 产出新 Artifact，消费关系只追加稳定 Attempt/Handoff 引用。历史 blob 缺失或 digest 不符属于读取完整性错误，不改写 Contract validation。

每个 Artifact 必须能追溯到同一 producer Attempt 的 `ArtifactCandidate -> RunnerResult -> Artifact Contract validation` 链；`contentRef`、`contentDigest`、`mediaType` 和 `integrity` 必须与已验证 candidate 一致。Artifact 的业务名称、版本、currentness 和 consumption 由 Runtime 在验证/交付阶段补充，不能由 RunnerSignal 直接决定。

### 10.10 RunAmendment

运行中调整不直接修改 Snapshot：

```text
amendmentId
runId
sourceCommandId
baseSnapshotId
newSnapshotId
reason
operations[]
createdAt
appliedAt
```

`operations[]` 只允许以下结构化类型，不接受 JSON Patch、自由文本字段路径或 Runner 自定义操作：

- `add_formal_seat`
- `disable_unstarted_seat`
- `add_task`
- `update_unstarted_task`
- `update_rework_task`
- `update_untriggered_gate`
- `add_transient_runner_profile_binding`
- `increase_execution_budget`
- `replace_unstarted_permission_grant`

新增 formal Seat/Task 可以由一组操作原子完成。禁用 Seat 时，其全部未开始 Task 必须在同一 Amendment 重新指派；V1 不提供 Role 或 Task 停用。`update_unstarted_task` 只允许修改尚未开始 Task 的 instructions、owner、Runner binding、permission policy 和结构化 Transition/Contract 引用。`update_rework_task` 只允许与 `amend_and_rework` disposition 同一事务使用：先终结来源 Attempt/TaskExecution，再为新的 TaskExecution activation 冻结 instructions、owner、Runner binding、permission policy 和 Contract；它不能修改任何历史 Attempt 或 Artifact。Profile 操作只能加入当前设备已探测、满足所需 capability 的稳定 Profile binding；预算只能提高，不能降低到当前或历史使用量以下。`replace_unstarted_permission_grant` 只为尚无 AttemptLaunch、live Handle、active DispatcherCoordinationLease 或 operation 的未启动 TaskExecution/预分配 AgentInstance 创建新 Grant，并在同一事务撤销旧 Grant；已活动 Attempt/Handle/coordination lease 禁止原地扩大权限，需要变化时必须终结当前工作后通过 `amend_and_rework` 建立新 TaskExecution、AgentInstance 和 Grant。普通 Retry 只能沿用原 TaskExecution 的有效 Snapshot 与 permission policy。

禁止修改：

- 已完成或运行中的 Task 定义
- 已产生 Artifact 的含义
- 已经解决的 Gate
- 历史 Event

`run.amend` 的 canonical payload 包含 `runId`、`expected_sequence`、`baseSnapshotId`、`reason` 和非空 `operations[]`。它只允许 Run 处于 `running | paused`，且没有 `terminationIntent`、冻结的 `finalizationOutcome`、正在提交的 cancel/finalization barrier。Runtime 先建立 per-run scheduling barrier，再在一个 SQLite 写事务中校验 `expected_sequence`、`Run.activeSnapshotId == baseSnapshotId` 和全部 operation 只影响未开始部分。成功事务同时创建已应用的 RunAmendment、新的不可变 RunSnapshot，更新 `Run.activeSnapshotId` 并追加 `run.amended`；Event payload 保存 old/new Snapshot、Amendment 和 operation digest。任何校验或持久化失败都不创建 RunAmendment、不更新 active Snapshot、不追加 Event，也不部分应用 operation。相同 `sourceCommandId` 重放返回原结果。

`attention.resolve(amend|approve staffing_request)` 必须调用同一个原子应用入口；它可以复用自身 `commandId` 作为 `sourceCommandId`，不能维护第二套 Snapshot 修改逻辑。

`run.retry` 的 canonical payload 固定为 `runId`、`taskExecutionId`、`sourceAttemptId`、`attentionId?`、`expected_sequence`、`reason` 和 `commandId`。Runtime 以 `expected_sequence` 和 TaskExecution aggregate 做 compare-and-set：来源 Attempt 必须属于该 TaskExecution，`currentAttemptId` 必须为 `sourceAttemptId`，不存在其它 pending work，且只能满足以下两个互斥条件之一：

1. source Attempt 已处于 canonical 终态，TaskExecution 仍为 `waiting_attention`。Attempt 终态不改写；如果命令携带 `attentionId`，它必须是引用该 TaskExecution/source Attempt 的 matching open retry Attention。Runtime 在同一事务处理适用的 Decision/Attention resolution，清除 `currentAttemptId`，写入 `pendingAttemptKind=retry`、`pendingFromAttemptId=sourceAttemptId`、`pendingCommandId=commandId`，并把 TaskExecution 置为 `provisioning`。
2. source Attempt 本身是当前 exception Attempt 且仍为 `waiting_attention`。此时 `attentionId` 必填，并必须引用该 Attempt/TaskExecution、状态为 `open` 且允许 `retry`。Runtime 在一个 SQLite 事务按顺序完成 Attempt `waiting_attention -> failed` 且 `resultCode=user_retry_requested`、创建适用的 DecisionRecord、resolve 该 Attention、清除 TaskExecution.`currentAttemptId`、写入上述唯一 pending retry owner，并追加 TaskExecution `waiting_attention -> provisioning` 状态变化。Attempt、Attention、Decision 或 TaskExecution 的任一 compare-and-set 失败时整个事务不应用，不得留下 resolved Attention、没有 pending owner 的失败 Attempt，或第二个 retry owner。

成功事务只登记 pending retry，不直接创建新 Attempt、AgentInstance 或 ContextPackage。事务提交后才处理旧 Handle disposition，并走 capacity、Grant、SelectionRequest/assignment、ContextPackage 和 AttemptLaunch 的统一 pre-Attempt pipeline；后续失败进入 `blocked` 并创建新 Attention，不复活已 resolve 的 blocker。相同 `commandId` 重放返回原 pending owner/后续结果；新命令在 sequence、Attempt、Attention、`currentAttemptId` 或 pending owner 任一不匹配时 conflict。Retry 不创建新 TaskExecution，也不修改 Snapshot。

`run.rework` 的 canonical payload 固定为 `runId`、`sourceTaskExecutionId`、`sourceAttemptId`、`targetTaskId`、`expected_sequence`、`baseSnapshotId`、`reason`、`changeSetRefs[]`、可选 `reviewSelection`、`relatedArtifactRefs[]`、Runtime 预览返回的 `eligibleTargetPlanId` 和 `commandId`。`reviewSelection` 严格使用本文定义的 `{ changeSetId, threadSelections[] { threadId, commentIds[] } }` 结构；Client 不得在 payload 中提交 Runtime 生成的 Bundle ref。存在 `reviewSelection` 时，其 `changeSetId` 必须与 `changeSetRefs[]` 中唯一 matching ref 一致。同 Run Rework 只允许当前 open Gate 的合法 `rejected` Transition 目标，且必须满足 `maxIterations`；否则 plan 必须选择 `descendant_run`，冻结来源 Run/Snapshot/Task/Attempt/Artifact refs 后创建后代 Run。Client 不能按名称、画布邻接或最近 Task 选择目标。Runtime 在同一 SQLite 事务重新验证 plan、sequence、Snapshot、目标可用性以及适用的 thread/comment 选择，并且仅在整个 Rework plan 成功持久化时创建 Bundle 和 `diff.review.bundle.created`。任一条件已变化则 conflict，不创建部分 Bundle、Snapshot、后代 Run 或 TaskExecution。

### 10.11 ExecutionWorkspaceSelectionRequest

除根 Dispatcher 的冻结 bootstrap assignment 和已通过绑定一致性预检的现有 formal AgentInstance 外，新 formal 或 transient AgentInstance 的执行目录必须经过 Runtime 发起的持久化选择请求：

```text
selectionRequestId
runId
taskExecutionId
targetTaskId
targetAgentInstanceId
selectorKind                   formal_dispatcher | transient_parent
selectorAgentInstanceId
selectorHandleGeneration
selectorAttemptId?
dispatcherCoordinationLeaseId?
baselineRef
allowedModes[]
requiredPathAccess[]
requestDigest
retryOfSelectionRequestId?
status                        pending_delivery | awaiting_selection | validating | assigned | blocked
deliveryId
responseSignalId?
selectedMode?
selectionReason?
executionWorkspaceAssignmentId?
blockedReasonCode?
timeoutAt
createdAt
updatedAt
```

Runtime 必须先完成 Handle 复用预检；需要新实例时预分配并持久化 `status=created|provisioning` 的 target AgentInstance 和独立 PermissionGrant，再创建 SelectionRequest 和 `execution.workspace.requested` Event。`targetAgentInstanceId` 因此在请求投递前已经稳定存在。formal Task 使用 active DispatcherCoordinationLease，要求 `selectorAttemptId=null`；transient worker 使用 parent 的 active Attempt-scoped channel，要求 `selectorAttemptId` 必填且 `dispatcherCoordinationLeaseId=null`。两者都绑定 selector AgentInstance、Handle generation 和 Grant，不能混用。Runtime 通过对应 Handle 投递请求；selector 只能用携带相同 `selectionRequestId + requestDigest` 的结构化 response signal 回答。有效 response 追加 `execution.workspace.selection_received`，校验通过后创建 assignment、把请求置为 `assigned` 并追加 `execution.workspace.assigned`。TaskAttempt 和 ContextPackage 只能在 assignment 成功后创建。

`requestDigest` 覆盖除时间戳、delivery/response/status 字段外的全部请求语义和 selector/target identity。相同 response signal 或相同 request/digest 的重放返回原结果；同一 request ID 的不同 digest/响应必须 conflict。超时、selector 不可用、投递回执不明或重启后无法恢复原请求时，把请求置为 `blocked`，追加 `execution.workspace.blocked` 并创建 `workspace_selection_blocked` Attention。目标 TaskExecution 进入 `blocked`，target AgentInstance 保持未启动；Runtime 不选择默认模式或“第一个可用目录”。显式重试创建带 `retryOfSelectionRequestId` 的新请求和新 digest；用户覆盖使用 `execution.workspace.override`，仍必须经过同一目录、权限和基线校验。safe shutdown 的 process-free aggregate disposition 可以把 `pending_delivery | awaiting_selection | validating` 请求置为 `blocked/safe_exit_before_launch`，但这是受控资源收敛，不创建 Attention；若旧请求已 blocked，状态不改写，但其 open selection Attention 必须在同一事务以 `superseded_by_safe_exit_before_launch` 系统动作 resolve。该 request 不再接收 response，后续 `continue_pre_attempt` 创建引用它的新 SelectionRequest；新请求再次 blocked 时才创建新的可操作 Attention。已经 `assigned` 的 request 不改写，由 `execution.workspace.released` 终结其 assignment。

### 10.12 ExecutionWorkspaceAssignment 与 PermissionGrant

每个 AgentInstance 启动前创建两个版本化记录。目录模式、基线、路径范围和能力范围创建后不可原地改写；释放、过期或权限替换通过追加生命周期事件或新记录表达：

```text
executionWorkspaceAssignmentId
agentInstanceId
mode                         shared_workspace | git_worktree | temporary_directory
baselineRef
executionRoot
sourceRef?
integrationTargetRef?
integrationPolicy             review | auto_if_clean | manual
selectedByAgentInstanceId?
selectionReason
createdAt
releasedAt?

permissionGrantId
agentInstanceId
profile                      read_only | workspace_write | selected_paths | full_access
pathGrants[]
capabilityPolicies
inheritedFromPermissionGrantId?
replacesPermissionGrantId?
replacedByPermissionGrantId?
status                       active | revoked | expired
approvedBy?
createdAt
revokedAt?
expiresAt?
contentDigest
```

`pathGrants[]` 的稳定结构为：

```text
pathGrantId
path
access                       read | write
scope                        attempt | run | workspace
expiresAt?
```

`executionRoot` 只在 Runtime 本地持久化，不进入跨平台业务 Event。Event 使用 assignment ID 和 Workspace 相对引用。transient worker 的 PermissionGrant 必须是父 Grant 与 RunSnapshot 策略的交集。活动 Attempt/Handle 的 PermissionGrant 不允许原地扩大或替换；`permission.grant.replaced` 只适用于 `replace_unstarted_permission_grant`，要求目标 AgentInstance 尚无 AttemptLaunch、live Handle、active DispatcherCoordinationLease 或 operation。Runtime 在一个事务创建新 Grant、双向关联旧/新记录、撤销旧 Grant，先追加新 Grant 的 `permission.grant.created`，再追加携带 old/new IDs、Amendment/command ref、旧 `active -> revoked`、reason/effective time 和双 digest 的 `permission.grant.replaced`；replacement 不再追加一条含义重复的普通 status Event。任一步失败不改变原 Grant。其它撤销或到期必须追加 `permission.grant.status_changed`，携带稳定 reason/effective time；依赖该 Grant 的 lease/channel 在同一事务失效或进入收敛。活动工作需要扩大权限时使用 `amend_and_rework` 创建新的 TaskExecution、AgentInstance 和 Grant。

safe shutdown 对 process-free、从未启动的 aggregate 仍必须逐项追加生命周期 Event：存在 assignment 时写 `execution.workspace.released(reasonCode=safe_exit_before_launch)`，active Grant 写 `permission.grant.status_changed(... -> revoked, reasonCode=safe_exit_before_launch)`。两者都完成后，`agent.instance.stopped(lifecycleEvidenceKind=not_started)` 才能设置 `capacityReleasedAt`；清除 TaskExecution 引用不能替代这些 Event。

#### 10.12.1 PermissionOperationRequest 与 PermissionDecisionDelivery

`capabilityPolicies` 为 `ask` 的操作必须在执行前被官方 Runner hook 或平台 broker 截获，并创建一次性请求：

```text
permissionOperationRequestId
runId
agentInstanceId
attemptId
permissionGrantId
handleGeneration
operationId
operationKind
requestedCapability           networkAccess | externalProcessExecution | writesOutsideWorkspace | destructiveCommands | externalPublish
operationIntentRef
operationDigest
status                        open | approved | rejected | expired
expiresAt
decisionId?
createdAt
resolvedAt?

permissionDecisionDeliveryId
permissionOperationRequestId
decision                     approve_once | reject
operationDigest
deliveryStatus               queued | delivering | delivered | rejected | delivery_unknown
providerReceiptRef?
createdAt
finishedAt?
```

Runtime 在 operation 离开拦截边界前持久化 request、`permission.operation.requested` 和 `permission_operation` Attention，并让 Attempt 进入 `waiting_attention`。`approve_once` 只授权同一 request、Handle generation、operation ID 和 digest；它不会替换或扩大 PermissionGrant，也不能被后续 operation 复用。`attention.resolve` 用 compare-and-set 同时创建 DecisionRecord、resolve request/Attention 和预分配 decision delivery ID，再通过同一 hook 投递。Adapter/broker 只有收到匹配 decision 后才能释放该 operation。

到达 `expiresAt` 时，Runtime 在一个事务内把仍 open 的 request 置为 `expired`，以稳定 system action resolve Attention，追加 `permission.operation.resolved(resolution=expired)`，并创建 `decision=reject` 的 PermissionDecisionDelivery；不创建冒充用户判断的 DecisionRecord。相同超时处理重放返回原结果。Attempt 只有在可靠 reject receipt 后才能按策略失败/结束等待；delivery unknown 保持阻塞并进入对应 Attention。

相同 request/digest 或 decision delivery 重放返回原结果；同 key 不同 digest 必须 conflict。超时固定为 reject/expired。delivery receipt 丢失时，只有 Adapter/broker 声明可按原 delivery ID 查询，Runtime 才能恢复原结果；否则记录 `delivery_unknown` 并创建 `permission_decision_delivery_unknown` Attention，禁止自动再次批准。恢复时 unresolved request 保持 blocked；已批准但 decision delivery 或 operation checkpoint 不明的外部副作用按 unknown 处理，不能从 Agent 文本、Terminal 或文件存在推断已执行。

### 10.13 ResultReviewRequest

worktree 和临时目录的隔离结果在进入 Review 时，由 Runtime 创建稳定、持久化的审阅请求：

```text
resultReviewRequestId
runId
sourceAttemptId
executionWorkspaceAssignmentId
sourceChangeSetId
eligibleChangeSetEntryRefs[]
eligibleArtifactRefs[]
policy                        review | auto_if_clean | manual
status                        review_requested | integrated | rejected
integrationAttemptIds[]
latestIntegrationAttemptId?
createdAt
resolvedAt?
rejectionReason?
contentDigest
```

`execution.result.review_requested` 必须在同一事务创建 ResultReviewRequest 和 Event，并携带 Runtime 生成的 `resultReviewRequestId`；Client、Adapter 和 Runner 都不能生成该 identity。eligible refs 在创建时冻结并全部绑定同一 source Attempt/Change Set；它们定义可选范围，不等于用户已经选择 Apply 内容。

`execution.result.reject` 直接引用 `resultReviewRequestId`。Runtime 只在 request 仍为 `review_requested` 且不存在 `requested | staging | reconciling | integration_unknown` 的 ResultIntegrationAttempt 时接受，随后追加 `execution.result.rejected` 并把 request 终态化为 `rejected`；这个路径不创建 ResultIntegrationAttempt。因此用户在首个 `review_requested` 状态即可构造 Reject，不依赖任何 Apply identity。**Review later** 不改变 request 状态。

首次 Apply 只有在 `integrationAttemptIds[]` 为空时才创建 ResultIntegrationAttempt，并把其 ID 追加到该数组；一旦存在任何 Attempt，后续 Apply 必须是引用 canonical failed source 的 Retry，不能省略 retry ref 改选后伪装成首次应用。Apply 正在执行、失败或 Unknown 时 ResultReviewRequest 本身仍保留原 identity；只有 matching `execution.result.integrated` 才把 request 终态化为 `integrated`。failed attempt 允许在相同 request 下按下述规则 Retry；非终态 attempt 阻止并发 Apply 和 Reject。`integrated | rejected` request 永远不能再次 Apply 或 Reject。

### 10.14 ResultIntegrationAttempt

ResultIntegrationAttempt 专属于一次实际 Apply；打开 Review、稍后处理或直接 Reject 都不创建该对象：

```text
integrationAttemptId
resultReviewRequestId
runId
executionWorkspaceAssignmentId
sourceChangeSetId
selectedChangeSetEntryRefs[]
selectedArtifactRefs[]
targetRootRef
expectedTargetRef
policy                        review | auto_if_clean | manual
requestedBy
sourceCommandId
requestDigest
retryOfIntegrationAttemptId?
status                        requested | staging | reconciling | integrated | failed | integration_unknown
resultTargetRef?
outcomeEvidenceRef?
failureCode?
createdAt
finishedAt?
```

`selectedChangeSetEntryRefs[]` 与 `selectedArtifactRefs[]` 至少一项非空，并且全部属于 ResultReviewRequest 冻结的 eligible refs 和 source Change Set/Attempt；临时目录只应用明确选择的集合。选择集合、`resultReviewRequestId`、source refs 和 `sourceCommandId` 在 Attempt 创建后不可修改。重复命令按 `commandId` 返回同一记录。Runtime 必须先验证 request 仍为 `review_requested`、不存在其它非终态 integration attempt、首次 Apply 时 `integrationAttemptIds[]` 为空、`expectedTargetRef`、选择集合和完整性，再在同一事务创建 Attempt 并追加 `execution.result.integration_started`；失败记录不能对应部分写入的目标目录。

目标写入和结果记录通过平台原子替换或 durable integration journal 关联。写入后回执不明时进入 `integration_unknown` 并创建 typed Attention，只能按原 `integrationAttemptId + requestDigest` 查询/对账；不得自动重做。对账开始进入 `reconciling`，可靠证明 integrated/failed 后才终态化。

`retryOfIntegrationAttemptId` 只允许引用 canonical `status=failed` 的旧 ResultIntegrationAttempt。`integrated`、`requested`、`staging`、`reconciling` 和 `integration_unknown` 均不具备重试资格；旧 Attempt 为 `integration_unknown` 时，必须先由 `execution.result.reconcile` 根据可靠证据把它终态化为 `failed`，之后才可以成为重试来源。ResultReviewRequest 已为 `integrated | rejected` 时永远不得创建 Retry。

Runtime 接受 Retry 前必须验证旧 Attempt 存在且属于同一 `resultReviewRequestId`、`runId`、`executionWorkspaceAssignmentId` 和 `sourceChangeSetId`，request 仍为 `review_requested`，新命令的两个 selected ref 集合与旧 Attempt 冻结的 source selection 完全一致，并且 `targetRootRef` 仍指向与旧 Attempt 兼容的同一逻辑目标；`expectedTargetRef` 必须针对新命令和目标当前状态重新校验。Retry 使用新的 `commandId` 创建新的不可变 `integrationAttemptId`，其 `retryOfIntegrationAttemptId` 固定引用旧 failed Attempt；不得复用或改写旧命令、旧 Attempt 及其 Event 历史。全部资格、来源、目标兼容性和 compare-and-set 校验与新 Attempt/`execution.result.integration_started` 创建必须在同一事务完成；任一校验失败时不创建新 Attempt，也不追加结果应用 Event。

### 10.15 EvidencePin、HistoryExportRecord 与 HistoryDeletionRecord

EvidencePin 把即将受 transcript 清理策略影响的片段转换为脱敏后的持久化证据：

```text
evidencePinId
runId
sourceKind                   event | message | terminal_range | artifact | change_set
sourceRef
sourceRange?
redactedContentRef
contentDigest
createdBy
createdAt
unpinnedAt?
```

HistoryExportRecord 属于 Workspace，记录一次选择性导出的边界和结果，不保存秘密或完整导出内容：

```text
historyExportRecordId
workspaceId
runId?
selectionManifest
includeTerminalTranscript
status                       requested | completed | failed
outputRef?
outputDigest?
requestedBy
createdAt
finishedAt?
failureCode?
```

HistoryDeletionRecord 属于 Workspace，从删除请求开始记录生命周期；成功后成为保留的最小审计 tombstone：

```text
historyDeletionRecordId
workspaceId
targetKind                   session | run | transcript | evidence_pin
targetIds[]
scopeSummary
policyRef
requestedBy
status                       requested | completed | failed
tombstoneManifestRef?
tombstoneManifestDigest?
createdAt
finishedAt?
deletedAt?
failureCode?
```

删除记录不能包含被删除正文、Terminal 字节或秘密。`history.deletion.requested/completed/failed` 都引用同一个记录；只有 `completed` 必须设置 `deletedAt` 和不可变 tombstone manifest。删除 Run 时，记录写入 Workspace 事件流；不能把唯一审计记录放在目标 Run 内。

V2 canonical Workspace Event ledger 永不删除、重排或重编号，历史清理不能制造 sequence 缺口。Event payload 只保存稳定 ID、code、digest 和 typed refs，不保存 Message body、Terminal bytes、Artifact blob 或 ContextPackage 正文。删除只清理独立 content/blob/index 数据，并把仍被 Event、ContextPackage、Handoff、Decision、Artifact 或谱系引用的 identity row 转为 typed tombstone；最小 tombstone 保留对象 ID、kind、Workspace/Run lineage、创建时间、`deletedAt` 和 `historyDeletionRecordId`，所有正文、可恢复输入和秘密引用必须移除。

只有终态 Run 和不属于非终态 Attempt/恢复计划的 Session 内容可以删除。内部引用读取 typed tombstone，而不是 404 或悬空外键；UI、导出和搜索显示“已删除”并停止跟随内容引用。Projection checkpoint 可以替换可重建索引，SQLite 可以回收已删除 blob 空间，但 checkpoint 不能取代或截断 canonical ledger。恢复只依赖完整 ledger 和尚未删除的非终态对象，因此清理后重放仍得到相同 tombstone 投影。

---

## 11. Template Domain

Template 是可复用的 OrchestrationVersion：

```text
templateId
name
description
version
organization
workflow
presentation
requiredRunnerCapabilities[]
```

应用 Template 时创建 Workspace Draft 副本，不与 Template 保持可变引用。

Template 不保存：

- 项目绝对路径
- 设备 Runner Profile ID；Seat/Task override 保存为能力要求，应用时重新解析
- Runner Secret
- 设备偏好
- 历史 Run

---

## 12. 生命周期和删除规则

- Workspace 使用 Archive，不提供隐式级联删除
- Role 有 Seat 引用时不能直接删除
- Seat 有 Task 引用时，删除前必须明确处理相关 Task
- Workflow Node 删除必须处理所有 Transition 和 Artifact Binding
- OrchestrationVersion 和 RunSnapshot 不可修改
- Run 与 Artifact 默认不可从普通工作界面永久删除
- 真正清理数据是独立历史维护操作，必须显示影响范围并创建 Workspace 级 HistoryDeletionRecord
- 删除 Run 不能删除对应的最小 HistoryDeletionRecord；该记录不保留被删除正文、Terminal 字节或秘密

---

## 13. 并发与保存

首版是单用户本地应用，但仍必须防止异步覆盖：

- Draft 更新携带 `expectedRevision`
- Revision 不匹配时拒绝覆盖并重新加载
- `run.amend`、`run.end_failed` 和其它已有 Run 的用户命令携带 `expectedSequence`；不匹配时拒绝，不合并 operation 或终态决定
- 自动保存按操作批次提交，不按任意组件状态写文件
- 所有命令使用唯一的 `commandId` 去重
- Attention Resolve 只能成功一次
- Event 追加后不修改

---

## 14. 实施约束

以下约束与产品、编排交互和运行操作规格一致，实现必须遵守：

1. Workspace 默认 Runner 可由 Seat 或 Task 高级配置覆盖
2. 首版 Workflow 支持并行、`all/any` Join 和有上限 Rework，不支持任意脚本条件
3. Canvas 拖动只改布局，调整组织归属必须使用明确命令
4. Draft 自动保存，Run 启动时自动创建不可变 OrchestrationVersion
5. 运行中修改通过 Amendment，只允许影响未开始部分
6. 首版 Gate 固定为阻塞 Gate；非阻塞提醒使用 Runtime Event
7. End outcome 和 Optional Task 的 skipped 路径必须显式进入 Snapshot
8. 新 AgentInstance 的执行目录选择由 Runtime 发起带稳定 ID 的请求；Dispatcher 结构化响应，失败不静默回退
