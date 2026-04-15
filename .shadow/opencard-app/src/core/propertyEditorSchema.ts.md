这个文件现在同时承担两层职责：
1) 属性编辑器元信息（datatype/label/category 等）；
2) 运行时默认值契约（`schemaDefaultValuesByType` + `materializeSchemaTarget`）。

关键约束是：已纳入 schema 的字段必须在 schema 默认值表中有默认值。默认值不能分散到渲染组件、编辑器组件或 store 中，否则会重新出现“同一字段多处兜底”的不一致。

`materializeSchemaTarget()` 的语义要保持稳定：
- 字段缺失 -> 用 schema 默认值
- 字段为 `null` / `undefined` -> 用 schema 默认值
- schema 外字段 -> 原样保留（不做拦截，不做命名前缀要求）

后续加字段时，必须同时改三处：字段定义、默认值映射、相关 materialize 使用点；三者缺一会导致“编辑器可见值”和“渲染值”分叉。

现在 schema 里的 `label` / `category` 还承担 i18n 回退文案，`labelKey` / `categoryKey` 才是稳定翻译标识。不要把这四者简化成“只留一种表示”而直接删掉回退值；属性编辑器需要在 locale 未补齐、运行时覆写只给纯文本、或历史 schema 还没迁移完时继续稳定显示。

后续新增 schema 字段时，除了字段定义和默认值，也要同步补对应 locale 词条；否则 UI 不会坏，但会退回英文默认文案。
