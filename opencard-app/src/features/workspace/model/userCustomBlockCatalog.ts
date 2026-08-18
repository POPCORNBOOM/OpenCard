import type { ProjectCustomBlockManifest } from './projectCustomBlocks'

export const USER_CUSTOM_BLOCK_DIRECTORY_NAME = 'custom-blocks'
export const USER_CUSTOM_BLOCK_CATALOG_EXTENSION = 'ocblock'
export const USER_CUSTOM_BLOCK_CATALOG_SUFFIX = `.${USER_CUSTOM_BLOCK_CATALOG_EXTENSION}`

export type UserCustomBlockCatalogKey = `user:${string}`

export type UserCustomBlockCatalogEntry = {
  key: UserCustomBlockCatalogKey
  id: string
  customBlockKey: string
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

export function userCustomBlockCatalogKey(customBlockKey: string): UserCustomBlockCatalogKey {
  return `user:${customBlockKey.toLocaleLowerCase()}`
}

export function createUserCustomBlockCatalogEntry(
  manifest: ProjectCustomBlockManifest,
  path: string,
): UserCustomBlockCatalogEntry {
  return {
    key: userCustomBlockCatalogKey(manifest.customBlockKey),
    id: manifest.customBlockKey,
    customBlockKey: manifest.customBlockKey,
    name: manifest.name,
    ...(manifest.description ? { description: manifest.description } : {}),
    path,
  }
}
