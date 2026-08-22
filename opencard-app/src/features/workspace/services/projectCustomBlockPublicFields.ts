import type { CardBlock } from '../../../entities/card/model'
import { resolvePropertyEditorSchema, type EditorPropertyDefinition } from '../../../entities/card/schema'
import type { DeepReadonly } from 'vue'

type ProjectCustomBlockFieldSource = {
  manifest: { publicFieldKeys: readonly string[] }
  block: DeepReadonly<CardBlock>
}

export type ProjectCustomBlockPropertySchema = {
  fields: Readonly<Record<string, EditorPropertyDefinition>>
  labels: Readonly<Record<string, string>>
  customKeys: ReadonlySet<string>
}

export type ProjectCustomBlockSizeEditPolicy = {
  widthReadonly: boolean
  heightReadonly: boolean
}

export function createProjectCustomBlockPropertySchema(
  entry: ProjectCustomBlockFieldSource,
  fieldKeys: readonly string[] = entry.manifest.publicFieldKeys,
): ProjectCustomBlockPropertySchema {
  const resolved = resolvePropertyEditorSchema(entry.block as DeepReadonly<Record<string, unknown>>)
  const blockRecord = entry.block as DeepReadonly<Record<string, unknown>>
  const fields = Object.fromEntries(fieldKeys.flatMap(fieldKey => {
    const definition = resolved.fields[fieldKey]
    if (!definition || definition.fieldType === 'object' || definition.isReadonly || fieldKey === 'customCss') return []
    return [[fieldKey, {
      ...definition,
      ...(Object.prototype.hasOwnProperty.call(blockRecord, fieldKey)
        ? { defaultValue: blockRecord[fieldKey] }
        : {}),
    }]]
  }))
  return {
    fields,
    labels: Object.fromEntries(Object.keys(fields).flatMap(fieldKey => (
      resolved.labels[fieldKey] ? [[fieldKey, resolved.labels[fieldKey]]] : []
    ))),
    customKeys: new Set(Object.keys(fields).filter(fieldKey => resolved.customKeys.has(fieldKey))),
  }
}

export function resolveProjectCustomBlockSizeEditPolicy(
  block: DeepReadonly<CardBlock>,
): ProjectCustomBlockSizeEditPolicy {
  const fields = resolvePropertyEditorSchema(block as DeepReadonly<Record<string, unknown>>).fields
  return {
    widthReadonly: fields.width?.isReadonly === true,
    heightReadonly: fields.height?.isReadonly === true,
  }
}

export function getProjectCustomBlockPublicFields(
  entry: ProjectCustomBlockFieldSource,
): Readonly<Record<string, EditorPropertyDefinition>> {
  return createProjectCustomBlockPropertySchema(entry).fields
}
