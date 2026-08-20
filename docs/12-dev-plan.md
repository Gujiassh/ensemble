# Ensemble V2 Development Plan

**状态**：当前执行计划（2026-08-20）
**产品目标**：优雅、简约的桌面界面，以及灵活、可干预的 Agent 编排
**原则**：先完成契约和架构，再写业务代码；每个阶段都以可验证交付物关闭

## 1. 最终产品路径

```text
创建 Workspace
  -> 配置权限 / 指定目录 / 派生预算
  -> 配置组织与 Workflow
  -> 创建 Run Snapshot
  -> 驱动 Runner 执行
  -> 观察状态 / 协作交接 / 交付结果
  -> 处理 Attention
  -> 完成、重试、打回或恢复
```

产品从第一个真实运行切片开始验证多 Agent。单 Agent 是同一套模型的自然退化路径，不单独建设一套先行 Runtime。Runner、主题、语言、权限和平台能力属于配置或适配边界，不得散落到业务组件中。

## 2. 阶段路线

### F0 · 文档与架构基线（当前）

交付：

- [x] 产品、设计语言、领域模型、编排交互和运行操作规格
- [x] 架构边界与数据所有权：[m6-architecture.md](specs/m6-architecture.md)
- [x] Runner Adapter：[m6-runner-adapter.md](specs/m6-runner-adapter.md)
- [x] Event / Command：[m6-events-commands.md](specs/m6-events-commands.md)
- [x] 跨平台打包 Spike 规格：[m6-platform-packaging.md](specs/m6-platform-packaging.md)
- [x] Agent Session、派生谱系和跨 Runner 协作：[m6-agent-session-collaboration.md](specs/m6-agent-session-collaboration.md)
- [x] 执行目录、权限、秘密和历史：[m6-execution-workspace-security.md](specs/m6-execution-workspace-security.md)
- [x] 本机 Runtime、托盘、调度和恢复：[m6-local-runtime-scheduling.md](specs/m6-local-runtime-scheduling.md)
- [x] 本开发计划与旧 M0–M5 文档归档入口
- [x] 选择 Rust Runtime sidecar、SQLite Event ledger 和本机 authenticated stream
- [x] 冻结 End/Optional/Join、TaskExecution、DispatcherCoordinationLease、SpawnRequest、Run Amendment、Direct Task、AttemptLaunch、RunnerResult、目录选择、权限审批、capacity、历史 tombstone 和 cancel cleanup 协议
- [x] 完成 M6 Runtime Critical 级独立终审并关闭全部 High/Medium finding
- [ ] 完成所选进程形态的三平台 Spike，包括 per-data-root 单实例 lock、第二实例激活、Attempt/Coordination 两阶段 launch 崩溃窗口、按 launch/registration 终止、safe-shutdown 两阶段收敛和 crash 回收

关闭条件：

- 进程形态、per-data-root 单实例所有权、通信方式、数据目录、托盘生命周期、调度和 Runner 分发有书面决策
- Domain、Command、Event、Runner 四份契约通过一致性审查
- 三种执行目录、四种权限档位、派生默认预算和历史保留有可实现字段与平台责任
- 不再有活跃文档把 M0–M5 原型当作 V2 实现入口

### F1 · Desktop Shell 与 Design System

详细实施规格：[f1-shell-design-system.md](specs/f1-shell-design-system.md)。F1-A（F1-01 至 F1-15）负责前端基础，可在 F0 关闭前通过 gateway seam 先行；F1-B（F1-16 至 F1-20）负责 Tauri 与 Runtime 接线，必须等待 F0 完成所选 sidecar 的平台 Spike。

交付：

- Tauri 桌面入口、系统托盘、自动登录启动和 Runtime supervisor（F1 前端先使用 gateway seam）
- 画布优先布局：窄导航、全尺寸画布、按需 Inspector
- Theme、Density、Motion、Contrast 和 Locale 注入
- Workspace 创建：名称、项目目录、Runner、权限/指定目录、Agent 输出语言（F1 负责表单和 gateway；持久化由 Runtime 阶段确认）
- 无 Workspace 时的首次启动路径

关闭条件：

- 不依赖开发服务器即可启动桌面壳
- 浅色、深色、系统主题和两种首发语言可切换
- Workspace 配置与设备偏好分开保存
- 权限摘要和原生目录授权可配置；Runner 只有同时具备 Session、Terminal 和 Context package 才显示为正式支持
- 失败启动、关窗到托盘、显式退出和重启行为可验证

### F2 · Workspace 与 Orchestration Editor

交付：

- Role、Seat、Group、Task、Transition、Gate、Join 编辑
- 多 Task Workflow 的 Dispatcher Task 选择和校验
- 单 Agent、并行、`all/any` 和有限 Rework
- Workflow 校验、Draft 自动保存、冲突提示
- 画布布局移动与层级变更分离
- 编排模板保存、复制和复用

关闭条件：

- 用户可从空 Workspace 创建多 Agent 编排或直接任务
- 用户可创建多 Agent 编排并看到明确的依赖与交付关系
- 保存、重载、冲突和校验结果不会改变业务语义
- 编辑器不写入 Run Snapshot 或 Runtime State

### F3 · Runtime、Runner 与 Run Operations

F3 不采用“先做单 Agent Runtime，再把多 Agent 接上”的路线。它分为四个连续切片，每个切片都使用同一套 Domain、Event 和 Runner 端口。

#### F3-A · 运行底座与 Runner 资格

交付：

- Run Snapshot 创建与冻结
- Runtime 调度、追加式事件日志、命令幂等和状态快照
- NodeExecution、TaskExecution、AgentInstance、TaskAttempt、RunnerHandleRegistration、DispatcherCoordinationLaunch/Lease、SpawnRequest、AttemptLaunch、RunnerResult、Message/Delivery、target ContextPackage、WorkerResult/Delivery、DecisionRecord、Attention、交接、交付结果和 Change Set 持久化
- ExecutionWorkspaceSelectionRequest/Assignment、PermissionGrant、PermissionOperationRequest/DecisionDelivery、capacity reservation、派生策略、原始实例预算和独立恢复代次解析
- 共享 Workspace、Git worktree 和临时目录的创建、冻结基线和清理端口
- Mock、`pi`、Codex CLI 和 Claude Code Adapter；三个真实 Runner 都使用一个 PTY/ConPTY Handle 同时支撑 Session 与 Terminal
- supported Runner 资格测试：Session、Terminal、Context package 缺一不可
- `pauseResume` capability 与同一 Handle 的 pause/resume acknowledgement 契约
- 结构化 `assistant_message` 入库 Agent 回复；流式 delta 与 Terminal transcript 不成为第二套消息真源
- AttemptLaunch 两阶段 prepare/commit/query 让兼容的长期 formal Handle 承载后续 Attempt，并用 RunnerHandleRegistration 封闭进程已创建但 Runtime 丢回执的崩溃窗口
- DispatcherCoordinationLaunch 两阶段启动没有业务 Attempt owner 的 replacement coordination Handle；prepare 前持久化 pending lease 与 dormant channel，reliable commit 后只激活该 lease/token
- pre-registration Unknown 通过原 launch ID/digest 的 `terminate_launch` 收敛；已登记 Handle 通过 registration ID/generation 的 `terminate_handle` 收敛，matching receipt 落盘前不写 stopped 或释放资源
- 指令投递先持久化 delivery ID；回执丢失且无法可靠去重时进入 delivery_unknown，不自动重投
- 绑定 Runner Handle 的 `spawn_request` 结构化 signal 与 canonical SpawnRequest，以及 Runtime 通过 DispatcherCoordinationLease/parent Attempt 发起的 ExecutionWorkspaceSelectionRequest/selection 回执；自由文本和 Terminal 读屏不能触发派生或目录分配
- transient Runner Profile explicit-or-inherit 解析、RunSnapshot allow-list、worker target ContextPackage、return contract 和结构化 result callback

关闭条件：

- RunSnapshot 同时冻结 Runner、目录策略、权限、派生预算和输出语言
- Runtime 在启动任何 AgentInstance 前完成目录与权限校验
- RunnerInstallation availability 与 Workspace/Run RunnerQualification 分开，Workspace 创建前 qualification 不依赖已存在的 Workspace ID
- AttemptLaunch 与 DispatcherCoordinationLaunch 的 prepare/commit/query 和 input fence 能处理 prepare 前、process 已创建但 prepared receipt 未落盘、prepared 后和 commit receipt 丢失窗口；同 ID/digest 去重、不同 digest conflict，且 RunnerResult 不会在 reused Handle 的 Attempt 之间串台
- safe shutdown 覆盖所有非终态 Run，包括没有 Handle/launch 的 preparing、resuming、Gate/Task 间隙以及 paused/idle 状态；只有 process/cleanup candidate 非空的 Run创建 plan，但同 Run 的 process-free aggregate 仍独立收敛。quiesced 不等于 stopped，两类 recovery owner 对 record 全局互斥，双角色 Dispatcher Handle 只创建一个 replacement；每个 Run在两类 cleanup 都完成后追加 `resumeOnStartup=false` completion Event并确认退出
- 三个真实 Runner 的 Session/Terminal 切换不创建第二进程或新 Attempt
- 事件回放能重建 Start/End/Gate/Join NodeExecution、Attempt 前 TaskExecution、RunnerHandleRegistration、Dispatcher CoordinationLaunch/Lease、SpawnRequest、多实例、消息、权限和目录分配投影
- 长期 Seat Session 能从事件恢复用户消息和 Agent 回复，重复 signal 不生成重复 Message
- worker lifecycle 只终结 worker；WorkerResult 回传有稳定 delivery receipt，不能直接终态化父 Attempt

#### F3-B · 首个多 Agent 闭环

固定验收场景：一个小型代码任务，由至少两个 formal Seat 和一个 transient worker 完成。

交付：

- 至少两个 formal AgentInstance 并行执行不同 Task
- 分发 Agent 为每项工作选择目录模式并记录原因
- 至少一个代码修改 Agent 使用独立 Git worktree
- 至少一个 transient worker 由父 Agent 派生，默认 `auto` 批准并遵守预算和继承权限
- transient worker 使用独立 assignment/grant/context，把通过 return contract 校验的 WorkerResult 结构化交还父 Agent
- 成功/失败 End、Optional skipped 路径和 blocked Join 处理都走显式 Node/Transition，不从名称、布局或超时推断
- `pi`、Codex CLI 和 Claude Code 通过 ContextPackage 协作，至少覆盖每个 Runner 作为发送方和接收方
- 三个 Runner 都提供同实例 Session 和 Terminal
- 上游交付结果、选定变更、决策和未解决事项进入下游上下文
- 用户能从 Active Seats 查看组织、来源、Runner、状态和父子谱系
- 文件、Diff 和交付结果可以从 Agent、Task 和 Attention 深链打开

关闭条件：

- 多个 AgentInstance 真正并行，不是串行日志模拟
- 跨 Runner 协作不读取对方终端，也不靠文件名或最近活跃 Agent 猜测
- transient worker 不能扩大父实例权限，且能定位到父 AgentInstance 和父 Attempt
- capacity reservation 在 AgentInstance 创建事务原子占用，目录选择 blocked 和 stopping 期间仍计数，Handle/资源未释放前不能回收 slot
- primary 结束前收敛全部 worker Handle；Run 终态后不能继续后台副作用
- worktree 整合冲突进入 Review/Attention，不静默覆盖目标基线
- 默认 review 的 **应用结果** 和可选 `auto_if_clean | manual` 策略都有完整、无部分写入的结果记录
- supported Runner 的 Session 与 Terminal 都能发送输入、显示状态并保持一个进程句柄
- 同一场景在单 Agent 配置下也能完成，证明它是自然退化而非第二套实现

#### F3-C · 干预、历史与恢复

交付：

- 协作交接、Attention 和交付结果生命周期
- Pause、Cancel、Retry、Rework、Run Amendment、Session instruction 和 Recovery
- 长期 Seat Session、多个 Direct Task/Run 和自由对话
- 文件、Diff 行、交付结果、Task 和 Attention 消息附件
- Workspace/Run 搜索、选择性 Session 导出和完整 Run 导出
- EvidencePin、HistoryExportRecord、HistoryDeletionRecord 及对应审计事件
- Terminal/stdout 30 天、每 Run 100 MB 默认保留和固定证据
- 密钥引用、结构化脱敏、秘密文件隐藏和 Terminal 导出提示

关闭条件：

- 用户可审批、打回、追加指令、重试、调整派生预算和处理权限请求
- `ask` operation 的 approve-once 绑定 request、Handle generation、operation ID 和 digest；unknown receipt 不自动重发批准
- Direct Task 每轮消息创建 Attempt，单轮完成保持 idle；显式结束或冻结 idle timeout 才成功关闭，终态 Run 不复活
- `run.amend` 原子创建 Snapshot 后代且只影响未开始部分；`run.end_failed` 不覆盖 cancel intent 或任何已冻结 finalization outcome
- 长期 Session 中的每条消息都能定位到 Task/Run；搜索、导出和重启恢复不丢归属
- 断线、重复命令和 Runtime 重启不会破坏 Run 账本
- Client 不依赖 Runner 私有日志、终端屏幕解析或前端定时器制造业务状态
- 原始 transcript 达到时间或容量上限时按策略清理，固定证据和 canonical 历史不受影响

#### F3-D · 后台、队列与计划

交付：

- 关闭窗口进入托盘，Runtime 和活动 Runner 继续运行
- 持久化 ExecutionPolicyVersion、RunLaunchSpec、ScheduleLaunchTemplate、Run queue、Schedule 和 ScheduleFire
- 五字段 cron、UTC elapsed interval、IANA timezone、DST gap/fold、evaluation cursor、`skip | latest | all` misfire 和重叠策略
- 默认 `latest` 补跑、`queue_latest` 重叠和有上限的 `all` catch-up
- 后台预授权、阻塞 Attention、脱敏系统通知和点击回到上下文
- SQLite ExecutionClaim、ScheduleFire 幂等和风险感知 recovery Attempt
- RunnerHandleRegistration 生命周期、ShutdownRecoveryPlan 和 coordination-only recovery/launch 对账
- Schedule generation/config digest 与 per-schedule 线性化事务；Queue 使用稳定 comparator 和可回放 reorder 顺序
- formal AgentInstance 默认空闲 30 分钟休眠，transient worker 收尾退出

关闭条件：

- 关闭窗口不会暂停或终止活动 Run；重新打开后通过 Event sequence 对账
- 重复 tick、Runtime 重启和计划补跑不会重复创建 Run
- update/enable/disable/archive/run-now 与 live/catch-up 竞态不会部分创建 fire 或错误推进 cursor；相同 Queue 快照在重启后保持相同领取顺序
- `all` 上限、`queue_latest` 替换和 preparing/run-created 竞争结果可重放
- 无副作用、可验证幂等或有可靠 checkpoint 的工作自动恢复；状态不明的外部副作用稳定暂停并创建 Attention
- checkpoint write-ahead barrier 的各崩溃窗口和并行 operation 都有测试，不能重复非幂等副作用
- Pause/Resume 与 `resumeOnStartup` 在同一事务切换；多 Handle Resume 使用 `resuming` 屏障和反向 re-pause，补偿失败进入 interrupted/degraded，恢复后的 Run 再次崩溃不会被漏掉
- 安全退出计划的 `liveHandles[]` 与 `inFlightLaunches[]` 覆盖 paused、idle Direct、coordination Handle 和无 registration 的 process candidate；attempt-kind in-flight record 冻结完整 `pendingDispatcherCoordinationLeaseIds[]`。`recoverableAttempts[]` 与 `coordinationRecoveries[]` 对每个 handle/launch record 全局互斥。Dispatcher Attempt 与 lease 共用已登记 Handle，或 AttemptLaunch 已 prepare 且 pending lease 已创建但尚无 registration 时，record 都只归 Attempt entry，active/pending lease 写入 `coupledDispatcherCoordinationLeaseIds[]`；pre-registration termination revoke pending lease但保留同一 owner，同一个 recovery AttemptLaunch 和 replacement Handle同时恢复业务与 lease。只有 coordination-only entry 使用独立 DispatcherCoordinationLaunch。每个 replacement 重签 assignment/grant/context，恢复 replacement 不消耗原始谱系计数但受恢复代次限制
- 安全退出先 fence 全部非终态 Run；除 idle Direct 外，running Run先进入 pausing。只有存在 process/cleanup candidate 的 Run创建 plan并收集 typed completed/quiesced evidence；同 Run 内未被任何 plan owner 覆盖的 process-free pre-Attempt aggregate仍按 Event 收敛 selection及其 open Attention、assignment、Grant、旧 AgentInstance、capacity 和 claim，TaskExecution 以 `safe_exit_before_launch` 保留同一 pending owner。Run completion 等待 process/Unknown 与 aggregate cleanup 两类工作；`run.status.changed.resumeTargets[]` 可同时持久化 plan recovery 与 `continue_pre_attempt`，后者只要求当前 TaskExecution 没有 plan owner，并用无 recovery lineage 的新实例继续。每个 Run最终都追加带 fence、可选 plan ref、`resumeOnStartup=false` 的 completion Event；全部 Event durable 后 Shell 只结束 Runtime sidecar/自身进程树
- cancel cleanup unknown 保留 `terminationIntent=cancel`，只能继续 cancel；已有 `finalizationOutcome` 的 interrupted Run 只能继续原 barrier；两者都不存在时才允许业务恢复或明确结束为 `failed/interrupted_ended`
- 显式退出默认由 Runtime 安全暂停并回收进程；确认退出不自动恢复，强制退出、注销、关机和崩溃进入风险对账且不留下无主 Runner
- 没有 Client 连接时，`ask` 不会静默变成 `allow` 或 `deny`

F3 总关闭条件：F3-A、F3-B、F3-C、F3-D 全部通过；单 Agent 冒烟不能替代 F3-B 的多 Agent 证据。

### F4 · 三平台交付

交付：

- Windows、macOS、Linux 安装包
- 安装包内置 Rust Runtime sidecar 和三个官方 Adapter
- Runner 探测、平台目录、日志和进程清理
- 三种执行目录、四种权限档位、凭据存储和 transcript 清理
- 首次启动、真实 Run、重启恢复和卸载验证

关闭条件：

- [m6-platform-packaging.md](specs/m6-platform-packaging.md) 验收矩阵三平台均有证据
- Ensemble Runtime 不依赖系统 Python、Node 或其它开发环境；三个 Runner CLI 由用户安装并原生登录
- 关闭窗口后托盘 Runtime 正常继续；显式退出、注销和关机后没有无主 Runtime/Runner 进程
- `pi`、Codex CLI 和 Claude Code 在三个目标平台全部满足 supported Runner 资格，共九个真实组合

### F5 · 质量与发布

交付：

- 关键 Domain、Protocol、Runner、Persistence 单测
- 三平台桌面冒烟和关键流程 E2E
- 主题、语言、高 DPI、减少动态和键盘流程验证
- 日志、诊断、错误恢复和数据备份说明
- 开源贡献、安装和用户文档

关闭条件：

- 关键用户路径有自动化和真实平台证据
- 没有未审查的跨层兼容代码或隐藏旧协议
- 发行包、数据路径和恢复行为可复现

## 3. 执行顺序

```text
F0 文档/架构
  -> Backend/打包 Spike
  -> F1 Shell/Design System
  -> F2 编排编辑器
  -> F3-A 运行底座
  -> F3-B 多 Agent 闭环
  -> F3-C 干预/历史/恢复
  -> F3-D 后台/队列/计划
  -> F4 三平台交付
  -> F5 质量与发布
```

F1 与 F2 可以在契约关闭后拆分，但协议和核心数据模型只能由一个主责切片维护。F3-A 可在 F2 编辑器完成前用固定的合法 Snapshot fixture 开发；F3-B 验收必须使用 F2 真实创建的编排。F3-B 不能因 Codex CLI 或 Claude Code 接入较慢而退化为多个 `pi` 进程后宣称跨 Runner 完成。F3-D 复用 F3-C 的恢复语义，不能建立第二套后台任务状态。F4 不能用浏览器预览替代。

## 4. 每个阶段的交付规则

每个阶段都必须有：

1. 目标与文件所有权。
2. 可运行或可检查的交付物。
3. 单元测试、协议检查或平台证据。
4. 独立审查和修复记录。
5. SSoT、Spec、Decision 和 Workbench 状态更新。

阶段审查顺序：目标对齐 → 用户路径 → 架构边界 → 数据契约 → 测试与运行证据 → 下一阶段门禁。

## 5. 非目标

- 旧演示 UI、API 和数据迁移
- 生产 Web 版、移动端、账户和多人云协作
- 任意自由表达式流程引擎
- Runner 插件市场
- 只做单 Agent、以后再重写多 Agent Runtime 的阶段路线
- 以聊天窗口替代组织画布
- 在未完成桌面交付前继续堆叠浏览器 Demo 功能

## 6. 当前下一步

M6 Runtime Critical 终审通过后，先执行 [m6-platform-packaging.md](specs/m6-platform-packaging.md) 定义的 F0 Windows/macOS/Linux Runtime、PTY/ConPTY、权限、Runner、单实例、调度与恢复 Spike，并把实证结论写回 [m6-architecture.md](specs/m6-architecture.md)、[m6-local-runtime-scheduling.md](specs/m6-local-runtime-scheduling.md)、Runner Adapter 和平台 SSoT。同时把 [f1-shell-design-system.md](specs/f1-shell-design-system.md) 的 Workspace 权限步骤和 supported Runner 资格补进 F1 重验收范围。之后按 F3-A → F3-B → F3-C → F3-D 实施；首个对外可验收版本不能停在单 Agent 演示或缺少任一官方 Runner。
