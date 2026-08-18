# M6 Architecture and Boundaries

**状态**：实施前基线（2026-08-18）
**范围**：逻辑架构、模块边界、进程边界和数据所有权
**配合**：[m6-product-rebuild.md](m6-product-rebuild.md) · [m6-domain-model.md](m6-domain-model.md) · [m6-events-commands.md](m6-events-commands.md) · [m6-runner-adapter.md](m6-runner-adapter.md) · [m6-platform-packaging.md](m6-platform-packaging.md)

## 1. 目标

Ensemble 的实现必须支持以下完整路径：

1. 创建 Workspace，并选择项目目录、默认 Runner 和 Agent 输出语言。
2. 编辑组织与 Workflow，保存可复用的编排配置。
3. 从编排配置创建不可变 Run Snapshot。
4. 驱动一个或多个 Runner，持续产生规范化事件。
5. 在画布中观察状态、Handoff、Attention 和 Artifact，并执行人工命令。
6. 通过事件对账恢复运行状态，并在 Windows、macOS、Linux 上以安装包运行。

旧 Canvas、Runtime API、持久化文件和演示协议都不构成兼容约束。

## 2. 逻辑分层

```text
Desktop Shell
  window / filesystem / process lifecycle / platform capabilities
        |
Product Client
  workspace / orchestration editor / canvas / inspector / attention
        |
Application Runtime
  domain commands / snapshots / scheduler / events / persistence
        |
Runner Adapters
  probe / start / control / output / artifact collection
        |
Execution Engines
  pi and future replaceable runners
```

进程内还是独立 Backend 不能改变以上逻辑边界。客户端不得直接调用 Runner，Shell 不得承载编排规则，Runner 不得写回组织模型。

## 3. 所有权边界

| 模块 | 负责 | 不负责 |
|------|------|--------|
| Desktop Shell | 窗口、平台目录、权限、进程生命周期、原生选择器 | Workflow 规则、运行调度、节点业务状态 |
| Product Client | 编辑器、画布投影、检查器、用户命令、临时视图状态 | 持久化真相、Runner CLI、状态机裁决 |
| Application Runtime | Domain 校验、Snapshot、调度、命令幂等、事件日志、恢复 | UI 布局、平台窗口、具体 CLI 细节 |
| Runner Adapter | 探测、启动、暂停/取消、指令注入、输出和 Artifact 归集 | 组织层级、Task 依赖、人工 Gate |
| Persistence | Workspace、Workflow、Run Snapshot、Runtime State、Artifact 索引 | 颜色、Locale 文案、画布临时选择 |

设备偏好、Workspace 配置、编排配置、Run Snapshot 和 Runtime State 必须分开保存，字段跨边界时先更新对应 SSoT。

## 4. 进程边界 Spike

生产 Backend 在以下两种形态中择一：

| 方案 | 优点 | 风险 | 必须验证 |
|------|------|------|----------|
| Rust 进程内 Runtime | 生命周期简单、安装物少、跨平台路径集中 | Python/Runner 生态接入成本高，业务进程边界变重 | Runtime 能力、Runner 调用、故障隔离、测试边界 |
| 随安装包交付的独立 Runtime | 业务语言和 Runner 生态灵活，故障可隔离 | sidecar 打包、启动、认证、退出和签名复杂 | 三平台产物、健康检查、进程树清理、升级路径 |

开发服务器外置 Python 仅用于开发和测试，不能作为生产形态。

Spike 必须输出：

- 目标平台的构建产物和启动命令
- Shell 到 Runtime 的认证和连接方式
- 端口、数据目录、日志目录和资源目录来源
- 启动失败、异常退出、强制退出和重启行为
- 进程残留检查结果
- 对 Runner Adapter 和测试的影响

在 Spike 关闭前，业务实现不得依赖某一种进程形态。

## 5. 数据流

```text
User action
  -> Client command
  -> Runtime validation and state transition
  -> persisted event + runtime state
  -> event stream
  -> Client projection and transient motion
```

客户端可以立即更新输入控件和布局，但业务状态必须以 Runtime 返回的事件或快照为准。Handoff 动画是事件的表现，不是业务数据源。

## 6. 模块依赖方向

```text
Shell -> Client transport -> Runtime application -> Domain
                                      |             |
                                      v             v
                                  Persistence   Runner port
                                                     |
                                                     v
                                               Runner adapter
```

规则：

- Domain 不依赖 UI、Shell 或具体 Runner。
- Runtime application 只依赖 Runner port，不导入 `pi` 实现。
- Client 只依赖协议类型和本地视图状态，不复制 Domain 状态机。
- Shell 只暴露平台能力，不把操作系统判断散落到业务组件。
- 所有跨层数据使用稳定 ID，不使用名称、顺序或“第一个可用项”推断语义。

## 7. 生命周期

### 启动

1. Shell 读取设备偏好和平台能力。
2. Shell 启动或连接 Runtime。
3. Runtime 完成健康检查并返回协议版本。
4. Client 读取 Workspace 索引和当前 Workspace 快照。
5. Client 建立事件流，再允许发送业务命令。

### 退出

1. Client 停止接受新的编辑命令。
2. Shell 请求 Runtime 优雅停止。
3. Runtime 持久化事件游标和运行状态。
4. 超时后 Shell 按平台规则终止 Runtime 进程树。
5. 下次启动通过快照和事件对账恢复，而不是依赖内存状态。

## 8. 安全边界

- Runtime 只监听 loopback，生产连接使用单次会话认证。
- Runner 只在 Workspace 允许的项目目录或 worktree 中执行。
- 访问令牌、环境变量和密钥不能写入事件、Artifact 或普通日志。
- Shell 原生能力通过显式命令暴露，Client 不直接获得任意文件系统和进程权限。
- 任何外部发送、强制推送或高风险命令都必须经过明确的 Attention/Gate。

## 9. 架构验收

- [ ] 进程边界 Spike 已有三平台证据或明确阻塞项
- [ ] Client、Runtime、Runner、Shell 的依赖方向通过审查
- [ ] Workspace、Workflow、Snapshot、Runtime State 没有交叉写入
- [ ] 事件和命令使用 [m6-events-commands.md](m6-events-commands.md)
- [ ] Runner 接入使用 [m6-runner-adapter.md](m6-runner-adapter.md)
- [ ] 安装、启动、退出、恢复符合 [m6-platform-packaging.md](m6-platform-packaging.md)
