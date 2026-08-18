import type { ProjectCustomBlockCatalogEntry } from '../model/projectCustomBlocks'

export const PROJECT_CUSTOM_BLOCK_RESOURCE_BUDGET_BYTES = 256 * 1024 * 1024

export type ProjectCustomBlockLoadState = 'unloaded' | 'loading' | 'ready' | 'error'

export type ProjectCustomBlockCacheValue = {
  entry: ProjectCustomBlockCatalogEntry
  /** Decompressed bytes plus any renderer-known decoded image estimate. */
  byteSize: number
  release: () => void
}

type CacheRecord = {
  state: ProjectCustomBlockLoadState
  version: number
  lastUsed: number
  pinned: boolean
  promise?: Promise<ProjectCustomBlockCatalogEntry>
  value?: ProjectCustomBlockCacheValue
  error?: unknown
}

export function estimateProjectCustomBlockUnpackedBytes(entry: ProjectCustomBlockCatalogEntry): number {
  let total = 0
  for (const bytes of entry.files.values()) {
    total += bytes.byteLength
  }
  return total
}

/** Package-granular shared-promise LRU. UI state stays outside this cache. */
export class ProjectCustomBlockResourceCache {
  private readonly records = new Map<string, CacheRecord>()
  private clock = 0
  private totalBytes = 0

  constructor(
    private readonly budgetBytes = PROJECT_CUSTOM_BLOCK_RESOURCE_BUDGET_BYTES,
    private readonly onEvict: (key: string) => void = () => undefined,
  ) {}

  state(key: string): ProjectCustomBlockLoadState {
    return this.records.get(key.toLowerCase())?.state ?? 'unloaded'
  }

  error(key: string): unknown {
    return this.records.get(key.toLowerCase())?.error
  }

  get sizeBytes(): number {
    return this.totalBytes
  }

  async load(
    key: string,
    loader: () => Promise<ProjectCustomBlockCacheValue>,
  ): Promise<ProjectCustomBlockCatalogEntry> {
    const identity = key.toLowerCase()
    const current = this.records.get(identity)
    if (current?.state === 'ready' && current.value) {
      current.lastUsed = ++this.clock
      return current.value.entry
    }
    if (current?.state === 'loading' && current.promise) return await current.promise

    const version = (current?.version ?? 0) + 1
    const record: CacheRecord = {
      state: 'loading',
      version,
      lastUsed: ++this.clock,
      pinned: current?.pinned ?? false,
    }
    const promise = loader().then((value) => {
      const latest = this.records.get(identity)
      if (latest !== record || latest.version !== version) {
        value.release()
        throw new Error(`Stale custom block load: ${key}`)
      }
      record.state = 'ready'
      record.value = value
      record.promise = undefined
      record.error = undefined
      record.lastUsed = ++this.clock
      this.totalBytes += Math.max(0, value.byteSize)
      this.evictToBudget()
      return value.entry
    }, (error) => {
      if (this.records.get(identity) === record) {
        record.state = 'error'
        record.promise = undefined
        record.error = error
      }
      throw error
    })
    record.promise = promise
    this.records.set(identity, record)
    return await promise
  }

  setPinnedKeys(keys: Iterable<string>): void {
    const pinned = new Set([...keys].map(key => key.toLowerCase()))
    for (const [key, record] of this.records) record.pinned = pinned.has(key)
    this.evictToBudget()
  }

  invalidate(key: string): void {
    const identity = key.toLowerCase()
    const record = this.records.get(identity)
    if (!record) return
    record.version += 1
    this.disposeValue(identity, record)
    this.records.delete(identity)
  }

  clear(): void {
    for (const [key, record] of this.records) this.disposeValue(key, record)
    this.records.clear()
    this.totalBytes = 0
  }

  private evictToBudget(): void {
    if (this.totalBytes <= this.budgetBytes) return
    const candidates = [...this.records.entries()]
      .filter(([, record]) => record.state === 'ready' && !record.pinned && record.value)
      .sort(([, left], [, right]) => left.lastUsed - right.lastUsed)
    for (const [key, record] of candidates) {
      if (this.totalBytes <= this.budgetBytes) break
      this.disposeValue(key, record)
      this.records.delete(key)
    }
  }

  private disposeValue(key: string, record: CacheRecord): void {
    if (!record.value) return
    this.totalBytes = Math.max(0, this.totalBytes - Math.max(0, record.value.byteSize))
    record.value.release()
    record.value = undefined
    this.onEvict(key)
  }
}
