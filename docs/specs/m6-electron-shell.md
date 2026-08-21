# M6 Electron Shell and Rust Runtime Boundary

**状态**：CURRENT · CRITICAL-REVIEWED ACCEPT DOCUMENTATION BASELINE · F0/F1 IMPLEMENTATION PAUSED（2026-08-21）
**风险等级**：Critical
**审查**：[M6 Electron Shell Architecture Critical Review](reviews/M6-electron-shell-architecture-review-2026-08-21.md) · **ACCEPT** · 当前Shell/security/transport/ownership唯一Critical ACCEPT · 仅限文档范围
**阶段**：F0-A2 Electron Supervisor/Security Bridge，随后 F0-A3 三平台生命周期与打包证明；所有实现仍暂停
**依赖**：[m6-architecture.md](m6-architecture.md) · [f0-a-runtime-lifecycle.md](f0-a-runtime-lifecycle.md) · [m6-local-runtime-scheduling.md](m6-local-runtime-scheduling.md) · [m6-platform-packaging.md](m6-platform-packaging.md) · [m6-events-commands.md](m6-events-commands.md) · [m6-execution-workspace-security.md](m6-execution-workspace-security.md) · [../ssot/platform-adaptation.md](../ssot/platform-adaptation.md)

## 1. 背景、目标与不变范围

Ensemble 的生产桌面壳选择 Electron，以固定 Chromium 渲染行为、降低三个桌面平台的渲染差异，并把窗口、原生平台能力、安装和更新放在同一套可验证边界内。现有 React Canvas Renderer 保留，现有 Rust Runtime sidecar 继续承担全部业务和执行职责。

本次迁移直接形成一个 Electron 生产壳，不维持 Tauri/Electron 双生产路线。仓库中的旧壳和 M0-M5 Python/Tauri 实现是迁移前实现与历史证据，不是新壳的翻译模板；只有 Electron 边界通过 F0-A2 和 F0-A3 后，旧 `src-tauri` 才进入后续退休工作。本规格不授权删除旧代码，也不授权 F0、F0-A1、F1 或产品实现。

以下合同保持不变：

- React Canvas Renderer 的产品布局、Domain 投影、交互语义和设计系统。
- Rust Runtime 的 Domain、Command、Event、SQLite、队列、计划、权限、Runner Adapter、PTY/ConPTY、进程树和安全退出所有权。
- [m6-domain-model.md](m6-domain-model.md)、[m6-run-operations.md](m6-run-operations.md) 和 [m6-runner-adapter.md](m6-runner-adapter.md) 定义的数据、保存和执行语义。
- F0-A1 的 token file、ready descriptor、随机 loopback 端口、认证健康检查、不同 data root 并行、同 root datastore lock 和 graceful release 合同。
- Workspace/FileRoot/PathGrant 在 Runtime 内部保存真实平台路径的现有含义。Electron 只改变 Renderer 到 Shell 的结构化目录选择边界，不改变 Runtime API 或持久化字段。

## 2. 生产进程与信任边界

```text
User
  |
  v
Electron Renderer: apps/canvas
  React Canvas / view state / typed product requests
  no Node, no filesystem, no Runtime bootstrap values
  |
  | one frozen preload allowlist
  v
Electron Preload: apps/desktop
  typed value translation only
  no business rule, no raw ipcRenderer, no generic channel
  |
  | validated IPC request or transferred MessagePort
  v
Electron Main: apps/desktop
  lifecycle / platform / security / sidecar supervision / proxy / updater
  no Domain, no SQLite, no Runner ownership, no PTY
  |
  | authenticated loopback HTTP + WebSocket/binary stream
  v
Rust Runtime sidecar: crates/ensemble-runtime
  Domain / Command / Event / SQLite / queue / schedule / permission
  Runner Adapter / PTY-ConPTY / process tree / safe quit
  |
  +-- user-installed pi CLI
  +-- user-installed Codex CLI
  +-- user-installed Claude Code
```

生产信任关系固定为：

1. Renderer 是不可信输入源，只能调用冻结的命名方法。
2. Preload 是最小翻译层，不拥有业务状态、认证材料或原生资源。
3. Main 是平台权限代理和 Runtime transport 代理，不是 Node 业务 Runtime。
4. Rust Runtime 是所有业务写入、持久化、Runner 与进程状态的唯一权威。
5. Runner、Terminal、Artifact 和用户正文均按不可信敏感内容处理；它们可以自然包含路径，但不能被解释成 Shell 能力或目录授权。

## 3. 职责划分

| 边界 | 负责 | 明确不负责 |
|---|---|---|
| Renderer | 产品 UI、临时视图状态、typed request、Event/Terminal 投影、用户反馈 | Node API、任意 IPC、原始文件系统、Runtime token/port/PID/ready path、Domain/save 裁决 |
| Preload | 暴露冻结 allowlist、参数/结果值转换、MessagePort 转交 | `ipcRenderer` 暴露、通用 `invoke/send/on`、Buffer/fs/process/env、缓存业务状态、拼装路径 |
| Electron Main | BrowserWindow、安全策略、单实例、公开平台目录与具名picker primitive、受控外链、Runtime sidecar定位/监督、typed IPC路由、stream bridge、更新 | 凭据/secret或Runner账号token语义、PermissionGrant评估/扩大、operation批准、Domain/Command/Event语义、Node SQLite/PTY、Runner启停/枚举/分类、业务重试、保存成功判定 |
| Rust Runtime | Domain、Command/Event、SQLite、queue/schedule/permission、Runtime request、Runner Adapter、PTY/ConPTY、进程树、safe quit/recovery | 窗口、Electron 导航、Renderer 布局、系统对话框 |
| Shared protocol | Shell request/result/stream/selection DTO 与纯校验 | 平台 IO、业务持久化、应用导入、第二套 Domain schema |

Electron Main/Preload不引入Node版业务服务、Node PTY、Node SQLite、Runner SDK或第二套调度器。Main不能根据窗口状态、Terminal文本、进程名、最近活动项或路径显示值推断Run/Attempt/Runner状态，也不能读取Runner/account token、解释secret reference、评估/扩大PermissionGrant或批准operation。OS安全凭据与sandbox/broker由Rust Runtime经Rust平台适配器拥有。

## 4. BrowserWindow 与生产内容

每个生产 `BrowserWindow` 必须同时满足：

```text
contextIsolation = true
sandbox = true
nodeIntegration = false
webSecurity = true
webviewTag = false
```

附加规则：

- 不使用 Electron `remote`，不注册 `<webview>`，不为 worker、subframe 或辅助窗口开放 Node。
- 生产 Renderer 只加载已打包的 `app://ensemble`，Main 只接受精确 origin `app://ensemble` 的主 frame。
- `app://ensemble` scheme 在应用 ready 前注册为 secure/standard，并从只读打包资源解析；路径规范化、目录穿越、编码绕过和不存在资源全部拒绝。
- 生产代码不从环境变量、命令行、偏好或远端配置读取替代 Renderer URL，也不回退到任意开发 URL。
- 默认拒绝导航、窗口创建、下载、权限请求、设备访问和未知 scheme。允许的内部 route 由 React Router 处理，不触发页面级跨 origin 导航。
- CSP 至少为 `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-src 'none'; child-src 'none'`。不得加入 `unsafe-eval`、远程脚本、远程字体或远程 frame。
- DevTools 在生产包默认关闭，诊断入口只能返回脱敏信息；不得通过用户偏好或普通环境变量打开生产 DevTools。

Renderer只能调用具名`platform.requestOpenExternal`并提交一个URL字符串；Renderer声称的gesture、trusted、confirmed或allow字段一律不存在且不可信。Security owner按以下可实现流程处理：

1. 以WHATWG URL解析并规范化；只接受`https:`、空userinfo、默认443端口、无控制字符。`http`、未知scheme、file/data/javascript、非默认端口和解析差异全部拒绝。
2. 对`host + pathname + search + hash`执行编译期exact allowlist。V1默认allowlist为空；每个允许的完整规范化目标必须由Security owner在`apps/desktop/src/main/security/external-link-policy.ts`显式加入并评审，禁止通配host、path prefix、运行时/env/远端配置和开放重定向。若产品不需要query/hash，则两者必须为空。
3. 对每个`webContents`执行最多3次/10秒请求限速。通过policy后，Security owner使用Main原生确认对话框显示安全截断的host与path，默认按钮为Cancel；只有该对话框本次返回Open，才产生一次不可复用的内部authorization。
4. Platform owner只消费该内部authorization并执行一次`electron.shell.openExternal(normalizedUrl)`；authorization不返回Renderer、不跨URL/窗口/reload复用。取消、窗口销毁或执行失败均终结本次请求。

Renderer的`<a target>`、`window.open`、键盘/鼠标事件字段或自报gesture不能绕过该流程。自动化必须覆盖每个拒绝分支、native Cancel/Open、限速、authorization one-shot和allowlist逐项精确匹配。

## 5. 固定 Preload 表面

Preload 只在 `window.ensemble` 暴露一个递归冻结对象。F0/F1 固定分类如下：

| 分类 | 命名能力 | 说明 |
|---|---|---|
| `platform` | `getPublicCapabilities`、`requestOpenExternal` | 外链由Security owner执行exact allowlist、限速和Main原生确认；Platform owner只执行最终one-shot `shell.openExternal` |
| `preferences` | `readDevicePreferences`、`replaceDevicePreferences` | 仅设备偏好，不接收 Workspace/Run 字段 |
| `directories` | `selectProjectDirectory`、`selectPathGrantDirectory` | 返回一次性 opaque selection，不返回真实路径 |
| `runtime` | `getConnectionState`、`retryStartup`、`openDiagnostics` | 只返回脱敏状态和稳定诊断 code |
| `workspaces` | `listWorkspaces`、`createWorkspace` | 具名 typed 方法；Main 将 selection ref 解析为现有 Runtime 输入 |
| `runners` | `probeRunnerProfiles` | 返回能力和诊断，不返回可执行路径、环境或秘密 |
| `events` | `openWorkspaceEventStream` | 转交 MessagePort，不按 chunk 调用 `invoke` |
| `terminal` | `openTerminalStream`、`requestTerminalInputLease` | 转交 MessagePort；最终 lease 校验仍由 Runtime 完成 |
| `lifecycle` | `requestQuit`、`continueQuit`、`forceQuit`、`openQuitProgress` | 代理现有 Runtime safe-quit barrier |

未来新增能力必须在 `packages/protocol/src/shell/` 中先增加具名方法、schema、限额和安全审查，再由 Main router 与 Preload 同步实现。以下接口永远禁止：

- `send(channel, value)`、`invoke(channel, value)`、`on(channel, handler)` 或任意字符串通道。
- 暴露 `ipcRenderer`、Electron event、`Buffer`、`fs`、`path`、`process`、`process.env`、端口、token、ready descriptor、PID 或 native handle。
- 把 Main/Runtime error、response header/body 或完整环境对象原样传给 Renderer。
- 用 preload 保存 Workspace、Run、Draft、Terminal 或 Runner 业务状态。

## 6. 请求与结果信封

Shell bridge使用与Domain Command/Event分开的transport信封。它不新增Domain对象或持久化字段。以下union是F0/F1唯一method/error allowlist；实现、schema和测试必须逐项一致，不接受任意字符串扩展。

```ts
type ShellMethod =
  | "platform.getPublicCapabilities"
  | "platform.requestOpenExternal"
  | "preferences.readDevicePreferences"
  | "preferences.replaceDevicePreferences"
  | "directories.selectProjectDirectory"
  | "directories.selectPathGrantDirectory"
  | "runtime.getConnectionState"
  | "runtime.retryStartup"
  | "runtime.openDiagnostics"
  | "workspaces.listWorkspaces"
  | "workspaces.createWorkspace"
  | "workspaces.reconcileWorkspaceCreate"
  | "runners.probeRunnerProfiles"
  | "events.openWorkspaceEventStream"
  | "terminal.openTerminalStream"
  | "terminal.requestTerminalInputLease"
  | "lifecycle.requestQuit"
  | "lifecycle.continueQuit"
  | "lifecycle.forceQuit"
  | "lifecycle.openQuitProgress";

type ShellErrorCode =
  | "invalid_source"
  | "invalid_origin"
  | "invalid_method"
  | "invalid_payload"
  | "payload_too_large"
  | "rate_limited"
  | "duplicate_request_id"
  | "request_canceled"
  | "stale_window_generation"
  | "selection_expired"
  | "selection_bound_to_other_command"
  | "selection_required"
  | "runtime_unavailable"
  | "runtime_protocol_mismatch"
  | "external_link_denied"
  | "external_link_canceled"
  | "slow_consumer"
  | "internal_error";

type ShellRequest<TMethod extends ShellMethod, TPayload> = {
  protocolVersion: number;
  requestId: string;
  method: TMethod;
  payload: TPayload;
};

type ShellResult<T> =
  | { protocolVersion: number; requestId: string; ok: true; value: T }
  | {
      protocolVersion: number;
      requestId: string;
      ok: false;
      error: { code: ShellErrorCode; messageKey: string; retryable: boolean };
    };

type ActivationTarget = {
  kind: "workspace" | "run" | "attention";
  id: string;
};

type ActivationIntent = {
  kind: "activate";
  target?: ActivationTarget;
};
```

Main不信任信封中的调用者信息。`webContents.id`、frame、origin和窗口generation从Electron event/context派生；Renderer gesture/confirmation claim从不作为授权输入。每次调用按以下顺序处理：

1. 验证来源是已登记的目标`webContents`。
2. 验证调用来自main frame，且生产origin精确等于`app://ensemble`。
3. 验证method属于上面的closed union且在该window generation启用。
4. 按method closed schema校验payload；拒绝未知key、原型污染key、超深对象、超长数组/字符串和超出byte budget的值。
5. 验证`requestId`格式、窗口内唯一性、并发上限、速率、deadline和取消状态。
6. 仅在全部通过后调用具体handler；handler返回已知`ShellErrorCode`，不回传异常堆栈和底层响应。
7. 导航、reload、render-process-gone或窗口销毁时取消该generation的pending request，迟到结果不得投递到新页面。

Transport接受不等于业务成功。Domain Command仍使用预先分配的`commandId`、durable ledger和Event/Snapshot结果；Shell`requestId`只关联一次本地代理调用，不能替代、生成或重新分配业务identity。

## 7. Event 与 Terminal 流

Event和Terminal不使用逐chunk的chatty`invoke`。Main通过`MessageChannelMain`创建port，只把Renderer端经Preload转交；Main端连接Rust Runtime认证流。所有流使用同一字节credit模型，不使用frame-count credit或模糊的`grant`。

```ts
type DecodedStreamFrame<T> = {
  protocolVersion: number;
  streamId: string;
  sequence: number;
  kind: "data" | "end" | "error";
  payload?: T;
};

type StreamTransfer = {
  streamId: string;
  sequence: number;
  frameByteLength: number;
  encodedFrame: ArrayBuffer;
};

type StreamControl =
  | {
      streamId: string;
      kind: "credit";
      acknowledgedSequence: number;
      grantBytes: number;
    }
  | { streamId: string; kind: "cancel"; reasonCode: string };
```

`DecodedStreamFrame`使用版本化确定性binary codec编码为一个`encodedFrame`；`frameByteLength`必须精确等于传给`postMessage`并transfer的`encodedFrame.byteLength`，包含logical header与payload。Event payload先按canonical UTF-8 JSON编码进该binary frame；Terminal payload作为binary field编码。实现不得用Node对象大小估算、字符数或压缩前后混合值计费。

固定V1预算按每个stream独立计算：

```text
MAX_FRAME_BYTES = 262144          # 256 KiB
MAX_OUTSTANDING_CREDIT_BYTES = 4194304   # 4 MiB
MAX_QUEUED_BYTES = 8388608        # 8 MiB
MAX_PAUSE_MS = 30000
```

规则：

- Main发送前先验证`0 < frameByteLength <= MAX_FRAME_BYTES`，再从remaining credit原子扣除；任何frame大于remaining credit都不得发送或拆成未定义片段。
- 初始credit control固定`acknowledgedSequence=0`。其后`acknowledgedSequence`必须严格单调递增、不超过last sent，并且只确认Renderer已按顺序处理的连续frame；duplicate/stale/future/non-contiguous acknowledgement是protocol violation，立即关闭port并记录脱敏code。
- `grantBytes`必须为正整数；加到remaining credit后不得超过`MAX_OUTSTANDING_CREDIT_BYTES`。ack本身不自动返还credit，只有显式`grantBytes`增加额度。
- Main按frame完整入队；queued byte总和不得超过`MAX_QUEUED_BYTES`。credit为零或queue达到预算时暂停从Runtime读取；连续暂停超过`MAX_PAUSE_MS`以`slow_consumer`关闭并释放全部queue。
- 长期Event/Terminal stream没有lifetime总字节上限。限制只作用于当前outstanding credit、单frame和queued bytes；正常ack/grant可无限期推进。
- Shell`sequence`对单stream从1连续递增。Workspace Domain Event的canonical`sequence`仍属于Runtime账本，两者永不混用；Event重连用最后已处理的Domain sequence，而非Shell stream sequence。
- Event按完整typed item传递；Terminal codec承载原始bytes且不暴露Node`Buffer`。Renderer不得在frame验证完成前ack。
- cancel、导航、reload、crash、Runtime generation变化、Terminal Handle generation变化或lease失效立即关闭旧port。旧port不重新绑定新identity。
- Main为每个port保存来源window/main frame/origin/stream kind/Domain identity/generation/Runtime connection generation；每个control复验。
- Terminal输入仍需Runtime签发并最终校验`TerminalInputLease`。Main不能因port存在、window focus或旧lease ref放行输入。
- Terminal/Artifact/user/Runner内容按不可信敏感正文处理，不能把字符串提升为selection、Shell method、外链或权限决定。

## 8. 原生目录选择与 Workspace create 对账

Renderer和Shell shared protocol不传递结构化真实绝对路径。原生picker返回：

```ts
type NativeDirectorySelection = {
  selectionRef: string;
  displayName: string;
  access: "read" | "write";
  expiresAt: string;
};

type WorkspaceCapabilityPolicies = {
  networkAccess: "allow" | "ask" | "deny";
  externalProcessExecution: "allow" | "ask" | "deny";
  writesOutsideWorkspace: "allow" | "ask" | "deny";
  destructiveCommands: "allow" | "ask" | "deny";
  externalPublish: "allow" | "ask" | "deny";
};

type WorkspaceCreateBridgeInput = {
  commandId: string;
  name: string;
  projectSelectionRef: string;
  runnerProfileId: string;
  permissionProfile: "read_only" | "workspace_write" | "selected_paths" | "full_access";
  pathGrantSelections: Array<{
    selectionRef: string;
    access: "read" | "write";
    scope: "workspace";
  }>;
  capabilityPolicies: WorkspaceCapabilityPolicies;
  defaultOutputLocale: "zh-CN" | "en-US";
};
```

`WorkspaceCreateBridgeInput`是Renderer/Shell bridge类型，不是现有Rust Runtime`WorkspaceCreateInput`。Runtime类型继续保留真实project path/path grants、原字段名和原save meaning；Main只在成功解析selection后构造该未变化输入。

Renderer在首次dispatch前分配不可变Domain`commandId`，并把`commandId`、冻结的非目录表单值、当前opaque selection refs和create state原子写入Client request/recovery registry。registry不保存raw path，不把Shell`requestId`当业务identity。用户修改任一非目录语义字段以形成新create intent时必须分配新`commandId`并重新选择目录。

picker method固定`purpose=workspace_project | workspace_path_grant`。Main内存selection record至少包含：

```text
selectionRef
state = unbound | bound(commandId) | spent
webContentsId
windowGeneration
mainFrameRoutingIdentity
purpose
access
expiresAt
rawAbsolutePath
```

Main处理`createWorkspace`或`reconcileWorkspaceCreate`时固定执行：

1. 先按`commandId`查询/对账Runtime durable command ledger，不能先重新提交。
2. 若Runtime已有accepted/full payload，Main不再需要raw selection即可查询最终`workspace.created`、rejected或conflict。Runtime accepted只表示durable ownership，不等于Workspace已创建。
3. 若Runtime确认没有durable record，Main才校验当前selection。全部ref必须unbound或已`bound`同一`commandId`，并匹配source window/frame、purpose、access和expiry；验证事务把unbound原子转为`bound(commandId)`。绑定其它command的ref永久拒绝。
4. Main解析raw path，构造未变化Runtime`WorkspaceCreateInput`，并以同一`commandId`提交。Runtime一旦确认accepted/full payload，Main立即擦除对应raw path，仅保留无path的bound tombstone直到terminal outcome。
5. lost response、Renderer retry和reconciliation始终复用同一`commandId`并先query。若Runtime没有record且原ref仍有效，可用同一绑定重试；ref已过期、取消或Main重启丢失时，用户可重新选择，并只把新ref绑定同一`commandId`后重试。一个新`commandId`必须使用全新refs。
6. Main restart使全部内存selection/ref mapping失效，但不能复制已accepted create：恢复流程先按Client registry中的原`commandId`查询Runtime。只有明确`not_recorded`才要求有效/重选selection并以同一command重试。
7. terminal`created | rejected | conflict`后，Main删除该command的bound tombstone和任何残余selection；导航/窗口销毁也清理尚未accepted的ref。Main不持久化create业务状态、raw path、command result或第二份Workspace记录。

`displayName`是非权威显示标签，不能反向解析路径、作为identity或完整path tooltip。Runtime成功后，`FileRoot.localPath`和PathGrant继续按现有合同保存真实路径。Terminal/Artifact/Diff/用户/Runner内容可能自然含路径，仍按不可信敏感正文治理。

## 9. Sidecar 定位、校验与 Bootstrap

Electron Main 只监督随当前安装包交付的 Rust Runtime sidecar：

1. `app.requestSingleInstanceLock(activationIntent)`必须在任何Runtime spawn前成功。失败进程只通过Electron`second-instance`附带下面的closed`ActivationIntent`；既有实例不读取或转发其它argv/cwd。
2. 生产 sidecar 路径只能由 `process.resourcesPath` 加编译期固定相对路径和签名资源 manifest 解析，例如 `runtime/<platform>-<arch>/ensemble-runtime[.exe]`。
3. 不搜索 `PATH`，不读取用户配置中的 executable override，不回退到仓库、`target/`、开发 server、Python 或旧 supervisor。
4. Runtime 二进制位于 ASAR 外的只读 `extraResources`。Main 在 spawn 前验证 manifest 中的目标平台、架构、版本、协议兼容范围、文件 digest 和平台签名/notarization 状态。
5. Shell和sidecar必须来自同一个签名发布集合。任一校验失败都进入脱敏`startup_error`，不尝试另一个可执行文件。

第二实例只允许`{ kind: "activate", target?: { kind: "workspace" | "run" | "attention", id } }`。完整intent UTF-8 JSON上限512 bytes；`id`必须匹配`^[A-Za-z0-9_-]{1,128}$`。source只能是同一Electron app identity/single-instance lock触发的`second-instance`event；IPC/Renderer不能伪造。Main丢弃OS传入的raw argv/cwd和除Electron framework启动所需外的flags，不解析path/URL/env。intent拒绝raw file path、URL、token、port、PID、ready path和未知key；raw second-instance输入不得写log。通过验证的opaque target必须等Runtime health与startup reconciliation完成后再导航；target不存在/无权时显示typed unavailable。

F0-A1 bootstrap合同保持不变：Main 创建权限收紧的 token file 与 ready file path，执行签名 sidecar，并传入显式 data root、token file 和 ready file。Runtime 继续：

- 解析 canonical data root 并获取 datastore lock；
- 随机绑定 `127.0.0.1:0`；
- 原子发布 ready descriptor；
- 对所有 HTTP 请求要求会话 token；
- 以版本化 health 返回协议、PID 和非秘密 data-root digest；
- graceful shutdown 时只删除自己拥有的 ready descriptor并释放 lock。

Main持有Runtime token、port、ready path和PID，只通过`runtime-client`发出typed代理请求。Renderer/Preload、Shell-exported DTO/error/diagnostic/telemetry、通知、URL和用户可导出的log不得包含这些bootstrap值或raw structured path/env。

受限本机Main/Runtime lifecycle log可以按F0-A1既有合同记录非秘密PID、loopback port、protocol version和data-root digest以排障；不得记录session token、raw secret-file contents、token/ready file path、完整env、request body或second-instance raw argv/cwd。该范围澄清不改变F0-A1 ready descriptor/health/log语义。

## 10. 启动、退出与恢复

### 10.1 启动

```text
requestSingleInstanceLock
  -> register app://ensemble and security handlers
  -> resolve platform directories
  -> verify signed sidecar manifest and exact resource path
  -> create restricted bootstrap files
  -> spawn Rust Runtime
  -> wait for owned ready descriptor
  -> authenticated health + protocol compatibility
  -> Runtime ledger/startup classification barrier
  -> expose sanitized ready/reconciling state to Renderer
  -> allow product writes only after Runtime write-ready fact
```

Main 可以在 Runtime 对账期间加载打包 Renderer，以显示 `runtime_reconciling`，但只能暴露脱敏 phase/code。连接成功、HTTP accepted 或 Event port 建立都不能提前宣称 Workspace ready。

### 10.2 关闭窗口

关闭主窗口默认隐藏到托盘。Electron Main 和 Rust Runtime 继续运行；Runtime 自己继续 Run、Runner、queue 和 schedule。Renderer detach 不改变 Domain、Terminal lease、Runner 或保存状态；是否释放输入 lease仍由 Runtime 合同决定。

### 10.3 显式安全退出

1. Renderer flush 自己的 Client recovery journal，然后通过具名 lifecycle 方法请求退出。
2. Main 调用现有 Runtime safe-quit API，并把 typed progress 通过 MessagePort 转发。
3. Runtime 建立 sidecar-wide command-admission fence，排空/对账 already-accepted Draft row，处理全部非终态 Run、Runner process tree、ShutdownRecoveryPlan 和 completion Event。
4. Main 只等待 Runtime acknowledgement；不枚举、不终止、不重分类 Runner child，也不写 Attempt/Run/Handle/SQLite。
5. Runtime acknowledgement 证明 barrier 已完成后，Main 终止或等待 Rust sidecar 正常退出，清理自己的 bootstrap 资源并退出 Electron。

默认 30 秒观察期到达时只开放 Continue waiting 与 Force quit。Force 路径：

- Main 先请求 Runtime 进行现有对账；
- Runtime 不响应时，Main 只写 supervisor marker 和脱敏诊断；
- Main只终止当前安装集合中owned、signed Rust sidecar，不枚举、kill或重分类Runner child；
- Runner 进程树与 parent-death containment 由 Rust Runtime/平台 containment 设计负责；
- 下次启动由 Runtime 根据 marker、账本和登记信息完成业务分类。

### 10.4 崩溃与恢复

- Main crash 后，新 Main 先取得 Electron single-instance ownership，再等待旧 Runtime datastore lock/进程 containment 有界收敛；不能并发打开数据或直接声明旧 Runner 已停止。
- Renderer crash/reload 只使 request 和 MessagePort generation 失效，不重启 Runtime。
- Runtime crash 由 Main 记录脱敏 supervisor fact并进入 `startup_error`/reconciliation，不在 Node 中重建 Domain 或 Runner 状态。
- 更新或重启后，Runtime 继续按现有 marker、launch、delivery、Handle、claim、Attempt、Draft ledger 和 recovery owner classification barrier 恢复；Electron 不添加第二套恢复数据库。

## 11. 开发与生产分离

| 项目 | 开发 | 生产 |
|---|---|---|
| Renderer 来源 | 固定的本地开发 origin，仅由显式 dev build 启用 | 仅 `app://ensemble` 打包资源 |
| Runtime | 可使用当前构建产物和隔离 dev data root | 只使用签名 `process.resourcesPath` sidecar |
| DevTools | 开发 build 可启用 | 关闭 |
| CSP | 保持无 Node/无远程业务 API，开发工具例外需显式审查 | 严格 CSP，无 `unsafe-eval`/远程内容 |
| 身份与 DTO | 与生产相同 schema、origin/frame/source 校验模型 | 固定 production allowlist |
| 更新 | 禁用 | Main-only signed updater |

生产行为不能由 `ELECTRON_START_URL`、任意环境变量、命令行 URL 或用户偏好改变。开发 build 必须有不可伪造的编译期标记和不同应用 identity/data root；开发 transport 不形成第二套业务 API、Command/Event 或目录 DTO。

## 12. 打包、签名与更新

生产交付必须：

- 在 manifest/lockfile 精确固定 Electron 与 `electron-builder` 版本，不使用浮动 range；保存该 Electron 对应的精确 Chromium 版本和安全公告检查证据。
- 由 `apps/desktop` 保存 Electron Main、Preload、tests 和 electron-builder 配置；Renderer build 作为只读资源装入。
- 默认将应用 JS 放入 ASAR；Rust sidecar、签名资源 manifest 和需要平台执行位的文件通过 `extraResources` 放在 ASAR 外。未列入 manifest 的可执行资源不得启动。
- 对 Electron app、Preload/Main 资源、Rust sidecar 和 updater metadata 形成同一发布版本；Windows 签名、macOS hardened runtime/signing/notarization、Linux 包校验分别留证据。
- updater 只在 Main 中运行，只访问精确 allowlist endpoint，验证发布签名、channel、目标平台/架构和 Shell/Runtime/protocol 兼容范围。
- 更新下载到 staging，完整验证后原子切换；失败保留当前已签名版本，不运行半更新资源。更新不得只替换 Shell 或只替换 sidecar。
- 更新前请求现有 safe-quit barrier；强制更新不得绕过 Runtime 的 Runner/SQLite 所有权。
- 三个平台分别验证安装、首次启动、升级、失败更新保持旧版本、卸载、重新安装和用户数据保留/删除规则。

### 12.1 Electron fuse hardening

manifest/lockfile还必须精确固定与当前Electron兼容的`@electron/fuses`版本。Security owner维护fuse policy；package/test owner在package完成、签名前执行fuse flip，随后立即readback，签名/公证完成后再对最终可执行文件readback。顺序固定为`package -> flip fuses -> readback -> sign/notarize -> final artifact readback`；fuse失败或readback不符阻止签名和发布。

当前Electron/平台支持时，最终packaged binary必须为：

```text
RunAsNode = false
EnableNodeOptionsEnvironmentVariable = false
EnableNodeCliInspectArguments = false
EnableEmbeddedAsarIntegrityValidation = true
OnlyLoadAppFromAsar = true
EnableCookieEncryption = true
```

`EnableCookieEncryption`在upstream Electron/目标平台支持且产品使用cookie/session storage时必须开启；若工具明确报告不支持，F0-A3证据必须记录Electron版本、平台和blocked原因，不得静默跳过。`OnlyLoadAppFromAsar`只约束Electron app code；签名Rust sidecar仍按manifest从`extraResources`执行。`EnableEmbeddedAsarIntegrityValidation`要求electron-builder生成并签入匹配ASAR integrity metadata。

Windows、macOS、Linux都必须从实际分发/安装后的binary使用pinned fuse tooling readback上述值；源码配置、打包log或未安装staging binary不能代替。负向测试必须证明`ELECTRON_RUN_AS_NODE`、`NODE_OPTIONS`、`--inspect/--inspect-brk`、外部app code和篡改ASAR不能启用Node或启动应用。

## 13. 目标目录与非重叠所有权

```text
apps/canvas/
  src/runtime-gateway/electron-gateway.ts

apps/desktop/
  src/main/lifecycle/
  src/main/platform/
  src/main/runtime-supervisor/
  src/main/runtime-client/
  src/main/ipc-router/
  src/main/stream-bridge/
  src/main/security/
  src/main/updater/
  src/preload/
  test/
  electron-builder.yml

packages/protocol/src/shell/
  bridge.ts
  envelopes.ts
  streams.ts
  native-directory-selection.ts
  schemas.ts
```

| Owner | 独占范围 | 责任 |
|---|---|---|
| Electron Main lifecycle owner | `apps/desktop/src/main/lifecycle/**` | app events、window/tray引用、single-instance/ActivationIntent和quit orchestration；只消费Security owner的BrowserWindow factory，不构造/配置BrowserWindow、preload、URL或security policy |
| Electron platform owner | `apps/desktop/src/main/platform/**` | 只执行Security/Runtime已授权的具名native primitive：picker、notification和最终one-shot`electron.shell.openExternal`；不拥有external allowlist/native confirmation、BrowserWindow policy或业务状态 |
| Runtime supervisor owner | `apps/desktop/src/main/runtime-supervisor/**` | 签名 sidecar 定位、bootstrap、进程监督；不管理 Runner child |
| Runtime client owner | `apps/desktop/src/main/runtime-client/**` | authenticated loopback typed proxy；持有 bootstrap secret |
| IPC router owner | `apps/desktop/src/main/ipc-router/**` | source/method/schema/limit validation和具名 handler |
| Stream bridge owner | `apps/desktop/src/main/stream-bridge/**` | MessagePort exact byte-credit、encoded frame length、contiguous ack、fixed outstanding/queue/pause budgets、cancel/stale/generation |
| Electron security owner | `apps/desktop/src/main/security/**` | 独占BrowserWindow factory/construction、preload path、production URL、scheme/CSP、navigation/window/permission、external-link exact allowlist/限速/native confirmation和fuse policy |
| Updater owner | `apps/desktop/src/main/updater/**` | signed atomic update与Shell/Runtime兼容校验 |
| Preload owner | `apps/desktop/src/preload/**` | 唯一 frozen allowlist；不编辑 Main handler或业务 gateway |
| Desktop package/test owner | `apps/desktop/test/**`、`apps/desktop/electron-builder.yml`及该app manifest | Electron integration/security/package tests、electron-builder、ASAR/integrity、按Security policy执行fuse flip和最终binary readback；不定义fuse/security policy |
| Shared shell protocol owner | `packages/protocol/src/shell/**` | 纯 typed bridge DTO、closed schema和validation；不新建 shell-contract package |
| Canvas gateway owner | `apps/canvas/src/runtime-gateway/electron-gateway.ts` | 消费 frozen bridge并适配现有 Canvas gateway port；不访问 Electron IPC |
| Rust Runtime owners | `crates/ensemble-runtime/**` 的既有 namespace | Domain/Command/Event/SQLite/Runner/PTY/process tree/safe quit；不由 Electron owner 改写 |

Lifecycle owner不得直接调用`new BrowserWindow`或设置webPreferences/loadURL；Security owner返回已配置window给Lifecycle持有。Platform owner不得持有external allowlist、显示confirmation或判断URL policy，只执行带Security内部one-shot authorization的最终primitive。

`packages/protocol/src/shell/`是现有共享协议包的子模块，不创建`packages/shell-contract`、`packages/electron-protocol`或复制类型。当前 M6 owner 表是实施文件所有权的唯一来源；历史并行规程和 Tauri review 不再授权 owner。

## 14. 三平台验证矩阵

每项都需要真实安装包、命令/脱敏log、截图或accessibility tree，以及Electron、Chromium、Runtime、OS、架构和包版本。Browser/component测试、浏览器预览或未打包`electron .`不能替代任何packaged Electron行。

| 验证项 | Windows | macOS | Linux |
|---|---|---|---|
| 签名安装、首次启动与卸载 | [ ] | [ ] | [ ] |
| 精确Electron/Chromium/`@electron/fuses`版本证据 | [ ] | [ ] | [ ] |
| `app://ensemble` bundled load，无任意 URL 回退 | [ ] | [ ] | [ ] |
| BrowserWindow五项安全设置、fuse final-binary readback与no-Node负向probe | [ ] | [ ] | [ ] |
| navigation/window/permission/remote-content默认拒绝；external exact allowlist+native confirm | [ ] | [ ] | [ ] |
| Preload allowlist、unknown method/key/depth/bytes/rate 拒绝 | [ ] | [ ] | [ ] |
| wrong webContents/subframe/origin/stale generation 拒绝 | [ ] | [ ] | [ ] |
| opaque directory ref的source/purpose/access/expiry/immutable-commandId binding | [ ] | [ ] | [ ] |
| Renderer 无 token/port/PID/ready path/structured raw path | [ ] | [ ] | [ ] |
| exact `resourcesPath` sidecar、digest/signature和no-PATH fallback | [ ] | [ ] | [ ] |
| app single instance先于spawn；closed ActivationIntent、raw argv/cwd不记录、reconciliation后导航 | [ ] | [ ] | [ ] |
| F0-A1 same-root reject / distinct-root Runtime proof | [ ] | [ ] | [ ] |
| Event MessagePort byte-credit、256KiB frame/4MiB outstanding/8MiB queue/30s pause与reconnect | [ ] | [ ] | [ ] |
| Terminal MessagePort同一byte-credit/binary/lease/stale-port/slow-consumer | [ ] | [ ] | [ ] |
| 关窗到托盘后 Run/queue/schedule继续 | [ ] | [ ] | [ ] |
| safe quit、30秒等待、Force marker与下次Runtime对账 | [ ] | [ ] | [ ] |
| Runtime/Renderer/Main crash恢复且无第二状态源 | [ ] | [ ] | [ ] |
| Shell+sidecar签名原子升级与失败保留旧版本 | [ ] | [ ] | [ ] |
| `pi`/Codex/Claude Runner进程树由Runtime回收 | [ ] | [ ] | [ ] |
| Packaged CJK IME forms：composition中Enter不提交，compositionend后不重复 | [ ] | [ ] | [ ] |
| Packaged CJK IME Terminal：composition中Enter不发送，compositionend后字节不重复 | [ ] | [ ] | [ ] |
| Packaged keyboard/focus：Tab/Shift+Tab/Escape/return-focus完整 | [ ] | [ ] | [ ] |
| Packaged forced-colors/high-contrast与accessibility tree | [ ] | [ ] | [ ] |
| Narrator / VoiceOver / Orca或平台等价screen-reader主流程 | [ ] | [ ] | [ ] |
| 两种locale、浅/深/系统theme、标准/高DPI、reduced motion | [ ] | [ ] | [ ] |

## 15. 非目标

- 不在 Electron Main、Preload 或 Renderer 中实现 Domain、Runner、SQLite、PTY、队列、计划、权限或安全退出状态机。
- 不改变 Rust Runtime API、Command/Event catalog、Workspace/FileRoot/PathGrant、save meaning 或持久化 schema。
- 不维护 Tauri/Electron 双生产壳、兼容 wrapper、Runtime fallback 或旧 supervisor 翻译层。
- 不把 Renderer 变成 Web 产品，不开放远端 Runtime、任意 URL、webview、浏览器扩展或 Node worker。
- 不在 F0-A2 引入自动更新业务策略、Runner 插件市场、云同步或第三方 Shell plugin。
- 不把正文中出现的路径、命令、URL 或 JSON 当作 Shell capability。

## 16. 实施门禁

### F0-A1 Rust Runtime Bootstrap

F0-A1 合同和验收保持不变。Electron 文档不能重开、改写或声称该实现已经通过。F0-A2 只能在产品负责人接受 F0-A1 后开始。

### F0-A2 Electron Supervisor/Security Bridge

关闭条件：

- `apps/desktop`、`packages/protocol/src/shell/` 和 Canvas Electron gateway 按本规格边界实现。
- BrowserWindow factory/owner边界、scheme/CSP、Preload allowlist、Main source/schema/limit、Workspace create commandId对账、opaque selection command binding、external native confirmation、exact sidecar和byte-credit MessagePort有自动化与运行证据。
- Main 不含 Node business Runtime/PTY/SQLite/Runner ownership，Renderer 不含 raw bootstrap/platform值。
- 未来F0-A2实现仍需独立implementation Critical review，对本节semantic oracle逐项记录pass/blocked/not applicable；当前文档ACCEPT不能替代实现证据。

### F0-A3 Windows/macOS/Linux Electron + Runtime Lifecycle/Packaging Proof

关闭条件：

- 第14节三个平台全部有真实签名安装包证据。
- sidecar、closed second-instance activation、托盘、safe quit、crash recovery、fuse flip/final readback、签名原子更新、卸载、installed-app IME/a11y和无孤儿进程成立。
- 精确Electron/Chromium、electron-builder、`@electron/fuses`、Rust Runtime和协议兼容版本可复现。
- 当前质量/CI从旧壳过渡到Electron门禁的条件已满足，且不存在双生产路线。

### F1-A Renderer Reacceptance 与 F1-B Electron Integration

F1-A 重新接受 Canvas 的 opaque目录DTO、frozen bridge消费、root reconciliation和无bootstrap泄露；旧视觉证据只覆盖未变化界面。F1-B 在 F0-A3 后接入真实 Electron preferences、picker、Runtime gateway、托盘和quit flow。二者都必须保持 Runtime save/API语义不变。

## 17. Semantic Oracle 与反向案例

| Oracle | 必须成立 | 反向案例/必须失败 |
|---|---|---|
| 单一业务真源 | 同一操作的Domain结果只由Rust Runtime Event/Snapshot裁决 | Main收到HTTP 200就标记Workspace saved |
| Shell职责 | Main只代理平台/transport并监督一个签名Runtime | Main使用Node SQLite恢复Run或枚举Runner进程 |
| Renderer隔离 | Renderer无Node、ipcRenderer、token、port、PID、ready path和结构化raw path | DevTools中可读取`process.env`或picker绝对路径 |
| 来源验证 | 只有已登记webContents的`app://ensemble` main frame可调用 | subframe、旧window generation或伪造origin调用成功 |
| closed schema | 未知method/key、超限payload、重复requestId被拒绝 | `__proto__`、深对象或任意channel被handler接收 |
| Workspace create幂等 | Client先持久化immutable commandId；selection只绑定该command，retry先query Runtime | lost response后新command或新IPC requestId重复创建Workspace |
| Runtime合同不变 | Main解析ref后构造既有Runtime path输入；持久化meaning不变 | 为Electron新增第二种`FileRoot`或只保存displayName |
| Stream byte-credit | exact encoded bytes debit-before-send；ack连续单调；outstanding/queue/pause有界且无lifetime cap | grant按frame计数、future ack、超credit发送或长流因累计bytes被截断 |
| Terminal最终授权 | Runtime是`TerminalInputLease`最终validator | Main仅因窗口focus或port存在放行输入 |
| 安全退出所有权 | Runtime完成barrier并author acknowledgement | Main逐个kill Runner并自行写Attempt interrupted |
| sidecar供应链 | 只启动resourcesPath manifest中的签名sidecar | PATH、仓库target或环境override被生产启动 |
| 外链授权 | exact compile-time HTTPS target + rate limit + Main native confirm产生one-shot authorization | 信任Renderer gesture/confirm flag或Platform自行放行URL |
| Activation保密 | second instance只收closed opaque intent，丢弃且不记录raw argv/cwd | path/URL/env/bootstrap值进入activation或log |
| Fuse hardening | final installed binary readback匹配六项fuse policy | 配置声明正确但shipped binary可RunAsNode/NODE_OPTIONS/inspect/外部app |
| 生产内容固定 | 只加载`app://ensemble`且无远程内容/unsafe-eval | 环境变量把生产窗口改到任意HTTP URL |
| Installed IME/a11y | 三平台package的composition、focus、screen reader、forced colors均实测 | 仅浏览器/component证据即关闭门禁 |
| 原子更新 | Shell、sidecar、metadata同签名版本切换 | 只更新Electron或只更新Runtime后仍启动 |
| 历史证据边界 | 旧Tauri审查只证明未变化业务合同 | 旧ACCEPT被用于批准Electron安全/owner实现 |

反向审查从“lost create response重复Workspace”“future ack绕过credit”“Renderer伪造外链gesture”“shipped binary fuse未生效”“second-instance泄露argv/cwd”“Lifecycle绕过Security factory”“packaged IME重复提交”“Main已成为第二Runtime”“Force quit改写Domain”九类假定事故出发。每类事故都必须能由自动化门禁或三平台运行证据在发布前捕获；仅有静态代码阅读不能关闭 F0-A2/F0-A3。
