# Ensemble Specs Index

| 文档 | 阶段 | 状态 |
|---|---|---|
| [m6-product-rebuild.md](m6-product-rebuild.md) | M6 Product Rebuild | **CURRENT** |
| [m6-domain-model.md](m6-domain-model.md) | M6 Domain Model | **CURRENT · Implementation baseline** |
| [m6-orchestration-interaction.md](m6-orchestration-interaction.md) | M6 Workspace + Orchestration Interaction | **CURRENT · Implementation baseline** |
| [m6-interaction-implementation-slices.md](m6-interaction-implementation-slices.md) | M6 I1-I6 Shared Contracts and Sole Implementation Ownership Table | **CURRENT · Implementation baseline** |
| [m6-run-operations.md](m6-run-operations.md) | M6 Run Operations | **CURRENT · Implementation baseline** |
| [workspace-output-inspection.md](workspace-output-inspection.md) | Workspace Files, Diff, Artifact, and Agent Output Inspection | **CURRENT · Product and interaction baseline** |
| [m6-agent-session-collaboration.md](m6-agent-session-collaboration.md) | Agent Instance Lineage, Session/Terminal, and Cross-Runner Collaboration | **CURRENT · Product and interaction baseline** |
| [m6-adopted-runtime-patterns.md](m6-adopted-runtime-patterns.md) | Herdr/Orca Patterns Adopted by Ensemble | **CURRENT · Product and protocol baseline** |
| [m6-execution-workspace-security.md](m6-execution-workspace-security.md) | Execution Workspace, Permissions, Secrets, and History | **CURRENT · Product and implementation baseline** |
| [m6-architecture.md](m6-architecture.md) | M6 Architecture and Boundaries | **CURRENT · Implementation baseline** |
| [m6-electron-shell.md](m6-electron-shell.md) | Electron Shell, Security Bridge, Rust Sidecar, and Packaging Boundary | **CURRENT · CRITICAL-REVIEWED ACCEPT DOCUMENTATION BASELINE · F0-A2 AUTHORIZED / ACTIVE NEXT · F0-A3 GATED** |
| [m6-runner-adapter.md](m6-runner-adapter.md) | M6 Runner Adapter Contract | **CURRENT · Implementation baseline** |
| [m6-events-commands.md](m6-events-commands.md) | M6 Events and Commands Contract | **CURRENT · Catalog unchanged; Electron transport wording current** |
| [m6-local-runtime-scheduling.md](m6-local-runtime-scheduling.md) | M6 Local Runtime, Tray, Scheduling, and Recovery | **CURRENT · Product and architecture baseline; Electron Spike evidence pending** |
| [m6-platform-packaging.md](m6-platform-packaging.md) | M6 Electron Cross-Platform Packaging Spike | **CURRENT · Spike spec** |
| [f0-a-runtime-lifecycle.md](f0-a-runtime-lifecycle.md) | F0-A Runtime Lifecycle and Owner Acceptance | **CURRENT · OWNER ACCEPTED / ACCEPTED** |
| [f1-shell-design-system.md](f1-shell-design-system.md) | F1 Renderer, Design System, Workspace Entry, and Electron Integration | **CURRENT · F1-A REACCEPTANCE/F1-B SPEC · IMPLEMENTATION PAUSED** |
| [m1-canvas-mock.md](m1-canvas-mock.md) | M1 Canvas Mock | Historical |
| [m2-workspace-events.md](m2-workspace-events.md) | M2 Workspace + Events | Historical |
| [m3-runtime-single-agent.md](m3-runtime-single-agent.md) | M3 Single-agent Run | Historical |
| [m4-tauri-pi.md](m4-tauri-pi.md) | M4 Tauri + pi | Historical · bannered · not authorization |
| [m5-nested-lod.md](m5-nested-lod.md) | M5 Nested LOD + tray | Historical |
| [../13-multi-agent-workflow.md](../13-multi-agent-workflow.md) | 旧并行与审计规程 | **HISTORICAL · current owner authority removed** |
| [reviews/M6-interaction-contract-final-review-2026-08-21.md](reviews/M6-interaction-contract-final-review-2026-08-21.md) | M6 Interaction Contract Final Critical Review | **HISTORICAL · PARTIAL EVIDENCE for unchanged Domain/save/interaction only** |
| [reviews/M6-electron-shell-architecture-review-2026-08-21.md](reviews/M6-electron-shell-architecture-review-2026-08-21.md) | Electron Shell Architecture Critical Review | **CURRENT · ACCEPT · DOCS ONLY · ELECTRON IMPLEMENTATION PAUSED** |
| [reviews/F0-A1-runtime-implementation-review-2026-08-21.md](reviews/F0-A1-runtime-implementation-review-2026-08-21.md) | F0-A1 Rust Runtime Bootstrap Implementation Critical Review | **CURRENT · IMPLEMENTATION ACCEPT** |
| [reviews/F0-A1-owner-acceptance-2026-08-21.md](reviews/F0-A1-owner-acceptance-2026-08-21.md) | F0-A1 Rust Runtime Bootstrap Owner Acceptance | **CURRENT · OWNER ACCEPT · F0-A1 ACCEPTED · F0-A2 AUTHORIZED / MAY START NOW** |
| [reviews/M6-business-spec-2026-08-18.md](reviews/M6-business-spec-2026-08-18.md) | M6 业务规格审查 | **SUPERSEDED** |
| [reviews/M6-architecture-plan-2026-08-18.md](reviews/M6-architecture-plan-2026-08-18.md) | M6 架构与开发计划审查 | **HISTORICAL · not authorization** |
| [reviews/M6-runtime-scheduling-review-2026-08-20.md](reviews/M6-runtime-scheduling-review-2026-08-20.md) | M6 Runtime、调度与恢复审查 | **HISTORICAL · PARTIAL EVIDENCE · not current authorization** |
| [reviews/M6-Herdr-Orca-adoption-review-2026-08-20.md](reviews/M6-Herdr-Orca-adoption-review-2026-08-20.md) | M6 Herdr/Orca 参考能力吸收审查 | **HISTORICAL · PARTIAL EVIDENCE · not current authorization** |
| [reviews/M6-execution-collaboration-review-2026-08-19.md](reviews/M6-execution-collaboration-review-2026-08-19.md) | M6 执行、协作、权限与历史规格审查 | **SUPERSEDED** |
| [reviews/F1-spec-review-2026-08-18.md](reviews/F1-spec-review-2026-08-18.md) | F1 实施规格审查 | **HISTORICAL · PARTIAL EVIDENCE · not current authorization** |
| [reviews/F1-A-implementation-review-2026-08-18.md](reviews/F1-A-implementation-review-2026-08-18.md) | F1-A 客户端实现审计 | **HISTORICAL · PARTIAL EVIDENCE · not current authorization** |
| [evidence/f1-a/](evidence/f1-a/) | F1-A 浏览器与布局证据 | **PARTIAL · unchanged visual behavior only** |
| `reviews/` | 其它审计报告落盘 | 按需创建 |

**规则**：当前生产壳只选择Electron，Rust Runtime与现有Domain/save合同保持不变。`m6-electron-shell.md`是Shell/transport/security/packaging真源，`m6-interaction-implementation-slices.md`第9节是唯一实施所有权表。[Electron Shell Architecture Critical Review](reviews/M6-electron-shell-architecture-review-2026-08-21.md)是当前Shell/security/transport/ownership唯一Critical ACCEPT，但只接受文档架构；不证明代码、package或平台证据存在，该 review 本身也不授权实现。产品负责人随后单独授权且仅授权 F0-A1；该切片已实现且[独立 Critical 实现审查](reviews/F0-A1-runtime-implementation-review-2026-08-21.md)与[Owner Acceptance](reviews/F0-A1-owner-acceptance-2026-08-21.md)均为 **ACCEPT**，F0-A1 已 OWNER ACCEPTED。Owner-acceptance/delivery 状态提交已推送；F0-A2 是当前已授权阶段并可立即启动；F0-A3、F1及产品阶段按 standing authorization 只在前序技术/证据/质量/独立审查/交付门禁关闭后继续。旧M6 interaction final review仍仅是未变化Domain/save/interaction的HISTORICAL/PARTIAL证据。
