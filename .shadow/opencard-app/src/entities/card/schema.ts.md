`entities/card/schema.ts` 维护属性编辑元协议与默认值规则，是 UI 与领域间的字段真相字典。

双默认值策略必须严格区分：
- `fillDefaults`：补齐缺失/空值，服务渲染投影。
- `resolveNulls`：只修复已有键的空值，服务属性面板显示。
- 禁止混用，避免把稀疏编辑态写满默认字段。

扩展约束：
- 新字段要同步：schema 定义 + 默认值映射（如需要默认值）。
- schema 只维护字段语义，不维护 `label/labelKey/category/categoryKey` 等本地化解析细节。
- 分类只通过 `categoryId` 表达；若字段展示文案需要特殊 key（如 `color -> textColor`），通过 `displayFieldKey` 提供语义映射。
- schema 外字段保持透传，由上层决定是否展示/写回。
