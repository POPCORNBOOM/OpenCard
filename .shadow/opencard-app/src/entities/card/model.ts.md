`entities/card/model.ts` 是卡牌领域模型与结构操作的主边界：
- 维护文档/块类型、视图物化（`toViewDoc/toViewBlock`）、实例投影（`applyInstance`）、树结构变更（add/remove/move）。
- 这里定义的是“领域结构真相”，不是某个编辑器实现细节。

语义约束：
- `toViewDoc/toViewBlock` 仅用于渲染/投影，不用于持久化写回。
- 稀疏数据约束保持：factory 不主动写 `undefined`，schema 外字段透传。
- `blockToTreeNode` 只做模型 -> 通用树协议转换，不引入组件行为语义。

边界约束：
- 可依赖共享协议类型（`shared/ui/tree/tree.types.ts`）。
- 禁止依赖任何具体 UI 组件文件（`.vue`）。

父引用解析约束：
- `resolveParentFieldReferenceKey` 仅负责引用 token 到 `ownerId:field` 的纯映射，不做字段读取与替换副作用。
- 支持 `p.p...:field`（父链）与 `d:field`（文档）两类来源；`p` 引用链遇到 `card-document` 即返回空。
