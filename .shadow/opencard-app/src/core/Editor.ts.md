`core/Editor.ts` 现为兼容出口（re-export shim）：
- 真实注册实现已迁移到 `src\features\editor-runtime\registry\editorRegistry.ts`。
- 保留该文件仅为平滑迁移旧引用。

约束：
- 新代码直接依赖 `features/editor-runtime/registry/editorRegistry`。
- 兼容层不新增业务逻辑。
