import { createCustomBlock, setBlockProperty, type CustomBlock } from '../../../entities/card/model'

type CustomBlockInstanceSource = {
  readonly definition: {
    readonly key: string
    readonly name: string
  }
}

/**
 * Creates a lightweight host reference. The definition remains in the `.ocblock` file;
 * only values explicitly edited on this instance are persisted on the host.
 */
function customBlockReferenceFromKey(key: string): string {
  const value = key.trim()
  if (value.toLocaleLowerCase().startsWith('block:') || value.includes('@block:')) return value
  return `block:${value}`
}

export function createProjectCustomBlockInstance(
  entry: CustomBlockInstanceSource,
  init: { id?: string; name?: string } = {},
): CustomBlock {
  const block = createCustomBlock({
    id: init.id,
    customBlockKey: customBlockReferenceFromKey(entry.definition.key),
  })
  setBlockProperty(block, 'name', init.name ?? entry.definition.name)
  return block
}
