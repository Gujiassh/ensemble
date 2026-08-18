# M6 Business Spec Review

**日期**：2026-08-18

**范围**：`m6-domain-model.md`、`m6-orchestration-interaction.md`、`m6-run-operations.md`、M6 索引与 V2 SSoT 对齐
**风险级别**：Critical。文档定义了持久化边界、Run 快照、状态机和人工操作语义。

## 1. Review Oracle

本轮以以下不变量作为语义 Oracle：

- Workspace Draft、设备偏好和 Run Snapshot 不混用。
- Run 启动后只读取不可变 Snapshot；Amendment 不原地改写历史。
- 组织父子关系、Workflow Transition 和画布布局分别有明确所有权。
- Pause、Cancel、Retry、Rework、Attention Resolve 和 Resume 都是幂等、可审计命令。
- Artifact 追加版本，消费关系、校验状态和替代状态不互相覆盖。
- Runtime 使用稳定 code 和 sequence；UI Locale 不改变业务状态。

## 2. Review Result

| 检查项 | 结果 | 证据 |
|---|---|---|
| 目标对齐 | pass | 画布优先、单/多 Agent、可干预编排和 Runner 可替换均在 M6 文档中有对应流程 |
| 用户路径与时序 | pass | Workspace 创建、组织/流程编辑、启动 Run、运行控制和恢复均有前置、反馈和失败路径 |
| 架构边界 | pass | Organization / Workflow / Presentation / RunSnapshot / RuntimeState 分离；没有把 Runner 实现写入交互语义 |
| 数据契约 | pass | base/active Snapshot、effectiveSnapshotId、Artifact 三类状态和 Revision/Sequence 规则已对齐 |
| 状态机完整性 | pass | Run、TaskAttempt、Gate/Join、Attention 的终态、取消、中断和恢复路径已列明 |
| 国际化与主题 | pass | 状态 code、message key、UI Locale / outputLocale 分离，交互不绑定颜色和语言 |
| 平台适配 | pass | 目录选择、快捷键、退出策略、Runner 探测和默认 pi 的自包含要求已落 SSoT |
| 链接与 Markdown 结构 | pass | 本地 Markdown 链接解析无失效目标；代码围栏数量均为偶数 |
| 实现验证 | blocked | M6 尚未实现业务代码，无法做 API、持久化、真实 Runner 和三平台安装包验证 |

## 3. Remaining Product Gates

以下不是审查失败，而是需要产品确认后才能关闭的决策：

1. 无可用 Runner Profile 时是否阻止 Workspace 完成创建。
2. 首版并行、`all/any` Join、有上限 Rework 和阻塞 Gate 的范围。
3. 画布拖动与层级移动分离、Draft 自动保存以及冲突保留为 Template 的方式。
4. Amendment 只影响未开始部分，且下游已开始后的重跑创建新 Run。
5. Pause 的安全边界、Cancel 不可逆和应用退出时暂停/取消选择。
6. 实时补充指令 capability、Attention 幂等和中断 Run 的 recovery Attempt。

## 4. Residual Risk

- Runner Adapter contract、Event/Command schema、Backend 形态和持久化格式仍待架构阶段定义。
- `any` Join 允许其它分支继续执行，实施时必须确保迟到分支不会在 Run 结束后留下未归档工作。
- 默认 pi 的自包含分发是跨平台验收前置条件，不能用开发机已有 Node 或 Python 代替。
- 本文档审查通过不代表旧 M0–M5 实现符合 V2；旧代码仍只作为功能参考。
