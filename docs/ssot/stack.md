# [归档] SSoT · 技术栈总表（锁定 / 延后 / 开放）

**状态**：M0–M5 历史技术栈，已被 D019 解除锁定  
**当前真源**：[../specs/m6-product-rebuild.md](../specs/m6-product-rebuild.md) · [../specs/m6-architecture.md](../specs/m6-architecture.md) · [../specs/m6-runner-adapter.md](../specs/m6-runner-adapter.md) · [../specs/m6-events-commands.md](../specs/m6-events-commands.md) · [../specs/m6-platform-packaging.md](../specs/m6-platform-packaging.md) · [design-system.md](design-system.md) · [i18n.md](i18n.md) · [platform-adaptation.md](platform-adaptation.md)
**说明**：下表只记录旧原型采用过的技术和历史锁定过程。新实现不能从本文推断技术硬锁；以当前 M6 架构、Runner、协议和平台规格为准。

---

## 1. 判决摘要

| 状态 | 含义 |
|------|------|
| **LOCKED** | 主线唯一选型；替换需新决策条目 |
| **DEFERRED** | 有方向，但 **MVP 不做选型绑定**；实现前不得当依赖写进主路径 |
| **FALLBACK** | 非默认；触发条件写死 |
| **OPEN** | 仍待产品/压测证据；**不得**在代码里偷偷选定并扩散 |

---

## 2. 全栈锁定表

### 2.1 壳与桌面

| 层 | 选型 | 状态 | 决策 |
|----|------|------|------|
| 桌面壳 | **Tauri 2（Rust）** | LOCKED | T001 |
| 纯 Rust GUI 主界面 | **不做** | LOCKED 排除 | T003 |
| Electron | **仅回退**（Linux WebView 大图不可接受时） | FALLBACK | T008 |
| 壳职责 | 窗口/权限/FS/托盘/拉起 runtime·pi | LOCKED | 09§2.2 |

### 2.2 前端画布

| 层 | 选型 | 状态 | 决策 |
|----|------|------|------|
| 语言 | **TypeScript**（strict） | LOCKED | T002 |
| UI 框架 | **React 18**（不升 React 19 作 MVP 默认） | LOCKED | T002 / T010 |
| 构建 | **Vite 6** | LOCKED | T002 |
| 节点图 | **@xyflow/react** v12 | LOCKED | T002 |
| 包管理 | **pnpm** 9.x（`packageManager` 字段） | LOCKED | T010 |
| Node | **≥ 20** | LOCKED | engines |
| 客户端状态 | **zustand** | LOCKED | T010（scaffold 已用；禁 Redux/Jotai 并行主线） |
| 协议类型包 | **`packages/protocol`**（唯一 TS 真源） | LOCKED | T011 |
| 样式 | **Tailwind CSS v4** + CSS 变量 HUD token | LOCKED | T012 |
| 动效 | **CSS 优先**；管道光点可用 **`motion`**（原 framer-motion）**仅限边/packet** | LOCKED | T013 |
| 图标 | **lucide-react** | LOCKED | T014 |
| 字体（MVP） | **系统栈**：`ui-sans-serif, system-ui` + `ui-monospace` | LOCKED | T015 |
| 字体（后置） | 自托管 Inter / JetBrains Mono | DEFERRED | M5+ 视觉打磨 |
| 前端单测 | **Vitest**（M1 可选；**M2 apply 事件强制**） | LOCKED | T016 |
| E2E | Playwright | DEFERRED | M4+ 桌面/浏览器冒烟 |
| Diff 预览 | M1–M3：**等宽纯文本**；专用 diff 组件 | DEFERRED | 不阻塞 artifacts |

**明确不选（前端）**：Vue / Vue Flow；Emotion/styled-components 作默认样式体系；多状态库并行。

### 2.3 实时与协议

| 层 | 选型 | 状态 | 决策 |
|----|------|------|------|
| 下行事件 | **SSE** + [10](../10-events-schema.md) | LOCKED | T004 域 |
| 上行命令 | **HTTP**（dev）/ Tauri invoke 转发（桌面）+ [11](../11-ui-commands.md) | LOCKED | |
| WebSocket | **不用**作默认事件通道 | LOCKED 排除 | 简化本地单客户端 |
| 绑定地址 | Runtime HTTP **仅 127.0.0.1** | LOCKED | M4-F07b |

### 2.4 Runtime / AI / 执行

| 层 | 选型 | 状态 | 决策 |
|----|------|------|------|
| Runtime 语言 | **Python ≥ 3.11** | LOCKED | T004 |
| HTTP 框架 | **FastAPI** + **uvicorn** + **sse-starlette** | LOCKED | T017 |
| 校验/模型 | **Pydantic v2** | LOCKED | pyproject |
| **AI 编排框架** | **CrewAI**（`crewai`） | LOCKED | T009 / D002a |
| Crew 所有权 | Org→Crew **只读投影** | LOCKED | 03 / crewai.md |
| LLM（CrewAI live） | **OpenAI-compatible** 环境变量（`OPENAI_API_KEY` 等）；默认 **mock/off** | LOCKED 方向 | T018 |
| 默认执行 runner | **pi**（`-p`，优先 json/rpc） | LOCKED | T004 |
| Mock runner | **必做**（M3） | LOCKED | 06 |
| 其它 CLI（claude/codex/…） | Runner 适配位；**MVP 不实现** | DEFERRED | Out of Scope |
| 测试（Python） | **pytest** | LOCKED | pyproject |
| Python 打包/环境 MVP | **venv + pip + setuptools**（不强制 poetry/uv/pdm） | LOCKED | T022 |

### 2.5 存储与数据路径

| 层 | 选型 | 状态 | 决策 |
|----|------|------|------|
| 主存储 | **文件系统** `workspaces/<id>/…` JSON + jsonl + artifacts | LOCKED | 09§4 |
| SQLite | **MVP 不做**；索引库 | DEFERRED | T019 |
| 数据根（dev） | 仓库内 **`data/`**（gitignore） | LOCKED | T020 |
| 数据根（prod/桌面） | **`~/.ensemble/`** 或 `ENSEMBLE_DATA_DIR` | LOCKED | T020 |
| 角色目录 | **`roles/catalog.yaml`** | LOCKED 路径 | 12 |
| 密钥 | **仅环境变量**；禁止进 git | LOCKED | M4-F08 |

### 2.6 工程与协作

| 层 | 选型 | 状态 | 决策 |
|----|------|------|------|
| Monorepo | `apps/` · `packages/` · `services/` · `runners/` · `src-tauri/` | LOCKED | 09 |
| 开源许可 | **MIT**（工程默认；若改需决策） | LOCKED | T021 |
| CI | GitHub Actions 基础 lint/typecheck/pytest | DEFERRED | 首 PR 前补 |
| 自动更新 | Tauri updater | DEFERRED | 非 MVP |
| 布局加速 | Web Worker（M5）；Rust layout 命令 | DEFERRED | 09§5 |
| Seat 拖拽改归属 | 产品后置 | DEFERRED | 08§16 |
| 多主 Group | 产品后置 | DEFERRED | 09§4.2 |

---

## 3. 本轮从「未锁」→ 判决清单

| # | 原表述 | 判决 | ID |
|---|--------|------|-----|
| 1 | 动效 CSS + Motion（或等价） | CSS 优先 + `motion` 仅 packet | T013 |
| 2 | 可用 Tailwind（实现时定） | **Tailwind v4 + CSS 变量 token** | T012 |
| 3 | 状态库 zustand 等任选 | **zustand 唯一** | T010 |
| 4 | FastAPI/Starlette 或等价 | **FastAPI**（不用 Starlette 裸写主线） | T017 |
| 5 | protocol 双位置 | **仅 `packages/protocol`** | T011 |
| 6 | 可选 SQLite | **MVP 不做** | T019 |
| 7 | `~/.ensemble` 或 data/ | **双模式 + 环境变量**，规则钉死 | T020 |
| 8 | Lucide 等 | **lucide-react** | T014 |
| 9 | 字体未写 | MVP 系统栈；后置自托管 | T015 |
| 10 | 前端测试未写 | Vitest；M2 强制 | T016 |
| 11 | CrewAI live LLM | OpenAI-compatible env；默认 mock | T018 |
| 12 | 开源 license 未写 | MIT | T021 |
| 13 | React 18 vs 19 | **18** 锁定 MVP | T010 |
| 14 | WebSocket 是否上 | **不上**默认通道 | §2.3 |
| 15 | pnpm 仅 package 字段 | 文档硬锁 | T010 |
| 16 | Python 环境工具 | **venv+pip+setuptools** MVP | T022 |
| 17 | runners 路径 | 仓库根 `runners/` 唯一 | T023 |

---

## 4. 仍 OPEN / 需证据（禁止假锁）

| 项 | 为何不锁 | 关闭条件 |
|----|----------|----------|
| Electron 是否触发 | 依赖 Linux WebView 压测 | M1/M5 大图数据 |
| hierarchical Crew 默认 | 产品是否需要经理节点 | M4 演示反馈 |
| 第二 coding CLI | 无用户强制 | 明确需求 + Runner 协议稳定后 |
| 完整 design tokens 文件 | 视觉未定稿 | design-system/ 独立切片 |
| E2E 工具链细节 | 桌面未起 | M4 壳可启动后 |

---

## 5. 验收探针（审计用）

```bash
# 文档含硬锁关键词
rg -n "T01[0-9]|T021|zustand|Tailwind|FastAPI|packages/protocol|lucide" docs/

# 前端依赖与锁一致
rg -n '"zustand"|"@xyflow/react"|"react":' apps/canvas/package.json

# Runtime
rg -n 'crewai|fastapi|sse-starlette' services/runtime/pyproject.toml

# 禁止双协议真源
test ! -d apps/canvas/src/protocol || echo "FAIL: canvas local protocol dir should not exist as SSoT"
```

---

## 6. 交叉引用

- 详细壳/性能：`docs/09-tech-and-desktop.md`
- 开发计划：`docs/12-dev-plan.md`
- CrewAI：`docs/ssot/crewai.md`
- 决策：D018
