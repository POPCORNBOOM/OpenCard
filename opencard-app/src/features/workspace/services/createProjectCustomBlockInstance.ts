import { createCustomBlock, setBlockProperty, type CustomBlock } from '../../../entities/card/model'

type CustomBlockInstanceSource = {
  readonly manifest: {
    readonly packageId: string
    readonly name: string
  }
}

/**
 * Creates a lightweight host reference. The definition remains in the `.ocblock` file;
 * only values explicitly edited on this instance are persisted on the host.
 */
function customBlockReferenceFromManifestId(packageId: string): string {
  const value = packageId.trim()
  if (value.toLocaleLowerCase().startsWith('block:') || value.includes('@block:')) return value
  const separator = value.lastIndexOf('/')
  if (separator > 0 && separator < value.length - 1) {
    return `${value.slice(0, separator)}@block:${value.slice(separator + 1)}`
  }
  return `block:${value}`
}

export function createProjectCustomBlockInstance(
  entry: CustomBlockInstanceSource,
  init: { id?: string; name?: string } = {},
): CustomBlock {
  const block = createCustomBlock({
    id: init.id,
    customBlockKey: customBlockReferenceFromManifestId(entry.manifest.packageId),
  })
  setBlockProperty(block, 'name', init.name ?? entry.manifest.name)
  return block
}
