# M6 Spec — Product Rebuild

**状态**：Draft v1，产品交互确认后进入架构与实现规划
**真源**：[../01-product.md](../01-product.md) · [../08-design-language.md](../08-design-language.md) · [../ssot/design-system.md](../ssot/design-system.md) · [../ssot/i18n.md](../ssot/i18n.md) · [../ssot/platform-adaptation.md](../ssot/platform-adaptation.md) · [m6-domain-model.md](m6-domain-model.md) · [m6-orchestration-interaction.md](m6-orchestration-interaction.md) · [m6-run-operations.md](m6-run-operations.md)

## 1. 目标

以 V2 产品目标重建 Ensemble。现有前端、Runtime API、持久化结构和桌面启动代码均可删除或替换，不要求兼容旧演示数据。

首个可验收版本必须证明：

- 用户能创建 Workspace 并选择 Runner
- 用户能配置单 Agent 或多 Agent 编排
- Run 状态、Handoff、Attention 和 Artifact 可观察
- 用户能介入、审批、打回和重试
- UI 简约且画布优先
- Theme、Locale 和平台适配从架构层成立
- Windows、macOS、Linux 不依赖外部开发环境

---

## 2. 重建原则

- 新规格优先于旧代码
- 不为旧 Fixture、API 或数据文件增加兼容层
- 前后端契约在实现前重新定义并版本化
- Workspace 配置、设备偏好和 Run 快照严格分离
- Runner 通过 Adapter 接入
- 业务事件使用稳定 code，不发送写死语言的系统文案
- 平台差异集中在 Tauri Shell 和 Platform Adapter
- Theme 和 Locale 不进入业务组件条件分支

---

## 3. 建议模块边界

```text
apps/canvas/
  app-shell/
  workspace/
  orchestration/
  canvas/
  inspector/
  attention/
  settings/
  design-system/
  i18n/

services/runtime/
  api/
  domain/
  orchestration/
  runners/
  events/
  persistence/

src-tauri/
  platform/
  backend-runtime/
  preferences/
  window/
```

模块名称在技术设计阶段最终确认，但职责不得重新混合。

---

## 4. 数据所有权

| 数据 | 所有者 | 生命周期 |
|------|--------|----------|
| Theme、UI Locale、Density | Tauri preferences | 设备级 |
| Workspace path、默认 Runner、默认输出语言 | Workspace config | Workspace 级 |
| Role、Seat、Group、Task、Transition、Gate、Join、Contract | Orchestration config | 可编辑模板 |
| Runner、Prompt、编排版本、输出语言 | Run snapshot | Run 启动时冻结 |
| Status、Handoff、Attention | Runtime events | Run 运行时 |
| Artifact | Runtime persistence | Run 级 |

任何字段跨越上述边界前必须更新 SSoT。

---

## 5. 必须流程

### A. 首次启动

1. 应用读取系统语言、主题和平台能力
2. Backend 完成进程内自检，或 sidecar 启动并通过健康检查
3. 无 Workspace 时进入创建流程
4. 不出现开发态 Fixture

### B. 创建 Workspace

1. 输入名称
2. 选择项目目录
3. 探测可用 Runner
4. 选择默认 Runner
5. 选择默认 Agent 输出语言
6. 创建 Workspace
7. 进入空编排或模板选择

### C. 创建编排

1. 从单 Agent 或模板开始
2. 编辑 Role、Seat 和 Group
3. 定义 Task、Transition、Artifact Contract 和 Attention Gate
4. 校验输入、输出和依赖
5. 保存编排版本

### D. 执行 Run

1. 从 Workspace 和编排版本创建 Run snapshot
2. Runtime 驱动 Runner
3. Canvas 接收稳定事件并更新状态
4. Handoff 触发一次方向脉冲
5. Attention 要求用户介入
6. Artifact 可查看
7. Run 完成、失败或进入重试

---

## 6. 主题与语言验收

- 浅色、深色、跟随系统
- `zh-CN`、`en-US`
- UI Locale 与 Run output Locale 独立
- Theme 切换不丢画布状态
- 文案扩张不破坏控件
- Runtime 系统消息使用 message key 和参数
- Agent 输出按 Run output Locale 执行

---

## 7. 平台验收

Windows、macOS、Linux 分别提供：

- 可安装包
- 安装包内置 Backend execution unit
- 首次启动证据
- Workspace 创建证据
- Runner 探测和一次真实 Run 证据
- 使用 sidecar 时，退出后无残留 Backend 进程
- 平台数据目录验证

浏览器开发预览不能代替桌面验收。

---

## 8. 非目标

- 旧数据迁移
- 旧 UI 视觉兼容
- 移动端
- 生产 Web 版
- 账户、云同步和多人在线协作
- Runner 插件市场
- 任意通用流程图能力

---

## 9. 实施门禁

在业务实现前必须完成：

1. V2 Domain model
2. Workspace、Orchestration、Run 和 Event schema
3. Runner Adapter contract
4. Backend 形态与跨平台打包 spike
5. Canvas information architecture wireframe
6. Theme token implementation contract
7. i18n key and message protocol
8. Windows、macOS、Linux CI 构建方案
9. Workspace 创建、编排编辑、自动保存和冲突交互规格
10. Run、Attention、Artifact、暂停取消和恢复规格

完成上述设计后再拆分实际开发任务。

---

## 10. Review Oracle

每次 Review 必须回答：

- 当前改动是否服务“简约界面 + 灵活编排”核心目标
- 是否把 Workspace、设备偏好和 Run snapshot 混在一起
- 是否引入旧实现兼容结构
- 是否在业务组件写死颜色、语言或平台判断
- Runner 是否仍可替换
- Run 启动后配置是否稳定
- 业务状态是否通过稳定 code 传递
- Pause、Cancel、Retry、Rework 和 Resume 是否遵循状态机且可幂等重放
- Run 是否只读取不可变 Snapshot，事件缺口是否能通过对账恢复
- 是否有对应平台和用户流程的运行证据

## 11. 产品确认门禁

以下六组决定关闭后，M6 才进入架构与实现任务拆分：

1. **Runner 选择**：Workspace 创建至少需要一个可用 Profile；`pi` 为默认推荐，Task/Seat 覆盖属于高级配置，默认 Runner 的生产分发不得要求用户另装 Node。
2. **Workflow 能力**：首版支持 Task、Gate、Join、并行、`all/any` 和有上限 Rework，不支持任意脚本或自由表达式；Gate 首版固定阻塞。
3. **画布与保存**：画布拖动只改布局，层级移动使用明确命令；Draft 自动保存，冲突不静默合并，启动 Run 创建不可变版本。
4. **运行快照**：Run 只读 Snapshot；Amendment 只能追加 Snapshot 后代并影响未开始部分，不能改历史 Task、Artifact 或 Gate。
5. **运行控制**：Pause 停止新派发并按 Runner 能力到安全边界；Cancel 不可逆；下游已开始后的重跑创建新 Run，不回滚原 Run。
6. **人工介入与恢复**：实时补充指令需要 Runner capability，否则进入下一次 Attempt；Attention 幂等；崩溃通过事件对账和 recovery Attempt 恢复。
