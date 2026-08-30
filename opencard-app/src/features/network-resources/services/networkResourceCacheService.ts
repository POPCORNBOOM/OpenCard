import { Channel, invoke } from '@tauri-apps/api/core'
import { join } from '@tauri-apps/api/path'
import { resolveAppStoragePath } from '../../../shared/storage/appStoragePaths'
import { fileSystemService, type FileSystemService } from '../../workspace/services/fileSystemService'
import {
  networkResourceExtension,
  normalizeNetworkResourceProjectPath,
  normalizeNetworkResourceUrl,
  parseNetworkResourceProjectManifest,
  parseNetworkResourceRootManifest,
  type NetworkResourceCacheEntry,
  type NetworkResourceProjectManifest,
  type NetworkResourceRootManifest,
} from '../model/networkResourceCache'

const CACHE_DIRECTORY_NAME = 'cache'
const CACHE_MANIFEST_FILE_NAME = 'cache.json'

export type NetworkResourceProgress = {
  url: string
  receivedBytes: number
  totalBytes: number | null
  progress: number | null
}

export type CachedNetworkResource = {
  url: string
  path: string
  refreshedAt: string
}

export interface NetworkResourceCacheProject {
  getCached(url: string): Promise<CachedNetworkResource | null>
  refresh(url: string, onProgress?: (progress: NetworkResourceProgress) => void): Promise<CachedNetworkResource>
  listUrls(): Promise<string[]>
}

type DownloadProgressPayload = {
  url: string
  receivedBytes: number
  totalBytes?: number | null
}

type DownloadResult = {
  contentType?: string | null
  receivedBytes: number
}

type DownloadTransport = (
  url: string,
  destinationPath: string,
  onProgress: (progress: NetworkResourceProgress) => void,
) => Promise<DownloadResult>

type CacheServiceDependencies = {
  fs: FileSystemService
  download: DownloadTransport
  appStoragePath: (...segments: string[]) => Promise<string>
  joinPath: (...segments: string[]) => Promise<string>
  randomUuid: () => string
  now: () => Date
}

async function defaultDownload(
  url: string,
  destinationPath: string,
  onProgress: (progress: NetworkResourceProgress) => void,
): Promise<DownloadResult> {
  const channel = new Channel<DownloadProgressPayload>()
  channel.onmessage = payload => {
    const totalBytes = typeof payload.totalBytes === 'number' ? payload.totalBytes : null
    onProgress({
      url: payload.url,
      receivedBytes: payload.receivedBytes,
      totalBytes,
      progress: totalBytes && totalBytes > 0 ? Math.min(1, payload.receivedBytes / totalBytes) : null,
    })
  }
  return await invoke<DownloadResult>('download_network_resource', { url, destinationPath, onProgress: channel })
}

const defaultDependencies: CacheServiceDependencies = {
  fs: fileSystemService,
  download: defaultDownload,
  appStoragePath: resolveAppStoragePath,
  joinPath: join,
  randomUuid: () => crypto.randomUUID(),
  now: () => new Date(),
}

function parseJson(content: string): unknown {
  try {
    return JSON.parse(content)
  } catch {
    return null
  }
}

export class NetworkResourceCacheService {
  private readonly dependencies: CacheServiceDependencies
  private rootManifestPromise: Promise<NetworkResourceRootManifest> | null = null
  private rootMutationQueue = Promise.resolve()
  private readonly projects = new Map<string, Promise<NetworkResourceCacheProject>>()

  constructor(dependencies: Partial<CacheServiceDependencies> = {}) {
    this.dependencies = { ...defaultDependencies, ...dependencies }
  }

  async forProject(projectPath: string): Promise<NetworkResourceCacheProject> {
    const projectKey = normalizeNetworkResourceProjectPath(projectPath)
    if (!projectKey) throw new Error('Network resource cache requires an absolute project path')
    let pending = this.projects.get(projectKey)
    if (!pending) {
      pending = this.openProject(projectKey)
      this.projects.set(projectKey, pending)
    }
    try {
      return await pending
    } catch (error) {
      this.projects.delete(projectKey)
      throw error
    }
  }

  private async cacheRoot(): Promise<string> {
    return await this.dependencies.appStoragePath(CACHE_DIRECTORY_NAME)
  }

  private async readJson(path: string): Promise<unknown> {
    if (!await this.dependencies.fs.fileExists(path)) return null
    try {
      return parseJson(await this.dependencies.fs.readFile(path))
    } catch {
      return null
    }
  }

  private async writeJsonAtomically(path: string, value: unknown): Promise<void> {
    const temporaryPath = `${path}.${this.dependencies.randomUuid()}.tmp`
    await this.dependencies.fs.writeFile(temporaryPath, JSON.stringify(value, null, 2))
    try {
      await this.dependencies.fs.renameFile(temporaryPath, path)
    } catch (error) {
      if (await this.dependencies.fs.fileExists(temporaryPath)) await this.dependencies.fs.deleteFile(temporaryPath)
      throw error
    }
  }

  private async rootManifest(): Promise<NetworkResourceRootManifest> {
    if (!this.rootManifestPromise) {
      this.rootManifestPromise = (async () => {
        const root = await this.cacheRoot()
        await this.dependencies.fs.createDirectory(root)
        return parseNetworkResourceRootManifest(await this.readJson(
          await this.dependencies.joinPath(root, CACHE_MANIFEST_FILE_NAME),
        ))
      })()
    }
    return await this.rootManifestPromise
  }

  private async projectUid(projectKey: string): Promise<string> {
    let resolveUid: ((uid: string) => void) | null = null
    let rejectUid: ((error: unknown) => void) | null = null
    const result = new Promise<string>((resolve, reject) => {
      resolveUid = resolve
      rejectUid = reject
    })
    this.rootMutationQueue = this.rootMutationQueue.catch(() => undefined).then(async () => {
      try {
        const manifest = await this.rootManifest()
        const existing = manifest.projects[projectKey]
        if (existing) {
          resolveUid?.(existing)
          return
        }
        const uid = this.dependencies.randomUuid()
        const next = { projects: { ...manifest.projects, [projectKey]: uid } }
        const root = await this.cacheRoot()
        await this.writeJsonAtomically(await this.dependencies.joinPath(root, CACHE_MANIFEST_FILE_NAME), next)
        this.rootManifestPromise = Promise.resolve(next)
        resolveUid?.(uid)
      } catch (error) {
        rejectUid?.(error)
      }
    })
    return await result
  }

  private async openProject(projectKey: string): Promise<NetworkResourceCacheProject> {
    const root = await this.cacheRoot()
    const uid = await this.projectUid(projectKey)
    const directory = await this.dependencies.joinPath(root, uid)
    const manifestPath = await this.dependencies.joinPath(directory, CACHE_MANIFEST_FILE_NAME)
    await this.dependencies.fs.createDirectory(directory)

    let manifestPromise: Promise<NetworkResourceProjectManifest> | null = null
    let mutationQueue = Promise.resolve()
    const refreshRequests = new Map<string, Promise<CachedNetworkResource>>()
    const loadManifest = async (): Promise<NetworkResourceProjectManifest> => {
      if (!manifestPromise) {
        manifestPromise = this.readJson(manifestPath).then(parseNetworkResourceProjectManifest)
      }
      return await manifestPromise
    }
    const resourcePath = async (entry: NetworkResourceCacheEntry): Promise<string> => (
      await this.dependencies.joinPath(directory, `${entry.uid}${entry.extension}`)
    )
    const getCached = async (source: string): Promise<CachedNetworkResource | null> => {
      const url = normalizeNetworkResourceUrl(source)
      if (!url) return null
      const entry = (await loadManifest()).resources[url]
      if (!entry) return null
      const path = await resourcePath(entry)
      return await this.dependencies.fs.fileExists(path) ? { url, path, refreshedAt: entry.refreshedAt } : null
    }
    const refresh = async (
      source: string,
      onProgress: (progress: NetworkResourceProgress) => void = () => undefined,
    ): Promise<CachedNetworkResource> => {
      const url = normalizeNetworkResourceUrl(source)
      if (!url) throw new Error('Network resources must use a valid HTTPS URL')
      const existingRequest = refreshRequests.get(url)
      if (existingRequest) return await existingRequest
      const result = (async () => {
        const initialManifest = await loadManifest()
        const initialEntry = initialManifest.resources[url]
        const uid = initialEntry?.uid ?? this.dependencies.randomUuid()
        const temporaryPath = await this.dependencies.joinPath(directory, `${uid}.${this.dependencies.randomUuid()}.download`)
        try {
          const download = await this.dependencies.download(url, temporaryPath, onProgress)
          let committed!: CachedNetworkResource
          mutationQueue = mutationQueue.catch(() => undefined).then(async () => {
            const manifest = await loadManifest()
            const existing = manifest.resources[url] ?? initialEntry
            const extension = existing?.extension ?? networkResourceExtension(url, download.contentType)
            const finalPath = await this.dependencies.joinPath(directory, `${uid}${extension}`)
            const backupPath = await this.dependencies.joinPath(directory, `${uid}.backup`)
            const hasExistingFile = Boolean(existing) && await this.dependencies.fs.fileExists(finalPath)
            if (hasExistingFile) await this.dependencies.fs.copyFile(finalPath, backupPath)
            try {
              await this.dependencies.fs.renameFile(temporaryPath, finalPath)
            } catch (error) {
              if (await this.dependencies.fs.fileExists(backupPath)) await this.dependencies.fs.deleteFile(backupPath)
              throw error
            }
            const refreshedAt = this.dependencies.now().toISOString()
            const next: NetworkResourceProjectManifest = {
              resources: { ...manifest.resources, [url]: { uid, extension, refreshedAt } },
            }
            try {
              await this.writeJsonAtomically(manifestPath, next)
            } catch (error) {
              if (hasExistingFile && await this.dependencies.fs.fileExists(backupPath)) {
                await this.dependencies.fs.renameFile(backupPath, finalPath)
              }
              throw error
            }
            if (await this.dependencies.fs.fileExists(backupPath)) await this.dependencies.fs.deleteFile(backupPath)
            manifestPromise = Promise.resolve(next)
            committed = { url, path: finalPath, refreshedAt }
          })
          await mutationQueue
          return committed
        } finally {
          if (await this.dependencies.fs.fileExists(temporaryPath)) await this.dependencies.fs.deleteFile(temporaryPath)
        }
      })()
      refreshRequests.set(url, result)
      void result.finally(() => refreshRequests.delete(url)).catch(() => undefined)
      return await result
    }

    return {
      getCached,
      refresh,
      listUrls: async () => Object.keys((await loadManifest()).resources),
    }
  }
}

export const networkResourceCacheService = new NetworkResourceCacheService()
