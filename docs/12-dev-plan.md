# Ensemble V2 Development Plan

**状态**：当前执行计划（2026-08-18）
**产品目标**：优雅、简约的桌面界面，以及灵活、可干预的 Agent 编排
**原则**：先完成契约和架构，再写业务代码；每个阶段都以可验证交付物关闭

## 1. 最终产品路径

```text
创建 Workspace
  -> 配置组织与 Workflow
  -> 创建 Run Snapshot
  -> 驱动 Runner 执行
  -> 观察状态 / Handoff / Artifact
  -> 处理 Attention
  -> 完成、重试、打回或恢复
```

单 Agent 和多 Agent 都是正式路径。Runner、主题、语言和平台能力属于配置或适配边界，不得散落到业务组件中。

## 2. 阶段路线

### F0 · 文档与架构基线（当前）

交付：

- [x] 产品、设计语言、领域模型、编排交互和运行操作规格
- [x] 架构边界与数据所有权：[m6-architecture.md](specs/m6-architecture.md)
- [x] Runner Adapter：[m6-runner-adapter.md](specs/m6-runner-adapter.md)
- [x] Event / Command：[m6-events-commands.md](specs/m6-events-commands.md)
- [x] 跨平台打包 Spike 规格：[m6-platform-packaging.md](specs/m6-platform-packaging.md)
- [x] 本开发计划与旧 M0–M5 文档归档入口
- [ ] 完成 Backend 进程形态 Spike

关闭条件：

- 进程形态、通信方式、数据目录和 Runner 分发有书面决策
- Domain、Command、Event、Runner 四份契约通过一致性审查
- 不再有活跃文档把 M0–M5 原型当作 V2 实现入口

### F1 · Desktop Shell 与 Design System

交付：

- Tauri 桌面入口和 Runtime 生命周期
- 画布优先布局：窄导航、全尺寸画布、按需 Inspector
- Theme、Density、Motion、Contrast 和 Locale 注入
- Workspace 创建：名称、项目目录、Runner、Agent 输出语言
- 无 Workspace 时的首次启动路径

关闭条件：

- 不依赖开发服务器即可启动桌面壳
- 浅色、深色、系统主题和两种首发语言可切换
- Workspace 配置与设备偏好分开保存
- 失败启动、退出和重启行为可验证

### F2 · Workspace 与 Orchestration Editor

交付：

- Role、Seat、Group、Task、Transition、Gate、Join 编辑
- 单 Agent、并行、`all/any` 和有限 Rework
- Workflow 校验、Draft 自动保存、冲突提示
- 画布布局移动与层级变更分离
- 编排模板保存、复制和复用

关闭条件：

- 用户可从空 Workspace 创建单 Agent 编排
- 用户可创建多 Agent 编排并看到明确的依赖与交付关系
- 保存、重载、冲突和校验结果不会改变业务语义
- 编辑器不写入 Run Snapshot 或 Runtime State

### F3 · Runtime、Runner 与 Run Operations

交付：

- Run Snapshot 创建与冻结
- Runtime 调度、事件日志、快照和恢复
- Mock Adapter 和 `pi` Adapter
- Task / Seat / Run 状态机
- Handoff、Attention、Artifact 生命周期
- Pause、Cancel、Retry、Rework、Inject 和 Recovery

关闭条件：

- 单 Agent 能完成一次真实 Run 并产生 Artifact
- 多 Agent 能按依赖执行并产生 Handoff
- 用户可审批、打回、追加指令和重试
- 断线、重复命令和 Runtime 重启不会破坏 Run 账本
- Client 不依赖 Runner 私有日志或前端定时器制造业务状态

### F4 · 三平台交付

交付：

- Windows、macOS、Linux 安装包
- 安装包内置或可靠连接 Backend execution unit
- Runner 探测、平台目录、日志和进程清理
- 首次启动、真实 Run、重启恢复和卸载验证

关闭条件：

- [m6-platform-packaging.md](specs/m6-platform-packaging.md) 验收矩阵三平台均有证据
- 用户不需要安装 Python、Node 或其它开发环境
- 应用退出后没有残留 Runtime/Runner 进程

### F5 · 质量与发布

交付：

- 关键 Domain、Protocol、Runner、Persistence 单测
- 三平台桌面冒烟和关键流程 E2E
- 主题、语言、高 DPI、减少动态和键盘流程验证
- 日志、诊断、错误恢复和数据备份说明
- 开源贡献、安装和用户文档

关闭条件：

- 关键用户路径有自动化和真实平台证据
- 没有未审查的跨层兼容代码或隐藏旧协议
- 发行包、数据路径和恢复行为可复现

## 3. 执行顺序

```text
F0 文档/架构
  -> Backend/打包 Spike
  -> F1 Shell/Design System
  -> F2 编排编辑器
  -> F3 Runtime/Runner
  -> F4 三平台交付
  -> F5 质量与发布
```

F1 与 F2 可以在契约关闭后拆分，但协议和核心数据模型只能由一个主责切片维护。F3 必须在 F2 的 Workflow 校验和 Snapshot 规则稳定后进入。F4 不能用浏览器预览替代。

## 4. 每个阶段的交付规则

每个阶段都必须有：

1. 目标与文件所有权。
2. 可运行或可检查的交付物。
3. 单元测试、协议检查或平台证据。
4. 独立审查和修复记录。
5. SSoT、Spec、Decision 和 Workbench 状态更新。

阶段审查顺序：目标对齐 → 用户路径 → 架构边界 → 数据契约 → 测试与运行证据 → 下一阶段门禁。

## 5. 非目标

- 旧演示 UI、API 和数据迁移
- 生产 Web 版、移动端、账户和多人云协作
- 任意自由表达式流程引擎
- Runner 插件市场
- 以聊天窗口替代组织画布
- 在未完成桌面交付前继续堆叠浏览器 Demo 功能

## 6. 当前下一步

先完成 [m6-platform-packaging.md](specs/m6-platform-packaging.md) 定义的 Backend 进程形态 Spike，并把结论写回 [m6-architecture.md](specs/m6-architecture.md)、Runner Adapter 和平台 SSoT。Spike 关闭后，才开始 F1 的新桌面壳和 Design System 实现。
