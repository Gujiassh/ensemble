# Ensemble

**Orchestrate agents with clarity and control.**

Ensemble 是一款跨平台、本地优先的 Agent 编排桌面应用。用户创建 Workspace 时选择适合项目的 Runner，通过组织画布定义角色、任务依赖、交付和人机门禁，并在运行过程中观察、审批、打回、补充指令或重试。

## 当前状态

- **产品目标**：V2 已确认
- **设计语言**：V2 已确认，待全量重做
- **实现状态**：M0–M5 原型仅作功能参考，不是新产品基线
- **兼容要求**：不兼容旧演示 UI、API 和数据
- **当前阶段**：M6 架构与产品重建

现有 `apps/canvas`、`services/runtime` 和 `src-tauri` 可以删除或替换。任何新实现都以 M6 文档为准。

## 产品基线

- 单 Agent 和多 Agent 都是完整路径
- Workspace 创建时选择默认 Runner
- Runner 保持可替换
- 画布是主工作区
- Seat 去卡片化
- Handoff 使用短暂、有方向的脉冲
- 左侧窄导航，检查器按需出现
- 浅色优先，支持深色、系统和自定义主题协议
- `zh-CN`、`en-US` 首发，UI Locale 与 Agent 输出语言分离
- Windows、macOS、Linux 独立安装运行
- 用户不需要安装额外开发环境
- 首版本地优先，不做账户和云同步

## 文档真源

| 文档 | 内容 |
|------|------|
| [docs/01-product.md](docs/01-product.md) | 产品目标、用户和边界 |
| [docs/02-brand.md](docs/02-brand.md) | 品牌与用语 |
| [docs/08-design-language.md](docs/08-design-language.md) | 新设计语言与交互原则 |
| [docs/ssot/design-system.md](docs/ssot/design-system.md) | Theme、Token、Density、Motion |
| [docs/ssot/i18n.md](docs/ssot/i18n.md) | UI Locale 与 Agent 输出语言 |
| [docs/ssot/platform-adaptation.md](docs/ssot/platform-adaptation.md) | Windows、macOS、Linux 交付要求 |
| [docs/specs/m6-product-rebuild.md](docs/specs/m6-product-rebuild.md) | M6 重建范围和验收 |
| [docs/specs/m6-domain-model.md](docs/specs/m6-domain-model.md) | Organization、Workflow、Snapshot 和 RuntimeState 领域边界 |
| [docs/specs/m6-orchestration-interaction.md](docs/specs/m6-orchestration-interaction.md) | Workspace 创建、编排编辑、保存、校验和启动交互 |
| [docs/specs/m6-run-operations.md](docs/specs/m6-run-operations.md) | Run 状态机、人工介入、Artifact、事件对账和恢复 |
| [docs/decisions.md](docs/decisions.md) | 决策记录 |

旧的 M0–M5 技术、协议和实现文档保留为历史证据；若与上表冲突，以 V2/M6 文档为准。

## 原型运行

下面命令只用于查看旧原型，不代表新产品架构：

```bash
cd /home/cc/code1/ensemble
pnpm install
pnpm dev:canvas
```

浏览器地址：`http://127.0.0.1:17351`

## 下一步

1. 完成 M6 领域、交互和运行期规格确认
2. 评估跨平台 Backend 形态
3. 定义 Workspace、Orchestration、Run、Event 和 Runner Adapter 合约
4. 完成 Canvas 信息架构线框
5. 再进入前后端实现
