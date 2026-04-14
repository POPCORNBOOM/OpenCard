`propertyEditorSchema.ts` 首先是“类型默认属性定义”的来源，不应直接绑定某个具体业务模式。这里适合承载通用的字段元信息，例如 `datatype`、`label`、`category`，以及可被运行时覆写的默认只读/隐藏状态。

如果某个调用场景需要临时把字段改成只读、隐藏或改标签，更稳的做法是由上游传入 `schemaOverride`，再和这里的默认 schema 做浅合并。这样 schema 本身仍然是通用默认值，而不是把 instance 之类的上下文语义直接编码进 `PropertyEditor.vue`。

公共块样式优先收敛到 `BaseBlock` 上，而不是在具体 block 类型里各自发散。当前统一使用 `background` 作为所有 block 的背景属性，不再保留仅文本块可用的 `backgroundColor` 兼容分支。

`background` 不再是普通字符串字段，而是专门的 `background` datatype。对应的属性编辑器应先尝试解释字符串，能识别为纯色、渐变或图片背景时提供结构化编辑；解释失败时退回原文编辑，而不是强行改写用户输入。

文本的“文字流向”使用 `writingMode` 字段并直接使用 CSS `writing-mode` 值（如 `horizontal-tb` / `vertical-rl` / `vertical-lr`）。schema 应把它当作 string+options，不额外引入转换层。
