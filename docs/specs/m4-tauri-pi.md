# M4 Spec — Tauri Shell + PiRunner

**状态**：Historical ACCEPT；D019 后不再作为 V2 验收  
**阶段**：M4  
**主责**：`src-tauri/**`、`runners/pi/**`；runtime 启动集成；canvas 仅桌面适配  
**并行**：**默认串行**（壳+进程生命周期敏感）；若并行须 Main 书面拆分且不改启动协议  
**依赖**：M3 单 agent 真 Run + MockRunner  
**审计**：强制 Audit（安全+边界重点）  
**真源**：[09](../09-tech-and-desktop.md) · [03](../03-architecture.md) · [10](../10-events-schema.md) · [11](../11-ui-commands.md)

---

## 1. Goal

- **Tauri 2** 包装 canvas，可安装/可开发态打开桌面窗  
- Tauri **拉起/监督** Python runtime（或连接已启动实例）  
- **PiRunner**：Engineer seat 默认 `runner=pi`  
- **四人模板**可演示真/半真跑通（Researcher 可弱）  
- 桌面权限：工作目录、不乱访问盘符  

## 2. Non-goals

- Electron 实现  
- 五家 CLI  
- 自动更新完整商店发布  
- L3 staffing  
- 深套娃 LOD（M5）  

## 3. Architecture

```text
Tauri (Rust)
  ├── webview: apps/canvas dist 或 dev URL
  ├── spawn/supervise: python -m ensemble_runtime
  ├── invoke: 可选转发 11 命令
  └── env: ENSEMBLE_DATA_DIR, runtime port

Runtime
  └── Runner registry: mock | pi
        └── PiRunner: pi -p --mode json ...
```

## 4. Functional requirements

| ID | 需求 | 优先级 |
|----|------|--------|
| M4-F01 | `cargo tauri dev` 或文档等价命令可开窗 | P0 |
| M4-F02 | 窗内 canvas 能连上 runtime | P0 |
| M4-F03 | runtime 崩溃可感知（日志/提示） | P1 |
| M4-F04 | PiRunner 实现 Runner 协议 | P0 |
| M4-F05 | 单 agent implement 阶段可走 pi（环境无 pi 则 skip+说明） | P0 |
| M4-F06 | 四人模板 run：边+产物+review bubble | P0 |
| M4-F07 | 工作目录限制在 workspace 绑定路径；pi cwd=`workspace_path` | P0 |
| M4-F07b | Runtime HTTP **仅 127.0.0.1**；关窗杀 runtime/pi 子进程 | P0 |
| M4-F07c | Tauri capabilities 白名单（最小 fs/shell） | P0 |
| M4-F08 | 无 API key 进 git；密钥仅环境变量 | P0 |
| M4-F09 | mock 仍可切换（无 pi 开发） | P0 |
| M4-F10 | Linux 大图备注/已知问题写入 docs | P1 |

## 4b. four_crew 编排契约（runtime 归属，非 Rust）

| seat | 默认 runner | 必交 artifact（示意） |
|------|-------------|----------------------|
| PM | mock | 01-brief.md |
| Researcher | mock（可弱：只读摘要） | 02-research.md |
| Engineer | **pi**（无 pi 则 mock 并 UI 标注） | 03-patch.diff 或 03-output.md |
| Reviewer | mock | 04-review.md + approve bubble |

Handoff 边：pm→res→eng→rev；无 pi 时演示矩阵：全 mock 允许，但 README 须写明。  
**文件所有权**：four_crew stage 映射只改 `services/runtime/**`；`src-tauri` 只管进程与窗口。

### 4c. CrewAI 执行路径（M4 多角色硬要求）

```text
org 子树 (four_crew)
  → ensemble_runtime.crew.project_org_to_crew(...)
  → crewai.Crew(agents, tasks, process=sequential|hierarchical)
  → 各 Task 经 Runner tool / 回调派发 RunnerJob（Engineer→pi）
  → events: seat.status / edge.packet / artifact.written
```

| ID | 需求 | 优先级 |
|----|------|--------|
| M4-F11 | four_crew 经 **CrewAI Crew** 投影，而非手写死循环冒充 | P0 |
| M4-F12 | process 至少支持 `sequential`；hierarchical 可选 | P0 / P1 |
| M4-F13 | Crew kickoff 失败映射 run failed + 可区分错误 | P0 |
| M4-F14 | 无 LLM key 时可用 mock LLM/tool 仍演示 handoff | P0 |

## 5. PiRunner 约束

- 非交互：`pi -p`  
- 优先 `--mode json` 或可解析 text  
- `--session-dir` 落在 run sessions  
- tools 按 seat 裁剪（Engineer：read/bash/edit/write）  
- 超时与 exit_code 映射 RunnerResult  
- **禁止** canvas 直接 spawn pi  

## 6. Tasks

- [x] T1 初始化 Tauri 2 与 monorepo 集成 — `src-tauri/` + root `dev:desktop` / `build:desktop`  
- [x] T2 开发态加载 canvas — `devUrl=http://127.0.0.1:17351`，`beforeDevCommand=pnpm --filter @ensemble/canvas dev`；build 用 `../apps/canvas/dist`  
- [x] T3 runtime 生命周期（start/stop/health） — health 失败则 spawn `.venv/bin/python -m ensemble_runtime`（cwd=`services/runtime`，`ENSEMBLE_DATA_DIR=data/`）；关窗/`Exit` 杀进程组；invoke `runtime_status` / `runtime_restart`  
- [x] T4 runners/pi 实现 + 测试（可 mock 子进程）  
- [x] T5 runtime 注册 pi provider  
- [x] T6 four_crew 模板 stage 映射  
- [x] **T6b CrewAI Crew 投影 + sequential handoff（mock 顺序执行经投影；live kickoff 待 key）**  
- [x] T7 安全：capabilities 最小权限 — `capabilities/default.json` 仅 `core:default`；无 fs/shell 插件；spawn 走 Rust `std::process`  
- [x] T8 文档：安装依赖、无 pi 时如何 demo  
- [x] T9 验收脚本 B 走查记录（自动化 + cargo check；A1 开窗需 DISPLAY）  

### Shell how-to（T1–T3 / T7）

```bash
pnpm install
pnpm dev:desktop          # tauri dev → Vite 17351 + auto runtime :18427
pnpm build:desktop        # canvas dist + tauri bundle
cd src-tauri && cargo check
```

Linux：装 `libwebkit2gtk-4.1-dev` / `libgtk-3-dev` / `librsvg2-dev` / `patchelf`；`pnpm exec tauri info` 核对。无 DISPLAY 时仍可用 `cargo check`。

## 7. Acceptance（产品脚本 B + 壳）

| # | 标准 |
|---|------|
| A1 | 桌面窗启动成功 |
| A2 | 单 agent mock 仍可用 |
| A3 | 有 pi：implement 产生文件；分类失败：无 pi / 超时 / 契约 / 权限（文案可区分） |
| A4 | 四人模板 handoff + review 冒泡完整一轮（无 pi 可用全 mock 并标注） |
| A4b | four_crew 路径可证明经过 CrewAI（日志/trace 含 crew 投影 id） |
| A5 | reject rework 仍可用 |
| A6 | 安全清单逐条勾：loopback、cwd、capabilities、密钥、关窗杀进程 |
| A7 | README 桌面启动步骤可用 |
| A8 | 审计报告 `docs/specs/reviews/M4-tauri-YYYY-MM-DD.md` |

## 8. Audit focus

- Rust 是否越权写业务编排  
- Runner 边界  
- 权限表面  
- 验收 B 证据  

## 9. Progress

| 日期 | 状态 | 备注 |
|------|------|------|
| 2026-08-18 | Spec Ready | |
| 2026-08-18 | Spec fix | 审计 B：四人契约、安全清单 |
| 2026-08-18 | Dev started | PiRunner + four_crew CrewAI projection path; Tauri scaffold in parallel |
| 2026-08-18 | Shell T1/T2/T3/T7 | `src-tauri` Tauri 2 壳落地；`cargo check` 绿；`tauri info` webkit2gtk-4.1 OK。未跑完整 `tauri dev` 开窗验收（A1 仍待 DISPLAY）。 |

### Demo without pi（T8）

```bash
export ENSEMBLE_PI_DRY_RUN=1          # stub engineer artifacts
# or
export ENSEMBLE_FORCE_MOCK=1          # all seats mock
cd services/runtime && . .venv/bin/activate
ENSEMBLE_CREWAI_MODE=mock python -m ensemble_runtime
# other terminal:
curl -s -X POST http://127.0.0.1:18427/workspaces/ws_alpha/runs \
  -H 'content-type: application/json' \
  -d '{"client_op_id":"op_fc1","template":"four_crew","title":"demo"}'
```

Pi binary optional. Engineer seat uses `pi-fallback` provider when dry-run / missing binary.

### Acceptance B evidence（T9）

| # | Evidence |
|---|----------|
| A1 | `pnpm dev:desktop` / `cargo tauri dev` — needs DISPLAY; `cargo check` green as compile gate |
| A2 | single_agent mock still in pytest |
| A3 | `ENSEMBLE_PI_DRY_RUN=1` → provider `pi-fallback`; missing bin → same; timeout → `pi_timeout` |
| A4 | `test_four_crew_projects_crewai_and_artifacts` |
| A4b | timeline `crew.projected` + state.crew.framework=crewai |
| A5 | M3 reject rework still green |
| A6 | loopback in `__main__.py`; cwd=workspace_path in PiRunner; capabilities `core:default` only; no keys in git; Exit kills process group |
| A7 | README 桌面壳 section |
| 2026-08-18 | Audit ACCEPT | M4-tauri-2026-08-18.md；cargo check + 22p pytest |
