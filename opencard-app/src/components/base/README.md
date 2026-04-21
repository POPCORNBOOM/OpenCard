# Base Components

这个目录用于放置可复用、无业务语义的基础控件。

当前约定：

- `OcButton`：统一按钮入口，受控参数包括 `variant`、`size`、`radius`、`icon` 等。
- 基础控件只负责视觉和交互语义，不直接依赖业务 store 或业务领域对象。
- 业务组件优先从这里组合，而不是重复写原生控件样式。
- `base` 组件必须由 `src/shared/ui/primitives` 组合实现，不可新增独立视觉体系。
- 非必要场景禁止在业务组件直接写原生 `button/input/select/textarea`；优先使用 `OcButton/OcFieldInput`。
