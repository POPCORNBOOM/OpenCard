# PropertyEditor Generalization, Additional Fields, and Completion Providers

## Goal

将 PropertyEditor 收紧为通用 records 展示器：上级提供 record、完整字段 UI definitions 和 Category definitions；PropertyEditor 不查询 Card schema、不读取领域对象、不管理新增字段弹窗，也不知道 binding、parent 或文件系统语义。

Block 的额外字段值与原生字段值平铺在根部，仅额外字段的 `datatype/title` 持久化在 `additionalFieldDefinition`。补全统一为静态候选或上级 Provider，EditorField 只执行通用输入规则、显示候选并返回新值。

## Locked Decisions

- [ ] 不保留兼容层，不迁移旧 `customFields` 文件。
- [ ] 原生字段 definition 由上级根据 `record.type + schema` 取得，额外字段 definition 来自 `additionalFieldDefinition`，合并后送入 PropertyEditor。
- [ ] PropertyEditor 永远只消费 records 和已解析 UI definitions，不调用 Card schema 或 Store。
- [ ] `datatype -> Vue EditorField` 映射继续内化在 PropertyEditor。
- [ ] Category 标题、图标和顺序由上级传入；缺失或无效 Category 统一进入 PropertyEditor 自动生成的“其他”，并排在最后。
- [ ] 缺失但 schema 已定义的原生字段继续由 Category 内添加菜单处理。
- [ ] 属性卡片标题栏加号只负责创建全新额外字段；弹窗、校验和写回全部由上级控制。
- [ ] `deletable` 是字段 UI definition 的通用能力；第一次点击进入待确认态，第二次点击同一按钮才 emit 删除，无弹窗、无影响数量提示。
- [ ] 普通值保持真实 `string/number/boolean`；只有 binding 保存完整 `{{...}}` 字符串。
- [ ] binding 采用默认允许、显式禁止的 `acceptsBinding?: false / exposesReference?: false` 黑名单。

## Persisted Domain Contract

```ts
interface AdditionalFieldDefinition {
  datatype: PropertyDatatype
  title?: string
}

interface BaseBlock {
  additionalFieldDefinition?: Record<string, AdditionalFieldDefinition>
}
```

额外字段值直接写在 Block 根部：

```ts
{
  type: 'text-block',
  id: 'text-1',
  content: 'Damage',
  score: 12,
  additionalFieldDefinition: {
    score: { datatype: 'number', title: '分数' },
  },
}
```

- [x] 删除 `CustomFieldDefinition/CustomFieldMap/CustomFieldDatatype/customFieldDatatypes/customFields`。
- [x] `additionalFieldDatatypes` 只是 `readonly PropertyDatatype[]` 创建允许列表，不创建第二套 datatype 类型。
- [x] `additionalFieldDefinition` 在 Card schema 中隐藏，并禁止 binding 与 reference exposure。
- [x] key 使用 `^[A-Za-z_][A-Za-z0-9_]*$`，不区分大小写检查原生 schema、Block 根字段、额外定义和保留结构名冲突。
- [x] 创建时使用通用 `createPropertyDefaultValue()`，写入根值与 definition。
- [x] 删除时删除根值、definition 和所有实例同名 override；遗留表达式继续产生 `FIELD_NOT_FOUND`。
- [x] `applyInstance` 将 override 直接写到投影 Block 根字段；实例仍使用 `instance.data[blockId][fieldKey]`。

## PropertyEditor Public Contract

```ts
type PropertyEditorRecord = Readonly<Record<string, unknown>>

interface PropertyEditorInput {
  key: string
  title?: string
  record: PropertyEditorRecord
  fields: Readonly<Record<string, PropertyEditorFieldDefinition>>
}

interface PropertyEditorCategoryDefinition {
  title: string
  icon?: IconToken
}

interface PropertyEditorProps {
  inputs: readonly PropertyEditorInput[]
  categories?: ReadonlyMap<string, PropertyEditorCategoryDefinition>
  sortMode?: 'category' | 'alphabetical'
}
```

`PropertyEditorFieldDefinition` 是上级解析完成的 UI definition，在现有 datatype constraints 同级增加：

```ts
{
  title: string
  category?: string
  resettable?: boolean
  deletable?: boolean
  autoPairs?: readonly PropertyInputPair[]
  completion?: PropertyCompletion
}
```

- [ ] 上级保证每个可展示 record key 都有 field definition；开发环境发现缺失 definition 时警告并跳过，不做 datatype 推断。
- [ ] definitions 可以包含 record 尚未拥有的原生字段，PropertyEditor 将其列为可添加字段。
- [ ] 删除 `PropertyEditorInput.override/fieldLabels/customFields`、`PropertyEditorSchemaOverride` 和独立 `referenceContexts` prop。
- [ ] PropertyEditor 保留 `update-property/add-property/reset-property`，新增通用 `delete-property {key, fieldKey}`，删除 custom-field 专用 emits。

## Completion Contract

```ts
interface PropertyInputPair {
  open: string
  close: string
}

type PropertyCompletion = {
  static?: { values: readonly string[]; presentation?: 'ghost' | 'menu' }
  provider?: PropertyCompletionProvider
}

interface PropertyCompletionRequest {
  value: string
  cursor: number
}

interface PropertyCompletionItem {
  key: string
  label: string
  detail?: string
  icon?: IconToken
  insertText: string
  value?: unknown
  keepOpen?: boolean
}

interface PropertyCompletionResult {
  replaceStart: number
  replaceEnd: number
  items: readonly PropertyCompletionItem[]
}

type PropertyCompletionProvider = (
  request: PropertyCompletionRequest,
) => PropertyCompletionResult | null | Promise<PropertyCompletionResult | null>
```

- [x] `{{ -> }}` 由上级通过 `autoPairs` 声明，EditorField 通用执行。
- [x] CSS `px/%` 使用 schema 提供的 static ghost completion；static 与 provider 可在同一字段并存。
- [x] FilePath Provider 位于 Workspace 上级，注入目录读取与索引接口；FilePath EditorField 不再 import Project Store。
- [x] Binding Provider 位于 Card 上级，负责 `s/c/d/p`、父链、字段 exposure 和类型过滤；PropertyEditor/EditorField 不知道 scope 语义。
- [x] binding completion 与运行时共享 token parser；输入 `{{p` 提供 `p:` 与 `p.`，输入 `{{p.` 按需提供 `p.p:` 与 `p.p.`，不预生成 ancestor tree。
- [x] 异步 Provider 只采用最后一次请求结果，旧请求不得覆盖新输入。
- [x] 非字符串 binding picker 与自由字符串补全复用同一 Provider；叶子 item 通过 `value` 提交完整 binding expression。

## Upper-Layer Flow

- [ ] `useCdePropertyPanelState` 生成合并后的 fields、Category Map 和 completion providers。
- [ ] 属性 OcCard 在蓝图 Block 可创建额外字段时显示 `additional-field.create` action。
- [ ] 上级管理创建弹窗 draft：`fieldKey/datatype/title`，提交时实时校验并更新 Block。
- [ ] PropertyEditor 的第一次 delete click 仅 arm，第二次才 emit；上级收到后直接删除，不再显示确认弹窗。
- [ ] blueprint 额外字段 definition 注入 `deletable:true`；实例注入 `deletable:false` 和基于 override 的 `resettable`。

## Incremental Implementation Order

1. 提交当前已验证 binding/custom 实验基线和本任务文档。
2. 建立通用 PropertyEditor fields/categories/autoPairs/completion 类型及针对性测试。
3. 迁移 static CSS completion，确保现有 ghost/Tab 行为可用。
4. 迁移 Workspace FilePath Provider，移除 EditorField 对 Project Store 的依赖。
5. 迁移 Card Binding Provider、共享 parser、`p:`/`p.` 分段补全和非字符串 picker。
6. 将领域存储迁移到根值 + `additionalFieldDefinition`，同步实例投影和 diagnostics。
7. 将创建弹窗移到上级属性卡片 action，落实双击删除并删除 PropertyEditor 业务弹窗。
8. 全仓清除旧协议、更新 shadow，运行 Vitest、vue-tsc、UI lint、build、Playwright 和 `git diff --check`。

每完成一个可独立使用的阶段，立即向用户报告当前可用能力和验证结果，再继续下一阶段。
