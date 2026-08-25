export const USER_CUSTOM_BLOCK_DIRECTORY_NAME = 'custom-blocks'
export const USER_CUSTOM_BLOCK_CATALOG_EXTENSION = 'ocblock'
export const USER_CUSTOM_BLOCK_CATALOG_SUFFIX = `.${USER_CUSTOM_BLOCK_CATALOG_EXTENSION}`

export type UserCustomBlockCatalogKey = `user:${string}`

export type UserCustomBlockCatalogEntry = {
  key: UserCustomBlockCatalogKey
  id: string
  blockKey: string
  name: string
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
  definition: { key: string; name: string },
  path: string,
): UserCustomBlockCatalogEntry {
  return {
    key: userCustomBlockCatalogKey(definition.key),
    id: definition.key,
    blockKey: definition.key,
    name: definition.name,
    path,
  }
}
