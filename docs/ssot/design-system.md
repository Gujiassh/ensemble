# Design System SSoT

**状态**：V2 已确认，待实现（2026-08-18）  
**配合**：[../08-design-language.md](../08-design-language.md) · [i18n.md](i18n.md) · [platform-adaptation.md](platform-adaptation.md)

## 1. 目标

Ensemble 的视觉系统必须支持主题变化、密度变化、系统偏好和平台差异，同时保持业务语义稳定。

设计系统不是一组固定颜色，而是一份可验证的语义协议：

```text
Primitive tokens → Semantic tokens → Component tokens
```

业务组件禁止直接依赖具体色值、平台名称或主题名称。

---

## 2. 配置轴

以下配置互相独立：

| 配置 | 值 |
|------|----|
| Theme | `light`, `dark`, `system`, 自定义 theme id |
| Density | `comfortable`, `compact` |
| Motion | `full`, `reduced`, `system` |
| Contrast | `normal`, `high`, `system` |
| Locale | 见 `i18n.md`，不得与主题耦合 |
| Platform | 由壳层提供，只影响平台适配 |

配置优先级：

```text
可访问性强制设置 > 用户设备偏好 > 系统偏好 > 产品默认
```

Theme、Density、Motion 和 Locale 属于设备偏好，不写入 Workspace 业务数据。

---

## 3. Token 分层

### 3.1 Primitive tokens

仅供主题定义使用：

```text
color.neutral.0
color.neutral.50
color.neutral.900
color.red.500
space.1
space.2
radius.1
duration.fast
```

组件不得直接引用 Primitive token。

### 3.2 Semantic tokens

组件默认只引用这一层：

```css
--color-app-background;
--color-canvas-background;
--color-navigation-background;
--color-surface;
--color-surface-raised;
--color-text-primary;
--color-text-secondary;
--color-text-inverse;
--color-border-subtle;
--color-border-strong;
--color-action-primary;
--color-action-primary-hover;
--color-focus;
--color-selection;
--color-status-active;
--color-status-waiting;
--color-status-danger;
--color-status-success;
--color-status-neutral;
```

### 3.3 Component tokens

只有跨多个组件实例且确有必要时才增加：

```css
--seat-size;
--seat-avatar-size;
--inspector-width;
--navigation-rail-width;
--handoff-duration;
```

禁止为单个局部样式创建大批 Component token。

---

## 4. 默认主题

默认主题为浅色。下列色值是默认主题实现参考，不是业务组件常量。

| 语义 | 参考值 |
|------|--------|
| App background | `#ECEFF1` |
| Canvas background | `#F7F8F9` |
| Surface | `#FFFFFF` |
| Navigation background | `#1A1D21` |
| Primary text | `#17191C` |
| Secondary text | `#676E76` |
| Subtle border | `#D9DEE3` |
| Primary action / user attention | `#E94B35` |
| Active system work | `#2F6FDB` |
| Waiting | `#B97816` |
| Danger | `#C33F39` |
| Success | `#287658` |

规则：

- 主信号默认使用朱红，但自定义主题可替换其色值
- `danger` 与 `action-primary` 必须在结构和图标上可区分
- 状态色不能被主题映射成相互混淆的颜色
- 大面积背景保持低饱和，主信号只出现在关键位置
- Dark theme 不是简单反转色值，必须重新验证层级和对比度

---

## 5. 自定义主题协议

主题以稳定 JSON 结构描述：

```json
{
  "schemaVersion": 1,
  "id": "example-theme",
  "name": "Example theme",
  "mode": "light",
  "tokens": {
    "color.canvas.background": "#F7F8F9",
    "color.text.primary": "#17191C",
    "color.action.primary": "#E94B35"
  }
}
```

加载前必须验证：

- schema version
- 必填 Semantic token
- 色值格式
- 文本和控件对比度
- Focus 可见性
- 状态色之间的可辨认性

首版交付内置浅色、深色和跟随系统。自定义主题文件导入可以后置，但 Token 协议必须从首版稳定。

---

## 6. 尺寸与密度

基础间距使用 `4px` 倍数：

```text
4, 8, 12, 16, 20, 24, 32, 40
```

圆角：

```text
4px: 小控件
6px: 输入框、菜单项、普通按钮
8px: 浮层、对话框、重复内容项
```

禁止：

- 页面区块使用大圆角浮动卡片
- 普通文本标签全部胶囊化
- 三层以上边框、圆角和阴影嵌套

密度变化只调整间距、行高和列表高度，不改变信息架构和操作位置。

---

## 7. 字体

字体必须通过 Token 定义：

```css
--font-ui;
--font-mono;
--font-weight-regular;
--font-weight-medium;
--font-weight-semibold;
```

要求：

- UI 字体覆盖拉丁字符和中日韩回退
- 数字、路径和技术 ID 在各平台保持清晰
- 最多使用一套 UI 字体和一套等宽字体
- 不依赖系统默认字体获得品牌效果
- 字号使用固定层级，不用 viewport width 连续缩放

建议字号层级：`12`, `13`, `14`, `16`, `20`, `24px`。

---

## 8. 控件规则

- 主操作每个上下文最多一个
- 图标按钮优先使用 Lucide，并提供 Tooltip 和可访问名称
- 二元设置使用 Toggle 或 Checkbox
- 模式选择使用 Segmented control
- 互斥视图使用 Tabs
- 多选项使用 Menu 或 Select
- 数值使用 Input、Stepper 或 Slider
- 危险操作不与主操作共享颜色和位置
- Disabled、Loading、Pressed、Selected、Focus 状态必须完整

卡片仅用于：

- 独立、可重复、可选择的内容项
- 模态内容
- 本身就是交互对象的工具区域

---

## 9. 动效 Token

```css
--duration-instant: 100ms;
--duration-fast: 180ms;
--duration-layout: 260ms;
--duration-handoff: 520ms;
--ease-standard: cubic-bezier(.2, .8, .2, 1);
--ease-exit: cubic-bezier(.4, 0, 1, 1);
```

减少动态模式：

- 所有位移动画改为不超过 `100ms` 的透明度或颜色变化
- Handoff 不沿路径移动
- 不影响加载、状态更新和操作反馈

---

## 10. 实现约束

- Theme 通过根节点属性和 CSS Variables 注入
- 业务组件禁止判断 `theme === "dark"`
- 平台差异通过壳层能力和根属性处理，不散落在组件中
- 所有新增视觉值先判断是否属于现有 Token
- 主题切换不得重新创建业务 Store 或丢失画布状态
- 用户偏好写入平台应用配置目录
- Workspace 和 Run 数据不保存 Theme、Density 或 UI Locale

---

## 11. 验收

- 浅色、深色和系统主题截图检查
- 普通与紧凑密度不改变操作层级
- WCAG AA 对比度自动检查
- 键盘 Focus 全流程可见
- `prefers-reduced-motion` 生效
- `forced-colors` 下主要操作和状态可辨认
- 自定义主题缺失必填 Token 时拒绝加载并指出具体字段
