import { createCustomBlock, type CustomBlock } from '../../../entities/card/model'

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
  init: Partial<Pick<CustomBlock, 'id' | 'name'>> = {},
): CustomBlock {
  return createCustomBlock({
    id: init.id,
    name: init.name ?? entry.manifest.name,
    customBlockKey: customBlockReferenceFromManifestId(entry.manifest.packageId),
  })
}
