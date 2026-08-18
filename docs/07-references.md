# 参考与竞品（历史参考）

> 本文用于记录早期竞品研究，不是当前产品术语或架构约束。当前设计语言见 [08-design-language.md](08-design-language.md)，当前架构见 [specs/m6-architecture.md](specs/m6-architecture.md)。

## 定位空白

市面常见能力碎片化：

1. 角色剧本（Crew）  
2. 状态 / 交付物可视化  
3. 可插拔 coding CLI  

Ensemble 叠加为：

> 画布工作台（组织/OA/人工介入）× Handoff × Runner 可插拔 × 可复用编排

## 角色 / 虚拟软件公司

| 参考 | 可学 | 我们不照抄 |
|------|------|------------|
| ChatDev | 角色、阶段、回放 | 主界面不做对话瀑布 |
| MetaGPT | SOP、中间产物 | 不只 CLI 出仓库 |
| Atoms / MGX | AI 员工叙事 | 要真 org 树与 runner |
| CrewAI | 协作语义 | Crew ≠ 产品门面 |

## 工程控制台

| 参考 | 可学 | 我们不照抄 |
|------|------|------------|
| Devin Desktop | 舰队状态、人审 | 不主打云舰队 Kanban |
| Melty Conductor | 多 CLI、worktree、diff | 补角色剧本与套娃 |
| OpenHands Canvas | 控制面、多 backend | 头像组织语言更强 |
| Vibe Kanban | agent+workspace+diff | Org Canvas 优先于看板 |
| MS Conductor | DAG、HITL | 避免调试器气质 |
| LangGraph Studio | 步进、time-travel | 仅 Debug 吸收 |

## 执行 CLI

| 参考 | 可学 |
|------|------|
| **pi**（默认） | `-p`、json/rpc、tools、session |
| Claude Code / Codex / OpenCode | 后续 adapter |
| Aider | git 友好轻量参考 |

## 交互心智（设计语言）

| 参考 | 拿走 |
|------|------|
| 组织架构图 | 席位、层级、套娃 |
| OA / 审批 | 冒泡 approve |
| IM 气泡 | 节点旁短消息（克制） |
| PR checks / CI | 门禁与阶段灯（非主布局） |
| 游戏队伍面板 | 在场感（克制） |

## 对标话术（内部 · 现行）

> 有角色剧本的 Conductor，有可操作画布的 Agent 工作台，有可插拔 Runner —— 品牌是 Ensemble。

（旧句「stageboard / 交付物墙」已退役。）  
