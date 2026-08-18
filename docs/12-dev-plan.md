# Ensemble 开发计划与技术栈

**状态**：M0–M5 历史计划，已被 M6 重建取代  
**当前入口**：[specs/m6-product-rebuild.md](specs/m6-product-rebuild.md)  
**说明**：以下内容只记录旧原型的开发过程，不再作为待办或技术约束。  

---

## 1. 一句话

做 **Living Org Canvas** 桌面应用：头像席位 + 管道传信 + 冒泡审批 + 档案插手；壳用 **Tauri 2（Rust）**，画布用 **React + xyflow**，**AI 编排框架用 CrewAI**，Runtime 用 **Python**，编码默认 **pi**。

---

## 2. 技术栈（已锁定）

```text
┌─────────────────────────────────────────────┐
│  Desktop Shell: Tauri 2 (Rust)              │
│  窗口 · 权限 · FS · 托盘 · 拉起子进程         │
└──────────────────┬──────────────────────────┘
                   │ IPC / 本地端口
┌──────────────────▼──────────────────────────┐
│  UI: React 18 + TypeScript + Vite           │
│  图: @xyflow/react                          │
│  动效: CSS + motion(packet) · 图标 lucide    │
│  样式: Tailwind v4 + CSS vars · store zustand │
│  产品面: Living Org Canvas                   │
└──────────────────┬──────────────────────────┘
                   │ HTTP + SSE
┌──────────────────▼──────────────────────────┐
│  Runtime: Python 3.11+                      │
│  stage / staffing / org tree / event bus    │
│  **AI 框架: CrewAI**（Agent/Task/Crew 投影）  │
│  CrewAI ≠ 产品门面；Org tree 仍是编制 SSoT    │
└──────────────────┬──────────────────────────┘
                   │ RunnerJob
┌──────────────────▼──────────────────────────┐
│  Runners: mock（先）· pi（默认真执行）· 可扩  │
└─────────────────────────────────────────────┘
```

| 层 | 技术 | 不做 |
|----|------|------|
| 壳 | **Tauri 2 + Rust** | Electron 默认；纯 Rust GUI 主界面 |
| 画布 | **React 18 + TS + Vite 6 + @xyflow/react** | Vue 主线 |
| 客户端状态 | **zustand** | Redux/Jotai 并行 |
| 样式/图标 | **Tailwind v4** + **lucide-react** | Emotion 默认 |
| 协议包 | **`packages/protocol`** | canvas 本地双源 |
| Runtime HTTP | **FastAPI** + SSE | 裸 Starlette / WS 默认 |
| 协议下行 | **SSE** + [10](10-events-schema.md) | UI 直读 CLI 私有日志 |
| 协议上行 | **HTTP/IPC 命令** + [11](11-ui-commands.md) | UI 直拼 pi 命令行 |
| **AI 框架** | **CrewAI**（锁定） | 用其它 agent 框架替换 CrewAI |
| 编排 | **Python** + stage/staffing + CrewAI 投影 | Crew 写回 org 树 |
| 执行 | **Runner 适配层**，默认 **pi** | 五家 CLI 一次做完 |
| 存储 | 文件 `data/` 或 `~/.ensemble`；**无 SQLite MVP** | 云端多租户；SQLite 抢跑 |

### 目标仓库布局

```text
ensemble/
  apps/canvas/           # React 画布（M1）
  src-tauri/             # Tauri 2 Rust 壳（M4）
  services/runtime/      # Python Runtime（M2–M3）+ CrewAI
  #   ensemble_runtime/crew/  # Org→CrewAI 投影
  runners/               # mock / pi adapters（M3–M4）
  roles/catalog.yaml     # 角色模板
  docs/                  # SSoT（已有）
  data/ 或 ~/.ensemble/  # 运行时数据（本地）
```

---

## 3. 当前进度

| 项 | 状态 |
|----|------|
| 产品 / 设计语言 / 决策 | ✅ 文档完成 |
| 技术选型锁定 | ✅ 见 [ssot/stack.md](ssot/stack.md)（T001–T021） |
| 事件 / 命令协议 | ✅ 10 + 11 |
| 业务代码 | ✅ M1–M5 ACCEPT；文档 MVP 线完成 |
| **下一刀** | **MVP 完成（M0–M5 ACCEPT）** |

---

## 4. 里程碑计划（M0–M5）

### M0 — 文档与协议 ✅

- 设计语言 Living Org Canvas  
- 栈锁定、事件 schema、命令面、org/roster/crew 所有权  
- 验收定义 A/B/C  

### M1 — 画布 Mock（**当前起点**）

**目标**：浏览器里就能演示「组织图活起来」（可不接真 LLM）。

| 交付 | 说明 |
|------|------|
| `apps/canvas` | Vite + React + TS + xyflow 工程 |
| Seat / Group 节点 | 头像、状态环、角标 |
| Packet 边 | mock 光效 handoff |
| 套娃 | ≥1 子 seat；折叠 + 父角标 |
| Bubble | approve 冒泡 mock |
| Dossier | History / Outputs / Prompt 面板（可本地 state） |
| 模板 | 单 agent 布局 + 四人模板切换 |

**验收**：06 脚本 A/B 的「看得见」部分；C 的套娃子集。  
**不做**：真 pi、真 Python、Tauri 包装。  
**性能预算**：可见节点 ≤40 时交互顺滑；折叠子树不挂重订阅。

**建议工期**：约 3–5 人日（单人全力）。

### M2 — Workspace + 事件总线

| 交付 | 说明 |
|------|------|
| 多 Workspace 切换 | 隔离假数据或本地 JSON |
| Group 框 + 过滤 | 画布分区 |
| Runtime 最小 HTTP | 快照 `GET /org` + SSE 推 [10] 事件 |
| 命令面接通 | [11] 中 `run.start` / `bubble.act` 可先 mock 实现 |

**验收**：换 Workspace 不串状态；UI 由事件驱动而非纯 setTimeout 假动画。  
**建议工期**：约 3–5 人日。

### M3 — 真树 + 单 agent Run

| 交付 | 说明 |
|------|------|
| `tree.json` / `edges[]` 持久化 | 按 09 §4.2 |
| 单 agent stage loop | plan → implement → gate |
| MockRunner → 写 artifacts | 契约检查 |
| roster 挂载字段 | staffing L1 可后置到本里程碑末 |
| 打回 rework | 产物 v2 |

**验收**：06 脚本 A 全过（真落盘）。  
**建议工期**：约 4–6 人日。

### M4 — Tauri 壳 + pi

| 交付 | 说明 |
|------|------|
| `src-tauri` | 包装 canvas；窗口与权限 |
| 拉起 Python runtime | dev/prod 脚本 |
| PiRunner | Engineer seat 默认 runner |
| 四人模板真跑通 | 可弱化 Researcher 为只读工具 |

**验收**：06 脚本 B 在桌面壳内可演示；C 的 L1 QA 建议可选。  
**建议工期**：约 5–8 人日。

### M5 — 套娃与多区打磨

| 交付 | 说明 |
|------|------|
| 默认渲染集 + LOD | 按 09 阈值 |
| 跨 Workspace 待办托盘 | 跳回正确 seat |
| 压测 | 200 节点 / 深 8 折叠可用 |

**验收**：06 脚本 C 全过 + 不崩。  
**建议工期**：约 3–5 人日。

---

## 5. 总体排期（参考）

| 阶段 | 累计（单人粗估） | 可演示物 |
|------|------------------|----------|
| M0 | 已完成 | 文档 |
| M1 | +1 周内 | 浏览器组织图画皮+交互 |
| M2 | +1 周 | 多区 + 事件驱动 |
| M3 | +1–1.5 周 | 单 agent 真 Run 落盘 |
| M4 | +1.5–2 周 | 桌面壳 + pi |
| M5 | +1 周 | 套娃/LOD/托盘 |

**MVP 可发布演示线**：M4 结束（桌面 + 单/四人 + pi）。  
**完整文档 MVP（A+B+C）**：M5 结束。

并行策略：见 [13-multi-agent-workflow](13-multi-agent-workflow.md)。  
**门禁**：M1 骨架 Audit ACCEPT 后，才允许多 agent × 多 worktree 并行；**每阶段/每 lane 必须配 Audit agent**。  
详细任务以 `docs/specs/m1`–`m4` 为准。  

---

## 6. 开发顺序原则

1. **先画布，后壳**：M1 浏览器验证设计语言，M4 再 Tauri。  
2. **先 mock runner，后 pi**：不堵 UI。  
3. **先单 agent，后四人**：降编排复杂度。  
4. **事件/命令契约不破**：UI 不直连 pi。  
5. **Org tree 为编制 SSoT**：Crew 只投影。  
6. **无效改动回滚**：跑不通的临时兼容层不留。  

---

## 7. M1 开工清单（可直接开干）

```text
[ ]  monorepo：apps/canvas + packages/protocol（pnpm workspace，禁 npm 主线）
[ ]  Vite + React 18 + TS（已锁；勿升 React 19）
[ ]  依赖硬锁：@xyflow/react · zustand（唯一 store）· tailwindcss v4 · lucide-react
[ ]  packet 动效可选 motion（仅边/packet）；类型从 @ensemble/protocol
[ ]  mock store：single_agent / four_crew / nested 三套 fixture
[ ]  SeatNode + GroupNode + PacketEdge
[ ]  冒泡层 + Dossier 抽屉
[ ]  Stage/Work 模式切换（动效强弱）
[ ]  Vitest 脚手架可跑；README 启动：pnpm dev:canvas
```

环境前提：

- Node 20+  
- （M3+）Python 3.11+  
- （M4）Rust stable + Tauri 系统依赖  
- （M4）本机已装 `pi`  

---

## 8. 风险与缓冲

| 风险 | 应对 |
|------|------|
| xyflow 大图卡 | 渲染集 + 子画布；M5 LOD |
| Linux WebView | M4/M5 早测；Electron 仅回退 |
| Crew 与树双写 | 禁止 Crew 写 tree |
| pi 非交互差异 | Runner 适配集中处理 |
| 范围膨胀 | 严格 06 Out of Scope |

---

## 9. 文档地图（开发时读什么）

| 你在做… | 先读 |
|---------|------|
| 画布交互 / 好看 | 08、04（仅归档对照） |
| 工程目录 / 栈 | 09、本文 |
| 事件与状态 | 10 |
| 按钮/审批/注入 | 11 |
| 角色与扩编 | 05 |
| 是否做完 | 06 验收 A/B/C |
| 架构边界 | 03 |

---

## 10. 决策索引

- D008 设计语言 · D009 套娃/单 agent/多区 · D010a/D013 栈 · D014 协议钉死 · **D017 CrewAI** · **D018 栈余项判决**  
- 全表：[ssot/stack.md](ssot/stack.md) · [ssot/crewai.md](ssot/crewai.md)  
