`CardViewport.vue` 负责的是选区测量和变换意图发射，不是文档写回本身。它可以计算 resize / move 的预览框和 payload，但不应持有“改蓝图还是改实例”的领域判断。

这里的 move 和 resize 状态机必须互斥。尤其是简单容器选区既可拖动又有 resize handle 时，resize 必须优先于 move；不要让一次 handle 拖拽同时落到两条分支。未来如果再改 pointer 事件，保持这条约束：handle 交互只产生 `resize-selection`，框体拖动只产生 `move-selection`。

选框拖动只应该响应左键。中键继续保留给 viewport 平移，不要让中键按在 selection frame 上时也触发 move。
这意味着 selection frame 不能在模板层无条件使用 `@pointerdown.stop.prevent`；否则中键虽然在处理函数里被忽略，事件仍然已经被 Vue 修饰符截断。正确做法是放开模板修饰符，只在左键 move 分支里手动 `stopPropagation()` / `preventDefault()`。

当前项目里 viewport 反推简单容器 `location.x/y` 会带一个稳定的常量偏移，现阶段采用的是编辑器层的固定补偿而不是更复杂的 DOM 坐标系重建：`handleSelectionResize` 和 `handleSelectionMove` 在写回简单容器的 `location.x/y` 时统一减去 `2px`。这条约束是为了消除实测稳定出现的 `+2px/+2px` 漂移；后续如果重做 viewport 测量，再重新验证这条补偿是否还能保留。
