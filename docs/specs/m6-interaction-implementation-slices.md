# M6 Interaction Implementation Slices

**状态**：CURRENT · 2026-08-21 Critical-reviewed documentation / implementation-spec baseline · PRODUCT IMPLEMENTATION PAUSED（本文不表示代码已实现或已获实现授权）
**范围**：I1 Shell/Navigation、I2 Organization/Workflow Canvas、I3 Run/Attention、I4 Active Seats/Session/Terminal、I5 Files/Diff/Artifact/Review、I6 Queue/Schedule/Restore

## 1. 文档职责

本规格冻结六个前端切片共同使用的导航、展示状态、动作反馈、焦点、响应式和验收合同。业务对象、状态机和持久化语义继续由以下文档负责：

- [m6-domain-model.md](m6-domain-model.md)：Domain identity、状态和保存边界。
- [m6-events-commands.md](m6-events-commands.md)：Command/Event payload、幂等和并发。
- [m6-run-operations.md](m6-run-operations.md)：Run、Attempt、Attention、退出和恢复。
- [m6-agent-session-collaboration.md](m6-agent-session-collaboration.md)：Seat、AgentInstance、Session、Terminal 和协作。
- [workspace-output-inspection.md](workspace-output-inspection.md)：Files、Change Set、Diff、Artifact 和 Review。
- [m6-local-runtime-scheduling.md](m6-local-runtime-scheduling.md)：Queue、Schedule、通知、托盘和恢复。
- [f1-shell-design-system.md](f1-shell-design-system.md)：Shell 几何、token、主题、语言和基础组件。

Client 不保存新的业务状态，不从名称、数组顺序、最近活动对象、画布位置或 Terminal 文本推断 Domain identity。本文中的 loading、submitting、stale、焦点和返回栈都是展示状态。

## 2. 共享交互合同

### 2.1 根生命周期与连接状态分开

根生命周期固定为：

```text
booting -> restoring_preferences -> checking_backend
checking_backend -> startup_error | runtime_reconciling
runtime_reconciling -> startup_error | no_workspace | workspace_loading
workspace_loading -> ready | startup_error
```

进入 `ready` 后，连接和投影新鲜度独立存在：

```text
connection: checking | connected | reconnecting | disconnected | fatal
freshness:  fresh | stale | reconciling
surface:    idle | initial_loading | ready | empty | unavailable | error
```

- 初次连接失败进入 `startup_error`，不显示旧 Workspace。
- 已进入 `ready` 后断线保留最后投影并标记 stale，不返回启动错误页。
- Event sequence 缺口立即暂停受影响投影，补 Event 或拉 Snapshot；对账前不应用后续局部更新。
- 冷启动期间 Client 根始终停留在 `runtime_reconciling`/只读，直到 Runtime 通过既有 health/reconciliation ready fact确认完整 startup classification barrier：accepted Draft row 以及全部 supervisor marker、launch、delivery、Handle、claim、Attempt 和 recovery owner 都已 durable 分类到 canonical 稳定状态；需要用户动作的项可以是 interrupted/degraded + typed Attention，不要求先解决。accepted Draft row 收敛只是子屏障，不能单独开放 Domain writes。barrier 前只允许 read/query/diagnostics 和内部幂等 reconciliation。
- stale/reconciling 时禁止依赖当前 revision/sequence 的语义写入；冻结 Artifact、历史 Diff 和只读消息仍可查看。
- Run health 的 `degraded` 与 Client connection 的 disconnected 分开展示。
- Workspace 切换先显示新 Workspace identity，再加载其内容；旧选择、错误和检查器不得闪入新 Workspace。

### 2.2 一次只显示一个基础中央工作面

`ready` 下的基础位置使用稳定对象引用：

```ts
type ReadyLocation =
  | {
      kind: "workspace_canvas";
      workspaceId: string;
      mode: "organization" | "workflow";
      runId?: never;
    }
  | {
      kind: "workspace_canvas";
      workspaceId: string;
      mode: "run";
      runId: string;
    }
  | { kind: "workspace_files"; workspaceId: string }
  | { kind: "workspace_agents"; workspaceId: string; runId?: string }
  | {
      kind: "agent";
      workspaceId: string;
      seatId: string;
      view: "session";
      agentInstanceId?: string;
    }
  | {
      kind: "agent";
      workspaceId: string;
      seatId: string;
      view: "terminal";
      agentInstanceId: string;
    }
  | {
      kind: "runs";
      workspaceId?: string;
      tab: "queue" | "schedules";
      selectedId?: string;
    }
  | { kind: "attention"; workspaceId?: string; attentionId?: string }
  | {
      kind: "settings";
      scope: "device";
      workspaceId?: never;
      section?: string;
    }
  | {
      kind: "settings";
      scope: "workspace";
      workspaceId: string;
      section?: string;
    };
```

`workspace_canvas`、`workspace_files`、`workspace_agents`、`agent`、`runs`、`attention` 和 `settings` 互斥占用中央工作面。类型本身排除非法组合：Organization/Workflow 用 `runId?: never` 禁止 Run identity，Run Canvas 必须有 `runId`；Seat 聚合 Session 可以没有 `agentInstanceId`，Terminal 必须绑定精确实例；设备设置用 `workspaceId?: never` 禁止 Workspace identity，Workspace 设置必须携带。Session/Terminal 是同一 Agent 工作面的互斥 Tab，切换不进入全局 Back history，不创建 Attempt，也不重启 Handle。Seat 聚合 Session 只有在用户选择精确 AgentInstance 后才允许进入 Terminal。

File、Diff、Artifact 和 Candidate 使用 inspection location：

```ts
type InspectionTarget =
  | { kind: "file"; rootRef: string; relativePath: string }
  | { kind: "diff"; changeSetId: string; fileAnchor?: string }
  | { kind: "artifact"; artifactId: string }
  | { kind: "artifact_candidate"; artifactCandidateId: string };
```

打开 inspection 时冻结 `originLocation`、中央滚动、Canvas viewport/selection、Inspector section 和 opener focus ref。新 inspection 替换当前 target，但保留最初 origin；Viewer 内文件切换使用独立、有限的内部 history。**Close** 返回最初 origin，**Back** 先遍历 Viewer 内部 history，再遍历基础导航 history，两者不能混为一个动作。

### 2.3 导航入口

全局 rail 固定为 **Workspaces、Runs、Attention、Settings**。Workspace identity 展开后提供 **Organization、Workflow、Run、Files、Active Seats**；这组入口改变中央工作面，不打开永久第二侧栏。

- **Workspaces** 展开 Workspace 选择器；选择后恢复该 Workspace 的安全基础位置。
- **Runs** 打开 Queue/Schedules；默认沿用当前 Workspace filter。
- **Attention** 打开待办列表；选择项目后按 typed refs 深链。
- **Settings** 打开设备或 Workspace 设置。
- **Files** 和 **Active Seats** 是 Workspace context 入口，不放到某个 Agent 下面。
- Seat/Agent、Task、Attention 和 Artifact 可以打开 inspection 或 Agent 工作面，但不得悄悄改变 Workspace filter。

冷启动只持久化 `lastWorkspaceId` 和安全的最后基础位置。设备会话可以按 Workspace 保存 Canvas mode、viewport、selection、列表滚动、Files 展开和 Session 草稿。不持久化 Dialog、菜单、inspection stack、Terminal input lease 或可写 Terminal 恢复。冷启动遇到最后位置是 Terminal 时恢复到同一 Agent 的 Session。

### 2.4 Command 和查询反馈

所有 Domain Command 使用同一 Client request state：

```text
idle
-> sending(commandId)
-> accepted_waiting_event(commandId)
-> applied(eventSequence)
| rejected(code)
| conflict(currentRevisionOrSequence)
| outcome_unknown(commandId)
```

- transport accepted 只表示 Runtime 已把完整 command identity/payload 写入 durable command ledger并接管执行；它不是业务成功。只有 matching causation Event 或包含同一结果的权威 Snapshot 才能进入 applied，并推进 saved/dirty revision。
- 传输中断保留原 `commandId`。Runtime 支持时查询原结果，否则用相同 ID/digest 幂等重放；不能生成新命令掩盖 Unknown。
- sending 只禁用同一语义动作，不冻结导航或丢弃表单输入。
- failure、conflict 和 unknown 在原操作位置显示，不只发 Toast。
- 页面离开后，accepted command 继续由全局 operation registry 跟踪；返回时恢复结果。graceful quit 则必须在 sidecar-wide command-admission fence 建立后，把全部 already-accepted Draft command 排空/对账为 canonical applied/rejected/conflict，不能把“Runtime ledger 以后继续”当作安全退出。
- conflict 保留本地输入。危险动作只允许 Reload/Review 后重新确认，不自动重提。
- 只读查询使用 request identity 和 AbortSignal；旧响应不能覆盖新 route、filter 或 revision。
- Terminal 字节输入不使用 Domain Command 状态机。

### 2.5 Shell 几何、层级和滚动

- Rail 默认 `56px`，展开为临时 `208px` overlay。
- Context bar 目标高度 `52px`。
- Inspector 目标 `320px`、最大 `360px`；`>=1440px` 固定 dock，`1024-1439px` 为无 backdrop 的 non-modal overlay。
- 最小正式窗口 `1024x680`。`<1024px` 只用于开发和可访问性：rail 收起为顶部菜单，Inspector 使用带 focus trap 的全屏 sheet，中央仍只有一个 surface。
- 页面根不产生 document scroll。Rail、中央 surface、Inspector、Viewer sidebar、Session 和 Terminal 各自拥有明确滚动容器。
- 断点切换保持 target、section、scroll anchor 和逻辑焦点。
- 层级从低到高固定为 base surface、docked/overlay Inspector、expanded rail、menu/popover、Terminal fullscreen、Dialog。Dialog 始终最高。
- `Esc` 按可见浮层栈 LIFO 关闭，并返回 opener。Terminal 持有输入权时，普通 `Esc` 先发送给 CLI；关闭全屏或释放输入使用 Shell 的明确逃生动作。

### 2.6 焦点、键盘和可访问性

- 输入框、contenteditable、IME composition 和拥有 input lease 的 Terminal 不触发 Canvas/全局单键快捷键。
- Rail 使用 roving tabindex、可访问名称和 `aria-current`。
- Session/Terminal、Queue/Schedules 使用标准 Tab 语义和方向键。
- Dialog、compact sheet 有 focus trap；ordinary Inspector overlay 没有 focus trap。
- 浮层记录稳定 focus return ref；对象已删除时返回中央 surface 标题。
- 深链完成后焦点进入目标标题或第一个合法动作；失败时进入 unavailable 标题。
- 异步成功和 stale 使用 `aria-live=polite`；连接丢失、权限撤销和不可逆失败使用 assertive alert。
- 状态同时使用图标、形状和文本，不能只靠颜色、动画或脉冲。
- `zh-CN`、`en-US`、伪语言、200% 文本、forced colors 和 reduced motion 是每个切片的共同验收条件。

## 3. I1 Shell and Navigation

### 3.1 Context bar 优先级

从左到右显示 Workspace、基础位置、对象上下文、保存/连接状态和一个主动作。宽度不足时按以下顺序收入 overflow：项目路径全文、次级对象上下文、次级动作；Workspace、当前位置、连接/stale 状态和主动作始终可见。translated label 不得改变中央 surface 尺寸。

### 3.2 Inspector 行为

- Canvas selection、Attention 和列表对象打开 typed Inspector。
- wide dock 始终占固定宽度；ordinary overlay 不缩小中央 surface。
- overlay 外点击在没有 dirty form 时关闭；dirty form 需要 Apply/Discard 确认。
- Close 恢复 opener focus。inspection Viewer 保留来源 Inspector，不把 Inspector 变成第二 router。
- Inspector 关闭不改变 selection 的 Domain 或 Canvas view state；用户再次选择相同对象可以重开。

### 3.3 深链

系统通知和内部链接按以下顺序执行：激活单实例 Shell、完成 Runtime health/reconciliation、读取 typed target、切换 Workspace、打开基础 surface、定位 subject、打开 Inspector/inspection。载荷不含绝对路径、Prompt、正文或秘密。

目标已 resolved 时打开只读结果；Queue Item 已创建 Run 时进入 Run 并显示来源；目标删除、无权限或已清理时保留来源并显示 unavailable/tombstone，不回退到同名当前文件或首页。

### 3.4 I1 验收

1. 冷启动完整经过根生命周期，全程不闪旧 Workspace。
2. Workspace A/B 切换先显示新 identity，分别恢复 Canvas mode、viewport、selection 和滚动。
3. Seat -> Session -> Terminal -> Session 共用同一 AgentInstance/Handle/Attempt。
4. Session -> Diff -> Close 精确恢复 Session、Agent 和滚动。
5. Attention 跨 Workspace -> Diff 行 -> Close/Back 保留来源链。
6. 1440 dock、1280 overlay、1024 minimum 和 compact sheet 切换不丢 target/focus。
7. Event gap、断线、Snapshot 对账期间旧投影明确 stale，状态敏感动作禁用。
8. accepted command 后断线，重连不重复执行并得到 applied/unknown 结果。
9. 全键盘完成 rail、Workspace 切换、中央 surface、Inspector 和返回。
10. Terminal fullscreen 的原生键盘不被普通全局快捷键截获。
11. accepted Draft row 收敛后但其它 marker/launch/delivery/Handle/claim/Attempt/recovery owner 尚未分类时，根仍为 `runtime_reconciling` 且所有 Domain writes 禁用；typed Attention 已 durable 建立后无需等待用户 resolve 即可完成 barrier。

**Owner gate I1**：产品负责人验收 Shell 路由、返回、断点、断线和焦点后，I2-I6 才可以在同一 Shell 上并行扩展。

## 4. I2 Organization and Workflow Canvas

### 4.1 创建和选择

- Canvas toolbar 只有一个显式 **Add** menu。Organization 提供 Role、Group、Seat；Workflow 提供 Task、Gate、Join、End。Start 不可新建或删除。
- 创建表单确认前不产生 Domain object。成功后选择新对象、居中并聚焦名称字段；失败不留下半对象。
- 新对象默认放在当前 viewport 中心；有 selection 时沿主布局方向偏移 `24px`，碰撞时按 `24px` 递增寻找空位。提交时坐标取整为 canvas unit。
- 单击替换 selection；Shift+单击切换成员；空白单击清空。Transition 可单选，Contract/Binding 只在 Inspector 选择。
- `Shift + blank primary drag` 框选完全落入选框的对象；无修饰空白拖动平移。Group 只有标题/可选择边界完整落入时才被框选。
- 点击和拖动阈值 `4 CSS px`。Space+drag 和中键 drag 可从任意位置平移；触控板双指平移、pinch 缩放。

### 4.2 Viewport 和布局

- zoom 范围 `25%-200%`，以 pointer 为中心。Fit 留 `48px` 内边距且不放大超过 `100%`。
- viewport key 为 `workspaceId + mode + focusPath`。
- 对齐吸附阈值 `6px`，Alt 临时关闭。方向键移动 `8px`，Shift+方向键移动 `32px`。
- 多选拖动保持相对位置；Auto layout 只写 Presentation，一次结果是一条原子、可撤销 operation。
- Organization 默认自上而下，Workflow 默认自左向右。
- 展开 Group 时拖动 Group 连同可见后代移动，保持相对位置；普通拖动永不改变 parent。
- ownership 只通过 Inspector/context menu 的 **Move ownership** selector。Group target 为 root/Group；Seat target 为 root/Group/Seat；自身和后代禁用。成功为原子 operation。
- 展开/折叠、focus、zoom、viewport 和 selection 只写设备 `WorkspaceViewState`，不进入 Draft/Version。

### 4.3 连线、Binding 和表单

- port 只在 hover、selection 或 keyboard focus 时显示；视觉直径 `12px`，hit area 至少 `28px`。
- 非法 target 保持可见并使用 `aria-disabled=true`，同时展示和宣告稳定 disabled reason；不能仅改变颜色或从键盘遍历中消失。
- Pointer 释放到合法 target 与键盘选择 target 打开同一 Transition form。表单固定显示只读 source/target，选择 source 合法 trigger；需要交付输入时同时选择现有 Artifact Contract 并创建唯一 ArtifactBinding，或在同一表单中定义新 Contract 和 Binding。
- Transition、可选新 Contract 和 ArtifactBinding 使用一个原子 Draft operation 提交。任一字段、兼容性或 revision 校验失败都不创建半条 Transition、悬空 Contract 或 Binding。
- 相同 `from + to + trigger` 禁止重复；相同 trigger 到不同 target 表示并行，允许存在。
- 表单状态固定为 `view | create | edit | submitting | submit_failed | conflict`。单字段可以 Enter/blur apply；多行和复合修改显式 Apply。
- 关闭 dirty form 需要 Apply/Discard 确认。失败保留输入，`orchestration.draft.applied` 前不把对象写入 canonical Draft。

键盘建图使用完整且与 Pointer 同源的路径：

1. 用户聚焦 source node 的显式 **Connect from this node** action 并按 Enter；系统锁定 source，进入 connection mode，不产生 Draft operation。
2. `Tab` / `Shift+Tab` 按稳定 Canvas object order 遍历全部可见 target，方向键按 Canvas 几何移动；合法 target 和带 disabled reason 的不兼容 target 都可获得焦点，后者使用 `aria-disabled` 而不是从焦点图移除。
3. target 获得焦点时显示 source -> target 预览并宣告兼容性。Enter 只选择合法 target；在不兼容 target 上保持焦点并宣告 disabled reason。
4. 任意 target traversal 阶段按 Esc 取消并把焦点返回 source 的 Connect action；不创建对象、不留下 overlay。
5. 选择合法 target 后打开与 Pointer 路径相同的 Transition form。trigger 只列 source node 允许值；需要 Artifact 输入时，Contract/ArtifactBinding 是提交前必填且显示 producer/consumer compatibility。
6. Apply 发送一个包含 Transition、trigger 和可选 Contract/Binding 的原子 operation。成功 Event 后选择新 Transition并把焦点移到其 Inspector 标题；确定失败聚焦首个错误字段；取消表单返回 source Connect action。

### 4.4 Pending Draft overlay、保存、冲突和撤销

`PendingDraftOverlay` 是 canonical `OrchestrationDraft` 之上的纯展示层，不是第二份 Draft 或可恢复业务真源。以下 fence 是非编译的逻辑 shape；`DraftOperation` 与 `DraftFieldDiagnostic` 必须直接使用 Domain/`packages/protocol` 的 canonical shared types，本文不复制其业务字段：

```text
type DraftProjectionBase = {
  canonicalRevision: number;
  predecessorLocalBatchIds: string[];
};

type DraftBatchValidation = {
  status: "pending" | "valid" | "invalid";
  fieldDiagnostics: DraftFieldDiagnostic[];
};

type LocalDraftBatch = {
  localBatchId: string;
  operations: DraftOperation[];
  observedProjectionBase: DraftProjectionBase;
  validation: DraftBatchValidation;
  formBufferIds: string[];
  stage: "buffered";
};

type PromotedDraftCommand = {
  localBatchId: string;
  commandId: string;
  expectedRevision: number;
  operationDigest: string;
  operations: DraftOperation[];
  formBufferIds: string[];
  stage:
    | "sending"
    | "accepted"
    | "unknown"
    | "save_failed"
    | "conflict";
};

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type DraftFormBufferField = {
  fieldKey: string;
  value: JsonValue;
};

type DraftFormBufferRecovery = {
  formBufferId: string;
  formSchemaKey: string;
  ownerObjectId?: string;
  observedCanonicalRevision: number;
  fieldValues: DraftFormBufferField[];
  updatedAt: string;
};

type ClientDraftRecoveryRecord = {
  schemaVersion: 1;
  journalRevision: number;
  workspaceId: string;
  draftId: string;
  localBatches: LocalDraftBatch[];
  promotedCommand?: PromotedDraftCommand;
  formBuffers: DraftFormBufferRecovery[];
  updatedAt: string;
};
```

- journal 以 `(workspaceId, draftId)` 为唯一 scope key；同一 Workspace 出现新的 Draft identity 时不得复用旧 record。`localBatches[]` 的数组顺序就是 FIFO 顺序，batch/promoted command 通过 `formBufferIds[]` 引用同一 record 内的 buffer；每个引用必须存在且只能属于该 Workspace/Draft。`journalRevision` 在同一 `(workspaceId, draftId)` record 内单调增加，record 与对应全局 operation-registry entry 使用同一原子写批次或 crash-safe atomic replace 持久化到 canonical app-data root。字段输入可以立即显示为 pending local persistence，但只有 durable acknowledgement 后才能标记为可恢复；导航、关窗和正常退出必须等待该 revision flush。
- promoted command 的 `commandId` 同时是全局 operation registry 的稳定索引，完整 scope 为 `(workspaceId, draftId, commandId)`。registry entry 必须持久化 transport classification、最后稳定 result/error code、reconciliation state 和必要时间戳；`PromotedDraftCommand` 持有恢复 overlay/immutable request 所需的 command ID、revision、digest、operations、stage 和 form-buffer association。冷启动若 registry entry 缺失、scope/digest 不匹配或 journal schema 不可读，不能猜测结果或 promotion，必须冻结该 record并显示本地恢复损坏的 needs-action。
- `DraftFormBufferRecovery.fieldValues[]` 只接受 `formSchemaKey` 当前 allow-list 中、构造同一 Draft operation 所必需的 typed field；`fieldKey` 不得重复，`observedCanonicalRevision` 记录表单开始/最近一次可靠 rebase 的 canonical 基线，空/pristine buffer 不落盘。journal 不复制凭据、token、环境变量、secret value、附件正文/blob、文件预览、绝对路径、原生 file handle、Terminal/Session composer draft 或 Runtime response body/header。若已批准的 typed Draft 字段只允许 secret/Artifact 等 opaque reference，则只能保存该稳定 reference。journal、registry、diagnostic 和 telemetry 都不得打印 operations 或 form values；Session 附件/attachment draft 继续由其现有独立 owner管理，不能被通用“保存表单”逻辑扫入本 journal。
- retention 以“仍有未终结本地工作”为准，不使用会静默丢数据的 TTL 或容量淘汰。unsent Undo/明确 Discard 删除对应 batch；matching Event/Snapshot applied 后才删除 promoted command及不再 dirty/被引用的 buffers；明确 rejection 删除 promoted command但保留仍 dirty 的 form buffer；`save_failed | unknown | conflict` 全部保留。确认 Reload 后按既有语义清理旧 command/batch/buffer refs。Reapply 在载入 latest canonical 期间继续完整保留旧 conflict record、operations 和 buffers；确认后用一个 crash-safe atomic journal revision 创建全新 `localBatchId`、写入无 `commandId/expectedRevision/operationDigest` 的 `LocalDraftBatch` 并转移全部相关 buffers，同时删除旧 conflict/local refs。crash 只能看到事务前完整旧记录或事务后完整新 batch，不存在两者都缺失的窗口。clean form close 立即删除其 buffer；`localBatches[]`、`promotedCommand` 和 `formBuffers[]` 全空时删除整个 record。Workspace/Draft 不存在或 scope 不匹配时把 record 标记为 orphaned local recovery，只允许查看 scope摘要并明确 Discard，绝不投影到另一个 Draft；Workspace archive、普通导航、关窗、重启或存储压力都不能单独触发清理。
Runtime 全局 write-ready 与单个 Draft 可编辑是两个连续 barrier。Runtime ready 后，每个 Draft 仍使用纯 Client 展示状态：

```text
draft_recovery_loading_canonical
  -> loading_journal_registry
  -> reconciling_promoted_command
  -> reprojecting_fifo
  -> editable | needs_action
```

hydration 必须按顺序完成：加载 matching canonical Event/Snapshot；加载并校验 `(workspaceId,draftId)` 的 ClientDraftRecoveryRecord 与 `(workspaceId,draftId,commandId)` registry；按原 identity 对账 accepted/sending result；建立 corruption/orphan needs-action；从 canonical Draft 开始按 FIFO 重投影、重校验全部 local batch，并验证最多一个 promoted command。只有完整 hydrated queue 原子发布后，该 Draft 才开放 semantic edit/promotion。新编辑只能追加到已恢复 FIFO 尾部，并继续服从 one-promoted-command rule，不能在旁路临时队列抢先 promotion。corrupt/orphan、unknown 或 conflict record 使该 Draft 保持 `needs_action`/冻结，但不能阻止其它已完成 hydration 的 Draft 或非 Draft ready surface。

- 用户编辑先把既有 `workspaceId + draftId + localBatchId`、typed operations、validation 和完整 form buffer association 写入设备级 Client Draft recovery journal，再进入 ordered `LocalDraftBatch[]` 并更新画面；空闲 `250ms` 内只合并兼容 operation。local batch 只有 `localBatchId`，在 `buffered` 阶段不得预分配 `commandId`、`expectedRevision` 或 digest；本地校验状态和字段诊断只按 `localBatchId` 索引。
- 每个 Workspace 同时最多存在一个 promoted command（one promoted command per Workspace）。ordered overlay 由可选的 `PromotedDraftCommand` 和余下 local batches 组成；新编辑可以继续进入后续 local batch，但前一条 promoted command 未可靠收敛前不得提升第二条。
- 没有 promoted command，或前一条已 applied、被 Runtime 确定 rejected、或被用户明确 Discard 后，Client 必须执行确定性队列提升：先按情况推进或重载 canonical Draft；再按原顺序重新投影全部剩余 local batches；逐条针对新的 canonical revision 重校验；invalid batch 保持本地并以 `localBatchId` 记录字段诊断、不得发送；最后只提升第一条 valid batch。若不存在 valid batch，则保持零条 promoted command。
- 提升必须是本地原子步骤：从 local batch 一次性分配 `commandId`，设置 `expectedRevision = current canonical revision`，并对冻结 operations 计算 `operationDigest`。这三个字段组成 immutable command identity；进入 `sending` 后 Retry、transport reconciliation 和 Event reconciliation 始终复用该 identity，不能修改 revision、digest 或 operations。
- promoted command 只有在 Runtime durable command ledger 已保存完整 identity/payload 后才能进入 `accepted`；从该时刻起，即使用户导航离开或 Client 退出，Runtime 仍负责完成或对账原 command。canonical Draft 只在 matching `orchestration.draft.applied` Event 已按 sequence 应用，或权威 Snapshot 包含相同结果后推进 revision。Command accepted、局部表单成功或动画完成都不能推进 canonical Draft。applied Event 到达后先推进 canonical Draft，再移除 matching promoted overlay；确定 rejection 直接移除 matching promoted overlay，保留独立 form input 和稳定字段错误。两种结果都重新运行确定性提升流程。
- 请求明确未离开 Client 时，promoted command 进入 `save_failed`，保留 immutable command identity、overlay 和 form input。合法动作只有 **Retry** 和 **Discard**：Retry 使用原 `commandId`、`expectedRevision` 和 digest 把同一 command 送回 `sending`；Discard 移除 promoted overlay 并重新运行确定性提升流程。没有保存为 Template 的旁路。
- transport outcome 无法分类时，promoted command 进入 `unknown`；revision mismatch 或 Event revision/sequence 不匹配时进入 `conflict`。两者都保留原 promoted overlay，冻结队列提升和全部新 Draft 写入；`unknown` 只允许按原 command identity Reconcile original，不能用新命令普通 Retry。
- conflict 的合法动作只有 **Reload**、**Review** 和 **Reapply**，不能静默 merge 或开放这三个动作之外的冲突动作。Review 只读取 latest canonical 与仍完整保留的旧 conflict operations/buffers。Reapply 先载入 latest canonical，在旧记录仍存在时完成确认；随后用上述单一 crash-safe journal transaction 把旧 operations/buffers 转移成全新 `localBatchId`、无 command identity 的 `LocalDraftBatch`，并同时删除旧 conflict refs。新 batch 之后才按普通提升流程获得新的 immutable command identity；绝不修改或重放原 command。
- 全局 operation registry 中的 request、transport failure、Retry 和 reconciliation metadata 只按 `commandId` 索引，并与 Client Draft recovery journal 一起 durable flush；local validation metadata 只按 `localBatchId` 索引。两种 identity 不得互相替代，也不得用 operations 内容或数组位置反查。
- Undo 命中尚未发送的 local batch/operation 时只在本地移除，不发送 Command。Undo 命中已经 applied 的 operation 时创建 inverse `LocalDraftBatch`，随后按普通流程提升；`sending | accepted | unknown | save_failed | conflict` 中不对未确认 operation 生成 inverse。新编辑清空 redo。
- Reload 丢弃全部未应用 overlay 前必须确认。任何路径都不能把 overlay 或 Client Draft recovery journal 当成第二份 canonical Draft、重写已 applied revision，或让 invalid local batch 越过校验进入 operation registry。
- 切换 Workspace、打开其它基础 surface 或关闭窗口到托盘都不等待全部 batch 终结。accepted command 继续由 Runtime durable ledger 和全局 operation registry 跟踪；buffered/invalid/save_failed/conflict/unknown overlay 保留在设备级 recovery journal。`unknown | conflict` 只冻结所属 Workspace 的 Draft promotion/写入，并在全局 Attention surface 恢复一个由 operation registry 投影的 Draft needs-action entry；它不是新的 Domain Attention，也不能改变 canonical revision。
- 进程正常退出先等待 Client Draft recovery journal/registry 完成一次 durable flush，但不等待 buffered/local-only batch promotion。随后 Runtime 必须建立 sidecar-wide command-admission fence并排空全部 already-accepted Draft command；只有它们各自得到 canonical applied/rejected/conflict result 才能返回 safe shutdown acknowledgement。任一 accepted command 未收敛时 UI 保持 Continue waiting / Force quit。journal flush 失败时停在退出确认，提供 Retry flush、Return to draft 或明确 Discard local-only records；accepted command 不属于可丢弃集合。Force quit/crash 可以跳过 drain，下一次 startup reconciliation 必须处理原 ledger row。
- 冷启动先保持 Runtime command admission/business write-ready 关闭，直到完整 startup classification barrier 发出既有 ready fact。Runtime 全局 ready 后，Draft surface 仍保持 `draft_recovery_*` 只读：先加载 canonical Event/Snapshot，再加载/验证 journal 与 registry，按原 `commandId` 对账 accepted/sending result；sending 若查无 durable record 则恢复为 `save_failed` 并保留同一 identity。随后建立 corruption/orphan/unknown/conflict needs-action，按 FIFO 重投影和重校验 buffered/invalid batch，验证最多一个 promoted command，最后原子发布 hydrated queue。只有该 Draft 进入 `editable` 才开放新编辑/promotion；corrupt/needs-action Draft 不阻塞其它 ready surface。applied 仍只随 Event/Snapshot推进 revision，journal operations 永远不能显示为 saved。

### 4.5 删除和校验定位

- 删除前调用 Runtime impact preview。Role/Seat/Contract 有引用时阻止；首版没有 Role/Task 停用作为绕过路径。
- Group 只允许“原子提升子项到父级后删除”或先逐项移动。
- Task/Transition 删除列出可达性和 Binding 影响。Dispatcher 删除必须与替代 Dispatcher 同一 operation。
- 提交携带 impact digest 和 resolution plan；影响变化时 conflict，不部分级联。
- 点击 ValidationIssue 依次切换 Organization/Workflow、展开祖先、居中对象、选择、打开 Inspector 并 focus field。
- 悬空引用定位到仍存在的 owner 和修复区。旧 revision issue 不能覆盖当前结果。

### 4.6 I2 状态矩阵

| 状态 | 浏览/选择/平移 | Draft 写入 | Undo/Redo | Start Run |
|---|---:|---:|---:|---:|
| `ready/saved` | 是 | 是 | 按 applied 栈 | 按校验 |
| local `buffered` | 是 | 是；写入 ordered local batches | 未发送 batch/operation 可本地 Undo | 否 |
| local validation `invalid` | 是 | 是；修正或新增 local batch，invalid 不提升 | 可移除未发送 local batch/operation | 否 |
| promoted `sending/accepted` | 是 | 是；只写后续 local batch，不提升第二条 | 只允许后续 local batch 本地 Undo | 否 |
| `unknown` | 是 | 否；先 Reconcile original | 否 | 否 |
| `blocking_error` | 是 | 是 | 是 | 否 |
| promoted `save_failed` | 是 | 否；同 identity Retry 或 Discard 后恢复 | 否 | 否 |
| promoted `conflict` | 是 | 否；Reload/Review/Reapply | 否 | 否 |
| `draft_recovery_loading_* / reconciling / reprojecting` | 只读 | 否；等待该 Draft hydrated queue 原子发布 | 否 | 否 |
| `draft recovery needs_action` | 是 | 否；先处理 corruption/orphan/unknown/conflict | 否 | 否 |
| `initial_loading/stale/disconnected` | 只读 | 否 | 否 | 否 |
| Run projection | 是 | 否；只提供 Amendment 入口 | 否 | 按 Run 状态 |

### 4.7 I2 验收

1. 空组织经 Role -> Seat -> Group 建立合法结构，无悬空对象。
2. 增加第二个 Task 时要求 Dispatcher，失败不留下半节点。
3. Task -> Gate -> Task、parallel -> Join、Rejected -> Rework 可从 source action 经 target traversal、shared form 和原子提交完整用键盘建立。
4. multi-select、marquee、multi-drag、Auto layout 只改 Presentation，Undo 一次恢复。
5. 普通拖动覆盖 Group 不改变 parent；Move ownership 可成功、撤销并拒绝环。
6. Role、Seat、Group、Task、Transition、Contract/Binding 删除逐项验证影响和修复。
7. Contract 变更列出消费者；Binding 缺失/不兼容定位到准确字段。
8. PendingDraftOverlay 验证 `250ms` local batching、每 Workspace 最多一条 promoted command、local batch 无 command identity、提升时原子冻结 immutable command identity、accepted 进入 Runtime durable ledger 但不推进 saved revision、applied/rejected 后按序重投影和重校验、invalid batch 留在本地、`save_failed` 同 identity Retry、`unknown/conflict` 冻结并能在导航/重启后恢复 needs-action、conflict Reapply 以单一 crash-safe journal transaction 保证完整旧 record 或完整无 command identity 新 local batch、Event/Snapshot applied 后才推进 canonical Draft，以及 unsent Undo 与 applied inverse 都不丢失、乱序或推进第二份 canonical Draft；ClientDraftRecoveryRecord 还必须验证 `(workspaceId,draftId)` 隔离、crash-safe journal revision、batch/promoted-to-buffer 完整引用、operation-registry scope/digest 对账、逐状态清理/保留、orphaned record 不误投影，以及 secret/attachment/path/handle/response body 不进入 journal。
9. ValidationIssue 能跨 mode、折叠层级和悬空引用定位。
10. 大 Canvas fixture 在 activity 更新时不重排 selection/viewport。
11. Runtime 全局 ready 后，Draft 仍按 canonical -> journal/registry -> command result -> needs-action -> FIFO reproject/revalidate 顺序 hydration；新编辑只追加到 hydrated FIFO，corrupt Draft 不阻塞其它 ready surface。

**Owner gate I2**：产品负责人完成空 Workspace 编排、保存冲突、删除影响和键盘建图验收后，F2 才算具备业务实现入口。

## 5. I3 Run Controls and Attention

### 5.1 Run 动作矩阵

| Run 状态/意图 | 主动作 | 次级动作 | 表达 |
|---|---|---|---|
| `created` | 无 | 无 | Preparing，不显示非法 Cancel |
| `preparing` | Preparing | Cancel startup | 失败显示诊断 |
| `running` | Pause | Change remaining work、Cancel | Pause 无确认 |
| `running` Direct | End task | Pause、Cancel | 活动轮结束后关闭 |
| finalization frozen | Finishing | Inspect | 隐藏 Pause/Amend/Cancel |
| `pausing` | Pausing | Cancel | 显示 Handle 边界，不伪造百分比 |
| `paused` | Resume | Change remaining work、Cancel | Attention resolution 标记 deferred |
| `resuming` | Resuming | Cancel | 显示 target 与补偿状态 |
| `canceling` | Canceling | Inspect | 不可撤销，不接收业务动作 |
| `interrupted` recoverable | Resume | End as failed、Cancel | 三者互斥提交 |
| interrupted + cancel intent | Continue cancellation | Inspect cleanup | 禁止业务 Resume/End failed |
| interrupted + finalization intent | Continue finalization | Inspect cleanup | 禁止覆盖 outcome |
| terminal | Re-run | Results/history | 创建新 Run，不复活原 Run |

### 5.2 Attempt 动作矩阵

| Attempt/TaskExecution | 动作 |
|---|---|
| `pending/ready/starting` | Inspect；不显示 Retry/Skip |
| `running` | Session、Terminal、Inspect；Pause 仍是 Run 级 |
| `waiting_attention` | 只显示关联 Attention `allowedActions[]` |
| `pausing/paused` | Inspect；没有 Attempt 级 Resume |
| `succeeded` | Artifact、Diff、Review/Rework；无 Retry |
| failed 且 TaskExecution 终态 | Rework 或 descendant Run；不复活 |
| source Attempt 终态、TaskExecution 仍 waiting | Retry |
| `skipped/canceled` | 只读历史 |
| `interrupted` | 由 Run Resume/recovery 处理 |

### 5.3 确认和反馈

- Pause/Resume 不需要确认。点击后锁定同一动作，等待 canonical Event。
- Cancel 必须确认，显示活动 Task 数和已有 Artifact 数；accepted 后不可撤销。
- Retry 不弹第二个 modal，但在原位说明旧 Attempt 保留、新 pending retry 将创建；提交时锁定整个 Attention action group。
- Rework 使用 Review confirmation，显示 target、Change Set、评论、Snapshot 结果和迭代数。
- **Change remaining work** 展示 old/new Snapshot 和受影响的未开始项，再确认。
- End as failed 要求 reason，并展示活动资源和保留 Artifact。
- Skip optional 只在 Optional + 显式 skipped Transition 时出现，确认下游路径。
- Fail Run 展示 failure code、将终止的分支和保留结果。
- submitting 后焦点留在触发动作；成功进入 resolution/new target 标题，失败进入 inline error。

### 5.4 Attention 检查器

每种 Attention 都先显示 subject identity、最后可靠证据、影响对象和允许动作。动作只能来自 Runtime `allowedActions[]`。

| Kind | 主要证据 | 合法结果 |
|---|---|---|
| `approval` | Gate、请求者、Artifact、Diff | Approve/Reject |
| `question` | 问题、来源 Task/Message、context | Answer |
| `exception` | result code、Attempt、RunnerResult、Contract | Retry/Skip/Fail/Amend and Rework |
| `join_blocked` | Join 缺失输入与来源分支 | Retry/Rework source/Fail |
| `long_wait` | elapsed、policy、最后可靠 activity | Keep waiting/Reconcile |
| `spawn_approval` | parent、Profile、目录、权限、预算 | Approve/Reject |
| `staffing_request` | Seat/Task/Snapshot 和预算影响 | Approve/Reject |
| `workspace_selection_blocked` | request、modes、path constraints | Retry/Choose mode/Fail task |
| `permission_operation` | operation digest、Grant、expiry | Approve once/Reject |
| delivery Unknown kinds | delivery identity 和 receipt evidence | Inspect/Acknowledge/显式新 delivery |
| launch Unknown kinds | launch、registration、generation evidence | Reconcile/Terminate original |
| `cleanup_unknown` | typed resources、intent、receipts | Retry/Record evidence/Continue intent |
| `result_integration_unknown` | selected refs、target、journal evidence | Inspect/Reconcile original |
| `recovery_operation_unknown` | operation checkpoint、副作用证据 | Record completed/not completed、Fail/Cancel |
| `launch_blocked` | Queue Item、LaunchSpec、原因 | Retry/Update config/Cancel item |

`permission_operation` 只处理当前 immutable PermissionGrant 内已经标为 `ask` 的同一 operation；Approve once 不能添加 Allowed path、改变 capability policy 或替换 Grant。活动工作需要更大路径/capability 时，UI 必须进入 exception Attention 的 **Amend and Rework**，展示旧/新 Snapshot 和新 TaskExecution/AgentInstance/Grant；不显示热扩 Grant 或用 Approve once 继续原工作。

两个窗口同时 resolve 时只有一个 compare-and-set 成功；另一窗口转为只读 resolution，不显示普通 retry error。expired/superseded Attention 保留结果和 replacement link，不从历史消失。

### 5.5 长等待与通知

- 有可靠 activity：Attempt 保持 running，显示 elapsed、last observed、evidence level 和下一观察时间。
- policy=observe：后台 reconcile，不打断用户。
- policy=attention：创建 `long_wait`，默认 Keep waiting；不表现为 failure。
- liveness unknown：显示 unknown/Reconcile，不开放自动 Retry。
- 通知只含 opaque target；已 resolved 打开处理结果，目标不可用进入 typed unavailable。

### 5.6 I3 验收

1. 全部 Runner 可暂停时完整进入 paused；mixed capability 不出现部分假 paused。
2. Resume 部分失败会反向补偿；补偿 Unknown 进入 interrupted。
3. Cancel 确认显示 Task/Artifact；cleanup Unknown 只剩 Continue cancellation。
4. interrupted recoverable、cancel intent、finalization intent 三组动作互斥。
5. exception Retry 原子成功和 provisioning 失败都不复活旧 Attention。
6. Optional Skip 合法/非法两组按钮可见性正确。
7. Rework 同 Run/descendant Run 按 Runtime plan，不能绕过 Workflow。
8. paused Run 处理审批显示 deferred，Resume 后才投递。
9. permission_operation 的 Approve once 不扩大 Grant；活动工作请求更大路径/capability 只显示 Amend and Rework，并创建新 immutable Grant。
10. 双窗口 Resolve 只有一个结果。
11. long wait 可靠活动继续运行，Unknown 等待核对。
12. event gap/stale 时状态敏感动作禁用，对账后恢复。
13. keyboard、screen reader、200% text、reduced motion 完成 Pause、Cancel 和 Resolve。

**Owner gate I3**：产品负责人验收 Pause/Resume、Cancel、Attention 类型处理和 Unknown 保守行为后，F3-C 干预能力才能关闭。

## 6. I4 Active Seats, Session, and Terminal

### 6.1 Active Seats 列表

- 默认 Group by 为 Organization；Group/Seat 使用稳定组织顺序，不因 Activity 更新跳位。
- Group by 支持 Organization、Run、Origin、Runner、Activity。不同 filter 维度 AND，同一维度多值 OR。
- Activity 分组顺序为 blocked、working、unknown、idle、done。
- Seat 行展开 AgentInstance；transient worker 放在 parent Attempt 下。Spawn lineage 与 Recovery lineage 分开展示。
- Seat click 打开没有 `agentInstanceId` 的 Seat 聚合 Session；AgentInstance click 打开精确实例 Session。多个当前实例时必须选择，不猜最近实例。
- Activity、Task outcome、Run health 和 AgentInstance lifecycle 分栏显示。

### 6.2 Agent 工作面

Agent 工作面必须区分 Seat 聚合 Session 和精确实例 Session：

```ts
type AgentHeaderState =
  | {
      scope: "seat_aggregate";
      seatId: string;
      agentInstanceId: null;
      terminalAvailability: "requires_instance_selection";
    }
  | {
      scope: "agent_instance";
      seatId: string;
      agentInstanceId: string;
      runId: string;
      attemptId?: string;
      terminalAvailability: "available" | "unavailable" | "frozen";
    };
```

Seat 聚合 header 显示 Seat identity、活动/历史实例数量和明确的 **All instances** scope；timeline 按 Run、AgentInstance 和 Attempt 分段，不能把多个实例的 Runner、Activity、Run health 或 composer target 合并成一个当前值。实例 selector 始终可用，当前有多个实例时不默认选择最近或唯一看似活跃的实例。

精确实例 header 显示 Seat、AgentInstance、Run、Attempt、Runner、Activity 和 Session/Terminal tabs。Session timeline 按 Event sequence 排序，每个 Attempt 有开始、结果、耗时和 Retry/Rework/Recovery boundary。只有精确实例 scope 可以显示 Terminal tab；从聚合 Session 请求 Terminal 时先打开 instance selector，用户选择后 route 才变成 `view=terminal + agentInstanceId`。没有合法实例时保持聚合 Session并显示 disabled reason。

设备端按 Seat 聚合或实例 route 分别恢复 selected tab、Attempt filter、timeline anchor、composer draft、attachment draft 和 Terminal scroll；切换 Agent 不创建 Attempt。Runtime crash 后旧实例保持冻结历史，新 recovery instance 通过 lineage 打开。

### 6.3 Composer

Composer 明确选择：

```text
kind:   Message | Instruction
target: Current attempt | Next attempt | New direct task
```

- Current attempt 只在精确 AgentInstance、Runner capability、活动 Attempt 和 Terminal input owner 允许时可选；Seat 聚合 Session 必须先选择实例和 Attempt。
- Next attempt 首版只允许 Instruction，显示 queued，不显示 delivered；不提供撤回/替换，更正通过追加。
- 没有活动 Run 时进入 New direct task confirmation，不能先创建无归属 Message。
- 附件显示类型、来源、冻结版本、权限和 validation；失败保留 draft。
- `delivery_unknown` 不显示普通 resend；只允许对账，或创建引用原 Message 的新 Attempt message。

### 6.4 流式回复

presentation stream 通过 `streamId + attemptId + handleGeneration + segmentSequence` 排序。canonical Message 到达时按 `sourceSignalId + attemptId` 原位替换占位。sequence gap、reconnect 无法补齐、Attempt/generation 改变时丢弃临时文本并重载 ledger；delta 不写历史或形成第二条回复。

### 6.5 Terminal

- Terminal route 必须携带 `agentInstanceId`；Seat 聚合 Session 不能创建 Terminal channel、恢复 input lease 或猜测实例。Terminal state 固定为 `connecting | live | reconnecting | disconnected | frozen | retained_readonly | transcript_unavailable`。
- focus 可写 Terminal 前申请 input-owner lease；同一 Handle generation 只有一个 client owner。
- 切回 Session、detach、disconnect、generation change 或 expiry 释放 lease。重连重新申请。
- retained Terminal 只读，显示到期、capacity 和 Grant 仍占用；transient、coordination-protected Handle 不显示 Retain。
- 原生 ANSI、cursor、slash command、selector、Ctrl-C 和 fullscreen TUI 原样工作；这些字节不直接改变 Domain。
- Session/Terminal 切换不创建第二 process、AgentInstance 或 Attempt。

### 6.6 I4 验收

1. 同 Seat 两个 Run 先显示不混淆状态的聚合 Session，再能经 instance selector 准确打开指定 AgentInstance；未选择实例不能进入 Terminal。
2. 切换 Agent 后恢复 Session scroll、draft 和 attachments，没有新 Attempt。
3. 流式回复只出现一次，reconnect 不把 delta 写历史。
4. Terminal 取得输入权后 Session 禁止发送；释放后 draft 恢复。
5. 不支持实时投递时只允许 queued next instruction。
6. delivery unknown 不自动重发，新 Message 保留 source ref。
7. retained Handle Terminal 只读、显示 expiry/capacity/permission。
8. Spawn 和 Recovery lineage 分别定位原 instance、Attempt 和 Event。
9. 托盘恢复不改变 Run；Runtime crash 不复用旧 instance ID。
10. keyboard/screen reader 完成分组、instance 选择、tab 切换和发送。

**Owner gate I4**：产品负责人验收 Agent 定位、长期 Session、流式替换、Terminal 原样交互和输入互斥后，Runner 才可标记为产品级 supported。

## 7. I5 Files, Diff, Artifact, and Review

I5 按阶段拆成两个不重叠交付面。**I5-B** 属于 F3-B，负责 Files、冻结 Diff Viewer、Candidate/Artifact 和 ResultReviewRequest/Apply/Reject；**I5-C** 属于 F3-C，负责行内 Review thread、DiffReviewBundle 和 Rework。I5-C 不得为了提前实现评论而抢占 I5-B 的 Result Review 或 shared gateway ownership。


### 7.1 Files

Files 左侧固定 **Tree | Changed**。Project 和每个 Allowed Path 分别保存展开、搜索和滚动；Allowed Path 显示 Workspace/Run/Agent Grant 来源、access、scope 和 expiry。

- search 只匹配 filename 和 relative path，按 root 分组；首版不做 content search。
- status filters 内部 OR；Run/Attempt/Agent scope 与 status filters 之间 AND。
- source 为 shared/unknown 时如实显示，不分给最近 Agent。
- root state 为 initial loading、ready、refreshing、stale、offline、forbidden、error；目录级失败只影响该节点。
- watcher overflow 保留 stale cache；rescan 只锁该 root，保留仍存在的展开路径。
- Grant 撤销立即清空当前 file content/search hits；冻结 Diff/Artifact 按历史读取合同处理。
- list/open/search/external-open 每次规范化 path 并检查 containment。Symlink 越界不跟随，full access 不自动浏览整盘或秘密文件。

### 7.2 Viewer 和 Diff

- V1 只有一个中央 Viewer，不做 tabs。identity 使用 typed ref，route 不含 absolute path。
- Viewer 内 Back 返回上一文件，Close 返回最初 origin。
- Changed files 按 root 分组，支持 path search、status filter、stats 和 rename old/new path。
- 首次 wide 默认 Split，ordinary/compact 默认 Unified；用户 preference 优先。切换保留 file/hunk/line/thread。
- folded context 显示 hidden line count，支持 expand block/all。
- Backend 返回 Diff cursor、loaded/total budget、complete/truncated。Client 不读 current file 拼历史 Diff。
- Binary、undecodable、oversized 不能创建 line thread，只显示 metadata、external open 和 overall Rework note。
- deleted file 的 frozen Diff 可读，current File Viewer 显示 deleted。

### 7.3 Review thread 和 Rework

- click line gutter 打开 composer；首评和 thread 原子创建，不能留下 empty thread。
- Comment immutable；修正通过 append。Resolved 必须 Reopen 才可评论。
- create/add/resolve/reopen 都是 line-local submitting，canonical Event 前不乐观更新。
- CAS conflict 重读 thread；已达到目标 status 时显示 actor/time。
- outdated 只在新 Change Set 派生，提供 **Open original Diff**，不迁移相同行号。
- `Cmd/Ctrl+Enter` 提交，Esc 取消；IME composition 不触发。
- Rework 只能选择同一 Change Set 的 open threads，每个 thread 至少一条 comment。
- Runtime eligible target plan 决定 same-run legal rejected target 或 descendant Run。提交冻结 selected comments、related valid Artifacts 和 event sequence。
- 成功定位新 TaskExecution并提供 old/new Change Set comparison；旧 thread 不自动 resolve。

### 7.4 Candidate 和 Artifact

- Attempt 的 **Result intake** 显示 Candidate pending validation、promoted、invalid、conflict。
- invalid Candidate 显示 ValidationRecord/diagnostics，不进入 Deliverables、Handoff 或 Gate。
- Deliverables 只显示正式 Artifact、version、currentness、producer、consumers 和 Candidate/Validation trace。
- blob missing/digest mismatch 是 Viewer integrity error，不改 Contract validation。

### 7.5 Result integration

| Action | 条件 | 成功 | 失败/Unknown |
|---|---|---|---|
| Apply result | `git_worktree \| temporary_directory`；`resultReviewRequestId` 为 `review_requested` 且尚无 integration attempt；`selectedChangeSetEntryRefs[] ∪ selectedArtifactRefs[]` 非空；entry refs 如有则来源和完整性有效；Artifact refs 如有则为 `valid`、完整且适配 target；target 可验证 | Runtime 创建新 ResultIntegrationAttempt 并 integrated | drift/conflict Attention；Unknown 对账原 attempt |
| Reject | ResultReviewRequest 为 `review_requested`，且没有非终态 Apply attempt | request rejected，保留证据；不创建 ResultIntegrationAttempt | conflict 后刷新 |
| Review later | 不改变 Domain | 关闭 Viewer，保持 review requested | 无新 disposition |
| Open external | path 存在且授权 | 本地 Shell action | inline platform error |
| Retry integration | 仅旧 `ResultIntegrationAttempt.status == failed` | 新 command ID 和新 attempt；`retryOfIntegrationAttemptId` 指向旧 failed attempt | 不重放或改写旧 command/attempt |

`execution.result.review_requested` 先由 Runtime 创建持久化 ResultReviewRequest 和稳定 `resultReviewRequestId`；Client 不生成该 identity。Apply 使用 union non-empty selection：file-only、Artifact-only 和 combined selection 对 `git_worktree` 与 `temporary_directory` 都合法；两组都空时禁用并由 Runtime 拒绝。两类隔离模式都分别校验实际存在的 refs，Client 不隐式补选。`shared_workspace` 永不显示 Apply。

Retry only from `failed`：ResultIntegrationAttempt 为 `requested | staging | reconciling | integration_unknown | integrated` 时均不显示 Retry；ResultReviewRequest 已为 `integrated | rejected` 时也不显示 Apply。`integration_unknown` 只允许 Inspect/Reconcile original；只有对账把原 attempt 可靠分类为 `failed` 后才显示 Retry，并创建全新的 command ID 和 ResultIntegrationAttempt。

### 7.6 I5-B 验收（F3-B）

1. 10 万文件 root 的 lazy load/search/refresh 不阻塞 Run Event；Project/Allowed Paths 独立，Grant 撤销后 current content 立即不可读。
2. watcher overflow、rescan failure、symlink escape、secret file、large/binary/rename/deleted/undecodable 都有确定且安全的状态。
3. 从 Seat/Artifact/Attention 打开证据后 Back/Close 精确恢复来源；Unified/Split 保留 file/hunk/line。
4. invalid Candidate 不进入 Deliverables；valid Candidate 唯一追溯 Artifact。
5. `execution.result.review_requested` 创建稳定 ResultReviewRequest；用户在未 Apply 时可以只用 `resultReviewRequestId` Reject，且不会创建 ResultIntegrationAttempt。
6. `git_worktree` 与 `temporary_directory` 分别验证 file-only、Artifact-only 和 combined selection；两组都空时不能提交，创建后的 Apply selection 不可修改；已有 failed attempt 后只能 Retry 原 selection，不能改选后发起第二个首次 Apply。
7. ResultIntegrationAttempt 为 `requested | staging | reconciling | integration_unknown | integrated` 时不显示 Retry；`failed` 才显示。Unknown 对账为 failed 后 Retry 创建新 command ID、新 attempt 和正确 `retryOfIntegrationAttemptId`，仍属于同一 ResultReviewRequest。
8. target drift、integration crash 不产生 partial/duplicate apply；request 已 integrated/rejected 后不能再次 Apply。
9. Windows/macOS/Linux、keyboard、screen reader 和双语言完成 Files、Diff、Candidate/Artifact 与 Result Review。

**Owner gate I5-B**：产品负责人验收文件定位、冻结 Diff、Candidate/Artifact 区分、ResultReviewRequest 初始 Reject 和隔离结果应用后，F3-B 的结果检查闭环才关闭。

### 7.7 I5-C 验收（F3-C）

1. thread 首评原子创建；双 Client Resolve/Reopen 只有一个 compare-and-set 成功。
2. old thread 在新 Change Set 显示 outdated，并能返回原 Diff；不按相同行号迁移。
3. Rework 冻结 selected comments；提交后新评论不进入 Bundle。
4. invalid target/iteration 在 Runtime eligible plan 阶段排除，Client 不能猜 target。
5. Windows/macOS/Linux、keyboard、screen reader 和双语言完成行内 Review/Rework。

**Owner gate I5-C**：产品负责人验收不可变行内评论、DiffReviewBundle 和合法 Rework 后，F3-C 的 Review/Rework 能力才关闭；I5-B 通过不能替代本门禁。

## 8. I6 Queue, Schedule, Quit, and Restore

### 8.1 Runs 信息架构

Runs 是全局目的地，中央使用 **Queue | Schedules**。默认 current Workspace filter；All workspaces 只读分组。对象选择使用现有 Inspector，不增加永久第三栏。

Queue row 显示 source、Workspace、frozen version、status/reason、created time 和 order。Schedule row 显示 required name、Workspace/version、trigger/timezone、next occurrence、last occurrence、enabled 和 blocking Attention。

### 8.2 Queue 动作

| Status | Reorder | Cancel | Primary |
|---|---:|---:|---|
| `queued` | 是 | 是 | Inspect LaunchSpec |
| `preparing` | 否 | 是 | Inspect progress |
| `blocked` | 否 | 是 | Resolve Attention |
| `run_created` | 否 | 否 | Open Run |
| `canceled` | 否 | 否 | History |

Reorder 只在单 Workspace、unfiltered Queue 中进行。Client 提交 before/after anchor，不生成 priority。drag 之外提供 Move up/down/top/bottom icon actions。与 scheduler claim conflict 时整个 reorder 不应用，focus 保留原 item。

Cancel/Run create 竞争只显示一个终点：Cancel 胜出显示 canceled；Run create 胜出立刻显示 run created 和 **Open Run**，不能先显示成功取消再反转。

### 8.3 Schedule form 和动作

Schedule form 连续分为：

1. Identity/source：required name、OrchestrationVersion、input/Runner/output locale 摘要。
2. Timing：Cron/Interval segmented control、IANA timezone、Runtime future 5 occurrences preview。
3. Missed runs：skip/latest/all；all 显示 `maxCatchUpRuns`，范围 `1..100`、默认 10。
4. Overlap：queue latest/skip/allow parallel。
5. Permissions/review：等于或收紧 Workspace ceiling，显示版本、occurrences、权限和 enabled。

Client 不计算 Cron/DST/interval normalization。Runtime 返回 field errors、canonical expression、UTC anchor、timezone 和 occurrence preview。设备 timezone 映射失败时要求显式选择 IANA timezone。

| Schedule | Edit | Enable/Disable | Run now | Archive |
|---|---:|---:|---:|---:|
| enabled | 是 | Disable | 是 | 是 |
| disabled | 是 | Enable | 是 | 是 |
| archived | 否 | 否 | 否 | 否 |

Disable 不取消 Queue/Run，Enable 从当前 instant 建 cursor，不补禁用期间。Archive 不可逆，需要确认并保留历史。generation conflict 保留 form，提供 Reload latest/Review changes，不静默 merge。

### 8.4 页面状态和通知

Queue/Schedules surface 为 initial loading、ready empty/nonempty、reconnecting stale、offline、projection error。动作沿用共享 command state。断线保留 stale list 并禁用所有修改。

首版系统通知只覆盖 blocking Attention 和后台来源 Run 的 failed/interrupted；成功完成不发通知。notification target 使用 typed opaque refs，点击只导航。OS permission 关闭时应用内 Attention count 仍是真源。

### 8.5 Quit

Quit 先执行 Draft durability preflight，但不等待任何 Workspace 的全部 Draft batch 终结：Client durable flush 全局 operation registry 与 Client Draft recovery journal。随后通过既有 Runtime shutdown control 建立 sidecar-wide command-admission fence；Runtime 在同一 writer/admission 屏障等待已进入 admission 临界区的请求完成 accepted/rejected/conflict 判定，从此拒绝所有新 Domain command，稳定 code 为 `runtime_shutting_down`，只继续 read/query 和原 command reconciliation。

fence 生效后，Runtime 扫描 durable command ledger 中全部 accepted 且没有 terminal result 的 Draft command，逐条用原 `commandId + expectedRevision + operationDigest + operations[]` 幂等重新派发/对账。只有每条都得到 matching applied Event，或 durable rejected/conflict result，Draft drain 才完成；transport accepted 本身不算完成。该 drain 与全部 Run shutdown barrier 都完成后，Runtime 才返回 safe shutdown acknowledgement。

有 active Run 时 Quit 显示：

```text
Pause safely and quit
Cancel runs and quit
Back
```

没有 active Run 时也不能直接绕过 Runtime：只有 journal/registry flush、sidecar-wide admission fence和 accepted Draft command drain 全部完成后才退出；Queue/Schedule 保留到下次启动。建立 shutdown fence 后进入不能 Back/Esc 取消的 progress surface，逐 Run 显示 Fencing、Waiting for Runner、Reconciling、Safe、Needs verification。

现有 30 秒 shutdown wait 同时覆盖 Run 收敛与 accepted Draft drain；任一未收敛时只显示 **Continue waiting** 和 **Force quit**，不得返回 safe acknowledgement。Force quit可以绕过drain，明确说明下次启动在write-ready前对账；Electron Main只写supervisor marker/脱敏诊断并终止owned Rust sidecar，不枚举/kill/reclassify Runner child，也不显示安全暂停。Cancel runs and quit 逐 Run 收敛，不伪装跨 Workspace 原子动作。

### 8.6 Restore

| Canonical fact | 用户动作 |
|---|---|
| resume on startup、全部 operation 可分类 | 自动恢复，显示 progress；可 Cancel |
| safe-exit paused | Resume/Cancel |
| interrupted、无 intent | Resume/End as failed/Cancel |
| interrupted + cancel intent | Continue cancel |
| interrupted + finalization intent | Continue finalization |
| operation side effect unknown | Resolve recovery operation Attention |
| ledger/projection 无法对账 | Diagnostics/Retry reconciliation；业务只读 |

UI、conversation、process、Terminal transcript 和 business operation 分别显示恢复结果。Terminal transcript 可读不代表 process 或 operation 已恢复。

### 8.7 I6 验收

1. queued reorder 后重启，领取顺序不变。
2. reorder 与 scheduler claim 竞争整批 conflict。
3. cancel 与 Run create 竞争只呈现一个终点。
4. Cron DST gap/fold preview 与 Runtime 一致。
5. Interval timezone change 不改变 UTC anchor；anchor change 正确重算。
6. disabled Schedule Run now 可用，普通 tick 不触发。
7. Enable 不补禁用期间；trigger update 不按旧定义补跑。
8. Archive 后无 future fire，旧 Queue/Run/history 可访问。
9. repeated Run now 同 command ID 只有一个 ScheduleFire。
10. background permission block 产生 Queue Attention，通知精确定位。
11. resolved notification 显示结果，Queue 已启动进入 Run。
12. close to tray 不改变 Run/Queue/Schedule。
13. safe quit 先 durable flush Draft recovery/registry，再建立 sidecar-wide command-admission fence；全部 already-accepted Draft command canonical applied/rejected/conflict、全部 Run receipt durable 后才退出并写 resume false，不要求 buffered/local-only batch promotion。
14. accepted Draft drain 或 Run cleanup 超过 30 秒时不返回 safe acknowledgement；Continue waiting/Force quit 两条路径可验证，零 active Run 也执行同一 Draft drain。
15. force quit/crash 后重启在 write-ready 前扫描 accepted ledger rows，按原 commandId/payload 幂等重新派发/对账；unknown operation 等待用户。
16. safe-exit paused Run 不自动恢复。
17. disconnect 时 list stale/read-only，reconnect 按 sequence 补齐。
18. Windows/macOS/Linux 验证 tray、notification activation、single instance 和 restart。
19. accepted Draft command 导航离开后继续由 Runtime ledger处理；graceful quit 必须 drain，force quit/crash 后 startup 必须重放原 row。重启恢复 buffered、save_failed、unknown/conflict，且 saved revision 只随 Event/Snapshot推进。

**Owner gate I6**：产品负责人验收 Queue/Schedule、托盘退出、通知深链和风险恢复后，F3-D 才能关闭。

## 9. 实施顺序与交付边界

### 9.1 阶段门禁

切片只能在当前已打开阶段内并行，不能把“文件不重叠”当作跨阶段提前开工许可。固定顺序为：

```text
I1 Shell owner gate
  -> F2 / I2 Orchestration Editor owner gate
  -> F3-A Runtime foundation owner gate
  -> F3-B multi-Agent + I4 + I5-B owner gates
  -> F3-C I3 + I5-C + history/recovery owner gates
  -> F3-D I6 Queue/Schedule/Quit/Restore owner gate
```

- I1 关闭 shared Shell、route、request registry、focus stack 和 shared async state 后，F2 才能实施 I2。
- F2 关闭真实编排创建、Draft 保存/恢复和 Snapshot 输入后，F3-A 才打开 Runtime/Runner 基础。
- F3-A 关闭 shared Domain/protocol、持久化、gateway 与 Runner 资格后，F3-B 才能并行实施 Agent workspace 和 I5-B。
- F3-B 的多 Agent/Result Review 闭环通过后，F3-C 才能并行实施 I3 干预与 I5-C 行内 Review/Rework。
- F3-C 的干预、历史和恢复语义通过后，F3-D 才能实施 I6。任何 I6 页面原型都不能被计作已打开 F3-D 实施。
- F0/F0-A1 与全部产品实现当前仍暂停；本表只规定未来获授权后的顺序，不构成开工授权。

### 9.2 文件、包与命名空间所有权

本节是当前实施文件所有权的唯一来源。历史`docs/13-multi-agent-workflow.md`、旧壳spec和旧review只保留历史证据，不得覆盖本表。计划目录在对应阶段首次实现时创建；不得另建平行协议包、第二套gateway、双production wrapper或Node业务Runtime。

| 单一owner | 阶段 | 独占路径或计划命名空间 | 责任与禁止交叉 |
|---|---|---|---|
| Renderer Shell owner | I1；后续串行接线 | `apps/canvas/src/App.tsx`、`apps/canvas/src/app-shell/**`、`apps/canvas/src/inspector/InspectorShell.tsx` | route、全局operation registry、focus stack和Shell layout；不实现Electron bridge或feature业务规则 |
| Canvas Electron gateway owner | F1-A/F1-B；后续串行接线 | 精确文件`apps/canvas/src/runtime-gateway/electron-gateway.ts` | 消费frozen Preload bridge并适配Canvas ports；不导入Electron、不访问ipcRenderer、不生成Domain identity |
| Workspace entry owner | F1-A | `apps/canvas/src/workspace/**` | Workspace form、opaque selection view state和gateway port；不解析raw path或写Runtime persistence |
| Shared Shell protocol owner | F0-A2起持续单owner | `packages/protocol/src/shell/**` | 纯typed bridge method/envelope/stream/NativeDirectorySelection DTO与closed-schema validation；不得另建Shell-contract package，不包含Domain/save状态 |
| Shared Domain contract owner | F3-A起持续单owner | `packages/protocol/src/**`但排除`packages/protocol/src/shell/**`；计划`crates/ensemble-runtime/src/domain/**`与`crates/ensemble-runtime/src/persistence/schema/**` | Command/Event/Domain DTO、schema version和migration；Shell DTO变化不能越权改变Domain/save合同 |
| Electron Main lifecycle owner | F0-A2/F1-B | `apps/desktop/src/main/lifecycle/**` | app events、window/tray引用、single-instance/closed ActivationIntent和quit orchestration；消费Security BrowserWindow factory，禁止`new BrowserWindow`、webPreferences、preload path或loadURL配置 |
| Electron platform owner | F0-A2/F1-B | `apps/desktop/src/main/platform/**` | 只执行已授权具名primitive：picker、notification和最终one-shot`electron.shell.openExternal`；不拥有external allowlist/native confirmation、BrowserWindow policy或业务状态 |
| Electron Runtime supervisor owner | F0-A2/F0-A3 | `apps/desktop/src/main/runtime-supervisor/**` | `process.resourcesPath`签名sidecar、F0-A1 bootstrap和process supervision；不搜索PATH，不枚举/kill Runner child |
| Electron Runtime client owner | F0-A2/F1-B | `apps/desktop/src/main/runtime-client/**` | 持有token/port/ready path/PID并代理authenticated loopback；不泄露bootstrap值或裁决Domain结果 |
| Electron IPC router owner | F0-A2/F1-B | `apps/desktop/src/main/ipc-router/**` | expected webContents/main frame/origin/method/schema/limits/request identity和具名handler；无generic channel |
| Electron stream bridge owner | F0-A2/F1-B | `apps/desktop/src/main/stream-bridge/**` | MessagePort exact byte-credit、frameByteLength、contiguous ack、4MiB outstanding/8MiB queue/30s pause、cancel/stale/slow；不验证业务Terminal权限 |
| Electron security owner | F0-A2/F0-A3 | `apps/desktop/src/main/security/**` | 独占BrowserWindow factory/construction、preload path/configuration、production URL、`app://ensemble`/CSP、navigation/window/permission、external exact allowlist/限速/native confirmation和fuse policy |
| Electron updater owner | F0-A3 | `apps/desktop/src/main/updater/**` | signed atomic Shell+sidecar update和protocol/version compatibility；不绕过Runtime safe quit |
| Electron Preload owner | F0-A2/F1-B | `apps/desktop/src/preload/**` | 唯一递归frozen typed allowlist与MessagePort转交；不暴露ipcRenderer/Buffer/fs/process/env/generic channel |
| Electron package/test owner | F0-A2/F0-A3 | `apps/desktop/test/**`、`apps/desktop/electron-builder.yml`、该app manifest | integration/security/package/installed IME-a11y tests、ASAR/integrity/extraResources、按Security policy执行pinned fuse flip/readback、signing/notarization；不定义Main/fuse policy |
| I2 Orchestration owner | F2 | `apps/canvas/src/canvas/**`、计划`apps/canvas/src/orchestration/**`及同目录tests | Organization/Workflow/Draft overlay和view state；只消费shared ports，不编辑Shell/Electron/Runtime Domain |
| Runtime foundation owner | F3-A | 当前`crates/ensemble-runtime/src/{auth,cli,data_root,error,ready,runtime,server,shutdown}.rs`；计划`transport/**`、`persistence/core/**`、`application/runtime_core/**`、`adapters/**` | Runtime lifecycle、ledger、core dispatch和Runner ports；`domain/**`仍由Shared Domain contract owner串行合入 |
| I4 Agent workspace owner | F3-B | 计划`apps/canvas/src/agents/**`；计划`crates/ensemble-runtime/src/application/execution/**` | Active Seats、Session/Terminal projection和multi-Agent execution；不编辑Electron stream bridge或output/review |
| I5-B Output/Result owner | F3-B | 计划`apps/canvas/src/output/{files,viewer,integration}/**`；计划`crates/ensemble-runtime/src/application/result_review/**`、`persistence/result_review/**` | Files、Diff viewer、Candidate/Artifact、ResultReviewRequest与ResultIntegrationAttempt；不实现line review/Rework |
| I3 Intervention owner | F3-C | 计划`apps/canvas/src/{run-operations,attention}/**`；计划`crates/ensemble-runtime/src/application/intervention/**` | Run controls、Attention和permission/recovery action；不编辑output viewer或scheduler |
| I5-C Review/Rework owner | F3-C | 计划`apps/canvas/src/output/review/**`；计划`crates/ensemble-runtime/src/application/diff_review/**` | line thread/comment、DiffReviewBundle和Rework；只通过Shared Domain contract owner请求DTO变化 |
| F3-C History owner | F3-C | 计划`apps/canvas/src/history/**`；计划`crates/ensemble-runtime/src/application/history/**`、`persistence/history/**` | 搜索、导出、EvidencePin、HistoryExport/Deletion和tombstone内容治理；不编辑shared schema |
| I6 Scheduling owner | F3-D | 计划`apps/canvas/src/runs/**`；计划`crates/ensemble-runtime/src/application/scheduling/**`、`persistence/scheduling/**` | Queue、Schedule、notification、quit/restore projection；复用Runtime recovery，不创建第二状态 |
| Shared test-infrastructure owner | 每阶段串行 | `apps/canvas/src/test-support/**` | 通用render/fixture基础；feature tests默认与owner namespace同目录 |

Electron各owner路径互不重叠。Security owner构造并返回已完成全部安全配置的BrowserWindow；Lifecycle只持引用和编排app event，不能构造/配置window。Security owner完成external policy与native confirmation后，Platform只执行最终one-shot primitive。跨owner调用只经过Shared Shell protocol或已冻结port，不为方便把Main lifecycle、platform、supervisor、runtime-client、router、stream/security/updater合并成单个大模块。

Result Review纵向所有权固定为：Shared Domain contract owner维护非Shell protocol中的`resultReviewRequestId`/command/event DTO与Runtime domain；I5-B owner维护Runtime result-review application/persistence和Canvas integration；Canvas Electron gateway owner只在精确`electron-gateway.ts`接入typed port。任何lane都不能在Client生成identity、在feature目录复制DTO，或让Reject fallback到`integrationAttemptId`。

同阶段多lane需要shared App、gateway、protocol或schema变化时，先由对应单一owner串行提交shared slice，其它lane再继续；不得并行编辑同一文件。

### 9.3 每切片交付

每个切片都必须同时交付：

- typed route/request/view state；
- 组件和 Runtime gateway boundary；
- unit/component tests；
- 至少一个真实 interaction artifact（screenshot、DOM/state snapshot、network/event trace 或 flat log）；
- 本节全部 acceptance scenario；
- Owner 可直接操作的验收入口。

前端实现不能修改 Domain schema 来适配局部组件，也不能以 Mock fixture 的字段形状替代本规格。Backend/Runtime 可以在当前已打开阶段内并行实现已冻结 payload 和 projection，但任何跨层变更必须同步 Domain、Command/Event、交互规格和测试。
