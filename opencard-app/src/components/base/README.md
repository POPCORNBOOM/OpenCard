# Base Components

`src/components/base` 是业务层唯一允许直接消费的 UI 组合层。

硬规则：

- 只能组合 `src/shared/ui/primitives`，禁止在 base 里新增独立视觉体系。
- 禁止在业务组件新增原生 `button/input/select/textarea`，必须先评估是否应进入 base/primitives。
- 任何 base 组件新增或改动，都必须先在 UI Kit 登记示例，再进入业务页面。

## Component APIs

### `OcButton`

- props:
  - `variant?: 'primary' | 'secondary' | 'ghost' | 'icon' | 'choice'`
  - `size?: 'sm' | 'md' | 'lg'`
  - `radius?: 'none' | 'sm' | 'md' | 'lg'`
  - `minHeight?: string`
  - `icon?: string`
  - `iconPosition?: 'left' | 'right'`
  - `iconOnly?: boolean`
  - `active?: boolean`
  - `block?: boolean`
  - `disabled?: boolean`
  - `type?: 'button' | 'submit' | 'reset'`
- emits: 无（原生 click 透传）
- 推荐用法:
  - 主操作/次操作统一入口。
  - 图标按钮使用 `variant="icon"` + `iconOnly`。
- 禁用用法:
  - 不要在业务组件直接复写按钮视觉状态类。

### `OcCheckbox`

- props:
  - `checked?: boolean`
  - `disabled?: boolean`
  - `label?: string`
- slots:
  - `default`（可覆盖 `label`）
- emits:
  - `update:checked(value: boolean)`
  - `change(value: boolean, event: Event)`
- 推荐用法:
  - 作为布尔开关的统一 checkbox 入口，保持原生键盘与表单语义。
- 禁用用法:
  - 不要在业务层重复编写自定义勾选框视觉与交互。

### `OcBar`

- props:
  - `as?: string`
  - `kind?: 'top' | 'status' | 'section'`
  - `padding?: string`
  - `gap?: string`
  - `border?: 'none' | 'top' | 'bottom'`
- slots:
  - `start`
  - `default`
  - `end`
- emits: 无
- 推荐用法:
  - 顶栏、状态栏、分节行等壳层条带统一入口。
- 禁用用法:
  - 不要在业务层重复手写顶部/状态条骨架。

### `OcChip`

- props:
  - `tone?: 'default' | 'info'`
  - `size?: 'sm' | 'md'`
  - `truncate?: boolean`
  - `maxWidth?: string`
- slots:
  - `default`
- emits: 无
- 推荐用法:
  - 路径、状态、轻量标签统一胶囊样式。
- 禁用用法:
  - 不要在业务层新写“chip/badge/pill”样式分支。

### `OcEmptyHint`

- props:
  - `tone?: 'dim' | 'muted'`
  - `size?: 'label' | 'body'`
  - `align?: 'start' | 'center'`
  - `padding?: string`
- slots:
  - `default`
- emits: 无
- 推荐用法:
  - 空态提示、占位提示统一文本容器。
- 禁用用法:
  - 不要在业务层重复定义 empty-hint 文本与对齐规则。

### `OcOverlay`

- props:
  - `as?: string`
  - `visible?: boolean`
  - `inset?: string`
  - `interactive?: boolean`
- slots:
  - `default`
  - `overlay`
- emits: 无
- 推荐用法:
  - 在已有内容层上叠加单层工具条、预览窗、信息浮层。
  - 组件默认占满父容器（`100% x 100%`）；需要自然尺寸时应由父容器控制尺寸。
- 禁用用法:
  - 不要把 modal/focus trap/portal/多层 overlay 栈管理塞进 `OcOverlay`。

### `OcTrackLayout`

- props:
  - `as?: string`
  - `axis?: 'horizontal' | 'vertical'`
  - `gap?: string`
  - `fill?: boolean`
  - `interactive?: boolean`
  - `regions: readonly { slot: string; track?: string }[]`
- slots:
  - 动态具名 slot（与 `regions[].slot` 对应）
- emits: 无
- 约束:
  - 布局顺序只由 `regions` 数组顺序决定
  - `track` 默认 `auto`，支持 `*` / `3*` 语法，分别映射为 `minmax(0, 1fr)` / `minmax(0, 3fr)`
  - `track` 也支持原生 CSS 轨道值（如 `280px`、`minmax(220px, 30%)`、`1fr`）
- 推荐用法:
  - IDE 工作区/overlay 的单轴排布，固定栏位使用像素轨道，主工作区使用 `*` 轨道。
- 禁用用法:
  - 不要把拖拽分栏、二维网格、响应式重排策略塞进 `OcTrackLayout`。

## Layout Principles

- `Layout` 型组件只负责区域分配与排布关系，不承载业务视觉语义。
- `OcTrackLayout` 只负责轨道（`track`）和区域间距（`gap`），不提供内边距（padding）策略。
- 兄弟间距离优先由父级 `gap` 管理，组件内部留白由子组件 `padding` 管理。
- 不使用子组件 `margin` 充当主布局手段；`margin` 仅用于个别外部逃逸场景。

### `OcFieldInput`

- props:
  - `as?: 'input' | 'select' | 'textarea'`
  - `inputClass?: string | string[] | Record<string, boolean>`
  - `chromed?: boolean`
  - `fullWidth?: boolean`
  - `monospace?: boolean`
  - `padding?: string`
  - `resize?: 'none' | 'horizontal' | 'vertical' | 'both'`
- emits: 无（原生输入事件透传）
- expose:
  - `focus(): void`
  - `blur(): void`
- 推荐用法:
  - 所有表单字段统一从此入口落地。
- 禁用用法:
  - 不要绕开 `OcFieldInput` 直接写原生输入控件样式。

### `OcMenuItemButton`

- props:
  - `label: string`
  - `icon?: string`
  - `hasChildren?: boolean`
  - `disabled?: boolean`
- emits:
  - `click(event: MouseEvent)`
- 推荐用法:
  - 浮动菜单、上下文菜单、树动作二级菜单项。
- 禁用用法:
  - 不要把业务逻辑塞进该组件内部。

### `OcOptionGroup`

- props:
  - `modelValue: string`
  - `options: readonly { value: string; label: string; shortLabel?: string; icon?: string; disabled?: boolean }[]`
  - `ariaLabel?: string`
  - `columns?: number`
  - `size?: 'sm' | 'md' | 'lg'`
  - `disabled?: boolean`
  - `square?: boolean`
- emits:
  - `update:modelValue(value: string)`
- 可访问性保证:
  - `radiogroup` + `radio` 语义
  - roving tabindex
  - 方向键/Home/End 导航
  - Enter/Space 选择
- 推荐用法:
  - 对齐、模式切换、离散短选项组。
- 禁用用法:
  - 不要把多选语义塞到 `OcOptionGroup`。

### `OcPanelSection`

- props:
  - `title?: string`
  - `header?: boolean`
  - `scrollBody?: boolean`
  - `tone?: 'default' | 'overlay'`
  - `collapsed?: boolean`
  - `headerPadding?: string`
  - `headerMinHeight?: string`
  - `bodyPadding?: string`
  - `fill?: boolean`
  - `headerClass?: string | string[] | Record<string, boolean>`
  - `bodyClass?: string | string[] | Record<string, boolean>`
- slots:
  - `title`
  - `actions`
  - `default`
- emits: 无
- 推荐用法:
  - 侧栏、检查器、编辑器内部子面板统一容器。
- 禁用用法:
  - 不要在业务层再定义第二套 panel header/body 视觉规则。

### `OcPropertyRow`

- props:
  - `label: string`
  - `labelIcon?: string`
- slots:
  - `default`
- emits: 无
- 推荐用法:
  - 属性编辑器的 label-control 行布局。
- 禁用用法:
  - 不要在业务侧随意改 label 列宽策略，需先评估抽象到 base。

### `OcTab`

- props:
  - `label: string`
  - `active?: boolean`
  - `dirty?: boolean`
  - `closable?: boolean`
  - `disabled?: boolean`
  - `title?: string`
  - `closeAriaLabel?: string`
- emits:
  - `select()`
  - `close()`
- 可访问性保证:
  - `role="tab"` + `aria-selected`
  - `Enter/Space` 仅在 tab 自身聚焦时触发选择
  - close action 不会冒泡为 tab 选择
- 推荐用法:
  - IDE 编辑器标签、同层级单选标签项。
- 禁用用法:
  - 不要再在页面内手写 tab root + close icon 组合。

### `OcTabBar`

- props: 无（原生属性透传到根节点）
- emits: 无
- 可访问性保证:
  - `role="tablist"` + `aria-orientation="horizontal"`
  - `Left/Right/Home/End` 自动切换活动 tab
  - 键盘导航会跳过 disabled tab
- 推荐用法:
  - 承载 `OcTab` 列表的单行 IDE 标签条。
- 禁用用法:
  - 不要把多行 tab、拖拽排序、溢出菜单直接塞进 v1 的 `OcTabBar`。

### `OcToolButton`

- props:
  - `label?: string`
  - `icon?: string`
  - `iconOnly?: boolean`
  - `active?: boolean`
  - `disabled?: boolean`
  - `title?: string`
  - `ariaLabel?: string`
  - `kind?: 'menu' | 'sidebar' | 'panel'`
  - `width?: string`
  - `minWidth?: string`
  - `height?: string`
  - `minHeight?: string`
- emits:
  - `click(event: MouseEvent)`
- 可访问性保证:
  - icon-only 模式支持 `ariaLabel` / `label` 回退
  - active/disabled 视觉态统一收口
- 推荐用法:
  - 顶栏文本工具按钮、活动栏图标按钮、面板头部小工具按钮。
- 禁用用法:
  - 不要再在页面内手写 menu-link / activity-icon / panel-icon-button 三套样式。

### `OcToolbar`

- props:
  - `kind?: 'menu' | 'sidebar' | 'panel'`
  - `orientation?: 'horizontal' | 'vertical'`
  - `ariaLabel?: string`
  - `align?: 'start' | 'center' | 'end' | 'stretch'`
  - `justify?: 'start' | 'center' | 'end' | 'between'`
  - `gap?: string`
  - `padding?: string`
  - `grow?: boolean`
  - `shrink?: boolean`
  - `fill?: boolean`
- emits: 无
- 可访问性保证:
  - `role="toolbar"` + `aria-orientation`
- 推荐用法:
  - 承载同一层级的工具按钮集合。
- 禁用用法:
  - 不要把复杂布局骨架或非工具内容塞进 `OcToolbar`。

### `OcSidebarFrame`

- props:
  - `activityWidth?: string`
  - `panelWidth?: string`
  - `panelVisible?: boolean`
- slots:
  - `activity`
  - `panel`
- emits: 无
- 推荐用法:
  - IDE 左侧活动栏 + 面板组合外壳。
- 禁用用法:
  - 不要在业务层再手写同构 sidebar frame 结构。

## UI Kit Registration Workflow

新增/改动 base 组件时，按以下顺序执行：

1. 在 `src/views/ui-kit/catalog.ts` 登记组件条目（`title/purpose/demoBlocks/stateCoverage`）。
2. 在 `src/components/ui-kit/ShowcaseExampleRenderer.vue` 增加对应 `exampleId` 的四列示例渲染。
3. 运行 `npm run lint:ui && npm test && npm run build`。
4. 仅当 UI Kit 与自动化都通过，才允许继续业务页面联调。
