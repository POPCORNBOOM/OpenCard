import { readonly, ref, type Ref } from 'vue'
import {
  storedResourcePackageLibrary,
  type StoredResourcePackageLibraryService,
} from '../services/storedResourcePackageLibrary'
import type { StoredResourcePackage, StoredResourcePackageWarning } from '../model/storedResourcePackage'

export interface StoredResourcePackageStore {
  packs: Readonly<Ref<readonly StoredResourcePackage[]>>
  warnings: Readonly<Ref<readonly StoredResourcePackageWarning[]>>
  isLoading: Readonly<Ref<boolean>>
  load(): Promise<void>
  pickSourceFile(title: string): Promise<string | null>
  importPackage(sourcePath: string): Promise<StoredResourcePackage>
  removePackage(path: string): Promise<void>
  findPackage(path: string): StoredResourcePackage | null
}

export function createStoredResourcePackageStore(
  service: StoredResourcePackageLibraryService = storedResourcePackageLibrary,
): StoredResourcePackageStore {
  const packs = ref<StoredResourcePackage[]>([])
  const warnings = ref<StoredResourcePackageWarning[]>([])
  const isLoading = ref(false)
  let loadPromise: Promise<void> | null = null

  async function load(): Promise<void> {
    if (loadPromise) return await loadPromise
    isLoading.value = true
    loadPromise = (async () => {
      try {
        const library = await service.loadLibrary()
        packs.value = library.packs
        warnings.value = library.warnings
      } finally {
        isLoading.value = false
        loadPromise = null
      }
    })()
    await loadPromise
  }

  async function importPackage(sourcePath: string): Promise<StoredResourcePackage> {
    const imported = await service.importPackage(sourcePath)
    // 导入后重新读取存储，列表与磁盘保持一致；返回的条目与列表里的是同一份信息。
    await load()
    return imported
  }

  async function removePackage(path: string): Promise<void> {
    await service.removePackage(path)
    await load()
  }

  function findPackage(path: string): StoredResourcePackage | null {
    return packs.value.find((pack) => pack.path === path) ?? null
  }

  return {
    packs: readonly(packs),
    warnings: readonly(warnings),
    isLoading: readonly(isLoading),
    load,
    pickSourceFile: service.pickSourceFile.bind(service),
    importPackage,
    removePackage,
    findPackage,
  }
}

const storedResourcePackageStore = createStoredResourcePackageStore()

export function useStoredResourcePackageStore(): StoredResourcePackageStore {
  return storedResourcePackageStore
}
