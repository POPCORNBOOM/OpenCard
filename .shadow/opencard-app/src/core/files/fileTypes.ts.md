`core/files/fileTypes.ts` 现为兼容出口（re-export shim）：
- 真实文件语义实现已迁移到 `src\features\workspace\model\fileTypes.ts`。
- 新代码应直接依赖 feature 路径。
