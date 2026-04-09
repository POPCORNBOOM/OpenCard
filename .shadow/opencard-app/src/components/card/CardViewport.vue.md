`CardViewport.vue` 负责的是选区测量和变换意图发射，不是文档写回本身。它可以计算 resize / move 的预览框和 payload，但不应持有“改蓝图还是改实例”的领域判断。

这里的 move 和 resize 状态机必须互斥。尤其是简单容器选区既可拖动又有 resize handle 时，resize 必须优先于 move；不要让一次 handle 拖拽同时落到两条分支。未来如果再改 pointer 事件，保持这条约束：handle 交互只产生 `resize-selection`，框体拖动只产生 `move-selection`。
