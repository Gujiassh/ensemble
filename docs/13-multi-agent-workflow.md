# 多 Agent / 多工作区并行开发与审计规程

**状态**：现行（2026-08-18）  
**产品**：Ensemble  
**原则**：每个开发切片必须配对审计；项目骨架稳固后才允许多 agent 多工作区并行。

---

## 1. 角色

| 角色 | 职责 | 工具边界 |
|------|------|----------|
| **Main Controller** | 拆任务、定文件所有权、合并、最终验收、开/关并行 | 全权 |
| **Dev Agent** | 在指定 worktree/目录实现任务 | 只改分配路径 |
| **Audit Agent** | 只读审查：目标对齐、边界、契约、测试、规范 | **read-only**；不直接改业务码 |
| **Fix Agent** | 按审计 findings 返工（优先 **resume 原 Dev**） | 原 Dev 路径 |

---

## 2. 强制配对：开发 ↔ 审计

**每个阶段 / 每个并行 lane 结束时，必须有一次 Audit。**

```text
Dev 完成切片
  → Audit（独立 subagent，read-only）
  → 结论 ACCEPT | ACCEPT_WITH_FIXES | REJECT
  → ACCEPT_WITH_FIXES / REJECT → 原 Dev 返工 → 再 Audit
  → ACCEPT → Main 合并 / 勾里程碑
```

| 阶段 | Dev 产出 | Audit 必查 |
|------|----------|------------|
| **M1** | `apps/canvas` mock | 设计语言 08、类型、lint、无直连 CLI、验收可视 A/B/C 子集 |
| **M2** | runtime HTTP+SSE + canvas 接线 | 事件 10、命令 11、workspace 隔离 |
| **M3** | tree 持久化 + 单 agent run + mock runner | org SSoT、契约失败、roster 挂载、验收 A |
| **M4** | Tauri + pi | 壳边界、Runner 协议、不泄漏密钥、验收 B |

审计报告最低结构：

```text
### 严重 / 中等 / 轻微
### 覆盖检查表 pass|partial|fail
### 结论 ACCEPT | ACCEPT_WITH_FIXES | REJECT
### 优先修复 ≤5 条
```

审计结论写入：`docs/specs/reviews/M{n}-{lane}-{date}.md`（可简写到当日 memory + specs 进度表）。

---

## 3. 何时允许「多 agent × 多工作区」并行

### 3.1 门禁（全部满足才开并行）

| # | 门禁 | 说明 |
|---|------|------|
| G1 | **完整 M1 Audit ACCEPT** | 含 M1 验收 A1–A9、`reviews/M1-canvas-*.md` 存在；**不是**仅 build 通过 |
| G2 | **协议单一真源** | **仅** `packages/protocol`（T011）；禁止 `apps/canvas/src/protocol` 作第二真源 |
| G3 | **目录所有权表已写** | 见 §4（含根配置）；无重叠写路径 |
| G4 | **Main 开闸制品落盘** | 必须有 `docs/specs/reviews/gate-parallel-M{n}-YYYY-MM-DD.md` |

**M1 本体默认单 lane**（画布耦合高）。  
**并行最早窗口：M1 ACCEPT 之后**，典型是：

- Lane A：`services/runtime`（M2/M3 后端）  
- Lane B：`apps/canvas` 接线（事件客户端、Workspace UI）  
- Lane C（可选）：`runners/mock` 先行  

M4 壳与 pi 建议 **串行或严格隔离**（`src-tauri` + `runners/pi`），避免与 runtime 抢启动协议。

### 3.2 并行时工作区规则

| 规则 | 要求 |
|------|------|
| 一 lane 一 worktree | 推荐 git worktree：`ensemble-m2-runtime` / `ensemble-m2-canvas` |
| 文件所有权不重叠 | 见 §4；冲突文件只归 Main 或单 lane |
| 共享契约只增不改语义 | `packages/protocol` 变更要 Main 审；禁止并行双方改同一事件字段含义 |
| 合并权在 Main | Dev 不互相 merge |
| 每 lane 自带 Audit | 不是「全部做完再审一次」 |

### 3.3 推荐并行矩阵（M1 通过后）

```text
时间 →
M1 [Canvas Dev] ──[Audit]── ACCEPT
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         Runtime Dev     Canvas Wire      (可选) Runner mock
         (M2/M3 API)     (SSE/命令)         协议实现
              │               │               │
           [Audit]         [Audit]         [Audit]
              └───────────────┴───────────────┘
                              ▼
                         Main 集成 + 总审计
                              ▼
                         M4 Tauri+pi（偏串行）
```

---

## 4. 文件所有权（防互踩）

| 路径 | 主责阶段 | 并行时归属 |
|------|----------|------------|
| `apps/canvas/**` | M1–M2 UI | Canvas lane |
| `packages/protocol/**` | M1 起 | **Main 或单 lane**；另一 lane 只读 |
| `services/runtime/**` | M2–M3 | Runtime lane |
| `runners/mock/**` | M3 | **仅 Runtime lane**（取消第三 lane 写权；可选 Runner 并入 Runtime） |
| `runners/pi/**` | M4 | M4 lane（串行） |
| `src-tauri/**` | M4 | M4 lane only |
| `docs/specs/*.md`（spec 正文） | 全程 | **Main only** |
| `docs/specs/reviews/**` | 全程 | Audit/Main 可写 |
| `docs/specs/fixtures/**` | M2+ | **Main only**（集成任务） |
| `scripts/**`、根 `package.json`、`pnpm-workspace.yaml` | 全程 | **Main only** |
| `data/**` 样例 | M2+ | Main 或 Runtime（开闸表写死） |
| `roles/**` | M3–M4 | Runtime lane |

---

## 5. 每阶段 Definition of Ready / Done

### Ready（Dev 可开工）

- [ ] 对应 `docs/specs/mN-*.md` 存在且未 REJECT  
- [ ] 依赖阶段已 ACCEPT（或 Main 书面允许提前）  
- [ ] 所有权路径明确  
- [ ] 验收条目可勾选  

### Done（可提审计）

- [ ] 任务列表全部完成或显式 deferred  
- [ ] 本地命令可跑（build / 指定 test）  
- [ ] 无已知严重越界（直连 CLI、改合同字段未批）  
- [ ] 进度写入 `docs/specs/mN-*.md` 的 Progress 段  

### 阶段关闭（Main）

- [ ] Audit ACCEPT  
- [ ] 验收脚本对应项通过  
- [ ] decisions / 12-dev-plan 进度更新  

---

## 6. 审计清单（通用）

1. **目标**：是否仍服务该里程碑，无范围漂移  
2. **设计语言**：是否仍是 Org Canvas（非聊天窗/旧三栏）  
3. **边界**：UI / Runtime / Runner / Shell 是否串层  
4. **契约**：事件/命令/tree 是否与 10/11/09 一致  
5. **规范**：lint、命名、文件体量、无秘密提交  
6. **验证**：是否有可复现命令与结果  
7. **长远**：有无临时兼容层、假数据泄漏进生产路径  

---

## 7. Main Controller 操作备忘

```text
开并行前:
  1. 确认 G1–G4
  2. 写 lanes 表（agent 用途、路径、禁止路径）
  3. 建 worktree（如需）
  4. spawn Dev agents（非重叠）
  5. 各 Dev 完成后 spawn Audit（read-only）
  6. 失败 → resume 原 Dev
  7. 全 ACCEPT → 集成分支 → 总审计 → 勾里程碑
```

---

## 7b. 开闸制品模板（G4 强制）

路径：`docs/specs/reviews/gate-parallel-M{n}-YYYY-MM-DD.md`

```markdown
# Parallel Gate M{n}
- date:
- main_controller:
- G1 evidence: (M1 review path + ACCEPT)
- G2 protocol path: packages/protocol only (FAIL if apps/canvas/src/protocol exists as SSoT)
- lanes:
  - name: runtime
    worktree:
    write_globs: [services/runtime/**]
    deny_globs: [apps/canvas/**, src-tauri/**, packages/protocol/**]
    audit_required: yes
  - name: canvas-wire
    worktree:
    write_globs: [apps/canvas/**]
    deny_globs: [services/runtime/**, src-tauri/**]
    audit_required: yes
- integration_audit_required: yes
```

无此文件 = **未开闸**，禁止 spawn 并行 Dev。

## 7c. 审计落盘（强制）

- 每 lane Done：`docs/specs/reviews/M{n}-{lane}-YYYY-MM-DD.md`
- 禁止仅写 memory 作为唯一审计记录
- M2 合并后：`M2-integration-*.md` **强制**

## 8. 与用户要求的对齐

| 用户要求 | 落点 |
|----------|------|
| 开发计划 / spec / task 落文档 | `docs/specs/m1`–`m4` |
| 多 subagent 审计 | 每阶段 + 并行每 lane |
| 有问题就修 | Audit → 原 Dev 返工 |
| 搭建完成后多 agent 多工作区并行 | §3 门禁 + §3.3 矩阵 |
| 每阶段配审计 agent | §2 强制配对 |
