`OcOverlay.vue` 在 OpenCard 的定位是“覆盖关系语义”，不是浮层系统：

- 只表达 base 内容与 overlay 内容的叠放关系。
- `visible / inset / interactive` 是唯一核心控制面，避免把它扩成通用弹层框架。
- 不负责 modal 语义（focus trap、ESC、portal、overlay stack 管理）。

项目内使用约束：

- 在 CDE/viewport 场景里，`OcOverlay` 负责把“工作区内容”和“工具浮层布局”分离。
- 是否可点击穿透必须由 `interactive` 明确表达，不要靠散落样式临时修补。
