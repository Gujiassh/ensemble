# [归档] 旧事件 Schema

**状态**：已归档（2026-08-18）
本文记录 M0–M5 原型事件，不再约束 V2 实现。

V2 的事件与命令唯一当前入口是 [specs/m6-events-commands.md](specs/m6-events-commands.md)。新实现不得继续扩展本文中的 `seat.status`、`edge.packet`、`bubble.*` 等旧事件名；需要新增语义时更新 M6 协议并同步 Domain、Run Operations 和测试。

保留本文是为了说明旧原型的行为来源，不代表旧字段、旧枚举或旧传输方式需要兼容。
