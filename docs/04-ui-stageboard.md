# [归档] 旧 UI 草案：三栏 Stageboard

> **状态：已归档（2026-08-18）**  
> **现行真源**：[08-design-language.md](08-design-language.md)（Living Org Canvas）  
> **实现禁止**以本文布局/名词作为产品规格。  
> 本文仅保留「早期想法 → 现行语言」映射，避免后人误读仓库历史。

---

## 为何归档

早期方案是「角色台 | Flow 中心 | 交付物墙 + 底栏 Gate」。  
已拍板升级为 **头像组织画布 + 管道信包 + 节点冒泡 + 点开 Dossier**，并支持无限套娃 / 单 agent / 多 Workspace / 多 Group。

见决策：D003a、D008、D009、D011。

---

## 旧概念 → 现行映射

| 旧口径（本文历史） | 现行口径（08/03/09） |
|--------------------|----------------------|
| Stageboard 产品门面 | **Living Org Canvas** |
| 左栏角色台 | 画布上的 **Seat 头像节点**（侧栏编制树可选、可折叠） |
| 中栏 Flow 舞台 | 画布 **Edge + Packet 光效**（产物流） |
| 中栏 Timeline 主视图 | **Dossier History** 或 Debug 模式，非主叙事 |
| 右栏交付物墙常驻 | **Dossier Outputs** + 信包点击预览 |
| 底栏 Gate | **Bubble(kind=approve)** 为主；全局待办托盘为辅 |
| 固定四人在场 | **单 agent 一等**；四人为推荐模板 |
| 扁平角色列表 | **Org tree 无限套娃** + Group |
| `waiting_human`（旧唯一词） | 内部 `waiting_human`；文案 **waiting_you**；另有 `waiting_peer` |
| 舞台模式 / 调试模式 | **Stage / Work / Debug** |
| React Flow 提示 | 已锁定 **@xyflow/react**；节点形态 Seat/Group 头像（见 09） |
---

## 仍有效的设计意图（已并入 08）

这些意图没有废弃，只是换了载体：

1. 好看、状态一眼懂  
2. 交付物流转可见  
3. 人可审批 / 打回 / 扩编  
4. 调试可下钻但不污染默认面  
5. 状态色：灰/紫/蓝/青/琥珀/红/绿  

请到 **08** 阅读完整规格，到 **10-events-schema** 看事件驱动。

---

## 旧线框（仅考古）

```text
[已废弃主布局]
Topbar
| 角色台 | Flow/Timeline | 交付物墙 |
Gate bar
```

**现行主布局**见 08 §4：Workspace 切换 + Living Org Canvas 全画布 + 点开 Dossier + 冒泡/托盘。  
