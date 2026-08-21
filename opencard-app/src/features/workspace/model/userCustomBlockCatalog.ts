import type { ProjectCustomBlockManifest } from './projectCustomBlocks'

export const USER_CUSTOM_BLOCK_DIRECTORY_NAME = 'custom-blocks'
export const USER_CUSTOM_BLOCK_CATALOG_EXTENSION = 'ocblock'
export const USER_CUSTOM_BLOCK_CATALOG_SUFFIX = `.${USER_CUSTOM_BLOCK_CATALOG_EXTENSION}`

export type UserCustomBlockCatalogKey = `user:${string}`

export type UserCustomBlockCatalogEntry = {
  key: UserCustomBlockCatalogKey
  id: string
  packageId: string
  name: string
  description?: string
  path: string
}

export type UserCustomBlockCatalogWarning = {
  path: string
  reason: string
}

export type UserCustomBlockCatalogSnapshot = {
  blocks: UserCustomBlockCatalogEntry[]
  warnings: UserCustomBlockCatalogWarning[]
}

export function userCustomBlockCatalogKey(packageId: string): UserCustomBlockCatalogKey {
  return `user:${packageId.toLocaleLowerCase()}`
}

export function createUserCustomBlockCatalogEntry(
  manifest: ProjectCustomBlockManifest,
  path: string,
): UserCustomBlockCatalogEntry {
  return {
    key: userCustomBlockCatalogKey(manifest.packageId),
    id: manifest.packageId,
    packageId: manifest.packageId,
    name: manifest.name,
    ...(manifest.description ? { description: manifest.description } : {}),
    path,
  }
}
