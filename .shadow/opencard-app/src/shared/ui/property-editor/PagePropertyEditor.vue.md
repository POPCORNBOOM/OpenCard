`PagePropertyEditor` 是 PropertyEditor 的页面级变体：它只负责递归布局和事件路径，不拥有业务 Store。

- `EditorItem` 可以同时有 content 和 children；children 始终展开，深度只决定整行缩进。
- editor Part 复用 `PropertyEditorFieldDefinition`，页面变体负责 Settings 原生 number/boolean 与字段组件字符串协议之间的转换。
- before 插槽承载页面级装饰（如 Appearance 预览），不要把非字段视觉内容伪装成 JSON 字段。
