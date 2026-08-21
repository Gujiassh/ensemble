# Ensemble 总览

**状态**：V2产品与Electron Shell文档基线（2026-08-21）· F0-A1实现Critical审查ACCEPT并等待产品负责人验收 · 产品实现暂停

## 产品定位

Ensemble 是一款跨平台、本地优先的 Agent 编排桌面应用。

用户通过组织画布完成：

- 创建 Workspace 并选择默认 Runner
- 配置权限、指定目录和 Agent 派生预算
- 定义 Role、Seat、Group、Task、Transition 和协作交接
- 配置输入输出、交付约束和人工门禁
- 启动多 Agent Run，或自然退化为单 Agent
- 观察状态、处理 Attention、查看变更和交付结果
- 保存和复用编排模板

## 核心体验

- 画布优先，不做固定三栏后台
- 左侧只有全局导航
- 检查器按需出现
- Seat 去卡片化
- 协作交接使用短暂方向脉冲
- 浅色优先，主题可变
- 多语言和跨平台从架构层支持
- 正式界面不出现 Fixture、LOD 和 Mock 等开发控件

## 产品边界

首版包含：

- Windows、macOS、Linux Electron 桌面端
- 本地 Workspace 和 Run
- 可替换 Runner
- 单 Agent、多 Agent 和嵌套组织
- Theme、Density、Motion 和 Locale 设置
- Session/Terminal、三种执行目录、权限和历史搜索/导出
- 系统托盘后台运行、持久化队列、定时计划和风险感知恢复
- `pi`、Codex CLI、Claude Code 三个官方 Runner Adapter

首版不包含：

- 移动端
- 生产 Web 版
- 账户与云同步
- 企业多租户
- Runner 插件市场

## 目标生产架构

```text
Electron Main/Preload shell
  -> React Canvas Renderer
  -> authenticated proxy
  -> Rust Runtime sidecar
  -> user-installed Runner CLI
```

Electron Main/Preload 只承担窗口、平台能力、安全边界、Runtime sidecar 监督和 typed transport。Rust Runtime 继续唯一拥有 Domain、Command、Event、SQLite、queue、schedule、permission、Runner、PTY/ConPTY、进程树和 safe quit。Renderer 不获得 Node、Runtime token/port/PID/ready path 或结构化原始绝对路径。

生产只保留一个 Electron 壳，不建设双壳兼容路线。旧壳和 Python/Tauri 产物属于历史实现或迁移期当前代码，不是目标架构，也不能作为 Electron 安全、transport 或 owner 的授权证据。

## 当前代码定位

M0-M5 原型验证过部分功能概念，但其前端、Backend、协议和持久化都不是 V2 兼容约束。当前工作树仍含旧壳、Python Runtime 和既有 F1-A 代码；在 Electron 实现获得阶段授权并通过迁移门禁前，它们仍接受现有质量检查，但不代表目标生产架构已经实现。产品负责人已单独授权且仅授权 F0-A1 Rust Runtime Bootstrap；该切片已实现并通过独立 Critical 实现审查，当前等待产品负责人明确验收，尚未 owner-accepted。

允许：

- 删除并重写现有前端
- 删除并重写现有 Backend
- 按直接目标移除旧生产壳
- 重做数据模型和通信协议，但必须先获得对应合同变更批准

要求：

- 新设计先进入 SSoT 和 Spec
- 不为旧演示数据增加兼容层
- 三个平台必须以真实安装包验收
- 主题、语言和平台差异不能侵入业务组件
- Shell 迁移不能改变 Runtime API、持久化字段或 save meaning

## 当前真源

1. [01-product.md](01-product.md)
2. [08-design-language.md](08-design-language.md)
3. [ssot/design-system.md](ssot/design-system.md)
4. [ssot/i18n.md](ssot/i18n.md)
5. [ssot/platform-adaptation.md](ssot/platform-adaptation.md)
6. [specs/m6-product-rebuild.md](specs/m6-product-rebuild.md)
7. [specs/m6-domain-model.md](specs/m6-domain-model.md)
8. [specs/m6-orchestration-interaction.md](specs/m6-orchestration-interaction.md)
9. [specs/m6-run-operations.md](specs/m6-run-operations.md)
10. [specs/m6-architecture.md](specs/m6-architecture.md)
11. [specs/m6-electron-shell.md](specs/m6-electron-shell.md)
12. [specs/m6-agent-session-collaboration.md](specs/m6-agent-session-collaboration.md)
13. [specs/m6-execution-workspace-security.md](specs/m6-execution-workspace-security.md)
14. [specs/workspace-output-inspection.md](specs/workspace-output-inspection.md)
15. [specs/m6-runner-adapter.md](specs/m6-runner-adapter.md)
16. [specs/m6-events-commands.md](specs/m6-events-commands.md)
17. [specs/m6-platform-packaging.md](specs/m6-platform-packaging.md)
18. [specs/m6-local-runtime-scheduling.md](specs/m6-local-runtime-scheduling.md)
19. [specs/m6-interaction-implementation-slices.md](specs/m6-interaction-implementation-slices.md)
20. [specs/f1-shell-design-system.md](specs/f1-shell-design-system.md)
21. [12-dev-plan.md](12-dev-plan.md)

`03`、`06`、`09`、`10`、`11`、`13`和M1-M5 Specs只保留历史参考。[M6 Electron Shell Architecture Critical Review](specs/reviews/M6-electron-shell-architecture-review-2026-08-21.md)已**ACCEPT**，是当前Shell/security/transport/ownership唯一Critical ACCEPT，但仅接受文档架构；该 review 本身不授权任何实现。产品负责人随后单独授权且仅授权 F0-A1；其 Rust Runtime Bootstrap 已通过[独立 Critical 实现审查](specs/reviews/F0-A1-runtime-implementation-review-2026-08-21.md)，当前等待产品负责人明确验收，尚未 owner-accepted。Electron代码、package与三平台证据仍不存在，F0-A2、F0-A3、F1和全部产品实现继续暂停，并且只有 owner 验收后再次明确授权才能启动。旧M6 interaction final review仍仅证明未变化Domain/save/interaction合同。
