# Platform Adaptation SSoT

**状态**：Runtime 形态已确认；三平台打包证据仍等待 F0 Spike（2026-08-19）
**首发平台**：Windows、macOS、Linux
**Web**：仅开发和自动化验证，不作为首发产品
**实施 Spike**：[m6-platform-packaging.md](../specs/m6-platform-packaging.md)
**执行与权限**：[m6-execution-workspace-security.md](../specs/m6-execution-workspace-security.md)

## 1. 交付目标

Ensemble 安装包自带 Rust Runtime，不需要系统 Python、Node、pnpm 或仓库依赖。Agent CLI 不随安装包分发：用户需要安装并登录 `pi`、Codex CLI 或 Claude Code 后才能执行工作。

每个平台必须交付：

- Tauri 桌面壳
- Canvas 前端静态资源
- 可随应用可靠运行的 Backend execution unit
- 默认配置和内置主题
- 完整卸载和数据位置说明

`bundle.targets = all` 不代表跨平台完成。每个平台必须独立构建和验证。

---

## 2. Runtime 打包

现有仓库 `.venv`、Python/CrewAI Runtime 和开发服务器启动方式废弃。生产使用随 Tauri 安装包交付、单独签名的 Rust Runtime sidecar：

要求：

- 不依赖仓库目录
- 不依赖系统 Python
- 不读取开发 `.venv`
- 资源路径来自平台 Resource Resolver
- 数据目录来自平台 App Data Resolver
- 日志目录来自平台 App Log Resolver
- 启动失败必须返回可操作的错误信息

目标产物按平台生成，例如：

```text
ensemble-runtime-<target-triple>[.exe]
```

---

## 3. Runtime 生命周期

Tauri 壳负责：

1. 解析 canonical app-data root，并在读取业务数据前获取该 root 的 OS 原子 supervisor lock
2. 获取失败时通过 OS 本机 single-instance IPC 激活现有窗口并退出，不启动第二个 Runtime
3. 创建受限 bootstrap channel 并生成单次会话访问令牌
4. 传入数据、日志、loopback `port=0` 和令牌
5. 启动 Runtime sidecar；Runtime 获取 datastore lock 后才能打开 SQLite，端口由操作系统原子分配
6. 从 bootstrap channel 接收实际端口和协议版本
7. 等待认证健康检查
8. 只把 typed gateway 安全提供给 Canvas，不暴露端口和令牌
9. 关闭窗口时隐藏到托盘并保留 Runtime、Runner、队列和计划
10. 显式退出时默认请求安全暂停，等待 Runtime 完成 shutdown fence、Runner termination、资源收敛和 completion Event 持久化
11. 收到 Runtime shutdown acknowledgement 后只终止 Runtime sidecar 和 Shell 自身进程树；Runner 已由 Runtime 通过 matching evidence 确认 stopped，Shell 不写 Attempt、Run 或 Handle 状态
12. 超时强制退出时请求 Runtime 对账；Runtime 不响应则只写 supervisor shutdown marker，再终止进程树
13. 强制退出、未确认 shutdown、注销、关机和崩溃后由下次 Runtime 执行事件、租约、计划和 interrupted 状态对账

只有 lock owner 可以启动或关闭该 data root 的进程树；只有 datastore lock owner 可以写 SQLite、处理 Queue/Schedule tick 或变更 Domain 状态。lock 依赖 OS handle 生命周期释放，stale metadata 只能在重新取得原子 lock 并确认旧 owner 退出后清理。Shell 崩溃而 Runtime 尚在退出时，新 Shell 必须等待 datastore lock 有界释放，不能并发打开数据库。

独立 Backend 只绑定 `127.0.0.1`，不得监听外部网卡。

生产通信不能依赖固定 Vite Origin 或固定端口。Client 通过 typed Tauri IPC 调用 Shell，Shell 使用认证 loopback HTTP 和 WebSocket 连接 Runtime；Client 不获得 Runtime token。完整规则见 [m6-local-runtime-scheduling.md](../specs/m6-local-runtime-scheduling.md)。

---

## 4. 数据位置

使用 Tauri 提供的平台目录，不手写 Home 路径。

逻辑目录：

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
  backend.log
```

规则：

- Workspace 业务数据与设备偏好分离
- 安装目录只读
- 文件路径使用平台原生 Path API
- 用户选择的项目路径原样保存，不手工替换路径分隔符
- 日志中不得泄露访问令牌和敏感环境变量
- Runner 账号凭据由 CLI 原生登录管理；Ensemble 自己注入的秘密保存在平台安全存储，配置和业务记录只保存 secret reference
- Runtime 创建的 worktree/临时目录单独登记；只清理登记且所有权可确认的目录
- Terminal transcript 默认执行 30 天和每 Run 100 MB 保留策略

---

## 5. Runner 跨平台能力

每个 Runner Adapter 必须声明：

```text
id
display_name
supported_platforms
availability_probe
version_probe
capabilities
required_configuration
```

创建 Workspace 时只显示当前平台可用的 Runner。探测结果必须区分：

- 已安装且可用
- 已安装但版本不兼容
- 缺少配置
- 当前平台不支持

Runner 的命令、进程终止和环境变量组装放在 Adapter 中，不散落在通用编排逻辑里。

首版官方 Adapter 为 `pi`、Codex CLI 和 Claude Code，并随 Runtime 交付。三个 CLI 均由用户自行安装、更新和登录；Adapter 必须探测可执行位置、最低版本、已验证范围、原生登录状态和权限能力。三个 Adapter 必须在 Windows、macOS、Linux 全部通过正式资格，不能用平台不支持状态缩小首版承诺。

---

## 6. 窗口与输入

| 项目 | 规则 |
|------|------|
| 默认窗口 | `1280x800` |
| 最小窗口 | `1024x680` |
| 缩放 | 支持系统 DPI 和多显示器切换 |
| 标题栏 | 优先系统原生；自绘时按平台适配 |
| 快捷键 | macOS 使用 `Cmd`，Windows/Linux 使用 `Ctrl` |
| 触控板 | 支持平移和以指针为中心缩放 |
| 键盘 | 主要流程完整可操作 |

平台差异通过壳层能力和统一 Platform Adapter 暴露，不在业务组件中大量判断操作系统。

---

## 7. 系统偏好

前端必须读取并响应：

- 系统浅色/深色
- 减少动态
- 高对比或 forced colors
- 系统语言
- DPI 和缩放比例

用户显式选择优先于系统主题；系统强制可访问性设置优先于普通主题偏好。

---

## 8. 发布验证矩阵

每个平台至少验证：

- 全新安装
- 首次启动
- Backend 健康检查或进程内自检
- 创建 Workspace 并选择 Runner
- 启动和结束 Run
- 三个用户安装 Runner 的版本、登录和 capability probe
- 关闭窗口进入托盘后 Run、队列和计划继续
- 显式退出、注销和关机后无无主 Runtime/Runner 进程
- 数据写入正确目录
- 重启后偏好、Workspace、Run、执行租约和错过计划恢复
- 浅色、深色和系统主题
- `zh-CN`、`en-US`
- 共享 Workspace、Git worktree 和临时隔离目录
- `read_only`、`workspace_write`、`selected_paths` 和 `full_access`
- selected paths 原生目录选择、凭据存储、结构化脱敏和 transcript 清理
- formal Seat 空闲休眠、transient worker 回收和风险感知 recovery Attempt
- 标准 DPI 与高 DPI
- 卸载后应用程序移除，用户数据处理符合平台规则

没有对应平台的真实安装包运行证据，不得标记跨平台完成。
