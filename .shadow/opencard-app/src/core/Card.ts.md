`Card.ts` 的当前边界是“raw 文档真相 + 视图投影物化”。`materializeCardDocument/materializeCardBlock` 只用于渲染和计算投影，不用于把编辑态文档写满默认值。

`resolveCardDocumentInstanceView()` 只做 instance 对蓝图的字段覆写，不做默认值补齐。默认值补齐由调用方在显示阶段统一走 materialize。这样可以保持存储稀疏，同时让渲染稳定。

factory (`createTextBlock/createImageBlock/...`) 应返回稀疏对象，不要把 `undefined` 字段写入对象键。否则属性编辑器会误判字段“已存在”，导致 `+` 行为退化。

实例覆写仍遵循：schema 已知字段在显示/渲染时可由 `null` 回落默认值；schema 外字段原样透传，不做拦截。
