import { nextTick, shallowReactive } from 'vue'
import { normalizeNetworkResourceProjectPath, normalizeNetworkResourceUrl } from '../model/networkResourceCache'
import {
  networkResourceCacheService,
  type CachedNetworkResource,
  type NetworkResourceCacheProject,
  type NetworkResourceCacheService,
  type NetworkResourceProgress,
} from '../services/networkResourceCacheService'

export type ProjectNetworkResourceProgress = NetworkResourceProgress & { projectPath: string }

export type NetworkResourceRefreshSummary = {
  total: number
  succeeded: number
  failures: readonly { url: string, error: string }[]
}

export interface ProjectNetworkResources {
  get(url: string): CachedNetworkResource | null
  refresh(url: string): Promise<CachedNetworkResource>
  refreshAll(): Promise<NetworkResourceRefreshSummary>
  waitForIdle(): Promise<void>
  readonly activeDownloads: ReadonlyMap<string, NetworkResourceProgress>
}

type ProjectRuntimeState = {
  projectPath: string
  cache: Promise<NetworkResourceCacheProject>
  resources: Map<string, CachedNetworkResource | null>
  loadedUrls: Set<string>
  requests: Map<string, Promise<CachedNetworkResource | null>>
  activeDownloads: Map<string, NetworkResourceProgress>
}

type NetworkResourceManagerDependencies = {
  cacheService: Pick<NetworkResourceCacheService, 'forProject'>
}

const defaultDependencies: NetworkResourceManagerDependencies = {
  cacheService: networkResourceCacheService,
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export class NetworkResourceManager {
  readonly activeDownloads = shallowReactive(new Map<string, ProjectNetworkResourceProgress>())
  private readonly dependencies: NetworkResourceManagerDependencies
  private readonly projects = new Map<string, ProjectRuntimeState>()

  constructor(dependencies: Partial<NetworkResourceManagerDependencies> = {}) {
    this.dependencies = { ...defaultDependencies, ...dependencies }
  }

  forProject(projectPath: string, canRequest: (url: string) => boolean): ProjectNetworkResources {
    const projectKey = normalizeNetworkResourceProjectPath(projectPath)
    if (!projectKey) throw new Error('Network resources require an absolute project path')
    let state = this.projects.get(projectKey)
    if (!state) {
      state = {
        projectPath,
        cache: this.dependencies.cacheService.forProject(projectPath),
        resources: shallowReactive(new Map()),
        loadedUrls: new Set(),
        requests: new Map(),
        activeDownloads: shallowReactive(new Map()),
      }
      this.projects.set(projectKey, state)
    }

    const allowedUrl = (source: string): string | null => {
      const url = normalizeNetworkResourceUrl(source)
      return url && canRequest(url) ? url : null
    }
    const recordProgress = (url: string, progress: NetworkResourceProgress): void => {
      state.activeDownloads.set(url, progress)
      this.activeDownloads.set(`${projectKey}\0${url}`, { ...progress, projectPath: state.projectPath })
    }
    const clearProgress = (url: string): void => {
      state.activeDownloads.delete(url)
      this.activeDownloads.delete(`${projectKey}\0${url}`)
    }
    const request = (url: string, force: boolean): Promise<CachedNetworkResource | null> => {
      const existingRequest = state.requests.get(url)
      if (existingRequest) return existingRequest
      const pending = (async () => {
        try {
          const cache = await state.cache
          if (!force) {
            const cached = await cache.getCached(url)
            state.loadedUrls.add(url)
            state.resources.set(url, cached)
            if (cached) return cached
          }
          const refreshed = await cache.refresh(url, progress => recordProgress(url, progress))
          state.loadedUrls.add(url)
          state.resources.set(url, refreshed)
          return refreshed
        } catch (error) {
          state.loadedUrls.add(url)
          if (!state.resources.has(url)) state.resources.set(url, null)
          throw error
        } finally {
          clearProgress(url)
        }
      })()
      state.requests.set(url, pending)
      void pending.finally(() => state.requests.delete(url)).catch(() => undefined)
      return pending
    }
    const loadCached = (url: string): void => {
      if (state.loadedUrls.has(url) || state.requests.has(url)) return
      void request(url, false).catch(() => undefined)
    }

    return {
      get: source => {
        const url = allowedUrl(source)
        if (!url) return null
        const resource = state.resources.get(url) ?? null
        if (!state.loadedUrls.has(url)) loadCached(url)
        return resource
      },
      refresh: async source => {
        const url = allowedUrl(source)
        if (!url) throw new Error('Network resource is not allowed')
        const resource = await request(url, true)
        if (!resource) throw new Error('Network resource refresh did not produce a cache file')
        return resource
      },
      refreshAll: async () => {
        const urls = (await (await state.cache).listUrls()).filter(canRequest)
        const results = await Promise.allSettled(urls.map(url => request(url, true)))
        const failures = results.flatMap((result, index) => result.status === 'rejected'
          ? [{ url: urls[index] ?? '', error: describeError(result.reason) }]
          : [])
        return { total: urls.length, succeeded: urls.length - failures.length, failures }
      },
      waitForIdle: async () => {
        do {
          await Promise.allSettled([...state.requests.values()])
          await nextTick()
        } while (state.requests.size > 0)
      },
      activeDownloads: state.activeDownloads,
    }
  }
}

export const networkResourceManager = new NetworkResourceManager()
