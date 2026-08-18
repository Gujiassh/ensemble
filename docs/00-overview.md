# Ensemble 总览

**状态**：V2 产品重建基线（2026-08-18）

## 产品定位

Ensemble 是一款跨平台、本地优先的 Agent 编排桌面应用。

用户通过组织画布完成：

- 创建 Workspace 并选择默认 Runner
- 定义 Role、Seat、Group、Task、Transition 和 Handoff
- 配置输入输出、交付约束和人工门禁
- 启动单 Agent 或多 Agent Run
- 观察状态、处理 Attention、查看 Artifact
- 保存和复用编排模板

## 核心体验

- 画布优先，不做固定三栏后台
- 左侧只有全局导航
- 检查器按需出现
- Seat 去卡片化
- Handoff 使用短暂方向脉冲
- 浅色优先，主题可变
- 多语言和跨平台从架构层支持
- 正式界面不出现 Fixture、LOD 和 Mock 等开发控件

## 产品边界

首版包含：

- Windows、macOS、Linux 桌面端
- 本地 Workspace 和 Run
- 可替换 Runner
- 单 Agent、多 Agent 和嵌套组织
- Theme、Density、Motion 和 Locale 设置

首版不包含：

- 移动端
- 生产 Web 版
- 账户与云同步
- 企业多租户
- Runner 插件市场

## 当前代码定位

M0–M5 原型验证过部分功能概念，但其前端、Backend、协议和持久化都不是 V2 兼容约束。

允许：

- 删除并重写现有前端
- 删除并重写现有 Backend
- 重新选择技术方案
- 重做数据模型和通信协议

要求：

- 新设计先进入 SSoT 和 Spec
- 不为旧演示数据增加兼容层
- 三个平台必须以真实安装包验收
- 主题、语言和平台差异不能侵入业务组件

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
11. [specs/m6-runner-adapter.md](specs/m6-runner-adapter.md)
12. [specs/m6-events-commands.md](specs/m6-events-commands.md)
13. [specs/m6-platform-packaging.md](specs/m6-platform-packaging.md)
14. [12-dev-plan.md](12-dev-plan.md)

`03`、`06`、`09`、`10`、`11` 和 M1–M5 Specs 只保留为历史参考；V2 实施以以上产品、架构、协议、平台和开发计划为准。
