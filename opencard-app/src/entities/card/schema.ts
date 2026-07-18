/**
 * 模块说明：
 * - 定义属性编辑 schema 默认值与字段物化策略
 * 职责边界：
 * - 只维护字段协议与默认值 不承载 UI 写回逻辑
 */
import type { CardBlock } from './model'
import type { IconToken } from '../../shared/ui/icon/iconRegistry'

type EditorPropertyBase = {
    isHidden?: boolean
    isArray?: boolean
    isReadonly?: boolean
    resettable?: boolean
    referenceReadable?: boolean
    referenceInput?: boolean
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
        multiline?: boolean
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
    uncategorized: { icon: 'data.list-tree' },
}

const textModeOptions = ['plain', 'markdown', 'richtext'] as const
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
        id: { datatype: 'string', isReadonly: true, minLength: 1, categoryId: 'identity' },
        name: { datatype: 'string', categoryId: 'identity' },
        type: { datatype: 'string', isReadonly: true, categoryId: 'identity', referenceReadable: false },
        width: { datatype: 'string', autocomplete: cssLengthAutocomplete, categoryId: 'layout', referenceInput: true },
        height: { datatype: 'string', autocomplete: cssLengthAutocomplete, categoryId: 'layout', referenceInput: true },
        translateX: { datatype: 'string', autocomplete: cssLengthAutocomplete, categoryId: 'transform', referenceInput: true },
        translateY: { datatype: 'string', autocomplete: cssLengthAutocomplete, categoryId: 'transform', referenceInput: true },
        scaleX: { datatype: 'number', categoryId: 'transform' },
        scaleY: { datatype: 'number', categoryId: 'transform' },
        transformAnchor: { datatype: 'anchorPosition', categoryId: 'transform' },
        zIndex: { datatype: 'number', categoryId: 'layout' },
        rotation: { datatype: 'number', categoryId: 'transform' },
        opacity: { datatype: 'number', min: 0, max: 1, categoryId: 'appearance' },
        borderColor: { datatype: 'color', categoryId: 'appearance' },
        borderWidth: { datatype: 'number', min: 0, categoryId: 'appearance' },
        borderStyle: { datatype: 'string', options: blockBorderStyleOptions, categoryId: 'appearance' },
        borderRadius: { datatype: 'string', autocomplete: cssLengthAutocomplete, categoryId: 'appearance', referenceInput: true },
        background: { datatype: 'string', categoryId: 'appearance', referenceInput: true },
        customCss: { datatype: 'string', multiline: true, categoryId: 'appearance', referenceInput: true },
    }
}

const rawPropertyEditorSchemaByType: TypePropertyDefinitions = {
    'text-block': {
        ...createBaseBlockPropertyEditorSchema(),
        content: { datatype: 'string', multiline: true, categoryId: 'content', referenceInput: true },
        mode: { datatype: 'string', options: textModeOptions, categoryId: 'content' },
        fontSize: { datatype: 'string', autocomplete: cssLengthAutocomplete, categoryId: 'typography', referenceInput: true },
        fontFamily: { datatype: 'string', categoryId: 'typography', referenceInput: true },
        fontWeight: { datatype: 'string', categoryId: 'typography', referenceInput: true },
        color: { datatype: 'color', categoryId: 'appearance', displayFieldKey: 'textColor' },
        textAlign: { datatype: 'alignPosition', categoryId: 'typography' },
        verticalAlign: { datatype: 'verticalAlignPosition', categoryId: 'typography' },
        lineHeight: { datatype: 'string', autocomplete: cssLengthAutocomplete, categoryId: 'typography', referenceInput: true },
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
    'qrcode-block': {
        ...createBaseBlockPropertyEditorSchema(),
        content: { datatype: 'string', multiline: true, categoryId: 'content', referenceInput: true },
        errorCorrection: { datatype: 'string', options: qrErrorCorrectionOptions, categoryId: 'data' },
        foreground: { datatype: 'color', categoryId: 'appearance' },
        backgroundColor: { datatype: 'color', categoryId: 'appearance' },
        quietZone: { datatype: 'number', min: 0, max: 16, categoryId: 'appearance' },
    },
    'shape-block': {
        ...createBaseBlockPropertyEditorSchema(),
        shape: { datatype: 'string', options: shapeOptions, categoryId: 'content' },
        fill: { datatype: 'color', categoryId: 'appearance' },
        stroke: { datatype: 'color', categoryId: 'appearance' },
        strokeWidth: { datatype: 'number', min: 0, categoryId: 'appearance' },
        strokeStyle: { datatype: 'string', options: shapeStrokeStyleOptions, categoryId: 'appearance' },
        strokeAlignment: { datatype: 'string', options: shapeStrokeAlignmentOptions, categoryId: 'appearance' },
        strokeJoin: { datatype: 'string', options: shapeStrokeJoinOptions, categoryId: 'appearance' },
        strokeCap: { datatype: 'string', options: shapeStrokeCapOptions, categoryId: 'appearance' },
        strokeMiterLimit: { datatype: 'number', min: 1, categoryId: 'appearance' },
    },
    'simple-container-block': {
        ...createBaseBlockPropertyEditorSchema(),
        children: { datatype: 'object', objectType: 'CardBlock', isArray: true, isHidden: true, categoryId: 'data' },
    },
    'flow-container-block': {
        ...createBaseBlockPropertyEditorSchema(),
        direction: { datatype: 'flowDirection', categoryId: 'layout' },
        gap: { datatype: 'string', autocomplete: cssLengthAutocomplete, categoryId: 'layout', referenceInput: true },
        children: { datatype: 'object', objectType: 'CardBlock', isArray: true, isHidden: true, categoryId: 'data' },
    },
    'simple-container-location': {
        id: { datatype: 'string', isReadonly: true, categoryId: 'identity' },
        type: { datatype: 'string', isReadonly: true, categoryId: 'identity', referenceReadable: false },
        anchor: { datatype: 'anchorPosition', categoryId: 'position' },
        x: { datatype: 'string', autocomplete: cssLengthAutocomplete, categoryId: 'position', referenceInput: true },
        y: { datatype: 'string', autocomplete: cssLengthAutocomplete, categoryId: 'position', referenceInput: true },
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
        background: { datatype: 'string', categoryId: 'appearance', referenceInput: true },
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
        width: '32%',
        height: '18%',
        translateX: '0px',
        translateY: '0px',
        scaleX: 1,
        scaleY: 1,
        transformAnchor: 'cc',
        zIndex: 0,
        rotation: 0,
        opacity: 1,
        borderColor: '#000000',
        borderWidth: 0,
        borderStyle: 'solid',
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
        verticalAlign: 'top',
        lineHeight: '',
        writingMode: 'horizontal-tb',
    },
    'image-block': {
        id: '',
        name: '',
        type: 'image-block',
        width: '32%',
        height: '18%',
        translateX: '0px',
        translateY: '0px',
        scaleX: 1,
        scaleY: 1,
        transformAnchor: 'cc',
        zIndex: 0,
        rotation: 0,
        opacity: 1,
        borderColor: '#000000',
        borderWidth: 0,
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
        type: 'qrcode-block',
        width: '32%',
        height: '18%',
        translateX: '0px',
        translateY: '0px',
        scaleX: 1,
        scaleY: 1,
        transformAnchor: 'cc',
        zIndex: 0,
        rotation: 0,
        opacity: 1,
        borderColor: '#000000',
        borderWidth: 0,
        borderStyle: 'solid',
        borderRadius: '',
        background: '',
        customCss: '',
        content: '',
        errorCorrection: 'M',
        foreground: '#000000',
        backgroundColor: '#FFFFFF',
        quietZone: 4,
    },
    'shape-block': {
        id: '',
        name: '',
        type: 'shape-block',
        width: '32%',
        height: '18%',
        translateX: '0px',
        translateY: '0px',
        scaleX: 1,
        scaleY: 1,
        transformAnchor: 'cc',
        zIndex: 0,
        rotation: 0,
        opacity: 1,
        borderColor: '#000000',
        borderWidth: 0,
        borderStyle: 'solid',
        borderRadius: '',
        background: '',
        customCss: '',
        shape: 'rectangle',
        fill: '#7C6CFF',
        stroke: '#000000',
        strokeWidth: 0,
        strokeStyle: 'solid',
        strokeAlignment: 'center',
        strokeJoin: 'miter',
        strokeCap: 'butt',
        strokeMiterLimit: 4,
    },
    'simple-container-block': {
        id: '',
        name: '',
        type: 'simple-container-block',
        width: '32%',
        height: '18%',
        translateX: '0px',
        translateY: '0px',
        scaleX: 1,
        scaleY: 1,
        transformAnchor: 'cc',
        zIndex: 0,
        rotation: 0,
        opacity: 1,
        borderColor: '#000000',
        borderWidth: 0,
        borderStyle: 'solid',
        borderRadius: '',
        background: '',
        customCss: '',
        children: [],
    },
    'flow-container-block': {
        id: '',
        name: '',
        type: 'flow-container-block',
        width: '32%',
        height: '18%',
        translateX: '0px',
        translateY: '0px',
        scaleX: 1,
        scaleY: 1,
        transformAnchor: 'cc',
        zIndex: 0,
        rotation: 0,
        opacity: 1,
        borderColor: '#000000',
        borderWidth: 0,
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
