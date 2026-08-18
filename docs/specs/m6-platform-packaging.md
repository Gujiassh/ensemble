# M6 Cross-Platform Packaging Spike

**状态**：实施前 Spike 规格（2026-08-18）
**平台**：Windows、macOS、Linux
**目标**：确认安装包、Backend 生命周期和 Runner 分发可以组成一个可运行产品

## 1. 不可妥协的要求

- 用户安装后即可启动，不要求自行安装 Python、Node、pnpm 或仓库依赖。
- 应用使用平台原生应用目录保存配置、Workspace、Run、Artifact 和日志。
- Runtime 只绑定 loopback，并使用单次会话认证。
- Shell 能可靠启动、健康检查、优雅停止和清理 Backend 进程。
- Runner 探测结果能区分可用、缺配置、版本不兼容和平台不支持。
- 三个平台都要有真实安装、启动、创建 Workspace 和执行 Run 的证据。

## 2. 待比较的交付形态

| 形态 | 验证重点 | 关闭条件 |
|------|----------|----------|
| Rust 进程内 Backend | Python/CrewAI/Runner 能力是否可替代，故障是否隔离 | 业务语言和 Runner 依赖不会迫使 Shell 承担业务逻辑 |
| 随安装包交付的独立 Backend | sidecar 打包、签名、启动、端口、退出和升级 | 三平台都能无外部解释器运行且无残留进程 |
| 仅开发环境外置 Runtime | 只作为开发预览 | 不得进入生产安装包 |

Spike 需要给出推荐方案和放弃其它方案的证据，不能只根据代码偏好决定。

## 3. Spike 工作项

### Shell 生命周期

- 分配空闲 loopback 端口
- 生成会话令牌并传给 Runtime
- 等待健康检查和协议版本确认
- Runtime 异常时显示可操作错误
- 应用退出时优雅停止，超时后终止进程树

### 路径与数据

- 解析资源目录、配置目录、数据目录和日志目录
- Workspace 项目路径使用原生 Path API 原样保存
- 安装目录保持只读
- 日志不包含令牌、密钥和完整环境变量

### Runner 分发

- `pi` Adapter 能报告版本和平台可用性
- 默认安装包不依赖用户另装 Node
- 不可用 Runner 不阻塞诊断页和其它 Workspace 配置
- Runner 进程退出后没有孤儿进程

## 4. 验收矩阵

| 流程 | Windows | macOS | Linux |
|------|---------|-------|-------|
| 全新安装 | [ ] | [ ] | [ ] |
| 首次启动和健康检查 | [ ] | [ ] | [ ] |
| 创建 Workspace | [ ] | [ ] | [ ] |
| Runner 探测 | [ ] | [ ] | [ ] |
| 启动并结束单 Agent Run | [ ] | [ ] | [ ] |
| Attention 和 Artifact 可见 | [ ] | [ ] | [ ] |
| 重启后恢复 Workspace 和 Run | [ ] | [ ] | [ ] |
| 应用退出后无残留进程 | [ ] | [ ] | [ ] |
| 浅色、深色、系统主题 | [ ] | [ ] | [ ] |
| `zh-CN`、`en-US` | [ ] | [ ] | [ ] |
| 标准 DPI 和高 DPI | [ ] | [ ] | [ ] |

浏览器开发服务器只能证明 Client 可开发，不能替代以上证据。

## 5. Spike 产物

关闭前必须提交：

1. 进程形态决策和取舍记录。
2. 三平台构建配置和安装包命名规则。
3. Shell/Runtime 启动时序和失败处理。
4. 数据、日志、资源和临时文件路径表。
5. Runner 分发与探测结果。
6. 三平台验收矩阵、命令、日志和截图。

Spike 通过后，结论写入 [m6-architecture.md](m6-architecture.md)、[m6-runner-adapter.md](m6-runner-adapter.md) 和开发计划，再开始生产实现。
