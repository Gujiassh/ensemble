# Platform Adaptation SSoT

**状态**：Electron Shell文档架构Critical ACCEPT；F0-A1实现Critical审查ACCEPT并等待产品负责人验收；F0-A2、F0-A3、F1实现暂停，三平台package/lifecycle证据待补（2026-08-21）
**首发平台**：Windows、macOS、Linux
**Web**：仅开发和自动化验证，不作为首发产品
**Electron 边界**：[m6-electron-shell.md](../specs/m6-electron-shell.md)
**架构审查**：[M6 Electron Shell Architecture Critical Review](../specs/reviews/M6-electron-shell-architecture-review-2026-08-21.md) · **ACCEPT** · docs only · Electron implementation paused
**Runtime审查**：[F0-A1 Runtime Implementation Critical Review](../specs/reviews/F0-A1-runtime-implementation-review-2026-08-21.md) · **ACCEPT** · awaiting owner acceptance · owner pending · F0-A2 forbidden
**实施 Spike**：[m6-platform-packaging.md](../specs/m6-platform-packaging.md)
**执行与权限**：[m6-execution-workspace-security.md](../specs/m6-execution-workspace-security.md)

## 1. 交付目标

Ensemble 安装包自带 Electron Shell、React Canvas Renderer 和 Rust Runtime sidecar，不要求系统 Python、Node、pnpm 或仓库依赖。Node 只属于安装包内 Electron 自身，不形成业务 Runtime。Agent CLI 不随安装包分发；用户自行安装并登录 `pi`、Codex CLI 或 Claude Code。

每个平台必须交付：

- Electron Main/Preload 桌面壳
- Canvas Renderer 静态资源
- 单独签名的 Rust Runtime sidecar
- 默认配置和内置主题
- 签名更新元数据
- 完整卸载和数据位置说明

单个平台构建成功不代表跨平台完成。每个平台必须使用真实签名安装包独立验证 Electron、Chromium、Runtime、Runner、安装、升级和卸载。

## 2. Runtime 与 Shell 打包

生产使用固定版本 Electron 和 `electron-builder`。应用 JS 默认进入 ASAR；Rust Runtime、签名资源 manifest 和需要执行位的资源通过 `extraResources` 放在 ASAR 外。Runtime 目标产物按平台生成，例如：

```text
ensemble-runtime-<target-triple>[.exe]
```

Electron Main 只能从 `process.resourcesPath` 和签名 manifest 解析当前平台/架构的精确 sidecar。启动前校验版本、协议范围、digest 和平台签名；不得搜索 `PATH`，不得回退到仓库、开发产物、Python、旧 supervisor 或任意环境变量路径。

安装包要求：

- 不依赖仓库目录、系统 Python 或开发 `.venv`
- Electron、`electron-builder`、兼容`@electron/fuses`和Chromium版本证据精确可追溯；fuse顺序固定package -> flip/readback -> sign/notarize -> final installed-binary readback
- Shell、Renderer、Runtime 和 updater metadata 属于同一签名版本
- Windows 签名、macOS hardened runtime/signing/notarization、Linux 包校验分别留证据
- 安装、原子更新、更新失败保留旧版本、卸载和重新安装分别验证

## 3. 生产安全边界

生产 BrowserWindow 固定为 `contextIsolation=true`、`sandbox=true`、`nodeIntegration=false`、`webSecurity=true`、`webviewTag=false`；不使用 `remote`，不向 worker/subframe 开放 Node。Renderer 只加载打包的 `app://ensemble`，使用严格 CSP，无 `unsafe-eval`、远程内容或任意 URL/env redirect。

Preload只暴露精确`ShellMethod`union的冻结typed allowlist，不暴露`ipcRenderer`/generic channel/Electron event/Buffer/fs/process/env。Main复验webContents/main frame/origin/method/schema/limits/request identity/generation；导航、开窗和权限默认拒绝。Security owner独占BrowserWindow factory和external exact allowlist/限速/native confirmation；Lifecycle只消费factory，Platform只执行已授权picker/notification/final one-shot`electron.shell.openExternal`。

生产binary还必须通过pinned`@electron/fuses`翻转与readback：RunAsNode/NODE_OPTIONS/CLI inspect关闭，embedded ASAR integrity/only-load-app-from-ASAR开启，cookie encryption在支持且适用时开启；三个平台从最终安装binary复验。完整合同以[m6-electron-shell.md](../specs/m6-electron-shell.md)为准。

## 4. Runtime 生命周期

Electron Main 负责：

1. 在任何Runtime spawn前调用`app.requestSingleInstanceLock(activationIntent)`；第二实例只提交closed intent `{kind, target?{kind,id}}`，丢弃且不记录raw argv/cwd/path/URL/env/bootstrap值
2. 解析平台 app-config、app-data、app-log 和只读 resource path
3. 从签名 manifest 定位并校验唯一 Rust sidecar
4. 用 CSPRNG 生成至少 32 字节 token并创建权限收紧的 token file；在 data root 外选择 ready path，传入 F0-A1 bootstrap 参数；F0-A2 必须证明生成与文件保护
5. 等待 Runtime datastore lock、persistent sibling ready-path lease、随机 loopback listener、原子 ready descriptor、认证 health 和协议兼容检查
6. 持有Runtime token、port、ready path和PID，只向Renderer提供脱敏typed gateway；Runtime reconciliation完成后才解析opaque activation target
7. 关闭窗口时隐藏到托盘并保留 Runtime、Runner、queue 和 schedule
8. 显式退出时请求既有 Runtime safe-quit barrier并等待 acknowledgement
9. Force 路径只写 supervisor marker/脱敏诊断并终止 Rust sidecar，不枚举、终止或重分类 Runner child
10. 更新前完成同一 safe-quit 流程，并只原子切换同一签名集合的 Shell/Runtime

Rust Runtime 继续负责 canonical data root、datastore lock、SQLite、Domain、queue/schedule、Runner、PTY/ConPTY、进程树、shutdown fence、Draft drain、completion Event 和 recovery classification。Main 不写 Attempt、Run、Handle 或数据库状态。

F0-A1 的 producer-generated token、data-root 外 ready path/persistent sibling lease、ready descriptor、`127.0.0.1:0`、认证 health、same-root lock、distinct-root concurrency 和 1 秒 HTTP drain/graceful release 语义保持不变。Runtime 只验证 token syntax/minimum encoded material，不能证明 entropy。

## 5. Renderer、Shell 与 Runtime 数据边界

生产通信不能依赖固定 Vite origin、固定 Runtime 端口或 Renderer 持有认证材料：

```text
React Renderer
  -> frozen Preload allowlist / MessagePort
Electron Main
  -> authenticated loopback HTTP + WebSocket/binary stream
Rust Runtime
```

Renderer不获得Runtime token/port/PID/ready path/env/handle/raw path。Event/Terminal统一使用exact encoded byte-credit：`grantBytes`、`frameByteLength`、debit-before-send、256KiB frame、4MiB outstanding、8MiB queue、30s pause、contiguous ack且无lifetime cap。Domain Event sequence保持独立。

原生目录选择返回`selectionRef/displayName/access/expiresAt`。Workspace-create bridge还携带Client预先持久化的immutable Domain`commandId`；Main将selection原子绑定为`bound(commandId)`。每次retry/Main restart先query Runtime原commandId；accepted/full payload无需raw selection，只有明确not-recorded才以同command和有效/重选selection重试。Runtime `WorkspaceCreateInput` raw path、FileRoot/PathGrant/API/save不变，Main无业务持久化。

Terminal、Artifact、用户消息和 Runner 输出可能自然包含路径，统一作为不可信敏感正文处理。禁止原始结构化 path/token/port/process/env 泄露的是 bootstrap/platform/DTO 边界，不得用该规则篡改正文语义。

## 6. 数据位置

使用 Electron/操作系统平台目录 resolver，不手写 Home 路径：

```text
app-config/
  preferences.json
app-data/
  ensemble.db
  workspaces/
  runs/
  artifacts/
  execution-workspaces/
  terminal-transcripts/
app-log/
  shell.log
  runtime.log
```

规则：

- Workspace 业务数据与设备偏好分离
- 安装目录和 `process.resourcesPath` 只读
- Main 内部与 Runtime 使用平台原生 Path API
- Renderer 只持有 opaque selection ref 和显示标签
- Runtime 保存用户选择的真实平台路径，不手工替换分隔符
- Renderer/Shell-exported DTO/error/diagnostic/telemetry、通知和用户可导出log不含token/port/PID/ready path/raw path/env。受限本机Main/Runtime lifecycle log可按F0-A1记录非秘密PID/loopback port，但不得记录token、raw secret-file contents、token/ready file path、完整env/request body或second-instance raw argv/cwd
- Runner账号凭据由CLI原生登录管理；Ensemble自有秘密由Rust Runtime/Rust平台适配器写入OS安全凭据存储，Domain/配置只保存secret reference。Electron Main不读取或代理Runner/account token语义
- 只清理 Runtime 创建且登记、所有权可确认的 worktree/临时目录
- Terminal transcript 默认执行 30 天和每 Run 100 MB 保留策略

## 7. Runner 跨平台能力

每个 Runner Adapter 必须声明 `id`、display name、支持平台、availability/version/auth probe、capabilities 和 required configuration。创建 Workspace 时必须区分可用、版本不兼容、缺配置、平台不支持和探测失败。

Runner命令、环境、PTY/ConPTY、权限hook、进程终止和process-tree containment只放在Rust Runtime/Runner Adapter。OS安全凭据、secret ref解析和sandbox/broker由Rust平台适配器执行。Electron Main不探测Runner executable、不组装Runner env、不读取Runner/account token、不评估PermissionGrant、不拥有Node PTY，也不依据OS process list判断Agent状态。

首版官方 Adapter 为 `pi`、Codex CLI 和 Claude Code。三个 CLI 由用户自行安装、更新和登录；三个 Adapter 必须在 Windows、macOS、Linux 全部通过 Session、Terminal、Context package和权限资格，共九个真实组合。

## 8. 窗口、输入与系统偏好

| 项目 | 规则 |
|---|---|
| 默认窗口 | `1280x800` |
| 最小窗口 | `1024x680` |
| 缩放 | 支持系统 DPI 和多显示器切换 |
| 标题栏 | 优先系统原生；自绘时按平台适配 |
| 快捷键 | macOS 使用 `Cmd`，Windows/Linux 使用 `Ctrl` |
| 触控板 | 支持平移和以指针为中心缩放 |
| 键盘 | 主要流程完整可操作 |

Renderer可见的窗口、picker与系统UI偏好通过Electron Main具名能力暴露，不在业务组件中判断操作系统。权限、凭据、secret与sandbox/broker通过Rust Runtime/Rust平台适配器执行，Main不参与其语义。Renderer读取并响应系统浅色/深色、减少动态、高对比/forced colors、系统语言和DPI；用户显式偏好优先于普通系统偏好，系统强制可访问性设置优先。

## 9. 发布验证矩阵

每个平台至少验证：

- 签名全新安装、首次启动、升级失败保留旧版本、卸载和重新安装
- 精确Electron/Chromium/electron-builder/`@electron/fuses`/Runtime版本及final-binary fuse readback
- `app://ensemble` bundled load、Security factory/owner边界、BrowserWindow/CSP/no-Node和fuse负向probe
- wrong origin/frame/webContents/method/key/limits/stale port拒绝；external exact allowlist+native confirm one-shot
- Workspace create lost-response/Main-restart按原commandId对账；selection bound(commandId)且Renderer无raw path
- exact `resourcesPath`签名sidecar且无PATH/env fallback
- app single-instance先于spawn；closed ActivationIntent、ID/size/source校验、raw argv/cwd不记录、Runtime reconciliation后导航
- 创建Workspace并选择qualified Runner
- 三个Runner的版本、登录、Session、Terminal、Context和权限probe
- 关闭窗口进入托盘后Run、queue和schedule继续
- safe quit、Force marker、Runtime recovery和无无主Runtime/Runner进程
- 数据写入正确目录，Renderer无token/port/PID/ready path
- 共享Workspace、Git worktree和临时目录
- `read_only`、`workspace_write`、`selected_paths`和`full_access`
- Rust Runtime/Rust平台适配器的凭据存储与sandbox/broker、结构化脱敏和transcript清理；Electron Main无Runner/account token或PermissionGrant decision语义
- packaged forms与Terminal CJK IME composition无提前提交/重复；keyboard/focus/Escape/return-focus；forced colors/high contrast/a11y tree；Narrator/VoiceOver/Orca-equivalent；两种locale/theme、DPI、reduced motion

没有真实安装包运行证据，不得标记跨平台完成。Browser/component证据不能替代installed Electron IME/a11y或final-binary fuse readback。Electron文档架构虽已Critical ACCEPT，但不代表代码、package、平台门禁或实现授权已完成。
