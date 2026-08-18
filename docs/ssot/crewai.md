# SSoT · CrewAI（AI 编排框架）

**状态**：M0–M5 历史选型，D019 后不再硬锁  
**说明**：M6 可以保留、替换或移除 CrewAI；必须以灵活编排、Runner 可替换和跨平台交付证据重新判断。  
**范围**：`services/runtime` 内多角色协作语义  
**非范围**：Living Org Canvas UI、Org tree 写路径、Runner 协议本身  

---

## 1. 锁定结论

| 项 | 值 |
|----|-----|
| **AI 框架** | **CrewAI**（Python 包 `crewai`） |
| 产品门面 | Living Org Canvas（**不是** CrewAI 自带 UI） |
| 编制 SSoT | Org tree（`tree.json` + `edges[]`） |
| CrewAI 角色 | **只读投影** + 任务协作执行引擎 |
| 编码执行 | Runner（默认 `pi`）；CrewAI 不替代 Runner |

一句话：

```text
Org tree (SSoT) → CrewAI projection (Agent/Task/Crew) → RunnerJob (pi/mock)
```

---

## 2. 为何是 CrewAI

- 成熟的多角色 `Agent` / `Task` / `Crew` 语义  
- sequential / hierarchical 协作与 Ensemble「分工 + handoff」叙事对齐  
- 可观测任务边界，便于映射到 `seat.status` / `edge.packet` / artifacts  
- **不**用它做：组织图 UI、workspace 隔离、多 CLI 桌面壳  

禁止：用 LangGraph / AutoGen / 自研伪 Crew 替换本锁定，除非新决策条目显式改 D002。

---

## 3. 模块边界

```text
services/runtime/
  pyproject.toml              # 依赖含 crewai
  ensemble_runtime/
    org/                      # tree 读写（SSoT）
    run/                      # stage / store / events
    crew/                     # ★ CrewAI 投影
      __init__.py
      project.py              # project_org_to_crew
      modes.py                # mock | live | off
    # Runner 适配在仓库根 runners/；此处仅 dispatch 导入
```

### 投影规则

1. 只投影 **本 Run 相关** 且未停用的子树  
2. `parent seat` ≠ 自动 `manager`，除非 role/template 标记  
3. 工具权限默认继承模板，可收紧  
4. 深树按 stage **切片**投影，避免一次全树 Agent  
5. **任何** Crew/Task 输出 **不得** 直接写 `tree.json`；编制变更只走 staffing 命令路径  

### 模式

| `ENSEMBLE_CREWAI_MODE` | 行为 |
|------------------------|------|
| `off` | 不实例化 Crew；单 agent stage loop（M3 默认可用） |
| `mock` | 投影结构完整，kickoff 用 mock LLM/tool（CI / 无 key） |
| `live` | 真实 CrewAI + 配置的 LLM；Engineer 等仍可走 pi Runner |

---

## 4. 与里程碑

| 里程碑 | CrewAI 要求 |
|--------|-------------|
| M1–M2 | 文档 + 依赖声明即可；UI 不碰 CrewAI |
| **M3** | `crewai` 在依赖中；`project_org_to_crew` 可 import；单 seat 可 `off`/`mock` |
| **M4** | four_crew **必须**经 Crew 投影；可证明非手写假循环 |
| M5+ | hierarchical / 深树切片优化 |

---

## 5. 验收探针（实现期）

```bash
# 依赖存在
cd services/runtime && python -c "import crewai; print(crewai.__version__)"

# 投影可调用且不写 tree
python -c "from ensemble_runtime.crew import project_org_to_crew; ..."
```

审计关键词：依赖、只读投影、Runner 边界、four_crew 真 Crew。

---

## 6. 交叉引用

- 架构：`docs/03-architecture.md`  
- 技术栈：`docs/09-tech-and-desktop.md`（T009）  
- 计划：`docs/12-dev-plan.md`  
- 决策：D002 / D002a / D017  
- Spec：`docs/specs/m3-runtime-single-agent.md` · `m4-tauri-pi.md`  
