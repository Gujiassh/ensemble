# M3 Spec — Org Persist + Single-Agent Run

**状态**：Historical ACCEPT；D019 后不再作为 V2 验收  
**阶段**：M3  
**主责**：`services/runtime/**`、`runners/mock/**`、`roles/**`  
**Canvas**：仅最小接线（显示真 artifacts）；大改 UI 需申报  
**依赖**：M2 事件/命令通道可用  
**审计**：Dev 完成后强制 Audit  
**真源**：[03](../03-architecture.md) · [05](../05-roles-staffing.md) · [09](../09-tech-and-desktop.md) · [10](../10-events-schema.md) · [11](../11-ui-commands.md)

---

## 1. Goal

- Org **持久化**（`tree.json` + `edges[]`）  
- **单 agent** stage 真 Run：落盘 artifacts、timeline、state  
- **MockRunner** 实现 Runner 协议  
- **契约检查**：缺产物 = 失败  
- **Rework**：打回后 v2 产物  
- roster 挂载字段可用（为 L1 staffing 铺路）

## 2. Non-goals

- PiRunner（M4）  
- 完整 CrewAI 四人真 LLM 智能（可用顺序 mock + 空跑投影）  
- Tauri  
- L3 自由生成角色  

## 2b. CrewAI 硬约束（M3 必须落地骨架）

| 项 | 要求 |
|----|------|
| 依赖 | `services/runtime/pyproject.toml` **必须**声明 `crewai` |
| 模块 | `ensemble_runtime/crew/` 存在：`project_org_to_crew`（Org 子树 → Agent/Task/Crew 描述或实例） |
| 单 agent | 可不 `crew.kickoff()`；但投影函数对 1-seat 树仍返回合法单 Agent 或 skip 标记 |
| 写路径 | **禁止** Crew/Agent 结果直接改 `tree.json` |
| 真跑 | M3 默认可 `ENSEMBLE_CREWAI_MODE=mock|off`；接口不得缺失 |
| 文档 | `docs/ssot/crewai.md` 与代码一致 |

## 3. Architecture

```text
run.start(template=single_agent)
  → stage machine: plan → implement → gate → done|rework
  → MockRunner(job) → artifacts/*
  → events: seat.status, artifact.written, bubble.upsert(approve)
  → bubble.act(approve|reject) → done | rework→implement
```

存储：

```text
data/workspaces/<ws>/
  workspace.json
  org/tree.json          # root+edges 见 09
  runs/<run_id>/
    state.json
    timeline.jsonl
    roster.json          # 单 seat 可 entries:[]；schema 须合法
    artifacts/
    sessions/            # M4 pi 用；M3 可空目录
```

Artifact 读取：`GET /workspaces/{ws}/runs/{run}/artifacts/{name}`（或 file 路径在 state 索引中）。

## 4. Functional requirements

| ID | 需求 | 优先级 |
|----|------|--------|
| M3-F01 | 启动时加载/保存 org tree | P0 |
| M3-F02 | single_agent 编制仅 1 seat | P0 |
| M3-F03 | stage 状态机 + run.stage 事件 | P0 |
| M3-F04 | MockRunner 写出至少 1 个 artifact 文件 | P0 |
| M3-F05 | 契约失败路径可测（故意缺文件） | P0 |
| M3-F06 | approve 完成 run；reject → rework 新版本 artifact | P0 |
| M3-F07 | timeline.jsonl 追加 | P0 |
| M3-F08 | roster.json 支持 parent_id 条目 | P0 |
| M3-F09 | human.inject 写入并影响下一轮 mock prompt（验收 A4） | **P0** |
| M3-F10 | L1 staffing.proposed 事件（QA）可选 | P1 |

## 5. Runner 协议（实现）

```text
RunnerJob:
  workspace_id, run_id, stage, seat_id, role_template,
  workspace_path, prompt, inputs[], expected_artifacts[],
  timeout_s, runner
RunnerResult:
  ok, summary, artifacts[], logs_path, provider, exit_code
```

MockRunner：`provider=mock`，在 `workspace_path` 下写入 expected 路径。

### single_agent 契约表（钉死）

| stage | expected_artifacts（相对 run artifacts/） | 成功事件 | 失败 |
|-------|------------------------------------------|----------|------|
| plan | `01-plan.md` | artifact.written v1；seat done→下一 stage | 缺文件 → stage failed + seat error |
| implement | `02-output.md`（或 `.diff`） | artifact.written；进入 gate | 同上 |
| gate | （无 runner） | bubble.upsert approve；run.stage waiting_human | — |
| rework | 同 implement，**version+1**（path 可 `02-output.v2.md` 或 artifact.written.version） | 再进 gate | 同上 |

`bubble.act(approve)` → run done；`reject` → stage=implement rework，version++。

## 6. Tasks

- [x] T1 持久化读写 tree/edges  
- [x] T2 Run store 目录布局  
- [x] T3 Stage machine single_agent  
- [x] T4 runners/mock 包  
- [x] T5 契约校验器  
- [x] T6 rework 版本号  
- [x] T7 测试：happy path + 缺产物 + reject rework  
- [x] T8 Canvas：Outputs 读真实 artifact 文本（最小）  
- [x] T9 文档：如何用 curl 跑一轮 single agent  
- [x] **T10 CrewAI 依赖 + `ensemble_runtime/crew` 投影骨架**（可 mock kickoff）  
- [x] **T11 单测：1-seat org → 投影结果合法且不写 tree**  

## 7. Acceptance（产品脚本 A）

| # | 标准 |
|---|------|
| A1 | 新建/使用 1 seat workspace |
| A2 | run.start 后状态变化 + 落盘 artifacts |
| A3 | Dossier 可见输出内容 |
| A4 | Prompt inject（F09 P0）：timeline 或 human.inject 事件可追踪 |
| A5 | reject 后出现 v2 |
| A6 | 自动化测试覆盖契约失败 |
| A7 | 无 pi 依赖即可跑通 |
| A8 | `crewai` 在 runtime 依赖中；`project_org_to_crew` 可 import |
| A9 | 投影不修改 `tree.json`（测试断言） |

## 8. Audit focus

- 报告：`docs/specs/reviews/M3-runtime-YYYY-MM-DD.md`（强制）
- Org tree 是否 SSoT；**CrewAI 投影是否只读**；依赖是否声明 `crewai`  
- Runner 是否经协议，业务层无直接写死路径散落  
- 验收 A 证据（命令+路径）  

## 9. Progress

| 日期 | 状态 | 备注 |
|------|------|------|
| 2026-08-18 | Spec Ready | |
| 2026-08-18 | Spec fix | 审计 B：inject P0、契约表、RunnerJob 对齐 |
| 2026-08-18 | Dev started | MockRunner scaffold; after M2 ACCEPT |
| 2026-08-18 | Dev complete | rework/inject/artifacts/curl + canvas Outputs |
| 2026-08-18 | Audit ACCEPT | M3-runtime-2026-08-18.md；HTTP rework loop 已修 |
