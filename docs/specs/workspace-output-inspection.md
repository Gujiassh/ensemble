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

`Project` 是 Workspace 项目目录。`Allowed paths` 按来源分组显示 Workspace 默认授权和当前 Run/Agent 的有效 PermissionGrant，每个目录显示 read/write、scope 和有效期；不会因为 `full_access` 自动展开整台机器。用户通过原生目录选择器添加路径时只修改 Workspace 默认授权，不能热扩大活动 Agent 的 Grant。活动工作需要更大路径或 capability 时唯一合法入口是 exception Attention 的 `amend_and_rework`：终结旧工作，为 Snapshot 后代和新 TaskExecution activation 冻结 policy，再创建新的 AgentInstance 和不可变 PermissionGrant；`approve_once` 只裁决当前 Grant 中一个 `ask` operation，不能替代该路径。

文件树支持：

- 目录逐层懒加载和手动刷新
- 文件名和相对路径搜索
- modified、added、deleted、renamed、binary 状态
- 当前 Run、选中 Attempt、选中 Agent 的变更过滤
- 定位当前打开文件
- 展开项目目录或使用系统默认应用打开文件
- 在 Project 和 Allowed paths 之间切换，保持独立展开和搜索状态

首版不提供代码编辑、保存、Stage、Discard、Commit、完整 Git 管理或内置合并冲突编辑。隔离结果检查提供 **应用结果**、**稍后处理**、**拒绝** 和 **在外部工具中打开**；应用冲突进入 Attention。

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

### 4.4 Viewer 路由与历史

File、Diff 和 Artifact 共用一个 inspection location。首次打开时冻结来源 surface、对象选择、检查器 tab、Canvas viewport 和滚动位置为 origin；后续 Viewer target 切换只追加内部 history，不能改写 origin。

V1 每个 inspection location 的 Viewer internal history 固定最多保留 50 个 target。追加第 51 个 target 时必须只淘汰最旧的内部 history entry；冻结的 origin 永不计入、永不淘汰或改写。**Back** 先遍历剩余内部 target，再返回 origin；**Close** 从任意 target 直接返回同一个 origin。淘汰内部 entry 不得导致 Close/Back 返回另一个 Workspace、Canvas viewport 或检查器选择。

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
- 对明确 baseline/target 的行创建 Review thread，追加评论、解决或重新打开
- 从一个或多个 open Review thread 发起 Rework；Client 只提交 canonical `reviewSelection { changeSetId, threadSelections[] { threadId, commentIds[] } }` 和目标选择，不接收也不提交 DiffReviewBundle ref

首版可以后置：

- 语义 Diff、AST Diff 和图片像素 Diff
- Git Stage、Commit、Discard 和冲突解决

Diff 内容和统计必须来自同一 Change Set，不能由客户端分别读取当前文件后临时拼接。

每个行内 thread 必须固定 `changeSetId + baselineRef + targetRef + rootRef + relativePath + side + lineNumber + anchorDigest`。评论以不可变记录追加；thread 的 canonical status 只有 `open | resolved`。新 Change Set 产生后，旧 thread 仍停留在原 Diff；在新目标上无法精确重定位时派生显示 `outdated`，但不改写 thread status，也不能按相同行号自动迁移。Resolve 只关闭讨论，不表示 Gate 已通过或文件已修改。

**Rework from review** 是显式 `run.rework` 快捷入口。Client payload 只包含 canonical `reviewSelection { changeSetId, threadSelections[] { threadId, commentIds[] } }`、eligible target selection、用户明确选择的相关 Artifact refs 和补充说明，永远不包含 Client 构造或缓存的 DiffReviewBundle ref；每个 `threadSelections[]` item 必须包含至少一个 `commentIds[]`。Runtime 重验全部引用属于 `reviewSelection.changeSetId`、thread 仍为 open、每个 comment 属于对应 thread，且整个 selection 仍可用于所选 target；随后在 `run.rework` 原子命令中创建包含 selected comment IDs、status-at-capture、event sequence 和 digest 的不可变 DiffReviewBundle，先追加 `diff.review.bundle.created`，再创建新的 TaskExecution activation，并在 canonical pre-Attempt pipeline 创建引用该 bundle 的 ContextPackage。任一校验或写入失败都不创建 Bundle、TaskExecution 或 ContextPackage。后续评论或 resolve 不改变已投递 bundle。评论不能直接修改 Workspace、重写旧 Attempt 或改变 Handoff；新 Attempt 完成后生成新的 Change Set，供用户逐项核对旧 thread。

目标 Task 不能由 Client 自由猜选。Runtime 先返回 `eligibleTargetPlan`：同 Run 只包含当前 open Gate 的合法 `rejected` Transition target，并校验 Rework 迭代上限；其它反馈只能创建带来源谱系的 descendant Run。用户只能从该 plan 选择，提交时 plan、thread status、event sequence 或 target eligibility 变化则整批 conflict。相关 Artifact 必须由用户从同一 source Attempt/Change Set 的正式 valid Artifact 中明确选择，Runtime 再校验，不按“最新”自动加入。

Thread 首评与 thread 在同一事务创建，首评不能为空。Comment 是不可变追加记录，不编辑或删除；修正通过追加评论。Resolved thread 必须先 Reopen 才能继续评论。Create、Add、Resolve 和 Reopen 都使用 compare-and-set，Client 在 canonical Event 前只显示局部 submitting，不乐观改写 thread。

大 Diff 由 Backend 返回稳定 cursor、总/已加载 hunk 与 line 统计、`complete | truncated` 和截断原因；Client 不重新读取当前文件补齐历史 Diff。Binary、无法解码或超预算文件只能显示 metadata、外部打开和整体 Rework 说明，不创建行级 thread。

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

Attempt 检查器在正式交付结果之外提供“结果接收”区，展示 ArtifactCandidate 的 `pending_validation | promoted | invalid | conflict` 投影。invalid 只显示 immutable ValidationRecord 和 Contract 诊断，不标为交付结果，也不能进入 Handoff/Gate。正式 Artifact 必须显示 `sourceArtifactCandidateId` 和 validation record 的追溯入口；blob 缺失或 digest mismatch 显示读取完整性错误，不把 Artifact 改写成 Contract invalid。

### 6.1 隔离结果整合

worktree 和 temporary directory 的隔离结果先由 Runtime 持久化 ResultReviewRequest，`execution.result.review_requested` 返回稳定 `resultReviewRequestId`。**应用结果** 必须引用该 request、确认 target baseline，并从其冻结的 eligible Change Set entries 或正式 valid Artifact 中显式选择整合集合。`selectedChangeSetEntryRefs[]` 与 `selectedArtifactRefs[]` 使用 OR cardinality：任一集合可以为空，二者合并后必须至少包含一项；file-only、Artifact-only 和两者组合都合法。首次 Apply 只在 request 尚无 attempt 时创建回指 request 的不可变 ResultIntegrationAttempt；选择集合创建后不可修改。已有 failed attempt 后只显示相同 selection 的 Retry，不允许重新选择后发起第二个首次 Apply。**拒绝** 只提交 `resultReviewRequestId`，在第一次 `review_requested` 即可执行，并直接终态化 request，不创建 ResultIntegrationAttempt。Shared Workspace 不显示 Apply，因为变更已在目标目录，Review 只决定业务接受。

ResultReviewRequest 的状态为 `review_requested | integrated | rejected`；ResultIntegrationAttempt 专属于 Apply，交互状态为 `requested | staging | reconciling | integrated | failed | integration_unknown`。目标写入回执不明时只允许查看证据和对账原 attempt；不能自动重做。**Retry integration** 只在 source attempt 的 canonical status 已经是 `failed` 时可用；former Unknown 必须先 reconcile 为 `failed`。`integrated | requested | staging | reconciling | integration_unknown` 都禁止 Retry，request 已为 `integrated | rejected` 时也禁止 Apply。合法 Retry 使用新 command ID 创建新的不可变 ResultIntegrationAttempt，并以 `retryOfIntegrationAttemptId` 引用旧 failed attempt；旧 attempt 永不改写。**保持隔离** 改为 **稍后处理**，只关闭当前 Review，维持 `review_requested`，不新增隐式 disposition。

## 7. Activity 与原始输出

Activity 默认是结构化时间线：

```text
progress | decision | command | file_change | artifact | handoff | warning | error
```

- 默认显示用户能判断进度的摘要，不连续倾倒终端输出。
- Command 显示命令、工作目录、开始/结束时间、退出码和截断状态；环境变量与密钥必须脱敏。
- 原始 stdout/stderr 按需展开，支持搜索、复制和下载，不作为 canonical 状态来源。
- Runner 没有提供可靠文件操作关联时，变更来源显示 `unknown`，不能伪造 Agent 归属。
- Agent 标题只显示 `working | blocked | done | idle | unknown` 的活动投影；Task outcome 和 Run health 分开展示。PTY/TUI heuristic 可以改善即时反馈，但必须过期，且不能升级为成功、权限或 Artifact 证据。

## 8. 文件系统与安全

- 只允许浏览Workspace project root和PermissionGrant明确列出的root；真实路径只在Rust Runtime/平台边界使用原生Path API规范化。Renderer路由和Shell structured DTO只持有typed ref/relativePath/opaque selection，不接收绝对路径。
- 符号链接默认显示但不跟随当前 root 外；需要跟随时必须先把目标目录加入 PermissionGrant。
- `.git`、依赖目录、构建输出和 `.gitignore` 内容默认折叠或隐藏，用户可以切换显示。
- 已识别的密钥、凭据文件和Runner secret不直接预览；显示受限原因。
- 文件、Diff、Artifact、Terminal和用户/Runner正文可能自然显示路径；这些内容按不可信敏感正文和导出规则处理，不能成为Shell目录授权、外链或Main方法输入。
- 文件监听丢失事件或溢出时标记 tree stale，并要求重新扫描，不能继续声称视图是最新状态。
- 大目录、大文件和二进制文件必须按预算读取，不能阻塞 Canvas、Run 事件或 Attention。

对包含 100,000 个文件的验收数据集，Files tree 与文件名/相对路径 search 必须满足以下预算：文件处理产生的任一 Client main-thread task 不得超过 50ms；tree/search 活动期间，从 Client stream receipt 到对应 Run Event projection 可见的延迟不超过 200ms p95；从 Backend response 开始返回到首个 tree/search page 可见的延迟不超过 500ms p95。性能证据必须记录操作系统、平台版本、WebView/Runtime 版本、参考硬件、数据集生成方式、样本量和各 percentile；不能只提交开发者机器上的单次截图或平均值。

## 9. 空态与失败

| 场景 | 表达和操作 |
|------|------------|
| Agent 没有变更 | 显示“未观察到文件变更”，仍保留 Activity 和 Artifact |
| Change Set 尚未生成 | 显示生成中和对应 Attempt，不显示空 Diff |
| 基线不可用 | 阻止 Review，显示原因和重新捕获/重新运行入口 |
| 文件已在当前 Workspace 删除 | Diff 可读，当前文件预览显示已删除 |
| Artifact blob 无法读取或完整性不符 | 显示读取完整性错误，不改写 Contract validation，也不回退到同路径当前文件 |
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
- 行内 Review thread 固定到不可变 Change Set；从评论发起 Rework 后能在新 Attempt 中追溯原 thread，并对比新旧 Change Set。
- invalid ArtifactCandidate 不出现在交付结果；正式 Artifact 可追溯到唯一 Candidate 和 ValidationRecord。
- 临时目录的应用集合完全来自显式 selected refs；selected Change Set entries 与 selected valid Artifacts 按 OR 计数，file-only、Artifact-only 均可提交；整合 crash/Unknown 不产生重复应用或部分成功声明。
- `execution.result.review_requested` 创建持久化 ResultReviewRequest；用户不执行 Apply 也能只用 `resultReviewRequestId` Reject，且不会出现虚构的 ResultIntegrationAttempt。
- Result Integration Retry 只从同一 request 下 canonical failed source 创建带新 command ID 和 `retryOfIntegrationAttemptId` 的新 attempt；former Unknown 未 reconcile 为 failed 前和其它全部状态都没有 Retry 入口。
- Markdown、代码、JSON、图片、测试报告和未知二进制都有明确预览或不可预览状态。
- 同一 inspection location 打开第 51 个 Viewer target 时只淘汰最旧内部 entry，50 个 target 的 V1 最大值和冻结 origin 均保持不变。
- 10 万文件级目录满足 50ms main-thread hard limit、Run Event projection 200ms p95 和首个 tree/search page 500ms p95，并留下平台与参考硬件证据。
- Windows、macOS、Linux 的路径显示、外部打开和符号链接规则语义一致。
- `zh-CN`、`en-US` 下文件状态、Diff 统计和 Artifact 元数据不展示内部枚举。

## 11. 实施边界

这份规格确定产品语义和交互，不选择文件监听库、索引存储、基线快照格式、Diff 算法、Backend API 路由或 Git 写操作。

这些选择必须在 Backend 与桌面边界确定后进入架构规格。当前纯前端 Mock 只用于验证信息架构，不构成数据协议。
