import type { CardBlock } from './Card'

type EditorPropertyBase = {
    isHidden?: boolean
    isArray?: boolean
    isReadonly?: boolean
    label?: string
    category?: string
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
const imageFitOptions = ['cover', 'contain', 'fill'] as const
const cssLengthAutocomplete = ['px', '%'] as const

export const blockPropertyEditorSchema: PropertyEditorSchemaByType = {
    'text-block': {
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
        customCss: { datatype: 'string', label: 'Custom CSS', category: 'Appearance' },
        metadata: { datatype: 'object', objectType: 'metadata', isHidden: true, label: 'Metadata', category: 'Data' },
        content: { datatype: 'string', label: 'Content', category: 'Content' },
        mode: { datatype: 'string', options: textModeOptions, label: 'Mode', category: 'Content' },
        fontSize: { datatype: 'string', autocomplete: cssLengthAutocomplete, label: 'Font Size', category: 'Typography' },
        fontFamily: { datatype: 'string', label: 'Font Family', category: 'Typography' },
        fontWeight: { datatype: 'string', label: 'Font Weight', category: 'Typography' },
        color: { datatype: 'color', enablePicker: true, enableCss: true, label: 'Text Color', category: 'Appearance' },
        backgroundColor: { datatype: 'color', enablePicker: true, enableCss: true, label: 'Background Color', category: 'Appearance' },
        textAlign: { datatype: 'alignPosition', label: 'Text Align', category: 'Typography' },
        lineHeight: { datatype: 'string', autocomplete: cssLengthAutocomplete, label: 'Line Height', category: 'Typography' },
    },
    'image-block': {
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
        customCss: { datatype: 'string', label: 'Custom CSS', category: 'Appearance' },
        metadata: { datatype: 'object', objectType: 'metadata', isHidden: true, label: 'Metadata', category: 'Data' },
        image: {
            datatype: 'filePath',
            minLength: 1,
            label: 'Image',
            category: 'Content',
            extensionsFilter: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'],
        },
        fit: { datatype: 'string', options: imageFitOptions, label: 'Fit', category: 'Appearance' },
    },
    'simple-container-block': {
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
        customCss: { datatype: 'string', label: 'Custom CSS', category: 'Appearance' },
        metadata: { datatype: 'object', objectType: 'metadata', isHidden: true, label: 'Metadata', category: 'Data' },
        children: { datatype: 'object', objectType: 'CardBlock', isArray: true, isHidden: true, label: 'Children', category: 'Data' },
    },
    'flow-container-block': {
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
        customCss: { datatype: 'string', label: 'Custom CSS', category: 'Appearance' },
        metadata: { datatype: 'object', objectType: 'metadata', isHidden: true, label: 'Metadata', category: 'Data' },
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

export const propertyEditorSchemaByType: TypePropertyDefinitions = {
    ...blockPropertyEditorSchema,
    'simple-container-location': simpleContainerLocationPropertyEditorSchema,
    'flow-container-location': flowContainerLocationPropertyEditorSchema,
}

export function getTypePropertyEditorSchema(typeName: string | undefined): Record<string, EditorPropertyDefinition> {
    if (!typeName) {
        return {}
    }
    return propertyEditorSchemaByType[typeName] ?? {}
}
