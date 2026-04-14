`SimpleContainerBlock.vue` 里 child wrapper 现在是有意保留的 placement 层，不是历史遗留噪音。它的职责是承载 simple layout 的几何定位，并作为 viewport 的测量盒子；内容 block 根节点则继续承载 block 自身样式和点击语义。

因此不要再把“wrapper 只是多余 div”当作默认前提。只要 wrapper 还存在，就必须显式区分 `data-block-placement-id` 和 `data-block-id` 的职责，不能让测量、选框、点击、内容样式都混在同一个 DOM 标识上。

如果未来真的要删除 wrapper，也应该先保证 simple layout 已经能安全地直接落到 block 根节点，同时不破坏 `%` 尺寸、anchor 定位和 measurement 模式。那是一次完整的 DOM 语义迁移，不是单纯删标签。
