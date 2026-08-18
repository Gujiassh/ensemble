# 决策记录

讨论沉淀自 2026-08-17 立项会话。后续变更请追加条目，勿默默改历史结论。

## D001 · 做多角色 Agent 应用，偏高端技术

- **决定**：做 Agent 协作产品（默认可多角色），而不是单聊 bot  
- **澄清**：单 agent 模式合法且完整，仍是 Org Canvas + 契约 + 冒泡，**≠ 单聊 bot**  
- **技术兴趣**：agent 框架、编排、可观测、执行引擎  

## D002 · AI 编排框架锁定 CrewAI；执行不绑死 CrewAI

- **决定（硬锁）**：**AI 多角色编排框架 = CrewAI**（`crewai` Python 包）  
- **用法**：Org tree → CrewAI `Agent` / `Task` / `Crew` **只读投影**；process 支持 sequential / hierarchical  
- **执行**：Runner 适配层；默认 pi；兼容各家 coding CLI；CrewAI 不直接替代 Runner  
- **边界**：CrewAI **不是** UI SSoT，也**不是** org tree 写路径；禁止 Crew 写回编制  
- **原因**：需要成熟的多角色协作语义；重度 coding 与多 CLI 仍走自建 Runner 协议  
- **修订 D002a（2026-08-18）**：用户明确要求「AI 框架用 CrewAI」——从「语义参考」升为 **运行时硬依赖**；依赖写入 `services/runtime/pyproject.toml`  

## D003 · 可视化是一等需求

- **决定**（原始）：可视化为一等需求；角色状态、交付物、handoff 必须可见  
- **修订（D003a · 2026-08-17）**：**被 D008 细化**——产品门面 = **Living Org Canvas**，不再使用 Stageboard/三栏 Flow 作为主叙事  
- **仍有效**：状态/handoff/交付物必须可见；Timeline 仅 History/Debug  

## D004 · 角色可自动拓展

- **决定**：Staffing 机制 + role catalog  
- **MVP**：L1 推荐 + L2 条件自动；L3 后置  
- **约束**：有输出契约、有数量上限、可回放原因  

## D005 · 品牌名 Ensemble

- **决定**：产品名 **Ensemble**  
- **路径**：`/home/cc/code1/ensemble`  
- **副标题方向**：Orchestrate agents like a company / 看得见的多角色协作舞台  

## D006 · 主场景锁定 Issue→小实现

- **决定**：MVP 演示以 bugfix / 小 feature 流水线为主  
- **基础角色模板**：PM、Researcher、Engineer、Reviewer（推荐模板）  
- **修订**：单 agent 同为主路径验收（见 D009、`06-mvp`）  

## D007 · 文档先行

- **决定**：先落 docs，再写业务代码  
- **日期**：2026-08-17  

## D008 · 设计语言 Living Org Canvas

- **决定**：主界面为活组织画布（头像席位、管道光效、节点冒泡、点开档案）  
- **不是**：主时间轴录像带、主聊天瀑布、冷 DAG 调试器  
- **配套**：Stage/Work/Debug 动效强度；档案负责深读与 prompt 注入  
- **文档**：`docs/08-design-language.md`  

## D009 · 无限套娃 / 单 agent / 多工作区 / 多分组

- **决定**：  
  - 组织树 **产品层不设最大深度**（机器与可读性约束）  
  - **单 agent** 一等公民  
  - **多 Workspace** 隔离并行  
  - **多 Group**（可嵌套）  
- **文档**：`docs/08-design-language.md` §3–10  

## D010 · 桌面与技术选型

- **决定（初）**：Tauri 2 + Web UI；纯 Rust GUI 不做主界面；Electron 回退；Python 编排；默认 pi  
- **修订 D010a（2026-08-18）**：**全栈锁定**——  
  - 壳：**Tauri 2（Rust）**  
  - UI：**React + TypeScript + Vite + @xyflow/react**  
  - **关闭** Vue/Vue Flow 主线二选一  
  - 纯 Rust GUI 仍不做主界面；Electron 仅回退  
- **文档**：`docs/09-tech-and-desktop.md`  

## D011 · 审计后文档收敛（2026-08-17）

- **来源**：设计语言审计 + 技术选型审计（双 explore subagent，均为 ACCEPT_WITH_FIXES）  
- **已修（首轮）**：`06-mvp`、`05` roster 挂载、`00`、`03`、D003a  

## D012 · 历史口径全量对齐 + 事件 schema（2026-08-18）

- **决定**：仓库内文档统一到 Living Org Canvas 现行口径；旧 Stageboard 仅归档映射  
- **已修**：README、01–07、08 手势、09↔10、06 M0  
- **新增**：`docs/10-events-schema.md`  

## D013 · 前端/壳栈最终锁定（2026-08-18）

- **决定**：用户确认采用 **Tauri + Rust 壳** 路线；前端画布锁定 **React + @xyflow/react**  
- **文档**：`09` 全文、`06` 技术表、`00`/`03`/`README`、D010a  
- **审计**：第二轮双 agent 均为 **ACCEPT_WITH_FIXES**（无严重项）  

## D014 · 第二轮审计钉死项（2026-08-18）

- **已补**：套娃验收 ≥1；事件真源统一 10；`tree.json`+`edges[]`；角标 busy 映射；边 vs packet；`11-ui-commands.md`；staffing.applied 样例  
- **结论**：文档可进入 **M1**；实现期按 10/11 扩展字段时升 schema 版本  

## D015 · M1–M4 Spec + 强制开发审计配对（2026-08-18）

- **决定**：M1–M4 详细 spec/task 落 `docs/specs/`；多 agent 并行与审计规程落 `docs/13-multi-agent-workflow.md`  
- **强制**：每个开发阶段（及每个并行 lane）结束必须有独立 Audit agent；失败回原 Dev 返工  
- **并行门禁**：M1 骨架 ACCEPT 后方可多 worktree 并行

## D016 · Spec 审计修复（2026-08-18）

- 三路审计（M1/M2、M3/M4、并行规程）均为 ACCEPT_WITH_FIXES  
- 已修：G1=完整 M1 ACCEPT；命令路径对齐 11；Group 过滤 P0；总审计强制；M3 契约表+inject P0；M4 安全清单与四人矩阵；所有权含根文件与 mock 单主责

## D017 · CrewAI 作为 AI 框架硬锁（2026-08-18）

- **决定**：栈表、README、M3/M4、runtime 依赖均显式写 **CrewAI**  
- **落地**：`services/runtime` 声明 `crewai`；投影模块 `ensemble_runtime/crew/`  
- **M3**：可先 mock 顺序任务，但投影接口与依赖必须存在  
- **M4+**：four_crew 等模板经 CrewAI Crew 投影执行 handoff  
- **文档**：`09` T009 · `12` · `03` · specs m3/m4 · `docs/ssot/crewai.md`

## D018 · 技术栈余项全量判决（2026-08-18）

- **触发**：用户要求同步扫未锁技术项并判决 + 审计  
- **真源**：`docs/ssot/stack.md`；决策 ID **T010–T021** 写入 `09`  
- **本轮硬锁**：zustand · Tailwind v4 · lucide-react · motion(仅 packet) · packages/protocol 唯一 · FastAPI · Vitest · 数据根规则 · MIT · React 18 · 禁 WS 默认 · 禁 SQLite MVP  
- **明确延后**：自托管字体、Playwright E2E、SQLite 索引、第二 coding CLI、完整 design tokens 文件、Electron 触发  
- **审计**：`docs/specs/reviews/STACK-lock-2026-08-18.md`（双 explore 初判 ACCEPT_WITH_FIXES → 修后 **ACCEPT**）
- **补锁**：T022 Python venv+pip；T023 runners/ 根路径；清单/字体/SSE 措辞/Tailwind 接线已清

## D019 · V2 产品重建与旧实现解除锁定（2026-08-18）

- **触发**：用户明确允许前端、Backend 和现有数据流全部舍弃重写，目标改为“优雅简约的界面 + 灵活编排功能”
- **产品目标**：跨平台、本地优先的 Agent 编排桌面应用；单 Agent 与多 Agent 都是正式路径
- **Workspace**：创建时选择项目目录、默认 Runner 和默认 Agent 输出语言；Runner 不再是顶栏临时模式
- **设计语言**：画布优先、浅色优先、主题可变、朱红默认主信号、Seat 去卡片化、Handoff 方向脉冲、按需检查器
- **明确排除**：不使用产品名词源作为界面隐喻；不保留旧深色 HUD、固定三栏和开发控件堆叠
- **配置**：Theme、Density、Motion、UI Locale 属于设备偏好；Workspace 保存默认 Runner 和默认输出语言；Run 启动时冻结执行配置
- **国际化**：`zh-CN`、`en-US` 首发；UI Locale 与 Agent output Locale 解耦
- **平台**：Windows、macOS、Linux 独立安装；不要求用户安装 Python、Node 或其它开发环境
- **兼容性**：不兼容旧演示 UI、API 和数据，不添加迁移或兼容层
- **旧决策处理**：D010–D018 的具体技术硬锁仅保留为 M0–M5 历史记录；M6 可重新选择前端、Backend、编排框架、通信协议和持久化方案
- **当前真源**：`01-product`、`08-design-language`、`ssot/design-system`、`ssot/i18n`、`ssot/platform-adaptation`、`specs/m6-product-rebuild`
