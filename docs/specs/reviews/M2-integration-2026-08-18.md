# M2 Integration Audit

**日期**：2026-08-18  
**门禁**：`gate-parallel-M2-2026-08-18.md` · G1=M1 ACCEPT  
**子报告**：`M2-runtime-2026-08-18.md` · `M2-canvas-wire-2026-08-18.md`

## 端到端路径

```text
Canvas Source=Live
  → GET /workspaces → GET /org 快照
  → SSE /events → applyEnsembleEvent
  → POST /runs (four_crew|single_agent)
  → seat.status / edge.packet / bubble.upsert
  → POST bubbles/act → bubble.resolve
```

## 验收

| # | 标准 | 结果 |
|---|------|------|
| A1 | 两 workspace 不串 | pass（种子+隔离测+客户端 reset） |
| A2 | run 后 stage + packet | pass（runtime four_crew 测 + UI Start run） |
| A3 | bubble.act → resolve | pass |
| A4 | ≥2 Group 过滤 | pass（ws_alpha Product/Engineering） |
| A5 | runtime+canvas 测试/构建 | pass |
| A6 | 信封与 phase | pass |
| A7 | 双 lane + 集成报告 | **本文件** |

## 残留风险
- 未做浏览器手工 SSE 长连压测
- `crewai` 全量 pip 安装慢；M2 API 用 lean venv（crewai 仍在 pyproject 声明）
- EventSource 重连 `after=` 客户端未用

## 结论：**ACCEPT**

**下一阶段**：M3 Org persist + single-agent Run + MockRunner。
