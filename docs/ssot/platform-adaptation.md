# Platform Adaptation SSoT

**状态**：已确认；桌面绑定与打包仍等待 F0 Backend 形态决策（2026-08-18）
**首发平台**：Windows、macOS、Linux
**Web**：仅开发和自动化验证，不作为首发产品
**实施 Spike**：[m6-platform-packaging.md](../specs/m6-platform-packaging.md)

## 1. 交付目标

用户安装 Ensemble 后即可运行，不需要自行安装 Python、Node、pnpm 或 Runtime 依赖。

每个平台必须交付：

- Tauri 桌面壳
- Canvas 前端静态资源
- 可随应用可靠运行的 Backend execution unit
- 默认配置和内置主题
- 完整卸载和数据位置说明

`bundle.targets = all` 不代表跨平台完成。每个平台必须独立构建和验证。

---

## 2. Backend 打包

现有仓库 `.venv` 启动方式废弃。生产架构可以选择：

- 将核心 Backend 放入 Tauri/Rust 进程
- 随安装包交付按目标平台构建的独立 sidecar

最终选型由 M6 Backend/打包 Spike 决定。无论采用哪一种，都必须满足：

要求：

- 不依赖仓库目录
- 不依赖系统 Python
- 不读取开发 `.venv`
- 资源路径来自平台 Resource Resolver
- 数据目录来自平台 App Data Resolver
- 日志目录来自平台 App Log Resolver
- 启动失败必须返回可操作的错误信息

如果使用 sidecar，目标产物按平台生成，例如：

```text
ensemble-runtime-<target-triple>[.exe]
```

---

## 3. Backend 生命周期

如果 Backend 为独立进程，Tauri 壳负责：

1. 选择空闲 loopback 端口
2. 生成单次会话访问令牌
3. 传入数据、日志、端口和令牌
4. 启动 Backend sidecar
5. 等待健康检查
6. 将连接信息安全提供给 Canvas
7. 应用退出时请求优雅停止
8. 超时后终止其进程树

独立 Backend 只绑定 `127.0.0.1`，不得监听外部网卡。

生产通信不能依赖固定 Vite Origin 或固定端口。开发环境和生产环境分别配置，但使用相同的认证协议。

---

## 4. 数据位置

使用 Tauri 提供的平台目录，不手写 Home 路径。

逻辑目录：

```text
app-config/
  preferences.json
app-data/
  workspaces/
  runs/
  artifacts/
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

默认 `pi` Runner 的生产分发必须自包含或随安装包交付其所需执行单元，不得要求用户额外安装 Node。其它可替换 Runner 可以依赖用户独立安装的产品，但 Adapter 必须在探测结果中明确安装、版本和配置要求。

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
- 使用 sidecar 时，应用退出后无残留子进程
- 数据写入正确目录
- 重启后偏好和 Workspace 恢复
- 浅色、深色和系统主题
- `zh-CN`、`en-US`
- 标准 DPI 与高 DPI
- 卸载后应用程序移除，用户数据处理符合平台规则

没有对应平台的真实安装包运行证据，不得标记跨平台完成。
