import type { CardBlock } from './Card'

type EditorPropertyBase = {
    isHidden?: boolean
    isArray?: boolean
    isReadonly?: boolean
    label?: string
    labelKey?: string
    category?: string
    categoryKey?: string
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

const textModeOptions = ['plain', 'markdown', 'richtext'] as const
const textWritingModeOptions = ['horizontal-tb', 'vertical-rl', 'vertical-lr'] as const
const imageFitOptions = ['cover', 'contain', 'fill'] as const
const cssLengthAutocomplete = ['px', '%'] as const

const propertyEditorCategoryText: Record<PropertyEditorCategoryId, { label: string; key: string }> = {
    identity: { label: 'Identity', key: 'propertyEditor.categories.identity' },
    layout: { label: 'Layout', key: 'propertyEditor.categories.layout' },
    transform: { label: 'Transform', key: 'propertyEditor.categories.transform' },
    appearance: { label: 'Appearance', key: 'propertyEditor.categories.appearance' },
    data: { label: 'Data', key: 'propertyEditor.categories.data' },
    content: { label: 'Content', key: 'propertyEditor.categories.content' },
    typography: { label: 'Typography', key: 'propertyEditor.categories.typography' },
    position: { label: 'Position', key: 'propertyEditor.categories.position' },
    flow: { label: 'Flow', key: 'propertyEditor.categories.flow' },
}

function createLocalizedPropertyText(
    label: string,
    fieldKey: string,
    categoryId: PropertyEditorCategoryId
): Pick<EditorPropertyBase, 'label' | 'labelKey' | 'category' | 'categoryKey'> {
    const categoryText = propertyEditorCategoryText[categoryId]

    return {
        label,
        labelKey: `propertyEditor.fields.${fieldKey}`,
        category: categoryText.label,
        categoryKey: categoryText.key,
    }
}

function createBaseBlockPropertyEditorSchema(): Record<string, EditorPropertyDefinition> {
    return {
        id: { datatype: 'string', isReadonly: true, minLength: 1, ...createLocalizedPropertyText('ID', 'id', 'identity') },
        name: { datatype: 'string', ...createLocalizedPropertyText('Name', 'name', 'identity') },
        type: { datatype: 'string', isReadonly: true, ...createLocalizedPropertyText('Type', 'type', 'identity') },
        width: { datatype: 'string', autocomplete: cssLengthAutocomplete, ...createLocalizedPropertyText('Width', 'width', 'layout') },
        height: { datatype: 'string', autocomplete: cssLengthAutocomplete, ...createLocalizedPropertyText('Height', 'height', 'layout') },
        translateX: { datatype: 'string', autocomplete: cssLengthAutocomplete, ...createLocalizedPropertyText('Translate X', 'translateX', 'transform') },
        translateY: { datatype: 'string', autocomplete: cssLengthAutocomplete, ...createLocalizedPropertyText('Translate Y', 'translateY', 'transform') },
        scaleX: { datatype: 'number', ...createLocalizedPropertyText('Scale X', 'scaleX', 'transform') },
        scaleY: { datatype: 'number', ...createLocalizedPropertyText('Scale Y', 'scaleY', 'transform') },
        transformAnchor: { datatype: 'anchorPosition', ...createLocalizedPropertyText('Transform Anchor', 'transformAnchor', 'transform') },
        zIndex: { datatype: 'number', ...createLocalizedPropertyText('Z-Index', 'zIndex', 'layout') },
        rotation: { datatype: 'number', ...createLocalizedPropertyText('Rotation', 'rotation', 'transform') },
        opacity: { datatype: 'number', min: 0, max: 1, ...createLocalizedPropertyText('Opacity', 'opacity', 'appearance') },
        outline: { datatype: 'string', ...createLocalizedPropertyText('Outline', 'outline', 'appearance') },
        borderRadius: { datatype: 'string', autocomplete: cssLengthAutocomplete, ...createLocalizedPropertyText('Border Radius', 'borderRadius', 'appearance') },
        background: { datatype: 'background', ...createLocalizedPropertyText('Background', 'background', 'appearance') },
        customCss: { datatype: 'string', ...createLocalizedPropertyText('Custom CSS', 'customCss', 'appearance') },
        metadata: { datatype: 'object', objectType: 'metadata', isHidden: true, ...createLocalizedPropertyText('Metadata', 'metadata', 'data') },
    }
}

export const blockPropertyEditorSchema: PropertyEditorSchemaByType = {
    'text-block': {
        ...createBaseBlockPropertyEditorSchema(),
        content: { datatype: 'string', ...createLocalizedPropertyText('Content', 'content', 'content') },
        mode: { datatype: 'string', options: textModeOptions, ...createLocalizedPropertyText('Mode', 'mode', 'content') },
        fontSize: { datatype: 'string', autocomplete: cssLengthAutocomplete, ...createLocalizedPropertyText('Font Size', 'fontSize', 'typography') },
        fontFamily: { datatype: 'string', ...createLocalizedPropertyText('Font Family', 'fontFamily', 'typography') },
        fontWeight: { datatype: 'string', ...createLocalizedPropertyText('Font Weight', 'fontWeight', 'typography') },
        color: { datatype: 'color', enablePicker: true, enableCss: true, ...createLocalizedPropertyText('Text Color', 'textColor', 'appearance') },
        textAlign: { datatype: 'alignPosition', ...createLocalizedPropertyText('Text Align', 'textAlign', 'typography') },
        lineHeight: { datatype: 'string', autocomplete: cssLengthAutocomplete, ...createLocalizedPropertyText('Line Height', 'lineHeight', 'typography') },
        writingMode: { datatype: 'string', options: textWritingModeOptions, ...createLocalizedPropertyText('Text Flow', 'writingMode', 'typography') },
    },
    'image-block': {
        ...createBaseBlockPropertyEditorSchema(),
        image: {
            datatype: 'filePath',
            minLength: 0,
            ...createLocalizedPropertyText('Image', 'image', 'content'),
            extensionsFilter: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'],
        },
        imagePath: {
            datatype: 'filePath',
            minLength: 0,
            isHidden: true,
            ...createLocalizedPropertyText('Image Path', 'imagePath', 'data'),
            extensionsFilter: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'],
        },
        fit: { datatype: 'string', options: imageFitOptions, ...createLocalizedPropertyText('Fit', 'fit', 'appearance') },
    },
    'simple-container-block': {
        ...createBaseBlockPropertyEditorSchema(),
        children: { datatype: 'object', objectType: 'CardBlock', isArray: true, isHidden: true, ...createLocalizedPropertyText('Children', 'children', 'data') },
    },
    'flow-container-block': {
        ...createBaseBlockPropertyEditorSchema(),
        direction: { datatype: 'flowDirection', ...createLocalizedPropertyText('Direction', 'direction', 'layout') },
        gap: { datatype: 'string', autocomplete: cssLengthAutocomplete, ...createLocalizedPropertyText('Gap', 'gap', 'layout') },
        children: { datatype: 'object', objectType: 'CardBlock', isArray: true, isHidden: true, ...createLocalizedPropertyText('Children', 'children', 'data') },
    },
}

export const simpleContainerLocationPropertyEditorSchema: Record<string, EditorPropertyDefinition> = {
    type: { datatype: 'string', isReadonly: true, ...createLocalizedPropertyText('Type', 'type', 'identity') },
    anchor: { datatype: 'anchorPosition', ...createLocalizedPropertyText('Anchor', 'anchor', 'position') },
    x: { datatype: 'string', autocomplete: cssLengthAutocomplete, ...createLocalizedPropertyText('X', 'x', 'position') },
    y: { datatype: 'string', autocomplete: cssLengthAutocomplete, ...createLocalizedPropertyText('Y', 'y', 'position') },
}

export const flowContainerLocationPropertyEditorSchema: Record<string, EditorPropertyDefinition> = {
    type: { datatype: 'string', isReadonly: true, ...createLocalizedPropertyText('Type', 'type', 'identity') },
    index: { datatype: 'number', min: 0, ...createLocalizedPropertyText('Index', 'index', 'flow') },
    align: { datatype: 'alignPosition', ...createLocalizedPropertyText('Align', 'align', 'flow') },
}

const cardDocumentPropertyEditorSchema: Record<string, EditorPropertyDefinition> = {
    type: { datatype: 'string', isReadonly: true, ...createLocalizedPropertyText('Type', 'type', 'identity') },
    name: { datatype: 'string', ...createLocalizedPropertyText('Name', 'name', 'identity') },
    id: { datatype: 'string', ...createLocalizedPropertyText('ID', 'id', 'identity') },
    version: { datatype: 'number', min: 1, max: 1, ...createLocalizedPropertyText('Version', 'version', 'identity') },
    width: { datatype: 'number', min: 0, ...createLocalizedPropertyText('Width', 'width', 'layout') },
    height: { datatype: 'number', min: 0, ...createLocalizedPropertyText('Height', 'height', 'layout') },
    children: { datatype: 'object', objectType: 'RootChild', isArray: true, isHidden: true, ...createLocalizedPropertyText('Children', 'children', 'data') },
    instances: { datatype: 'object', objectType: 'CardInstanceRecord', isArray: true, isHidden: true, ...createLocalizedPropertyText('Instances', 'instances', 'data') },
}

const cardInstanceRecordPropertyEditorSchema: Record<string, EditorPropertyDefinition> = {
    id: { datatype: 'string', ...createLocalizedPropertyText('ID', 'id', 'identity') },
    name: { datatype: 'string', ...createLocalizedPropertyText('Name', 'name', 'identity') },
    metadata: { datatype: 'object', objectType: 'metadata', isHidden: true, ...createLocalizedPropertyText('Metadata', 'metadata', 'data') },
    data: { datatype: 'object', objectType: 'instanceData', ...createLocalizedPropertyText('Data', 'data', 'data') },
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

export function resolveSchemaDefaultsForPresentKeys(
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
