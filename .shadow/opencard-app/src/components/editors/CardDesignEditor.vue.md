`CardDesignEditor.vue` 是“文档真相层”，负责消费属性编辑意图并落地写回：
- 编辑真相是 raw 文档；渲染使用 `viewDoc` 投影。
- `resolveNulls` 仅用于属性面板展示，避免把稀疏文档写满。

与 `PropertyEditor` 的协议边界：
- 输入给属性编辑器：`{ key, record, override? }[]`。
- 回收事件：`update-property`、`add-property`、`reset-property`。
- 路由分流只看 `sourceKey`，不依赖标题文案。

写回策略：
- `sourceKey = layout`：始终写蓝图布局对象。
- `sourceKey = block`：
  - 蓝图模式写 block 本体。
  - 实例模式写 `instance.data[blockId]` 覆写。

重置策略（业务层定义）：
- 蓝图/layout：重置为 schema 默认值；无默认值则删键。
- 实例 block：删除 override 键，使其回落到蓝图值。
- 当实例 block 的 override 变空时，删除该 block 的 override 对象。

override 注入策略：
- 在实例模式下，`PropertyEditor` 输入的 `override` 会把当前 override 键标记为 `resettable: true`。
- 这样 reset 按钮只出现在“当前确实有实例覆写”的字段上。

不可回退约束：
- 不得回退到通过对象身份判断写回目标。
- 不得让 `PropertyEditor` 承担写回语义。

面板尺寸语义约束：
- 右侧“信息树/属性”分隔拖拽以“信息树绝对像素高度”为真相，不使用比例分配。
- 属性面板高度应由 `总高度 - 信息树高度 - 分隔条高度` 推导。

撤销入口约束（新增）：
- 所有文档修改必须通过 `markDocumentChanged(mode)` 上报：
  - 属性 `@input` 路径使用 `mode='typing'`。
  - 树/实例增删改拖拽、reset、rename、resize/move 使用 `mode='action'`。
- 不允许在组件内再维护第二套防抖或历史栈。

编辑器暴露协议（新增）：
- `defineExpose` 必须提供 `save/undo/redo/canUndo/canRedo`。
- `undo/redo` 后只做“选择有效性修正”，不恢复历史选择快照。
