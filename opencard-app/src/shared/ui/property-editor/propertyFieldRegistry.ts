import { defineAsyncComponent, type Component } from 'vue'
import type { IconToken } from '../icon/iconRegistry'
import type {
  BasePropertyFieldType,
  PropertyEditorFieldDefinition,
  PropertyFieldType,
} from './propertyEditor.types'
import {
  getArrayElementFieldType,
  isArrayPropertyFieldType,
} from './propertyEditor.types'
import AlignPositionPropertyField from './fields/AlignPositionPropertyField.vue'
import AnchorPositionPropertyField from './fields/AnchorPositionPropertyField.vue'
import ArrayPropertyField from './fields/ArrayPropertyField.vue'
import BooleanPropertyField from './fields/BooleanPropertyField.vue'
import ColorPropertyField from './fields/ColorPropertyField.vue'
import FilePathPropertyField from './fields/FilePathPropertyField.vue'
import FlowDirectionPropertyField from './fields/FlowDirectionPropertyField.vue'
import NumberPropertyField from './fields/NumberPropertyField.vue'
import ObjectPropertyField from './fields/ObjectPropertyField.vue'
import ReferenceStringPropertyField from './fields/ReferenceStringPropertyField.vue'
import StringPropertyField from './fields/StringPropertyField.vue'
import VerticalAlignPositionPropertyField from './fields/VerticalAlignPositionPropertyField.vue'

type PropertyFieldEditorRegistration = {
  component: Component
  icon: IconToken
}

const RichTextStringPropertyField = defineAsyncComponent(
  () => import('./fields/RichTextStringPropertyField.vue'),
)

const propertyFieldEditorMap: Record<BasePropertyFieldType, PropertyFieldEditorRegistration> = {
  string: { component: StringPropertyField, icon: 'data.symbol-string' },
  anchorPosition: { component: AnchorPositionPropertyField, icon: 'nav.compass' },
  alignPosition: { component: AlignPositionPropertyField, icon: 'data.list-selection' },
  verticalAlignPosition: { component: VerticalAlignPositionPropertyField, icon: 'data.layers' },
  flowDirection: { component: FlowDirectionPropertyField, icon: 'nav.arrow-right' },
  number: { component: NumberPropertyField, icon: 'data.symbol-number' },
  boolean: { component: BooleanPropertyField, icon: 'data.symbol-boolean' },
  color: { component: ColorPropertyField, icon: 'data.symbol-color' },
  filePath: { component: FilePathPropertyField, icon: 'file.generic' },
  object: { component: ObjectPropertyField, icon: 'data.symbol-class' },
}

export function getPropertyFieldIcon(fieldType: PropertyFieldType): IconToken {
  const resolvedType = isArrayPropertyFieldType(fieldType)
    ? getArrayElementFieldType(fieldType)
    : fieldType
  return (propertyFieldEditorMap[resolvedType] ?? propertyFieldEditorMap.string).icon
}

export function getPropertyFieldComponent(definition: PropertyEditorFieldDefinition): Component {
  if (definition.fieldType === 'string' && definition.richText) return RichTextStringPropertyField
  if (definition.fieldType === 'string' && !definition.options && definition.completion?.provider) {
    return ReferenceStringPropertyField
  }
  if (isArrayPropertyFieldType(definition.fieldType)) return ArrayPropertyField
  return (propertyFieldEditorMap[definition.fieldType] ?? propertyFieldEditorMap.string).component
}

export function getArrayPropertyElementComponent(fieldType: PropertyFieldType): Component {
  if (!isArrayPropertyFieldType(fieldType)) return propertyFieldEditorMap.string.component
  return propertyFieldEditorMap[getArrayElementFieldType(fieldType)].component
}

export function toArrayPropertyElementDefinition(
  definition: PropertyEditorFieldDefinition,
): Extract<PropertyEditorFieldDefinition, { fieldType: BasePropertyFieldType }> {
  if (!isArrayPropertyFieldType(definition.fieldType)) {
    throw new Error(`Expected an array field type, received "${definition.fieldType}"`)
  }
  const fieldType = getArrayElementFieldType(definition.fieldType)
  const defaultValue = fieldType === 'boolean'
    ? 'false'
    : fieldType === 'number'
      ? '0'
      : ''
  return {
    ...definition,
    fieldType,
    defaultValue,
  } as Extract<PropertyEditorFieldDefinition, { fieldType: BasePropertyFieldType }>
}
