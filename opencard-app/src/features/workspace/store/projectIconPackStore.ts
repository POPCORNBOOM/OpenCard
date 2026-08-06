import { computed, readonly, ref, type ComputedRef, type Ref } from 'vue'
import {
  projectIconPackCatalogService,
  type ProjectIconPackCatalogService,
} from '../services/projectIconPackCatalogService'
import type {
  ProjectIconPackCatalogEntry,
  ProjectIconPackCatalogKey,
  ProjectIconPackCatalogWarning,
} from '../model/projectIconPackCatalog'

export interface ProjectIconPackStore {
  packs: Readonly<Ref<readonly ProjectIconPackCatalogEntry[]>>
  builtinPacks: ComputedRef<readonly ProjectIconPackCatalogEntry[]>
  userPacks: ComputedRef<readonly ProjectIconPackCatalogEntry[]>
  warnings: Readonly<Ref<readonly ProjectIconPackCatalogWarning[]>>
  isLoading: Readonly<Ref<boolean>>
  error: Readonly<Ref<unknown>>
  load(): Promise<void>
  pickUserIconPack(title: string): Promise<string | null>
  importUserIconPack(sourcePath: string): Promise<ProjectIconPackCatalogEntry | null>
  findPack(key: ProjectIconPackCatalogKey): ProjectIconPackCatalogEntry | null
}

export function createProjectIconPackStore(
  service: ProjectIconPackCatalogService = projectIconPackCatalogService,
): ProjectIconPackStore {
  const packs = ref<ProjectIconPackCatalogEntry[]>([])
  const warnings = ref<ProjectIconPackCatalogWarning[]>([])
  const isLoading = ref(false)
  const error = ref<unknown>(null)
  let loadPromise: Promise<void> | null = null

  async function load(): Promise<void> {
    if (loadPromise) return await loadPromise
    isLoading.value = true
    loadPromise = (async () => {
      try {
        const catalog = await service.loadCatalog()
        packs.value = catalog.packs
        warnings.value = catalog.warnings
        error.value = null
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

  async function importUserIconPack(sourcePath: string): Promise<ProjectIconPackCatalogEntry | null> {
    const installedPath = await service.importUserIconPack(sourcePath)
    await load()
    return packs.value.find((pack) => pack.path === installedPath) ?? null
  }

  function findPack(key: ProjectIconPackCatalogKey): ProjectIconPackCatalogEntry | null {
    return packs.value.find((pack) => pack.key === key) ?? null
  }

  const builtinPacks = computed(() => packs.value.filter((pack) => pack.source === 'builtin'))
  const userPacks = computed(() => packs.value.filter((pack) => pack.source === 'user'))
  return {
    packs: readonly(packs),
    builtinPacks,
    userPacks,
    warnings: readonly(warnings),
    isLoading: readonly(isLoading),
    error: readonly(error),
    load,
    pickUserIconPack: service.pickUserIconPack.bind(service),
    importUserIconPack,
    findPack,
  }
}

const projectIconPackStore = createProjectIconPackStore()

export function useProjectIconPackStore(): ProjectIconPackStore {
  return projectIconPackStore
}
