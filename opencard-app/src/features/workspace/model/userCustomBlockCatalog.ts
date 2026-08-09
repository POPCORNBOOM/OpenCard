import type { ProjectCustomBlockManifest } from './projectCustomBlocks'

export const USER_CUSTOM_BLOCK_DIRECTORY_NAME = 'custom-blocks'
export const USER_CUSTOM_BLOCK_CATALOG_EXTENSION = 'ocblock'
export const USER_CUSTOM_BLOCK_CATALOG_SUFFIX = `.${USER_CUSTOM_BLOCK_CATALOG_EXTENSION}`

export type UserCustomBlockCatalogKey = `user:${string}`

export type UserCustomBlockCatalogEntry = {
  key: UserCustomBlockCatalogKey
  id: string
  blockKey: string
  name: string
  description?: string
  interfaceHash: string
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

export function userCustomBlockCatalogKey(blockKey: string): UserCustomBlockCatalogKey {
  return `user:${blockKey.toLocaleLowerCase()}`
}

export function createUserCustomBlockCatalogEntry(
  manifest: ProjectCustomBlockManifest,
  path: string,
): UserCustomBlockCatalogEntry {
  return {
    key: userCustomBlockCatalogKey(manifest.key),
    id: manifest.key,
    blockKey: manifest.key,
    name: manifest.name,
    ...(manifest.description ? { description: manifest.description } : {}),
    interfaceHash: manifest.interfaceHash,
    path,
  }
}
