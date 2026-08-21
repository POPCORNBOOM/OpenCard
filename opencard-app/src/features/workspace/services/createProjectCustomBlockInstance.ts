import { createCustomBlock, type CustomBlock } from '../../../entities/card/model'

type CustomBlockInstanceSource = {
  readonly manifest: {
    readonly packageId: string
    readonly name: string
  }
}

/**
 * Creates a lightweight host reference. Package defaults remain in block.json;
 * only values explicitly edited on this instance are persisted on the host.
 */
export function createProjectCustomBlockInstance(
  entry: CustomBlockInstanceSource,
  init: Partial<Pick<CustomBlock, 'id' | 'name'>> = {},
): CustomBlock {
  return createCustomBlock({
    id: init.id,
    name: init.name ?? entry.manifest.name,
    packageId: entry.manifest.packageId,
  })
}
