`CardDesignEditor.vue` 的关键边界是：它现在是“编辑内容”的组件，不再是“拥有文件读写真相”的组件。

`filePath` 在这里仍然有价值，但它只是上下文信息，例如资源解析、文件身份判断、和外层 IDE 的关联；真正的文档内容真相来自 `modelValue`，修改后的结果也必须通过 `update:modelValue` 回到外层会话。

不要再把这里改回 `watch(filePath) -> 读磁盘 -> 覆盖内部状态` 的模式。那种写法看起来直观，但会直接破坏编辑会话层对未保存草稿的保护，也会让“移动文件但保留草稿”重新失效。

这里还保留了卡牌领域特有的编辑职责，例如 block tree、instance tree、property editor、viewport 交互、卡牌结构归一化。这些是它应当继续拥有的；但文件读写、tab 状态、dirty 真相、路径 remap，都不应再回流到这里。

实例树不是另一个独立编辑器，它和蓝图属于同一份 `CardDocument` 的两种编辑上下文。`selectedCardId` 用来表达当前上下文：特殊值 `__blueprint__` 表示蓝图，其余值表示具体实例。未来不要再把“蓝图选中态”和“实例选中态”拆成两套长期真相。

实例的持久化形态是数组 `instances: CardInstanceRecord[]`，而不是 record。这样做是为了保留显式顺序，支持树中的拖拽重排，并避免把 JSON 结构绑死成哈希表语义。运行时如果需要按 id 查找，可以派生索引，但文件真相仍然是数组顺序。

实例树上的动作，例如新建、复制、删除、重排，都属于这里的职责，因为它们直接修改 `CardDocument` 内容并需要立刻同步 dirty / `update:modelValue`。不要把这些动作偷偷下沉到 `NodeTree` 或 `PropertyEditor`；那样会让通用 UI 组件重新沾上卡牌领域语义。

其中 viewport 交互的边界应保持清晰：`CardViewport` 负责测量选区、提供 resize / move 手柄并发出语义化事件；`CardDesignEditor.vue` 只负责把这些事件翻译为对 block 尺寸或 `simple-container-location` 坐标的更新。不要把 DOM 测量或拖拽过程反向塞进这里。

接下来如果继续做“实例覆盖蓝图默认值”的编辑，不要把 `propertySources.target` 当成唯一真相。这里应负责决定当前是写蓝图默认值，还是写 `instance.data[blockId][fieldName]`。也就是说，`CardDesignEditor.vue` 才是属性写回策略层，而不是 `PropertyEditor.vue`。

当前规则已经明确：`Layout` 永远写蓝图；只有 `Block` 会在实例模式下写入 `instance.data[blockId][fieldName]`。这条边界不要轻易打破，因为它保证了“蓝图提供结构，实例提供数据”这个核心模型不被 layout 覆盖侵蚀。

因此 `propertySources` 里的 `Block` 可以是“蓝图默认值 + 实例覆盖值”合成出来的显示目标，但 `Layout` 必须继续指向真实蓝图对象。显示层可以是投影，写回策略仍然必须在这里依据当前上下文做分流。
