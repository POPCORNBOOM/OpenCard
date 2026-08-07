import { createCustomBlock, type CustomBlock } from '../../../entities/card/model'
import type { ProjectCustomBlockCatalogEntry } from '../model/projectCustomBlocks'

export function createProjectCustomBlockInstance(
  entry: ProjectCustomBlockCatalogEntry,
  init: Partial<Pick<CustomBlock, 'id' | 'name'>> = {},
): CustomBlock {
  const definitions = Object.fromEntries(entry.manifest.publicFields.map(field => [field.key, {
    fieldType: field.fieldType,
    ...(field.title ? { title: field.title } : {}),
  }]))
  const values = Object.fromEntries(entry.manifest.publicFields
    .filter(field => field.defaultValue !== undefined)
    .map(field => [field.key, field.defaultValue]))
  return createCustomBlock({
    id: init.id,
    name: init.name ?? entry.manifest.name,
    source: `block:${entry.manifest.key}`,
    interfaceHash: entry.manifest.interfaceHash,
    additionalFieldDefinition: definitions,
    ...values,
  })
}
