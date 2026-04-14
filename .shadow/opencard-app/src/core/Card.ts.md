`Card.ts` 现在明确把 child 关系真相收敛成“container 只持有 `CardBlock[]`，布局真相回到 block 自身的 `simpleLayout` / `flowLayout`”。未来不要再把 `{ block, location }` 这一层包装偷偷加回来，否则渲染、树节点、拖拽、属性面板会再次出现双重真相。

这里的关键约束不是“block 只有一套布局”，而是“block 可以持有两套布局，但当前生效哪套由父容器决定”。因此读取布局时应始终通过 parent/container 语义派生 active layout，而不是只看 block 自身字段名，更不要把 active layout 缓存在树节点 metadata 里。

`card-document` 在布局语义上等价于 simple container。root child 的布局也应落在 `block.simpleLayout`，这样 root 与普通 simple container child 可以共享同一套渲染、测量和编辑逻辑。

Flow 容器里的顺序真相现在是 children 数组顺序本身，而不是 layout 上的 `index` 字段。后续如果有人想“补回 index 方便编辑”，先确认是否真的需要持久化第二份顺序真相；默认不要这样做。

实例覆盖仍然只允许覆盖 block 内容/表现字段，不允许覆盖 `simpleLayout` / `flowLayout`。因为 layout 已经回到 block 自身，如果这里不显式排除，实例系统会悄悄侵入蓝图结构语义。

`normalizeCardDocument()` 是兼容旧 `.opencard` 结构的入口。读取文件后应先过这层，再进入编辑/渲染链路；不要把旧格式兼容分散到各组件里。
