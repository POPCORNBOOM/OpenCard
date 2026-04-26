# OpenCard UI 使用约定（当前阶段）

## 1. 组件职责边界
- `OcSurface` 是唯一“表面渲染基元”，只负责 `tone / border / radius / elevation / pattern / fill / as` 这些静态视觉属性。
- `OcCard` 是上层结构组件，只负责 `title + content` 布局，不在内部发明新的表面系统。
- 交互状态（hover/active/disabled/focus）属于按钮、输入等具体组件，不属于 `OcSurface`。

## 2. Surface 属性复用策略
- `ocSurfaceProps` 直接定义并导出在 `OcSurface.vue` 中，作为单一运行时契约与类型源。
- 其他上层组件（如 `OcCard`）通过 `import { ocSurfaceProps }` 复用，不复制同名 props。
- 默认值允许在上层组件按语义覆写（例如 `OcCard` 默认 `border=strong`、`radius=md`），但字段集合必须对齐 `OcSurface`。

## 3. 为什么这样做
- 少文件：不额外拆 `*.props.ts`，避免目录膨胀。
- 强一致：Surface 变更只改一处，所有复用方自动对齐。
- 易维护：上层组件只管结构，不再混入“魔法颜色”和重复 token 解释逻辑。

## 4. 后续新增组件时的规则
- 需要“有底色/边框/圆角”的容器，优先组合 `OcSurface`。
- 需要“标题区 + 内容区”的容器，优先组合 `OcCard`。
- 禁止在业务组件里重新声明一套 `tone/border/radius/elevation` 语义名。

## 5. Fill 高度链规则（避免 Track 无法占满/拖拽失效）
- 做 `OcCard` 这类“title + content”容器时，`fill` 不能只给最外层，必须把高度链打通到 `content`。
- 标题区固定：`title` 使用 `flex: 0 0 auto`。
- 内容区吃满剩余空间：`content` 在 `fill` 态下必须 `flex: 1 1 auto; min-height: 0; overflow: hidden;`。
- 内层若放 `OcTrackLayout`、`OcScrollArea` 这类依赖容器高度的组件，父链每层都要有 `min-height: 0`。
- 反例：只给外层 `height: 100%`，但 `content` 不设 `flex: 1`，会出现“属性栏看起来没占满 + 分隔条几乎拉不动”。
