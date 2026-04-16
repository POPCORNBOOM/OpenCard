这里的关键职责是维护“编辑真相是 raw 文档”。`applyDocumentContent` 只做 parse，不做整文档 materialize。

渲染使用 `resolvedCardDoc` 投影：先按实例做覆写，再 `materializeCardDocument`。这样渲染拿到完整值，但存储仍保持稀疏。

Block 属性面板目标值使用“只解析已有键”的默认值修正（`resolveSchemaDefaultsForPresentKeys`），目的是让 null 显示为默认值，同时保留缺失字段的 `+` 入口。

写回策略边界不变：
- `Layout` 永远写蓝图结构
- `Block` 在实例模式写 `instance.data[blockId]`
不要把投影对象当成写回真相。
