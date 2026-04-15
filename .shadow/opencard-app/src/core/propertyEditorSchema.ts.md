这个文件现在同时承担两层职责：
1) 属性编辑器元信息（datatype/label/category 等）；
2) 运行时默认值契约（`schemaDefaultValuesByType` + `materializeSchemaTarget`）。

关键约束是：已纳入 schema 的字段必须在 schema 默认值表中有默认值。默认值不能分散到渲染组件、编辑器组件或 store 中，否则会重新出现“同一字段多处兜底”的不一致。

`materializeSchemaTarget()` 的语义要保持稳定：
- 字段缺失 -> 用 schema 默认值
- 字段为 `null` / `undefined` -> 用 schema 默认值
- schema 外字段 -> 原样保留（不做拦截，不做命名前缀要求）

后续加字段时，必须同时改三处：字段定义、默认值映射、相关 materialize 使用点；三者缺一会导致“编辑器可见值”和“渲染值”分叉。
