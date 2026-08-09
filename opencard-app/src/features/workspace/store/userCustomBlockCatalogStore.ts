import { readonly, ref, type Ref } from 'vue'
import type {
  UserCustomBlockCatalogEntry,
  UserCustomBlockCatalogKey,
  UserCustomBlockCatalogWarning,
} from '../model/userCustomBlockCatalog'
import {
  userCustomBlockCatalogService,
  type UserCustomBlockCatalogService,
} from '../services/userCustomBlockCatalogService'

export interface UserCustomBlockCatalogStore {
  blocks: Readonly<Ref<readonly UserCustomBlockCatalogEntry[]>>
  warnings: Readonly<Ref<readonly UserCustomBlockCatalogWarning[]>>
  isLoading: Readonly<Ref<boolean>>
  error: Readonly<Ref<unknown>>
  load(): Promise<void>
  pickUserCustomBlock(title: string): Promise<string | null>
  importUserCustomBlock(sourcePath: string): Promise<UserCustomBlockCatalogEntry | null>
  findBlock(key: UserCustomBlockCatalogKey): UserCustomBlockCatalogEntry | null
}

export function createUserCustomBlockCatalogStore(
  service: UserCustomBlockCatalogService = userCustomBlockCatalogService,
): UserCustomBlockCatalogStore {
  const blocks = ref<UserCustomBlockCatalogEntry[]>([])
  const warnings = ref<UserCustomBlockCatalogWarning[]>([])
  const isLoading = ref(false)
  const error = ref<unknown>(null)
  let loadPromise: Promise<void> | null = null

  async function load(): Promise<void> {
    if (loadPromise) return await loadPromise
    loadPromise = (async () => {
      isLoading.value = true
      error.value = null
      try {
        const snapshot = await service.loadCatalog()
        blocks.value = snapshot.blocks
        warnings.value = snapshot.warnings
      } catch (cause) {
        error.value = cause
        throw cause
      } finally {
        isLoading.value = false
        loadPromise = null
      }
    })()
    await loadPromise
  }

  async function importUserCustomBlock(sourcePath: string): Promise<UserCustomBlockCatalogEntry | null> {
    const installedPath = await service.importUserCustomBlock(sourcePath)
    await load()
    return blocks.value.find(block => block.path === installedPath) ?? null
  }

  function findBlock(key: UserCustomBlockCatalogKey): UserCustomBlockCatalogEntry | null {
    return blocks.value.find(block => block.key === key) ?? null
  }

  return {
    blocks: readonly(blocks),
    warnings: readonly(warnings),
    isLoading: readonly(isLoading),
    error: readonly(error),
    load,
    pickUserCustomBlock: service.pickUserCustomBlock.bind(service),
    importUserCustomBlock,
    findBlock,
  }
}

const userCustomBlockCatalogStore = createUserCustomBlockCatalogStore()

export function useUserCustomBlockCatalogStore(): UserCustomBlockCatalogStore {
  return userCustomBlockCatalogStore
}
