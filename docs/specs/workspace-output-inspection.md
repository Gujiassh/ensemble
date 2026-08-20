# Workspace Output Inspection

**状态**：产品与交互基线 v1（2026-08-19）
**范围**：本地文件浏览、Agent 活动、Change Set、Diff、Artifact 预览和 Review 定位
**依赖**：[m6-domain-model.md](m6-domain-model.md) · [m6-run-operations.md](m6-run-operations.md) · [m6-orchestration-interaction.md](m6-orchestration-interaction.md) · [m6-execution-workspace-security.md](m6-execution-workspace-security.md)

默认界面使用“文件”“变更”“Diff”“交付结果”，不要求用户理解 ProjectFile、ChangeSet 或 Artifact 等内部对象名。内部对象名只在协议和诊断中出现。

## 1. 目标

Ensemble 不只显示 Agent 是否运行，还必须让用户回答：

1. Agent 实际做了什么？
2. 哪些文件发生了变化，变化基于哪个起点？
3. 哪些结果是明确交付的 Artifact？
4. 当前结果是否值得审批、打回或继续传递？

输出检查链路为：

```text
Agent Activity -> Change Set / Diff -> Artifact Preview -> Review / Attention
```

文件浏览服务于检查和定位，不把 Ensemble 扩张成代码编辑器。

## 2. 三类对象必须分开

| 对象 | 含义 | 所有权 |
|------|------|--------|
| File Root / File | Workspace 项目目录或已授权外部目录在当前时刻的文件系统视图 | 本地文件系统 / PermissionGrant |
| Change Set | 从明确 `baseline` 到明确 `target` 的可复现差异 | Run 或 TaskAttempt 观察记录 |
| Artifact | TaskAttempt 按 Artifact Contract 声明并交付的结果 | Run 历史，关联 producer Attempt |

规则：

- Agent 不拥有 File Root 或 File。Agent 只能与 Change Set 和 Artifact 建立来源关系。
- 文件发生变化不等于产生 Artifact；日志、临时文件和未声明修改仍可以出现在 Change Set 中。
- Artifact 不一定对应项目文件；它可以是 Markdown、JSON、图片、测试报告或结构化结果。
- 同一个文件可以被多个 Attempt、用户或外部程序修改；来源关系允许多值和 `unknown`，不能通过文件名、最后写入时间或 Git blame 猜测归属。
- Artifact 引用项目文件时必须记录生成时版本或完整性摘要，不能把当前路径内容当作历史 Artifact。

## 3. Diff 基线必须可解释

### 3.1 默认 Run 基线

Run 启动成功前冻结项目根和所有已登记可写目录的 `fileRootBaselines`。默认 Change Set 比较：

```text
Run 启动瞬间的 File Root 内容 -> 当前或指定 Attempt 完成时的内容
```

如果项目在 Run 启动前已经有未提交修改，这些修改属于基线，不能显示为 Agent 本次产出。

### 3.2 Git 与非 Git Workspace

- Git Workspace 同时记录仓库身份、HEAD、工作树初始状态和内容基线。UI 可以另外提供“与 Git HEAD 比较”，但必须明确标注它不是 Run Change Set。
- 非 Git Workspace 也必须有可复现的内容基线；不能只记录修改时间或文件大小。
- Backend 可以在架构阶段选择临时 Git tree、内容寻址快照或其它可靠实现，但 UI 合同不因实现变化。
- 基线捕获失败时不能启动一个声称可审查的 Run。首版默认阻止 Run，并显示修复动作。
- 每个 Change Set entry 使用稳定 `rootRef + relativePath`，业务事件不携带 Workspace 外绝对路径。
- `full_access` 不触发全盘扫描。未登记 root 外只能记录 Runner/平台可靠观察到的修改，并把 Change Set `integrity` 标记为 `partial`；界面必须显示“仅观察到的变更”。
- 需要完整 Review 的 Task 不能以 `partial` Change Set 通过 Gate；先收紧到可冻结的目录范围或补充明确交付结果。

### 3.3 Target

Diff target 必须是以下明确对象之一：

```text
current_workspace | attempt_completion | artifact_version | run_completion
```

查看器始终显示 baseline、target、时间和来源范围。不得使用“最新版本”而不说明具体版本。

## 4. 信息架构

### 4.1 Workspace Files

Workspace 主导航提供 **Files**。它是 Workspace 级入口，不放在单个 Agent 下面。

中央区域采用：

```text
File tree / Changed files | File, Diff, or Artifact viewer
```

文件树的根固定分为：

```text
Project
Allowed paths
```

`Project` 是 Workspace 项目目录。`Allowed paths` 只列出 PermissionGrant 中明确选择的目录，每个目录显示 read/write 和有效期；不会因为 `full_access` 自动展开整台机器。用户可通过原生目录选择器添加路径。

文件树支持：

- 目录逐层懒加载和手动刷新
- 文件名和相对路径搜索
- modified、added、deleted、renamed、binary 状态
- 当前 Run、选中 Attempt、选中 Agent 的变更过滤
- 定位当前打开文件
- 展开项目目录或使用系统默认应用打开文件
- 在 Project 和 Allowed paths 之间切换，保持独立展开和搜索状态

首版不提供代码编辑、保存、Stage、Discard、Commit、完整 Git 管理或内置合并冲突编辑。隔离结果检查提供 **应用结果**、**保持隔离**、**拒绝** 和 **在外部工具中打开**；应用冲突进入 Attention。

### 4.2 Agent 检查器

Seat / Agent 详情固定提供：

1. **Overview**：身份、状态、当前 Task 和输入。
2. **Activity**：结构化进度、命令摘要、错误和 Runner 回执。
3. **Changes**：与该 Agent 有可靠来源关系的 Change Set；显示未归属和共同修改提示。
4. **Artifacts**：该 Agent 的 Attempt 明确交付的 Artifact。

点击 Changes 或 Artifact 后在中央区域打开，右侧检查器保持来源上下文。关闭查看器后恢复原画布位置和选择。

### 4.3 Runs、Attention 和 Review

- Run 详情显示累计 Change Set、按 Attempt 分组的变更和最终 Artifact。
- Attention 必须能深链到具体 Artifact、文件和 Diff 行；只显示摘要而无法打开证据不允许审批。
- Review 默认打开待审 Change Set，再展示 Artifact Contract、验证结果和 Agent 摘要。
- Approve / Reject 只作用于对应 Gate 或 Attention，不隐式 Stage、Commit 或修改文件。隔离结果使用单独的 **应用结果** 命令，确认目标基线和影响文件后才写入项目。

## 5. Diff 查看器

首版必须支持：

- Changed files 列表和 added/deleted 统计
- Unified / Split 两种模式
- 文件状态、旧路径/新路径和 rename 信息
- 行号、增删行、上下文折叠和长行横向滚动
- 二进制、过大文件、删除文件和无法解码文件的明确状态
- baseline / target 标识
- 从 Attention 或 Artifact 定位到文件和行
- 复制相对路径、复制选区和使用系统应用打开

首版可以后置：

- 行内评论和 Review thread
- 语义 Diff、AST Diff 和图片像素 Diff
- Git Stage、Commit、Discard 和冲突解决

Diff 内容和统计必须来自同一 Change Set，不能由客户端分别读取当前文件后临时拼接。

## 6. Artifact 预览

| 类型 | 默认预览 |
|------|----------|
| Markdown / text | 排版预览，可切换原文 |
| Source code / Diff | 代码或 Diff 查看器 |
| JSON / structured data | 树形与原文切换，标记 schema validation |
| Image | 原始比例、尺寸、缩放和背景切换 |
| Test report | 总结、失败项、耗时和原始输出 |
| Binary / unsupported | 文件名、类型、大小、完整性和系统打开入口 |

预览顶部必须显示 Artifact 名称、版本、Contract、producer Seat、Task、Attempt、Run、创建时间、validationStatus、currentness 和消费方。

历史 Artifact 读取其冻结内容。项目目录中同名文件后来变化时，不更新历史 Artifact 预览。

## 7. Activity 与原始输出

Activity 默认是结构化时间线：

```text
progress | decision | command | file_change | artifact | handoff | warning | error
```

- 默认显示用户能判断进度的摘要，不连续倾倒终端输出。
- Command 显示命令、工作目录、开始/结束时间、退出码和截断状态；环境变量与密钥必须脱敏。
- 原始 stdout/stderr 按需展开，支持搜索、复制和下载，不作为 canonical 状态来源。
- Runner 没有提供可靠文件操作关联时，变更来源显示 `unknown`，不能伪造 Agent 归属。

## 8. 文件系统与安全

- 只允许浏览 Workspace project root 和 PermissionGrant 明确列出的 root；所有路径通过平台 Path API 规范化。
- 符号链接默认显示但不跟随当前 root 外；需要跟随时必须先把目标目录加入 PermissionGrant。
- `.git`、依赖目录、构建输出和 `.gitignore` 内容默认折叠或隐藏，用户可以切换显示。
- 已识别的密钥、凭据文件和 Runner secret 不直接预览；显示受限原因。
- 文件监听丢失事件或溢出时标记 tree stale，并要求重新扫描，不能继续声称视图是最新状态。
- 大目录、大文件和二进制文件必须按预算读取，不能阻塞 Canvas、Run 事件或 Attention。

## 9. 空态与失败

| 场景 | 表达和操作 |
|------|------------|
| Agent 没有变更 | 显示“未观察到文件变更”，仍保留 Activity 和 Artifact |
| Change Set 尚未生成 | 显示生成中和对应 Attempt，不显示空 Diff |
| 基线不可用 | 阻止 Review，显示原因和重新捕获/重新运行入口 |
| 文件已在当前 Workspace 删除 | Diff 可读，当前文件预览显示已删除 |
| Artifact 无法读取或完整性不符 | 标记 invalid，不回退到同路径当前文件 |
| 文件来源不明确 | 显示 Workspace change / unknown source，不分配给最近活跃 Agent |
| `full_access` 的 root 外变更 | 显示“仅观察到的变更”，完整性为 partial，不允许完整变更 Gate 通过 |
| Workspace 目录离线 | 历史 Artifact 和冻结 Diff 可读；当前 Files 不可用 |

## 10. 验收标准

- 用户能从任意 Seat 在两次操作内打开它的 Changes 或 Artifacts。
- 用户能看见 Diff 的明确 baseline 和 target，并区分 Run Change Set 与 Git HEAD Diff。
- Run 启动前已有的脏改动不会被归为本次 Agent 产出。
- Files 是 Workspace 级视图；多个 Agent 修改同一文件时不创建重复文件对象。
- 授权外部目录显示在独立 Allowed paths 根，不与 Project 合并，也不因 full access 浏览整台机器。
- Change Set entry 使用 `rootRef + relativePath`；完整性为 partial 时不能伪装成完整审查证据。
- Review 可以直接定位到证据文件和行，证据不可用时不能完成审批。
- Markdown、代码、JSON、图片、测试报告和未知二进制都有明确预览或不可预览状态。
- 10 万文件级目录使用懒加载和搜索时不阻塞 Run 状态更新；具体性能预算在架构规格中确定。
- Windows、macOS、Linux 的路径显示、外部打开和符号链接规则语义一致。
- `zh-CN`、`en-US` 下文件状态、Diff 统计和 Artifact 元数据不展示内部枚举。

## 11. 实施边界

这份规格确定产品语义和交互，不选择文件监听库、索引存储、基线快照格式、Diff 算法、Backend API 路由或 Git 写操作。

这些选择必须在 Backend 与桌面边界确定后进入架构规格。当前纯前端 Mock 只用于验证信息架构，不构成数据协议。
