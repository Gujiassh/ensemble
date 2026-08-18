# M6 Runner Adapter Contract

**状态**：实施前基线（2026-08-18）
**默认 Runner**：`pi`
**原则**：Runner 可替换，编排逻辑不绑定具体 CLI

## 1. 责任

Runner Adapter 将统一的 Run 工作转换成某个执行引擎的探测、启动、控制和输出。它不负责：

- 选择 Task 顺序或修改 Workflow
- 创建或修改 Role、Seat、Group
- 决定人工 Gate 是否通过
- 将私有 CLI 日志直接暴露给 Client
- 绕过 Runtime 写入 Artifact 或 Run State

## 2. 能力描述

每个 Adapter 必须提供稳定的描述：

```json
{
  "id": "pi",
  "displayName": "pi",
  "supportedPlatforms": ["windows", "macos", "linux"],
  "capabilities": {
    "pause": false,
    "cancel": true,
    "inject": true,
    "structuredOutput": true,
    "artifactCollection": true
  },
  "requiredConfiguration": [],
  "version": "adapter-contract-v1"
}
```

能力是事实声明，不是 UI 假设。Runtime 必须根据能力决定 Pause、Inject 等命令能否执行。

## 3. 探测结果

探测必须区分以下结果：

```text
available
installed_incompatible
missing_configuration
unsupported_platform
not_installed
probe_failed
```

探测结果至少包含：`runner_id`、版本、平台、可操作原因、配置字段和探测时间。Client 只显示可用或完成配置后可用的 Runner，诊断区保留其它结果。

## 4. 运行接口

逻辑接口如下，传输协议由 Runtime 决定：

```text
probe(context) -> Availability
start(request) -> Handle
read(handle) -> RunnerSignal stream
inject(handle, instruction) -> Accepted | Rejected
pause(handle) -> Accepted | Unsupported | Failed
cancel(handle) -> Accepted | Failed
collect(handle) -> RunnerResult
```

`RunRequest` 必须包含：

```text
workspace_id
run_id
task_id
seat_id
workspace_path
prompt
inputs[]
expected_artifacts[]
output_locale
timeout
```

Runner 不接收整个 Workflow，也不接收会改变历史 Snapshot 的配置。

## 5. 状态与结果

Adapter 的私有输出必须映射成稳定信号：

```text
started | working | waiting_input | produced_output |
completed | failed | canceled | interrupted
```

Runtime 负责将这些信号与 Task、Seat、Run 状态关联。Adapter 不能直接决定 `succeeded`、`blocked` 或人工 Gate 结果。

`RunnerResult` 至少包含：

```text
outcome
summary
artifacts[]
diagnostics[]
exit_code?
provider_version
started_at
finished_at
```

没有通过 Artifact Contract 验证的结果不能被 Runtime 标记为业务完成。

## 6. 控制语义

- `pause` 只停止新的派发；是否能暂停当前进程由 `capabilities.pause` 决定。
- 不支持安全暂停时，Runtime 必须返回能力限制，不伪造暂停成功。
- `cancel` 是不可逆终态，Adapter 必须尽力终止子进程和子进程树。
- `inject` 只有在 Adapter 声明 `inject=true` 且当前 Attempt 支持时才实时生效，否则进入下一次 Attempt。
- 下游已开始后重跑必须创建新 Run，不复用原 Run 的执行结果。

## 7. `pi` Adapter

`pi` 是默认推荐 Runner，但它只存在于 Adapter 层：

- CLI 参数、进程组装和版本探测集中在 `pi` Adapter。
- Runtime 和 Client 只依赖通用接口。
- 生产安装包必须提供自包含的执行单元，不要求用户另装 Node。
- `pi` 私有日志先转换为 RunnerSignal，再进入事件协议。
- `pi` 的真实 Pause/Inject 能力以探测结果为准，不在产品 UI 中写死。

## 8. 契约测试

每个 Adapter 必须通过同一组测试：

- 探测结果分类正确
- Workspace 路径和环境变量边界正确
- 启动、正常结束、失败、取消和异常退出可回收
- 输出语言传入请求并写入 Run 元数据
- Artifact 路径不会越出 Workspace 目录
- 私有日志不会成为 Client 协议
- 能力不支持时命令明确失败且不产生成功事件

## 9. 验收门槛

- [ ] 通用接口与 [m6-architecture.md](m6-architecture.md) 边界一致
- [ ] `pi` Adapter 通过完整契约测试
- [ ] 至少一个 Mock Adapter 用于 Runtime 和 UI 测试
- [ ] Runner 能力映射覆盖 Pause、Cancel、Inject、Artifact
- [ ] 生产打包路径符合 [m6-platform-packaging.md](m6-platform-packaging.md)
