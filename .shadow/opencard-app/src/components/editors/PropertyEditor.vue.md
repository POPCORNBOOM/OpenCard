`PropertyEditor.vue` 是“属性协议解释器”，不是业务写回器：
- 输入：`inputs: { key, record, override? }[]` 与 `sortMode`。
- 输出：`update-property`、`add-property`、`reset-property`。
- 负责：schema 解析、分类展示（含本地化）、field 编辑器分派、缺失字段添加入口。
- 不负责：蓝图/实例/布局具体写回语义。

设计哲学（本模块）：
- 显式优先于隐式：事件只传稳定标识与意图，不传对象引用。
- 可见性优先于“数据整洁幻觉”：record 里的 schema 外字段必须可见，不允许静默吞掉。
- 缺失字段是能力入口：schema 定义但 record 缺失，必须进入 `+` 添加路径。
- 重置是协议能力：`resettable` 只声明可重置，不在本模块实现重置业务规则。

通信协议约束：
- 更新/新增 payload：`{ sourceKey, fieldKey, value }`。
- 重置 payload：`{ sourceKey, fieldKey }`。
- 禁止回传 `record`、`target` 或任何可变对象引用。

字段展示约束：
- schema 已定义字段：按 datatype 分派对应 field 组件。
- datatype 分派表是单一事实源：每个 datatype 必须同时声明 `component + icon`，行标签图标与“添加字段”菜单图标共用同一映射。
- schema 外字段：统一按只读 string 展示（不做 datatype 推断）。
- `isHidden` 字段无论是否存在于 record 都不显示。

分类与本地化约束：
- 分类标题优先走 `categoryKey`，缺失回退 `category`，再回退 source 标题。
- source 标题优先走 `propertyEditor.sources.<key>`。
- schema 外字段统一归入 `propertyEditor.categories.uncategorized`。

不可回退约束：
- 不得回退到对象引用事件协议。
- 不得在组件内加入业务写回、持久化或实例策略判断。

注释风格约束：
- 与 `NodeTree.vue` 对齐：顶部块注释 + 脚本内短句单行注释。
- 模板固化在 `.shadow/CODE_COMMENT_TEMPLATE.md`。
