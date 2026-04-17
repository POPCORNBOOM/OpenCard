`features/workspace/store/editorSessionStore.ts` 是“编辑会话真相边界”：
- 管理会话身份、草稿/已保存内容、dirty 状态、预览态与路径 remap。
- 核心语义：路径可变，但会话身份不能丢失。

关键约束：
- 保持 VSCode 风格 preview tab 规则（单预览位、编辑后转正、双击直接固定）。
- 不把临时会话状态拆回页面层维护。
- 树节点协议类型走 `shared/ui/tree/tree.types.ts`，避免 store -> 组件耦合。
