`Card.ts` 的当前核心约束是“渲染前必须先物化”，不要再让组件层自己兜底缺省值。入口是 `materializeCardDocument()` / `materializeCardBlock()`，它们负责把 schema 默认值补齐并修正最小结构（如缺失 id 生成、children/location 结构归一）。

实例覆写语义在这里被定死：对 schema 已知字段，`null` / `undefined` / 缺失都会回到 schema 默认值；对 schema 未知字段，保持原样透传。这让“灵活扩展字段”与“稳定核心字段”同时成立。

`resolveCardDocumentInstanceView()` 产出的对象是“显示投影”，不是写回真相。它保留蓝图层级结构，用 instance 数据覆写 block 字段后再递归返回。未来不要把该投影对象拿去做结构编辑写回。

`createTextBlock/createImageBlock/createSimpleContainerBlock/createFlowContainerBlock` 必须继续返回“已物化块”。后续新增 block 类型时，务必补齐：type schema、默认值、materialize 分支、factory 分支。
