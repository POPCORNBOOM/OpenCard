# Property Binding and Custom Fields Task

## Goal

将属性绑定改为默认允许、显式禁止的黑名单协议，并让蓝图 Block 可以定义带类型的自定义字段。实例继承全部蓝图自定义字段，编辑时沿用现有 override/reset 语义。非字符串字段通过独立绑定按钮选择变量，绑定后使用统一绑定控件展示。

## Locked Decisions

- [ ] 删除 `referenceInput/referenceReadable` 白名单语义，改为 `acceptsBinding?: false` 与 `exposesReference?: false`。
- [ ] 普通值保持真实 `string/number/boolean` 类型；只有绑定值保存为完整 `{{...}}` 字符串。
- [ ] 第一版绑定兼容性按 `string/number/boolean/object` 基础值类型判断，不做数字字符串等隐式转换。
- [ ] 自定义字段结构化存储在 `BaseBlock.customFields`，不把任意 key 平铺到 Block 根对象。
- [ ] 自定义字段只允许蓝图创建；实例自动显示全部字段，首次编辑写入 `instance.data[blockId][fieldKey]`，reset 删除该 override。
- [ ] 实例的自定义 Category 不显示新增按钮。
- [ ] 自定义字段创建使用弹窗：选择 datatype、输入稳定 key、输入可选显示标题。
- [ ] 删除字段需要二次确认，并同步删除所有实例中的同名 override；已有引用不自动改写，继续由 diagnostics 报错。
- [ ] 不提供旧文件兼容层或迁移适配器。

## Domain Contract

```ts
type BindingValueKind = 'string' | 'number' | 'boolean' | 'object'

type CustomFieldDatatype =
  | 'string'
  | 'filePath'
  | 'anchorPosition'
  | 'alignPosition'
  | 'verticalAlignPosition'
  | 'flowDirection'
  | 'number'
  | 'boolean'
  | 'color'

interface CustomFieldDefinition {
  title?: string
  datatype: CustomFieldDatatype
  value: unknown
}

interface BaseBlock {
  customFields?: Record<string, CustomFieldDefinition>
}
```

- [ ] 字段 key 满足 `^[A-Za-z_][A-Za-z0-9_]*$`。
- [ ] key 不区分大小写检查重复，不得与内置字段、schema 字段、已有自定义字段或结构保留名冲突。
- [ ] title trim 后为空即省略，Property Editor 回退显示 key。
- [ ] 建立统一字段访问器，供实例投影、补全和引用解析读取内置字段及 `customFields[key].value`。
- [ ] `applyInstance` 将自定义字段 override 写入投影后的 `customFields[key].value`，实例文件仍保持现有扁平 override 结构。

## Binding Runtime

- [ ] 新增 `{{s:field}}` 当前 Block scope，并保留 `c/d/p/p.p`。
- [ ] 自由字符串允许混合插值；number、boolean 等非字符串目标只接受完整单 token 表达式。
- [ ] string 目标接受 string、number、boolean 来源并显式字符串化。
- [ ] number 目标只接受 number，boolean 目标只接受 boolean，object/array 不允许绑定。
- [ ] 补全按目标类型过滤来源；运行时再次检查声明类型和解析后的实际值。
- [ ] 保留循环引用、最大深度、来源缺失和字段缺失 diagnostics，并补充目标不允许绑定与类型不兼容错误。
- [ ] schema 外标量字段默认可绑定且可被绑定；系统、结构和敏感字段必须显式标记禁止。

## Property Editor UI

- [ ] 新增专用 `custom` Category 和语义图标。
- [ ] 蓝图自定义 Category 显示加号；点击后打开创建弹窗，不扩展公共 Action 为通用表单引擎。
- [ ] 创建弹窗使用受控 draft，包含 datatype 菜单、key、可选 title、取消和确认；校验失败保持弹窗并显示具体原因。
- [ ] Property Editor 只 emit key-only 创建/删除意图，不直接修改 Block。
- [ ] 蓝图自定义字段行提供删除 Action；确认弹窗说明将清理的实例 override 数量，以及引用不会自动重写。
- [ ] 实例行与内置字段一致：继承值正常显示，编辑后出现 Modified/reset，reset 恢复蓝图值。
- [ ] 所有允许绑定但不使用自由文本引用编辑器的字段，在值区域右侧显示小型变量绑定按钮。
- [ ] 点击绑定按钮打开按 scope 分组并经过类型过滤的字段选择器。
- [ ] 字段处于绑定状态时，用统一绑定控件替代 number/color/boolean 等 literal editor，并支持更换与解除绑定。
- [ ] 解除绑定恢复该 datatype 默认值，不保存最后一次解析结果。

## Store and Intent Flow

- [ ] Property Editor 输入 ViewModel 显式携带自定义字段 key、显示标题、动态 definition、创建/删除能力和绑定候选；UI 不接收 Card 领域对象。
- [ ] 新增 `custom-field.create`、`custom-field.delete` 与 binding update 意图，均包含稳定 source key 和 field key。
- [ ] Card Designer Store 负责创建默认值、写回 `customFields`、建立实例 override、reset 和跨实例删除清理。
- [ ] 删除确认影响信息由上级准备，Property Editor 不扫描文档或实例。
- [ ] 引用补全上下文改为准备好的 scope/field/valueKind 列表，不让补全 UI 自行查询 Card schema 或模型。

## Verification

- [ ] Schema 默认权限、显式黑名单和 schema 外字段行为测试。
- [ ] `s/c/d/p/p.p` 补全、大小写、光标移动和上下文更新测试。
- [ ] 基础类型兼容矩阵、完整 token、字符串插值、循环及错误 diagnostics 测试。
- [ ] 蓝图自定义字段创建、key/title 校验、各标量默认值和持久化测试。
- [ ] 实例继承、首次编辑 override、reset、自定义字段实例投影测试。
- [ ] 删除二次确认、跨实例 override 清理和遗留引用错误测试。
- [ ] Property Editor 创建弹窗、绑定按钮、绑定态控件和键盘/焦点交互测试。
- [ ] 更新 model、schema、Property Editor 与 reference completion 的 `.shadow` 约束。
- [ ] 运行完整 Vitest、`vue-tsc`、生产构建、UI lint 与 `git diff --check`。

## Implementation Order

1. Schema 权限、值类型映射与统一字段访问器。
2. `s:` scope、运行时类型检查和补全上下文。
3. `customFields` 领域模型、实例投影与 Store 写回。
4. Property Editor 自定义 Category、创建/删除弹窗。
5. 非字符串绑定按钮、选择器和绑定态控件。
6. 全量测试、视觉检查、shadow 更新与旧协议删除。
