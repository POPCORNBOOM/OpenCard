`features/workspace/model/fileTypes.ts` 是文件语义唯一入口：
- 统一声明“扩展名/文件名 -> editorId、language、图标、预览能力”。
- 调用方不应自行写 `if ext === ...` 规则。

演进原则：
- 新文件类型优先在这里补语义定义。
- 仅当确实需要新编辑器实现时，再去扩展 editor registry。
- 图标与配色同属文件语义，不下沉到页面层。
