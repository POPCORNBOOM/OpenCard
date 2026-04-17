`TreeNode.vue` 是纯节点视图层，职责边界必须干净：
- 只消费 `NodeTree` 注入的协议能力（选中、展开、拖拽、重命名）。
- 只发用户意图，不做业务判断。

这里不要引入任何 domain 规则（文件系统、卡牌结构、实例语义）：
- 这些规则必须留在外层模块处理。
- `TreeNode` 只关心“节点 UI 是否展开/选中/可交互”。

展开语义要求明确：
- `isExpanded` 是节点级状态接口。
- 传 `node.isExpanded` 时按受控处理；不传时由本地状态接管。
- 受控模式下点击仍会发 `node-toggle`，但是否生效由外层回写决定。

重命名语义：
- 当前 canonical 字段是 `renamable`。
- 严禁再读 `isNodeRenamable` 等历史字段。
- 调用方必须统一改为 `renamable`。

协议来源约束：
- `TreeNode.vue` 不再承载 `ITreeNode` 类型定义。
- 统一从 `src\shared\ui\tree\tree.types.ts` 取协议，避免 UI 实现文件被业务层当成“类型入口”。

重构原则（本文件）：
- 保持模板渲染职责单一。
- 避免把 `NodeTree` 的状态机逻辑复制到 `TreeNode`。
