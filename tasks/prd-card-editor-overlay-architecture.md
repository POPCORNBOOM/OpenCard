# PRD：CardEditor Overlay 布局架构重构

## 1. 概述

重构 CardEditor 设计视图中的左右玻璃侧栏、上下分栏、resize handle、右侧工具列与 viewport 安全区。用户可见效果与现有桌面布局保持一致，但删除当前由 Grid 占位、可见宽度、真实宽度、动态 edge inset、transform、DOM 直写和延迟吸附共同组成的补丁式布局。

本项目以 CardEditor 为首个消费者，建立足够窄的共享基础组件，使图标注册表和自定义块注册表后续能够消费相同的玻璃浮层、resize 和安全区契约；本次不强制同步迁移两个注册表。

已确认的产品决策：

- 保留侧栏横向拖拽至折叠、从折叠态拖拽展开的能力。
- CardEditor 是本次交付主体，同时产出注册表可复用的标准 resize 基础组件。
- 左右侧栏宽度只属于当前 CardEditor 会话；关闭编辑器后恢复默认值，不写入文档、项目、全局设置或持久化 session schema。
- 生产代码必须净减少至少 250 行，并完全删除旧布局机制，不保留兼容层。
- 真正开始实现前，必须先审查并提交当前工作区变更，建立可明确回退的基线 commit。

## 2. 问题陈述

当前 CardEditor Overlay 的可见效果依赖多层互相补偿的实现：

- 每侧同时维护内容宽度、可见宽度、动态边缘间距和位移量。
- Vue computed style 与拖拽期间的 `style.setProperty()` 同时写入同一组 CSS 变量。
- 五列 Grid 负责占位，侧栏再通过 transform 滑出画布，工具列另外重复侧栏宽度公式。
- resizebar 同时承担宽度调整、点击切换、折叠阈值判断和 mouseup 后吸附。
- `fitViewport()` 读取 center spacer 与左右侧栏 DOM 矩形来推测安全区域，没有消费共享 `ViewportInsets`。
- 折叠高度根据 header 尺寸和边框数量手工计算。
- 尺寸、阈值、resize 命中区和 thumb 几何分散在 TypeScript、CSS 与测试中。
- 测试断言 `4.71px` 等内部公式结果，而不是用户可见边缘距离和交互行为。

这些机制使 CardEditor 难以成为其他 viewport 工作台的可靠视觉基准，也导致图标注册表、自定义块注册表即使复用相同 token，仍可能产生不同的可见间距。

## 3. 目标

- 在桌面尺寸下保持 CardEditor 当前左右侧栏、上下分栏、折叠、拖拽和玻璃视觉效果。
- 每侧仅使用一个横向 `extent` 作为几何状态真相，其余宽度、位移、间距和 occlusion 全部纯派生。
- viewport、fit、zoom center 和 overlay placement 消费同一份 `ViewportInsets`。
- 建立标准、可访问、支持 Pointer Events 的 `OcResizeHandle`。
- 建立 feature-private `CdeOverlayDock`，统一左右 Dock 的呈现与交互，避免创建万能 Overlay 框架。
- `useCdeOverlayLayout` 只负责状态和语义命令，不直接读写 DOM 样式。
- 所有视觉尺寸使用 foundation token 或共享组件 contract。
- 生产代码相对实施前基线净减少至少 250 行。
- 删除旧 Grid/transform 补偿状态机、DOM 直写、document mouse listener 和实现细节测试。

## 4. 用户故事与验收条件

### US-001：实施基线与行为金样

**描述：** 作为维护者，我希望在重构前固定当前可接受行为并建立 commit 基线，以便重构可以安全比较和回退。

**验收条件：**

- [ ] 审查当前 `git status`，确认待提交文件属于已完成工作，不夹带未知或无关修改。
- [ ] 在开始修改 CardEditor Overlay 前创建基线 commit。
- [ ] 记录正常展开、单面板收起、同侧全部收起、侧栏横向半拖拽、侧栏完全折叠、窄窗口和 Layer View 状态。
- [ ] 记录 stage 边缘到 Dock、Dock 到工具列、Card 内边距和 resize handle 命中区的实际几何。
- [ ] 明确哪些行为必须保持、哪些偶然实现不得继承。
- [ ] 使用浏览器（dev-browser/Playwright）完成视觉基线验证。

### US-002：标准 Resize Handle

**描述：** 作为键盘、鼠标或触控笔用户，我希望所有浮层尺寸手柄具有一致且可访问的交互。

**验收条件：**

- [ ] 新增标准 `OcResizeHandle`，支持 horizontal 和 vertical orientation。
- [ ] 使用 Pointer Events 与 Pointer Capture，不使用 document 级 mousemove/mouseup listener。
- [ ] 暴露 `aria-valuemin`、`aria-valuemax`、`aria-valuenow` 和本地化 label。
- [ ] 方向键按标准步长调整，Home/End 到达边界，Escape 取消当前拖拽。
- [ ] 命中区、thumb 长度、thumb 厚度、圆角和状态色来自 foundation token。
- [ ] 卸载或 pointercancel 后恢复 body cursor/user-select，不残留全局状态。
- [ ] 使用浏览器（dev-browser/Playwright）验证鼠标、键盘、焦点和深浅主题。

### US-003：单一 Dock 横向几何

**描述：** 作为 CardEditor 用户，我希望左右侧栏继续平滑调整宽度和拖拽折叠，但不会出现间距漂移或玻璃表面被压扁。

**验收条件：**

- [ ] 新增 feature-private `CdeOverlayDock`，通过 `side="left|right"` 镜像使用。
- [ ] 每个 Dock 的横向状态只有 `extent`；内容宽度、展开进度、transform、edge gap 和 occlusion 均由它派生。
- [ ] 展开内容宽度约束在共享最小值和最大值之间。
- [ ] 折叠过程中完整 Glass Card 通过位移离开 stage，不缩窄内容、不使用动态 `clip-path`。
- [ ] 保留从展开态拖入折叠、从折叠态拖出展开的阈值行为。
- [ ] 左右方向计算镜像一致，禁止维护两套分支公式。
- [ ] Dock 完全展开时与 stage 边缘保持共享浮层 gap；完全折叠时不残留可见空隙。
- [ ] 拖拽、吸附与最终状态提交在同一个交互事务内完成，不依赖下一帧补写样式。
- [ ] 使用浏览器（dev-browser/Playwright）验证展开、部分拖拽、折叠和左右镜像。

### US-004：Dock 内部上下分栏

**描述：** 作为 CardEditor 用户，我希望每侧两个面板继续独立收起和调整分割高度，并在任何组合下保持稳定布局。

**验收条件：**

- [ ] 两个面板都展开时显示标准 horizontal resize handle。
- [ ] 只有一个面板展开时，该面板占用剩余可用高度且不显示分割手柄。
- [ ] 两个面板都收起时只显示两个真实 Card header，高度由内容自然决定。
- [ ] 不再使用 `calc((header-size + border) * 2)` 一类折叠高度公式。
- [ ] 顶部面板尺寸使用绝对像素语义，并根据容器尺寸与上下最小高度进行 clamp。
- [ ] 容器缩小时重新 clamp，不产生负高度、溢出或属性区崩坏。
- [ ] 现有四个 Card 的标题、Action、Tree、Navigator 和 PropertyEditor 内容保持不变。
- [ ] 使用浏览器（dev-browser/Playwright）验证全部展开组合和小高度容器。

### US-005：纯状态 Overlay Controller

**描述：** 作为维护者，我希望 Overlay controller 只有一个状态写入口，以便布局行为可预测、可单测。

**验收条件：**

- [ ] 重写 `useCdeOverlayLayout`，只持有布局状态、纯派生值和语义命令。
- [ ] Controller 不调用 `HTMLElement.style.setProperty()`。
- [ ] Controller 不通过 selector 查询 `.card-design-editor__sidebar-panel`。
- [ ] Controller 不注册 document 级 mouse 事件。
- [ ] 布局状态通过 props/emits 或响应式 style binding 单向进入呈现组件。
- [ ] 四个面板展开态和两侧 top size 继续按现有 CardDesigner layout session 协议提交。
- [ ] 左右 Dock extent 不进入持久化 layout schema，关闭编辑器后清空。
- [ ] Controller 单测只断言状态与语义结果，不断言 CSS 字符串拼接细节。

### US-006：CardEditor Overlay 集成

**描述：** 作为 CardEditor 用户，我希望重构后看到与原来一致的工作区，但所有侧栏和工具列使用统一布局骨架。

**验收条件：**

- [ ] 左侧使用一个 `CdeOverlayDock` 渲染卡牌树和 Navigator。
- [ ] 右侧使用一个 `CdeOverlayDock` 渲染结构树和 PropertyEditor。
- [ ] viewport 始终铺满 stage，Dock 绝对覆盖于 viewport 上方。
- [ ] 删除五列 overlay Grid 和 center spacer 的布局职责。
- [ ] 右侧工具列继续包含 viewport controls、吸附、clip 和翻面 Action。
- [ ] 工具列与展开 Dock、折叠后的 stage 边缘保持完全相同的共享 gap。
- [ ] Layer View 激活时继续维持既有层叠、透明度与输入隔离行为。
- [ ] 设计视图和数据表视图切换不回退。
- [ ] 使用浏览器（dev-browser/Playwright）验证正常、折叠、Layer View 与模式切换。

### US-007：统一 Viewport 安全区

**描述：** 作为画布用户，我希望 fit、缩放和工具列定位都避开当前可见浮层，并且改变侧栏后不会出现不同步。

**验收条件：**

- [ ] 左右 Dock 输出或共同派生标准 `ViewportInsets`。
- [ ] CardViewport 通过现有 `viewportInsets` contract 接收左右安全区。
- [ ] `fitViewport()` 不读取 center spacer 或 sidebar DOM 矩形。
- [ ] 适应窗口、缩放中心和首次 fit 使用共享安全区域。
- [ ] 右侧工具列定位消费相同 right inset，不重复侧栏宽度公式。
- [ ] 拖动侧栏期间不自动 fit，避免画面跳动；下一次手动 fit 使用最新 insets。
- [ ] 侧栏完全折叠后安全区归零到共享 stage gap。
- [ ] 使用浏览器（dev-browser/Playwright）验证不同 Dock extent 下的 fit 中心与工具列间距。

### US-008：响应式与可访问性收口

**描述：** 作为窄窗口或辅助技术用户，我希望编辑入口不会因为断点而全部消失，并能理解和操作所有 resize handle。

**验收条件：**

- [ ] 不再在单一固定断点下同时 `display:none` 隐藏侧栏、resizebar 和工具列。
- [ ] 使用容器可用宽度决定 Dock 默认折叠策略或窄屏呈现方式。
- [ ] 窄窗口至少保留 viewport controls 和恢复左右面板的入口。
- [ ] 所有 separator 的方向、当前值和边界对辅助技术可读。
- [ ] Tab 顺序不会进入不可见或已折叠内容。
- [ ] reduced-motion 下停用 Dock、工具列与 resize thumb 动画。
- [ ] 使用浏览器（dev-browser/Playwright）验证窄宽度、键盘和 reduced-motion。

### US-009：删除旧机制与量化验收

**描述：** 作为维护者，我希望重构真正降低复杂度，而不是在旧实现旁边新增一套抽象。

**验收条件：**

- [ ] 删除 `visibleWidth + panelWidth + edgeInset` 多真相状态模型。
- [ ] 删除 `writeResizeStyles()` 及全部对应 DOM CSS 变量写入。
- [ ] 删除五列 Grid、独立 8px resize 列和 center spacer 安全区推导。
- [ ] 删除旧 resizebar 模板、样式和 mouse lifecycle。
- [ ] 删除无消费者的旧 CardEditor CSS 变量。
- [ ] 删除断言 `4.71px` 等内部插值结果的测试。
- [ ] 不保留旧 controller wrapper、alias、fallback 或双实现 feature flag。
- [ ] 生产代码相对 US-001 基线净减少至少 250 行。
- [ ] TypeScript、相关 Vitest、UI lint、生产构建和 `git diff --check` 全部通过。

### US-010：注册表复用准备

**描述：** 作为后续维护者，我希望图标和自定义块注册表能够采用同一 resize 与玻璃几何，而不依赖 CardEditor 私有代码。

**验收条件：**

- [ ] `OcResizeHandle` 不包含 Card、Dock、图标或自定义块业务语义。
- [ ] 玻璃 surface padding、浮层 gap、resize 命中区与 thumb geometry 均来自共享 token。
- [ ] `CdeOverlayDock` 保持 feature-private，不被注册表直接导入。
- [ ] 注册表继续使用 `OcViewportInspector`，但其 resize handle 可在后续独立迁移到 `OcResizeHandle`。
- [ ] 本次不为了潜在复用创建万能 `OcOverlay`、通用 Dock schema 或多面板布局 DSL。
- [ ] CardEditor 重构完成后，三处 UI 的可见 padding 和 gap 可通过同一组几何断言比较。

## 5. 功能要求

- FR-1：左右 Dock 必须覆盖在全尺寸 viewport 上方，不得重新压缩 viewport DOM 尺寸。
- FR-2：每侧横向布局只能有一个可写 `extent`；内容宽度、位移、进度、间距和 occlusion 必须纯派生。
- FR-3：拖拽过程中允许 `extent` 位于折叠值与最小展开宽度之间；交互结束后吸附到折叠值或合法展开范围。
- FR-4：展开态向内拖拽和折叠态向外拖拽使用稳定、方向无关的阈值。
- FR-5：拖拽折叠不得压缩包含 `backdrop-filter` 的 Glass Card 内容。
- FR-6：Dock edge gap、工具列 gap 和注册表 inspector gap 必须消费同一个共享语义 token。
- FR-7：Glass Card 内部 padding 与浮层外部 gap 是两个不同语义，不得合并为同一个 token。
- FR-8：上下分栏只在两个面板都展开时可调。
- FR-9：面板收起状态由 OcCard 的真实 header 内容决定，不推算 header 像素高度。
- FR-10：横向 extent 仅在组件会话内保存；面板展开态和 top size 继续使用现有 session layout contract。
- FR-11：ViewportInsets 是 fit、zoom center 和 overlay placement 的唯一安全区来源。
- FR-12：Resize Handle 必须支持 Pointer Events、键盘和完整 separator ARIA。
- FR-13：用户取消或组件卸载必须可靠清理 pointer capture、cursor 与 user-select。
- FR-14：视觉尺寸、颜色、阴影、圆角、动画和阈值不得以 feature-local 魔法值存在。
- FR-15：新实现不得改变 Card document、dirty、undo、render pipeline、selection 或 PropertyEditor 写回协议。
- FR-16：新实现不得引入 CardEditor 与图标/自定义块注册表之间的 feature 级反向依赖。
- FR-17：迁移完成时必须删除旧机制；不允许以兼容分支长期并存。
- FR-18：生产代码净减少至少 250 行，计算范围与基线 commit 必须记录在实现说明中。

## 6. 非目标

- 不重写 CardViewport 的渲染、选择、移动、缩放或 binding 逻辑。
- 不重写 CardEditor 的实例树、结构树、Navigator、PropertyEditor 或数据表业务。
- 不改变 `.ocdocument`、项目文件或 Editor session 的持久化 schema。
- 不把左右侧栏宽度跨编辑器、跨文件或跨应用重启持久化。
- 不在本次强制迁移图标注册表和自定义块注册表到新的 CardEditor Dock。
- 不创建支持任意方向、任意面板数量、任意停靠位置的布局框架。
- 不保留旧实现作为 fallback，也不以 feature flag 长期运行双布局。
- 不借本次重构调整 Card header、Tree、PropertyEditor 或 toolbar 的业务密度。

## 7. 设计要求

### 7.1 视觉契约

- Glass surface 继续使用 `OcCard variant="glass"`。
- Glass 内部 padding 与浮层外部 gap 分开建模。
- Dock、toolbar 和 viewport inspector 的可见边缘距离必须一致。
- Resize hit area 可以大于可见 thumb，但不得占据额外布局行或列。
- 收起后的 Card header 不贴 viewport 边缘，也不遗留不可解释的空白带。

### 7.2 交互契约

- 横向拖拽调整 Dock extent，并在结束时根据开始状态和稳定阈值吸附。
- 上下拖拽只调整 top size。
- 拖拽过程不触发 viewport fit。
- Card header 的展开/收起 Action 与 resize 状态分离。
- Separator 点击不再通过“移动不足 2px”推断折叠命令；折叠由拖拽阈值或明确的键盘边界命令决定。

### 7.3 响应式契约

- 优先使用容器尺寸而不是全局 viewport 固定断点。
- 可用画布区域不得低于共享最小安全尺寸。
- 空间不足时优先折叠 Dock，而不是永久隐藏全部控制入口。

## 8. 技术方案

### 8.1 组件边界

新增：

- `components/standard/OcResizeHandle.vue`
  - 只负责 resize handle 的结构、视觉、Pointer/Keyboard 和 ARIA。
  - 不负责具体数值策略或业务持久化。

- `features/card-designer/components/CdeOverlayDock.vue`
  - CardEditor 私有。
  - 负责一侧 Dock 的绝对定位、横向 extent、上下 slots、分割手柄和 occlusion 输出。
  - 不导入 Tree、PropertyEditor、CardDocument 或项目 store。

重写：

- `features/card-designer/useCdeOverlayLayout.ts`
  - 只负责四个面板展开态、两侧 top size、左右临时 extent 和纯派生 `ViewportInsets`。
  - 不拥有 DOM refs、selector、事件监听或 style mutation。

复用：

- `OcCard variant="glass"`
- `OcOverlayToolbar`
- `OcViewportControls`
- `CardViewport`
- `ViewportInsets` 与 `resolveViewportSafeRegion`
- 当前 CardDesigner session layout 协议

### 8.2 状态模型

建议内部状态：

```ts
type CdeDockState = {
  extent: number
  topSize: number | null
  topExpanded: boolean
  bottomExpanded: boolean
}

type CdeOverlayState = {
  left: CdeDockState
  right: CdeDockState
}
```

其中：

- `extent = 0` 表示完全折叠。
- 拖拽期间允许 `0 < extent < minExtent`。
- 展开结束态限制在 `[minExtent, maxExtent]`。
- Glass 内容宽度为纯派生值，任何时刻不得小于 `minExtent`。
- 现有持久化协议只投影 `topExpanded/bottomExpanded/topSize`，不投影 `extent`。

### 8.3 几何数据流

```text
Dock extent
  ├─> Dock content width / transform / edge gap
  ├─> left/right viewport inset
  └─> toolbar safe placement

ViewportInsets
  └─> CardViewport fit / zoom center / initial fit
```

禁止反向通过 `getBoundingClientRect()` 读取 Dock 来重建同一份逻辑几何。

## 9. 实施顺序

1. 审查当前工作树并创建基线 commit；没有基线 commit 不得开始重构。
2. 建立视觉金样、几何测量和用户行为清单。
3. 增加 foundation token 与 `OcResizeHandle`，完成独立测试和浏览器验证。
4. 独立实现 `CdeOverlayDock`，在测试 harness 中验证左右镜像、拖拽折叠和上下分栏。
5. 将 `useCdeOverlayLayout` 改为纯状态 controller。
6. 在 CardEditor 中一次性替换左右旧 Overlay 骨架，保留原有业务 slot 内容。
7. 接入标准 `ViewportInsets`，删除 center spacer 测量与 toolbar 重复定位公式。
8. 完成窄窗口、Layer View、深浅主题、键盘和 reduced-motion 验证。
9. 删除全部旧 CSS、变量、事件生命周期和实现型测试。
10. 对比基线 commit 统计生产代码 Delta；不足净减 250 行时不得验收。

每一步保持可运行、可测试；但旧布局与新布局不得以长期兼容层同时存在。组件可以先在隔离 harness 中完成，切换 CardEditor 时必须直接删除原路径。

## 10. 测试计划

### 10.1 单元测试

- Dock extent 在展开、部分拖拽、折叠和最大宽度下的纯几何。
- 左右 side 的镜像一致性。
- 从展开态和折叠态开始拖拽时的不同吸附阈值。
- 上下分栏 min/max clamp 与容器缩小。
- 面板展开组合对应的 split availability。
- Pointer cancel、Escape、卸载和 body 状态恢复。
- 键盘 Arrow/Home/End 与 ARIA 数值。
- Session layout 投影不包含 Dock extent。

### 10.2 集成测试

- CardEditor 四个原有 Card 内容和 Action 不变。
- 右侧工具列在 Dock 展开、部分拖拽和折叠时保持共享 gap。
- ViewportInsets 随左右 extent 更新。
- 手动 fit 使用最新安全区，拖拽过程不自动 fit。
- 初次打开和切换文件继续执行一次有效 fit。
- Layer View 激活和退出后层级、透明度与交互恢复。
- 数据表模式不渲染设计 Overlay。

### 10.3 浏览器视觉测试

- 深色与浅色主题。
- 默认窗口、窄窗口和低高度窗口。
- 四面板展开、单面板收起、同侧全收起。
- 左右 Dock 部分拖拽与完全折叠。
- toolbar 到 Dock、Dock 到 stage、Inspector 到 stage 的边缘距离对比。
- resize thumb、hit area、焦点态和 reduced-motion。

### 10.4 工程验证

- 相关 Vitest。
- `vue-tsc --noEmit`。
- UI lint。
- 生产构建。
- `git diff --check`。
- 基于基线 commit 的生产代码行数统计。

## 11. 成功指标

- 生产代码净减少至少 250 行；目标中位值约 310 行。
- `useCdeOverlayLayout.ts` 从当前约 429 行降低到不超过 180 行。
- CardEditor Overlay 不再调用 `style.setProperty()`。
- CardEditor Overlay 不再注册 document 级 mouse 监听。
- CardEditor fit 不再读取左右 sidebar 或 center spacer DOM。
- 横向几何每侧只有一个可写 extent。
- feature 层不再出现 resize hit/thumb、Dock 默认/最小/最大尺寸的视觉魔法值。
- 不再存在 `visible-width`、`edge-inset`、五列 Grid resize 列或折叠 header 高度推导。
- CardEditor、图标注册表和自定义块注册表的 Glass padding 与 floating gap 可由同一共享 contract 验证。
- 用户可见桌面布局与基线金样一致，无 fit、缩放中心、折叠或工具列位置回退。

## 12. 风险与控制

- **玻璃表面在部分折叠时被裁切：** 保持完整内容宽度，只移动 Dock，不使用动态 clip-path。
- **拖拽期间响应式更新导致卡顿：** 只更新单一 extent；不得在 move 中查询多处 DOM 或写入多组 CSS 变量。
- **Viewport 在 Dock 改变时跳动：** Dock resize 不触发 fit，仅更新安全区。
- **宽度状态意外持久化：** 单测明确 session layout snapshot 不包含 extent。
- **新抽象过度通用：** `CdeOverlayDock` 必须留在 feature 内；共享层只接受已有多个消费者证明需要的 resize primitive 和 token。
- **重构后代码量反增：** 以基线 commit 统计生产代码，净减 250 行为硬门禁。
- **旧机制残留形成双路径：** 验收时搜索旧 CSS 变量、DOM 写入、document mouse listener 和 center spacer 依赖，任一残留都阻止完成。

## 13. 开放问题

- 窄窗口下采用“自动折叠左右 Dock”还是“保留边缘恢复按钮”，应在视觉基线阶段根据现有最小桌面窗口尺寸确定；不得继续简单隐藏全部入口。
- `OcResizeHandle` 是否在本次末尾顺带迁移 `OcViewportInspector`，取决于 CardEditor 集成后的风险和代码 Delta；不是 CardEditor 验收前置条件。

