# Stack Lock Audit — 2026-08-18

> **HISTORICAL / NOT CURRENT AUTHORIZATION.** This file records a superseded Tauri-era plan, implementation, review, or ownership result. Current Electron shell architecture and implementation ownership are defined by [m6-electron-shell.md](../m6-electron-shell.md) and [m6-interaction-implementation-slices.md](../m6-interaction-implementation-slices.md).

**触发**：用户要求同步扫未锁技术项、判决并审计  
**真源**：`docs/ssot/stack.md` · D018 · T001–T023  
**审计模式**：Main 自检 + 双 explore 独立审计（read-only）  
**初判**：双路均为 **ACCEPT_WITH_FIXES**  
**修后状态**：**ACCEPT**（P0/P1 已落地）

---

## 1. 判决范围

| 类别 | 动作 |
|------|------|
| 已硬锁但表述软 | 升硬（CrewAI 已在前序） |
| 「或等价 / 实现时定 / 任选」 | 本轮一次判死或标 DEFERRED/OPEN |
| 产品后置 | 保持 DEFERRED，不假锁 |
| 需压测证据 | 保持 OPEN + 关闭条件 |

---

## 2. 本轮硬锁（T010–T023）

| ID | 锁定 |
|----|------|
| T010 | React 18 · pnpm 9 · Node≥20 · **zustand 唯一** |
| T011 | TS 协议 **`packages/protocol` only** |
| T012 | **Tailwind CSS v4** + CSS 变量 HUD |
| T013 | 动效 CSS 优先；**motion** 仅 packet/边 |
| T014 | **lucide-react** |
| T015 | MVP **系统字体栈**；自托管后置 |
| T016 | 前端 **Vitest**（M2 强制） |
| T017 | Runtime **FastAPI** + uvicorn + sse-starlette |
| T018 | CrewAI live = OpenAI-compatible env；默认 mock/off |
| T019 | **SQLite MVP 不做** |
| T020 | 数据根 dev=`data/` · prod=`~/.ensemble` · `ENSEMBLE_DATA_DIR` |
| T021 | 许可 **MIT** |
| T022 | Python 环境 MVP：**venv + pip + setuptools** |
| T023 | Runner 适配在仓库根 **`runners/`** |

前序已锁（不变）：T001–T009（Tauri / React+xyflow / CrewAI / pi / Electron 回退等）。

---

## 3. 明确延后 / 开放（不假锁）

| 项 | 状态 | 关闭条件 |
|----|------|----------|
| Electron 触发 | FALLBACK | Linux WebView 大图压测失败 |
| Playwright E2E | DEFERRED | M4 壳可启 |
| CI GHA | DEFERRED | 首 PR 前 |
| 自托管字体 | DEFERRED | M5+ 视觉 |
| hierarchical 默认 | OPEN | M4 产品反馈 |
| 第二 coding CLI | DEFERRED | 有需求 + Runner 稳 |
| 完整 design tokens 文件 | OPEN | design-system 切片 |
| 图布局算法终选 | OPEN | M5 压测 |

---

## 4. 双审计发现与处置

### Audit A（一致性）— ACCEPT_WITH_FIXES

| Sev | 项 | 处置 |
|-----|-----|------|
| H | `12` M1 清单「zustand 等任选」 | **已修** → 硬锁清单 |
| M | `13` G4 模板双 protocol 路径 | **已修** → packages/protocol only |
| M | 缺 `STACK-lock-*.md` | **本文** |
| M | `09`「React 18+」 | **已修** → React 18 |
| L | README「尚无业务代码」 | **已修** |
| L | `00` 缺数据根 | **已补指针** |

### Audit B（残留模糊）— ACCEPT_WITH_FIXES

| Sev | 项 | 处置 |
|-----|-----|------|
| S1 | `12` 清单 + npm create | **已修** |
| S1 | `styles.css` IBM Plex 违 T015 | **已修** → 系统栈 |
| S2 | `11`「SSE 或轮询」 | **已修** → SSE only + 游标 |
| S2 | crewai runners 双路径 | **已修** → 根 `runners/` |
| S2 | Tailwind 未接线 Vite | **已修** plugin + `@import` |
| S2 | Python 环境工具未名 | **T022** |

---

## 5. 实现对齐探针（修后）

| 探针 | 结果 |
|------|------|
| `apps/canvas/package.json` 含 zustand / lucide / motion / tailwind / vitest | pass |
| `vite.config.ts` 含 `@tailwindcss/vite` | pass |
| `styles.css` 系统字体 + tailwind import | pass |
| `services/runtime/pyproject.toml` 含 crewai / fastapi / sse-starlette | pass |
| `LICENSE` MIT | pass |
| 无 `apps/canvas/src/protocol` 目录 | pass |
| 文档无存活「zustand 等任选」「React 18+」「SSE 或轮询」作主路径 | pass（历史表除外） |

---

## 6. 架构边界复核

```text
Org tree (SSoT) → CrewAI projection (read-only) → RunnerJob (pi/mock)
UI: React/xyflow/zustand ← SSE/HTTP → FastAPI runtime
Shell: Tauri 2 (M4)
```

| 边界 | 结果 |
|------|------|
| CrewAI 不写 tree | pass |
| UI 不直连 pi | pass |
| SSE 非 WS 默认 | pass |
| SQLite 非 MVP 主存 | pass |

---

## 7. 最终 verdict

### **ACCEPT**

主线技术栈已无「实现者可随意换库」的开放缝；剩余 DEFERRED/OPEN 均带关闭条件，且不授权平行主线。

**进入 M1 实现时**以 `docs/ssot/stack.md` 为 freestyle 闸门；新增依赖须对照 T 表，越界先开决策条目。

---

## 8. 审计元数据

| 项 | 值 |
|----|-----|
| 日期 | 2026-08-18 |
| 独立审计 | 2× explore（read-only） |
| 初判 | ACCEPT_WITH_FIXES ×2 |
| 修后 | ACCEPT |
| 关联 | D018 · stack.md · crewai.md |
