# M6 Architecture Plan Review

**日期**：2026-08-18
**范围**：M6 架构、Runner、Event/Command、跨平台打包规格和 V2 开发计划
**风险级别**：Critical。文档约束进程生命周期、协议、持久化边界和三平台交付。

## 1. Review Oracle

- Client、Runtime、Runner、Shell 各有单一责任和明确依赖方向。
- Workspace、Workflow、Run Snapshot、Runtime State、Artifact 不交叉写入。
- 命令表达意图，事件记录状态；命令幂等、事件可重放。
- Runner 通过 Adapter 接入，`pi` 不泄漏到 Domain 或 Client。
- UI Locale、Agent output Locale、主题和平台能力不改变业务语义。
- 三平台安装、启动、退出、恢复和 Runner 分发都有可执行的验收矩阵。

## 2. 检查结果

| 检查项 | 结果 | 证据 |
|---|---|---|
| 目标对齐 | pass | `m6-architecture.md`、`12-dev-plan.md` 对齐“简约界面 + 灵活编排” |
| 架构边界 | pass | 逻辑分层、所有权、依赖方向和生命周期已定义 |
| Backend 形态 | pass | `m6-platform-packaging.md` 定义 Rust 进程内与 packaged Runtime 的 Spike 选择和关闭条件 |
| Runner 契约 | pass | `m6-runner-adapter.md` 定义探测、能力、启动、控制、输出和契约测试 |
| Event / Command | pass | `m6-events-commands.md` 定义 envelope、目录、幂等、重连和本地化 |
| 开发顺序 | pass | F0–F5 依赖、交付物和阶段关闭门槛已写入 `12-dev-plan.md` |
| 历史语义隔离 | pass | 03、09、10、11 明确归档，00 和 specs index 指向 M6 当前真源 |
| Markdown 链接与 diff | pass | 本地链接解析和 `git diff --check` 通过 |
| 运行验证 | blocked | 业务实现和三平台安装包尚未开始，属于下一阶段 Spike 范围 |

## 3. 结论

**ACCEPT**：文档已经足够进入 Backend/Packaging Spike 和新桌面壳实现规划。
实现不得绕过 F0 的进程形态决策，也不得从归档的 M0–M5 协议复制业务语义。

## 4. 下一门禁

完成 `m6-platform-packaging.md` 的 Backend 进程形态 Spike 后，必须：

1. 在 `m6-architecture.md` 写入最终进程边界。
2. 固定 Runtime 连接、认证、数据目录和退出协议。
3. 更新 Runner Adapter 的生产分发约束。
4. 将 F0 关闭，再开始 F1 Desktop Shell 与 Design System。
