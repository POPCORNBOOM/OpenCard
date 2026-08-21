import { getAdditionalFieldPropertyDefinition, type CardBlock } from '../../../entities/card/model'
import { getTypePropertyEditorSchema, type EditorPropertyDefinition } from '../../../entities/card/schema'
import type { DeepReadonly } from 'vue'

export function getProjectCustomBlockPublicFields(
  entry: {
    manifest: { publicFieldKeys: readonly string[] }
    block: DeepReadonly<CardBlock>
  },
): Readonly<Record<string, EditorPropertyDefinition>> {
  const nativeSchema = getTypePropertyEditorSchema(entry.block.type)
  const additional = entry.block.additionalFieldDefinition ?? {}
  return Object.fromEntries(entry.manifest.publicFieldKeys.flatMap(fieldKey => {
    const definition = additional[fieldKey]
      ? getAdditionalFieldPropertyDefinition(additional[fieldKey])
      : nativeSchema[fieldKey]
    if (!definition || definition.fieldType === 'object' || definition.isReadonly || fieldKey === 'customCss') return []
    return [[fieldKey, definition]]
  }))
}
