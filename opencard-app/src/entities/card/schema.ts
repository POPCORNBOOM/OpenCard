/**
 * 模块说明：
 * - 定义属性编辑 schema 默认值与字段物化策略
 * 职责边界：
 * - 只维护字段协议与默认值 不承载 UI 写回逻辑
 */
import type { CardBlock } from './model'

type EditorPropertyBase = {
    isHidden?: boolean
    isArray?: boolean
    isReadonly?: boolean
    resettable?: boolean
    referenceReadable?: boolean
    categoryId?: PropertyEditorCategoryId
    displayFieldKey?: string
    defaultValue?: unknown
}

export type PropertyConstraintMap = {
    string: {
        minLength?: number
        maxLength?: number
        options?: readonly string[]
        autocomplete?: readonly string[]
    }
    filePath: {
        minLength?: number
        maxLength?: number
        extensionsFilter?: readonly string[]
    }
    background: {}
    anchorPosition: {}
    alignPosition: {}
    flowDirection: {}
    number: {
        min?: number
        max?: number
    }
    boolean: {}
    color: {
        enablePicker?: boolean
        enableCss?: boolean
    }
    object: {
        objectType: string
    }
}

export type PropertyDatatype = keyof PropertyConstraintMap

type AllConstraintKeys = {
    [K in keyof PropertyConstraintMap]: keyof PropertyConstraintMap[K]
}[keyof PropertyConstraintMap]

type StrictVariant<
    T extends keyof PropertyConstraintMap
> = EditorPropertyBase & {
    datatype: T
} & PropertyConstraintMap[T] & {
        [K in Exclude<AllConstraintKeys, keyof PropertyConstraintMap[T]>]?: never
    }

export type EditorPropertyDefinition = {
    [K in keyof PropertyConstraintMap]: StrictVariant<K>
}[keyof PropertyConstraintMap]

export type PropertyEditorSchemaOverride = Record<string, Partial<EditorPropertyDefinition>>
export type TypePropertyDefinitions = Record<string, Record<string, EditorPropertyDefinition>>
export type PropertyEditorSchemaByType = Record<CardBlock['type'], Record<string, EditorPropertyDefinition>>

type PropertyEditorCategoryId =
    | 'identity'
    | 'layout'
    | 'transform'
    | 'appearance'
    | 'data'
    | 'content'
    | 'typography'
    | 'position'
    | 'flow'
    | 'uncategorized'

const textModeOptions = ['plain', 'markdown', 'richtext'] as const
const textWritingModeOptions = ['horizontal-tb', 'vertical-rl', 'vertical-lr'] as const
const imageFitOptions = ['cover', 'contain', 'fill'] as const
const cssLengthAutocomplete = ['px', '%'] as const

function createBaseBlockPropertyEditorSchema(): Record<string, EditorPropertyDefinition> {
    return {
        id: { datatype: 'string', isReadonly: true, minLength: 1, categoryId: 'identity' },
        name: { datatype: 'string', categoryId: 'identity' },
        type: { datatype: 'string', isReadonly: true, categoryId: 'identity', referenceReadable: false },
        width: { datatype: 'string', autocomplete: cssLengthAutocomplete, categoryId: 'layout' },
        height: { datatype: 'string', autocomplete: cssLengthAutocomplete, categoryId: 'layout' },
        translateX: { datatype: 'string', autocomplete: cssLengthAutocomplete, categoryId: 'transform' },
        translateY: { datatype: 'string', autocomplete: cssLengthAutocomplete, categoryId: 'transform' },
        scaleX: { datatype: 'number', categoryId: 'transform' },
        scaleY: { datatype: 'number', categoryId: 'transform' },
        transformAnchor: { datatype: 'anchorPosition', categoryId: 'transform' },
        zIndex: { datatype: 'number', categoryId: 'layout' },
        rotation: { datatype: 'number', categoryId: 'transform' },
        opacity: { datatype: 'number', min: 0, max: 1, categoryId: 'appearance' },
        outline: { datatype: 'string', categoryId: 'appearance' },
        borderRadius: { datatype: 'string', autocomplete: cssLengthAutocomplete, categoryId: 'appearance' },
        background: { datatype: 'background', categoryId: 'appearance' },
        customCss: { datatype: 'string', categoryId: 'appearance' },
    }
}

const rawPropertyEditorSchemaByType: TypePropertyDefinitions = {
    'text-block': {
        ...createBaseBlockPropertyEditorSchema(),
        content: { datatype: 'string', categoryId: 'content' },
        mode: { datatype: 'string', options: textModeOptions, categoryId: 'content' },
        fontSize: { datatype: 'string', autocomplete: cssLengthAutocomplete, categoryId: 'typography' },
        fontFamily: { datatype: 'string', categoryId: 'typography' },
        fontWeight: { datatype: 'string', categoryId: 'typography' },
        color: { datatype: 'color', enablePicker: true, enableCss: true, categoryId: 'appearance', displayFieldKey: 'textColor' },
        textAlign: { datatype: 'alignPosition', categoryId: 'typography' },
        lineHeight: { datatype: 'string', autocomplete: cssLengthAutocomplete, categoryId: 'typography' },
        writingMode: { datatype: 'string', options: textWritingModeOptions, categoryId: 'typography' },
    },
    'image-block': {
        ...createBaseBlockPropertyEditorSchema(),
        image: {
            datatype: 'filePath',
            minLength: 0,
            categoryId: 'content',
            extensionsFilter: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'],
        },
        imagePath: {
            datatype: 'filePath',
            minLength: 0,
            isHidden: true,
            categoryId: 'data',
            extensionsFilter: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'],
        },
        fit: { datatype: 'string', options: imageFitOptions, categoryId: 'appearance' },
    },
    'simple-container-block': {
        ...createBaseBlockPropertyEditorSchema(),
        children: { datatype: 'object', objectType: 'CardBlock', isArray: true, isHidden: true, categoryId: 'data' },
    },
    'flow-container-block': {
        ...createBaseBlockPropertyEditorSchema(),
        direction: { datatype: 'flowDirection', categoryId: 'layout' },
        gap: { datatype: 'string', autocomplete: cssLengthAutocomplete, categoryId: 'layout' },
        children: { datatype: 'object', objectType: 'CardBlock', isArray: true, isHidden: true, categoryId: 'data' },
    },
    'simple-container-location': {
        id: { datatype: 'string', isReadonly: true, categoryId: 'identity' },
        type: { datatype: 'string', isReadonly: true, categoryId: 'identity', referenceReadable: false },
        anchor: { datatype: 'anchorPosition', categoryId: 'position' },
        x: { datatype: 'string', autocomplete: cssLengthAutocomplete, categoryId: 'position' },
        y: { datatype: 'string', autocomplete: cssLengthAutocomplete, categoryId: 'position' },
    },
    'flow-container-location': {
        id: { datatype: 'string', isReadonly: true, categoryId: 'identity' },
        type: { datatype: 'string', isReadonly: true, categoryId: 'identity', referenceReadable: false },
        index: { datatype: 'number', min: 0, categoryId: 'flow' },
        align: { datatype: 'alignPosition', categoryId: 'flow' },
    },
    'card-document': {
        type: { datatype: 'string', isReadonly: true, categoryId: 'identity', referenceReadable: false },
        name: { datatype: 'string', categoryId: 'identity' },
        id: { datatype: 'string', categoryId: 'identity', isReadonly: true },
        version: { datatype: 'string', categoryId: 'identity' },
        width: { datatype: 'number', min: 0, categoryId: 'layout' },
        height: { datatype: 'number', min: 0, categoryId: 'layout' },
        background: { datatype: 'background', categoryId: 'appearance' },
        children: { datatype: 'object', objectType: 'RootChild', isArray: true, isHidden: true, categoryId: 'data' },
        instances: { datatype: 'object', objectType: 'CardInstanceRecord', isArray: true, isHidden: true, categoryId: 'data' },
    },
    'card-instance': {
        type: { datatype: 'string', isReadonly: true, categoryId: 'identity', referenceReadable: false },
        amount: { datatype: 'number', min: 0, categoryId: 'data' },
        id: { datatype: 'string', categoryId: 'identity', isReadonly: true },
        name: { datatype: 'string', categoryId: 'identity' },
        data: { datatype: 'object', objectType: 'instanceData', isHidden: true, categoryId: 'data' },
    },
}

const schemaDefaultValuesByType: Record<string, Record<string, unknown>> = {
    'text-block': {
        id: '',
        name: '',
        type: 'text-block',
        width: '',
        height: '',
        translateX: '0px',
        translateY: '0px',
        scaleX: 1,
        scaleY: 1,
        transformAnchor: 'cc',
        zIndex: 0,
        rotation: 0,
        opacity: 1,
        outline: '',
        borderRadius: '',
        background: '',
        customCss: '',
        content: '',
        mode: 'plain',
        fontSize: '',
        fontFamily: '',
        fontWeight: 'normal',
        color: '',
        textAlign: 'start',
        lineHeight: '',
        writingMode: 'horizontal-tb',
    },
    'image-block': {
        id: '',
        name: '',
        type: 'image-block',
        width: '',
        height: '',
        translateX: '0px',
        translateY: '0px',
        scaleX: 1,
        scaleY: 1,
        transformAnchor: 'cc',
        zIndex: 0,
        rotation: 0,
        opacity: 1,
        outline: '',
        borderRadius: '',
        background: '',
        customCss: '',
        image: '',
        imagePath: '',
        fit: 'cover',
    },
    'simple-container-block': {
        id: '',
        name: '',
        type: 'simple-container-block',
        width: '',
        height: '',
        translateX: '0px',
        translateY: '0px',
        scaleX: 1,
        scaleY: 1,
        transformAnchor: 'cc',
        zIndex: 0,
        rotation: 0,
        opacity: 1,
        outline: '',
        borderRadius: '',
        background: '',
        customCss: '',
        children: [],
    },
    'flow-container-block': {
        id: '',
        name: '',
        type: 'flow-container-block',
        width: '',
        height: '',
        translateX: '0px',
        translateY: '0px',
        scaleX: 1,
        scaleY: 1,
        transformAnchor: 'cc',
        zIndex: 0,
        rotation: 0,
        opacity: 1,
        outline: '',
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
        index: 0,
        align: 'start',
    },
    'card-document': {
        type: 'card-document',
        name: '',
        id: '',
        version: '1.0.0',
        width: 540,
        height: 850,
        background: '#FFFFFF',
        children: [],
        instances: [],
    },
    'card-instance': {
        type: 'card-instance',
        amount: 1,
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

export function isReferenceFieldReadable(typeName: string | undefined, fieldName: string): boolean {
    const schema = getTypePropertyEditorSchema(typeName)
    const definition = schema[fieldName]
    if (!definition) {
        return true
    }

    if (definition.referenceReadable !== undefined) {
        return definition.referenceReadable
    }

    if (definition.isHidden || definition.isArray || definition.datatype === 'object') {
        return false
    }

    return true
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
