`stores/projectStore.ts` 现为兼容出口（re-export shim）：
- 真实实现已迁移到 `src\features\workspace\store\projectStore.ts`。
- 新代码应直接依赖 feature 路径。
