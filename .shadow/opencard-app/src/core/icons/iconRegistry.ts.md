`core/icons/iconRegistry.ts` 现为兼容出口（re-export shim）：
- 真实实现已迁移到 `src\shared\ui\icon\iconRegistry.ts`。
- 新代码应直接依赖 shared 路径。
