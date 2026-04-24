# OcUI 可用清单（Agent 版）

适用范围：
- 业务页面优先使用 `src/components/base`（Base 层）。
- `src/shared/ui/primitives` 主要用于封装 Base，业务侧谨慎直用。

导入参考：
- Base：`import { OcButton, ... } from '@/components/base'`
- Primitives：`import { OcBox, ... } from '@/shared/ui/primitives'`

## Base OcUI（业务可直接使用）

### OcButton
- 功能简介：统一按钮入口（主按钮/次按钮/图标按钮/选择按钮）。
- 输入：`variant(primary|secondary|ghost|icon|choice)`、`size(sm|md|lg)`、`density(compact|comfortable|spacious)`、`radius(none|sm|md|lg)`、`icon`、`iconPosition(left|right)`、`iconOnly`、`active`、`block`、`disabled`、`type(button|submit|reset)`，`default` slot。
- 输出：无自定义 emits；可直接监听原生 `click`。
- 超小场景+示例：主操作按钮。`<OcButton variant="primary" icon="icon.save" @click="saveCard">保存</OcButton>`

### OcCheckbox
- 功能简介：统一布尔选项勾选框。
- 输入：`checked`、`disabled`、`label`，`default` slot（可覆盖 label）。
- 输出：`update:checked(value: boolean)`、`change(value: boolean, event: Event)`。
- 超小场景+示例：属性开关。`<OcCheckbox :checked="enabled" @update:checked="enabled = $event">启用</OcCheckbox>`

### OcBar
- 功能简介：顶部栏/状态栏/分节条带容器。
- 输入：`as`、`kind(top|status|section)`、`spacing(compact|default|spacious)`、`inset(none|compact|default|spacious)`、`border(none|top|bottom)`，`start/default/end` slots。
- 输出：无自定义 emits。
- 超小场景+示例：面板标题栏。`<OcBar kind="section" border="bottom"><OcText size="label">Section</OcText></OcBar>`

### OcChip
- 功能简介：轻量标签/状态胶囊。
- 输入：`tone(default|info)`、`size(sm|md)`、`truncate`、`maxWidth(none|sm|md|lg|full)`、`icon`、`iconTone`，`icon/default` slots。
- 输出：无自定义 emits。
- 超小场景+示例：同步状态标签。`<OcChip tone="info" icon="icon.check">Synced</OcChip>`

### OcEmptyHint
- 功能简介：空态/占位提示文本容器。
- 输入：`tone(dim|muted)`、`size(label|body)`、`align(start|center)`、`inset(none|compact|comfortable)`，`default` slot。
- 输出：无自定义 emits。
- 超小场景+示例：空列表提示。`<OcEmptyHint tone="muted">暂无数据</OcEmptyHint>`

### OcOverlay
- 功能简介：在已有内容上叠加单层 overlay。
- 输入：`as`、`visible`、`inset(none|compact|default|workspace|自定义CSS字符串)`、`interactive`，`default/overlay` slots。
- 输出：无自定义 emits。
- 超小场景+示例：画布上悬浮工具条。`<OcOverlay><Canvas /><template #overlay><OcFloatingPanelShell>Tools</OcFloatingPanelShell></template></OcOverlay>`

### OcAxisLayout
- 功能简介：单轴语义化区域布局（横向/纵向）。
- 输入：`as`、`axis(horizontal|vertical)`、`spacing(none|tight|normal|loose)`、`fill`、`interactive`、`regions[{ slot, track? }]`；`track` 支持 `auto|fill|fill-2|fill-3|size-xs..size-2xl|sidebar|panel|inspector`。
- 输出：无自定义 emits。
- 超小场景+示例：IDE 三栏。`<OcAxisLayout axis="horizontal" :regions="[{slot:'left',track:'sidebar'},{slot:'main',track:'fill'},{slot:'right',track:'inspector'}]" />`

### OcColorField
- 功能简介：颜色编辑控件（预览 + CSS 文本 + color picker）。
- 输入：`modelValue`、`preview`、`picker`、`cssInput`、`disabled`、`readonly`、`pickerAriaLabel`。
- 输出：`update:modelValue(value: string)`。
- 超小场景+示例：颜色属性行。`<OcColorField v-model="fillColor" />`

### OcFieldInput
- 功能简介：业务层统一字段输入壳（封装 OcFieldCore）。
- 输入：`as(input|select|textarea)`、`variant(chromed|plain)`、`fullWidth`、`monospace`、`size(sm|md|lg)`、`density(compact|comfortable|spacious)`、`resize(none|horizontal|vertical|both)`，`default` slot（如 select option）。
- 输出：无自定义 emits；通过 `ref` 暴露 `focus()`/`blur()`。
- 超小场景+示例：基础输入框。`<OcFieldInput as="input" v-model="title" />`

### OcMenuItemButton
- 功能简介：菜单项按钮（支持左图标和右侧子菜单箭头）。
- 输入：`label`、`icon`、`hasChildren`、`disabled`。
- 输出：`click(event: MouseEvent)`。
- 超小场景+示例：上下文菜单项。`<OcMenuItemButton label="重命名" icon="icon.edit" @click="rename" />`

### OcOptionGroup
- 功能简介：单选分段按钮组（radiogroup）。
- 输入：`modelValue`、`options[{ value,label,shortLabel?,icon?,disabled? }]`、`ariaLabel`、`columns`、`size(sm|md|lg)`、`disabled`、`square`，`option` slot。
- 输出：`update:modelValue(value: string)`。
- 超小场景+示例：对齐选择。`<OcOptionGroup v-model="align" :options="alignOptions" />`

### OcPanelSection
- 功能简介：带可选标题栏和可滚动 body 的面板区块。
- 输入：`title`、`header`、`scrollBody`、`tone(default|overlay)`、`collapsed`、`headerDensity(compact|default|comfortable)`、`headerInset(default|comfortable)`、`bodyInset(none|compact|comfortable)`、`fill`、`headerClass`、`bodyClass`，`title/actions/default` slots。
- 输出：无自定义 emits。
- 超小场景+示例：检查器分组。`<OcPanelSection title="Transform" scrollBody><TransformPanel /></OcPanelSection>`

### OcPropertyRow
- 功能简介：属性编辑器的 label-control 行结构。
- 输入：`label`、`labelIcon`，`default` slot（控件区域）。
- 输出：无自定义 emits。
- 超小场景+示例：属性名 + 输入框。`<OcPropertyRow label="宽度"><OcFieldInput as="input" /></OcPropertyRow>`

### OcTab
- 功能简介：单个可选/可关闭标签页。
- 输入：`label`、`active`、`dirty`、`closable`、`disabled`、`title`、`closeAriaLabel`。
- 输出：`select()`、`close()`。
- 超小场景+示例：文件标签。`<OcTab label="main.ts" :active="true" :dirty="true" @close="closeFile" />`

### OcTabBar
- 功能简介：标签条容器（支持方向键/Home/End 导航）。
- 输入：默认 slot（放置多个 `OcTab`）。
- 输出：无自定义 emits（内部触发目标 tab 的 `click`/focus 流程）。
- 超小场景+示例：编辑器标签栏。`<OcTabBar><OcTab label="A" /><OcTab label="B" /></OcTabBar>`

### OcToolButton
- 功能简介：工具栏按钮（菜单/侧栏/面板三种语义）。
- 输入：`label`、`icon`、`iconTone`、`iconOnly`、`active`、`disabled`、`title`、`ariaLabel`、`kind(menu|sidebar|panel)`、`size(sm|md|lg)`、`block`，`default` slot。
- 输出：`click(event: MouseEvent)`。
- 超小场景+示例：侧栏图标按钮。`<OcToolButton kind="sidebar" iconOnly icon="icon.files" aria-label="Files" @click="openFiles" />`

### OcToolbar
- 功能简介：工具按钮集合容器（带方向、对齐、间距语义）。
- 输入：`kind(menu|sidebar|panel)`、`orientation(horizontal|vertical)`、`ariaLabel`、`align(start|center|end|stretch)`、`justify(start|center|end|between)`、`spacing(none|tight|normal|loose)`、`inset(none|compact|comfortable)`、`grow`、`shrink`、`fill`，`default` slot。
- 输出：无自定义 emits。
- 超小场景+示例：面板头工具条。`<OcToolbar kind="panel"><OcToolButton iconOnly icon="icon.search" /></OcToolbar>`

### OcResizer
- 功能简介：分栏拖拽分隔条。
- 输入：`orientation(horizontal|vertical)`、`active`、`ariaLabel`、`variant(line|edge)`、`dock(left|right|top|bottom)`、`dockOffset`。
- 输出：`mousedown(event: MouseEvent)`。
- 超小场景+示例：水平分栏拖拽柄。`<OcResizer orientation="vertical" @mousedown="startResize" />`

### OcSplitPane
- 功能简介：双栏/上下分栏布局外壳。
- 输入：`orientation(horizontal|vertical)`、`fixedPane(primary|secondary)`、`fixedSize(sm|md|lg|workspace|CSS长度)`、`primaryMinSize(sm|md|lg|workspace|CSS长度)`、`secondaryMinSize(sm|md|lg|workspace|CSS长度)`、`clip`、`radius(none|sm|md|lg)`，`primary/resizer/secondary` slots。
- 输出：无自定义 emits。
- 超小场景+示例：画布 + 检查器。`<OcSplitPane orientation="horizontal" fixedPane="secondary"><template #primary><Canvas /></template><template #resizer><OcResizer /></template><template #secondary><Inspector /></template></OcSplitPane>`

### OcFloatingPanelShell
- 功能简介：悬浮面板外壳（透明表面 + 边框 + 阴影 + 模糊）。
- 输入：`as`、`padding(none|sm|md)`、`radius(sm|md|lg)`、`shadow(sm|md|overlay)`、`blurred`、`width(auto|content|full|screen|panel)`、`height(auto|content|full|screen|panel)`、`inset(none|compact|default|spacious|overlay)`、`pointer(auto|none)`，`default` slot。
- 输出：无自定义 emits。
- 超小场景+示例：浮动检查面板。`<OcFloatingPanelShell padding="sm" width="panel"><InspectorMini /></OcFloatingPanelShell>`

### OcSidebarFrame
- 功能简介：IDE 左侧活动栏 + 面板双区外壳。
- 输入：`activitySize(compact|default|spacious)`、`panelSize(compact|default|spacious)`、`panelVisible`，`activity/panel` slots。
- 输出：无自定义 emits。
- 超小场景+示例：文件活动栏 + 目录面板。`<OcSidebarFrame><template #activity><ActivityBar /></template><template #panel><Explorer /></template></OcSidebarFrame>`

## Primitives OcUI（用于封装 Base 或低层结构）

### OcBox
- 功能简介：基础布局盒模型（inline/stack/fill/grow/定位/尺寸/对齐）。
- 输入：`as`、`inline`、`stack`、`center`、`grow`、`scrollY`、`fill`、`relative`、`absolute`、`inset(none|cover|origin)`、`width(auto|content|full|screen)`、`height(auto|content|full|screen)`、`pointer(auto|none)`、`align(start|center|end|stretch)`、`justify(start|center|end|between)`、`overflow(visible|hidden|auto)`，`default` slot。
- 输出：无自定义 emits。
- 超小场景+示例：垂直容器。`<OcBox stack fill><Header /><Body /></OcBox>`

### OcText
- 功能简介：统一文字语义和字号。
- 输入：`as`、`tone(primary|secondary|muted|label|info)`、`size(label|body|title)`、`truncate`，`default` slot。
- 输出：无自定义 emits。
- 超小场景+示例：次要说明文本。`<OcText tone="secondary" size="body">Inspector ready</OcText>`

### OcSurface
- 功能简介：统一背景/边框/圆角/阴影表面。
- 输入：`as`、`variant(panel|elevated|input|floating|transparent)`、`radius(none|sm|md|lg)`、`shadow(none|sm|md|overlay)`、`bordered`、`fill`、`pattern(none|dot-grid|checker-preview)`，`default` slot。
- 输出：无自定义 emits。
- 超小场景+示例：带边框面板。`<OcSurface variant="panel" bordered radius="md"><slot /></OcSurface>`

### OcPressable
- 功能简介：低层可点击控件原语（含 a11y 角色与键盘行为）。
- 输入：`as`、`variant(primary|secondary|ghost|icon|choice)`、`size(sm|md|lg)`、`density(compact|comfortable|spacious)`、`radius(none|sm|md|lg)`、`active`、`block`、`disabled`、`iconOnly`、`type(button|submit|reset)`，`default` slot。
- 输出：无自定义 emits；透传原生 `click` 等事件。
- 超小场景+示例：低层交互按钮。`<OcPressable variant="choice" :active="selected">A</OcPressable>`

### OcFocusRing
- 功能简介：`focus-within` 可视化外壳。
- 输入：`as`，`default` slot。
- 输出：无自定义 emits。
- 超小场景+示例：输入焦点环。`<OcFocusRing><OcFieldCore as="input" /></OcFocusRing>`

### OcFieldCore
- 功能简介：低层字段输入内核（input/select/textarea 统一样式能力）。
- 输入：`as(input|select|textarea)`、`variant(chromed|plain)`、`fullWidth`、`monospace`、`size(sm|md|lg)`、`density(compact|comfortable|spacious)`、`resize(none|horizontal|vertical|both)`，`default` slot。
- 输出：无自定义 emits；透传原生输入事件。
- 超小场景+示例：多行文本内核。`<OcFieldCore as="textarea" resize="vertical" />`

### OcScrollArea
- 功能简介：滚动区域语义包装。
- 输入：`as`、`axis(x|y|both)`，`default` slot。
- 输出：无自定义 emits。
- 超小场景+示例：纵向滚动列表。`<OcScrollArea axis="y"><ItemList /></OcScrollArea>`

### OcIcon
- 功能简介：统一图标渲染（codicon + mdi）与语义色。
- 输入：`name(来自 iconRegistry 语义 key 或自定义定义)`、`tone(default|muted|primary|success|warning|danger|文件/文件夹语义色)`、`size(sm|md|lg)`。
- 输出：无自定义 emits。
- 超小场景+示例：文件图标。`<OcIcon name="icon.file-code" tone="typescript" />`

## 给 Agent 的最小决策规则

1. 能用 Base 就不用 Primitives（业务代码优先稳定契约）。
2. 要做“容器布局”先看 `OcAxisLayout` / `OcSplitPane` / `OcSidebarFrame`。
3. 要做“交互动作”先看 `OcButton` / `OcToolButton` / `OcMenuItemButton`。
4. 要做“表单字段”先看 `OcFieldInput` / `OcColorField` / `OcCheckbox` / `OcOptionGroup`。
5. 要做“信息承载”先看 `OcPanelSection` / `OcBar` / `OcChip` / `OcEmptyHint` / `OcOverlay`。
