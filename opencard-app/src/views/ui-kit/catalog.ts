export type ShowcaseMatrixColumn = 'default' | 'variants' | 'states' | 'layout'

export type ShowcaseInteractionState = 'hover' | 'active' | 'focus' | 'disabled' | 'dirty' | 'n/a'

export interface ShowcaseExample {
  id: string
  title: string
  purpose: string
  demoBlocks: readonly ShowcaseMatrixColumn[]
  stateCoverage: readonly ShowcaseInteractionState[]
}

export interface ShowcaseSection {
  id: 'foundation' | 'primitives' | 'base'
  label: string
  title: string
  description: string
  catalog: readonly string[]
  examples: readonly ShowcaseExample[]
}

export const SHOWCASE_MATRIX_COLUMNS: readonly ShowcaseMatrixColumn[] = [
  'default',
  'variants',
  'states',
  'layout',
]

export const UI_KIT_SECTIONS: readonly ShowcaseSection[] = [
  {
    id: 'foundation',
    label: 'Foundation',
    title: 'Foundation',
    description: '主题 token、排版层级、圆角阴影与密度节奏。',
    catalog: ['Theme Tokens', 'Typography Scale', 'Radius & Shadow', 'Spacing & Motion'],
    examples: [
      {
        id: 'foundation-theme-tokens',
        title: 'Theme Tokens',
        purpose: '核心颜色语义和状态色预览。',
        demoBlocks: SHOWCASE_MATRIX_COLUMNS,
        stateCoverage: ['hover', 'active', 'disabled'],
      },
      {
        id: 'foundation-typography-scale',
        title: 'Typography Scale',
        purpose: '标签、正文、标题的可读性层级。',
        demoBlocks: SHOWCASE_MATRIX_COLUMNS,
        stateCoverage: ['n/a'],
      },
      {
        id: 'foundation-radius-shadow',
        title: 'Radius & Shadow',
        purpose: '统一圆角与阴影层级。',
        demoBlocks: SHOWCASE_MATRIX_COLUMNS,
        stateCoverage: ['n/a'],
      },
      {
        id: 'foundation-spacing-motion',
        title: 'Spacing & Motion',
        purpose: '间距、字号阶梯与动效 token 的基线样本。',
        demoBlocks: SHOWCASE_MATRIX_COLUMNS,
        stateCoverage: ['n/a'],
      },
    ],
  },
  {
    id: 'primitives',
    label: 'Primitives',
    title: 'Primitives',
    description: '底层原语组件。每个组件统一展示 Default / Variants / States / Layout。',
    catalog: [
      'OcBox',
      'OcText',
      'OcSurface',
      'OcPressable',
      'OcFocusRing',
      'OcFieldCore',
      'OcScrollArea',
      'OcIcon',
    ],
    examples: [
      {
        id: 'primitive-oc-box',
        title: 'OcBox',
        purpose: '基础布局容器，处理 stack/inline/grow/center。',
        demoBlocks: SHOWCASE_MATRIX_COLUMNS,
        stateCoverage: ['n/a'],
      },
      {
        id: 'primitive-oc-text',
        title: 'OcText',
        purpose: '统一文本语义与尺寸层级。',
        demoBlocks: SHOWCASE_MATRIX_COLUMNS,
        stateCoverage: ['n/a'],
      },
      {
        id: 'primitive-oc-surface',
        title: 'OcSurface',
        purpose: '统一背景、边框、圆角、阴影的表面抽象。',
        demoBlocks: SHOWCASE_MATRIX_COLUMNS,
        stateCoverage: ['n/a'],
      },
      {
        id: 'primitive-oc-pressable',
        title: 'OcPressable',
        purpose: '底层交互按钮原语，覆盖状态机。',
        demoBlocks: SHOWCASE_MATRIX_COLUMNS,
        stateCoverage: ['hover', 'active', 'focus', 'disabled'],
      },
      {
        id: 'primitive-oc-focus-ring',
        title: 'OcFocusRing',
        purpose: '键盘焦点可视化容器。',
        demoBlocks: SHOWCASE_MATRIX_COLUMNS,
        stateCoverage: ['focus'],
      },
      {
        id: 'primitive-oc-field-core',
        title: 'OcFieldCore',
        purpose: '统一 input/select/textarea 的输入内核与字段字体 token，保持中英混排可读性。',
        demoBlocks: SHOWCASE_MATRIX_COLUMNS,
        stateCoverage: ['focus', 'disabled'],
      },
      {
        id: 'primitive-oc-scroll-area',
        title: 'OcScrollArea',
        purpose: '统一滚动容器语义。',
        demoBlocks: SHOWCASE_MATRIX_COLUMNS,
        stateCoverage: ['n/a'],
      },
      {
        id: 'primitive-oc-icon',
        title: 'OcIcon',
        purpose: '统一 icon 尺寸和语义色。',
        demoBlocks: SHOWCASE_MATRIX_COLUMNS,
        stateCoverage: ['n/a'],
      },
    ],
  },
  {
    id: 'base',
    label: 'Base',
    title: 'Base',
    description: '业务可复用基础控件，统一由 primitives 组合实现。',
    catalog: [
      'OcButton',
      'OcBar',
      'OcChip',
      'OcEmptyHint',
      'OcOverlay',
      'OcTrackLayout',
      'OcFieldInput',
      'OcMenuItemButton',
      'OcOptionGroup',
      'OcPanelSection',
      'OcPropertyRow',
      'OcTabBar / OcTab',
      'OcToolbar / OcToolButton',
      'OcSplitPane / OcResizer',
      'OcSidebarFrame',
    ],
    examples: [
      {
        id: 'base-oc-button',
        title: 'OcButton',
        purpose: '统一按钮入口。',
        demoBlocks: SHOWCASE_MATRIX_COLUMNS,
        stateCoverage: ['hover', 'active', 'focus', 'disabled'],
      },
      {
        id: 'base-oc-bar',
        title: 'OcBar',
        purpose: '统一 top/status/section 条带布局。',
        demoBlocks: SHOWCASE_MATRIX_COLUMNS,
        stateCoverage: ['n/a'],
      },
      {
        id: 'base-oc-chip',
        title: 'OcChip',
        purpose: '统一胶囊信息块样式。',
        demoBlocks: SHOWCASE_MATRIX_COLUMNS,
        stateCoverage: ['n/a'],
      },
      {
        id: 'base-oc-empty-hint',
        title: 'OcEmptyHint',
        purpose: '统一空态文本提示样式。',
        demoBlocks: SHOWCASE_MATRIX_COLUMNS,
        stateCoverage: ['n/a'],
      },
      {
        id: 'base-oc-overlay',
        title: 'OcOverlay',
        purpose: '在既有内容之上叠加单层 overlay 内容。',
        demoBlocks: SHOWCASE_MATRIX_COLUMNS,
        stateCoverage: ['n/a'],
      },
      {
        id: 'base-oc-axis-layout',
        title: 'OcTrackLayout',
        purpose: '单轴语义化布局容器，按 left/right/top/bottom/center 排布区域。',
        demoBlocks: SHOWCASE_MATRIX_COLUMNS,
        stateCoverage: ['n/a'],
      },
      {
        id: 'base-oc-field-input',
        title: 'OcFieldInput',
        purpose: '字段编辑器统一输入壳层。',
        demoBlocks: SHOWCASE_MATRIX_COLUMNS,
        stateCoverage: ['focus', 'disabled'],
      },
      {
        id: 'base-oc-menu-item-button',
        title: 'OcMenuItemButton',
        purpose: '菜单项入口按钮语义。',
        demoBlocks: SHOWCASE_MATRIX_COLUMNS,
        stateCoverage: ['hover', 'focus', 'disabled'],
      },
      {
        id: 'base-oc-option-group',
        title: 'OcOptionGroup',
        purpose: '分段选择组控件。',
        demoBlocks: SHOWCASE_MATRIX_COLUMNS,
        stateCoverage: ['hover', 'active', 'focus', 'disabled'],
      },
      {
        id: 'base-oc-panel-section',
        title: 'OcPanelSection',
        purpose: '带标题和滚动区的面板块。',
        demoBlocks: SHOWCASE_MATRIX_COLUMNS,
        stateCoverage: ['n/a'],
      },
      {
        id: 'base-oc-property-row',
        title: 'OcPropertyRow',
        purpose: '属性编辑行结构。',
        demoBlocks: SHOWCASE_MATRIX_COLUMNS,
        stateCoverage: ['n/a'],
      },
      {
        id: 'base-oc-tab-bar',
        title: 'OcTabBar / OcTab',
        purpose: 'IDE 标签条与单标签项组合，承载编辑器切换与关闭。',
        demoBlocks: SHOWCASE_MATRIX_COLUMNS,
        stateCoverage: ['active', 'dirty', 'focus', 'disabled'],
      },
      {
        id: 'base-oc-toolbar',
        title: 'OcToolbar / OcToolButton',
        purpose: '工具栏容器与工具按钮，统一顶栏、活动栏与面板头部动作。',
        demoBlocks: SHOWCASE_MATRIX_COLUMNS,
        stateCoverage: ['hover', 'active', 'focus', 'disabled'],
      },
      {
        id: 'base-oc-split-pane',
        title: 'OcSplitPane / OcResizer',
        purpose: '分栏容器与拖拽分隔条，统一 IDE 类布局中的可调面板关系。',
        demoBlocks: SHOWCASE_MATRIX_COLUMNS,
        stateCoverage: ['hover', 'active', 'focus'],
      },
      {
        id: 'base-oc-sidebar-frame',
        title: 'OcSidebarFrame',
        purpose: '统一 IDE 活动栏与侧边面板双区壳层。',
        demoBlocks: SHOWCASE_MATRIX_COLUMNS,
        stateCoverage: ['n/a'],
      },
    ],
  },
]
