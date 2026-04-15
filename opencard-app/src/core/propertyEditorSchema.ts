import type { CardBlock } from './Card'

type EditorPropertyBase = {
    isHidden?: boolean
    isArray?: boolean
    isReadonly?: boolean
    label?: string
    category?: string
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

const textModeOptions = ['plain', 'markdown', 'richtext'] as const
const textWritingModeOptions = ['horizontal-tb', 'vertical-rl', 'vertical-lr'] as const
const imageFitOptions = ['cover', 'contain', 'fill'] as const
const cssLengthAutocomplete = ['px', '%'] as const

function createBaseBlockPropertyEditorSchema(): Record<string, EditorPropertyDefinition> {
    return {
        id: { datatype: 'string', isReadonly: true, minLength: 1, label: 'ID', category: 'Identity' },
        name: { datatype: 'string', label: 'Name', category: 'Identity' },
        type: { datatype: 'string', isReadonly: true, label: 'Type', category: 'Identity' },
        width: { datatype: 'string', autocomplete: cssLengthAutocomplete, label: 'Width', category: 'Layout' },
        height: { datatype: 'string', autocomplete: cssLengthAutocomplete, label: 'Height', category: 'Layout' },
        translateX: { datatype: 'string', autocomplete: cssLengthAutocomplete, label: 'Translate X', category: 'Transform' },
        translateY: { datatype: 'string', autocomplete: cssLengthAutocomplete, label: 'Translate Y', category: 'Transform' },
        scaleX: { datatype: 'number', label: 'Scale X', category: 'Transform' },
        scaleY: { datatype: 'number', label: 'Scale Y', category: 'Transform' },
        transformAnchor: { datatype: 'anchorPosition', label: 'Transform Anchor', category: 'Transform' },
        zIndex: { datatype: 'number', label: 'Z-Index', category: 'Layout' },
        rotation: { datatype: 'number', label: 'Rotation', category: 'Transform' },
        opacity: { datatype: 'number', min: 0, max: 1, label: 'Opacity', category: 'Appearance' },
        outline: { datatype: 'string', label: 'Outline', category: 'Appearance' },
        borderRadius: { datatype: 'string', autocomplete: cssLengthAutocomplete, label: 'Border Radius', category: 'Appearance' },
        background: { datatype: 'background', label: 'Background', category: 'Appearance' },
        customCss: { datatype: 'string', label: 'Custom CSS', category: 'Appearance' },
        metadata: { datatype: 'object', objectType: 'metadata', isHidden: true, label: 'Metadata', category: 'Data' },
    }
}

export const blockPropertyEditorSchema: PropertyEditorSchemaByType = {
    'text-block': {
        ...createBaseBlockPropertyEditorSchema(),
        content: { datatype: 'string', label: 'Content', category: 'Content' },
        mode: { datatype: 'string', options: textModeOptions, label: 'Mode', category: 'Content' },
        fontSize: { datatype: 'string', autocomplete: cssLengthAutocomplete, label: 'Font Size', category: 'Typography' },
        fontFamily: { datatype: 'string', label: 'Font Family', category: 'Typography' },
        fontWeight: { datatype: 'string', label: 'Font Weight', category: 'Typography' },
        color: { datatype: 'color', enablePicker: true, enableCss: true, label: 'Text Color', category: 'Appearance' },
        textAlign: { datatype: 'alignPosition', label: 'Text Align', category: 'Typography' },
        lineHeight: { datatype: 'string', autocomplete: cssLengthAutocomplete, label: 'Line Height', category: 'Typography' },
        writingMode: { datatype: 'string', options: textWritingModeOptions, label: 'Text Flow', category: 'Typography' },
    },
    'image-block': {
        ...createBaseBlockPropertyEditorSchema(),
        image: {
            datatype: 'filePath',
            minLength: 0,
            label: 'Image',
            category: 'Content',
            extensionsFilter: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'],
        },
        imagePath: {
            datatype: 'filePath',
            minLength: 0,
            isHidden: true,
            label: 'Image Path',
            category: 'Data',
            extensionsFilter: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'],
        },
        fit: { datatype: 'string', options: imageFitOptions, label: 'Fit', category: 'Appearance' },
    },
    'simple-container-block': {
        ...createBaseBlockPropertyEditorSchema(),
        children: { datatype: 'object', objectType: 'CardBlock', isArray: true, isHidden: true, label: 'Children', category: 'Data' },
    },
    'flow-container-block': {
        ...createBaseBlockPropertyEditorSchema(),
        direction: { datatype: 'flowDirection', label: 'Direction', category: 'Layout' },
        gap: { datatype: 'string', autocomplete: cssLengthAutocomplete, label: 'Gap', category: 'Layout' },
        children: { datatype: 'object', objectType: 'CardBlock', isArray: true, isHidden: true, label: 'Children', category: 'Data' },
    },
}

export const simpleContainerLocationPropertyEditorSchema: Record<string, EditorPropertyDefinition> = {
    type: { datatype: 'string', isReadonly: true, label: 'Type', category: 'Identity' },
    anchor: { datatype: 'anchorPosition', label: 'Anchor', category: 'Position' },
    x: { datatype: 'string', autocomplete: cssLengthAutocomplete, label: 'X', category: 'Position' },
    y: { datatype: 'string', autocomplete: cssLengthAutocomplete, label: 'Y', category: 'Position' },
}

export const flowContainerLocationPropertyEditorSchema: Record<string, EditorPropertyDefinition> = {
    type: { datatype: 'string', isReadonly: true, label: 'Type', category: 'Identity' },
    index: { datatype: 'number', min: 0, label: 'Index', category: 'Flow' },
    align: { datatype: 'alignPosition', label: 'Align', category: 'Flow' },
}

const cardDocumentPropertyEditorSchema: Record<string, EditorPropertyDefinition> = {
    type: { datatype: 'string', isReadonly: true, label: 'Type', category: 'Identity' },
    name: { datatype: 'string', label: 'Name', category: 'Identity' },
    id: { datatype: 'string', label: 'ID', category: 'Identity' },
    version: { datatype: 'number', min: 1, max: 1, label: 'Version', category: 'Identity' },
    width: { datatype: 'number', min: 0, label: 'Width', category: 'Layout' },
    height: { datatype: 'number', min: 0, label: 'Height', category: 'Layout' },
    children: { datatype: 'object', objectType: 'RootChild', isArray: true, isHidden: true, label: 'Children', category: 'Data' },
    instances: { datatype: 'object', objectType: 'CardInstanceRecord', isArray: true, isHidden: true, label: 'Instances', category: 'Data' },
}

const cardInstanceRecordPropertyEditorSchema: Record<string, EditorPropertyDefinition> = {
    id: { datatype: 'string', label: 'ID', category: 'Identity' },
    name: { datatype: 'string', label: 'Name', category: 'Identity' },
    metadata: { datatype: 'object', objectType: 'metadata', isHidden: true, label: 'Metadata', category: 'Data' },
    data: { datatype: 'object', objectType: 'instanceData', label: 'Data', category: 'Data' },
}

const rawPropertyEditorSchemaByType: TypePropertyDefinitions = {
    ...blockPropertyEditorSchema,
    'simple-container-location': simpleContainerLocationPropertyEditorSchema,
    'flow-container-location': flowContainerLocationPropertyEditorSchema,
    'card-document': cardDocumentPropertyEditorSchema,
    'card-instance-record': cardInstanceRecordPropertyEditorSchema,
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
        metadata: {},
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
        metadata: {},
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
        metadata: {},
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
        metadata: {},
        direction: 'lr',
        gap: '10px',
        children: [],
    },
    'simple-container-location': {
        type: 'simple-container-location',
        anchor: 'lt',
        x: '0px',
        y: '0px',
    },
    'flow-container-location': {
        type: 'flow-container-location',
        index: 0,
        align: 'start',
    },
    'card-document': {
        type: 'card-document',
        name: '',
        id: '',
        version: 1,
        width: 0,
        height: 0,
        children: [],
        instances: [],
    },
    'card-instance-record': {
        id: '',
        name: '',
        metadata: {},
        data: {},
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

export function getSchemaDefaultValue(typeName: string | undefined, fieldName: string): unknown {
    const schema = getTypePropertyEditorSchema(typeName)
    const definition = schema[fieldName]
    if (!definition || definition.defaultValue === undefined) {
        return undefined
    }
    return cloneDefaultValue(definition.defaultValue)
}

export function materializeSchemaTarget(
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
