`CardDesignEditor.vue` 的入口契约是：读取 `modelValue` 后先 `JSON.parse`，再立即走 `materializeCardDocument()`。不要在组件内恢复“手写字段兜底”或“按 block 类型各自补缺省”的逻辑。

实例模式下的 Block 属性面板必须展示“物化后的最终值”：`block + instance override` 合并后再过 `materializeSchemaTarget()`。这样 `null` 覆写会在 UI 与渲染中一致地回落到 schema 默认值。

写回边界保持不变：
- `Layout` 始终写蓝图结构
- `Block` 在实例模式写 `instance.data[blockId]`
不要把这两条边界放松，否则会把实例层变成结构层，破坏蓝图/实例职责分离。

这个组件继续负责“编辑策略与上下文分流”，不负责定义默认值语义。默认值真相只来自 schema。
