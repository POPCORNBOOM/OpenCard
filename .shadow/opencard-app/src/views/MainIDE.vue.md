`MainIDE.vue` 应该是 IDE 页面编排层，而不是文件系统规则层，也不是编辑会话真相层。

这个文件允许保留布局、菜单、tab 区、侧边栏、状态栏、视图切换、预览触发这类“壳层职责”。但打开文件、切换活动文档、保存、路径 remap、dirty 状态，不应再重新沉淀成页面内自己的第二套状态。

文件类型解析、图标选择、语言文案也不应在这里继续散落成 `langMap`、硬编码 `codicon-*`、直接写中文字符串。页面层只消费统一注册中心给出的结果。

这里最容易被未来代理“看起来更方便地”破坏的地方，是重新引入 `currentContent + currentFile + openedFiles` 这样的并行状态源。一旦页面层重新拥有这些真相，文件移动、编辑器切换、草稿保护就会再次分叉。

判断是否该继续瘦身 `MainIDE.vue` 的标准很简单：如果一段逻辑回答的是“磁盘上现在是什么”，它应去 `projectStore`；如果回答的是“用户当前正在编辑什么、改到了什么程度”，它应去 `editorSessionStore`。

文件 Tree 的选中态也应服从这个边界：活动编辑器路径是页面层可消费的“当前文档真相”，`MainIDE.vue` 只负责把它投影到“已打开编辑器”Tree 与项目 Tree 上，而不应再维护一套独立于 `activeSession` 的长期选中来源。

文件树单击预览打开也应遵守这个原则：`MainIDE.vue` 只负责在 `update:selectedKeys` 时调用 session store 的 preview/open API，不自己保存“临时标签页是谁”“哪个 tab 可被替换”这类规则。凡是回答“下一次单击会替换谁”的逻辑，都属于 `editorSessionStore.ts`。

当前约束更新：
- 文件树构建与选中同步细节已抽到 `features/ide-shell/composables/useIdeFileTree.ts`。
- `MainIDE.vue` 只保留树组件绑定与 store 意图转发，不再直接维护树投影算法。

NodeTree 集成约束：
- 页面层只传 `selectedKeys`（字符串数组）和 `v-model:expanded`。
- 严禁重新引入 `selected/update:selected` 这类对象耦合协议。

导出能力也属于页面壳层可编排职责，但它只能消费“当前活动 session 的草稿内容”，不能绕回磁盘再读一份，否则会把未保存编辑丢掉。页面层负责选目录、命名、触发渲染；实例覆写语义必须继续复用 `Card.ts` 的投影 helper，不要在 `MainIDE.vue` 里重新手搓 `instance.data` 合并规则。

隐藏导出渲染器应与可见预览状态分离。未来如果恢复右侧预览面板，不要为了省状态把批量导出临时文档塞回预览状态源，否则导出流程会反向污染页面展示。

导出截图前不能只等 `nextTick + requestAnimationFrame`，因为 `<img>` 资源加载晚于 DOM 提交。只要蓝图/实例之间可能切换图片，页面层就必须先等隐藏导出树里的图片完成 `load/decode`，否则批量导出会截到空白图或上一张图。

当前约束更新：
- 导出流程细节已抽到 `features/ide-shell/composables/useIdeExport.ts`。
- `MainIDE.vue` 只保留菜单按钮绑定与隐藏导出渲染器挂载，不再维护导出命名、队列、图片等待、写文件等细节实现。

全局快捷键路由约束（新增）：
- `Ctrl/Cmd+S` 继续走“当前编辑器 save 或会话 save”分发。
- `Ctrl/Cmd+Z`、`Ctrl/Cmd+Shift+Z`、`Ctrl/Cmd+Y` 仅在活动编辑器为 `card-designer` 时拦截并转发到编辑器暴露的 `undo/redo`。
- 不得在页面层实现文档回放逻辑；页面层只做键盘事件路由与 `preventDefault` 控制。
