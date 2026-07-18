# Standard Components

`components/standard` 保存由 base primitive 组合出的通用交互协议。

- `OcActionButton`、`OcActionGroup`：定义式 action 渲染与意图输出。
- `OcBar`、`OcCard`：结构化 section；`OcCard` 直接绘制表面，不嵌套 Surface/Stack。
- `OcColorField`：色块、原生 picker 与文本值共享一个 FieldFrame。
- `OcOptionGroup`：互斥选择、radiogroup 语义与 roving tabindex。
- `OcTree`：key-only tree view model 与统一 intent。
- `OcTrackLayout`：可调整单轴轨道布局。
- `OcJsonEditor`、`OcMenuItemButton`、`OcTab`：对应的标准编辑或导航协议。

Standard 组件不读取领域 model，也不直接执行领域写回。
