`NodeTree.vue` 现在有两层展开语义：
- 根节点标题行用 `expanded` / `defaultExpanded`
- 普通树节点的“初始是否展开”用 `defaultNodeExpanded`

这层拆分是故意的。不要为了“默认全展开”去给每个 `ITreeNode` 硬塞 `isExpanded: true`，那会把节点变成受控状态；如果外层又没有实现 `node-toggle` 回写，箭头点击看起来就会失效。

这里允许“默认展开，但后续仍可由用户手动折叠”。未来如果别的页面也要树默认全开，优先复用 `defaultNodeExpanded`，不要在业务层递归改写节点展开状态。

`NodeTree.vue` 现在还持有通用的“节点重命名交互态”：哪个节点正在改名、输入框草稿、Enter 提交、Esc/失焦取消。这层职责是故意停在“交互”和“事件”这里，不往下碰具体业务数据。

未来如果别的树也要支持重命名，优先复用这里的 `node-rename` 事件和 `ITreeNode.renamable`，让外层自己决定是否合法、如何落盘或如何改 domain 数据。不要把文件系统校验、block 结构变更、实例命名规则重新塞回 `NodeTree.vue` 或 `TreeNode.vue`。
