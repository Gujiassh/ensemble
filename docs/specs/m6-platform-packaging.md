# M6 Cross-Platform Packaging Spike

**状态**：进程形态已选；三平台 Spike 证据待补（2026-08-20）
**平台**：Windows、macOS、Linux
**目标**：证明 Rust Runtime sidecar、托盘生命周期和三个用户安装的 Runner 可以组成一个可运行产品

## 1. 不可妥协的要求

- Ensemble 安装包不要求系统 Python、Node、pnpm 或仓库依赖；`pi`、Codex CLI 和 Claude Code 由用户自行安装和登录。
- 应用使用平台原生应用目录保存配置、Workspace、Run、Artifact 和日志。
- Runtime 只绑定 loopback，并使用单次会话认证。
- Shell 能可靠启动、健康检查、重启和清理 Runtime；关窗到托盘时不能误停后台任务。
- 同一 canonical data root 只有一个 supervisor/Runtime；自动登录启动与手动启动竞态必须激活现有窗口，不能生成第二个 scheduler 或并发打开 SQLite。
- Runner 探测结果能区分可用、缺配置、版本不兼容和平台不支持。
- 交互式 Runner 的 Terminal 在 Windows 使用 ConPTY、在 macOS/Linux 使用 PTY 或经验证的等价能力；Session/Terminal 切换不能启动第二个 CLI。
- 平台层能执行四种权限档位、原生多目录授权、凭据存储和秘密脱敏；无法执行的限制必须在探测时报告。
- 共享 Workspace、Git worktree 和临时隔离目录在三平台使用原生 Path/Git 能力创建、登记和安全清理。
- `pi`、Codex CLI 和 Claude Code 必须分别在三个平台通过完整 supported Runner 资格，共九个真实组合。
- Runtime 能持久化队列和定时计划；停止期间错过的计划按明确 misfire policy 恢复。

## 2. 已选择的交付形态

生产使用随安装包交付、单独签名的 Rust Runtime sidecar。Tauri 进程作为 supervisor 并在系统托盘中保持运行；Runtime 通过随机 loopback 端口提供认证命令、事件和 Terminal 通道。完整边界见 [m6-local-runtime-scheduling.md](m6-local-runtime-scheduling.md)。

F0 不再比较 Rust 进程内、Python sidecar 和开发服务器三条路线。Spike 必须证明选定形态在三个平台成立；失败时回到产品决策，不增加隐藏回退 Runtime。

## 3. Spike 工作项

### Shell 生命周期

- 让 Runtime 绑定 loopback `port=0`，由操作系统原子分配端口，再通过 bootstrap channel 回报实际端口
- 在 bootstrap 前用 OS 原子 supervisor lock 建立 per-data-root 单实例；Runtime 打开 SQLite 前再获取 datastore lock
- 第二实例通过 OS 本机 IPC 激活现有窗口后退出；验证 Shell/Runtime crash、stale metadata 和 datastore lock 的有界回收
- 生成至少 256 bit 的会话令牌，并通过非命令行的受限启动通道传给 Runtime
- 等待健康检查和协议版本确认
- Runtime 异常时显示可操作错误
- 关闭窗口时隐藏到托盘，并保持 Runtime、Runner、队列和计划工作
- 托盘显式退出时默认请求 Runtime 安全暂停并持久化；Runtime 先为全部非终态 Run 建立 durable shutdown fence。只有存在 process/cleanup candidate 的 Run 才保存 typed completed/quiesced evidence 并冻结 ShutdownRecoveryPlan，再终止 in-flight launch 和 quiesced Handle；同 Run 内未被 plan owner 覆盖的 process-free pre-Attempt aggregate 仍按独立 Event 收敛。只有 matching stopped evidence、aggregate cleanup 与其它资源清理全部落盘，并为每个 Run 追加 `resumeOnStartup=false` completion Event 后，Runtime 才能返回 shutdown acknowledgement
- 超时强制退出时 Shell 只请求 Runtime 对账；Runtime 不响应则写 supervisor shutdown marker 后终止进程树，由下次 Runtime 补写 interrupted 状态
- 注销、关机、Runtime 崩溃和 Shell 崩溃后没有无主 Runner，并能在下次启动对账
- Windows 使用 Job Object 或经证明的等价机制，macOS/Linux 使用进程组与父进程失联检测；Runner 的子进程也必须进入受控回收范围

### 路径与数据

- 解析资源目录、配置目录、数据目录和日志目录
- Workspace 项目路径使用原生 Path API 原样保存
- 安装目录保持只读
- 日志不包含令牌、密钥和完整环境变量
- 凭据只保存到操作系统安全存储，业务文件只保存 secret reference
- selected paths 使用原生目录选择器并保留 read/write 授权

### Runner 分发

- `pi`、Codex CLI 和 Claude Code Adapter 都能报告安装位置、版本范围、原生登录状态和平台能力
- 三个 CLI 均使用用户已有安装；Ensemble 不下载、升级或保存其账号 Token
- Adapter 随 Runtime 交付，不加载第三方 Adapter 或本地插件目录
- 不可用 Runner 不阻塞诊断页和其它 Workspace 配置
- 在 Workspace 创建前用表单 policy digest 执行 ephemeral RunnerQualification；创建后与 Run 预览使用持久化/冻结 qualification，不能把 Workspace-specific 不合格写回设备 installation availability
- Runner 进程退出后没有孤儿进程
- supported Runner 同时提供 Session、PTY/ConPTY Terminal 和 Context package 投递
- Agent 完整回复和明确 interrupted 的部分回复都通过结构化 `assistant_message` signal 单次入库；流式 delta 和 Terminal 文本不生成重复 Message
- 验证同一 formal Handle 通过稳定 AttemptLaunch 的 `prepare_attempt_launch -> commit_attempt_launch` 连续承载两个兼容 Attempt；prepared process 在 commit 前保持 input fence，Context 或 launch 失败追加独立 Event 且不会创建第二进程
- 验证 `deliver_message` dispatch 后的 Runtime/receipt 崩溃窗口：可去重的同一 session 返回原 receipt，其它情况进入 delivery_unknown 且不重复 conversation/instruction
- Agent 派生通过绑定 Runner Handle 的 `spawn_request` 结构化 signal 创建 canonical SpawnRequest；formal 目录选择通过 DispatcherCoordinationLease、transient 目录选择通过 parent Attempt channel 投递 ExecutionWorkspaceSelectionRequest，并用同 request ID/digest 的 `execution_workspace_selection` 回答，不能依赖自由文本或 Terminal 读屏
- 验证 Agent/用户派生的 Runner Profile 按 explicit-or-inherit 规则从 RunSnapshot allow-list 冻结；不可用 Profile blocked，未冻结 Profile 必须 Amendment，不能选第一个可用 CLI
- 验证 worker-targeted ContextPackage、return contract、WorkerResult 和结构化 result callback；worker lifecycle 不终态化父 Attempt，回执 unknown 不自动重投
- 验证 `pi`、Codex CLI 和 Claude Code 的两两 ContextPackage 交接，至少覆盖每个 Runner 作为发送方和接收方
- 验证 `collect(handle, attempt_id)` 的 RunnerResult 绑定 result ID、AgentInstance、Attempt、Handle generation 和 digest；同一 Handle 连续 Attempt 的晚到结果不能串台

### Terminal

- 验证 ANSI、Unicode、光标、全屏 TUI、CLI 原生 `/` 命令和确认选择器
- 验证窗口 resize、焦点切换、粘贴、Terminal 原生 Ctrl-C/interrupt 字节和退出码；控制字节本身不生成 Domain interrupt 命令
- 验证 Terminal 与 Session 输入 owner 互斥
- 验证 `pauseResume=true` 的 Runner 使用同一 Handle 暂停和继续，Handle 丢失不会被标记为恢复成功
- 验证 CLI headless/RPC 模式与 TUI 互斥时明确报告 Terminal unavailable
- 验证切换 Session/Terminal 不创建第二进程、新 AgentInstance 或新 Attempt
- 验证 raw transcript 默认 30 天/每 Run 100 MB 的清理边界和导出脱敏

### Execution Workspace 与权限

- 验证共享目录不会把不明来源修改归给最近活跃 Agent。
- 验证 Git worktree 从冻结基线创建，并记录来源 ref、分支和目标集成基线。
- 验证临时目录只清理 Runtime 创建且登记的目录。
- 验证 `read_only`、`workspace_write`、`selected_paths` 和 `full_access` 的平台执行结果。
- 验证网络、外部进程、Workspace 外写入、破坏性命令和外部发布的 `allow | ask | deny`。
- 验证 `ask` hook 在 operation 前持久化 PermissionOperationRequest，`approve_once` 只释放同 Handle generation 的匹配 operation/digest；批准回执 unknown 不自动重发，恢复同时检查 decision receipt 和 RecoveryCheckpoint。
- 验证 PermissionGrant 普通 revoke/expire 追加 `permission.grant.status_changed`，并在同一事务使依赖的 Dispatcher lease/channel 失效或进入收敛；活动 Handle 不能热换更大 Grant。
- 验证 transient worker 不能扩大父 PermissionGrant。
- 验证 primary 请求成功、失败或取消时先关闭 spawn 并收敛全部 transient Handle；WorkerResult/Change Set 冻结和 assignment 释放前，父 Attempt/Run 不得进入终态。
- 验证 End 与 `stop_run` fatal failure 都进入 Run-finalization barrier，立即收敛 formal/transient Handles 和并行分支，不等待 30 分钟 idle timeout；Run 终态后无进程继续副作用。
- 验证 explicit End outcome、Optional Task `skipped` Transition、blocked Join 的恢复/失败动作、Run Amendment 原子事务和 Direct Task 每轮 Attempt/显式关闭都能从 Event 重放。
- 验证 TaskExecution 在 Attempt 前承载 capacity/selection/blocked/fail_task，重启后不会出现无 owner 的 Task 状态；Retry、Rework 和 Recovery 的 activation/Attempt 归属明确。
- 验证 exception `retry | amend_and_rework | skip_optional | fail_run` 原子终结旧 Attempt、处理 Decision/Attention 并登记唯一后续 work；Retry/Rework 在事务后走统一 pre-Attempt pipeline，不留下无 blocker 的 waiting Attempt 或无 assignment 的新 Attempt。
- 验证 pausing/resuming 期间到达的 failure End/fatal result 被冻结并走 finalization；普通 recovery 失败保持 interrupted，只有 `run.end_failed` 明确提交 `interrupted_ended`。
- 验证活动 Handle/coordination lease 不能原地扩大 PermissionGrant；`replace_unstarted_permission_grant` 只作用于未启动 TaskExecution/AgentInstance 且事务失败不替换旧 Grant。

### 后台、计划与恢复

- 验证关闭窗口后 Run、持久化队列和计划继续执行，重新打开窗口能从事件 sequence 对账。
- 验证 ScheduleFire 的 `scheduleId + occurrenceKey` 幂等，重复 tick、Run now 重试和 Runtime 重启不会重复创建 Run。
- 验证 live/catch-up pass 与 `schedule.update | enable | disable | archive | run_now` 的竞态；generation、config digest、template、cursor 或 cutoff 变化时 stale pass 整批 abort/retry，不产生部分 fire、Queue Item 或 cursor 推进。
- 验证五字段 cron 的 DST gap/fold、UTC elapsed interval、持久化 evaluation cursor，以及默认 `misfirePolicy=latest` 和可配置的 `skip | latest | all`。
- 验证 `all` 超过上限只保留最新 N 次，`queue_latest` 在与 preparing/run-created 竞争时只取消尚未创建 Run 的旧等待项。
- 验证多个 Queue Item 同时 eligible、priority 相同和 Runtime 重启后的领取顺序固定为 canonical comparator；reorder Event 的 `resultingQueuedOrder[]` 与实际领取一致。
- 验证后台遇到未预授权权限时创建 Attention 和脱敏系统通知，不把 `ask` 静默改成 `allow`。
- 验证 formal AgentInstance 按默认 1800 秒和配置边界 `60..86400` 休眠、transient worker 收尾后退出，长期 Seat Session 不丢失。
- 验证无副作用或已证明幂等的工作自动创建 recovery Attempt；非幂等或状态不明的工作暂停等待处理。
- 验证 checkpoint write-ahead barrier 在 durable ack 前、ack 后但操作发送前、发送后、远端确认后和结果提交前崩溃时都不会重复非幂等副作用；并行 operation 必须逐个分类。
- 验证混合 committed/pending operation 的完整恢复计划：committed 项通过 `continue_after_commit` 跳过；`resume_runner` 只有在已验证 `checkpointResume` 与 continuation ref 时可用。
- 验证安全退出 fence 覆盖全部非终态 Run，包括没有 registration/launch 的 preparing、resuming、Gate/Task 间隙、已 paused 和 idle Direct；只有 process/cleanup candidate 非空的 Run创建 ShutdownRecoveryPlan。process-free pre-Attempt aggregate 必须以独立 Event 阻塞 selection、系统 resolve 旧 request/target 的 open selection Attention、释放 assignment、撤销 Grant、用 `not_started` 终态化旧 AgentInstance并释放 capacity，再由 TaskExecution Event 释放 claim、清 target refs且保留 `safe_exit_before_launch` pending owner；该规则与同 Run 是否已有 plan 无关。
- 验证混合 Run：root/其它 Task 有 live Handle并创建 plan，同时另一个 `ready | provisioning | blocked` TaskExecution 没有 process。shutdown completion 必须等待 Handle termination 和 process-free aggregate disposition 都落盘；`run.status.changed.resumeTargets[]` 同时持久化 plan recovery 与该 TaskExecution 的 `continue_pre_attempt`，后者创建无 recovery lineage 的新实例，且没有 record/TaskExecution owner 重叠。Runtime 在 resuming 中断后按原 target set 重放，不重新猜测。
- 验证 fence 后先保存 typed completed/quiesced ShutdownFenceReceipt 和 ShutdownRecoveryPlan，quiesced 不等于 stopped；`recoverableAttempts[]` 与 `coordinationRecoveries[]` 对每个 Handle/Launch record 全局互斥，允许恢复的 candidate 恰好有一个 owner，不能回退到已清空 pending owner。
- 验证 `terminate_launch`/`terminate_handle` 的 matching receipt 或 completed evidence 落盘后才能写 stopped、终态化 source Attempt/撤销 target lease并释放资源；全部收敛后必须追加带 fence ref、适用时的 plan ref 的 `run.status.changed(resumeOnStartup=false)`。
- 验证任一 termination Unknown 都不返回安全 shutdown acknowledgement，并保持 `resumeOnStartup=true`；强制或未确认退出由 Shell marker 在下次启动进入 Runtime 对账。
- 验证手动 Pause 只在确认 paused 后设置 `resumeOnStartup=false`，成功 Resume 在同一事务恢复为 `true`。
- 验证多 Handle Pause/Resume 先按 AgentInstance 记录每个回执，再按 Attempt 聚合一次状态转换；部分失败时反向 re-pause，补偿失败或中断时稳定进入 `interrupted + degraded`，不会出现 Runner 已工作而 Run 仍声称 paused。
- 验证安全退出已销毁旧 Handle 后手动 Resume，场景至少包含同一 Attempt 的 primary、transient worker、一层嵌套 worker、idle Direct Handle 和 coordination-only Dispatcher Handle：ShutdownRecoveryPlan 的 `liveHandles[]` 完整覆盖；旧 Attempt 只终态化一次且只创建一个 recovery Attempt，每个 replacement 有 recovery lineage、独立 ExecutionWorkspaceAssignment、PermissionGrant 和 target ContextPackage。idle Direct 下一轮创建 replacement AgentInstance 而非 recovery Attempt。coordination-only lease 恰好进入一个 `coordinationRecoveries[]` entry，并在 prepare 前持久化 coordination ContextPackage、唯一 CoordinationLaunch、pending target lease 和 dormant channel；commit 后只激活 lease/token，不创建 TaskAttempt/RunnerResult。
- 验证双角色 Dispatcher process candidate：场景同时覆盖 root Handle 已登记且承载 active business Attempt + active coordination lease，以及 AttemptLaunch 已进入 prepare、pending lease 已创建但尚无 RunnerHandleRegistration。两类 shutdown record 都只属于 `recoverableAttempts[]`；active/pending source lease 只出现在 `coupledDispatcherCoordinationLeaseIds[]`，attempt-kind `inFlightLaunches[]` 冻结完整 `pendingDispatcherCoordinationLeaseIds[]`。pre-registration termination 必须用原 launch ID/digest revoke pending lease但保留同一 Attempt owner。Resume 在同一个 recovery AttemptLaunch 前创建 pending replacement lease/dormant channel，并用同一个 AgentInstance、registration 和 commit 同时恢复业务与激活 lease；不得创建 DispatcherCoordinationLaunch 或第二个 formal Handle。旧授权/lease 已释放或过期时不会被复用，任一重建失败进入 Attention 与 interrupted/degraded。
- 验证原始实例谱系达到默认 8 个后仍可创建合法 recovery replacement；同一谱系超过默认 3 次恢复时停止并创建 Attention，不进入无限 crash loop。
- 验证 `canceling -> interrupted` 保留 `terminationIntent=cancel`；该 Run 不能恢复或结束为普通失败，只能继续 cancel cleanup。其它 interrupted Run 的 `run.end_failed` 只有资源全部收敛后才提交 `failed/interrupted_ended`。

## 4. F0 Spike 验收矩阵

F0 可以使用最小 Runtime/Runner harness 验证进程、SQLite、计划幂等、PTY、目录和权限机制，不要求 F2/F3 的完整业务 UI 或领域调度器已经完成。Harness 必须走计划采用的真实 Shell/Runtime/Runner 进程边界；它不算 F3-B 的产品闭环证据。

| 流程 | Windows | macOS | Linux |
|------|---------|-------|-------|
| 全新安装 | [ ] | [ ] | [ ] |
| 首次启动和健康检查 | [ ] | [ ] | [ ] |
| 登录自启/双击竞态、第二实例激活和 per-data-root lock | [ ] | [ ] | [ ] |
| 三个 Runner 的安装、版本、登录和能力探测 | [ ] | [ ] | [ ] |
| 三个 Runner 分别启动、空闲休眠和进程树回收 | [ ] | [ ] | [ ] |
| 三个 Runner 两两 ContextPackage 交接 | [ ] | [ ] | [ ] |
| 三个 Runner 的 PTY/ConPTY Terminal 交互与 resize | [ ] | [ ] | [ ] |
| Session/Terminal 同实例与输入互斥 | [ ] | [ ] | [ ] |
| Agent 回复规范化入库、去重、搜索和恢复 | [ ] | [ ] | [ ] |
| Runner request channel 来源绑定与伪造请求拒绝 | [ ] | [ ] | [ ] |
| reused Handle 的 RunnerResult 跨 Attempt 隔离 | [ ] | [ ] | [ ] |
| Attempt/Coordination prepare 前与 prepared receipt 前崩溃恢复 | [ ] | [ ] | [ ] |
| Attempt/Coordination typed commit 与 commit receipt 丢失恢复 | [ ] | [ ] | [ ] |
| launch prepare/commit/query 的 ID/digest 去重与 conflict | [ ] | [ ] | [ ] |
| pre-registration Unknown 的 `terminate_launch` 按 ID/digest 收敛 | [ ] | [ ] | [ ] |
| in-flight Attempt/Coordination launch 的唯一 recovery owner | [ ] | [ ] | [ ] |
| 混合 Run 的 plan recovery + process-free aggregate shutdown/Resume | [ ] | [ ] | [ ] |
| 双角色 Dispatcher Handle 的单 replacement/lease owner | [ ] | [ ] | [ ] |
| registered Handle 的 completed/quiesced evidence、`terminate_handle` 与 stopped/resource 顺序 | [ ] | [ ] | [ ] |
| DispatcherCoordinationLaunch pending lease/dormant channel 与 commit 激活 | [ ] | [ ] | [ ] |
| Workspace 创建前/创建后 RunnerQualification 分离 | [ ] | [ ] | [ ] |
| 三种执行目录创建、冲突和清理 | [ ] | [ ] | [ ] |
| 四种权限档位和 selected paths | [ ] | [ ] | [ ] |
| `ask` operation approve-once 与 unknown receipt 恢复 | [ ] | [ ] | [ ] |
| 凭据存储、日志脱敏和 transcript 清理 | [ ] | [ ] | [ ] |
| Attention 和 Artifact 可见 | [ ] | [ ] | [ ] |
| 关窗到托盘后继续 Run、队列和计划 | [ ] | [ ] | [ ] |
| `interrupted/canceling/resuming/preparing/paused` Run 的 safe-exit fence 覆盖 | [ ] | [ ] | [ ] |
| quiesced/stopped 分离与 termination Unknown 不确认安全退出 | [ ] | [ ] | [ ] |
| safe-shutdown completion Event 与 `resumeOnStartup=false` 重放 | [ ] | [ ] | [ ] |
| 显式退出、注销和关机后无无主进程 | [ ] | [ ] | [ ] |
| 重启后风险感知恢复 Workspace、Run 和 ScheduleFire | [ ] | [ ] | [ ] |
| Direct Task 多轮、Amendment、End/skip/join 和 cancel cleanup 重放 | [ ] | [ ] | [ ] |
| 浅色、深色、系统主题 | [ ] | [ ] | [ ] |
| `zh-CN`、`en-US` | [ ] | [ ] | [ ] |
| 标准 DPI 和高 DPI | [ ] | [ ] | [ ] |

浏览器开发服务器只能证明 Client 可开发，不能替代以上证据。

## 5. F4 产品复验

F3 关闭后，F4 必须在三个平台使用真实产品入口重复验证：

- 创建带权限和指定目录的 Workspace。
- 启动至少两个 formal Seat、一个 transient worker 的真实多 Agent Run。
- 由分发 Agent 选择执行目录，并完成至少一次 worktree 结果整合。
- 在 `pi`、Codex CLI 和 Claude Code 之间传递 ContextPackage，覆盖三个 Runner 的发送和接收。
- 分别打开三个 Runner 的 Session 和 Terminal，证明每个实例只有一个进程 Handle。
- 搜索、导出和重启恢复消息、变更、交付结果和谱系。
- 关闭窗口后继续一次 Run 和一次计划任务；确认安全退出必须在全部 launch/Handle termination receipt 和资源清理落盘后保持暂停且不自动恢复，强制或未确认退出进入风险恢复与 Attention。

F0 harness 通过不能替代 F4 产品证据，单 Agent Run 也不能替代以上流程。

## 6. Spike 产物

关闭前必须提交：

1. Rust sidecar、per-data-root 单实例托盘 supervisor、SQLite datastore lock、账本和本机 transport 的实证记录。
2. 三平台构建配置和安装包命名规则。
3. Shell/Runtime 启动时序和失败处理。
4. 数据、日志、资源和临时文件路径表。
5. 三个用户安装 Runner 的九组合探测、权限和契约测试结果。
6. Attempt/Coordination launch、RunnerHandleRegistration、typed shutdown/termination evidence、混合 Run aggregate、双角色 Dispatcher 唯一 recovery owner、completion Event、cleanup Unknown 和 recovery 对账的崩溃窗口证据。
7. 三平台验收矩阵、命令、日志和截图。

Spike 通过后，结论写入 [m6-architecture.md](m6-architecture.md)、[m6-runner-adapter.md](m6-runner-adapter.md) 和开发计划，再开始生产实现。
