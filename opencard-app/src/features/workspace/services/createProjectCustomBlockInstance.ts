import { createCustomBlock, type CustomBlock } from '../../../entities/card/model'
import type { ProjectCustomBlockPublicField } from '../model/projectCustomBlocks'

type CustomBlockInstanceSource = {
  readonly manifest: {
    readonly key: string
    readonly name: string
    readonly interfaceHash: string
    readonly publicFields: readonly ProjectCustomBlockPublicField[]
  }
}

export function createProjectCustomBlockInstance(
  entry: CustomBlockInstanceSource,
  init: Partial<Pick<CustomBlock, 'id' | 'name'>> = {},
): CustomBlock {
  const definitions = Object.fromEntries(entry.manifest.publicFields.map(field => [field.key, {
    fieldType: field.fieldType,
    ...(field.title ? { title: field.title } : {}),
  }]))
  const values = Object.fromEntries(entry.manifest.publicFields
    .filter(field => field.defaultValue !== undefined)
    .map(field => [field.key, field.defaultValue]))
  const block = createCustomBlock({
    id: init.id,
    name: init.name ?? entry.manifest.name,
    source: `block:${entry.manifest.key}`,
    interfaceHash: entry.manifest.interfaceHash,
    additionalFieldDefinition: definitions,
  })
  Object.assign(block, values)
  return block
}
