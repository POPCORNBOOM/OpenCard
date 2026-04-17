`Card.ts` 的边界仍是“raw 文档真相 + 视图物化工具”：
- `toViewDoc/toViewBlock` 仅用于渲染/投影，不用于持久化。
- `applyInstance()` 只做实例覆写，不做默认值补齐。

层级约束补充：
- 本文件可依赖共享协议类型（如 `shared/ui/tree/tree.types.ts`），但不应再依赖任何具体 UI 组件文件（`.vue`）。
- `blockToTreeNode` 只负责模型到通用树协议的转换，不引入组件行为语义。

稀疏数据约束：
- block factory 返回稀疏对象，不写 `undefined` 键。
- schema 外字段透传，不在本层截断。

属性编辑输入协议（跨模块）：
- `PropertyEditorInput = { key, record, override? }`。
- `key` 是稳定源标识，`record` 是当前可编辑视图对象，`override` 是临时 schema 覆写。
- 本层只定义结构，不承载 UI 展示文案与写回策略。
