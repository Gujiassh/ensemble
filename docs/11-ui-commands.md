# [归档] 旧 UI 命令面

**状态**：已归档（2026-08-18）
本文记录 M0–M5 原型命令，不再约束 V2 Backend API。

V2 的命令与事件唯一当前入口是 [specs/m6-events-commands.md](specs/m6-events-commands.md)。新实现必须通过该协议表达 Workspace、Workflow、Run、Attention 和 Artifact 操作，不得把旧 HTTP 路径或旧 `bubble.act` 结构当作兼容要求。
