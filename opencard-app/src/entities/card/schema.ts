/**
 * 模块说明：
 * - 定义属性编辑 schema 默认值与字段物化策略
 * 职责边界：
 * - 只维护字段协议与默认值 不承载 UI 写回逻辑
 */
import type { CardBlock } from './model'
import type { IconToken } from '../../shared/ui/icon/iconRegistry'
import type { BindingValueKind } from '../../features/editor-runtime/model/binding'
import type { BindingScopeKind } from '../../features/editor-runtime/model/bindingExpression'

type EditorPropertyBase = {
    required?: boolean
    isHidden?: boolean
    isArray?: boolean
    isReadonly?: boolean
    resettable?: boolean
    deletable?: boolean
    acceptsBinding?: false
    bindingScopes?: readonly BindingScopeKind[]
    exposesReference?: false
    categoryId?: PropertyEditorCategoryId
    displayFieldKey?: string
    defaultValue?: unknown
}

// 这里可以定义对于某一特定 fieldType 的数据编辑器需求的辅助约束条件
export type PropertyConstraintMap = {
    string: {
        minLength?: number
        maxLength?: number
        options?: readonly string[]
        autocomplete?: readonly string[]
        multiline?: boolean
        richText?: boolean
    }
    filePath: {
        minLength?: number
        maxLength?: number
        extensionsFilter?: readonly string[]
    }
    anchorPosition: {}
    alignPosition: {}
    verticalAlignPosition: {}
    flowDirection: {}
    number: {
        min?: number
        max?: number
    }
    boolean: {}
    color: {}
    object: {
        objectType: string
    }
}

export type PropertyFieldType = keyof PropertyConstraintMap
export type AdditionalFieldDefinition = {
    title?: string
    fieldType: PropertyFieldType
}
export type AdditionalFieldDefinitionMap = Record<string, AdditionalFieldDefinition>
export type AdditionalFieldKeyError = 'required' | 'invalid' | 'duplicate' | 'unsupported-field-type'
export type { BindingValueKind } from '../../features/editor-runtime/model/binding'
export const additionalFieldTypes = [
    'string',
    'filePath',
    'anchorPosition',
    'alignPosition',
    'verticalAlignPosition',
    'flowDirection',
    'number',
    'boolean',
    'color',
] as const satisfies readonly PropertyFieldType[]
export const additionalFieldKeyPattern = /^[A-Za-z_][A-Za-z0-9_]*$/

const additionalFieldTypeSet = new Set<PropertyFieldType>(additionalFieldTypes)

export function parseAdditionalFieldDefinitions(
    value: unknown,
    reservedKeys: readonly string[] = [],
): AdditionalFieldDefinitionMap {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

    const reservedIdentities = new Set(reservedKeys.map(key => key.toLocaleLowerCase()))
    const definitions: AdditionalFieldDefinitionMap = {}

    for (const [fieldKey, fieldValue] of Object.entries(value)) {
        if (!additionalFieldKeyPattern.test(fieldKey)
            || reservedIdentities.has(fieldKey.toLocaleLowerCase())
            || !fieldValue
            || typeof fieldValue !== 'object'
            || Array.isArray(fieldValue)) {
            continue
        }

        const source = fieldValue as Record<string, unknown>
        if (typeof source.fieldType !== 'string'
            || !additionalFieldTypeSet.has(source.fieldType as PropertyFieldType)) {
            continue
        }

        const title = typeof source.title === 'string' ? source.title.trim() : ''
        definitions[fieldKey] = {
            fieldType: source.fieldType as PropertyFieldType,
            ...(title ? { title } : {}),
        }
    }

    return definitions
}

export function validateAdditionalFieldKey(
    record: Readonly<Record<string, unknown>>,
    reservedKeys: readonly string[],
    candidate: string,
): AdditionalFieldKeyError | null {
    const fieldKey = candidate.trim()
    if (!fieldKey) return 'required'
    if (!additionalFieldKeyPattern.test(fieldKey)) return 'invalid'

    const occupiedIdentities = new Set([
        ...reservedKeys,
        ...Object.keys(record).filter(key => key !== 'additionalFieldDefinition'),
        ...Object.keys(parseAdditionalFieldDefinitions(record.additionalFieldDefinition)),
    ].map(key => key.toLocaleLowerCase()))
    return occupiedIdentities.has(fieldKey.toLocaleLowerCase()) ? 'duplicate' : null
}

type AllConstraintKeys = {
    [K in keyof PropertyConstraintMap]: keyof PropertyConstraintMap[K]
}[keyof PropertyConstraintMap]

type StrictVariant<
    T extends keyof PropertyConstraintMap
> = EditorPropertyBase & {
    fieldType: T
} & PropertyConstraintMap[T] & {
        [K in Exclude<AllConstraintKeys, keyof PropertyConstraintMap[T]>]?: never
    }

export type EditorPropertyDefinition = {
    [K in keyof PropertyConstraintMap]: StrictVariant<K>
}[keyof PropertyConstraintMap]

const propertyOptionsByFieldType: Partial<Record<PropertyFieldType, readonly string[]>> = {
    anchorPosition: ['lt', 'ct', 'rt', 'lc', 'cc', 'rc', 'lb', 'cb', 'rb'],
    alignPosition: ['start', 'center', 'end', 'justify'],
    verticalAlignPosition: ['top', 'center', 'bottom'],
    flowDirection: ['lr', 'rl', 'tb', 'bt'],
}

export function getPropertyAllowedValues(
    definition: EditorPropertyDefinition | undefined
): readonly string[] | undefined {
    if (!definition) return undefined
    if (definition.fieldType === 'string') return definition.options
    return propertyOptionsByFieldType[definition.fieldType]
}

export type TypePropertyDefinitions = Record<string, Record<string, EditorPropertyDefinition>>
export type PropertyEditorSchemaByType = Record<CardBlock['type'], Record<string, EditorPropertyDefinition>>

export type PropertyEditorCategoryId =
    | 'identity'
    | 'layout'
    | 'transform'
    | 'appearance'
    | 'data'
    | 'content'
    | 'typography'
    | 'position'
    | 'flow'
    | 'custom'
    | 'uncategorized'

export type PropertyEditorCategoryDefinition = {
    icon: IconToken
}

export const propertyEditorCategoryDefinitions: Record<PropertyEditorCategoryId, PropertyEditorCategoryDefinition> = {
    identity: { icon: 'data.symbol-key' },
    layout: { icon: 'data.layers' },
    transform: { icon: 'nav.arrow-swap' },
    appearance: { icon: 'data.symbol-color' },
    data: { icon: 'data.collection' },
    content: { icon: 'data.symbol-string' },
    typography: { icon: 'format.align-start' },
    position: { icon: 'nav.compass' },
    flow: { icon: 'nav.arrow-right' },
    custom: { icon: 'data.variable' },
    uncategorized: { icon: 'data.list-tree' },
}

const textWritingModeOptions = ['horizontal-tb', 'vertical-rl', 'vertical-lr'] as const
const imageFitOptions = ['cover', 'contain', 'fill'] as const
const qrErrorCorrectionOptions = ['L', 'M', 'Q', 'H'] as const
const shapeOptions = ['rectangle', 'ellipse', 'line', 'triangle', 'diamond'] as const
const shapeStrokeStyleOptions = ['solid', 'dashed', 'dotted'] as const
const shapeStrokeAlignmentOptions = ['inside', 'center', 'outside'] as const
const shapeStrokeJoinOptions = ['miter', 'round', 'bevel'] as const
const shapeStrokeCapOptions = ['butt', 'round', 'square'] as const
const blockBorderStyleOptions = ['solid', 'dashed', 'dotted'] as const
const cssLengthAutocomplete = ['px', '%'] as const

function createBaseBlockPropertyEditorSchema(): Record<string, EditorPropertyDefinition> {
    return {
        id: { fieldType: 'string', required: true, isReadonly: true, minLength: 1, categoryId: 'identity', acceptsBinding: false },
        name: { fieldType: 'string', categoryId: 'identity' },
        notes: { fieldType: 'string', multiline: true, categoryId: 'identity' },
        type: { fieldType: 'string', required: true, isReadonly: true, categoryId: 'identity', acceptsBinding: false, exposesReference: false },
        additionalFieldDefinition: { fieldType: 'object', objectType: 'AdditionalFieldDefinition', isHidden: true, acceptsBinding: false, exposesReference: false },
        width: { fieldType: 'string', autocomplete: cssLengthAutocomplete, categoryId: 'layout' },
        height: { fieldType: 'string', autocomplete: cssLengthAutocomplete, categoryId: 'layout' },
        translateX: { fieldType: 'string', autocomplete: cssLengthAutocomplete, categoryId: 'transform' },
        translateY: { fieldType: 'string', autocomplete: cssLengthAutocomplete, categoryId: 'transform' },
        scaleX: { fieldType: 'number', categoryId: 'transform' },
        scaleY: { fieldType: 'number', categoryId: 'transform' },
        transformAnchor: { fieldType: 'anchorPosition', categoryId: 'transform' },
        zIndex: { fieldType: 'number', categoryId: 'layout' },
        rotation: { fieldType: 'number', categoryId: 'transform' },
        opacity: { fieldType: 'number', min: 0, max: 1, categoryId: 'appearance' },
        visible: { fieldType: 'boolean', categoryId: 'appearance' },
        borderColor: { fieldType: 'color', categoryId: 'appearance' },
        borderWidth: { fieldType: 'number', min: 0, categoryId: 'appearance' },
        borderStyle: { fieldType: 'string', options: blockBorderStyleOptions, categoryId: 'appearance' },
        borderRadius: { fieldType: 'string', autocomplete: cssLengthAutocomplete, categoryId: 'appearance' },
        background: { fieldType: 'string', categoryId: 'appearance' },
        customCss: { fieldType: 'string', multiline: true, categoryId: 'appearance' },
    }
}

function createTextContentBlockPropertyEditorSchema(richText: boolean): Record<string, EditorPropertyDefinition> {
    return {
        ...createBaseBlockPropertyEditorSchema(),
        content: {
            fieldType: 'string',
            required: true,
            multiline: true,
            ...(richText ? { richText: true } : {}),
            categoryId: 'content',
        },
        fontSize: { fieldType: 'string', autocomplete: cssLengthAutocomplete, categoryId: 'typography' },
        fontFamily: { fieldType: 'string', categoryId: 'typography' },
        fontWeight: { fieldType: 'string', categoryId: 'typography' },
        color: { fieldType: 'color', categoryId: 'appearance', displayFieldKey: 'textColor' },
        textAlign: { fieldType: 'alignPosition', categoryId: 'typography' },
        verticalAlign: { fieldType: 'verticalAlignPosition', categoryId: 'typography' },
        lineHeight: { fieldType: 'string', autocomplete: cssLengthAutocomplete, categoryId: 'typography' },
        writingMode: { fieldType: 'string', options: textWritingModeOptions, categoryId: 'typography' },
    }
}

const rawPropertyEditorSchemaByType: TypePropertyDefinitions = {
    'text-block': createTextContentBlockPropertyEditorSchema(true),
    'markdown-text-block': createTextContentBlockPropertyEditorSchema(false),
    'image-block': {
        ...createBaseBlockPropertyEditorSchema(),
        image: {
            fieldType: 'filePath',
            required: true,
            minLength: 0,
            categoryId: 'content',
            extensionsFilter: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'],
        },
        imagePath: {
            fieldType: 'filePath',
            minLength: 0,
            isHidden: true,
            acceptsBinding: false,
            exposesReference: false,
            categoryId: 'data',
            extensionsFilter: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'],
        },
        fit: { fieldType: 'string', required: true, options: imageFitOptions, categoryId: 'appearance' },
    },
    'qrcode-block': {
        ...createBaseBlockPropertyEditorSchema(),
        content: { fieldType: 'string', required: true, multiline: true, categoryId: 'content' },
        errorCorrection: { fieldType: 'string', required: true, options: qrErrorCorrectionOptions, categoryId: 'data' },
        foreground: { fieldType: 'color', required: true, categoryId: 'appearance' },
        backgroundColor: { fieldType: 'color', required: true, categoryId: 'appearance' },
        quietZone: { fieldType: 'number', required: true, min: 0, max: 16, categoryId: 'appearance' },
    },
    'shape-block': {
        ...createBaseBlockPropertyEditorSchema(),
        shape: { fieldType: 'string', required: true, options: shapeOptions, categoryId: 'content' },
        fill: { fieldType: 'color', required: true, categoryId: 'appearance' },
        stroke: { fieldType: 'color', required: true, categoryId: 'appearance' },
        strokeWidth: { fieldType: 'number', required: true, min: 0, categoryId: 'appearance' },
        strokeStyle: { fieldType: 'string', required: true, options: shapeStrokeStyleOptions, categoryId: 'appearance' },
        strokeAlignment: { fieldType: 'string', required: true, options: shapeStrokeAlignmentOptions, categoryId: 'appearance' },
        strokeJoin: { fieldType: 'string', required: true, options: shapeStrokeJoinOptions, categoryId: 'appearance' },
        strokeCap: { fieldType: 'string', required: true, options: shapeStrokeCapOptions, categoryId: 'appearance' },
        strokeMiterLimit: { fieldType: 'number', required: true, min: 1, categoryId: 'appearance' },
    },
    'simple-container-block': {
        ...createBaseBlockPropertyEditorSchema(),
        children: { fieldType: 'object', objectType: 'CardBlock', required: true, isArray: true, isHidden: true, categoryId: 'data', acceptsBinding: false, exposesReference: false },
    },
    'flow-container-block': {
        ...createBaseBlockPropertyEditorSchema(),
        direction: { fieldType: 'flowDirection', required: true, categoryId: 'layout' },
        gap: { fieldType: 'string', required: true, autocomplete: cssLengthAutocomplete, categoryId: 'layout' },
        children: { fieldType: 'object', objectType: 'CardBlock', required: true, isArray: true, isHidden: true, categoryId: 'data', acceptsBinding: false, exposesReference: false },
    },
    'simple-container-location': {
        id: { fieldType: 'string', required: true, isReadonly: true, categoryId: 'identity', acceptsBinding: false },
        type: { fieldType: 'string', required: true, isReadonly: true, categoryId: 'identity', acceptsBinding: false, exposesReference: false },
        anchor: { fieldType: 'anchorPosition', required: true, categoryId: 'position' },
        x: { fieldType: 'string', autocomplete: cssLengthAutocomplete, categoryId: 'position' },
        y: { fieldType: 'string', autocomplete: cssLengthAutocomplete, categoryId: 'position' },
    },
    'flow-container-location': {
        id: { fieldType: 'string', required: true, isReadonly: true, categoryId: 'identity', acceptsBinding: false },
        type: { fieldType: 'string', required: true, isReadonly: true, categoryId: 'identity', acceptsBinding: false, exposesReference: false },
        index: { fieldType: 'number', required: true, min: 0, categoryId: 'flow' },
        align: { fieldType: 'alignPosition', categoryId: 'flow' },
    },
    'card-document': {
        type: { fieldType: 'string', required: true, isReadonly: true, categoryId: 'identity', acceptsBinding: false, exposesReference: false },
        schemaVersion: { fieldType: 'string', required: true, isReadonly: true, isHidden: true, categoryId: 'identity', acceptsBinding: false, exposesReference: false },
        name: { fieldType: 'string', categoryId: 'identity', bindingScopes: ['project'] },
        description: { fieldType: 'string', multiline: true, categoryId: 'identity', bindingScopes: ['project'] },
        notes: { fieldType: 'string', multiline: true, categoryId: 'identity', bindingScopes: ['project'] },
        id: { fieldType: 'string', required: true, categoryId: 'identity', isReadonly: true, acceptsBinding: false },
        version: { fieldType: 'string', required: true, categoryId: 'identity', bindingScopes: ['project'] },
        width: { fieldType: 'number', required: true, min: 0, categoryId: 'layout', bindingScopes: ['project'] },
        height: { fieldType: 'number', required: true, min: 0, categoryId: 'layout', bindingScopes: ['project'] },
        faces: { fieldType: 'object', objectType: 'CardFace', required: true, isHidden: true, categoryId: 'data', acceptsBinding: false, exposesReference: false },
        instances: { fieldType: 'object', objectType: 'CardInstanceRecord', required: true, isArray: true, isHidden: true, categoryId: 'data', acceptsBinding: false, exposesReference: false },
        dataTable: { fieldType: 'object', objectType: 'CardDataTableConfiguration', isHidden: true, categoryId: 'data', acceptsBinding: false, exposesReference: false },
    },
    'card-face': {
        type: { fieldType: 'string', required: true, isReadonly: true, categoryId: 'identity', acceptsBinding: false, exposesReference: false },
        id: { fieldType: 'string', required: true, categoryId: 'identity', isReadonly: true, acceptsBinding: false },
        background: { fieldType: 'string', required: true, categoryId: 'appearance' },
        children: { fieldType: 'object', objectType: 'RootChild', required: true, isArray: true, isHidden: true, categoryId: 'data', acceptsBinding: false, exposesReference: false },
    },
    'card-instance': {
        type: { fieldType: 'string', required: true, isReadonly: true, categoryId: 'identity', acceptsBinding: false, exposesReference: false },
        amount: { fieldType: 'number', required: true, min: 0, categoryId: 'data' },
        id: { fieldType: 'string', required: true, categoryId: 'identity', isReadonly: true, acceptsBinding: false },
        name: { fieldType: 'string', required: true, categoryId: 'identity' },
        data: { fieldType: 'object', objectType: 'instanceData', required: true, isHidden: true, categoryId: 'data', acceptsBinding: false, exposesReference: false },
    },
}

function createTextContentBlockDefaultValues(type: 'text-block' | 'markdown-text-block'): Record<string, unknown> {
    return {
        id: '',
        name: '',
        notes: '',
        visible: 'true',
        type,
        width: '32%',
        height: '18%',
        translateX: '0px',
        translateY: '0px',
        scaleX: '1',
        scaleY: '1',
        transformAnchor: 'cc',
        zIndex: '0',
        rotation: '0',
        opacity: '1',
        borderColor: '#000000',
        borderWidth: '0',
        borderStyle: 'solid',
        borderRadius: '',
        background: '',
        customCss: '',
        content: '',
        fontSize: '',
        fontFamily: '',
        fontWeight: 'normal',
        color: '',
        textAlign: 'start',
        verticalAlign: 'top',
        lineHeight: '',
        writingMode: 'horizontal-tb',
    }
}

const schemaDefaultValuesByType: Record<string, Record<string, unknown>> = {
    'text-block': createTextContentBlockDefaultValues('text-block'),
    'markdown-text-block': createTextContentBlockDefaultValues('markdown-text-block'),
    'image-block': {
        id: '',
        name: '',
        notes: '',
        visible: 'true',
        type: 'image-block',
        width: '32%',
        height: '18%',
        translateX: '0px',
        translateY: '0px',
        scaleX: '1',
        scaleY: '1',
        transformAnchor: 'cc',
        zIndex: '0',
        rotation: '0',
        opacity: '1',
        borderColor: '#000000',
        borderWidth: '0',
        borderStyle: 'solid',
        borderRadius: '',
        background: '',
        customCss: '',
        image: '',
        imagePath: '',
        fit: 'cover',
    },
    'qrcode-block': {
        id: '',
        name: '',
        notes: '',
        visible: 'true',
        type: 'qrcode-block',
        width: '32%',
        height: '18%',
        translateX: '0px',
        translateY: '0px',
        scaleX: '1',
        scaleY: '1',
        transformAnchor: 'cc',
        zIndex: '0',
        rotation: '0',
        opacity: '1',
        borderColor: '#000000',
        borderWidth: '0',
        borderStyle: 'solid',
        borderRadius: '',
        background: '',
        customCss: '',
        content: '',
        errorCorrection: 'M',
        foreground: '#000000',
        backgroundColor: '#FFFFFF',
        quietZone: '4',
    },
    'shape-block': {
        id: '',
        name: '',
        notes: '',
        visible: 'true',
        type: 'shape-block',
        width: '32%',
        height: '18%',
        translateX: '0px',
        translateY: '0px',
        scaleX: '1',
        scaleY: '1',
        transformAnchor: 'cc',
        zIndex: '0',
        rotation: '0',
        opacity: '1',
        borderColor: '#000000',
        borderWidth: '0',
        borderStyle: 'solid',
        borderRadius: '',
        background: '',
        customCss: '',
        shape: 'rectangle',
        fill: '#7C6CFF',
        stroke: '#000000',
        strokeWidth: '0',
        strokeStyle: 'solid',
        strokeAlignment: 'center',
        strokeJoin: 'miter',
        strokeCap: 'butt',
        strokeMiterLimit: '4',
    },
    'simple-container-block': {
        id: '',
        name: '',
        notes: '',
        visible: 'true',
        type: 'simple-container-block',
        width: '32%',
        height: '18%',
        translateX: '0px',
        translateY: '0px',
        scaleX: '1',
        scaleY: '1',
        transformAnchor: 'cc',
        zIndex: '0',
        rotation: '0',
        opacity: '1',
        borderColor: '#000000',
        borderWidth: '0',
        borderStyle: 'solid',
        borderRadius: '',
        background: '',
        customCss: '',
        children: [],
    },
    'flow-container-block': {
        id: '',
        name: '',
        notes: '',
        visible: 'true',
        type: 'flow-container-block',
        width: '32%',
        height: '18%',
        translateX: '0px',
        translateY: '0px',
        scaleX: '1',
        scaleY: '1',
        transformAnchor: 'cc',
        zIndex: '0',
        rotation: '0',
        opacity: '1',
        borderColor: '#000000',
        borderWidth: '0',
        borderStyle: 'solid',
        borderRadius: '',
        background: '',
        customCss: '',
        direction: 'lr',
        gap: '10px',
        children: [],
    },
    'simple-container-location': {
        id: '',
        type: 'simple-container-location',
        anchor: 'lt',
        x: '0px',
        y: '0px',
    },
    'flow-container-location': {
        id: '',
        type: 'flow-container-location',
        index: '0',
        align: 'start',
    },
    'card-document': {
        type: 'card-document',
        schemaVersion: '2',
        id: '',
        version: '1.0.0',
        width: '540',
        height: '850',
        faces: {
            front: { type: 'card-face', id: '', background: '#FFFFFF', children: [] },
            back: { type: 'card-face', id: '', background: '#FFFFFF', children: [] },
        },
        instances: [],
    },
    'card-face': {
        type: 'card-face',
        id: '',
        background: '#FFFFFF',
        children: [],
    },
    'card-instance': {
        type: 'card-instance',
        amount: '1',
        id: '',
        name: '',
    },
}

function applyDefaultsToSchema(schemaByType: TypePropertyDefinitions): TypePropertyDefinitions {
    const nextSchema: TypePropertyDefinitions = {}

    for (const [typeName, schema] of Object.entries(schemaByType)) {
        const defaults = schemaDefaultValuesByType[typeName] ?? {}
        const withDefaults: Record<string, EditorPropertyDefinition> = {}
        for (const [fieldName, definition] of Object.entries(schema)) {
            withDefaults[fieldName] = {
                ...definition,
                defaultValue: defaults[fieldName],
            } as EditorPropertyDefinition
        }
        nextSchema[typeName] = withDefaults
    }

    return nextSchema
}

function cloneDefaultValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(item => cloneDefaultValue(item))
    }

    if (value && typeof value === 'object') {
        const source = value as Record<string, unknown>
        const nextObject: Record<string, unknown> = {}
        for (const [key, childValue] of Object.entries(source)) {
            nextObject[key] = cloneDefaultValue(childValue)
        }
        return nextObject
    }

    return value
}

export const propertyEditorSchemaByType: TypePropertyDefinitions = applyDefaultsToSchema(rawPropertyEditorSchemaByType)

export function getTypePropertyEditorSchema(typeName: string | undefined): Record<string, EditorPropertyDefinition> {
    if (!typeName) {
        return {}
    }
    return propertyEditorSchemaByType[typeName] ?? {}
}

export function getPropertyValueKind(definition: EditorPropertyDefinition | undefined): BindingValueKind {
    if (!definition) return 'string'
    if (definition.fieldType === 'number') return 'number'
    if (definition.fieldType === 'boolean') return 'boolean'
    if (definition.fieldType === 'object') return 'object'
    return 'string'
}

export function createPropertyDefaultValue(definition: EditorPropertyDefinition): unknown {
    if (definition.defaultValue !== undefined) return cloneDefaultValue(definition.defaultValue)

    switch (definition.fieldType) {
        case 'string':
            return definition.options?.[0] ?? ''
        case 'filePath':
        case 'color':
            return ''
        case 'anchorPosition':
            return 'cc'
        case 'alignPosition':
            return 'start'
        case 'verticalAlignPosition':
            return 'top'
        case 'flowDirection':
            return 'lr'
        case 'number':
            return String(definition.min ?? 0)
        case 'boolean':
            return 'false'
        case 'object':
            return definition.isArray ? [] : {}
    }
}

export function acceptsPropertyBinding(definition: EditorPropertyDefinition | undefined): boolean {
    return definition?.acceptsBinding !== false && getPropertyValueKind(definition) !== 'object'
}

export function acceptsPropertyBindingScope(
    definition: EditorPropertyDefinition | undefined,
    scope: BindingScopeKind,
): boolean {
    return acceptsPropertyBinding(definition)
        && (!definition?.bindingScopes || definition.bindingScopes.includes(scope))
}

export function exposesPropertyReference(definition: EditorPropertyDefinition | undefined): boolean {
    return definition?.exposesReference !== false && getPropertyValueKind(definition) !== 'object'
}

export function isReferenceFieldExposed(typeName: string | undefined, fieldName: string): boolean {
    const schema = getTypePropertyEditorSchema(typeName)
    return exposesPropertyReference(schema[fieldName])
}

// Return a cloned default value for one schema field, or undefined if absent.
export function getDefault(typeName: string | undefined, fieldName: string): unknown {
    const schema = getTypePropertyEditorSchema(typeName)
    const definition = schema[fieldName]
    if (!definition || definition.defaultValue === undefined) {
        return undefined
    }
    return cloneDefaultValue(definition.defaultValue)
}

// Resolve only existing null/undefined fields in a target object using schema defaults.
export function resolveNulls(
    typeName: string | undefined,
    target: Record<string, unknown> | undefined
): Record<string, unknown> {
    const source = target ?? {}
    const schema = getTypePropertyEditorSchema(typeName)
    if (Object.keys(schema).length === 0) {
        return { ...source }
    }

    const resolved: Record<string, unknown> = { ...source }
    for (const key of Object.keys(source)) {
        const definition = schema[key]
        if (!definition || definition.defaultValue === undefined) {
            continue
        }

        const currentValue = source[key]
        if (currentValue === null || currentValue === undefined) {
            resolved[key] = cloneDefaultValue(definition.defaultValue)
        }
    }

    return resolved
}

// 使用此函数给一个Record按照type去schema里补齐默认值。会克隆默认值以避免引用类型的共享。
export function fillDefaults(
    typeName: string | undefined,
    target: Record<string, unknown> | undefined
): Record<string, unknown> {
    const schema = getTypePropertyEditorSchema(typeName)
    const source = target ?? {}
    if (Object.keys(schema).length === 0) {
        return { ...source }
    }

    const materialized: Record<string, unknown> = { ...source }

    for (const [fieldName, definition] of Object.entries(schema)) {
        const hasOwnValue = Object.prototype.hasOwnProperty.call(source, fieldName)
        const currentValue = source[fieldName]
        const shouldUseDefault = !hasOwnValue || currentValue === null || currentValue === undefined
        if (!shouldUseDefault || definition.defaultValue === undefined) {
            continue
        }
        materialized[fieldName] = cloneDefaultValue(definition.defaultValue)
    }

    return materialized
}
