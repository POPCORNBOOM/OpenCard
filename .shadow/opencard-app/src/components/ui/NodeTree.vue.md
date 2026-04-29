`NodeTree.vue` 是“交互协议层”，不是业务层：
- 输入：`nodes`、`selectedKeys`、`expanded`、拖拽规则。
- 输出：`update:selectedKeys`、`update:expanded`、`node-toggle`、`node-drop`、`node-rename`。

选择态只传 key，不传 node 对象。这个约束是故意的：
- 减少组件和业务对象引用耦合。
- 保证跨模块通信只走稳定标识符（key），由外层决定 key -> node 的解析策略。
- 严禁回退到 `selected/update:selected` 这类对象协议。

根展开语义采用标准受控/非受控二分：
- 传 `expanded` 时视为受控，只发 `update:expanded`，不偷偷改本地真相。
- 不传 `expanded` 时由组件内部状态接管。

`defaultExpanded` / `defaultNodeExpanded` 已移除，不再允许“隐式默认语义”：
- 需要根展开就显式传 `expanded`。
- 节点展开的真实来源应是 `TreeItem.isExpanded`（业务受控）或节点内部交互态（UI 自持）。
- 不要再新增“看起来方便”的默认展开开关，这会让状态来源再次变模糊。

重命名与拖拽仍只负责“交互和事件”，不落业务规则：
- `NodeTree/TreeNode` 负责用户动作编排。
- 外层模块负责合法性、持久化、domain 约束。

根操作键只允许 `actionKeys`：
- 严禁再引入 `rootActionKeys` 这类历史别名。

性能约束：
- 拖拽命中不再在 `mousemove` 中递归 DFS 查节点。
- 使用预构建 key->node 映射，保证高频路径查找稳定。

协议位置约束：
- `NodeTree` 不再是类型定义源。
- `TreeItem` / 拖拽与 action payload / 注入上下文类型统一收敛在 `src\shared\ui\tree\tree.types.ts`。
- 后续业务层禁止再从 `.vue` 导入类型。

重构原则（本模块）：
- 单文件优先，先把本文件边界收紧，再改调用方。
- 每次重构只消灭一个隐式契约，不混入业务改写。
