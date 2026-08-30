import { describe, expect, it, vi } from 'vitest'
import type { FileSystemService } from '../../workspace/services/fileSystemService'
import { NetworkResourceCacheService } from './networkResourceCacheService'

function createFakeFileSystem(initial: Record<string, string> = {}) {
  const files = new Map<string, string | Uint8Array>(Object.entries(initial))
  const operations: string[] = []
  const failRenameTo = new Set<string>()
  const fs = {
    fileExists: vi.fn(async (path: string) => files.has(path)),
    readFile: vi.fn(async (path: string) => {
      const value = files.get(path)
      if (typeof value !== 'string') throw new Error(`Missing text file: ${path}`)
      return value
    }),
    writeFile: vi.fn(async (path: string, value: string) => {
      operations.push(`write:${path}`)
      files.set(path, value)
    }),
    writeBinaryFile: vi.fn(async (path: string, value: Uint8Array) => {
      operations.push(`write-binary:${path}`)
      files.set(path, value)
    }),
    copyFile: vi.fn(async (from: string, to: string) => {
      operations.push(`copy:${from}->${to}`)
      const value = files.get(from)
      if (value === undefined) throw new Error(`Missing source: ${from}`)
      files.set(to, value)
    }),
    renameFile: vi.fn(async (from: string, to: string) => {
      operations.push(`rename:${from}->${to}`)
      if (failRenameTo.has(to)) throw new Error(`Could not rename to: ${to}`)
      const value = files.get(from)
      if (value === undefined) throw new Error(`Missing source: ${from}`)
      files.set(to, value)
      files.delete(from)
    }),
    deleteFile: vi.fn(async (path: string) => {
      operations.push(`delete:${path}`)
      files.delete(path)
    }),
    createDirectory: vi.fn(async () => undefined),
  } as unknown as FileSystemService
  return { fs, files, operations, failRenameTo }
}

function uuidFactory() {
  let index = 0
  return () => `00000000-0000-4000-8000-${String(++index).padStart(12, '0')}`
}

describe('NetworkResourceCacheService', () => {
  it('keeps a stable UID and extension while atomically replacing refreshed bytes before the manifest', async () => {
    const fake = createFakeFileSystem()
    const timestamps = [new Date('2026-08-29T12:00:00.000Z'), new Date('2026-08-30T12:00:00.000Z')]
    const service = new NetworkResourceCacheService({
      fs: fake.fs,
      appStoragePath: async (...segments) => `/home/user/.opencard/${segments.join('/')}`,
      joinPath: async (...segments) => segments.join('/').replace(/\/+/g, '/'),
      randomUuid: uuidFactory(),
      now: () => timestamps.shift() ?? new Date('2026-08-30T12:00:00.000Z'),
      download: async (url, destination, onProgress) => {
        await fake.fs.writeBinaryFile(destination, new Uint8Array([1, 2, 3]))
        onProgress({ url, receivedBytes: 3, totalBytes: 3, progress: 1 })
        return { contentType: 'image/jpeg', receivedBytes: 3 }
      },
    })
    const project = await service.forProject('D:\\Projects\\OpenCard')
    fake.operations.length = 0

    const first = await project.refresh('https://example.com/image.PNG#preview')
    const firstTransaction = [...fake.operations]
    fake.operations.length = 0
    const second = await project.refresh('https://example.com/image.PNG')

    expect(first.path).toBe(second.path)
    expect(first.path).toMatch(/\.png$/)
    expect(first.refreshedAt).toBe('2026-08-29T12:00:00.000Z')
    expect(second.refreshedAt).toBe('2026-08-30T12:00:00.000Z')
    expect(await project.listUrls()).toEqual(['https://example.com/image.PNG'])
    const replaceIndex = firstTransaction.findIndex(operation => operation.includes('.download->') && operation.endsWith('.png'))
    const manifestWriteIndex = firstTransaction.findIndex(operation => operation.includes('/cache.json.') && operation.startsWith('write:'))
    expect(replaceIndex).toBeGreaterThanOrEqual(0)
    expect(manifestWriteIndex).toBeGreaterThan(replaceIndex)
  })

  it('treats damaged cache manifests as empty disposable indexes', async () => {
    const fake = createFakeFileSystem({ '/home/user/.opencard/cache/cache.json': '{broken' })
    const service = new NetworkResourceCacheService({
      fs: fake.fs,
      appStoragePath: async (...segments) => `/home/user/.opencard/${segments.join('/')}`,
      joinPath: async (...segments) => segments.join('/').replace(/\/+/g, '/'),
      randomUuid: uuidFactory(),
    })

    await expect(service.forProject('/home/user/project')).resolves.toBeDefined()
    expect(JSON.parse(fake.files.get('/home/user/.opencard/cache/cache.json') as string).projects)
      .toHaveProperty('/home/user/project')
  })

  it('restores the previous file when a refreshed manifest cannot commit', async () => {
    const fake = createFakeFileSystem()
    let bytes = new Uint8Array([1])
    const service = new NetworkResourceCacheService({
      fs: fake.fs,
      appStoragePath: async (...segments) => `/home/user/.opencard/${segments.join('/')}`,
      joinPath: async (...segments) => segments.join('/').replace(/\/+/g, '/'),
      randomUuid: uuidFactory(),
      now: () => new Date('2026-08-29T12:00:00.000Z'),
      download: async (_url, destination) => {
        await fake.fs.writeBinaryFile(destination, bytes)
        return { contentType: 'image/png', receivedBytes: bytes.length }
      },
    })
    const project = await service.forProject('/home/user/project')
    const cached = await project.refresh('https://example.com/image.png')
    expect(fake.files.get(cached.path)).toEqual(new Uint8Array([1]))

    bytes = new Uint8Array([2])
    fake.failRenameTo.add('/home/user/.opencard/cache/00000000-0000-4000-8000-000000000001/cache.json')
    await expect(project.refresh('https://example.com/image.png')).rejects.toThrow('Could not rename')
    expect(fake.files.get(cached.path)).toEqual(new Uint8Array([1]))
  })
})
