# M6 Architecture and Boundaries

**状态**：Electron生产壳实施前基线（2026-08-21）· 独立审查待完成 · 实现暂停
**范围**：逻辑架构、模块边界、进程边界和数据所有权
**配合**：[m6-product-rebuild.md](m6-product-rebuild.md) · [m6-domain-model.md](m6-domain-model.md) · [m6-events-commands.md](m6-events-commands.md) · [m6-interaction-implementation-slices.md](m6-interaction-implementation-slices.md) · [m6-runner-adapter.md](m6-runner-adapter.md) · [m6-agent-session-collaboration.md](m6-agent-session-collaboration.md) · [m6-execution-workspace-security.md](m6-execution-workspace-security.md) · [m6-local-runtime-scheduling.md](m6-local-runtime-scheduling.md) · [m6-electron-shell.md](m6-electron-shell.md) · [m6-platform-packaging.md](m6-platform-packaging.md)

## 1. 目标

Ensemble 的实现必须支持以下完整路径：

1. 创建 Workspace，并选择项目目录、默认 Runner 和 Agent 输出语言。
2. 编辑组织与 Workflow，保存可复用的编排配置。
3. 从编排配置创建不可变 Run Snapshot。
4. 驱动一个或多个 Runner，持续产生规范化事件。
5. 在画布中观察状态、Handoff、Attention 和 Artifact，并执行人工命令。
6. 通过事件对账恢复运行状态，并在 Windows、macOS、Linux 上以安装包运行。

旧 Canvas、Runtime API、持久化文件和演示协议都不构成兼容约束。

## 2. 逻辑分层

```text
Electron Desktop Shell
  window / native picker / Runtime supervision / platform capabilities / security
        |
Product Client
  workspace / orchestration editor / canvas / inspector / attention
        |
Application Runtime
  domain commands / snapshots / scheduler / events / persistence
        |
Runner Adapters
  probe / start / control / context rendering / terminal / output / artifact collection
        |
Execution Engines
  user-installed pi / Codex CLI / Claude Code
```

进程内还是独立 Backend 不能改变以上逻辑边界。客户端不得直接调用 Runner，Shell 不得承载编排规则，Runner 不得写回组织模型。

## 3. 所有权边界

| 模块 | 负责 | 不负责 |
|------|------|--------|
| Electron Desktop Shell | BrowserWindow、公开平台目录、具名原生选择器、安全边界、签名Runtime监督、typed proxy与更新 | 凭据/secret或Runner账号token语义、PermissionGrant/operation decision、Workflow规则、Node业务Runtime/SQLite/PTY、Runner ownership、Domain/save裁决 |
| Product Client | 编辑器、中央 route/inspection history、画布投影、检查器、用户命令请求状态、临时视图状态 | 持久化真相、Runner CLI、状态机裁决、生成 DiffReviewBundle/ContextPackage/ResultIntegrationAttempt identity |
| Application Runtime | Domain校验、Snapshot、调度、执行目录分配、PermissionGrant策略/operation decision、secret reference、Review校验与不可变Bundle/Context生成、结果整合、命令幂等、事件日志、恢复 | UI布局、平台窗口、具体CLI细节 |
| Rust Platform Adapter | OS安全凭据存储与secret ref解析、sandbox/broker、原生Path与process containment | Domain决策、Renderer/Shell状态、Runner账号token代管 |
| Runner Adapter | 探测、两阶段Attempt启动、消息投递、权限hook执行、暂停/取消、结构化结果和Artifact归集 | PermissionGrant扩大/批准裁决、组织层级、Task依赖、人工Gate |
| Persistence | Workspace、Workflow、Run Snapshot、Runtime State、Artifact 索引 | 颜色、Locale 文案、画布临时选择 |

设备偏好、Workspace 配置、编排配置、Run Snapshot 和 Runtime State 必须分开保存，字段跨边界时先更新对应 SSoT。

## 4. 生产进程边界

生产形态已经选择为单一Electron Shell加随安装包交付的独立Rust Runtime sidecar。Electron Main/Preload负责窗口、托盘、登录启动、系统通知、平台能力、安全边界、签名sidecar监督和typed proxy；Rust Runtime负责Domain、调度、SQLite事件账本、恢复、内置Adapter registry、PTY/ConPTY和Runner进程树。Main在任何Runtime spawn前取得`app.requestSingleInstanceLock()`，Runtime继续对canonical data root持有datastore lock；首版不做多Runtime leader election或双生产壳。完整Shell合同见[m6-electron-shell.md](m6-electron-shell.md)。

关闭窗口只隐藏到托盘，不停止 Runtime。显式退出请求安全暂停；注销或关机执行尽力持久化和进程树回收。Runtime 不是系统服务，也不接受远程连接。完整生命周期和通信决策见 [m6-local-runtime-scheduling.md](m6-local-runtime-scheduling.md)。

原 Python/CrewAI Runtime 和开发服务器只作为 M0-M5 历史实现，不进入 V2 生产形态。

F0 Spike 不再比较进程形态，而是证明所选形态可交付。它必须输出：

- 目标平台的签名Electron安装包、精确Electron/Chromium版本、构建产物和启动命令
- Security-owned BrowserWindow factory/external native confirmation、exact Shell unions、Workspace create original-command对账、byte-credit MessagePort、closed activation/log和fuse final-binary readback证据
- Shell 到 Runtime 的认证和连接方式
- 端口、数据目录、日志目录和资源目录来源
- 关窗到托盘、显式退出、异常退出、注销、关机和重启行为
- 自动登录启动与手动启动竞态、Electron app single-instance、第二实例窗口激活、Runtime datastore lock和stale owner回收
- AttemptLaunch 的 prepare/commit/query、input fence、RunnerResult 归属和回执 Unknown 对账
- RunnerHandleRegistration 生命周期，以及无业务 Attempt owner 时 DispatcherCoordinationLaunch、pending lease、dormant channel 和 reliable commit 激活时序
- Workspace 创建前 RunnerQualification、四档权限、`ask` operation hook 和原生目录授权
- Direct Task 多轮、End outcome、Optional skipped、Run Amendment 和 interrupted/cancel cleanup 的事件重放
- 进程残留检查结果
- 对 Runner Adapter 和测试的影响

在 Spike 关闭前，生产业务实现不得把文档选择当成三平台能力证据。

## 5. 数据流

```text
User action
  -> Client command
  -> Runtime validation and state transition
  -> persisted event + runtime state
  -> event stream
  -> Client projection and transient motion
```

客户端可以立即更新输入控件和布局，但业务状态必须以 Runtime 返回的事件或快照为准。Handoff 动画是事件的表现，不是业务数据源。业务 Event stream 断开只使该 Client projection stale/offline；它不能改变 Runtime 持有的 Run health。`degraded` 必须来自 Runtime 的 canonical 证据，例如必需 Runner Handle/signal channel 不可用、恢复/对账未完成或 cleanup Unknown。

Review/Rework 和结果整合遵守同一所有权方向：Client 只提交结构化 `reviewSelection`，或显式选择 Change Set entries、valid Artifacts 中的一组或两组且合并后至少一项；Runtime 校验引用与 eligibility，生成 DiffReviewBundle、ContextPackage 和 ResultIntegrationAttempt identity，并按 Event 顺序持久化。Client 不发送生成型 bundle/context refs，也不能用本地文件、当前评论状态或“最新 Artifact”补全选择。

Runtime 另提供不写入 Domain Event 的 presentation streams：Agent activity observation、Session streaming delta、Terminal attachment/input-owner lease、Session pagination、Schedule list/occurrence preview 和 shutdown progress。每个 stream 都绑定稳定 Domain identity、projection sequence 或 request identity；Client 不能把它们升级为 Task outcome、Artifact validity、权限或恢复事实。

Agent Terminal 使用与业务 Event 分离的本地数据通道：

```text
Client Terminal -> Shell/Runtime authenticated terminal channel -> Runner Handle -> PTY/ConPTY
```

该通道仍由 Runtime 绑定并授权 AgentInstance，Client 不能获得任意进程句柄或绕过 Runner Adapter。可写 Terminal 还必须持有绑定 client、AgentInstance、registration 和 Handle generation 的短期 input-owner lease；重连和 generation 变化不得恢复旧 lease。Terminal 字节流不写入 Domain Event；Session、Task、Artifact 和 Handoff 仍以 Runtime 持久化对象为准。

Runner 在 Attempt 内请求派生 worker、worker 目录、checkpoint 或权限操作时，使用绑定 Runner Handle generation、AgentInstance、Attempt 和 PermissionGrant 的结构化 Runtime request channel，Attempt 终态后立即失效。formal Dispatcher 的普通业务 Attempt 可以完成；持续目录协调使用单独的 Run-scoped DispatcherCoordinationLease channel，只绑定 lease、Run、AgentInstance、Handle generation、Grant 和 `workspace_selection` scope。两类通道都只接受 Runner Adapter 合同列出的请求类型；自由文本和 Terminal 字节不能触发 Domain 写入。Runtime 校验后才创建 SpawnRequest/SelectionRequest 并追加 Event。

## 6. 模块依赖方向

```text
Shell -> Client transport -> Runtime application -> Domain
                                      |             |
                                      v             v
                                  Persistence   Runner port
                                                     |
                                                     v
                                               Runner adapter
```

规则：

- Domain 不依赖 UI、Shell 或具体 Runner。
- Runtime application 只依赖 Runner port，不导入 `pi` 实现。
- Client 只依赖协议类型和本地视图状态，不复制 Domain 状态机。
- Electron Shell只暴露具名平台/transport能力，不把操作系统判断散落到业务组件，也不承担Node业务Runtime、Runner、PTY或SQLite。
- Preload只暴露一个frozen typed allowlist；Renderer不获得ipcRenderer、Node、Runtime token/port/PID/ready path或结构化绝对路径。
- 所有跨层数据使用稳定 ID，不使用名称、顺序或“第一个可用项”推断语义。

## 7. 生命周期

### 启动

1. Electron Main在任何Runtime spawn前调用`app.requestSingleInstanceLock()`；失败实例只提交typed activation intent并退出。
2. Electron single-instance owner只接受closed`{kind=activate,target?{kind,id}}`，丢弃/不记录raw argv/cwd/path/URL/env/bootstrap值；Security factory注册`app://ensemble`并构造window，Lifecycle只持引用。
3. Main从`process.resourcesPath`签名manifest校验sidecar，创建受限token/ready文件并按F0-A1参数启动；Runtime reconciliation完成后才导航opaque activation target。
4. Runtime 在打开 SQLite 前获取 datastore lock，完成认证、健康检查和协议版本握手。
5. Runtime 对账 supervisor marker、事件账本、执行租约、计划队列和非终态 Run。
6. Client 读取 Workspace 索引和当前 Workspace 快照。
7. Client 建立事件流，再允许发送业务命令。

### 关闭窗口

1. Client 等待编辑命令队列落盘。
2. Shell 隐藏窗口并保留托盘、Runtime 和 Runner。
3. 没有 Client 连接时，Runtime 继续活动 Run、队列和定时计划。

### 显式退出

1. Client 停止接受新的编辑命令。
2. Shell 默认请求“安全暂停并退出”，Runtime 停止计划触发和新派发。
3. Runtime 先选择全部非终态 Run并为每个持久化唯一 `shutdownFenceId`，停止新派发、launch、消息和 operation；不能按是否已有进程过滤。除 idle Direct 外，running Run先进入 pausing。Runtime 独立计算每个 Run 的 process/Unknown set 和 process-free pre-Attempt aggregate set；前者非空时创建 ShutdownRecoveryPlan，并为每个 primary、transient 和 coordination Handle收集 typed ShutdownFenceReceipt。`completed` 证明进程树已不存在；`quiesced` 只证明 fence 后没有新 operation。receipt 必须绑定 RunnerHandleRegistration、Handle generation、fence 和最后 operation sequence。
4. Runtime 冻结适用的 plan、终止 launch/Handle，并在 matching evidence 后终态化 source Attempt、清除 `currentAttemptId`、撤销 target lease和释放资源。`recoverableAttempts[]` 与 `coordinationRecoveries[]` 对 shutdown records 全局互斥；Dispatcher Attempt 与 lease 共用已登记 Handle，或 AttemptLaunch 已 prepare 且 pending lease 已创建但尚无 registration 时，都由 Attempt entry 独占 record并记录 coupled lease。attempt-kind in-flight record 冻结 pending lease IDs，launch termination 撤销 lease 但不改变其恢复 owner。无论是否有 plan，Runtime 都用独立 Event 收敛未被 plan owner 覆盖的 process-free aggregate：阻塞旧 selection、系统终结 open selection Attention、释放 assignment、撤销 Grant、以 `not_started` 终态化 AgentInstance并释放 capacity，再由 TaskExecution Event 释放 claim、清 target refs、保留 pending owner。两类工作全部完成后 Run 才以 `pausing -> paused`、`preparing | resuming -> interrupted`、同状态 completion 或既有 finalization 终态收敛，并追加带 fence、可选 plan ref、`reasonCode=safe_shutdown_completed` 和 `resumeOnStartup=false` 的 `run.status.changed`。全部completion Event durable后才返回acknowledgement；Main随后只结束签名Rust sidecar和Electron自身进程，Runner已由Runtime以matching evidence确认收敛。
5. 超时后 Shell 请求强制 shutdown。Runtime 若仍可响应，由 Runtime 将无法确认的 Attempt 置为 `interrupted`、保留 `resumeOnStartup=true` 并返回 acknowledgement；Electron Main不写Domain状态，也不枚举、终止或重分类Runner child。
6. Runtime不响应时，Main只写supervisor shutdown marker和脱敏诊断，再终止已签名Rust sidecar；不枚举或逐个终止Runner child。Runner进程树由Rust parent-death/platform containment收敛；下次Runtime从marker、账本和进程登记对账并补写`interrupted`状态。

安全退出后的旧 Handle/Launch 已不存在。下次手动 Resume 的 target set 可以同时包含 plan recovery 与同 Run 的 `continue_pre_attempt`。每个 `recoverableAttempts[]` source Attempt 创建新的 AgentInstance、ExecutionWorkspaceAssignment、独立 PermissionGrant、唯一 recovery Attempt 和 target ContextPackage；同一 source Attempt 的 primary/transient Handle 与 in-flight launch 全部从 plan 恢复，不能复用旧实例 ID、旧授权、旧 launch 或为每个 process record 各建一个 Attempt。`continue_pre_attempt` 只要求当前 TaskExecution 没有 plan owner，并创建无 recovery lineage 的普通新实例。idle Direct Handle 不创建 recovery Attempt；其 Run 保持 idle，下一轮消息创建 replacement AgentInstance 和新 AttemptLaunch。recoverable Attempt 携带 coupled Dispatcher lease 时，在同一个 AttemptLaunch 前创建 pending replacement lease和 dormant channel，并由同一个 registration/commit 激活，不创建第二个 Handle。每个 coordination-only recovery 才创建独立 replacement AgentInstance、assignment/Grant、`purpose=dispatcher_coordination` ContextPackage、DispatcherCoordinationLaunch 和 pending lease；旧 lease/token 永不复用，该路径不创建 TaskAttempt 或 RunnerResult。

## 8. 安全边界

- Runtime只监听随机loopback端口；Main持有每次启动的token、port、ready path和PID并代理typed请求，Renderer/Preload不获得这些值。
- 生产Renderer只加载`app://ensemble`；Security owner独占BrowserWindow factory/CSP/navigation/window/permission/external exact allowlist/native confirmation/fuse policy。Lifecycle不能构造window，Platform只执行已授权primitive。
- Workspace-create bridge在dispatch前持久化immutable Domain`commandId`，selection只`bound(commandId)`；lost response/Main restart先query Runtime，避免重复Workspace。Main再解析opaque refs构造未变化Runtime`WorkspaceCreateInput`；FileRoot/PathGrant/save不变。
- Runner 只在已登记的共享 Workspace、Git worktree 或临时隔离目录中执行，并受 PermissionGrant 约束。
- 访问令牌、环境变量和密钥不能写入事件、Artifact、ContextPackage、导出或普通日志；完整秘密由Rust Runtime通过Rust平台适配器写入OS安全凭据存储并只暴露secret reference。Electron Main不读取Runner/account token，也不拥有凭据或secret业务语义。
- Electron Main原生能力只通过具名方法暴露，Client不直接获得任意文件系统或进程权限；Main不能评估/扩大PermissionGrant、批准operation或解释secret reference。
- 网络、外部进程、Workspace 外写入、破坏性命令和外部发布分别使用 `allow | ask | deny`，不能由单一布尔值隐式放开。
- `full_access` 必须持续可见，但不能关闭秘密脱敏或高风险附件提示。
- 具体策略和历史边界以 [m6-execution-workspace-security.md](m6-execution-workspace-security.md) 为准。

## 9. 架构验收

- [ ] 进程边界 Spike 已有三平台证据或明确阻塞项
- [ ] Client、Runtime、Runner、Shell 的依赖方向通过审查
- [ ] Workspace、Workflow、Snapshot、Runtime State 没有交叉写入
- [ ] 事件和命令使用 [m6-events-commands.md](m6-events-commands.md)
- [ ] Runner 接入使用 [m6-runner-adapter.md](m6-runner-adapter.md)
- [ ] AgentInstance、跨 Runner Context package 和 Session/Terminal 共用进程符合 [m6-agent-session-collaboration.md](m6-agent-session-collaboration.md)
- [ ] 执行目录、PermissionGrant、秘密处理和历史保留符合 [m6-execution-workspace-security.md](m6-execution-workspace-security.md)
- [ ] 托盘、后台计划、本机连接、执行租约和风险感知恢复符合 [m6-local-runtime-scheduling.md](m6-local-runtime-scheduling.md)
- [ ] Electron Shell安全、transport、opaque目录、sidecar和owner符合[m6-electron-shell.md](m6-electron-shell.md)
- [ ] 安装、启动、退出、恢复符合 [m6-platform-packaging.md](m6-platform-packaging.md)
- [ ] AttemptLaunch、DispatcherCoordinationLaunch、RunnerHandleRegistration、RunnerResult、目录选择、capacity、PermissionOperation 和 delivery/cleanup Unknown 的对象/Event 顺序可以从账本重放
