# M6 Local Runtime and Scheduling

**状态**：产品与架构决策基线；三平台 Spike 证据待补（2026-08-20）
**范围**：Runtime 进程、桌面后台行为、本机连接、调度、恢复和 Paperclip 取舍
**配合**：[m6-architecture.md](m6-architecture.md) · [m6-platform-packaging.md](m6-platform-packaging.md) · [m6-runner-adapter.md](m6-runner-adapter.md) · [m6-run-operations.md](m6-run-operations.md) · [m6-execution-workspace-security.md](m6-execution-workspace-security.md)

## 1. 已确认的产品边界

- 首版只控制当前设备，不提供远程 Runtime、账户、云中继或跨设备访问。
- 关闭主窗口会收起到系统托盘；Runtime、活动 Run、持久化队列和定时计划继续工作。
- 首版不安装系统级服务。显式退出、用户注销或系统关机都会停止 Runtime；Ensemble 默认随用户登录启动，用户可以关闭该设备偏好。
- 显式退出时默认执行“安全暂停并退出”；只有 Runtime 确认 Run 已安全暂停后才关闭该 Run 的自动恢复，不把 Runtime 留在桌面应用之外运行。无论是否存在 active Run，Runtime 还必须先 fence 新 command admission并把全部 already-accepted Draft command 收敛到 canonical applied/rejected/conflict；否则不返回安全退出确认。
- 注销、关机或异常退出后，原本运行中的 Run 在下次登录时自动进入风险感知恢复。无法证明幂等或副作用状态不明的操作等待用户处理。
- 后台可以继续已有 Run，也可以启动持久化队列和定时计划；首版不做文件监听、Webhook 或通用外部触发器。
- 后台操作只能使用计划显式预授权的权限。超出范围时暂停相关工作并创建 Attention，不自动扩大授权。

这些规则区分两个动作：

| 用户动作 | Runtime 行为 |
|---|---|
| 关闭窗口 | 隐藏到托盘，继续运行 |
| 托盘中退出 | Runtime先安全暂停并收敛Runner；durable acknowledgement后Electron Main只结束owned Rust sidecar和Electron自身进程，Runner已由Runtime确认收敛 |

首版托盘只提供打开应用和退出。暂停属于具体 Run 操作；首版不引入设备级 **Pause all / Resume all** 状态、命令或事件。

## 2. 生产进程形态

首版选择以下生产边界：

```text
React Canvas Renderer
       |
       | frozen Preload allowlist + MessagePort
       v
Electron Main/Preload
  window / tray / autostart / OS notifications / security / platform capabilities
       |
       | authenticated loopback transport
       v
ensemble-runtime sidecar (Rust)
  Domain / Command / Event / SQLite / scheduler / recovery / adapter registry
       |
       +-- built-in pi adapter --------> user-installed pi CLI
       +-- built-in Codex adapter -----> user-installed Codex CLI
       +-- built-in Claude adapter ----> user-installed Claude Code
```

边界规则：

- 生产只保留一个Electron Shell，不维护旧壳/Electron双生产兼容路线。
- Runtime是随安装包交付、单独签名的Rust sidecar，不要求系统Python、Node或仓库依赖。Node只属于Electron Shell，不形成业务Runtime。
- Electron Main/Preload只负责窗口、平台能力、安全边界、签名sidecar监督和typed transport；不拥有Domain、SQLite、Runner、PTY/ConPTY、queue、schedule或safe quit。
- Adapter实现随Runtime交付并通过编译期registry注册。首版不加载第三方二进制或本地Adapter目录。
- Runner CLI是用户安装的外部进程。Rust Runtime通过PTY/ConPTY启动并持有进程树，不通过Main或Shell脚本拼接业务协议。
- Runtime、Adapter和Runner分层仍以逻辑接口隔离。内置Adapter不允许直接写Domain State。
- Runtime崩溃不得让Runner变成无主进程。Runner需要由Rust Runtime建立父进程监督、进程组或Job Object，以及Runtime lease丢失后的回收路径。Main不枚举、kill或重分类Runner child。

选择sidecar而不把业务Runtime放进Electron Main，原因是Runner进程管理、事件恢复和调度需要独立故障边界，并且Node壳不能形成第二状态源。sidecar不是常驻系统服务，也不意味着首版支持远程连接。既有Python/旧壳supervisor是历史实现漂移，不是待翻译模板。

### 2.1 单实例与data root所有权

Main必须在任何Runtime spawn前调用`app.requestSingleInstanceLock()`。失败实例只提交`{kind=activate,target?{kind,id}}`，校验source/ID/512 bytes，丢弃且不记录raw argv/cwd/path/URL/env/bootstrap值；既有实例等待Runtime reconciliation后才导航opaque target。

Rust Runtime继续按F0-A1规则拥有canonical data root：

- Main创建受限token file和ready file path，并把显式data root传给签名sidecar。
- Runtime在打开SQLite前获取该canonical data root的独占datastore lock；同root第二个Runtime失败，不同root的独立Runtime可并行通过F0-A1测试。
- datastore lock依赖OS handle生命周期释放；stale ready metadata不能代替lock存活证明。
- Main crash而Runtime尚在退出时，新Main必须等待datastore lock和Runtime进程containment有界收敛；不能并发打开SQLite或自行判断Runner状态。
- 只有datastore lock owner可以写Domain、Queue、ScheduleFire、ExecutionClaim和recovery state。

F0-A2/F0-A3必须在Windows、macOS、Linux实测登录自启与双击竞态、第二实例窗口激活、Main/Renderer/Runtime分别崩溃、stale metadata和datastore lock回收。

| 方案 | 结论 | 原因 |
|---|---|---|
| Electron Shell + Rust sidecar | 选择 | 固定Chromium渲染；Shell与业务Runtime故障边界分离；适合签名安装、平台能力和sidecar监督 |
| Node/TypeScript业务server | 不选 | 会形成另一套业务运行时，进程、权限、SQLite和调度仍需Rust权威 |
| Python/CrewAI sidecar | 不选 | 打包复杂，并会与Ensemble已定义的调度和事件状态形成双重所有权 |
| Electron Main内业务Runtime | 不选 | Node SQLite/PTY/Runner会把窗口进程变成第二状态源并扩大攻击面 |
| 双生产壳 | 不选 | 会复制安全、transport、package和owner路线，形成兼容债务 |

原CrewAI/Python Runtime属于M0-M5历史实现，不再是V2生产依赖。Organization、Workflow、RunSnapshot和Runtime Event已经定义产品编排语义；不得再叠加框架状态机。

## 3. 本机连接与认证

生产链路固定为：

```text
React Renderer
  -> frozen typed Preload allowlist / transferred MessagePort
Electron Main
  -> authenticated HTTP command/query + WebSocket/binary stream
Rust Runtime on random loopback port
```

- Renderer不直接获得Runtime token、port、PID、ready path、任意进程句柄或结构化绝对路径。
- Runtime只监听loopback。它绑定`port=0`，通过F0-A1原子ready descriptor回报实际端口；Main持有ready path和认证材料。
- Main每次启动Runtime时创建至少256-bit token file；token不进入命令行/Renderer/Preload/URL/业务配置。Shell-exported诊断/log无bootstrap值；restricted lifecycle log可含non-secret PID/loopback port但无token、secret-file contents/path、env/request body/second-instance raw input。
- Main只从`process.resourcesPath`签名manifest解析sidecar，禁止PATH、仓库、开发产物、Python或旧supervisor fallback。
- Runtime启动后保持command admission/business write-ready关闭，完成既有token验证、协议握手、Event/command ledger恢复、accepted Draft对账和完整startup classification barrier后，Main才把脱敏ready fact转给Renderer。
- 业务命令仍携带既有`commandId`；Shell request identity不能替代Domain identity，transport accepted不等于业务成功。
- Workspace Event与Terminal使用同一exact byte-credit：encoded`frameByteLength`=`ArrayBuffer.byteLength`、`grantBytes`、debit-before-send、contiguous ack、256KiB frame/4MiB outstanding/8MiB queue/30s pause、无lifetime cap；不按chunk invoke。
- Event断线仍按canonical Domain `sequence`补齐；Shell stream sequence与Domain sequence分开。
- Terminal使用独立binary stream，最终输入许可仍由Runtime的TerminalInputLease校验。Main不能因port存在或窗口focus放行输入。
- Runtime request channel继续使用Attempt-scoped或coordination-scoped capability token；这些token不复用Shell session token，也不暴露给Renderer。
- Workspace-create bridge携带Client预持久化immutable`commandId`；Main把selection绑定该command。retry/Main restart先query Runtime原commandId，accepted无需raw refs；not-recorded才以同command和有效/重选refs重试。Runtime WorkspaceCreateInput/FileRoot/PathGrant/save不变。
- 开发预览可以使用显式dev build transport，但schema、identity、目录DTO和Domain API必须与生产一致，不能维护第二套业务协议。

完整BrowserWindow、Preload、IPC、MessagePort、opaque selection、sidecar和更新合同见[m6-electron-shell.md](m6-electron-shell.md)。

## 4. 持久化与执行租约

Runtime 使用 SQLite WAL 作为结构化真源，文件系统保存大体积 Artifact、Diff、终端记录和内容寻址对象：

```text
app-data/
  ensemble.db
  artifacts/
  changes/
  terminal-transcripts/
  execution-workspaces/
```

SQLite 至少持久化：

- Workspace、OrchestrationVersion 和 RunSnapshot
- Command result 与幂等键
- 追加式 Workspace Event 和投影游标
- Run、NodeExecution、TaskExecution、TaskAttempt、AgentInstance 和 Attention
- RunnerInstallation、RunnerProfile、RunnerQualification、ExecutionPolicyVersion、ScheduleLaunchTemplate、RunQueueItem、Schedule、ScheduleFire 和持久化队列
- RunAmendment、DispatcherCoordinationLease、DispatcherCoordinationLaunch、SpawnRequest、ExecutionWorkspaceSelectionRequest/Assignment、PermissionGrant、PermissionOperationRequest/DecisionDelivery 和 capacity reservation
- AttemptLaunch、RunnerHandleRegistration、ArtifactCandidate、RunnerResult、Message delivery、WorkerResult/Delivery、ExecutionClaim、ShutdownRecoveryPlan、恢复判断和 History 记录

一致性规则：

- Domain 对象、对应 Event 和 outbox notification 在同一事务提交。
- 每个可执行节点通过原子 `ExecutionClaim` 领取；同一 NodeExecution、TaskExecution provisioning 或 Attempt 同时只能有一个有效 claim。
- claim 包含 owner、acquiredAt、leaseExpiresAt 和 generation。续租失败的 owner 不得继续提交业务终态。
- AgentInstance 创建与 `capacityReservationId` 占用在同一 SQLite 事务完成；provisioning、blocked、starting、running、paused 和 stopping 都计数。只有确认 Handle 不存在或已终止，且 selection、assignment 和临时资源已释放后才能释放 slot。
- 每个 Attempt 在调用 Adapter 前持久化 AttemptLaunch、ContextPackage 和 ExecutionClaim。`prepare_attempt_launch` 可以创建 process，但 process 在 `commit_attempt_launch` 前必须保持 input fence；首次 prepared receipt 在同一事务创建 RunnerHandleRegistration，prepared/committed receipt 分别落盘。回执 Unknown 只查询原 launch ID，不创建第二 Handle。
- RunnerResult 必须绑定 `runnerResultId + agentInstanceId + attemptId + handleGeneration + contentDigest`。reused Handle 的晚到结果不能完成当前或其它 Attempt。
- formal Dispatcher AttemptLaunch prepare 前，Runtime 原子创建 pending Run-scoped DispatcherCoordinationLease 并投递 dormant channel ref；reliable committed 后才激活 token。业务 Attempt 终态不撤销 active lease，token 只能提交 workspace selection。Handle/Grant/qualification/Run 变化先 revoke；recoverable Dispatcher Attempt 与 lease 共用旧 Handle 时，replacement lease 由同一个 recovery AttemptLaunch 和新 registration/commit 激活。只有没有业务 Attempt owner 的跨进程 replacement 才通过独立 DispatcherCoordinationLaunch 和预分配 pending lease 创建新 Handle/registration。旧 unknown request 不自动转移。
- 每个 transient 派生先持久化 SpawnRequest；worker AgentInstance、SelectionRequest、ContextPackage、WorkerResult 和 delivery 必须通过 `spawnRequestId` 唯一关联，重启不能从数组位置或最近实例猜测。
- ScheduleFire 使用 `scheduleId + occurrenceKey` 唯一键；scheduled/catch-up key 来自 canonical UTC occurrence，manual key 来自 `commandId`，重启或重复 tick 不会创建两个 Run。
- RunQueueItem 在满足 eligibility 后统一按 `priority DESC, COALESCE(notBefore, createdAt) ASC, createdAt ASC, queueItemId ASC` 领取。priority 越大越优先，默认 `0`；领取、取消和重排共用 SQLite 写事务，不能依赖表的物理行顺序。
- 文件内容先写临时文件并完成 digest，再在事务中登记；数据库不能引用未完成文件。
- Snapshot 只是加速投影，Event 和不可变业务对象仍能完成对账。canonical Workspace Event ledger 永不删除、重排或截断；历史清理只删除独立正文/blob/index 并保留 typed tombstone。

具体 lease 周期属于 Spike 参数，不进入产品语义；测试必须覆盖进程在领取后、Runner 启动后和结果提交前崩溃的三个窗口。

## 5. Runner 与 Seat 生命周期

- 长期存在的是 Seat Session 投影，不是永不退出的进程。Direct Task 每轮消息创建一个 Attempt；单轮结果只进入 idle，`direct_task.end` 或冻结的 idle timeout 才关闭 Direct Run。
- formal AgentInstance 只有在所属 Run 仍非终态且可能继续派发/对话，并且没有活动 Attempt、待投递消息、终端连接或 coordination protection 时，才进入空闲计时，默认 30 分钟后优雅停止；保护包括 active/rotating lease、面向同一 continued Handle 的 pending replacement lease/launch 和未终态 CoordinationLaunch。Workspace 的 `formalAgentIdleTimeoutSeconds` 可以在 `60..86400` 秒内配置，并在 Run 的 ExecutionPolicyVersion 中冻结。非终态 Direct Run 只使用 Snapshot 的 `directTaskIdleTimeoutSeconds`，不并行启动 formal process-idle timer；关闭后由 Run-finalization barrier 立即停止 Handle。
- 休眠不会删除 Session、消息、上下文、Artifact 或谱系。下次工作创建新的 AgentInstance，并通过 CLI 原生恢复能力或 ContextPackage 恢复上下文。
- 正在等待用户输入或处于活动 Attempt 的 Runner 不算空闲。
- transient worker 在父 Attempt 交付、失败或取消收尾后停止，不转成长期 Seat。
- Runner 进程结束后保留冻结 Terminal 输出；新的 AgentInstance 不复用旧 Handle。
- 每个拥有 registered Handle 的 settled Attempt 都创建不可变 Handle disposition record；从未创建 Handle 的 Attempt 不伪造记录。coordination-protected formal Handle 自动 `reuse(reason=active_coordination_lease | coordination_rotation_in_progress)`，保护引用可靠终态前拒绝用户 retain/release 和 idle stop。其它 formal Handle 的 `reuse` 等待下一次正常 AttemptLaunch；`retain` 只在 Adapter 能 input-fence raw Terminal 并提供 typed side-effect-free inspection 时可用，继续占用 capacity；transient 必须 release，coordination-only Handle 由 lease lifecycle 决定。未被 launch 消费且不受保护的 reuse 可改为 retain/release，retain 只可改为 release。Run finalization、Grant/qualification 失效、retain expiry 或 generation 变化先终结保护 lease/launch，再强制 release。
- Task long-wait checkpoint 只触发 observation/reconciliation/Attention；heartbeat 或输出只证明 liveness，不能终结 Attempt、启动 replacement 或释放 capacity。

## 6. 持久化队列与定时计划

Schedule 只引用不可变 ScheduleLaunchTemplate，不直接执行当前 Draft，也不保存一段脱离 Task/Run 的自由 Prompt。Template 冻结 OrchestrationVersion、输入、Runner Profile 绑定、transient Profile allow-list 及非敏感配置、`outputLocale` 和 ExecutionPolicyVersion；触发时不能回读当前 Workspace 默认值。

```text
Schedule
  scheduleId
  workspaceId
  name
  generation
  configDigest
  launchTemplateRef
  trigger                    cron | interval
  cronExpression?
  intervalSeconds?
  intervalAnchorAt?
  timezone
  enabled
  evaluationCursor
  pendingCatchUpCutoff?
  misfirePolicy              skip | latest | all
  maxCatchUpRuns
  overlapPolicy              queue_latest | allow_parallel | skip
  archivedAt?
  createdAt
  updatedAt
```

默认值：

- `misfirePolicy=latest`：Runtime 停止期间每个计划最多补跑最新一次。
- `maxCatchUpRuns=10`：只有显式选择 `all` 时使用，合法范围 `1..100`，防止恢复后无上限突发执行。
- `overlapPolicy=queue_latest`：前一次仍在运行时只保留最新一个待启动 fire。
- Cron 首版只支持五字段、分钟粒度表达式，依次为 minute、hour、day-of-month、month、day-of-week。支持数字、`*`、列表、范围和 step，Sunday 为 `0`；day-of-month 与 day-of-week 同时受限时使用 Vixie OR 语义。不支持名称、秒、`L/W/#` 或 `@daily` 一类别名。Cron 按保存的 IANA timezone 计算；DST gap 的不存在时间跳过，DST fold 的重复时间只在较早 instant 触发一次。
- Interval 最小为 60 秒，以保存的 UTC `intervalAnchorAt` 为锚点按 elapsed duration 计算，不受 DST 影响；IANA timezone 只用于展示。
- Cron 必须只有 `cronExpression`；Interval 必须只有 `intervalSeconds + intervalAnchorAt`。字段组合不合法时不能启用计划。

Schedule 创建时 `generation=1`。每次成功的 `schedule.update | enable | disable | archive` 都在事务内推进 generation 并重算 config digest；digest 覆盖必填 `name`、launch template、trigger、timezone、enabled、misfire/overlap 配置和 archived 状态，不包含 cursor、generation 或时间戳。`schedule.run_now` 必须校验 generation，但不修改它。修改类命令和所有 live/catch-up pass 共用 per-schedule SQLite 写事务。

Misfire 和 overlap 必须按以下顺序确定，不能依赖内存 tick 次数：

1. Runtime 启动或收到平台 resume 信号时，为每个启用计划先持久化 `pendingCatchUpCutoff=now`。Catch-up pass 只计算 `evaluationCursor < scheduledFor <= pendingCatchUpCutoff`，并按 `scheduledFor` 升序处理；处理中崩溃必须继续原 cutoff，不能扩大窗口后重选。
2. Catch-up 中每个 occurrence 都创建 `triggerKind=catch_up` 的唯一 ScheduleFire。`skip` 将全部记为 `skipped/misfire_policy_skip`；`latest` 只选择最新一次，其余记为 `skipped/misfire_policy_latest`；`all` 选择最新 `maxCatchUpRuns` 次，更早的记为 `skipped/catch_up_limit_exceeded`。处理完成后原子推进 cursor 到 cutoff 并清空 pending 值。
3. Runtime 正常活动期间，live due pass 捕获本次 `tickCutoff=now`，对 `evaluationCursor < scheduledFor <= tickCutoff` 的每个 occurrence 创建 `triggerKind=scheduled` 的 fire 并全部选中，再原子推进 cursor。普通调度延迟不应用 misfire policy；只有启动或平台 resume 建立的固定 catch-up window 才应用。
4. Catch-up 或 live pass 选中的 occurrence 再应用 overlap policy。Overlap 指同一 Schedule 存在 `queued | preparing | blocked` Queue Item，或已经创建且 Run 尚未进入终态。
5. `overlapPolicy=skip` 时，新 fire 记为 `skipped/overlap` 且不创建 Queue Item。`allow_parallel` 为每个选中 fire 正常创建 Queue Item。
6. `queue_latest` 不终止已创建的 Run，只保留最新一个尚未创建 Run 的等待项。创建新 fire/item 的事务同时把较旧 `queued | preparing | blocked` Queue Item 置为 `canceled/superseded_by_newer_fire`，并把对应未到 `run_created` 的 fire 置为 `skipped/superseded_by_newer_fire`。如果旧项已在同一竞争中先提交 `run_created`，它视为活动 Run，不回滚；新项仍作为唯一等待项保留。
7. 每次 pass 可以在事务外计算候选 occurrence，但写入事务必须重新读取并校验 `enabled=true`、`archivedAt` 为空，以及 generation、config digest、launchTemplateRef、evaluationCursor 和 pendingCatchUpCutoff 与计算快照完全相同。任一值变化时整批 abort，并从最新 Schedule 重算；不能部分创建 fire、取消 Queue Item 或推进 cursor。
8. ScheduleFire 冻结本次读取的 `sourceScheduleGeneration` 和 `scheduleConfigDigest`。ScheduleFire、Queue Item 状态变化和新 `evaluationCursor` 在同一事务提交。崩溃重放依靠唯一键、固定 cutoff、generation、digest 和 cursor 得到相同结果。

创建或重新启用计划时 cursor 设为当前 instant，禁用期间不补跑。禁用或归档会清空 pending catch-up window；修改 trigger、expression、interval 或 timezone 时，事务把 cursor 重置为变更生效 instant 并清空旧 catch-up window。`schedule.update | enable | disable | archive | run_now` 必须携带 `expected_generation`，不匹配时返回 conflict。`schedule.run_now` 使用命令首次被接受的 UTC instant 作为 `scheduledFor`，并用 `occurrenceKey=manual:<commandId>` 创建 `triggerKind=manual` 的 ScheduleFire；重复 `commandId` 返回同一 fire，不推进 cursor，并继续应用 overlap、Runner、权限和资源校验。归档计划拒绝 Run now。

触发流程：

1. Scheduler 按上述规则原子创建 ScheduleFire，从其 `launchTemplateRef` 复制不可变 RunLaunchSpec，并为选中执行的 fire 创建 `sourceKind=schedule_fire` 的 RunQueueItem。
2. Runtime 重新探测 LaunchSpec 绑定的 Runner Profile，并将其 ExecutionPolicyVersion 与当前 Workspace policy 和平台能力求交集；不能静默换 Profile 或扩大权限。
3. 校验通过后走与手动 `run.start` 相同的创建事务；Run 记录 `launchSource=schedule` 和 `scheduleFireId`，Queue Item 保持 `sourceKind=schedule_fire`。
4. Runner 不可用、权限不足或预算阻塞时保留 fire 和 queue item，并创建 `scopeKind=queue_item` 的可操作 Attention；此时不能伪造尚不存在的 `runId`。
5. 计划被禁用或归档只阻止未来 fire，不取消已经创建的队列项或 Run。归档保留 Schedule、ScheduleFire 和启动链路，不执行级联删除。

自动登录启动默认开启，确保注销或重启后能恢复 Run 和处理计划。用户关闭该设置时，界面明确说明 Run 恢复和错过计划会等到下次手动打开 Ensemble，再按 misfire policy 处理。

## 7. 后台审批与通知

- ScheduleLaunchTemplate 保存带 digest 的不可变 ExecutionPolicyVersion，不是无限权限或可静默变更的 Workspace policy。修改计划权限会创建新 policy version 和新 template；每个 Run 仍创建独立 PermissionGrant。
- 预授权只允许等于或收紧 Workspace policy；扩大目录、网络、外部进程、破坏性命令或外部发布权限需要用户显式修改计划。
- 已创建 Run 后遇到未预授权操作时，Attempt 进入 `waiting_attention` 并创建 Run-scoped Attention，其他独立分支可以继续。
- Run 创建前的 Runner、权限或资源阻塞创建 Queue-scoped `launch_blocked` Attention，允许修复 Profile、为该项创建新的 ExecutionPolicyVersion 与 RunLaunchSpec、重试或取消队列项。
- Runtime 通过 Shell 发出操作系统通知。通知只包含脱敏摘要；点击后按 scope 打开对应 Workspace、Run 或 Queue Item，以及 Attention。
- 没有 Client 连接不改变审批语义，也不会把 `ask` 当成 `allow` 或 `deny`。

通知 target 只携带本机 opaque identity：`workspaceId + scopeKind + attentionId? + runId? + queueItemId? + scheduleFireId?`，不得包含路径、Prompt、Artifact 正文、Terminal 内容或秘密。点击只导航，不在系统通知层 Approve/Reject。应用未启动时先激活单实例 Shell，等待 Runtime health 与 reconciliation 完成再解析 target；Attention 已 resolved 时打开只读结果，Queue Item 已创建 Run 时重定向到 Run 并保留来源链，目标不可用时显示 typed unavailable。OS 通知权限关闭不影响应用内 Attention 真源。

## 8. 风险感知恢复

恢复能力分成五个独立事实：Client UI state、持久化 conversation、live process、Terminal transcript 和 business operation。Client/Webview detach 与关窗到托盘不改变业务状态；graceful Runtime exit 会可靠终止旧 Handle，之后以新 AgentInstance/Attempt 恢复；crash、注销或 OS shutdown 必须先对账。Provider-native session resume 只是可探测的上下文续接能力，transcript replay 只是只读历史；两者都不能证明副作用完成、恢复旧 PermissionGrant 或替代 RecoveryCheckpoint。完整产品矩阵见 [m6-agent-session-collaboration.md](m6-agent-session-collaboration.md)。

### 8.1 安全退出屏障

显式安全退出首先在 sidecar writer/admission serialization 上建立全局 command-admission fence：等待已经进入 admission 临界区的请求持久化 accepted/rejected/conflict 判定，随后拒绝所有新 Domain command（`runtime_shutting_down`），只允许 read/query 和原 command reconciliation。该 fence 不新增 Domain object、API 或 persistence field，直接复用 Runtime lifecycle、durable command ledger 和原 command identity/payload。之后再覆盖当前 data root 的全部非终态 Run，不能按是否已有进程过滤。Runtime 为每个 Run 持久化唯一 `shutdownFenceId`，然后停止计划触发、新派发、spawn、新 AttemptLaunch/DispatcherCoordinationLaunch 的 prepare/commit、Session/Terminal 输入和 request channel 新 operation。除 idle Direct 外，`running` Run 在建立 fence 的事务先追加 `running -> pausing` 的 `run.status.changed(reasonCode=safe_shutdown_requested)`；已经 `pausing | paused` 的 Run 不重复制造转换。`interrupted | canceling | resuming | preparing` Run 仍按各自 canonical barrier 收敛，不能因没有 Handle 或状态名跳过 fence。

Shell 使用 typed shutdown API，不把 `quit(): Promise<void>` 当作产品合同：

```text
request_shutdown(mode=safe_pause | cancel_runs) -> shutdownRequestId
subscribe_shutdown_progress(shutdownRequestId)
continue_waiting(shutdownRequestId)
force_quit(shutdownRequestId)
```

进度按Run返回`fencing | waiting_runner | reconciling | safe | needs_verification`，并携带真实subject refs，不伪造百分比。默认观察期限为30秒；到期只开放**Continue waiting**与**Force quit**。shutdown fence建立后不能通过Esc/Back取消，因为首版没有unfence command。`force_quit`不写安全完成；Electron Main只保存supervisor marker/脱敏诊断并终止owned Rust sidecar。Runtime与OS parent-death/platform containment拥有Runner descendants；Main不得枚举、kill或重分类Runner child。`cancel_runs`逐Run进入既有cancel barrier，不宣称跨Workspace原子取消；全部Run收敛后才退出。

command-admission fence 生效后，Runtime 扫描 durable command ledger 中每条 accepted 且缺少 terminal result 的 Draft command，并用已保存的原 `commandId + expectedRevision + operationDigest + operations[]` 幂等重新派发或对账。matching `orchestration.draft.applied` Event，或 durable rejected/conflict result，才终结该 row；accepted receipt 不能终结。该 drain 不等待 buffered/local-only batch promotion。零 active Run 时，只有 Client journal flush、admission fence和本 drain 完成后才能直接退出。

Runtime 独立计算每个 fenced Run 的 process/Unknown reconciliation set 和 process-free pre-Attempt aggregate set。存在非 stopped RunnerHandleRegistration、可能已创建 process 的 in-flight launch，或 unresolved cleanup resource 时创建 ShutdownRecoveryPlan；没有这些 candidate 时不创建空 plan。Runtime 对每个 primary/transient/coordination registration 调用 `quiesce_for_shutdown`，包括已 paused、没有活动 Attempt 的 idle Direct Handle 和承载 active coordination lease 的 Handle。每个 Handle 必须返回绑定 shutdown fence、RunnerHandleRegistration、Handle generation、可选 source Attempt/lease 和最后 operation sequence 的 typed ShutdownFenceReceipt；`completed` 证明进程树已不存在，`quiesced` 只证明不再接受 operation。Runtime 先持久化所有 receipt/checkpoint 与 fenced/quiesced lifecycle Event，再确认 fence 后没有新 operation，最后冻结 `liveHandles[]` 覆盖 fence 时全部 registration、`inFlightLaunches[]` 覆盖无 registration 的 process candidate、attempt-kind record 的完整 `pendingDispatcherCoordinationLeaseIds[]`，以及覆盖其它 Unknown 的 `unresolvedCleanupSubjectRefs[]`。

`recoverableAttempts[]` 和 `coordinationRecoveries[]` 对 shutdown Handle/Launch record 全局互斥，允许恢复的 record 恰好有一个 owner。同一 Dispatcher process candidate 同时承载 Attempt 和 lease 时，无论它是已登记 Handle 还是尚无 registration 的 AttemptLaunch，都只归 recoverable Attempt；active lease 或 AttemptLaunch 的 pending lease 写入该 entry 的 `coupledDispatcherCoordinationLeaseIds[]`，不再创建 coordination recovery。只有没有可恢复业务 Attempt owner 的 lease 才进入 `coordinationRecoveries[]`。quiesced 不能提前写成 stopped。

plan、`run.shutdown.recovery_plan_created` 和 `shutdownRecoveryPlanId` 先在同一事务持久化，并把 `resumeOnStartup` 设置或保持为 true。Runtime 随后对 in-flight launch 调用 `terminate_launch`，对 quiesced registration 调用 `terminate_handle`，completed registration 使用原 ShutdownFenceReceipt；只有 matching typed evidence 落盘后才写 launch reconcile、registration stopped、AgentInstance stopped、lease revoke 和 assignment/capacity release。每个 recoverable source Attempt 随 process 收敛只终态化一次；`pending | ready` Attempt 也显式进入 `interrupted/safe_shutdown_process_closed`。Runtime 另行追加 TaskExecution Event 来清除 `currentAttemptId`，并让 TaskExecution 按 canonical 状态机进入 `paused | interrupted`；已 paused 的 TaskExecution 使用 `paused -> paused / safe_shutdown_recovery_owner_transferred` self-event。此时 pending Attempt 字段为空，plan 是该 Attempt 在用户 Resume 前的唯一恢复 owner。pending CoordinationLaunch 撤销 target lease，但 source coordination recovery owner 保留；coupled active lease 跟随所属 Attempt Handle 一次性收敛，pre-registration AttemptLaunch 的 pending coupled lease 随 matching launch termination revoked，并保留在原 Attempt entry 中作为下次 replacement 来源。

无论 Run 是否创建 plan，未被任何 shutdown record 或 plan owner 覆盖、状态明确且从未启动的 pre-Attempt aggregate 都执行相同 process-free disposition：`pending_delivery | awaiting_selection | validating` SelectionRequest blocked；旧 request/target 的 open `workspace_selection_blocked` Attention 由 Runtime 以 `superseded_by_safe_exit_before_launch` resolve；随后 assignment released，Grant revoked，`created | provisioning` target AgentInstance 以 `not_started/safe_exit_before_launch` stopped并释放 capacity，TaskExecution 最后释放 claim、清除旧 target refs、进入 interrupted并保留同一 pending owner。旧 SelectionRequest 已 blocked 或 assigned 时不改写，assigned 只释放 assignment，但两者都不能留下可操作的旧 selection Attention。资源 Unknown 时加入 plan cleanup owner或拒绝 acknowledgement。

process/Unknown 和 process-free aggregate 两类工作全部收敛后，Run 才按 `pausing -> paused`、`preparing | resuming -> interrupted`、同状态或既有 finalization 终态追加 `run.status.changed(reasonCode=safe_shutdown_completed, shutdownFenceId, shutdownRecoveryPlanId?, resumeOnStartup=false)`；存在 plan 时必须携带 plan ref。全部 Run completion Event durable，且 accepted Draft drain 每一 row 都已有 terminal result 后，才向 Shell 返回 shutdown acknowledgement。cancel/finalization intent 只继续原 barrier。现有 30 秒 wait 内任一 Run cleanup 或 accepted Draft row 未收敛，都不返回安全 acknowledgement，只保留 Continue waiting / Force quit。Force quit/crash可以绕过drain；Main强制路径只写supervisor marker/脱敏诊断并终止Rust sidecar，不枚举Runner child。Runner进程树由Rust parent-death/platform containment收敛，下次Runtime在write-ready前处理原ledger row且Main不能提前声称stopped。

### 8.2 启动与执行恢复

系统重启、Runtime 崩溃或 Runner 异常退出后，Runtime 先恢复账本，再处理工作：

1. 取得 datastore lock，加载 Workspace Event、Snapshot 和 durable command ledger；command admission/write-ready 继续关闭。
2. 回放 Workspace Event 并校验最后快照。对每条 accepted 且缺少 applied/rejected/conflict terminal result 的 Draft ledger row，只用保存的原 `commandId`、expected revision、digest 和 operations 幂等重新派发或对账；不得创建新 command。matching Event 或 durable rejected/conflict result 落盘后才终结该 row。
3. 全部上述 row 收敛只关闭 command-ledger 子屏障，Runtime command admission/business write-ready 仍保持关闭；任一 row 仍 Unknown 时继续 `runtime_reconciling`/只读并提供 Retry reconciliation 或 Force quit 诊断。
4. 对账 supervisor marker、RunnerHandleRegistration、DispatcherCoordinationLease/Launch、SpawnRequest、AttemptLaunch、Message/WorkerResult/PermissionDecision delivery 和 ExecutionWorkspaceSelectionRequest。prepared/committed 状态不明时只查询原 ID；不能重建第二 Handle、重复消息/批准、迁移旧 lease request 或默认选择目录。
5. 回收或确认已登记进程，过期 ExecutionClaim 不直接视为失败或成功；capacity reservation 必须等 Handle 和目录资源状态明确后释放。
6. 已有可信 RunnerResult、完成回执和完整 Artifact 的 Attempt 保持终态，不重复执行。RunnerResult 必须与原 AgentInstance、Attempt、Handle generation 和 digest 完全匹配。
7. Runtime 根据账本和可靠证据把未完成 Attempt 标记为 `interrupted`，并保存、对账每个 operation 的 checkpoint set、Runner receipt 和副作用证据。Shell 不写 Attempt 或 Run 状态。
8. Runtime 为 ShutdownRecoveryPlan 中每个可恢复的 source Attempt 幂等确认旧 Attempt 已为 `interrupted/safe_shutdown_process_closed`、旧 AgentInstance 已 stopped 且 `currentAttemptId` 已清除，再在原 TaskExecution 登记 `pendingAttemptKind=recovery`、来源 Attempt 和 Resume command，执行 `paused | interrupted -> provisioning`；已经 terminal failed 的 TaskExecution 不可复活。从未创建 Attempt/launch、旧 pre-launch aggregate 已全部 Event-closed且仍有完整 pending owner 的 `safe_exit_before_launch` 使用独立 `continue_pre_attempt` target，从 `interrupted -> provisioning` 继续同一 owner。它只要求当前 TaskExecution 没有 plan owner，可以与同 Run 的 plan recovery target 并存；新实例没有 recovery lineage，新的 SelectionRequest 引用旧 request，不创建 recovery Attempt或复用旧资源。
9. 统一 pre-Attempt pipeline 为 primary 与每个需要继续的 transient source Handle 建立 replacement AgentInstance、capacity、独立 Grant/assignment。全部必需 assignment 就绪后只创建一个新的 recovery Attempt，清除 pending 字段，并用 `recoveredFromAgentInstanceId` / `recoveredFromAttemptId`、逐 operation `recoveryContexts[]` 保存来源。formal primary recovery 只携带 Attempt recovery pair；每个 recovered transient 必须同时携带当前 replacement parent/新 recovery Attempt/原 SpawnRequest 的 parent-spawn triple，以及旧 transient/source Attempt 的 recovery pair。普通 transient 只有 parent-spawn triple；旧 `parent*` 字段不能承担 recovery pair。
10. recoverable Attempt 带有 `coupledDispatcherCoordinationLeaseIds[]` 时，在同一个 recovery AttemptLaunch prepare 前预创建 higher-generation pending lease 和 dormant channel；同一个 replacement registration/commit 同时恢复 Attempt 和激活 lease，不创建 DispatcherCoordinationLaunch 或第二个 Handle。每个 coordination-only entry 才单独创建 replacement formal AgentInstance、capacity、Grant/assignment、coordination ContextPackage、唯一 DispatcherCoordinationLaunch 和 pending target lease；该 AgentInstance 只携带 coordination recovery triple，parent/spawn 与 Attempt recovery refs 必须为空。reliable committed 后只激活已投递的 dormant lease/token，不创建 TaskAttempt 或 RunnerResult。
11. Runtime 最后执行 startup classification barrier：逐项确认每个 supervisor marker、AttemptLaunch/CoordinationLaunch、Message/WorkerResult/Permission delivery、RunnerHandleRegistration、ExecutionClaim、TaskAttempt/TaskExecution、ShutdownRecoveryPlan entry、`continue_pre_attempt` 和 coordination recovery owner 都已 durable 映射到唯一 canonical 稳定状态/owner。可以继续自动运行的项已绑定唯一 durable claim/launch/owner；需要人工处理的项必须已经稳定为 `interrupted/degraded` 或 matching blocked 状态并创建 typed Attention。barrier 不等待用户 resolve Attention，但不允许遗留未归属 Unknown、临时 owner、未持久化 lineage 或仅存在内存中的决定。只有该 barrier 完成后，Runtime 才通过既有 health/reconciliation ready fact 开放普通 Domain writes；不新增 API、Event 或持久字段。

只有 `resumeOnStartup=true` 的 Run 自动进入上述流程。用户手动 Pause 或 Runtime 已确认的托盘安全退出保持 `resumeOnStartup=false`，重新打开后由用户继续；Resume 进入 `resuming` 屏障时先设为 `true`。强制退出、shutdown 未确认、注销、关机、崩溃中断或 resuming 状态不明时不关闭该标记。

任何跨进程恢复都必须把来源 ExecutionWorkspaceAssignment 和 PermissionGrant 视为校验输入，而不是可复用授权。Runtime 按冻结 RunSnapshot/ExecutionPolicy 与当前 Workspace/平台限制为每个 replacement 重新建立 assignment、独立 grant 和 target ContextPackage，但同一 source Attempt 仍只创建一个 recovery Attempt；无法建立时进入 Attention 和 interrupted/degraded，不启动任何相关 Runner Handle。

自动恢复只允许：

- 操作声明为无副作用，且输入与基线仍匹配。
- 操作声明为幂等，且幂等键、目标状态和 Adapter 恢复能力均可验证。
- Runner 声明并通过验证的 `checkpointResume` 能力提供可靠 continuation ref，能够从已确认 operation 之后继续且不重放更早副作用。

Checkpoint 使用 write-ahead persistence barrier。Adapter 或 platform broker 先通过 Attempt-scoped request channel 提交 phase，Runtime 在同一事务中持久化 RecoveryCheckpoint 和 Event 并返回 durable acknowledgement；外部操作只有在 `dispatched` phase 获得确认后才能释放。无法执行该 interlock 的 operation 按 `unknown` 处理。`dispatched` 表示操作可能已发出，因此宁可产生一次人工核对，也不能因 Runtime 在发送窗口崩溃而重复非幂等副作用。

每个 operation 使用它自己的最高持久化 phase 做恢复判断：

| checkpoint | 自动动作 |
|---|---|
| `before_dispatch` | `restart_before_dispatch`；只有来源遵守 write-ahead interlock 且没有更高 phase 时可用，原操作尚未获准发出 |
| `dispatched | acknowledged` + `none` | `restart_no_side_effect`；从最后安全输入边界继续，并重新校验输入、权限和 Workspace baseline |
| `dispatched | acknowledged` + `idempotent` + 有效幂等键和目标状态 | `retry_idempotent`；使用同一幂等键重试，并重新验证目标状态 |
| `acknowledged` + 可验证 `runnerResumeRef` + Adapter `checkpointResume=true` | `resume_runner`；ref 必须证明 continuation 位于该 operation 之后，并且恢复不会重放更早 operation |
| `committed` + 可验证 `committedResultRef` | `continue_after_commit`；把结果放入恢复计划并明确跳过该操作，再继续 Artifact Contract 校验或后续节点 |
| `dispatched` + `non_idempotent | unknown`，或没有满足上述条件的 `acknowledged` | 暂停并创建 `recovery_operation_unknown` Attention |
| 缺少 checkpoint，或 checkpoint 不覆盖最新操作 | 按 `unknown` 处理，暂停并创建 `recovery_operation_unknown` Attention |

同一最高 phase 命中多个安全条件时，选择顺序固定为 `continue_after_commit`、`resume_runner`、`retry_idempotent`、`restart_no_side_effect`、`restart_before_dispatch`；Runtime 必须把选择依据写入 recovery Event，Adapter 不能自行降级或换策略。

RecoveryCheckpoint 的来源和字段以 [m6-domain-model.md](m6-domain-model.md) 和 [m6-runner-adapter.md](m6-runner-adapter.md) 为准。每个 checkpoint 在执行期间先持久化并追加 `run.recovery.checkpoint_recorded`，恢复时才能引用。Runtime 必须按 operation ID 检查恢复边界之前所有已登记 operation；不能用最大时间、数组末项或最高 operationSequence 代表整个 Attempt。Recovery Attempt 和 Runner RunRequest 的 `recoveryContexts[]` 必须按 operation sequence 携带完整恢复计划：可靠 committed 项也使用 `continue_after_commit` 和结果引用明确跳过，其余项携带 restart、retry 或 resume 策略及适用的原幂等键、目标状态和 Runner resume ref。任一已开始 operation 无法安全分类时不自动启动整个 Attempt。最终分类、计划 digest 和动作写入 `run.recovery.started/completed` payload，不能只写诊断日志。

以下情况必须暂停并创建 Attention：

- 已发送但没有可靠回执的提交、发布、删除或外部写入。
- Workspace 基线已经漂移，无法证明重试仍针对同一输入。
- Adapter 只能恢复对话，不能证明工具调用或外部操作状态。
- 权限、Runner Profile 或 CLI 版本已变化。

Runtime 不能通过“文件看起来已经存在”、终端最后一行或模型自述推断操作成功。

`recovery_operation_unknown` 只能针对具体 operation 提供 inspect、带验证结果引用的 record completed、带未发生证据的 record not completed and retry、End as failed 或 Cancel。任何人工裁决都保存 evidence refs 和 result Event refs；不能把用户选择伪造成 Runner/provider receipt。

interrupted Run 固定按三类互斥入口处理：带 `terminationIntent=cancel` 的 Run 只能由重复 `run.cancel` 或 `attention.resolve(continue_cancel)` 幂等继续同一个 frozen cancel barrier；已经冻结其它 `finalizationOutcome` 的 Run 只能通过 `run.resume` 或 `attention.resolve(continue_finalization)` 幂等继续原 finalization barrier，不能恢复业务或用 `run.end_failed` 覆盖 outcome；两者都不存在时才允许业务恢复，或由 `run.end_failed` 冻结 `terminationIntent=fail` 与 `failed/interrupted_ended` intent。所有 finalization 都只有在 Handle、worker、assignment、capacity 和临时资源全部收敛后提交终态，状态不明时继续保持 `interrupted + degraded`。

## 9. Runner 接入和分发

- 首版内置 `pi`、Codex CLI 和 Claude Code 三个官方 Adapter；`pi` 是默认推荐 Runner。
- 三个 CLI 本体均由用户安装、更新和完成原生登录。Ensemble 不下载 CLI、不保存账号 Token，也不代管认证刷新。
- Adapter 支持声明最低版本和已验证版本范围。范围外显示 `installed_incompatible`；范围内仍必须通过 capability probe。
- RunnerProfile 可以指定可执行文件、非敏感配置目录和环境 secret reference。Workspace 有默认 Profile，Seat 可以覆盖。
- RunnerInstallation 的 `available` 只表示设备安装、版本、平台和原生登录探测通过。Workspace 创建前使用 ephemeral `scopeKind=workspace_creation` RunnerQualification，创建后和 Run 预览再按 policy digest 与 required capabilities 生成独立 qualification；不合格不能改写 installation availability。
- AgentInstance 启动时冻结具体 Profile；修改 Profile 或 Seat override 不替换运行中的身份。
- 首版发布要求三个 Adapter 在 Windows、macOS、Linux 全部通过 supported Runner 资格，共九个真实组合。任何组合失败都会阻塞首版发布，不能降为平台能力矩阵后宣称完成。
- 新 Runner 只有完成正式 Adapter 和统一契约测试后才能进入编排。Terminal 不是绕过 Adapter 接入任意 CLI 的入口。
- Ensemble Runner Adapter Protocol 是 canonical 边界。Adapter 内部可以使用 ACP、官方 SDK、结构化 CLI 输出或 PTY hook，但这些协议不泄漏到 Runtime Domain 和 Client。

## 10. Paperclip 的取舍

Paperclip 对 Ensemble 有参考价值，但只参考 Backend 机制：

| Paperclip 机制 | Ensemble 决定 |
|---|---|
| Adapter contract | 借鉴能力声明、探测和规范化输出；使用 Ensemble 自己的版本化合同 |
| Atomic task checkout / execution lock | 采用 SQLite ExecutionClaim，防止重复派发和恢复竞争 |
| Workspace/worktree resolution | 采用概念，按 Ensemble 的三种执行目录和冻结基线实现 |
| Short-lived run authentication | 采用本机启动令牌和绑定 Runner Handle 的 request channel |
| Structured run logs and sessions | 采用追加事件、长期 Seat Session 和独立 Terminal transcript |
| Orphan recovery | 采用进程登记、父监督、lease 和风险感知 recovery Attempt |
| Secret injection and redaction | 采用 secret reference、最小注入和分层脱敏 |
| Heartbeat-driven execution | 不采用；本机 Runtime 直接监督进程，heartbeat 只用于内部 lease |
| Always-on server and multi-company model | 不采用；首版是当前设备上的单用户桌面产品 |
| Ticket-first information architecture | 不采用；产品主入口仍是组织画布和 Run |
| Budget/cost subsystem | 不进入首版；资源先由并发和派生预算控制 |

## 11. Spike 和发布门槛

以下都是待证明条件，不是文档写下后就算完成：

- 精确固定的Electron/Chromium与签名Rust sidecar在三平台安装、启动、重启、原子升级和卸载；sidecar只从`process.resourcesPath`签名manifest解析。
- Electron app single-instance、同一data root的Runtime datastore lock、第二实例激活和crash/stale-ready回收在三平台成立，任何竞态都不会启动第二scheduler或并发打开SQLite。
- 关闭窗口后托盘继续运行；显式退出、注销和关机不留下无主 Runner。
- SQLite WAL、ExecutionClaim 和 ScheduleFire 在崩溃窗口内不重复执行。
- graceful quit 的 sidecar-wide command-admission fence 与 accepted Draft drain 在零/多 active Run、30 秒 timeout、Force quit 和 crash/restart 窗口成立；startup 在 write-ready 前只重放原 commandId/payload。
- startup write-ready 不在 accepted Draft 子屏障后提前打开；全部 marker/launch/delivery/Handle/claim/Attempt/recovery owner 均已 durable 分类，或进入 interrupted/degraded + typed Attention 后，既有 readiness fact 才允许 Domain writes。
- BrowserWindow/Preload/IPC来源与schema安全、HTTP/WebSocket鉴权、协议协商、Event/Terminal MessagePort sequence/credit/backpressure和stale-port失效成立。
- `pi`、Codex CLI、Claude Code 在三平台均能以同一 Handle 提供 Session、原样 Terminal 和 ContextPackage。
- 三个 Adapter 在三平台真实执行当前 PermissionGrant；无法执行的限制不能用 Prompt 代替。
- formal Seat 空闲休眠、transient worker 回收、系统重启恢复和计划补跑符合本规格。
- 风险感知恢复不会重复非幂等副作用；状态不明时稳定产生 Attention。
- ordinary transient、formal Attempt recovery、recovered transient 和 coordination-only recovery 四种 AgentInstance lineage 组合分别通过持久化/恢复测试；recovered transient 两组 lineage 缺一即拒绝，coordination-only 不生成 Attempt refs。

任一硬门槛被真实平台证据否定时，必须回到产品决策重新裁剪范围，不能加入隐藏的兼容或降级路径。
