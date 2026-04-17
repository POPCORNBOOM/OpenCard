`features/workspace/store/projectStore.ts` 是“文件系统真相边界”：
- 管理项目路径、目录索引、监听、真实文件读写、目录展开状态。
- 语义必须保持“客观工作区状态”，不混入编辑草稿语义。

边界约束：
- 文件树拖拽/重命名校验必须收口在此（目标推导、合法性、冲突检查、路径 remap）。
- UI 层只发意图事件，不在页面层拼路径或直接调用底层 rename。
- 交互协议类型来自 `shared/ui/tree/tree.types.ts`，禁止反向依赖 `.vue` 类型。
