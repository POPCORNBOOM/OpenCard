`CardDesignEditor.vue` 的入口契约是：读取 `modelValue` 后先 `JSON.parse`，再立即走 `materializeCardDocument()`。不要在组件内恢复“手写字段兜底”或“按 block 类型各自补缺省”的逻辑。

实例模式下的 Block 属性面板必须展示“物化后的最终值”：`block + instance override` 合并后再过 `materializeSchemaTarget()`。这样 `null` 覆写会在 UI 与渲染中一致地回落到 schema 默认值。

写回边界保持不变：
- `Layout` 始终写蓝图结构
- `Block` 在实例模式写 `instance.data[blockId]`
不要把这两条边界放松，否则会把实例层变成结构层，破坏蓝图/实例职责分离。

这个组件继续负责“编辑策略与上下文分流”，不负责定义默认值语义。默认值真相只来自 schema。

面板分隔条的拖拽要保持“相对起点增量”语义，不要回到按当前鼠标绝对坐标直接映射宽高。这里的分隔条本来就很窄，绝对映射会在按下瞬间产生细小跳变，用户会直接感知成“拖拽手感发飘”。

左侧“创建的卡牌”折叠态应表现为窄轨按钮，而不是把完整 panel 骨架硬压成超窄宽度。后续如果继续做侧栏收纳，优先保留明确的切换 affordance，避免保留空标题和空 body 造成别扭的占位感。
