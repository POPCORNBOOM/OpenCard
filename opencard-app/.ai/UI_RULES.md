# OpenCard UI 铁律 — Agent 组件开发强制约束

> **核心原则：** 组件的使用者只关心"我写什么 props 得到什么效果"。
> Agent 必须保证：API 可预测、命名自解释、组合即声明、文档即代码。

---

## 第一章：API 设计铁律

### 铁律 1 — Props 即文档，看名字就知道效果

每个 prop 必须满足：**无需查看实现，仅凭名字 + 可选值就能预测视觉结果**。

```vue
<!-- 用户应能直接读懂意图 -->
<OcPanel tone="glass" border="soft" radius="md" elevation="md" />
<OcButton variant="primary" size="lg" icon="action.save" />
<OcText tone="muted" size="label" truncate />
```

命名规则：
- 视觉属性用名词：`tone`, `radius`, `elevation`, `border`
- 行为属性用形容词/动词：`disabled`, `truncate`, `collapsed`, `hoverable`
- 布局属性用物理方向：`orientation`, `gap`, `padding`, `width`, `height`
- 可选值用自然语义词：`sm/md/lg`, `primary/secondary/ghost`, `panel/glass/elevated`

**禁止** 出现需要猜测的 prop 名。如果名字不够自解释，说明 API 设计有问题。

### 铁律 2 — 可选值必须封闭枚举，禁止裸字符串

```ts
// 正确 — 用户在 IDE 里能看到所有可能值
variant?: 'primary' | 'secondary' | 'ghost' | 'choice'
tone?: 'panel' | 'base' | 'elevated' | 'glass' | 'transparent'

// 错误 — 用户不知道能写什么
variant?: string
tone?: string
```

唯一例外：`icon` prop 接受 IconToken 类型（但 IconToken 本身也是有限注册集）。

### 铁律 3 — 组件签名稳定，新增 prop 只追加不修改

- 已有 prop 的名字和可选值 **永不改名**。
- 新增 prop 必须有默认值，不影响已有使用方式。
- 如需废弃 prop，保留一个 major 版本的兼容期。

### 铁律 4 — 每个组件 Props 上限

| 层级 | Props 上限 | 示例 |
|------|-----------|------|
| base 原子组件 | ≤ 12 | OcButton, OcText, OcIcon |
| standard 组合组件 | ≤ 18 | OcTree, OcCard, OcTab |

超过上限必须拆分。OcPanel 当前 20+ props 是遗留问题，未来按铁律 7 拆分。

### 铁律 5 — Slot 即组合点，命名即用途

slot 命名必须是名词，表示"这个位置放什么"：

```vue
<OcCard title="面板" icon="action.settings">
  <template #content>主体内容</template>
</OcCard>

<OcBar title="文件名">
  <template #icon>自定义图标</template>
  <template #append>右侧固定内容</template>
  <template #append-hover>悬停时才显示的操作</template>
</OcBar>
```

标准 slot 名词表（agent 必须从中选取）：
- `default` — 主内容
- `content` — 受控内容区（与 header 分离时用）
- `icon` — 图标位
- `title` — 标题位
- `append` — 尾部追加
- `append-hover` — 悬停时尾部追加
- `leading` — 头部前置
- `footer` — 底部

**禁止** 生造 slot 名。如果标准名词表不够用，先在本文档中登记新名词。

### 铁律 6 — Emit 事件只传结构化 payload

```ts
// 正确 — 用户 @action="handler" 拿到的是有类型的结构体
emit('action', { actionKey: 'delete' })
emit('update:checked', true)
emit('select', { nodeKey: 'block-1', node: treeNode })

// 错误 — 把原生 event 暴露出去让用户自己解析
emit('click', nativeMouseEvent)
```

唯一例外：纯透传的交互事件（如 OcButton 的 `click`）可以传 MouseEvent。

---

## 第二章：Token 体系铁律

### 铁律 7 — 视觉效果只通过 Token 枚举表达

用户在 template 中写的 prop 值，全部来自预定义的 token 枚举。Agent 内部负责将 token 映射到具体 CSS 值。

**当前有效 Token 表（用户需要记住的）：**

| 维度 | Token 值 | 适用组件 |
|------|----------|----------|
| **tone** (背景) | `base`, `panel`, `elevated`, `input`, `transparent`, `glass`, `accent`, `active` | OcPanel |
| **border** | `none`, `transparent`, `soft`, `black`, `accent` | OcPanel |
| **radius** | `none`, `sm`, `md`, `lg` | OcPanel, OcButton |
| **elevation** | `none`, `sm`, `md`, `lg` | OcPanel |
| **size** (控件) | `sm`, `md`, `lg` | OcButton, OcFieldInput |
| **variant** (按钮) | `primary`, `secondary`, `ghost`, `choice` | OcButton |
| **tone** (文本) | `primary`, `secondary`, `muted`, `label`, `info` | OcText |
| **gap** | `none`, `space-1` ~ `space-6` | OcPanel |
| **padding** | `none`, `compact`, `standard` | OcPanel |
| **orientation** | `horizontal`, `vertical` | OcPanel |
| **width/height** | `auto`, `content`, `full`, `screen`, `size-xs` ~ `size-2xl` | OcPanel |

Agent 新增 token 时，必须同步更新此表。

### 铁律 8 — Token 值必须跨组件一致

同一个 token 名在不同组件中必须表达相同语义：
- `sm` 永远表示"紧凑"，`lg` 永远表示"宽松"
- `primary` 在按钮中 = 强调操作，在文本中 = 默认主色
- `accent` 在 border = 主题色边框，在 tone = 主题色填充

**禁止** 同一 token 名在不同组件中含义不同。

---

## 第三章：组合模式铁律

### 铁律 9 — 嵌套即结构，组件自己决定自己的边界

用户通过嵌套表达层级，不需要手动管理间距和对齐：

```vue
<!-- 声明式组合：用户只关心"是什么"，不关心"怎么排" -->
<OcPanel tone="panel" border="soft" radius="md" padding="standard"
         orientation="vertical" gap="space-2">
  <OcBar title="Block Properties" icon="editor.properties" />
  <OcPropertyRow label="Width">
    <OcFieldInput v-model="width" full-width monospace />
  </OcPropertyRow>
  <OcPropertyRow label="Height">
    <OcFieldInput v-model="height" full-width monospace />
  </OcPropertyRow>
</OcPanel>
```

Agent 实现新组件时，内部布局对用户不可见。用户只需知道"这个组件里放什么"。

### 铁律 10 — 不暴露实现选择

```vue
<!-- 正确 — 用户不需要知道内部是 flex 还是 grid -->
<OcPanel orientation="horizontal" gap="space-2">

<!-- 错误 — 暴露了 CSS 实现细节 -->
<OcPanel display="flex" flex-direction="row" css-gap="8px">
```

Prop 名表达"我想要什么效果"，不表达"用什么技术实现"。

### 铁律 11 — 组件组合深度 ≤ 3 层即可表达任何 UI 区域

如果用户需要嵌套超过 3 层基础组件才能实现一个常见 UI 模式，说明缺少一个 standard 层组件。Agent 应主动提议封装。

```
推荐深度：
Layer 1: 区域容器 (OcPanel / OcCard / OcSidebarFrame)
Layer 2: 内容结构 (OcBar / OcPropertyRow / OcTree)
Layer 3: 原子控件 (OcButton / OcFieldInput / OcText / OcIcon)
```

---

## 第四章：文件与命名铁律

### 铁律 12 — 组件命名规则

```
前缀:     Oc
层级:     base/ → 原子    standard/ → 组合    features/ → 业务
文件名:   PascalCase，与 defineOptions.name 一致
```

示例：`OcButton.vue` → `defineOptions({ name: 'OcButton' })`

### 铁律 13 — 每个组件必须有头部注释，一句话说明用途

```vue
<!-- Base 按钮组件：提供多变体、多尺寸的可点击操作触点。 -->
```

格式：`<!-- {层级} {职责}：{一句话使用场景} -->`

用户看到这句话就知道该组件解决什么问题。

### 铁律 14 — index.ts 导出 = 公开 API

只有从 `components/base/index.ts` 或 `components/standard/index.ts` 导出的组件才是用户可以使用的。Agent 的内部辅助组件 **不得** 出现在 index 中。

---

## 第五章：行为一致性铁律

### 铁律 15 — 相同 props 在任何上下文中效果相同

`<OcButton variant="primary" size="sm" />` 无论放在 OcCard header 里还是独立使用，视觉效果必须完全一致。

**禁止** 组件根据祖先上下文改变自身外观（除非通过显式的 CSS 变量覆盖机制）。

### 铁律 16 — disabled 的行为统一

所有支持 `disabled` 的组件：
- 视觉：opacity 降低 + 不响应 hover 样式
- 行为：不触发任何 emit
- 指针：cursor: default + pointer-events: none

### 铁律 17 — v-model 双向绑定遵循 Vue 约定

```vue
<!-- 用户预期这样使用 -->
<OcFieldInput v-model="value" />
<OcCheckbox v-model:checked="isChecked" />
```

Agent 实现时必须使用 `update:modelValue` 或 `update:{propName}` 事件。

---

## 第六章：主题与外观铁律

### 铁律 18 — dark/light 自动适配，用户无需关心

用户写 `<OcPanel tone="panel">` 就会得到正确的深色/浅色外观。Agent 负责在 theme token 中为每个语义 token 提供两套值。

### 铁律 19 — 新增视觉变体时必须同时提供两套主题值

Agent 在 `themes.ts` 中新增 token 值时，`darkThemeTokens` 和 `lightThemeTokens` 必须同步添加，缺一不可。

### 铁律 20 — 组件不接受原始颜色值

```vue
<!-- 正确 — 通过语义 token -->
<OcPanel tone="accent" />
<OcText tone="muted" />

<!-- 错误 — 传入具体颜色 -->
<OcPanel background="#1e1e1e" />
<div style="color: rgba(255,255,255,0.5)">
```

---

## 第七章：Agent 实现约束（用户无需关心但 agent 必须遵守）

### 铁律 21 — CSS 零硬编码

组件 `<style>` 中禁止出现：
- `#hex` 颜色字面量
- `px` 尺寸字面量（`0`, `1px` border, `100%` 除外）
- 裸数字 duration（如 `0.12s`）

全部引用 `--oc-*` CSS 变量。

### 铁律 22 — Props interface 必须完整 JSDoc

每个 prop 注释格式：`/** 做什么。影响什么。 */`
- 错误: `/** 按钮变体 */`
- 正确: `/** 按钮视觉变体。决定背景色、边框色与 hover 效果。 */`

### 铁律 23 — 组件文件不超过 400 行

超过时拆分 composable 或子组件。用户不需要知道拆分细节。

### 铁律 24 — 新组件必须先定义接口

创建新组件的 Agent 工作流：
1. 先写 Props interface + Emits interface + Slot 清单
2. 输出给用户确认 API 设计
3. 确认后再实现

### 铁律 25 — 测试覆盖

每个 base/standard 组件对应一个 `.spec.ts`，最低覆盖：
- 默认渲染无报错
- 每个 variant/size/tone 正确产生对应 class
- emit 正确触发
- disabled 阻止交互

---

## 第八章：使用速查（用户随时翻阅）

### 布局容器

```vue
<!-- 垂直堆叠，间距 8px -->
<OcPanel orientation="vertical" gap="space-2" padding="standard">
  ...
</OcPanel>

<!-- 水平排列，占满宽度 -->
<OcPanel orientation="horizontal" gap="space-2" width="full">
  ...
</OcPanel>

<!-- 毛玻璃浮层 -->
<OcPanel tone="glass" border="soft" radius="md" elevation="md">
  ...
</OcPanel>
```

### 按钮

```vue
<OcButton variant="primary" size="md">保存</OcButton>
<OcButton variant="ghost" icon="action.close" icon-only />
<OcButton variant="secondary" icon="action.add" icon-position="left">新增</OcButton>
<OcButton variant="choice" :active="isSelected">选项 A</OcButton>
```

### 文本

```vue
<OcText tone="primary">正文</OcText>
<OcText tone="muted" size="label" truncate>次要说明可能很长...</OcText>
```

### 卡片

```vue
<OcCard title="属性" icon="editor.properties" variant="panel"
        :actions="[{ key: 'reset', icon: 'action.refresh', title: '重置' }]"
        @action="handleAction">
  <template #content>
    <OcPropertyRow label="宽度">
      <OcFieldInput v-model="width" full-width monospace />
    </OcPropertyRow>
  </template>
</OcCard>
```

### 树

```vue
<OcTree title="Blocks" :data="treeNodes" :selected-keys="[selectedId]"
        enable-drag enable-rename enable-actions
        @select="onSelect" @action="onAction" @rename="onRename" />
```

### 输入

```vue
<OcFieldInput v-model="value" full-width />
<OcFieldInput as="textarea" resize="vertical" monospace />
<OcFieldInput variant="plain" density="compact" size="sm" />
```

### 复选

```vue
<OcCheckbox v-model:checked="enabled" label="启用自动保存" />
```

---

## 第九章：禁止清单

| 编号 | 禁止 | 原因 |
|------|------|------|
| X1 | 在 template 中写内联 style 的颜色/尺寸 | 绕过 token 体系 |
| X2 | 组件 prop 接受 `string` 类型而非枚举 | 用户无法预测可选值 |
| X3 | 同一个 token 名在不同组件中含义不同 | 破坏心智模型 |
| X4 | 组件根据祖先上下文隐式变形 | 不可预测 |
| X5 | Slot 使用动词命名 | 违反声明式原则 |
| X6 | 暴露 CSS 实现细节为 prop | 耦合实现 |
| X7 | 删除/重命名已有 prop 而不全局迁移 | Breaking change |
| X8 | 新增 prop 没有默认值 | 影响已有使用 |
| X9 | 组件文件超过 400 行 | 不可维护 |
| X10 | 缺少头部注释说明 | 用户无法快速理解用途 |

---

## 第十章：Agent 提交前检查

Agent 完成 UI 组件代码后，必须自检：

- [ ] Props 名字自解释？不查实现能猜到效果？
- [ ] 可选值是封闭枚举？IDE 有自动补全？
- [ ] 新 prop 有默认值？不影响已有使用方式？
- [ ] Slot 名是名词？在标准名词表内？
- [ ] 头部注释 `<!-- {层级} {职责}：{一句话} -->` 存在？
- [ ] 相同 props 任何上下文效果一致？
- [ ] dark/light 两套 token 值已提供？
- [ ] 文件行数 ≤ 400？
- [ ] 对应 .spec.ts 已更新？
- [ ] 如涉及新 token，铁律文档 Token 表已更新？
