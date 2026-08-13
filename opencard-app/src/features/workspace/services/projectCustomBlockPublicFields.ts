import { getAdditionalFieldPropertyDefinition } from '../../../entities/card/model'
import { getTypePropertyEditorSchema, type EditorPropertyDefinition } from '../../../entities/card/schema'
import type { DeepReadonly } from 'vue'
import type { ProjectCustomBlockCatalogEntry } from '../model/projectCustomBlocks'

export function getProjectCustomBlockPublicFields(
  entry: Pick<DeepReadonly<ProjectCustomBlockCatalogEntry>, 'manifest' | 'block'>,
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
