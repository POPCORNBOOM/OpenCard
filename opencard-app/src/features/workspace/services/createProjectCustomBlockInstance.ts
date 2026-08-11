import { createCustomBlock, type CustomBlock } from '../../../entities/card/model'

type CustomBlockInstanceSource = {
  readonly manifest: {
    readonly customBlockKey: string
    readonly name: string
    readonly publicFieldKeys: readonly string[]
  }
  readonly block: Readonly<Record<string, unknown>>
}

export function createProjectCustomBlockInstance(
  entry: CustomBlockInstanceSource,
  init: Partial<Pick<CustomBlock, 'id' | 'name'>> = {},
): CustomBlock {
  const values = Object.fromEntries(entry.manifest.publicFieldKeys
    .filter(fieldKey => typeof entry.block[fieldKey] === 'string')
    .map(fieldKey => [fieldKey, entry.block[fieldKey]]))
  const block = createCustomBlock({
    id: init.id,
    name: init.name ?? entry.manifest.name,
    customBlockKey: entry.manifest.customBlockKey,
  })
  Object.assign(block, values)
  return block
}
