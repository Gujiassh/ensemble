# M6 Architecture and Boundaries

**状态**：实施前基线（2026-08-20）
**范围**：逻辑架构、模块边界、进程边界和数据所有权
**配合**：[m6-product-rebuild.md](m6-product-rebuild.md) · [m6-domain-model.md](m6-domain-model.md) · [m6-events-commands.md](m6-events-commands.md) · [m6-runner-adapter.md](m6-runner-adapter.md) · [m6-agent-session-collaboration.md](m6-agent-session-collaboration.md) · [m6-execution-workspace-security.md](m6-execution-workspace-security.md) · [m6-local-runtime-scheduling.md](m6-local-runtime-scheduling.md) · [m6-platform-packaging.md](m6-platform-packaging.md)

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
Desktop Shell
  window / filesystem / process lifecycle / platform capabilities
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
| Desktop Shell | 窗口、平台目录、凭据存储、权限执行、进程生命周期、原生选择器 | Workflow 规则、运行调度、节点业务状态 |
| Product Client | 编辑器、画布投影、检查器、用户命令、临时视图状态 | 持久化真相、Runner CLI、状态机裁决 |
| Application Runtime | Domain 校验、Snapshot、调度、执行目录分配、权限解析、命令幂等、事件日志、恢复 | UI 布局、平台窗口、具体 CLI 细节 |
| Runner Adapter | 探测、两阶段 Attempt 启动、消息投递、暂停/取消、结构化结果和 Artifact 归集 | 组织层级、Task 依赖、人工 Gate |
| Persistence | Workspace、Workflow、Run Snapshot、Runtime State、Artifact 索引 | 颜色、Locale 文案、画布临时选择 |

设备偏好、Workspace 配置、编排配置、Run Snapshot 和 Runtime State 必须分开保存，字段跨边界时先更新对应 SSoT。

## 4. 生产进程边界

生产形态已经选择为随 Tauri 安装包交付的独立 Rust Runtime sidecar。Tauri 进程负责窗口、托盘、自动启动、系统通知、平台能力和进程监督；Runtime 负责 Domain、调度、SQLite 事件账本、恢复和内置 Adapter registry。Runner CLI 由用户安装并作为 Runtime 的受控子进程运行。同一 canonical data root 只能有一个持有 OS 原子 lock 的 supervisor 和一个持有 datastore lock 的 Runtime；首版不做多 Runtime leader election。

关闭窗口只隐藏到托盘，不停止 Runtime。显式退出请求安全暂停；注销或关机执行尽力持久化和进程树回收。Runtime 不是系统服务，也不接受远程连接。完整生命周期和通信决策见 [m6-local-runtime-scheduling.md](m6-local-runtime-scheduling.md)。

原 Python/CrewAI Runtime 和开发服务器只作为 M0-M5 历史实现，不进入 V2 生产形态。

F0 Spike 不再比较进程形态，而是证明所选形态可交付。它必须输出：

- 目标平台的构建产物和启动命令
- Shell 到 Runtime 的认证和连接方式
- 端口、数据目录、日志目录和资源目录来源
- 关窗到托盘、显式退出、异常退出、注销、关机和重启行为
- 自动登录启动与手动启动竞态、第二实例窗口激活转交、supervisor/datastore lock 和 stale owner 回收
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

客户端可以立即更新输入控件和布局，但业务状态必须以 Runtime 返回的事件或快照为准。Handoff 动画是事件的表现，不是业务数据源。

Agent Terminal 使用与业务 Event 分离的本地数据通道：

```text
Client Terminal -> Shell/Runtime authenticated terminal channel -> Runner Handle -> PTY/ConPTY
```

该通道仍由 Runtime 绑定并授权 AgentInstance，Client 不能获得任意进程句柄或绕过 Runner Adapter。Terminal 字节流不写入 Domain Event；Session、Task、Artifact 和 Handoff 仍以 Runtime 持久化对象为准。

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
- Shell 只暴露平台能力，不把操作系统判断散落到业务组件。
- 所有跨层数据使用稳定 ID，不使用名称、顺序或“第一个可用项”推断语义。

## 7. 生命周期

### 启动

1. Shell 解析 canonical data root，并在访问业务数据前原子获取该 root 的 supervisor lock。
2. 获取失败的第二实例通过 OS 本机 IPC 请求现有 Shell 激活窗口后退出，不能继续 bootstrap。
3. lock owner 读取设备偏好和平台能力，生成会话令牌并启动 Runtime sidecar。
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
4. Runtime 冻结适用的 plan、终止 launch/Handle，并在 matching evidence 后终态化 source Attempt、清除 `currentAttemptId`、撤销 target lease和释放资源。`recoverableAttempts[]` 与 `coordinationRecoveries[]` 对 shutdown records 全局互斥；Dispatcher Attempt 与 lease 共用已登记 Handle，或 AttemptLaunch 已 prepare 且 pending lease 已创建但尚无 registration 时，都由 Attempt entry 独占 record并记录 coupled lease。attempt-kind in-flight record 冻结 pending lease IDs，launch termination 撤销 lease 但不改变其恢复 owner。无论是否有 plan，Runtime 都用独立 Event 收敛未被 plan owner 覆盖的 process-free aggregate：阻塞旧 selection、系统终结 open selection Attention、释放 assignment、撤销 Grant、以 `not_started` 终态化 AgentInstance并释放 capacity，再由 TaskExecution Event 释放 claim、清 target refs、保留 pending owner。两类工作全部完成后 Run 才以 `pausing -> paused`、`preparing | resuming -> interrupted`、同状态 completion 或既有 finalization 终态收敛，并追加带 fence、可选 plan ref、`reasonCode=safe_shutdown_completed` 和 `resumeOnStartup=false` 的 `run.status.changed`。全部 completion Event durable 后才返回 acknowledgement，Shell 随后只结束 Runtime sidecar/自身进程树。
5. 超时后 Shell 请求强制 shutdown。Runtime 若仍可响应，由 Runtime 将无法确认的 Attempt 置为 `interrupted`、保留 `resumeOnStartup=true` 并返回 acknowledgement；Shell 不写 Domain 状态。
6. Runtime 不响应时，Shell 只写 supervisor shutdown marker 和脱敏诊断，再按平台规则终止进程树。下次 Runtime 从 marker、账本和进程登记对账，由 Runtime 补写 `interrupted` 状态并进入风险感知恢复。

安全退出后的旧 Handle/Launch 已不存在。下次手动 Resume 的 target set 可以同时包含 plan recovery 与同 Run 的 `continue_pre_attempt`。每个 `recoverableAttempts[]` source Attempt 创建新的 AgentInstance、ExecutionWorkspaceAssignment、独立 PermissionGrant、唯一 recovery Attempt 和 target ContextPackage；同一 source Attempt 的 primary/transient Handle 与 in-flight launch 全部从 plan 恢复，不能复用旧实例 ID、旧授权、旧 launch 或为每个 process record 各建一个 Attempt。`continue_pre_attempt` 只要求当前 TaskExecution 没有 plan owner，并创建无 recovery lineage 的普通新实例。idle Direct Handle 不创建 recovery Attempt；其 Run 保持 idle，下一轮消息创建 replacement AgentInstance 和新 AttemptLaunch。recoverable Attempt 携带 coupled Dispatcher lease 时，在同一个 AttemptLaunch 前创建 pending replacement lease和 dormant channel，并由同一个 registration/commit 激活，不创建第二个 Handle。每个 coordination-only recovery 才创建独立 replacement AgentInstance、assignment/Grant、`purpose=dispatcher_coordination` ContextPackage、DispatcherCoordinationLaunch 和 pending lease；旧 lease/token 永不复用，该路径不创建 TaskAttempt 或 RunnerResult。

## 8. 安全边界

- Runtime 只监听随机 loopback 端口；生产连接使用每次 Runtime 启动生成的会话认证，并由 Shell 代理给 Client。
- Runner 只在已登记的共享 Workspace、Git worktree 或临时隔离目录中执行，并受 PermissionGrant 约束。
- 访问令牌、环境变量和密钥不能写入事件、Artifact、ContextPackage、导出或普通日志；完整秘密存入平台凭据存储。
- Shell 原生能力通过显式命令暴露，Client 不直接获得任意文件系统和进程权限。
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
- [ ] 安装、启动、退出、恢复符合 [m6-platform-packaging.md](m6-platform-packaging.md)
- [ ] AttemptLaunch、DispatcherCoordinationLaunch、RunnerHandleRegistration、RunnerResult、目录选择、capacity、PermissionOperation 和 delivery/cleanup Unknown 的对象/Event 顺序可以从账本重放
