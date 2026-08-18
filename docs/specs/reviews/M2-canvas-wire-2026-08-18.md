# M2 Audit — Canvas-wire lane

**日期**：2026-08-18  
**范围**：`apps/canvas/**`（api / liveStore / TopBar / OrgCanvas filter / applyEvent）  
**初判**：ACCEPT_WITH_FIXES → 返工 → **ACCEPT**

## 严重
无。

## 中等（已修）
| 项 | 处置 |
|----|------|
| live bubble 无 runId 时静默本地 resolve | 改为报错，不本地假关 |
| SSE 无 workspace_id 守卫 | 忽略非当前 ws 事件 |
| selectWorkspace 无 try/catch | 错误写入 `error` |
| applyEvent 缺 bubble 单测 | 已补 upsert/resolve |
| TopBar 死 useEffect | 已删 |

## 检查表
| 项 | 结果 |
|----|------|
| Workspace 切换 UI | pass |
| SSE → applyEnsembleEvent | pass |
| mock 仍可用；live 无 setInterval | pass |
| ≥2 Group 过滤（ws_alpha） | pass |
| bubble.act live HTTP | pass |
| 栈锁 | pass |
| typecheck/lint/build/test | **pass（10 tests）** |

## 结论：**ACCEPT**
