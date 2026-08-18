# M6 Domain Model

**状态**：Draft v1，待产品审阅  
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
- 一个 Task 只有一个负责 Seat
- 一个 Run 以一个不可变 RunSnapshot 启动；Amendment 只能追加新的不可变 Snapshot 后代，不能原地改写
- Run 启动后，Workspace 设置变化不能修改该 Run
- Runner 密钥、Token 和登录态不进入 Workspace 或 Run 文件
- Canvas 坐标不进入 Organization 或 Workflow 业务对象
- Artifact 一旦被下游消费，不允许原地覆盖
- 系统状态使用稳定 code，不使用本地化文字作为业务值
- 动态修改 Run 必须形成 Amendment，不能静默改写快照

---

## 2. 聚合边界

```text
Device
  ├── DevicePreferences
  ├── RunnerInstallation[]
  └── RunnerProfile[]

Workspace
  ├── WorkspaceConfig
  ├── OrchestrationDraft
  │     ├── OrganizationDraft
  │     ├── WorkflowDraft
  │     └── PresentationDraft
  ├── OrchestrationVersion[]
  ├── TemplateReference[]
  └── Run[]

Run
  ├── RunSnapshot
  ├── TaskAttempt[]
  ├── Attention[]
  ├── Artifact[]
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
- 命令包含 `clientOperationId`，用于幂等处理
- Event 包含单调递增的 Run 内 `sequence`

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
```

该对象属于当前设备，不进入 Workspace。

### 4.2 RunnerInstallation

表示当前设备检测到的执行引擎：

```text
runnerId
adapterId
displayName
version?
availabilityStatus
capabilities[]
executablePath?
lastCheckedAt
diagnosticCode?
```

`availabilityStatus`：

```text
available | missing | incompatible | needs_configuration | unsupported_platform
```

### 4.3 RunnerProfile

设备级 Runner 配置：

```text
profileId
runnerId
displayName
nonSecretSettings
secretReferences[]
```

秘密值保存到平台安全存储，`secretReferences` 只保存引用。

---

## 5. Workspace Domain

### 5.1 WorkspaceConfig

```text
workspaceId
name
projectRoot
defaultRunnerProfileId
defaultOutputLocale
createdAt
updatedAt
archivedAt?
```

规则：

- `projectRoot` 必须是用户明确选择且当前平台可访问的目录
- 创建时默认 Runner Profile 必须可用
- Workspace 后续仍可在 Runner 丢失时打开和编辑，但不能启动 Run
- 修改默认 Runner 只影响之后创建的 RunSnapshot
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

Draft 自动持久化，不要求用户依赖手动保存按钮防止数据丢失。

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
toolPolicyId?
defaultOutputContracts[]
```

要求：

- `purpose` 只表达一项主要职责
- Tool Policy 使用允许列表
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
collapsedObjectIds[]
groupVisualOrder[]
```

规则：

- 移动节点只改变 Presentation，不改变父子关系
- 调整归属必须使用明确的 Move 操作
- RunSnapshot 可以保存 Presentation 副本，用于历史 Run 复现
- Zoom、Viewport 和当前选择属于设备会话状态，不进入 OrchestrationVersion

---

## 8. Workflow Domain

### 8.1 WorkflowDefinition

```text
workflowId
name
nodes[]
transitions[]
artifactContracts[]
```

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

### 8.3 TaskDefinition

```text
taskId
name
ownerSeatId
instructions
inputBindings[]
outputContractIds[]
runnerProfileOverrideId?
failurePolicy
timeoutPolicy?
optional
```

`failurePolicy`：

```text
stop_run | wait_human | route_failure | continue_optional
```

`continue_optional` 仅允许 `optional=true` 的 Task；`route_failure` 必须存在匹配的 `failure` Transition。

规则：

- 每个 Task 只有一个 owner Seat
- 多 Seat 协作必须拆成多个 Task 和 Handoff
- Input 绑定 Artifact Contract，不绑定某个平台文件路径
- Task 级 Runner Override 是高级能力；优先级高于 Seat 和 Workspace 默认值

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
artifactBindings[]
reworkPolicy?
```

`trigger` 只允许结构化值：

```text
success | failure | approved | rejected | answered | always
```

来源节点与 trigger 的合法组合：

| 来源 | 允许 trigger |
|---|---|
| Start | `always` |
| Task | `success`, `failure` |
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

---

## 9. Workflow 校验

阻塞错误：

- Start 数量不是一个
- 没有可达 End
- 存在不可达 Node
- Transition 引用不存在的 Node
- Task 引用不存在或禁用的 Seat
- 必填 Input 没有来源
- Output Contract 重复或悬空
- 普通环或无上限 Rework 环
- Join 没有足够的入边
- Gate Action 与出边 Trigger 不匹配
- 来源 Node 与 Transition Trigger 组合不合法
- Gate 的 `blocking` 不是 `true`
- Runner 无法满足 Task capability requirement

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
orchestrationVersionId
organization
workflow
presentation
resolvedRunnerBindings[]
outputLocale
projectRoot
runInput
createdAt
contentDigest
```

Snapshot 是深拷贝业务快照。运行时不得回读 Workspace Draft 推断当前行为。

### 10.2 Run

```text
runId
baseSnapshotId
activeSnapshotId
status
startedAt?
finishedAt?
latestSequence
resultCode?
```

详细状态机见 [m6-run-operations.md](m6-run-operations.md)。

`baseSnapshotId` 永远指向启动版本；`activeSnapshotId` 只在 Amendment 成功后前移。每个 TaskAttempt 记录自己的 `effectiveSnapshotId`，已运行部分不随 active Snapshot 变化。

### 10.3 RunAmendment

运行中调整不直接修改 Snapshot：

```text
amendmentId
runId
baseSnapshotId
reason
operations[]
status
createdAt
appliedAt?
newSnapshotId?
```

首版允许的 Amendment：

- 为未开始 Task 新增 Seat 或 Task
- 禁用尚未参与执行的 Seat；其未开始 Task 必须先重新指派或同时禁用
- 禁用尚未开始且无下游已执行依赖的 Task
- 修改尚未开始 Task 的 instructions 或 Runner binding
- 调整尚未触发的 Gate

禁止修改：

- 已完成或运行中的 Task 定义
- 已产生 Artifact 的含义
- 已经解决的 Gate
- 历史 Event

应用 Amendment 时暂停新 Task 调度，重新校验后创建新 Snapshot 版本并记录差异。

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
- Run 与 Artifact 默认不可从普通 UI 永久删除
- 真正清理数据是独立维护操作，必须显示影响范围

---

## 13. 并发与保存

首版是单用户本地应用，但仍必须防止异步覆盖：

- Draft 更新携带 `expectedRevision`
- Revision 不匹配时拒绝覆盖并重新加载
- 自动保存按操作批次提交，不按任意组件状态写文件
- Run 命令使用 `clientOperationId` 去重
- Attention Resolve 只能成功一次
- Event 追加后不修改

---

## 14. 待产品确认的提案

以下按推荐方案写入，进入实现前需要最终确认：

1. Workspace 默认 Runner 可由 Seat 或 Task 高级配置覆盖
2. 首版 Workflow 支持并行、`all/any` Join 和有上限 Rework，不支持任意脚本条件
3. Canvas 拖动只改布局，调整组织归属必须使用明确命令
4. Draft 自动保存，Run 启动时自动创建不可变 OrchestrationVersion
5. 运行中修改通过 Amendment，只允许影响未开始部分
6. 首版 Gate 固定为阻塞 Gate；非阻塞提醒使用 Runtime Event
