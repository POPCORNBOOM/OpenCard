# OpenCard UI 风格宪章（Agent 约束版）

> 目标：让任何 Agent 在做 OpenCard UI 时，产出稳定、统一、可验收的结果。  
> 参考风格：你提供的界面图（桌面 IDE 型编辑器，浅灰基底 + 紫色强调 + 高密度信息布局）。

## 1. 北极星定义

OpenCard 的产品 UI 是「专业创作工具界面」，不是营销站点。

- 气质关键词：克制、清晰、稳定、可扫描、高效率
- 首屏目标：3 秒内看懂「导航区 / 工作区 / 检查区」
- 视觉重心：内容和结构优先，装饰效果次要

## 2. 不可违背的硬规则（MUST）

1. 只允许一个主强调色系（紫色系），其余颜色用于中性色和语义状态。
2. 所有颜色、圆角、间距、阴影必须走 Design Token，不允许在组件里散落硬编码。
3. 结构固定为三段式工作台：`导航`、`主编辑区`、`右侧检查器`。
4. 面板风格统一：浅底、细边框、轻阴影、小圆角，不得混入重拟物或重渐变。
5. 同层组件高度要网格对齐（4px 基线，常用 8/12/16 间距）。
6. 文案风格用“工具语言”，禁止营销文案（如“革命性”“惊艳”）。
7. 每次迭代先对齐布局和 token，再做局部视觉细节。

## 3. 禁止项（MUST NOT）

1. 不允许多强调色并存（例如紫 + 橙 + 青同时抢主视觉）。
2. 不允许大面积炫光、玻璃拟态、强渐变背景覆盖工作区。
3. 不允许把业务面板做成大量卡片瀑布流。
4. 不允许在同一屏幕混用超过 2 种圆角体系。
5. 不允许在组件内直接写 `#xxxxxx`（除临时调试）。
6. 不允许新增组件不定义 hover / active / disabled / focus。

## 4. 基础 Design Token（以参考图为准）

```css
:root {
  /* Neutral */
  --oc-bg-app: #f5f6fb;
  --oc-bg-surface: #ffffff;
  --oc-bg-subtle: #f1f2f7;
  --oc-border-default: #e6e8f0;
  --oc-border-strong: #d9dced;
  --oc-text-primary: #1f2430;
  --oc-text-secondary: #5b6272;
  --oc-text-muted: #8b92a3;

  /* Accent (single hue family) */
  --oc-accent-500: #7c6cff;
  --oc-accent-400: #9b90ff;
  --oc-accent-100: #eeebff;
  --oc-accent-focus: rgba(124, 108, 255, 0.28);

  /* Status */
  --oc-success: #22a06b;
  --oc-warning: #c69026;
  --oc-danger: #d14343;

  /* Radius */
  --oc-radius-sm: 8px;
  --oc-radius-md: 10px;
  --oc-radius-lg: 12px;

  /* Shadow */
  --oc-shadow-sm: 0 1px 2px rgba(27, 31, 35, 0.06);
  --oc-shadow-md: 0 6px 20px rgba(31, 36, 48, 0.08);

  /* Motion */
  --oc-ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --oc-dur-fast: 120ms;
  --oc-dur-base: 180ms;
}
```

## 5. 布局骨架约束（桌面端）

- 顶栏（窗口+菜单）高度：48-56px
- 左侧主导航栏：64-76px
- 资源/列表列：260-320px
- 主画布区：优先自适应填充，保持最大可视面积
- 右侧属性检查器：300-360px
- 面板间距：8-12px

任何新页面必须先满足：
1. 一眼分辨三大区域  
2. 工具操作靠近对象（就近原则）  
3. 主要编辑对象占视觉焦点

## 6. 组件语法约束

- `Panel`：`surface + 1px border + md radius + sm shadow`
- `ToolbarButton`：默认中性，hover 轻底色，active 用 accent tint
- `ListItem`：选中态使用 `--oc-accent-100` + 左侧或底部细强调线
- `Inspector Field`：标签与输入垂直节奏一致，字段高度统一
- `Tree`：缩进、图标、命名区固定列逻辑，避免跳动

## 7. 交互与动效约束

- 动效只做三类：进入、状态切换、浮层开合
- 时长：`120-180ms`
- 曲线：统一 `--oc-ease-standard`
- 禁止无意义持续动画（呼吸、漂浮、频闪）
- 键盘可达：可聚焦元素必须有清晰 focus ring（accent focus）

## 8. Agent 执行协议（每次 UI 任务都要遵守）

1. 先输出 3 行：
   - 视觉论点（这次页面最重要的视觉目标）
   - 布局论点（信息架构怎么分区）
   - 交互论点（这次只做哪 2-3 个关键交互）
2. 先改 token/骨架，再改局部组件，不允许上来堆细节。
3. 单次改动保持小步提交，优先 1-3 个组件范围。
4. 最后必须做自检清单（见第 9 节），不通过则继续迭代。

## 8.1 Primitives 分层边界（强制）

- `foundation`（`src/shared/ui/foundation`）只定义 token 与主题注册，不写业务样式。
- `primitives`（`src/shared/ui/primitives`）提供原语：`OcBox/OcText/OcSurface/OcPressable/OcFocusRing/OcFieldCore/OcScrollArea/OcIcon`。
- `base`（`src/components/base`）只能组合 primitives，不得创建新的视觉 token 体系。
- `features/views/components` 默认禁止直接新增原生 `button/input/select/textarea`。
- 豁免仅限：
  1. 浏览器原生特性控件（如 `input[type="color"]`）
  2. 高性能画布交互句柄（如视图区 resize handle）
  3. 经审查明确记录的兼容性场景

## 9. 验收清单（PR Gate）

1. 是否只存在一组主 accent 色相？
2. 新增样式是否全部引用 token？
3. 三段式布局是否清晰可辨？
4. 面板风格是否统一（圆角/边框/阴影一致）？
5. 文案是否为工具语言而非营销语言？
6. 交互状态是否完整（hover/active/focus/disabled）？
7. 在 1440px 和 1024px 下是否仍保持稳定密度与层级？

只要有任一项为“否”，该 UI 任务视为未完成。

## 9.1 UI Kit 基线（强制）

- `src/views/UiKitShowcase.vue` 是组件视觉验收基线页面。
- 新增或改动 `primitives/base` 组件时，必须在 UI Kit 单页补齐对应示例矩阵。
- 示例矩阵固定四列：`Default / Variants / States / Layout`。
- 任何组件风格调整以 UI Kit 页面观感为第一验收标准，再进入业务页面联调。

## 9.2 UI Kit 登记流程（强制）

新增/改动 `primitives/base` 组件时，必须同时完成：

1. 在 `src/views/ui-kit/catalog.ts` 增加/更新组件条目（标题、用途、状态覆盖）。
2. 在 `src/components/ui-kit/ShowcaseExampleRenderer.vue` 增加/更新同 `exampleId` 的四列渲染。
3. 保证 `view=ui-kit` 页面可见且矩阵完整，再跑门禁命令：
   - `npm run lint:ui`
   - `npm test`
   - `npm run build`
4. 任一步缺失，视为 UI 任务未完成，不允许进入业务联调提交。

## 10. 给 Agent 的直接 Prompt 模板

```md
你正在为 OpenCard 设计/实现 UI。必须遵循 `opencard-app/UI_STYLE_CHARTER.md`。

强制要求：
1) 保持浅灰 IDE 风格，单一紫色强调色
2) 先布局后细节，先 token 后组件
3) 不用营销化语言，不堆卡片，不加多余装饰
4) 最终输出前逐条回答 PR Gate 7 项

先给我：
- 视觉论点（1 句）
- 布局骨架（3 区域）
- 本次仅改动的组件范围（最多 3 个）
```
