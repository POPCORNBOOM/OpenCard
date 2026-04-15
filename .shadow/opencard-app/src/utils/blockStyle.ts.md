`blockStyle.ts` 现在承担一个关键语义：schema 默认值可以完整落地到 block，但默认值本身不应产生额外视觉副作用。

因此样式拼接不是“有值就输出”，而是“偏离默认语义才输出”：例如 `opacity=1`、`zIndex=0`、`scale=1`、`translate=0` 不应生成多余 CSS。未来不要把这些判断简化回 truthy 检查，否则会出现默认值触发 transform/z-index 的回归。

`toCSSValue()` 继续负责表达式和单位统一，组件层不要重复做单位兜底。渲染组件应只传字段，不定义默认值。
