# OpenCard 样式复用规划

## 目标

- 先统一高频视觉令牌，减少硬编码颜色、边框、字号。
- 再抽少量跨组件公共模式，避免过早组件化。
- 保持现有组件职责不变，不把样式复用演变成业务重构。

## 当前重复模式

### 1. IDE 深色主题令牌

高频重复值：

- `#1e1e1e`
- `#252526`
- `#2d2d2d`
- `#2a2d2e`
- `#3c3c3c`
- `#007acc`
- `#094771`
- `#0e639c`
- `#000`
- `#333`
- `#555`
- `#888`
- `#666`
- `11px`

### 2. 公共样式模式

- 面板标题栏：深色背景 + 11px + uppercase + 粗体 + 底边框
- 输入控件：`#3c3c3c` 背景 + `#555` 边框 + focus 时 accent
- 工具按钮：透明背景 + hover 填充 + active accent
- 浮层菜单：`#252526` 背景 + 浅边框 + 阴影
- 空态文本：12px + muted color

## 待复用文件列表

### P0：先接入令牌

- `src/styles.css`
- `src/views/MainIDE.vue`
- `src/components/editors/CardDesignEditor.vue`
- `src/components/editors/PropertyEditor.vue`
- `src/components/ui/FloatingMenuHost.vue`
- `src/components/ui/FloatingMenuList.vue`

### P1：输入控件统一

- `src/components/editors/property-fields/StringPropertyField.vue`
- `src/components/editors/property-fields/NumberPropertyField.vue`
- `src/components/editors/property-fields/FilePathPropertyField.vue`
- `src/components/editors/property-fields/ColorPropertyField.vue`
- `src/components/editors/property-fields/BackgroundPropertyField.vue`

### P2：选择按钮 / 分段按钮统一

- `src/components/editors/property-fields/AlignPositionPropertyField.vue`
- `src/components/editors/property-fields/AnchorPositionPropertyField.vue`
- `src/components/editors/property-fields/FlowDirectionPropertyField.vue`
- `src/components/ui/TreeActionButton.vue`
- `src/components/ui/TreeNode.vue`

### P3：视图区和编辑器外围统一

- `src/components/card/CardViewport.vue`
- `src/components/editors/ImagePreviewEditor.vue`
- `src/views/MainIDE.vue`
- `src/components/editors/CardDesignEditor.vue`

## 统一顺序

1. 在 `src/styles.css` 建立主题令牌。
2. 把 P0 文件中的硬编码颜色、边框、字号替换成令牌。
3. 提炼公共 class：
   - `.oc-panel-header`
   - `.oc-empty-hint`
   - `.oc-input`
   - `.oc-icon-button`
   - `.oc-floating-surface`
4. 逐步让 P1、P2 文件接入公共 class 或令牌。
5. 最后再评估是否需要抽 Vue 基础样式组件。

## 当前进度

### 已完成

- 已在 `src/styles.css` 建立第一批主题令牌与公共模式。
- 已统一面板标题、空态文本、通用输入框、图标按钮、浮层菜单容器。
- 已开始统一布局区块模式，包括滚动容器、预览舞台、居中空态。
- 已开始统一高层容器布局模式，包括 panel body、panel stack、scroll body、editor stage。
- 已开始统一预览编辑区交互视觉，包括 transform preview、selection frame、debug overlay。
- 已将按钮命名统一到 `oc-button + modifier` 体系，并新增按钮展示页。
- 已接入第一批页面/编辑器壳层：
  - `src/views/MainIDE.vue`
  - `src/components/editors/CardDesignEditor.vue`
  - `src/components/editors/PropertyEditor.vue`
  - `src/components/ui/FloatingMenuHost.vue`
  - `src/components/ui/FloatingMenuList.vue`
- 已接入第一批字段编辑器：
  - `src/components/editors/property-fields/StringPropertyField.vue`
  - `src/components/editors/property-fields/NumberPropertyField.vue`
  - `src/components/editors/property-fields/FilePathPropertyField.vue`
  - `src/components/editors/property-fields/ColorPropertyField.vue`
  - `src/components/editors/property-fields/BackgroundPropertyField.vue`
  - `src/components/editors/property-fields/AlignPositionPropertyField.vue`
  - `src/components/editors/property-fields/AnchorPositionPropertyField.vue`
  - `src/components/editors/property-fields/FlowDirectionPropertyField.vue`
- 已统一第一批树交互样式：
  - `src/components/ui/TreeActionButton.vue`
  - `src/components/ui/TreeNode.vue`
  - `src/components/ui/NodeTree.vue`
- 已接入第一批布局模式：
  - `src/components/card/CardViewport.vue`
  - `src/components/editors/ImagePreviewEditor.vue`
  - `src/components/editors/CardDesignEditor.vue`
  - `src/components/editors/PropertyEditor.vue`
  - `src/views/MainIDE.vue`

### 下一步候选

- 继续清理剩余半透明状态值，把 tree 的 box-shadow 颜色也进一步令牌化。
- 评估是否为 `ImagePreviewEditor.vue` 和 `CardViewport.vue` 抽统一的预览舞台背景语义。
- 开始从“颜色/按钮/输入框复用”过渡到“布局区块复用”，例如侧栏内容区、滚动容器、预览面板内容区。

## 明确不做

- 暂不把所有相似区域都抽成组件。
- 暂不改动业务状态流和组件边界。
- 暂不一次性全量替换全部样式文件。
