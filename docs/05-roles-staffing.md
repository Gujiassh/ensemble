# 角色契约与自动扩编（Staffing）

**配合**：[08-design-language](08-design-language.md) · [specs/m6-architecture](specs/m6-architecture.md) · [specs/m6-events-commands](specs/m6-events-commands.md)

## 角色 = 三件套（不是换皮 prompt）

每个 **role template**（catalog）与落画布的 **Seat** 都必须可映射到：

1. **职责** — 唯一清晰目标  
2. **工具集** — 允许的 tools / runner  
3. **输出契约** — 必须落盘的 artifact  

## 基础编制

### 单 agent（一等公民）

- 合法：根下仅 **一个 Seat**  
- 不强制四人模板  
- 编排：单节点 stage 循环  
- UI：居中单头像，冒泡 / Dossier / 产物完整  

### 基础四人模板（推荐，非强制）

| 模板 | 职责 | 工具倾向 | 必交 |
|------|------|----------|------|
| **PM** | 澄清目标、拆验收 | 轻量 LLM | `01-brief.md` |
| **Researcher** | 查资料 / 读仓库 | 只读 + 有限 bash | `02-research.md` |
| **Engineer** | 实现与验证 | **默认 pi** | patch / summary + 测试日志 |
| **Reviewer** | 对照验收 | 只读 artifacts | `04-review.md` |

可选 Orchestrator（只调度）。模板可缩减；Seat 下可再挂子 Seat（套娃）。

## 分工强度保障

- 每 Task 单一 owner seat  
- 下家优先吃上家 **artifacts**，不吃全量闲聊  
- 阶段结束契约检查（文件存在 + 最小结构）  
- 打回携带 `review.md` 或 bubble comment  
- Reviewer 不写业务代码；PM 不直接改仓库  

## 自动扩编（Staffing）

### 目标体验

任务变复杂时，建议或自动加入 QA / Security / Docs / Data 等；  
**新头像在画布入场**，连到指定 **parent / group**，可冒泡自我介绍，并写 roster 账本。

### 三档策略

| 档 | 行为 | MVP |
|----|------|-----|
| **L1 推荐** | 只建议，人确认后入场 | ✅ |
| **L2 条件自动** | 命中规则自动插入，可撤销 | ✅ 可开 |
| **L3 自由生成** | LLM 现场造角色 | ❌ 后置 |

### 角色目录（示例）

```yaml
# roles/catalog.yaml（目标）
roles:
  - id: qa
    display_name: QA
    when: ["has_tests", "bugfix", "regression"]
    tools: [read, bash]
    output: qa-report.md
  - id: security
    display_name: Security
    when: ["auth", "secrets", "dependency"]
    tools: [read, bash]
    output: security-notes.md
  - id: docs
    display_name: Docs
    when: ["public_api", "readme_gap"]
    tools: [read, write]
    output: docs-update.md
  - id: data
    display_name: Data
    when: ["schema", "migration", "sql"]
    tools: [read, bash]
    output: data-plan.md
```

### 扩编流程

```text
任务 / brief → Analyzer
  → StaffingProposal{ role_template, parent_id?, group_ids?, reason, source }
  → L1 确认 / L2 自动
  → tree upsert → roster append
  → events: org.node.upsert + staffing.applied (+ 可选 bubble)
  → 绑定 tools + 输出契约
```

**禁止**只写扁平 id、无挂载点的扩编。

### 防崩规则

- 单次 Run 额外 seat 默认最多 2～3  
- 无输出契约不准入场  
- 职责重叠过高 → 合并  
- roster 必记 who/why/when/source/parent  
- 禁止无信号热闹扩编  

## 编制真相源

| 层 | 路径 | 职责 |
|----|------|------|
| **Org tree** | `workspaces/<ws>/org/tree.json` | **编制 SSoT**（无限层级） |
| **Roster** | `workspaces/<ws>/runs/<run>/roster.json` | **本 Run 变更账本** |
| **Crew** | 运行时内存投影 | **只读**；禁止反向定义组织 |

写路径：

```text
validate mount → tree upsert → roster append → emit events
```

### Roster 条目

```json
{
  "run_id": "run_xxx",
  "workspace_id": "ws_xxx",
  "entries": [
    {
      "seat_id": "seat_qa",
      "kind": "seat",
      "role_template": "qa",
      "parent_id": "seat_eng",
      "group_ids": ["group_eng"],
      "reason": "bugfix signal",
      "source": "rule",
      "status": "active",
      "at": "2026-08-18T00:00:00Z"
    }
  ]
}
```

## 与 OpenClaw

Ensemble 是 **Workspace 内组织画布**，不强制 Discord 多 bot。  
未来可映射 catalog role → seat/claw；MVP 不依赖。  
