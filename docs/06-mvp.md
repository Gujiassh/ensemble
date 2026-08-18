# MVP 范围与验收

**状态**：M0–M5 历史验收，视觉与产品验收已被 D019 撤回  
**说明**：旧功能只能作为探索证据，不是 V2 交付标准。现行验收入口为 [specs/m6-product-rebuild.md](specs/m6-product-rebuild.md)。

## MVP 目标

用 **React + @xyflow/react 画布（Tauri 2 / Rust 壳包装）** 证明：

> Living Org Canvas + 单 agent 闭环 + 四人模板演示 + 一层套娃 + 冒泡审批 + 多 Workspace 切换 +（可选）pi 执行

## In Scope

| 模块 | 内容 |
|------|------|
| 文档 | docs SSoT（含 08/09） |
| UI | **Living Org Canvas**：头像 Seat、管道/信包、节点冒泡、Dossier（含 Prompt 注入） |
| 组织 | 单 seat；四人模板；**至少 1 层套娃**；Group 框；Workspace 切换 |
| Run | run 状态、timeline、artifacts 落盘 |
| 编排 | 单 agent 退化路径 + 四人顺序模板；review 打回 |
| 执行 | MockRunner 必做；PiRunner 力争 M4 |
| Staffing | 至少 QA **建议**（L1）；挂载点含 parent/group |
| 存储 | `workspaces/<id>/org` + `runs/<id>/` |
| 事件 | 最小规范化事件（真源 [10-events-schema](10-events-schema.md)；09 为摘要） |

## Out of Scope（MVP 不做）

- L3 自由生成角色  
- 五家 CLI 全适配  
- 无限深树压力极限优化（有折叠/LOD 基线即可）  
- 跨 Workspace 分屏双画布  
- Seat 多主 Group 归属（MVP：单主 parent + 可选 tags）  
- 多租户 / 账号体系  
- Discord / OpenClaw 对接  

## 技术栈（已锁定，见 09）

| 层 | 锁定 |
|----|------|
| 壳 | **Tauri 2（Rust）** |
| UI | **React 18 + TS + Vite + @xyflow/react + zustand + Tailwind v4 + lucide** |
| 协议包 | **`packages/protocol`** |
| **AI 框架** | **CrewAI**（只读投影） |
| 编排 | Python **FastAPI** + stage/staffing |
| 执行 | Runner 协议；默认 pi |
| 实时 | **SSE** + [10-events-schema](10-events-schema.md)（非 WS） |
| 存储 | 文件 `data/` / `~/.ensemble`；无 SQLite MVP |
| 全表 | [ssot/stack.md](ssot/stack.md) |

## 里程碑（与 09 对齐）

### M0 — 文档与协议

- [x] Brand / 产品 / 设计语言 / 技术选型  
- [x] 最小事件 schema 草案冻结（[10-events-schema.md](10-events-schema.md)）  
- [x] Org tree vs roster vs Crew 所有权写清（03/05/09）  
- [x] 历史文档旧口径收敛（04 归档；01/02/07/README 对齐）  
- [x] 前端栈锁定：Tauri 2（Rust）+ React + @xyflow/react  

### M1 — Mock 画布（`apps/canvas`）

- [x] Vite React TS 工程 + xyflow 画布壳  
- [x] 单 seat 居中可用  
- [x] 四人模板 + 管道光效 mock  
- [x] 一层套娃展开/折叠 + 父角标  
- [x] 冒泡审批 + Dossier（History/Outputs/Prompt）  

### M2 — Workspace + Group + 事件

- [ ] 多 Workspace 切换  
- [ ] Group 区域框 + 过滤  
- [ ] 事件总线驱动 UI（非纯前端假动画）  

### M3 — Runtime 真树 + 单 agent Run

- [ ] `tree.json` 持久化  
- [ ] 单 agent 真 Run + artifacts  
- [ ] 契约检查  
- [ ] **CrewAI 依赖 + Org→Crew 投影骨架**（可 mock）  

### M4 — Tauri（Rust）壳 + pi + CrewAI 多角色

- [ ] `src-tauri` 包装 canvas  
- [ ] Tauri 拉起/连接 Python runtime  
- [ ] PiRunner  
- [ ] **four_crew 经 CrewAI Crew 投影** handoff  
- [ ] 四人模板演示（rework/roster 已在 **M3** 交付，M4 回归）  

### M5 — 深套娃基线

- [x] 默认渲染集 + LOD  
- [x] 跨 Workspace 待办托盘跳转  

## 验收脚本（产品）

### A. 单 agent 最小闭环（必须过）

1. 新建 Workspace，编制仅 1 个 Engineer  
2. 开 Run，头像状态变化，可冒泡  
3. 打开 Dossier，改 Prompt 注入  
4. 产出 artifact 可预览  
5. 无强制其它角色  

### B. 四人模板演示（必须过）

1. 加载 PM/Res/Eng/Rev 模板  
2. 信包 `brief → research → patch → review` 可见流动  
3. Reviewer 审批冒泡：通过 / 打回  
4. 打回后产物 v2  

### C. 套娃 + 分组 + 多区（必须过）

1. Engineer 下挂 **≥1** 个子 seat（演示可用 2）；折叠后父角标有 busy/waiting/error 汇总  
2. 至少 2 个 Group 可区分/过滤  
3. 两个 Workspace 切换不串状态  
4. （L1）QA 建议确认后挂到指定 parent/group  

## 明确废弃的旧验收

- 「角色台 + 常驻交付物墙 + 底栏 Gate」作为主 UI  
- 「必须先出现 4 人才能开始」  
