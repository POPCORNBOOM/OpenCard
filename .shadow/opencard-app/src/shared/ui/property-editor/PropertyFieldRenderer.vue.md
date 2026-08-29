字段 Renderer 同时保留旧的 `update:value` 兼容语义，并额外转发 preview/commit/cancel。

- 既有 PropertyEditor 只消费 update，不因页面级预览协议改变行为。
- number 的 slider presentation 和颜色的取消预览属于展示协议，不改变卡牌文档的字符串值模型。
