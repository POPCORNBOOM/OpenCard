# OpenCard 控件库重构思想清单（Agent 必遵）

> 日期：2026-04-23  
> 目的：这不是修复任务单，而是**重构思想与标准模式清单**。任何 agent 参与 UI 重构，必须遵循本文的思想与模板。

## 1. 文档定位

- 本文只定义：思想、标准模式、反模式、文件类别模板。
- 本文不定义：某次任务要改哪些组件、按什么顺序修哪些问题。
- 判定标准：实现是否符合“模式”，而不是是否“看起来差不多”。

## 2. 借鉴 Vuetify 的核心思想（必须内化）

## 思想 A：能力组合优先于组件复制

- 不在每个组件里重复写一套边框/尺寸/variant/theme 逻辑。
- 统一抽为能力模块，再在组件层组合。

## 思想 B：Props 是契约，不是样式逃生口

- Props 必须表达语义（`variant/size/density/tone`），而不是任意 CSS 字符串。
- “能传任意 string 就万事大吉”是设计系统失效的起点。

## 思想 C：状态逻辑可复用、可测试

- hover/active/focus/disabled/selected 等状态不是局部样式细节，而是系统能力。
- 状态映射必须可复用，不允许组件各自发明。

## 思想 D：默认值系统是统一性的基础设施

- 组件默认行为应可全局/局部注入，而不是业务层重复传一遍 props。
- 控件库应支持“策略级默认值”，不是“页面级临时修补”。

## 思想 E：主题是服务，不是散装变量

- token 必须集中注册、主题集中管理、运行时统一应用。
- 变量存在即契约；使用了但未注册，等于契约断裂。

## 思想 F：分层边界严格执行

- `foundation` 定义系统语义。
- `primitives` 承载基础能力。
- `base` 只组合 primitives。
- `features/views` 只消费 base（豁免必须显式登记）。

## 思想 G：可访问性是默认能力，不是补丁

- 键盘交互、焦点可见性、ARIA 语义必须内建在组件契约里。
- 不接受“视觉上能点就行”。

## 3. OpenCard 当前反模式（禁止继续扩散）

以下是本次调查提炼的“反模式类型”，它们可作为代码评审的否决项。

## 反模式 1：Token 漂移

- 使用了 token，但 token 未在主题系统注册（如 `--oc-bg-subtle`、`--oc-border-default` 现象）。
- 后果：主题不可预测、替换主题时破裂。

## 反模式 2：同一语义多套实现

- 图标系统双轨并存（`OcIcon` 与 `AppIcon` 各自维护语义与色彩路径）。
- 后果：语义映射分叉、维护成本指数增长。

## 反模式 3：base 组件绕过 primitives

- base 层直接写大量视觉与交互细节，未复用 primitive 能力。
- 后果：base 变成“第二套 primitive”，分层名存实亡。

## 反模式 4：任意字符串 props

- `padding/width/height/...` 任意 string 透传导致样式失控。
- 后果：组件 API 失去约束力，控件库退化为样式容器。

## 反模式 5：状态策略分散

- 相同状态（hover/focus/active/disabled）在不同组件中映射不一致。
- 后果：用户感知不统一，测试矩阵不可收敛。

## 反模式 6：业务层直接写原生交互控件

- 未经登记地直接使用 `input/select/textarea/button`。
- 后果：主题与行为一致性被绕开。

## 反模式 7：可访问性“看情况”

- 仅鼠标交互，无键盘模型；ARIA 语义缺失或不完整。
- 后果：无障碍和键盘效率双失败。

## 4. 标准模式（必须采用）

## 模式 P1：能力 Props 工厂模式

- 任何高复用能力（variant/size/density/rounded/theme）必须采用统一 props 结构。
- 组件不重复定义同类枚举含义。

## 模式 P2：能力 Composable 模式

- 视觉状态与交互状态通过 composable 产出 class/style/attrs。
- 组件主体只做结构拼装与 slot 组合。

## 模式 P3：默认值注入模式

- 组件默认值允许从系统级和局部容器注入。
- 业务层不应重复写同一批默认 props。

## 模式 P4：主题服务模式

- token key 集中定义、主题值集中注册、应用逻辑集中执行。
- 禁止在组件散落“临时主题变量定义”。

## 模式 P5：单一图标语义模式

- 图标语义 key 只有一套注册中心。
- 组件只消费语义，不消费“图标来源实现细节”。

## 模式 P6：受控扩展模式

- 扩展点优先 `slot + variant + token key`。
- 最后手段才允许 class 透传，且需标注目的与边界。

## 模式 P7：A11y 合同模式

- 每个交互控件必须定义：键盘行为、ARIA 语义、焦点可见策略。
- 不允许“只定义视觉，无输入合同”。

## 5. 按文件类别的统一模板（直接套用）

## 5.1 `foundation/themeTokens.ts` 模板

```ts
// 只定义 token key 与类型，不放主题值
export const OC_THEME_TOKEN_KEYS = [
  '--oc-bg-*',
  '--oc-border-*',
  '--oc-text-*',
  '--oc-space-*',
  '--oc-radius-*',
  '--oc-motion-*',
] as const

export type OcThemeTokenKey = (typeof OC_THEME_TOKEN_KEYS)[number]
export type OcThemeTokens = Record<OcThemeTokenKey, string>
```

约束：
- key 命名必须是语义层，不是组件层（禁止 `--tabbar-bg-x` 这类组件专用 token）。

## 5.2 `foundation/themes.ts` 模板

```ts
import type { OcThemeTokens } from './themeTokens'

const lightTheme: OcThemeTokens = { /* 全量映射 */ }
const darkTheme: OcThemeTokens = { /* 全量映射 */ }

export const OC_THEME_REGISTRY = { light: lightTheme, dark: darkTheme }
```

约束：
- 每个主题必须覆盖全部 token key，不允许“缺省靠运气”。

## 5.3 `foundation/theme.ts` 模板

```ts
export function setOcTheme(themeId: string): void {
  // normalize -> apply -> root dataset -> cache
}

export function getOcTheme(): string {
  // return currentTheme
}
```

约束：
- 主题应用逻辑唯一入口；禁止组件内直接写 `documentElement.style.setProperty(...)`。

## 5.4 `shared/ui/composables/*` 模板

```ts
export function makeOcVariantProps() { /* enum contract */ }
export function useOcVariant(props: { variant: string }) {
  return { variantClass, variantStyle }
}
```

约束：
- composable 只做能力映射，不做业务语义判断。

## 5.5 `shared/ui/primitives/*.vue` 模板

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useOcVariant, useOcDensity, useOcTheme } from '../composables/*'

const props = withDefaults(defineProps<{
  variant?: '...'
  size?: '...'
  disabled?: boolean
}>(), { /* 受控默认值 */ })

const { variantClass } = useOcVariant(props)
</script>

<template>
  <component :is="as" class="oc-primitive" :class="[variantClass]" />
</template>
```

约束：
- primitive 不得承载业务语义文案与业务流程。
- primitive 不接受任意 CSS 字符串 props。

## 5.6 `components/base/*.vue` 模板

```vue
<script setup lang="ts">
import { OcPressable, OcText, OcIcon } from '../../shared/ui/primitives'

const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
}>(), { variant: 'secondary', size: 'md' })
</script>

<template>
  <OcPressable :variant="variant" :size="size">
    <OcIcon v-if="icon" :name="icon" />
    <OcText><slot /></OcText>
  </OcPressable>
</template>
```

约束：
- base 只能组合 primitives + base 内部逻辑，不得另起视觉体系。
- base props 必须保持语义化，不做样式逃生口。

## 5.7 `components/ui/*.vue` / `features/*` 消费模板

```vue
<template>
  <OcToolbar kind="panel">
    <OcToolButton icon="..." />
  </OcToolbar>
</template>
```

约束：
- 默认只消费 base 组件。
- 原生控件必须走“豁免登记 + 统一包装”。

## 5.8 `components/ui/icon/*` 模板

```ts
export const iconRegistry = {
  'domain.action': { kind: 'codicon' | 'mdi', value: '...' },
} as const

export function resolveIcon(name: string) { /* 唯一入口 */ }
```

约束：
- 图标语义与颜色/尺寸策略分离。
- 禁止第二套 icon registry。

## 5.9 `views/ui-kit/*` 模板

```ts
// catalog.ts
{
  id: 'base-xxx',
  demoBlocks: ['default', 'variants', 'states', 'layout'],
  stateCoverage: ['hover', 'active', 'focus', 'disabled']
}
```

约束：
- 每个组件必须有四列矩阵，且状态覆盖与契约一致。

## 5.10 `*.spec.ts` 模板

```ts
describe('OcXxx', () => {
  it('maps semantic props to classes')
  it('exposes complete keyboard behavior')
  it('applies aria contract')
  it('handles disabled/focus/active states')
})
```

约束：
- 测试必须验证“语义合同”，不是只快照 DOM。

## 6. 审查口令（Code Review 必问）

1. 这段实现是在复用能力，还是在复制能力？
2. 这个 props 是语义合同，还是样式逃生口？
3. token 是否全量注册并可追踪？
4. 是否引入了第二套语义系统（图标/状态/颜色）？
5. 键盘与 ARIA 合同是否完整？
6. 这份代码是否仍然符合四层边界？

若任一问题回答为“否”，则该重构不通过。

## 7. 参考（Vuetify 思想锚点）

- VBtn 组合能力聚合：  
  https://app.unpkg.com/vuetify%403.7.3/files/lib/components/VBtn/VBtn.mjs
- Variant composable：  
  https://app.unpkg.com/vuetify%403.1.15/files/lib/composables/variant.mjs
- Defaults provider/composable：  
  https://app.unpkg.com/vuetify%403.2.5/files/lib/components/VDefaultsProvider/VDefaultsProvider.mjs  
  https://app.unpkg.com/vuetify%403.1.8/files/lib/composables/defaults.mjs
- Theme composable：  
  https://app.unpkg.com/vuetify%403.3.12/files/lib/composables/theme.mjs

