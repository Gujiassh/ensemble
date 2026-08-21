# M6 Adopted Runtime Patterns

**状态**：产品与协议基线（2026-08-20）
**范围**：从 Herdr、Orca 等同类工具吸收的运行、协作与检查能力
**原则**：采用可验证的能力，不复制竞品的信息架构、调度真源或产品定位

Ensemble 的核心仍是用户可视化定义、由 Runtime 执行、可保存复用的正式 Agent Workflow。终端、worktree、文件和 Diff 是执行与检查工具，不取代 Organization、Seat、Task、Transition、Run Snapshot、Artifact Contract、Attention 和恢复协议。

## 1. 已采用能力

| 来源模式 | Ensemble 能力 | Canonical 规格 | 实施阶段 | 明确不采用 |
|---|---|---|---|---|
| Herdr 的简洁 Agent 状态 | `working | blocked | done | idle | unknown` 的活动投影；业务状态、健康和结果继续分开 | [m6-agent-session-collaboration.md](m6-agent-session-collaboration.md)、[m6-domain-model.md](m6-domain-model.md) | F3-A | 不把终端动画、最后输出或 Agent 自述当成 Task 状态 |
| Herdr 的 PTY/Agent 检测 | canonical Runtime state、结构化 hook/RPC、Adapter lifecycle、provider session metadata、PTY heuristic 的证据等级 | [m6-runner-adapter.md](m6-runner-adapter.md) | F3-A | 不让 heuristic 决定成功、权限、Artifact 或恢复 |
| Orca 的 Dispatch/Worker 与 Handoff | transient supervised dispatch 和正式 ownership handoff 使用两套既有语义 | [m6-agent-session-collaboration.md](m6-agent-session-collaboration.md)、[m6-domain-model.md](m6-domain-model.md) | F3-B | 不静默转移活动 Task owner，不让 worker 直接完成父 Attempt |
| Herdr/Orca 的长驻终端与 worker 留存 | Handle 登记创建/控制权，并在 Attempt 后显式 `reuse | retain | release` | [m6-domain-model.md](m6-domain-model.md)、[m6-runner-adapter.md](m6-runner-adapter.md) | F3-A/F3-C | 不把 retained Handle 变成无归属新工作入口，不让外部 Terminal 旁路接入正式编排 |
| Orca 的 worker receipt | RunnerResult 返回 Artifact candidate、Change Set、verification 和 unresolved item 的结构化引用；Runtime 校验后创建正式 Artifact | [m6-runner-adapter.md](m6-runner-adapter.md)、[m6-domain-model.md](m6-domain-model.md) | F3-A/F3-B | 不以 summary、Terminal 尾行或模型自述替代完成回执 |
| Orca 的 Agent 操作约定 | ContextPackage 携带版本化协调合同、允许操作和 completion receipt schema | [m6-agent-session-collaboration.md](m6-agent-session-collaboration.md)、[m6-runner-adapter.md](m6-runner-adapter.md) | F3-A | 不把注入 Prompt 当成权限或协作真源 |
| Herdr/Orca 的 detach 与恢复 | 分开声明 Client detach、窗口到托盘、Runtime 退出/崩溃、CLI resume 和 transcript replay | [m6-run-operations.md](m6-run-operations.md)、[m6-local-runtime-scheduling.md](m6-local-runtime-scheduling.md) | F0 Spike/F3-C | 不把 UI 恢复、对话回放或 transcript replay 宣称为业务执行恢复 |
| Herdr 的原样终端 | Session 保持 Ensemble 基础能力，Terminal 保留 CLI 原生 `/` 命令和 TUI | [m6-agent-session-collaboration.md](m6-agent-session-collaboration.md) | F3-A | 不维护 Runner-specific slash-command 推荐镜像 |
| Orca 的 worktree 与普通目录 | Git 或非 Git shared project root、Git worktree 和 temporary directory 都是一等执行目录 | [m6-execution-workspace-security.md](m6-execution-workspace-security.md)、[m6-run-operations.md](m6-run-operations.md) | F3-A/F3-B | 不把每个新 worker 强制映射为新 worktree，也不新增第四种目录模式 |
| Orca 的 Diff review | 对不可变 Change Set 建立行内评论与 Review thread，并把选定反馈冻结为 DiffReviewBundle 后送入 Rework | [workspace-output-inspection.md](workspace-output-inspection.md)、[m6-domain-model.md](m6-domain-model.md) | F3-C | 不扩张为代码编辑器、Git stage/commit 或冲突编辑器 |
| 长时间运行 worker 的等待模型 | long-wait timeout 是检查点；heartbeat/输出只证明 liveness；结构化完成与可靠终止分别结算业务结果和进程状态 | [m6-runner-adapter.md](m6-runner-adapter.md)、[m6-run-operations.md](m6-run-operations.md) | F3-A/F3-C | 不因长时间无输出自动判失败，也不因持续输出自动判成功 |

## 2. Handle 留存约束

`retain` 只用于用户明确要求的现场调试或检查：

- 只允许不受 coordination protection 的 formal AgentInstance；transient worker 和 coordination-only Handle 必须 release。
- active/rotating lease、面向同一 continued Handle 的 pending replacement lease/launch 或未终态 CoordinationLaunch 会保护 formal Handle；Runtime 自动记录 reuse，保护可靠终结前不允许用户 retain/release 或 idle stop。
- Handle 继续绑定原 `PermissionGrant` 和 `ExecutionWorkspaceAssignment`。
- Handle 继续占用 capacity，直到可靠 release/termination evidence 落盘。
- Runtime 关闭业务消息、spawn、Artifact、Handoff 和 completion receipt 接收；raw Terminal 只读/input-fenced，只允许 Adapter 支持的 typed、side-effect-free inspection operation。
- retained 输出只能进入诊断或受限 transcript，不能产生新的业务工作或改变已经结束的 Attempt。
- 后续复用必须创建正常 AttemptLaunch，并重新校验 Run、Task、Profile、目录、权限和 ContextPackage。
- 不受 coordination protection 且尚未被新 AttemptLaunch 消费时，初始 reuse 可以改为 retain/release；retain 只允许改为 release。
- liveness 或 cleanup 不明时进入 Attention，不能把 Handle 当作 idle、released 或 reusable。

## 3. 证据边界

活动状态的证据优先级从高到低为：

1. Canonical Runtime state。
2. Runner 官方结构化 hook 或 RPC。
3. Adapter 管理的 lifecycle 与 receipt。
4. 已验证的 provider session metadata。
5. PTY/TUI heuristic。
6. `unknown`。

低等级证据可以改善界面在场感，但不能写入 Task/Attempt 终态，不能批准权限，不能验证 Artifact，也不能决定副作用恢复。一个更高等级证据与 heuristic 冲突时，界面必须采用更高等级结果并保留诊断。

## 4. 产品边界

Ensemble 不复制 Orca 的全栈 Agent Development Environment，也不复制 Herdr 的 terminal-first workspace。首版继续排除：

- 内置代码编辑器和完整 Git 客户端。
- 浏览器、SSH、移动端、GitHub/Linear 等集成套件。
- Run 自行决定 worker placement 或并发的隐式调度。
- 外部任意 Terminal 直接登记为 formal AgentInstance。
- 由 Prompt、自述、终端文本或文件名推导业务事实。

这些边界确保吸收后的 Ensemble 仍以可视化、可复用、可审计的正式 Workflow 为产品中心。
