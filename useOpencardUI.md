# OpenCard UI 使用约定（当前阶段）

## 核心思想

当前 UI 重构方向可称为：**声明式语义组件体系**，也可以理解为 **schema-driven UI + semantic preset API**。

一句话总结：调用者不应该关心底层组件怎么用 `OcPanel` 画出来，而应该用声明式数据和少量语义选项表达“我要什么 UI 意图”；组件内部负责把这些意图映射成稳定结构、视觉、交互和事件协议。

另一种更贴近实现的描述：OpenCard 的基础控件是 **props 驱动的有限原子覆写器**。它们像原子 class 一样覆盖布局、表面、文字、滚动、标签语义，但不直接暴露自由 class，而是把每个可调项收束成有限枚举题。

## 总原则

- 上层控件不得直接透传 `attrs/class/style` 给 `OcPanel`。
- 上层控件不得继承或展开 `ocPanelProps`。
- 上层控件不允许提供丰富的自带 `class` 作为样式控制入口。
- 上层控件不应持有大量只为调样式存在的 scoped class。
- Agent 或开发者一旦想写 class 修 UI，第一反应应该是：底层基础控件的 `prop -> class` 能力是否不够丰富。
- 如果样式需求是通用的，应补基础控件 prop；如果是某个语义组件的常见状态，应补该组件的语义 prop。
- 不该给 UI 调用者看到的底层视觉参数不要暴露出来。
- 如果调用者需要传 `class/style/tone/border/radius/elevation/padding/overflow` 才能完成常规界面，说明基础组件 API 还不够丰富。
- 每个组件应该根据自己的使用场景提炼语义，而不是所有组件都强行统一成 `variant + level`。
- `variant + level` 适合 `OcCard` 这类表面容器，但不应机械推广到所有控件。
- 组件 API 应该从当前界面中反复出现的组合提炼出来：常见组合、未来值得保留的组合，应该变成更少、更表层的 prop。
- 组件内部可以使用 `OcPanel`，但外层业务代码不应该反复越级调整 `OcPanel`。
- 业务界面优先组合语义组件，少直接写原生 HTML 和零散 class。
- Playground 可以暴露底层实验能力，但业务界面不以 Playground 的自由度为标准。

## 分层模型

- 底层基础控件：允许拥有较丰富的有限 props，用于把 HTML 标签能力、布局能力、视觉 token 能力变成可枚举选择。
- 上层语义控件：只暴露业务可理解的状态和结构，不暴露底层绘制细节。
- 业务界面：只组合语义控件和声明式数据，避免直接写样式 class。
- `as` / `is` 这类能力属于底层基础控件，用来控制最终渲染成 `div/span/section/header/button` 等 HTML 标签。
- 上层语义控件不应把 `as/is` 当成常规开放项，除非这个标签选择本身就是组件语义的一部分。

## 基础控件范围

基础控件是 UI 系统的“有限原子覆写器”，可以承担较多 props，但每个 prop 必须是有限、命名清楚、可审查的选择。

- `OcPanel`
  - 作为布局、表面、滚动、尺寸、定位的基础容器。
  - 可以使用 `as` 控制根标签。
  - 可以有较多有限枚举 props。
  - 不代表业务界面可以直接滥用它。
- `OcText`
  - 作为文字、标签语义、字体尺寸、色调、省略策略的基础控件。
  - 可以使用 `as` 控制 `span/p/h1` 等文本标签。
  - 上层需要标题时优先使用 `OcText`，不要新增无意义 wrapper。
- `OcIcon`
  - 作为图标 token 渲染基础控件。
  - 业务层只传语义 icon token。
- `OcButton`
  - 作为按钮语义与按压状态的基础控件。
  - 应收紧为有限 `variant/size/state/icon`，不要靠 class 调按钮。
- `OcFieldInput`
  - 作为表单输入基础控件。
  - 负责输入控件共同的盒模型、字体、边框、focus。
- `OcCheckbox`
  - 作为布尔输入基础控件。
- `OcChip`
  - 作为轻量状态标签基础控件。
- `OcOverlay`
  - 作为叠层基础布局控件。
- `OcTrackLayout`
  - 作为声明式轨道布局基础控件。
  - 使用 `regions` 描述布局，不用 class 手写网格。

## 应提升为基础控件或基础协议的能力

- `OcActionGroup`
  - 应作为声明式动作组基础控件或 `OcToolbar` 的核心协议。
  - 输入 `{ key, icon, title?, label?, disabled?, active? }[]`。
  - 输出 `action` 事件，由外部按 key 处理。
- `OcScrollRegion`
  - 如果透明填充滚动容器反复出现，应作为基础布局控件或 `OcPanel` 的明确 preset。
  - 用来替代业务层重复写透明 `OcPanel + overflow`。
- `OcSurfacePreset`
  - 可以作为非 Vue 映射表，集中维护表面语义到 token 的映射。
  - 供 `OcCard/OcBar/OcTab` 等内部使用。
- `OcWorkbenchRegion`
  - 如果 MainIDE/CDE 的全屏填充区域反复出现，可作为基础布局控件。
  - 负责 fill/grow/min-height/overflow 的稳定组合。

## 不应该作为新基础控件的东西

- 不新增只为了包标题和内容的 `OcSection`。
- 属性编辑器里普通分组优先使用 `OcText` 标题加子 `OcCard` 或已有语义控件。
- 不新增只是某处 class 名字替换的 wrapper。
- 不把一次性业务布局抽成基础控件。

## 声明式数据优先

- 对结构固定、行为可枚举的 UI，优先使用数据数组驱动，而不是让调用方手写一堆按钮或子节点。
- 示例思想：
  - `OcTree` 使用 `TreeItem[]` 描述树。
  - `OcTrackLayout` 使用 `RegionItem[]` 描述轨道。
  - 通用动作工具条应可使用 `{ key, icon, title?, disabled?, active? }[]` 描述按钮组。
- 声明式动作组件应统一 emit 语义事件，例如 `action`，payload 至少包含 `key`。
- 外部程序只负责处理“哪个 action 被触发”，不负责关心按钮如何排列、尺寸如何统一、hover 如何显示。
- 如果一组按钮经常作为组合出现，应提炼为 action schema，而不是反复写多个 `OcButton`。

## 容器组件

- `OcCard` 应收敛为表面容器，不再暴露 `OcPanel` 的底层视觉与布局 props。
- `OcCard` 适合保留：
  - `variant`
  - `level`
  - `title`
  - `collapsed`
  - `append`
  - `append-hover`
  - `content`
- `OcCard` 不应保留：
  - `tone`
  - `border`
  - `radius`
  - `elevation`
  - `padding`
  - `density`
  - `fill`
  - `grow`
  - `overflowX`
  - `overflowY`
  - `class/style/attrs` 透传
- CDE 里的悬浮板这类重复组合应写成类似 `variant="glass" level="1"` 的表层语义。
- 不需要新增 `OcSection` 来替代属性编辑器里的普通分组；那类结构优先用 `OcText` 做标题，后面直接套子 `OcCard` 或已有语义组件。

## 工具条与动作组

- 工具条不应只是 slot 容器，也应支持声明式 actions。
- 建议的动作项模型：
  - `key: string`
  - `icon?: IconToken`
  - `title?: string`
  - `label?: string`
  - `disabled?: boolean`
  - `active?: boolean`
- 工具条自身可以暴露少量语义 props 控制外包装与内部按钮统一样貌，例如：
  - `kind`
  - `size`
  - `density`
  - `buttonVariant`
  - `orientation`
- 工具条不应要求调用方给每个按钮写 class 来修间距、尺寸、hover 或 active。
- 如果工具条里的按钮样貌需要统一变化，应通过工具条 prop 一次性控制。
- 工具条触发动作时统一 emit `action`，外部按 `key` 处理业务逻辑。
- 常见工具条场景应收敛为 preset，例如：
  - `menu`
  - `sidebar`
  - `panel`
  - `inline`
- `OcToolButton` 与 `OcButton` 的边界需要重新评估；如果只是固定工具按钮样式，应合并为 `OcButton` 的工具模式或变成内部 preset。

## 行、列表、树、标签

- `OcList` 只负责扁平列表，不支持 children；层级是 `OcTree` 的职责。
- `OcTree` 继续使用数据驱动和 `features` 驱动能力，例如选择、展开、重命名、拖拽、动作。
- `OcTree` 内部可以用固定行结构，但不要要求调用方传底层 Panel 参数调节点行。
- `OcTree` 的节点行缩进、hover、selected、actions 显示都属于树内部状态，不应让调用方写 class 修。
- `OcTab` 应继续使用结构化 `tabs` 数据，不让调用方手写 tab 行模板。
- `OcTab` 的 dirty、close、icon、disabled 都应该是 tab item 数据字段，而不是外层 class 控制。
- `OcBar` 应作为通用行结构，但不应透传 `OcPanel`；它应根据 `kind/size/density` 生成固定结构。
- `OcBar` 不应成为自由 class 的替身；常见行态应沉淀为 `kind/size/density/state`。

## 布局组件

- `OcTrackLayout` 的 `regions` 声明式协议是正确方向，应保留并强化。
- `OcTrackLayout` 不应透传 attrs 到根节点。
- 布局组件可以暴露布局语义，例如 `axis/regions/fill/gap/resizable`，但不应暴露表面视觉语义。
- 常见透明填充滚动容器如果反复出现，应新增更准确的布局语义，而不是让业务层反复写 `OcPanel tone="transparent" border="none" padding="none" overflow-y="auto"`。

## 审批判断

- 当一个 prop 只是 CSS 能力的包装，默认不应暴露给上层业务控件。
- 当一个 prop 对应稳定、反复出现、业务能理解的 UI 意图，应该保留或新增。
- 当多个子控件经常以固定组合出现，应考虑数据 schema 化。
- 当一个组件因为“不够丰富”迫使调用方用 class 修补，应优先扩展组件语义，而不是放开穿透。
- 当 agent 想新增 scoped class 调整基础 UI 时，应先判断：
  - 这是一次性业务定位，还是通用控件能力？
  - 是否应该给 `OcPanel/OcText/OcButton/OcBar/OcToolbar/OcTrackLayout` 增加有限 prop？
  - 是否应该把重复组合改成声明式数据输入？
- 上层语义组件如果必须有 class，也应只用于内部结构命名，不作为外部 API。
- 重构时允许激进删除兼容层，但每次应小步迁移、验证主路径可编译。
