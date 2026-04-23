`OcAxisLayout.vue` 是“单轴 track 布局件”，不是通用网格/分栏系统：

- 核心语义是“声明顺序 + 轨道分配”，而非位置枚举。
- `regions` 按数组顺序落位，`track` 决定每段所占空间。
- `track` 支持 `* / 3*`，映射为 `minmax(0, 1fr) / minmax(0, 3fr)`。
- `regions` 里的 `slot` 必须真实存在，缺失时会在开发期告警并过滤。

边界约束（禁止被弱化）：

- 不要在组件内引入 padding preset / 对齐策略 / 视觉样式语义。
- 不要把拖拽分栏、二维网格、响应式重排塞进本组件。
- 需要可拖拽尺寸关系时，继续使用 `OcSplitPane + OcResizer`。
