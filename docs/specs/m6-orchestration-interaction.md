# M6 Orchestration Interaction

**状态**：Draft v1，待产品审阅

**范围**：Workspace 创建、编排编辑、校验、保存、启动 Run 和桌面交互

**依赖**：[m6-domain-model.md](m6-domain-model.md)、[m6-product-rebuild.md](m6-product-rebuild.md)、[../08-design-language.md](../08-design-language.md)
**不包含**：具体前端框架、后端传输协议、Runner 内部实现

本文是业务交互规格，不是视觉稿。实现必须先满足这里的行为和状态，再选择组件和技术。

## 1. 交互原则

### 1.1 画布是工作面，不是流程图展示器

- Workspace 主场景以画布为工作面，用户在画布上编辑组织和流程，运行时也从同一空间观察结果。
- 不采用固定的“左栏 + 中间 + 右栏”三栏业务布局。导航轨道保持窄，画布占据剩余空间，检查器只在有选择或明确打开时出现。
- 检查器是上下文工作区，不是常驻信息墙；打开检查器不能改变业务对象的位置和关系。
- 画布坐标只属于 `PresentationDraft`，任何拖动都不能悄悄改变组织父子关系或流程依赖。

### 1.2 两种编辑上下文，共享一个 Draft

| 上下文 | 用户关心的问题 | 可编辑对象 |
|---|---|---|
| 组织 | 谁参与、职责是什么、谁属于谁 | Role、Group、Seat、组织父子关系 |
| 流程 | 做什么、何时开始、交付什么、如何决策 | Task、Gate、Join、Transition、Artifact Contract |

- UI 标签使用稳定的本地化 key，例如 `workspace.view.organization` 和 `workspace.view.workflow`。
- 组织视图不直接修改流程顺序；流程视图不直接修改组织层级。
- 流程 Task 通过 `ownerSeatId` 引用组织中的 Seat。删除或禁用 Seat 时，系统必须先处理引用它的 Task。
- Run 画布是只读投影：根据 Workflow Transition 和 Task owner Seat 显示实际 Handoff，不把运行投影写回组织结构。

### 1.3 所有用户动作都形成命令

每个改变 Draft 或 Run 的动作都必须具备：

```text
commandId
clientOperationId
targetId
expectedRevision? / expectedSequence?
payload
```

命令被接受后才更新“已保存”语义。失败的命令不得只更新局部 UI 状态。

## 2. 应用壳与导航

### 2.1 首屏状态

应用启动后依次经历：

```text
booting
  -> restoring_preferences
  -> checking_backend
  -> no_workspace | workspace_loading | startup_error
  -> ready
```

- `booting` 只显示启动进度，不显示旧 Fixture 或开发控件。
- Backend 健康检查失败时，用户看到可操作的“重试”和“查看诊断”，不能进入半连接的编辑态。
- `no_workspace` 进入 Workspace 创建流程；已有 Workspace 时优先恢复 `lastWorkspaceId`。
- `workspace_loading` 先显示名称、项目目录和 Draft 加载状态，避免用户误以为可以编辑未加载内容。

### 2.2 全局导航

导航轨道只承载跨 Workspace 的目的地和状态入口：

```text
workspaces | runs | attention | settings
```

- 当前 Workspace、待处理 Attention 数量和连接状态必须可辨识。
- 导航轨道不放 Runner 模式切换，不放大量运行按钮，不显示内部 ID。
- 点击 Attention 入口后，系统完成 Workspace 切换、对象定位和检查器打开；如果目标 Run 已结束，打开只读历史上下文。

### 2.3 Workspace 顶部上下文

顶部只显示当前 Workspace 名称、项目目录摘要、当前编辑上下文、保存状态和一个主操作：

```text
组织 | 流程 | 运行
```

Runner 只在 Workspace 设置、节点高级配置和启动预览中出现，不作为顶栏模式。

## 3. 创建 Workspace

### 3.1 创建流程

创建流程是一个可返回的分步表单，步骤顺序固定为：

1. 名称
2. 项目目录
3. 默认 Runner
4. Agent 输出语言

每一步保存临时表单状态，只有最后的“创建 Workspace”命令会写入 `WorkspaceConfig`。

### 3.2 名称

- 名称必填，去除首尾空白，长度和非法字符按平台文件名规则校验。
- 名称只影响显示和 Workspace 标识，不作为磁盘目录名的隐式替代。
- 关闭流程时，如果表单有内容，显示“继续编辑 / 丢弃”确认；没有内容直接关闭。

### 3.3 项目目录

- 使用平台原生目录选择器，不让用户手写平台特定路径作为唯一入口。
- 目录必须存在、可读；执行 Run 前还需验证可写和权限策略。
- 显示规范化后的绝对路径，同时保留用户选择的原始路径语义，不手工替换分隔符。
- 目录不可用时阻止下一步，并显示可操作原因：不存在、不可读、不可写或被系统拒绝。

### 3.4 Runner 探测与选择

打开 Runner 步骤后立即开始探测。探测项状态为：

```text
probing | available | missing | incompatible | needs_configuration | unsupported_platform | probe_failed
```

- `pi` 是默认推荐项；若有可用 Profile，默认选中它。
- 用户可以选择其它 `available` 或完成配置后可用的 Runner Profile。
- Runner 列表展示名称、版本、能力摘要和诊断入口，不展示密钥值。
- 没有可用 Profile 时不能完成 Workspace 创建；提供“重新探测”和“打开配置”而不是伪造可用状态。
- 探测超时不阻塞其它 Runner 的结果；只要用户选中的 Profile 已完成探测并可用，就可以提交选择。
- 创建成功后只保存 Profile 引用和非秘密设置，秘密值由设备安全存储管理。

### 3.5 Agent 输出语言

- 初始选项至少为 `zh-CN` 和 `en-US`，默认取设备 UI Locale，但用户可以独立选择。
- 该选择写入 `WorkspaceConfig.defaultOutputLocale`，不改变设备 UI Locale。
- Run 启动前可以在不修改 Workspace 默认值的情况下为本次 Run 选择其它输出语言。

### 3.6 创建结果

创建命令成功后按以下顺序完成：

1. 写入 WorkspaceConfig。
2. 创建空的 `OrchestrationDraft`，并写入一个初始 `revision`。
3. 选择起始方式：空白、单 Agent、模板。
4. 进入组织视图。

任何一步失败都保留表单内容，显示具体失败原因和重试入口；不得创建半配置 Workspace。

## 4. Workspace 恢复与切换

- Workspace 列表显示名称、项目目录、最近 Run 状态和未处理 Attention 数量。
- 切换前若当前 Draft 有未完成保存，先等待保存结果；保存失败时要求用户选择“重试保存”或“放弃本次修改”。
- 切换操作不销毁其它 Workspace 的运行连接和内存状态；运行中的 Run 继续由 Runtime 执行。
- 切换回来后先从持久化快照和事件序列恢复，再恢复上次的选择和 Viewport。选择和 Viewport 不进入业务版本。
- 项目目录失效时仍加载 WorkspaceConfig 和 Draft，禁用启动 Run，并提供“重新绑定项目目录”；不能把目录失效误报为编排丢失。
- Workspace 打开失败不影响其它 Workspace；错误页提供“重试、打开目录、移除最近记录”三个动作，移除记录不删除业务数据。

## 5. 组织视图交互

### 5.1 创建与编辑

组织视图支持以下明确命令：

| 命令 | 结果 |
|---|---|
| 新建 Group | 创建 Group，默认挂到当前选中容器或根 |
| 新建 Seat | 创建 Seat，并要求选择 Role 和父节点 |
| 新建 Role | 创建可复用职责，不自动创建 Seat |
| 编辑 | 在检查器中修改名称、职责、指令和能力 |
| 移动归属 | 明确选择新的 Group 或 Seat 作为父节点 |
| 启用/禁用 | 控制新 Task 是否可以指派给 Seat |
| 删除 | 先显示引用影响，再要求确认 |

- 拖动 Seat 或 Group 只更新 `PresentationDraft.nodeLayouts`。
- 改变父子关系必须通过“移动归属”命令、父节点选择器或明确的拖入确认；普通画布拖动不能触发。
- 目标父节点不能是自身或其后代；命令执行前和保存前都做环检测。
- 新建 Seat 没有可用 Role 时，先引导创建 Role，不能保存悬空 Seat。

### 5.2 删除影响预览

删除前显示引用集合：

```text
被哪些 Seat 使用
被哪些 Task 指派
哪些 Workflow 路径和 Artifact Binding 会受影响
```

- 有 Task 引用的 Seat 不能直接删除，用户必须先重新指派、禁用相关 Task 或取消操作。
- 有 Seat 引用的 Role 不能直接删除；可以先停用 Role，或逐个处理引用。
- 删除 Group 只删除容器关系，不删除其子 Seat；必须让用户选择“移动子项到父级”或“逐项处理”。

### 5.3 检查器内容

Seat 检查器依次展示：

1. 身份、Role、启用状态和当前引用数量。
2. 指令覆盖和能力要求。
3. Runner 高级覆盖（默认折叠）。
4. 由该 Seat 负责的 Task 列表。
5. 运行中的状态和最近 Artifact（运行态只读）。

Role 检查器展示职责、默认指令、能力和输出契约；修改 Role 不重写已经存在的 Seat 指令覆盖。

## 6. 流程视图交互

### 6.1 节点

流程视图只允许首版节点类型：

```text
start | task | gate | join | end
```

- `start` 和至少一个 `end` 由流程骨架提供；用户不能创建第二个入口。
- 新建 Task 必须选择 owner Seat；禁用 Seat 不出现在可选列表中。
- 新建 Gate 必须选择 `approval` 或 `question`，并配置允许动作；首版 Gate 固定为阻塞。
- 新建 Join 必须选择 `all` 或 `any`，并连接至少两个并行来源。
- 不提供任意脚本节点、自由表达式条件或隐藏的自动化分支。

### 6.2 连接

来源节点只显示合法 trigger：

| 来源 | 允许 trigger |
|---|---|
| Start | `always` |
| Task | `success`, `failure` |
| Approval Gate | `approved`, `rejected` |
| Question Gate | `answered` |
| Join | `always` |
| End | 无出边 |

- 从节点端口创建 Transition，释放时只显示该节点允许的 trigger。
- 连接 Task 到 Task 时，系统要求确认输出 Artifact Contract 与下游 Input Binding；缺少契约时先标记阻塞错误。
- Gate 的出边 trigger 必须与 Gate action 一一对应：`approved`、`rejected` 或 `answered`。
- Join 只接受分支输入，不允许绕过 Join 把并行分支隐式合并。
- 删除 Transition 时保留两端节点，显示受影响的输入和可达性校验结果。

### 6.3 Rework

- 只有 Gate 的 `rejected` 出边可以形成回到既有 Task 的 Rework 环。
- 创建或编辑 Rework 时必须输入正整数 `maxIterations`，并显示达到上限后的处理方式。
- 普通环连接立即被标为阻塞错误，不能启动 Run。

### 6.4 Artifact Contract

Contract 编辑器要求：名称、媒体类型、是否必填、数量（`one` 或 `many`）和描述。

- Input Binding 只能引用上游 Contract，不绑定具体机器路径。
- 修改 Contract 的含义时，显示所有下游引用并要求确认；已经存在的不可变版本不被重写。
- 删除 Contract 前必须清理所有 Input 和 Output 引用。

## 7. 选择、画布和检查器

### 7.1 选择模型

- 单击对象选中并打开检查器；空白单击清除选择并关闭检查器。
- `Shift` 多选只用于批量布局和启用/禁用，不允许批量修改角色指令或流程语义。
- Hover 只显示即时上下文；完整信息在检查器中显示。
- 选择状态使用轮廓、定位标记和主信号表达，不用大面积背景遮住画布。

### 7.2 画布手势

- 空白区域拖动平移，滚轮或触控板以指针为中心缩放。
- 拖动对象改变位置；拖动到父节点区域不会自动改变层级。
- `Fit` 优先适配当前活动路径，其次适配当前展开范围。
- 展开、折叠和聚焦使用稳定过渡；状态事件不得触发布局重排。
- 深层组织进入子组织时显示返回路径，退出后恢复上一级的选择上下文。

### 7.3 检查器关闭顺序

`Esc` 依次关闭菜单或弹层、模态框、检查器、当前选择和子组织聚焦。关闭检查器不撤销已提交编辑。

## 8. 自动保存、撤销与冲突

### 8.1 Draft 编辑批次

- 每个成功的编辑命令立即更新内存 Draft，并进入待保存队列。
- 单行文本在 Enter 或失焦时提交；多行文本使用明确的保存动作或 `Cmd/Ctrl+Enter` 提交，输入法组合期间不触发快捷键。
- 连续布局拖动合并为一个历史操作批次；松开指针后形成一条可撤销记录。
- 命令空闲约 250ms 后自动保存，应用退出或切换 Workspace 前必须等待队列清空。

### 8.2 保存状态

顶部显示以下稳定状态：

```text
saved | saving | save_failed | conflict
```

- `save_failed` 不丢弃内存 Draft，提供重试；离开 Workspace 时必须明确处理。
- `conflict` 表示 `expectedRevision` 不匹配。首版不做静默合并，提供“重新加载已保存版本”和“保留当前修改为模板”两个明确动作。
- 重新加载会丢弃当前内存 Draft，必须二次确认；保留副本生成新的 Template，不覆盖冲突版本。
- 自动保存不创建 OrchestrationVersion；版本只在启动 Run、保存 Template 或用户显式创建时产生。

### 8.3 撤销与重做

- 撤销和重做只作用于当前 Draft 的成功命令，不反向修改已经启动的 Run。
- 保存成功不会清空历史栈；切换 Workspace 时各自保留独立历史，进程重启后历史栈可以丢失。
- 删除、移动归属、批量禁用和 Contract 语义修改均必须作为单条可撤销命令。

## 9. 校验与错误定位

### 9.1 增量校验

每次命令完成后只重算受影响的 Organization、Workflow 和 Presentation 规则，并在检查器和画布对象上显示结果：

```text
valid | warning | blocking_error
```

- 警告不阻止编辑或保存。
- 阻塞错误不阻止继续编辑，但阻止启动 Run。
- 点击错误入口必须定位到对应对象、打开对应检查器并显示修复字段。

### 9.2 启动前完整校验

点击“开始 Run”时执行完整校验，至少检查：

- 唯一 Start、可达 End、无不可达节点。
- 所有 Task owner Seat、Role、Runner capability 引用有效。
- 必填 Input 有来源，Contract 无悬空引用。
- Gate action、Transition trigger、Join policy 一致。
- 无普通环，Rework 有上限。
- 当前设备有可用 Runner Profile，项目目录可访问。

完整校验未通过时不创建 RunSnapshot，并将焦点移动到最高优先级错误。

## 10. 启动 Run

### 10.1 启动预览

启动面板显示：

```text
orchestration version
project root
resolved Runner per Task
output locale
required capabilities
blocking warnings/errors
```

- Runner 解析遵循 `Task override > Seat override > Workspace default`，并显示解析来源。
- 输出语言默认使用 Workspace 值，但本次选择只写入 RunSnapshot。
- 用户输入作为 `runInput` 进入 Snapshot；空输入是否允许由流程配置决定。

### 10.2 创建与进入运行态

点击确认后：

1. 执行完整校验。
2. 创建不可变 `OrchestrationVersion`。
3. 深拷贝生成 `RunSnapshot`，冻结 Runner、项目目录、输出语言和编排内容。
4. 创建 Run 并提交 `clientOperationId`。
5. Runtime 返回初始序列后，进入只读运行画布。

任何一步失败都保留 Draft，允许用户修复后再次启动；已创建但未启动的 Run 只能进入清理流程，不能复用旧 Snapshot 猜测新配置。

### 10.3 运行画布

- 组织和流程结构只读，当前 Task、Handoff、Attention 和 Artifact 是动态层。
- Handoff 使用有方向的短脉冲；动画结束后保留最近交付状态。
- 运行中的编辑按钮隐藏或置为“创建 Amendment”，不能直接改 Snapshot。
- 点击 Seat、Task、Handoff 或 Artifact 打开检查器，详情来自 RunSnapshot 和 RuntimeState 的明确来源。

## 11. 空、加载和错误状态

| 状态 | 主界面行为 | 可操作动作 |
|---|---|---|
| 空 Workspace | 画布保留最小工作面 | 创建单 Agent、导入模板、打开设置 |
| 空组织 | 组织视图显示一个新建入口 | 新建 Role、Seat 或 Group |
| 空流程 | 流程视图显示 Start 到 End 骨架 | 新建 Task 或套用模板 |
| 加载中 | 保留导航上下文，不显示假数据 | 取消加载（若支持）、重试 |
| Runtime 不可用 | 组织和 Draft 仍可编辑 | 重试连接、查看诊断，启动按钮禁用 |
| 保存失败 | 保留内存修改并固定提示 | 重试、另存副本、放弃修改 |
| 校验失败 | 定位错误对象 | 修复、查看影响 |

错误文案使用 `message_key` 和参数，不能把内部异常堆栈直接放在主工作面；详细诊断进入 Inspect。

## 12. 键盘与可访问性

默认快捷键：

| 快捷键 | 动作 |
|---|---|
| `Cmd/Ctrl+S` | 立即保存 Draft |
| `Cmd/Ctrl+Z` | 撤销 |
| `Cmd/Ctrl+Shift+Z` | 重做 |
| `Delete` / `Backspace` | 删除当前选择，若有引用则先显示影响 |
| `F` | 适配当前选择或活动路径 |
| `Enter` | 激活当前焦点或进入编辑 |
| `Esc` | 按层级退出 |

- macOS 使用 `Cmd`，Windows/Linux 使用 `Ctrl`；输入框和 IME 组合期间不拦截文本编辑快捷键。
- 所有画布对象、图标按钮和状态提示必须有可访问名称；状态不能只靠颜色表达。
- 键盘焦点进入画布后可按对象顺序移动，进入检查器后焦点不跳回画布。
- 减少动态模式下禁用路径位移，只保留必要的颜色或透明度反馈。

## 13. 验收标准

- 新用户从启动到创建 Workspace 不需要旧 Fixture、开发服务或手写 API。
- 创建 Workspace 必须完成项目目录、可用 Runner 和默认输出语言三项配置。
- 组织拖动不会改变父子关系；流程连接不会偷偷改变组织结构。
- 一个 Draft 的编辑、撤销、自动保存、冲突和重新加载有可观察状态。
- 有阻塞校验错误时，启动动作不会创建 RunSnapshot。
- 启动后修改 Workspace 默认 Runner、UI Locale 或 Draft 不影响已启动 Run。
- `zh-CN`、`en-US`、浅色、深色、减少动态和高 DPI 下，控件结构和操作位置保持稳定。
- 关键动作在 Windows、macOS、Linux 的键盘、目录选择和窗口环境下都能完成。

## 14. 待产品确认

以下选择已经按推荐方案写入，但在实现门禁前需要产品确认：

1. Runner 探测不到任何可用 Profile 时，阻止完成 Workspace 创建。
2. 组织父子关系必须使用明确“移动归属”命令，画布拖动只改布局。
3. Draft 自动保存，启动 Run 自动创建不可变版本和 Snapshot。
4. 首版冲突不做静默合并，只提供重新加载或保留副本。
