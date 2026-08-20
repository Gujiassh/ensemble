# 决策记录

讨论沉淀自 2026-08-17 立项会话。后续变更请追加条目，勿默默改历史结论。

## D001 · 做多角色 Agent 应用，偏高端技术

- **决定**：做 Agent 协作产品（默认可多角色），而不是单聊 bot  
- **澄清**：单 agent 模式合法且完整，仍是 Org Canvas + 契约 + 冒泡，**≠ 单聊 bot**  
- **技术兴趣**：agent 框架、编排、可观测、执行引擎  

## D002 · AI 编排框架锁定 CrewAI；执行不绑死 CrewAI

- **决定（硬锁）**：**AI 多角色编排框架 = CrewAI**（`crewai` Python 包）  
- **用法**：Org tree → CrewAI `Agent` / `Task` / `Crew` **只读投影**；process 支持 sequential / hierarchical  
- **执行**：Runner 适配层；默认 pi；兼容各家 coding CLI；CrewAI 不直接替代 Runner  
- **边界**：CrewAI **不是** UI SSoT，也**不是** org tree 写路径；禁止 Crew 写回编制  
- **原因**：需要成熟的多角色协作语义；重度 coding 与多 CLI 仍走自建 Runner 协议  
- **修订 D002a（2026-08-18）**：用户明确要求「AI 框架用 CrewAI」——从「语义参考」升为 **运行时硬依赖**；依赖写入 `services/runtime/pyproject.toml`  

## D003 · 可视化是一等需求

- **决定**（原始）：可视化为一等需求；角色状态、交付物、handoff 必须可见  
- **修订（D003a · 2026-08-17）**：**被 D008 细化**——产品门面 = **Living Org Canvas**，不再使用 Stageboard/三栏 Flow 作为主叙事  
- **仍有效**：状态/handoff/交付物必须可见；Timeline 仅 History/Debug  

## D004 · 角色可自动拓展

- **决定**：Staffing 机制 + role catalog  
- **MVP**：L1 推荐 + L2 条件自动；L3 后置  
- **约束**：有输出契约、有数量上限、可回放原因  

## D005 · 品牌名 Ensemble

- **决定**：产品名 **Ensemble**  
- **路径**：`/home/cc/code1/ensemble`  
- **副标题方向**：Orchestrate agents like a company / 看得见的多角色协作舞台  

## D006 · 主场景锁定 Issue→小实现

- **决定**：MVP 演示以 bugfix / 小 feature 流水线为主  
- **基础角色模板**：PM、Researcher、Engineer、Reviewer（推荐模板）  
- **修订**：单 agent 同为主路径验收（见 D009、`06-mvp`）  

## D007 · 文档先行

- **决定**：先落 docs，再写业务代码  
- **日期**：2026-08-17  

## D008 · 设计语言 Living Org Canvas

- **决定**：主界面为活组织画布（头像席位、管道光效、节点冒泡、点开档案）  
- **不是**：主时间轴录像带、主聊天瀑布、冷 DAG 调试器  
- **配套**：Stage/Work/Debug 动效强度；档案负责深读与 prompt 注入  
- **文档**：`docs/08-design-language.md`  

## D009 · 无限套娃 / 单 agent / 多工作区 / 多分组

- **决定**：  
  - 组织树 **产品层不设最大深度**（机器与可读性约束）  
  - **单 agent** 一等公民  
  - **多 Workspace** 隔离并行  
  - **多 Group**（可嵌套）  
- **文档**：`docs/08-design-language.md` §3–10  

## D010 · 桌面与技术选型

- **决定（初）**：Tauri 2 + Web UI；纯 Rust GUI 不做主界面；Electron 回退；Python 编排；默认 pi  
- **修订 D010a（2026-08-18）**：**全栈锁定**——  
  - 壳：**Tauri 2（Rust）**  
  - UI：**React + TypeScript + Vite + @xyflow/react**  
  - **关闭** Vue/Vue Flow 主线二选一  
  - 纯 Rust GUI 仍不做主界面；Electron 仅回退  
- **文档**：`docs/09-tech-and-desktop.md`  

## D011 · 审计后文档收敛（2026-08-17）

- **来源**：设计语言审计 + 技术选型审计（双 explore subagent，均为 ACCEPT_WITH_FIXES）  
- **已修（首轮）**：`06-mvp`、`05` roster 挂载、`00`、`03`、D003a  

## D012 · 历史口径全量对齐 + 事件 schema（2026-08-18）

- **决定**：仓库内文档统一到 Living Org Canvas 现行口径；旧 Stageboard 仅归档映射  
- **已修**：README、01–07、08 手势、09↔10、06 M0  
- **新增**：`docs/10-events-schema.md`  

## D013 · 前端/壳栈最终锁定（2026-08-18）

- **决定**：用户确认采用 **Tauri + Rust 壳** 路线；前端画布锁定 **React + @xyflow/react**  
- **文档**：`09` 全文、`06` 技术表、`00`/`03`/`README`、D010a  
- **审计**：第二轮双 agent 均为 **ACCEPT_WITH_FIXES**（无严重项）  

## D014 · 第二轮审计钉死项（2026-08-18）

- **已补**：套娃验收 ≥1；事件真源统一 10；`tree.json`+`edges[]`；角标 busy 映射；边 vs packet；`11-ui-commands.md`；staffing.applied 样例  
- **结论**：文档可进入 **M1**；实现期按 10/11 扩展字段时升 schema 版本  

## D015 · M1–M4 Spec + 强制开发审计配对（2026-08-18）

- **决定**：M1–M4 详细 spec/task 落 `docs/specs/`；多 agent 并行与审计规程落 `docs/13-multi-agent-workflow.md`  
- **强制**：每个开发阶段（及每个并行 lane）结束必须有独立 Audit agent；失败回原 Dev 返工  
- **并行门禁**：M1 骨架 ACCEPT 后方可多 worktree 并行

## D016 · Spec 审计修复（2026-08-18）

- 三路审计（M1/M2、M3/M4、并行规程）均为 ACCEPT_WITH_FIXES  
- 已修：G1=完整 M1 ACCEPT；命令路径对齐 11；Group 过滤 P0；总审计强制；M3 契约表+inject P0；M4 安全清单与四人矩阵；所有权含根文件与 mock 单主责

## D017 · CrewAI 作为 AI 框架硬锁（2026-08-18）

- **决定**：栈表、README、M3/M4、runtime 依赖均显式写 **CrewAI**  
- **落地**：`services/runtime` 声明 `crewai`；投影模块 `ensemble_runtime/crew/`  
- **M3**：可先 mock 顺序任务，但投影接口与依赖必须存在  
- **M4+**：four_crew 等模板经 CrewAI Crew 投影执行 handoff  
- **文档**：`09` T009 · `12` · `03` · specs m3/m4 · `docs/ssot/crewai.md`

## D018 · 技术栈余项全量判决（2026-08-18）

- **触发**：用户要求同步扫未锁技术项并判决 + 审计  
- **真源**：`docs/ssot/stack.md`；决策 ID **T010–T021** 写入 `09`  
- **本轮硬锁**：zustand · Tailwind v4 · lucide-react · motion(仅 packet) · packages/protocol 唯一 · FastAPI · Vitest · 数据根规则 · MIT · React 18 · 禁 WS 默认 · 禁 SQLite MVP  
- **明确延后**：自托管字体、Playwright E2E、SQLite 索引、第二 coding CLI、完整 design tokens 文件、Electron 触发  
- **审计**：`docs/specs/reviews/STACK-lock-2026-08-18.md`（双 explore 初判 ACCEPT_WITH_FIXES → 修后 **ACCEPT**）
- **补锁**：T022 Python venv+pip；T023 runners/ 根路径；清单/字体/SSE 措辞/Tailwind 接线已清

## D019 · V2 产品重建与旧实现解除锁定（2026-08-18）

- **触发**：用户明确允许前端、Backend 和现有数据流全部舍弃重写，目标改为“优雅简约的界面 + 灵活编排功能”
- **产品目标**：跨平台、本地优先的 Agent 编排桌面应用；单 Agent 与多 Agent 都是正式路径
- **Workspace**：创建时选择项目目录、默认 Runner 和默认 Agent 输出语言；Runner 不再是顶栏临时模式
- **设计语言**：画布优先、浅色优先、主题可变、朱红默认主信号、Seat 去卡片化、Handoff 方向脉冲、按需检查器
- **明确排除**：不使用产品名词源作为界面隐喻；不保留旧深色 HUD、固定三栏和开发控件堆叠
- **配置**：Theme、Density、Motion、UI Locale 属于设备偏好；Workspace 保存默认 Runner 和默认输出语言；Run 启动时冻结执行配置
- **国际化**：`zh-CN`、`en-US` 首发；UI Locale 与 Agent output Locale 解耦
- **平台**：Windows、macOS、Linux 独立安装；不要求用户安装 Python、Node 或其它开发环境
- **兼容性**：不兼容旧演示 UI、API 和数据，不添加迁移或兼容层
- **旧决策处理**：D010–D018 的具体技术硬锁仅保留为 M0–M5 历史记录；M6 可重新选择前端、Backend、编排框架、通信协议和持久化方案
- **当前真源**：`01-product`、`08-design-language`、`ssot/design-system`、`ssot/i18n`、`ssot/platform-adaptation`、`specs/m6-product-rebuild`

## D020 · M6 业务规格先行（2026-08-18）

- **状态**：规格草案已落盘，产品确认待完成；不等同于技术实现硬锁
- **新增真源**：`specs/m6-domain-model.md`、`specs/m6-orchestration-interaction.md`、`specs/m6-run-operations.md`
- **内容**：明确 Organization 与 Workflow 分离、Workspace 创建、Runner 探测、Draft 自动保存、启动时 Snapshot、Run/Task 状态机、Attention 幂等、Artifact 版本和崩溃恢复
- **待确认方案**：无可用 Runner 时是否阻止创建、组织拖动与层级移动分离、冲突只提供重载/模板、Pause 安全边界、下游已开始后的重跑方式、实时补充指令能力

## D021 · V2 实施先完成架构与交付契约（2026-08-18）

- **决定**：V2 不沿用 M0–M5 的实现顺序；先完成架构边界、Runner Adapter、Event/Command、Backend 进程形态和跨平台打包 Spike，再进入新桌面壳和业务实现。
- **原因**：Backend 进程形态会影响启动、认证、数据目录、Runner 分发和退出恢复；协议未冻结前实现 UI 会产生第二套状态和兼容结构。
- **当前真源**：`specs/m6-architecture.md`、`specs/m6-runner-adapter.md`、`specs/m6-events-commands.md`、`specs/m6-platform-packaging.md`、`12-dev-plan.md`。
- **约束**：旧 `03`、`06`、`09`、`10`、`11` 和 M1–M5 specs 只作为历史参考，不得作为新代码的契约来源。

## D022 · CrewAI 保持多角色运行时约束（2026-08-18）

- **决定**：V2 多角色编排继续使用 CrewAI；CrewAI 只负责从组织与 Workflow 投影协作语义，不拥有 Org/Workflow 写路径，也不替代 Runner。
- **原因**：多角色协作需要稳定的 Agent、Task、Crew 投影语义，同时必须保持编码执行引擎可替换。
- **范围**：单 Agent 可以不实例化完整 Crew；多角色 Run 必须保留 CrewAI 投影路径。`pi` 仍是默认 Runner。
- **覆盖**：本条覆盖 D019 中“可以移除 CrewAI”的开放项；其它前端、Backend 进程形态、协议和存储选择仍按 M6 Spike 决定。

## D023 · F1 拆分为 Client Foundation 与 Desktop Integration（2026-08-18）

- **决定**：F1 分为 F1-A 前端基础和 F1-B 桌面接线。F1-A 可以在 F0 进程形态决策前实施；F1-B 必须等待 F0 关闭。
- **F1-A**：实现 App Shell、Design System、设备偏好、i18n、Workspace 创建交互和 typed gateway seam；生产入口不使用测试 adapter，不声称 Workspace 已持久化。
- **F1-B**：接入 Tauri 平台偏好、原生目录选择器、选定的 Runtime transport、启动/退出生命周期和 bundled frontend 验证。
- **原因**：视觉与交互基础不需要等待 Backend 选型，但固定端口、仓库路径、开发 `.venv` 或临时 API 一旦进入产品入口，会迫使后续增加兼容层。
- **真源**：`specs/f1-shell-design-system.md`、`12-dev-plan.md`。

## D024 · 多 Agent 首个闭环、执行隔离与权限策略（2026-08-19）

- **首个真实运行**：第一条对外可验收 Runtime 路径直接验证多个 formal Seat、并行 AgentInstance、至少一个 transient worker、跨 Runner 上下文交接，以及同实例 Session/Terminal；单 Agent 只是同一模型的退化路径。
- **执行目录**：分发 Agent 可以在 `shared_workspace`、`git_worktree`、`temporary_directory` 中选择并说明原因。Runtime 校验基线、平台能力、权限和资源后创建不可变分配；冲突进入 Review/Attention，不静默覆盖。
- **结果整合**：worktree 和临时目录默认先检查再应用；可配置 `auto_if_clean | manual`。每次应用记录源 Change Set、目标基线和结果，失败不能留下部分写入。
- **长期 Session**：Seat Session 长期存在，可以承载多个 Direct Task/Run 并允许自由对话；每条消息仍绑定 Task/Run，支持附件、搜索、导出和恢复。
- **派生策略**：默认 `auto`，可配置 `auto | ask | deny`。默认预算为 Workspace 同时 4 个实例、单父实例 2 个子 worker、派生深度 2、单 Run 8 个原始实例谱系节点、每条谱系 3 次 recovery replacement；运行中提高预算必须形成 Amendment。恢复 replacement 不重复消耗原始谱系计数。
- **Runner 资格**：正式 supported Runner 必须同时提供 Session、原样 Terminal 和 Context package 投递，并且两种视图连接同一 Runner Handle。Ensemble 不维护 CLI slash command 推荐镜像。
- **权限**：提供 `read_only`、`workspace_write`、`selected_paths`、`full_access` 四档；网络、外部进程、Workspace 外写入、破坏性命令和外部发布独立使用 `allow | ask | deny`。完全权限持续可见但不关闭脱敏。
- **权限默认值**：`workspace_write`；网络和外部进程允许，Workspace 外写入拒绝，破坏性命令和外部发布需确认。细粒度审批必须由平台 broker 或 CLI 官方 hook 执行，不能靠 Prompt 或 Terminal 读屏。
- **额外目录**：通过原生选择器授权，并在文件树中显示为独立 Allowed paths。完全权限不会触发全盘扫描，未登记目录外的 Change Set 只能标记为 partial。
- **秘密与历史**：凭据使用操作系统安全存储，业务记录只保存引用；结构化结果默认脱敏，Terminal 原始输出尽力脱敏并默认保留 30 天、每 Run 100 MB。消息、决策、谱系、变更和交付结果可搜索、导出和恢复。
- **用户文案**：界面优先使用“交付结果”“变更”“交给下一任务”，Artifact、Change Set、Handoff 和 ContextPackage 仅作为内部协议名。
- **真源**：`specs/m6-agent-session-collaboration.md`、`specs/m6-execution-workspace-security.md`、`specs/m6-domain-model.md`、`specs/m6-run-operations.md`、`12-dev-plan.md`。

## D025 · 本机 Runtime、后台调度与官方 Runner（2026-08-19）

- **运行范围**：首版只控制当前设备，不做远程 Runtime、账户、云中继或跨设备访问。
- **后台行为**：关闭窗口进入系统托盘，活动 Run、持久化队列和定时计划继续；显式退出默认安全暂停并终止进程，首版不安装系统级服务。
- **重启恢复**：重新登录后按策略启动 Runtime；已完成工作不重跑，只有无副作用、可验证幂等或有可靠 checkpoint 的工作自动恢复，状态不明的副作用等待用户。
- **计划**：首版支持队列和 `cron | interval`，不做文件监听、Webhook 或外部 API 触发。错过计划默认补最新一次；后台超出显式预授权时暂停并通知。
- **进程形态**：选择 Tauri 托盘 supervisor + 独立 Rust Runtime sidecar + SQLite WAL 事件账本；Client 经 Tauri IPC，由 Shell 使用认证 loopback HTTP/WebSocket 连接 Runtime。
- **Adapter 协议**：Ensemble Runner Adapter Protocol 是 canonical 边界；ACP、SDK、结构化 CLI 或 PTY hook 只作为 Adapter 内部实现。
- **首版 Runner**：官方 Adapter 固定为 `pi`、Codex CLI 和 Claude Code。三个 CLI 均由用户安装、更新并原生登录；Ensemble 不捆绑 CLI 或代管账号 Token。
- **发布门槛**：三个 Runner 必须在 Windows、macOS、Linux 全部通过 Session、原样 Terminal、ContextPackage、权限和恢复资格，共九个真实组合。
- **Profile 与进程**：Workspace 有默认 Runner Profile，Seat 可覆盖；AgentInstance 启动后冻结 Profile。formal 实例无活动工作时默认 30 分钟休眠，transient worker 收尾后退出。
- **扩展边界**：首版不加载第三方 Adapter；没有正式 Adapter 的 CLI 不能通过 Terminal 旁路进入编排。
- **真源**：`specs/m6-local-runtime-scheduling.md`、`specs/m6-platform-packaging.md`、`specs/m6-runner-adapter.md`、`ssot/platform-adaptation.md`。

## D026 · V2 不再依赖 CrewAI/Python Runtime（2026-08-19）

- **决定**：V2 生产编排由 Ensemble Runtime 的 Organization、Workflow、RunSnapshot、Event、ExecutionClaim 和 Adapter contract 直接实现，不再把 CrewAI 或 Python 作为运行时依赖。
- **原因**：当前领域模型已经拥有任务依赖、并行、Gate、Join、Rework、派生、权限和恢复语义；同时保留 CrewAI 状态机会形成两个调度真源，削弱可重放和跨 Runner 一致性。
- **覆盖**：本条覆盖 D002、D017 和 D022 的 CrewAI 硬锁。相关条目只作为 M0-M5 历史，不再约束 V2。
- **保留**：Tauri 2、React、组织画布和 Runner 可替换方向不受影响。

## D027 · 调度、恢复与命令协议收口（2026-08-19）

- **计划输入**：Schedule 引用不可变 ScheduleLaunchTemplate，冻结 OrchestrationVersion、输入、Runner Profile 绑定与非敏感配置、输出语言和 ExecutionPolicyVersion；触发时不回读 Workspace 默认值。
- **触发语义**：Cron 为五字段分钟粒度，按 IANA timezone 计算并跳过 DST gap、fold 只触发较早 instant；Interval 最小 60 秒，按 UTC elapsed duration 计算。Misfire、上限、overlap 和 evaluation cursor 均可重放。
- **计划生命周期**：普通界面只归档、不永久删除。Queue blocked 修复创建新的不可变 policy/launch spec，并通过 Event 记录 old/new ref；未来 fire 的配置修改必须创建新 template。
- **托盘边界**：首版托盘只有 Open 与 Quit；Pause/Resume 属于具体 Run，不建设设备级 Pause all 状态流。
- **退出所有权**：Runtime 独占 Attempt/Run 状态写入。确认安全退出设置 `resumeOnStartup=false`；强制或未确认退出保持 `true`，Shell 只写 supervisor marker 并回收进程。
- **命令协议**：唯一幂等标识为 `commandId`（JSON `command_id`）；Draft 和 Run 并发分别使用 `expected_revision` 与 `expected_sequence`。
- **恢复安全**：RecoveryCheckpoint 按 operation 追加，使用 durable `checkpoint_commit` write-ahead barrier；Recovery Attempt 与 RunRequest 通过 `recoveryContexts[]` 携带完整有序的 operation 计划、来源 checkpoint、策略和原幂等键，不能用最新一条输出或 checkpoint 代表整个 Attempt。
- **真源**：`specs/m6-domain-model.md`、`specs/m6-events-commands.md`、`specs/m6-runner-adapter.md`、`specs/m6-local-runtime-scheduling.md`、`specs/m6-run-operations.md`。

## D028 · Runtime 协议终审收口（2026-08-19）

- **单实例所有权**：同一 canonical data root 只允许一个 Tauri supervisor 和一个 Runtime。Shell 与 Runtime 分别持有 OS supervisor/datastore lock；第二实例只激活现有窗口，首版不做 leader election。
- **Session 控制**：结构化控制只使用 Run Pause、Resume、Cancel 和 Retry；CLI interrupt 留在 Terminal 原生字节通道，不能伪装成未定义的 Domain Command。
- **消息入库**：Agent 回复通过结构化 `assistant_message` RunnerSignal 进入长期 Session；流式 delta、Terminal 文本和 `produced_output` lifecycle 不能直接生成 canonical Message。
- **事件可重放**：新增 queue reorder 和 Handoff supersede 事件；Attention 持久状态简化为 `open | resolved`，失败提交不制造中间 Domain 状态；Artifact 人工确认统一走 Gate/Attention。
- **Run 谱系**：基于既有 Run 或从 Task 重新开始的新 Run 显式保存来源 Run、Task、Attempt 和冻结 Snapshot/Artifact refs，不能按“最新结果”猜测。
- **恢复计划**：`recoveryContexts[]` 是按 operation sequence 排序的完整恢复计划。可靠 committed 项也必须携带 `continue_after_commit` 和结果引用；`resume_runner` 仅在 Runner 具备经验证的 checkpoint resume 能力时可达。
- **Resume 屏障**：多 Handle Run 从 `paused` 先进入 `resuming` 并恢复自动对账标记；部分失败时反向 re-pause，补偿失败或状态不明进入 `interrupted + degraded`，不能让已运行的 Runner 隐藏在 paused 状态下。
- **真源**：`specs/m6-domain-model.md`、`specs/m6-events-commands.md`、`specs/m6-runner-adapter.md`、`specs/m6-local-runtime-scheduling.md`、`specs/m6-agent-session-collaboration.md`、`specs/m6-platform-packaging.md`、`ssot/platform-adaptation.md`。

## D029 · 调度线性化、worker 回传与恢复谱系（2026-08-19）

- **Schedule 并发**：Schedule 使用单调 generation 和稳定 config digest。配置命令、Run now、live tick 与 catch-up 共用 per-schedule SQLite 写事务；stale pass 整批重算，不能留下部分 fire 或错误 cursor。
- **Queue 确定性**：eligible Queue Item 按 `priority DESC, COALESCE(notBefore, createdAt) ASC, createdAt ASC, queueItemId ASC` 领取；reorder Event 保存最终顺序，相同快照在重启后结果一致。
- **派生 Runner**：worker Profile 省略时继承父实例，显式选择只能来自 RunSnapshot 冻结 allow-list；不可用时 blocked，不按设备当前状态猜 Runner。
- **worker 上下文与结果**：每个 transient worker 有独立 assignment、父权限交集 grant 和 target ContextPackage。worker lifecycle 只终结 worker；WorkerResult 经 return contract 校验和 WorkerResultDelivery 回执交还父实例，不能直接完成父 Task。
- **终态屏障**：父 Attempt 提交终态前关闭新 spawn，并确认所有 worker Handle 已终态或回收、结果和变更已冻结、目录已释放。Run 终态后不允许遗留后台副作用。
- **恢复聚合**：ShutdownRecoveryPlan 的 `liveHandles[]` 覆盖全部将销毁 Handle，`inFlightLaunches[]` 覆盖尚无 registration 的 process candidate，`unresolvedCleanupSubjectRefs[]` 覆盖其它状态不明资源；`recoverableAttempts[]` 与 `coordinationRecoveries[]` 对 handle/launch records 全局互斥。Dispatcher Attempt 与 lease 共用 Handle 时，record 只归 Attempt entry，lease 记入 `coupledDispatcherCoordinationLeaseIds[]`；只有没有 recoverable business Attempt owner 的 lease 才进入 coordination recovery。跨进程 Attempt 恢复只创建一个 recovery Attempt，每个 replacement 使用独立 recovery refs、新 assignment、grant 和 target ContextPackage。
- **恢复预算**：单 Run 默认 8 个原始实例谱系节点；recovery replacement 不重复消耗该计数，每条谱系默认最多恢复 3 代，超限进入 Attention。
- **真源**：`specs/m6-domain-model.md`、`specs/m6-run-operations.md`、`specs/m6-runner-adapter.md`、`specs/m6-events-commands.md`、`specs/m6-local-runtime-scheduling.md`、`specs/m6-platform-packaging.md`。


## D030 · M6 Runtime 最终协议补全（2026-08-20）

- **显式图语义**：End 固定声明 `outcome=succeeded | failed`，失败 End 必须有稳定 `resultCode`；Optional Task 通过显式 `skipped` Transition 继续；blocked Join 必须提供 retry/rework source 或 fail Run，不能形成无动作死锁。
- **运行中变更**：`run.amend` 是唯一 Run Amendment 命令，原子创建 RunAmendment 和不可变 Snapshot 后代，只影响未开始部分；任一失败不部分应用。`run.end_failed` 只接受既无 cancel intent、也无已冻结 finalization outcome 的 interrupted Run。
- **Direct Task**：使用 `completionPolicy=explicit_close`；每轮用户消息创建一个 Attempt，单轮结束后 Run 保持 idle，`direct_task.end` 或默认 1800 秒 idle timeout 才请求成功关闭。终态 Direct Run 不复活。
- **目录和容量**：Runtime 先创建 TaskExecution，原子占用 capacity、创建 target AgentInstance 和 PermissionGrant，再发带 digest 的 ExecutionWorkspaceSelectionRequest；formal Dispatcher lease 或 transient parent Attempt 用同 request ID/digest 的结构化 selection 回答。超时、冲突或 unknown 不回退默认目录，capacity 直到 Handle 与资源释放才回收。
- **Runner 资格**：RunnerInstallation availability 只表示设备安装、版本、平台和登录；Workspace 创建前、Workspace 和 Run preview 使用独立 RunnerQualification 与 policy/requirements digest，不把业务不合格写回设备状态。
- **启动和结果**：所有首轮、续轮和 recovery Attempt 都使用 AttemptLaunch 的 `prepare_attempt_launch -> commit_attempt_launch -> query_attempt_launch`；新 process 在 commit 前保持 input fence。RunnerResult 绑定 result ID、AgentInstance、Attempt、Handle generation 和 digest，晚到结果不能跨 Attempt 套用。
- **消息与权限**：conversation 和 instruction 统一使用 `deliver_message`、`message_receipt`、delivery ID 和 unknown 语义。`ask` operation 使用 PermissionOperationRequest 和 approve-once PermissionDecisionDelivery；批准不扩大 Grant，unknown receipt 不自动重发。
- **退出和取消**：安全退出先为全部非终态 Run建立 durable shutdown fence，不能按是否已有 process 过滤。只有存在 registration、in-flight launch 或 cleanup Unknown 的 Run创建 ShutdownRecoveryPlan并收集 typed evidence；plan 创建与 process-free aggregate cleanup 正交。同 Run 即使已有 plan，也要通过 Event 收敛未被 plan owner 覆盖的旧 selection及其 open Attention、assignment、Grant、AgentInstance、capacity 和 claim，TaskExecution 以 `safe_exit_before_launch` 保留同一 pending owner。Run completion 等待两类工作，后续 Resume 可同时处理 plan recovery 与 `continue_pre_attempt`。每个 Run都追加带 fence、可选 plan ref、`resumeOnStartup=false` 的 completion Event。任一 Unknown 保持 true 且进入 marker 对账；cancel cleanup unknown 只能继续 cancel。
- **历史**：canonical Workspace Event ledger 永不删除、重排或截断；历史清理只删除独立正文/blob/index，并保留可重放的 typed tombstone。Attention 通过 typed `subjectRefs[]` 精确引用 request、delivery、launch 和结果对象。
- **真源**：`specs/m6-domain-model.md`、`specs/m6-run-operations.md`、`specs/m6-runner-adapter.md`、`specs/m6-events-commands.md`、`specs/m6-agent-session-collaboration.md`、`specs/m6-execution-workspace-security.md`、`specs/m6-local-runtime-scheduling.md`、`specs/m6-platform-packaging.md`。

## D031 · M6 执行身份与协调租约收口（2026-08-20）

- **Task activation**：Task 由 TaskExecution 承载从依赖满足、capacity、目录选择、blocked 到终态的完整生命周期；Attempt 只在 assignment 成功后创建。Retry/Recovery 留在同一 activation，Rework 创建新 activation。
- **Dispatcher**：Dispatcher 是普通业务 Task，其 Attempt 可以终态化；持续 formal 目录协调由绑定 Run、AgentInstance、Handle generation、Grant 和 capability scope 的 DispatcherCoordinationLease 承担。旧 lease/token 不跨 Handle generation 复用。
- **派生身份**：每个 transient 请求先创建 canonical SpawnRequest；worker AgentInstance、SelectionRequest、ContextPackage、WorkerResult 和 delivery 全部回指该 ID，不能从数组顺序或最近实例猜测。
- **安全退出**：ShutdownRecoveryPlan 只记录 process/Unknown reconciliation；`liveHandles[]`、`inFlightLaunches[]` 和 `unresolvedCleanupSubjectRefs[]` 保存真实 candidate。所有非终态 Run都先进入 fence；除 idle Direct 外，running Run先进入 pausing。typed evidence 后才写 stopped、终态化 source Attempt、清除 `currentAttemptId`、撤销 target lease并释放资源。同 Run 内未被 plan owner 覆盖的 process-free aggregate仍逐项 Event-closed，pre-Attempt owner通过 `continue_pre_attempt` 创建普通新实例恢复。Run completion 等待两类工作；Resume target set 可以同时含 plan recovery 与 `continue_pre_attempt`。idle Direct 下一轮创建 replacement AgentInstance，不制造 recovery Attempt。
- **Handle 身份与协调启动**：opaque Handle 通过 RunnerHandleRegistration 获得稳定 Domain identity。两类 recovery owner 对 record 全局互斥；Dispatcher business Attempt 与 coordination lease 共用已登记 Handle，或 AttemptLaunch 已进入 prepare、pending lease 已创建但尚无 registration 时，都由 Attempt entry 独占 record并记录 coupled lease。attempt-kind in-flight record 冻结完整 pending lease IDs；matching launch termination revoke pending lease但保留原 owner。Resume 用同一个 AttemptLaunch、registration 和 commit 同时恢复业务与激活 replacement lease。只有没有可恢复业务 Attempt owner 的 Dispatcher replacement 使用独立 DispatcherCoordinationLaunch；该路径不创建 TaskAttempt 或 RunnerResult。
- **失败、重做与权限**：exception Retry 原子终结旧 Attempt，在原 TaskExecution 登记唯一 pending retry 后进入统一 pre-Attempt pipeline；`amend_and_rework` 原子创建 Snapshot 后代和新的 TaskExecution activation，再走同一 pipeline。两者都不能直接留下无 assignment 的 Attempt。普通 recovery 失败保持 interrupted。活动 Handle 禁止原地扩大 Grant，只有未启动工作可以通过 Amendment 原子替换；普通撤销/到期追加 `permission.grant.status_changed` 并同步失效依赖 lease/channel。
- **终结意图**：决定性 outcome 在 cleanup 前冻结为不可覆盖的 finalization intent。cancel intent 只能继续 cancel；已有 finalization outcome 只能继续原 barrier；两者都不存在的 interrupted Run 才能业务恢复或使用 `run.end_failed`。
- **真源**：`specs/m6-domain-model.md`、`specs/m6-run-operations.md`、`specs/m6-runner-adapter.md`、`specs/m6-events-commands.md`、`specs/m6-local-runtime-scheduling.md`。
