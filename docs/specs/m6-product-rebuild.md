# M6 Spec — Product Rebuild

**状态**：Electron生产壳实施基线（2026-08-21）· 独立审查待完成 · 实现暂停
**真源**：[../01-product.md](../01-product.md) · [../08-design-language.md](../08-design-language.md) · [../ssot/design-system.md](../ssot/design-system.md) · [../ssot/i18n.md](../ssot/i18n.md) · [../ssot/platform-adaptation.md](../ssot/platform-adaptation.md) · [m6-domain-model.md](m6-domain-model.md) · [m6-orchestration-interaction.md](m6-orchestration-interaction.md) · [m6-run-operations.md](m6-run-operations.md) · [m6-agent-session-collaboration.md](m6-agent-session-collaboration.md) · [m6-execution-workspace-security.md](m6-execution-workspace-security.md) · [m6-architecture.md](m6-architecture.md) · [m6-runner-adapter.md](m6-runner-adapter.md) · [m6-events-commands.md](m6-events-commands.md) · [m6-local-runtime-scheduling.md](m6-local-runtime-scheduling.md) · [m6-electron-shell.md](m6-electron-shell.md) · [m6-platform-packaging.md](m6-platform-packaging.md)

## 1. 目标

以V2产品目标重建Ensemble。M0-M5旧前端、Runtime API、持久化和桌面启动代码不构成兼容约束。当前M6 Domain/Command/Event/Runtime API、持久化和save meaning已经冻结；Electron Shell迁移不得借“重建”改写这些合同。

首个可验收版本必须证明：

- 用户能创建 Workspace 并选择 Runner
- 用户能配置多 Agent 编排，并自然退化为单 Agent 路径
- 首个真实闭环包含多个 formal Seat、并行实例、一个派生 worker 和跨 Runner 交接
- Run 状态、Handoff、Attention 和 Artifact 可观察
- 用户能介入、审批、打回和重试
- UI 简约且画布优先
- Theme、Locale 和平台适配从架构层成立
- Windows、macOS、Linux 的 Ensemble Runtime 不依赖外部开发环境；三个 Runner CLI 由用户安装和登录
- 关闭窗口后活动 Run、队列和计划继续；重启后按风险恢复，不重复状态不明的副作用
- 共享 Workspace、Git worktree 和临时隔离目录可由分发 Agent 选择并由 Runtime 校验
- 权限、指定目录、派生预算、秘密处理和历史策略可配置且可审计

---

## 2. 重建原则

- 新规格优先于旧代码
- 不为旧 Fixture、API 或数据文件增加兼容层
- 前后端契约在实现前重新定义并版本化
- Workspace 配置、设备偏好和 Run 快照严格分离
- Runner 通过 Adapter 接入
- 业务事件使用稳定 code，不发送写死语言的系统文案
- 平台差异集中在Electron Shell和Platform Adapter；业务执行仍集中在Rust Runtime
- Theme 和 Locale 不进入业务组件条件分支

---

## 3. 建议模块边界

```text
apps/canvas/src/
  app-shell/
  workspace/
  orchestration/
  canvas/
  inspector/
  attention/
  settings/
  design-system/
  i18n/
  runtime-gateway/electron-gateway.ts

apps/desktop/
  src/main/{lifecycle,platform,runtime-supervisor,runtime-client,ipc-router,stream-bridge,security,updater}/
  src/preload/
  test/
  electron-builder.yml

packages/protocol/src/shell/
  bridge / envelope / stream / directory-selection / schema

crates/ensemble-runtime/
  transport / domain / application / persistence / adapters
```

模块名称在技术设计阶段最终确认，但职责不得重新混合。

---

## 4. 数据所有权

| 数据 | 所有者 | 生命周期 |
|------|--------|----------|
| Theme、UI Locale、Density | Electron platform preference adapter | 设备级 |
| Workspace path、默认 Runner、默认输出语言 | Workspace config | Workspace 级 |
| Role、Seat、Group、Task、Transition、Gate、Join、Contract | Orchestration config | 可编辑模板 |
| ExecutionPolicyVersion、RunLaunchSpec、ScheduleLaunchTemplate、Queue Item、Schedule、ScheduleFire | Runtime persistence | Workspace 级；策略与启动输入不可变，Schedule 配置可更新或归档 |
| Runner、Prompt、编排版本、输出语言 | Run snapshot | Run 启动时冻结 |
| Status、Handoff | Runtime events | Run 运行时 |
| Attention | Runtime events | Workspace 级，scope 指向 Run 或 Queue Item |
| Artifact | Runtime persistence | Run 级 |

任何字段跨越上述边界前必须更新 SSoT。

---

## 5. 必须流程

### A. 首次启动

1. 应用读取系统语言、主题和平台能力
2. Electron Main从签名`process.resourcesPath`启动Rust Runtime sidecar，完成认证、协议握手、账本对账和健康检查；Renderer只看到脱敏状态
3. 无 Workspace 时进入创建流程
4. 不出现开发态 Fixture

### B. 创建 Workspace

1. 输入名称
2. 选择项目目录
3. 探测可用 Runner
4. 选择默认 Runner
5. 选择默认 Agent 输出语言
6. 创建 Workspace
7. 进入空编排或模板选择

### C. 创建编排

1. 从单 Agent 或模板开始
2. 编辑 Role、Seat 和 Group
3. 定义 Task、Transition、交付契约和 Attention Gate
4. 校验输入、输出和依赖
5. 保存编排版本

### D. 执行 Run

1. 从 Workspace 和编排版本创建 Run snapshot
2. Runtime 驱动 Runner
3. Canvas 接收稳定事件并更新状态
4. Handoff 触发一次方向脉冲
5. Attention 要求用户介入
6. 交付结果可查看
7. Run 完成、失败或进入重试

### E. 后台与计划

1. 用户把编排版本、输入、Runner 绑定、transient Runner allow-list、输出语言和执行策略冻结为 RunLaunchSpec 后加入队列，或冻结为 ScheduleLaunchTemplate 后创建 `cron | interval` 计划
2. 关闭主窗口后应用进入托盘，Runtime 继续活动 Run 和计划
3. 计划触发创建唯一 ScheduleFire，再走与手动启动相同的 Run 事务
4. 未预授权操作暂停并创建 Attention，通过系统通知提示
5. 重启后默认只补跑每个计划的最新一次，并按副作用证据决定自动恢复或等待用户

---

## 6. 主题与语言验收

- 浅色、深色、跟随系统
- `zh-CN`、`en-US`
- UI Locale 与 Run output Locale 独立
- Theme 切换不丢画布状态
- 文案扩张不破坏控件
- Runtime 系统消息使用 message key 和参数
- Agent 输出按 Run output Locale 执行

---

## 7. 平台验收

Windows、macOS、Linux 分别提供：

- 可安装包
- 安装包内置 Rust Runtime sidecar 和三个官方 Adapter
- 首次启动证据
- Workspace 创建证据
- `pi`、Codex CLI 和 Claude Code 的探测、原样 Terminal、权限和真实 Run 证据
- 关窗到托盘继续运行，以及显式退出后无无主 Runner 的证据
- 平台数据目录验证

浏览器开发预览不能代替桌面验收。

---

## 8. 非目标

- 旧数据迁移
- 旧 UI 视觉兼容
- 移动端
- 生产 Web 版
- 账户、云同步和多人在线协作
- Runner 插件市场
- 任意通用流程图能力

---

## 9. 实施门禁

在业务实现前必须完成：

1. V2 Domain model
2. Workspace、Orchestration、Run 和 Event schema
3. Runner Adapter contract
4. Backend 形态与跨平台打包 spike
5. Canvas information architecture wireframe
6. Theme token implementation contract
7. i18n key and message protocol
8. Windows、macOS、Linux CI 构建方案
9. Workspace 创建、编排编辑、自动保存和冲突交互规格
10. Run、Attention、Artifact、暂停取消和恢复规格
11. 执行目录、派生、权限、秘密和历史规格
12. 托盘后台、队列、计划、执行租约和风险感知恢复规格

F1 的前端实施细节见 [f1-shell-design-system.md](f1-shell-design-system.md)。该规格的 gateway seam 允许 Shell/Design System 与 Runtime 进程形态解耦；它不替代 F0 的 Backend/Packaging Spike。

Agent 派生来源、Active Seats 分组、不同 CLI 协作以及同一 Runner 实例的 Session/Terminal 语义见 [m6-agent-session-collaboration.md](m6-agent-session-collaboration.md)。首版不维护 CLI slash command 推荐镜像。

执行目录、派生默认预算、权限档位、指定目录、秘密脱敏、历史搜索和导出见 [m6-execution-workspace-security.md](m6-execution-workspace-security.md)。正式 supported Runner 必须同时提供 Session、Terminal 和 Context package 投递。

完成上述设计后再拆分实际开发任务。

---

## 10. Review Oracle

每次 Review 必须回答：

- 当前改动是否服务“简约界面 + 灵活编排”核心目标
- 是否把 Workspace、设备偏好和 Run snapshot 混在一起
- 是否引入旧实现兼容结构
- 是否在业务组件写死颜色、语言或平台判断
- Runner 是否仍可替换
- Run 启动后配置是否稳定
- 业务状态是否通过稳定 code 传递
- Pause、Cancel、Retry、Rework 和 Resume 是否遵循状态机且可幂等重放
- Run 是否只读取不可变 Snapshot，事件缺口是否能通过对账恢复
- 是否有对应平台和用户流程的运行证据

## 11. 已确认的实施门禁

以下规则作为M6实现约束；Electron Shell和Rust sidecar已选定，Shell安全边界以[m6-electron-shell.md](m6-electron-shell.md)为准，实际能力仍由[m6-platform-packaging.md](m6-platform-packaging.md) Spike证明：

1. **Runner 选择**：Workspace 创建至少需要一个设备 installation 可用、且对当前 Workspace policy/required capabilities 为 qualified 的 Profile；`pi` 为默认推荐，Task/Seat 覆盖属于高级配置。首版内置 `pi`、Codex CLI 和 Claude Code Adapter，CLI 本体与原生登录由用户管理，三个 Runner 必须通过三平台九组合门槛。
2. **Workflow 能力**：首版支持 Task、Gate、Join、并行、`all/any`、显式 End outcome、Optional skipped path 和有上限 Rework，不支持任意脚本或自由表达式；Gate 首版固定阻塞且没有第二个 `blocked` 状态。多 formal Task Workflow 必须指定 Dispatcher Task；其业务 Attempt 正常终态化，Runtime 通过该 formal AgentInstance 的 Run-scoped DispatcherCoordinationLease 选择其它 formal 实例的执行目录。没有业务 Attempt owner 时，replacement coordination Handle 通过独立 CoordinationLaunch 建立，不伪造 TaskAttempt。spawn-capable parent 通过当前 Attempt channel 选择自己 worker 的目录。
3. **画布与保存**：画布拖动只改布局，层级移动使用明确命令；Draft 自动保存，冲突不静默合并，启动 Run 创建不可变版本。
4. **运行快照**：Run 只读 Snapshot；Amendment 只能追加 Snapshot 后代并影响未开始部分，不能改历史 Task、Artifact 或 Gate。
5. **运行控制**：Pause 停止新派发并按 Runner 能力到安全边界；Cancel 不可逆；下游已开始后的重跑创建新 Run，不回滚原 Run。
6. **人工介入与恢复**：实时补充指令需要 Runner capability，否则进入下一次 Attempt；Attention 幂等；崩溃通过事件对账恢复。普通业务工作使用 recovery Attempt，coordination-only Handle 使用 CoordinationLaunch；已有 cancel/finalization intent 只继续原资源收敛，不恢复业务。
7. **执行目录**：Runtime 先创建 TaskExecution，再为已预分配 target 实例向 active Dispatcher lease/parent Attempt 发起带 request digest 的稳定 SelectionRequest；Agent 从共享 Workspace、Git worktree 和临时目录中结构化选择，Runtime 校验并持久化，超时或冲突不静默回退。首次派发、Retry、Recovery 和 Rework 都在 assignment 完成后才创建 Attempt；派生 worker 的全链路由 canonical SpawnRequest 关联。
8. **派生策略**：默认 `auto`；Workspace 活动 4、单父子 worker 2、深度 2、单 Run 原始实例谱系 8、每条谱系恢复代次 3，全部可配置。
9. **权限与历史**：四个权限档位和五项独立能力策略进入 RunSnapshot；秘密只保存引用；原始 Terminal 默认保留 30 天且每 Run 100 MB。
10. **后台与调度**：关闭窗口进入托盘；队列和 `cron | interval` 计划由 Runtime 持久化。错过计划默认补最新一次，后台超出预授权时暂停并通知。
11. **恢复**：Runtime 使用 SQLite Event、ExecutionClaim 和 ScheduleFire 对账。只有无副作用、可验证幂等或有可靠 checkpoint 的工作自动恢复，状态不明的外部副作用必须等待用户。

实现不得用旧 M0–M5 的 Stage、Edge、Bubble 或命令语义替代以上规则。
