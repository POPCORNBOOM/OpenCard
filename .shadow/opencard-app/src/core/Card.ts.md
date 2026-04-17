`core/Card.ts` 现为兼容出口（re-export shim）：
- 真实领域实现已迁移到 `src\entities\card\model.ts`。
- 保留该文件是为了让旧调用方可平滑迁移，不在这里继续新增业务实现。

约束：
- 新代码优先直接依赖 `entities/card/model`。
- 兼容层只做导出转发，不承载新增语义。
