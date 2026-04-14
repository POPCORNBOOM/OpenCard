`propertyEditorSchema.ts` 首先是“类型默认属性定义”的来源，不应直接绑定某个具体业务模式。这里适合承载通用的字段元信息，例如 `datatype`、`label`、`category`，以及可被运行时覆写的默认只读/隐藏状态。

如果某个调用场景需要临时把字段改成只读、隐藏或改标签，更稳的做法是由上游传入 `schemaOverride`，再和这里的默认 schema 做浅合并。这样 schema 本身仍然是通用默认值，而不是把 instance 之类的上下文语义直接编码进 `PropertyEditor.vue`。
