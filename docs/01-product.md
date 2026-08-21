# 产品：目标、用户与边界

**状态**：V2 产品目标已确认（2026-08-19）

## 1. 产品定义

Ensemble 是一款面向开发者和技术负责人的跨平台 Agent 编排桌面应用。Workspace、执行记录和交付结果保存在当前设备，首版不需要产品账户。

用户创建 Workspace 时选择适合项目的执行引擎，通过组织画布定义角色、任务依赖、交付和人机门禁，观察单个或多个 Agent 协同执行，并在需要时审批、打回、补充指令、重试或调整编排。

一句话：

> 用一个清晰、可干预的组织画布管理 Agent 工作，而不是同时盯着多个终端和聊天窗口。

---

## 2. 目标用户

| 用户 | 核心任务 |
|------|----------|
| 独立开发者 | 让一个或多个 Agent 完成 Issue、小功能和代码修复 |
| Tech Lead | 定义角色和交付关系，监督多 Agent 协作并处理关键门禁 |
| Agent Builder | 组合不同 Runner、角色和流程，形成可复用编排模板 |

首版不面向客服、销售自动化、企业多租户或通用业务流程搭建。

---

## 3. 用户目标

用户需要快速完成：

1. 创建 Workspace 并选择 Runner
2. 选择模板、建立多个 Seat，或创建一个直接任务
3. 定义谁负责什么、先后关系和交付物
4. 启动 Run 并观察状态、协作交接和并行工作
5. 在审批、提问、异常或扩编时介入
6. 检查 Agent 活动、文件变更、Diff、交付结果、历史和最终结果
7. 保存可复用的编排配置

### 3.1 五秒、三十秒、六十秒

五秒内：

- 看懂当前 Workspace 和任务
- 看见哪些 Agent 正在工作
- 看见是否需要用户处理

三十秒内：

- 看懂主要协作路径
- 找到当前 Task 和最近交付物
- 打开任意 Seat 查看当前输入与输出

六十秒内：

- 完成一次介入操作
- 判断 Run 是否健康推进
- 知道下一步由谁负责

---

## 4. 核心对象

| 对象 | 定义 |
|------|------|
| Workspace | 项目目录、默认 Runner、默认输出语言和编排集合的边界 |
| Runner | 执行 Agent 工作的可替换引擎 |
| Role | 可复用的职责、能力、Prompt 和工具配置 |
| Seat | 某个 Workspace 编排中的稳定岗位和责任归属，不等于运行进程 |
| Agent Instance | 某个 Runner 在一次 Run 中为 Seat 承载的实际运行实例 |
| Attempt | Agent Instance 对一个 Task 的一次不可变执行尝试 |
| Group | 可嵌套的组织容器 |
| Transition | Workflow Node 之间的依赖、结果方向和交付绑定 |
| Handoff | 内部对象；表示一次明确的跨任务交接，界面显示“交给下一任务”或“已交接” |
| Orchestration | 角色、Task、Transition、门禁和交付约束 |
| Queue Item | 等待 Runtime 启动一个不可变编排版本的持久化队列项 |
| Schedule | 按时区和补跑策略重复创建 Queue Item 的计划 |
| Run | 一次冻结配置后的执行实例 |
| Attention | 需要用户处理的审批、提问、异常或扩编确认 |
| Change Set | 从明确 Workspace 基线到当前状态或指定 Attempt 的文件差异 |
| Artifact | 内部对象；表示按交付契约冻结的结果，界面显示“交付结果” |

---

## 5. 灵活编排

“灵活”必须落实为清晰的业务能力：

- 单 Agent 是完整路径
- 多角色组织可自由组合
- Group 和 Seat 支持嵌套
- Handoff 和依赖关系可定义
- Task 依赖和执行顺序可配置
- 可定义人工审批、提问和打回
- 失败后可以按 Task 或分支重试、打回或重新执行
- 运行中可以在规则允许时插入 Seat，或停用尚未参与执行的 Seat
- 模板可保存和复用
- 编排版本可以加入持久化队列或定时计划；关闭窗口后由托盘中的 Runtime 继续执行
- 不同 Workspace 可以使用不同 Runner
- 分发 Agent 可以为每项工作选择共享目录、独立 Git worktree 或临时隔离目录
- 多 Task Workflow 明确指定负责分发的 Task/Seat，不由 Runtime 猜测谁是负责人
- Agent 可以按策略派生 worker；默认自动批准，同时受可配置的并发、深度和总数预算限制
- transient worker 由父 Attempt 监督并回传结果，不自动获得 Task ownership；跨 Task/Seat 的责任转移必须创建正式 Handoff，活动 Task 换 owner 必须经过 Amendment/Rework

Ensemble 不是任意流程图工具。每个编排元素都必须回答：

> 谁负责、何时开始、需要什么输入、交付什么、交给谁、何时需要用户确认。

---

## 6. Runner 选择

- 创建 Workspace 时选择默认 Runner
- 只显示当前平台上可用或可配置的 Runner
- Workspace Settings 可以修改后续 Run 的默认 Runner
- Run 启动时冻结 Runner 配置
- 已启动 Run 不随 Workspace 设置变化
- Runner 选择不放在主画布顶栏
- Runner Adapter 必须保持可替换
- 一个 Runner 只有同时提供长期 Session、原样 Terminal 和可靠的上下文投递，才能标记为正式支持
- Runner 还必须能执行当前 Workspace 权限策略；不能只靠 Prompt 声称受限

首版内置 `pi`、Codex CLI 和 Claude Code 三个官方 Adapter，`pi` 是默认推荐 Runner。三个 CLI 均由用户自行安装、更新并完成原生登录；Ensemble 只探测可执行文件、版本范围、登录状态和能力，不下载 CLI 或保存其账号 Token。三者都必须在 Windows、macOS、Linux 通过正式 Runner 资格。

Workspace 有默认 Runner Profile，Seat 可以覆盖。Profile 可以选择可执行文件和非敏感配置目录；AgentInstance 启动后冻结具体 Profile，修改设置只影响后续实例。首版不加载第三方 Adapter，也不能用 Terminal 绕过正式 Adapter 接入任意 CLI。

---

## 7. 体验目标

- 界面优雅、简约、低干扰
- 画布占据主工作区域
- Seat 去卡片化
- 协作交接使用短暂、有方向的脉冲
- 浅色优先，支持深色和自定义主题协议
- `zh-CN`、`en-US` 首发，多语言架构可扩展
- Windows、macOS、Linux 独立安装运行
- Ensemble 本身不要求用户安装 Python、Node 或开发依赖；运行 Agent 前需要安装并登录所选 CLI
- UI 语言和 Agent 输出语言分别配置
- Workspace 提供本地文件树、Diff 和交付结果预览；Agent 详情只过滤其可靠关联的变更，不拥有独立文件树
- Active Seats 支持按组织、Run、派生来源和状态分组，并能追溯 Agent Instance 的父实例、父 Attempt 和创建原因
- Agent 活动统一投影为 `working | blocked | done | idle | unknown`；业务 outcome 和 Run health 分开展示，无法可靠判断时不猜测
- 每个 Agent Instance 提供 Session 与 Terminal 两种视图；两者连接同一 Runner 进程，切换不会重新启动 CLI
- Session 只提供 Ensemble 基础对话、状态、控制和证据入口；CLI 自己的 `/` 命令和全屏交互保留在 Terminal，不维护 Runner 命令推荐镜像
- 不同 Runner 通过 Runtime 持久化的 Task、交接记录、交付结果和上下文包协作；看板只投影状态，不充当上下文传输协议
- Seat 的 Session 长期存在，可以承载多个 Direct Task/Run；自由对话仍绑定明确 Task/Run，便于搜索、导出和恢复
- formal AgentInstance 没有活动工作或终端连接时默认空闲 30 分钟后休眠；transient worker 收尾后退出，长期 Session 和历史不受影响
- Workspace 支持只读、Workspace 可写、指定目录和完全权限四个档位，并分别控制网络、外部进程、外部写入、破坏性命令和对外发布
- 分发 Agent 选择共享目录、独立 Git worktree 或临时目录，Runtime 校验并记录选择；冲突进入检查，不静默覆盖
- worktree 和临时目录结果默认先检查再应用，也可配置为验证通过且无冲突时自动应用，或只保留供手动处理
- Git 或非 Git 项目根都可作为 shared Workspace；新 worker 不隐式创建 worktree
- Diff 支持固定到不可变 Change Set 的行内评论和 Review thread，选中反馈可以直接创建结构化 Rework；不提供代码编辑、Stage 或 Commit
- Attempt 的完成回执结构化引用候选交付、Change Set、验证和未解决事项；summary 只用于描述
- Attempt 收敛后 Handle 必须明确复用、只读留作检查或释放；留存继续占用容量，不能承载新业务工作
- 长时间无完成回执只触发检查或 Attention，不自动判失败；heartbeat 和持续输出只表示存活
- UI 重开、Conversation 重载、live process、Terminal transcript 和 business operation 恢复分别声明，不用“会话恢复”笼统代替

完整规则见 [08-design-language.md](08-design-language.md)。

---

## 8. 技术与产品边界

### 8.1 本机数据与后台运行

- Workspace、Run、交付结果和偏好默认保存在本地
- 首版不要求登录
- 首版不做跨设备同步
- Runtime 只监听 loopback
- 关闭窗口会收起到系统托盘，活动 Run、队列和定时计划继续执行
- 首版不安装系统级服务；显式退出、注销或关机会停止 Runtime。默认随用户登录启动并按恢复策略处理未完成工作，用户可以关闭自动启动
- 定时计划支持 `cron | interval`，错过执行默认只补最新一次；首版不做文件监听、Webhook 或外部 API 触发
- 后台遇到未预授权操作时暂停并通知，不自动扩大权限
- Client detach/关窗到托盘不改变业务状态；Runtime graceful exit、crash/OS shutdown、Runner 原生 session resume 和 transcript replay 使用不同恢复合同

### 8.2 前后端可重做

- 现有 Canvas 和 Runtime 仅作功能参考
- 新实现不承担旧演示数据兼容
- API、持久化和组件结构可以重新设计
- 新业务模型必须先落协议和 SSoT
- 不保留只为旧代码服务的过渡结构

### 8.3 权限与秘密

- 项目目录和额外目录通过平台原生选择器授权
- 权限默认可配置，不要求每次操作都审批；完全权限必须持续可见
- Token、密码和私钥保存在操作系统凭据存储，Workspace 只保留引用
- 业务事件、消息、普通日志和导出不保存完整环境变量或密钥
- Terminal 原始输出只能尽力脱敏，因此导出时单独提示并要求选择

### 8.4 首版非目标

- 移动端
- 生产 Web 版
- 多租户和企业 RBAC
- 账户与云同步
- 远程 Runtime 和跨设备控制
- Runner 插件市场
- 通用客服或销售 Agent 平台
- 替代 IDE 的代码编辑器
- 无约束的自由群聊

---

## 9. 产品成功标准

功能：

- 用户能创建 Workspace 并选择可用 Runner
- 第一个真实运行闭环直接支持多个 formal Seat、并行 AgentInstance 和至少一个派生 worker；单 Agent 作为自然退化路径继续可用
- 状态、协作交接、Attention 和交付结果可见
- 用户能从 Agent、Run 或 Attention 直接打开对应变更、文件行和交付结果，并看见明确 Diff 基线
- 用户能查看任意 Agent Instance 的派生来源，在同一实例的 Session 与原样 Terminal 之间切换，并直接发送符合 Runner capability 的消息或补充指令
- 用户能在长期 Session 中跨多个 Direct Task/Run 对话、附加文件或 Diff，并搜索、导出和恢复记录
- 用户能看见五态 Agent activity，并能区分 activity、Task outcome 和 Run health；heuristic 不会改变业务状态
- 用户能查看并配置执行目录、派生预算、权限档位和指定目录；Runtime 不会静默扩大授权
- 用户能在明确目标基线下检查、应用或拒绝隔离结果；冲突和 partial 变更不能伪装成完整交付
- 用户能在冻结 Diff 上评论，并从选中评论创建可追溯 Rework；后续评论不会改变已启动 Attempt 的上下文
- 用户能审批、打回、补充指令和重试
- 编排模板可保存和复用
- 用户能把不可变编排版本加入队列或定时计划，查看补跑、重叠、阻塞和来源记录
- 关闭窗口后工作继续；显式退出和系统重启后不会重复已完成工作或静默重试状态不明的副作用
- 长时间运行、Handle 留存和恢复都继续遵守原权限、容量和结构化证据边界

体验：

- 首屏不出现开发态控件和内部枚举
- 五秒内可辨认活跃对象和用户待办
- 打开详情不会破坏画布空间关系
- 两种首发语言无明显溢出和混用
- 主题变化不改变业务语义

交付：

- Windows、macOS、Linux 安装包均通过真实启动验证
- Runtime 随托盘进程启动；关窗继续，显式退出时安全暂停并回收进程
- Ensemble Runtime 不依赖用户已有的开发环境；用户自行安装并登录 `pi`、Codex CLI 和 Claude Code
- 三个官方 Runner 在三个平台的九个组合全部通过资格测试
- 数据写入正确的平台应用目录
