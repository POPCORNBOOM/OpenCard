`core/propertyEditorSchema.ts` 现为兼容出口（re-export shim）：
- 真实 schema 实现已迁移到 `src\entities\card\schema.ts`。
- 保留该文件用于旧引用平滑过渡。

约束：
- 新代码优先直接依赖 `entities/card/schema`。
- 兼容层只做导出转发，不新增业务规则。
