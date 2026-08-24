import { strFromU8, unzipSync } from 'fflate'
import {
  RESOURCE_PACKAGE_MANIFEST_FILE_NAME,
  normalizeResourcePackageManifest,
  type ResourcePackageManifest,
} from '../model/resourcePackage'
import { createResourcePackageContentHash, type ResourcePackageContentFile } from './resourcePackageHash'
import type { FileSystemService } from './fileSystemService'

export const DEFAULT_RESOURCE_PACKAGE_MAX_ARCHIVE_BYTES = 64 * 1024 * 1024
export const DEFAULT_RESOURCE_PACKAGE_MAX_UNPACKED_BYTES = 256 * 1024 * 1024
export const DEFAULT_RESOURCE_PACKAGE_MAX_ENTRIES = 10_000

export type ResourcePackageInstallerLimits = {
  maxArchiveBytes?: number
  maxUnpackedBytes?: number
  maxEntries?: number
}

export type ResourcePackageInspection = {
  manifest: ResourcePackageManifest
  files: readonly ResourcePackageContentFile[]
  archiveBytes: Uint8Array
  existingManifest: ResourcePackageManifest | null
  targetPath: string
}

export type ResourcePackageInstallResult = {
  manifest: ResourcePackageManifest
  targetPath: string
  replaced: boolean
}

export type ResourcePackageRemovalImpact = {
  manifest: ResourcePackageManifest
  dependents: readonly ResourcePackageManifest[]
}

export type ResourcePackageInstallFileSystem = Pick<FileSystemService,
  'readBinaryFile' | 'readFile' | 'writeFile' | 'writeBinaryFile' | 'fileExists'
  | 'createDirectory' | 'renameFile' | 'deleteFile'
>

function normalizeArchivePath(value: string): string | null {
  const path = value.trim().replace(/\\/g, '/')
  if (!path || path.startsWith('/') || path.startsWith('//') || /^[a-z]:/i.test(path)) return null
  const segments = path.split('/')
  if (segments.some(segment => !segment || segment === '.' || segment === '..'
    || /[\u0000-\u001f\u007f]/.test(segment))) return null
  return segments.join('/')
}

function dirname(path: string): string {
  const normalized = path.replace(/[\\/]+$/, '')
  const separator = normalized.lastIndexOf('/')
  return separator >= 0 ? normalized.slice(0, separator) : '.'
}

function packageTarget(projectRootPath: string, key: string): string {
  return `${projectRootPath.replace(/[\\/]+$/, '')}/.opencard/packages/${key}`
}

function parseJson(bytes: Uint8Array, path: string): unknown {
  try {
    return JSON.parse(strFromU8(bytes))
  } catch {
    throw new Error(`Invalid JSON in resource package: ${path}`)
  }
}

function validatePackageProjection(files: readonly ResourcePackageContentFile[]): void {
  for (const file of files) {
    const lower = file.path.toLocaleLowerCase()
    if (lower.endsWith('.json') || lower.endsWith('.ocblock')) parseJson(file.bytes, file.path)
  }
}

function normalizeArchiveEntries(
  bytes: Uint8Array,
  limits: Required<ResourcePackageInstallerLimits>,
): ResourcePackageContentFile[] & { manifestBytes?: Uint8Array } {
  if (bytes.byteLength > limits.maxArchiveBytes) throw new Error('Resource package archive is too large')
  let unpacked: Record<string, Uint8Array>
  try {
    unpacked = unzipSync(bytes)
  } catch {
    throw new Error('Resource package archive is corrupt')
  }
  const normalized = new Map<string, ResourcePackageContentFile>()
  let unpackedBytes = 0
  let manifestBytes: Uint8Array | undefined
  for (const [rawPath, content] of Object.entries(unpacked)) {
    if (normalized.size >= limits.maxEntries) throw new Error('Resource package has too many entries')
    const path = normalizeArchivePath(rawPath)
    if (!path) throw new Error(`Unsafe resource package archive path: ${rawPath}`)
    const identity = path.toLocaleLowerCase()
    if (normalized.has(identity)) throw new Error(`Duplicate resource package archive path: ${path}`)
    unpackedBytes += content.byteLength
    if (unpackedBytes > limits.maxUnpackedBytes) throw new Error('Unpacked resource package is too large')
    if (identity === RESOURCE_PACKAGE_MANIFEST_FILE_NAME.toLocaleLowerCase()) {
      if (manifestBytes) throw new Error(`Duplicate resource package archive path: ${path}`)
      manifestBytes = content
      continue
    }
    normalized.set(identity, { path, bytes: new Uint8Array(content) })
  }
  if (!manifestBytes) throw new Error('Resource package manifest is missing')
  const result = [...normalized.values()].sort((left, right) => left.path.localeCompare(right.path)) as ResourcePackageContentFile[] & { manifestBytes?: Uint8Array }
  result.manifestBytes = manifestBytes
  return result
}

function parseManifest(bytes: Uint8Array): ResourcePackageManifest {
  const normalized = normalizeResourcePackageManifest(parseJson(bytes, RESOURCE_PACKAGE_MANIFEST_FILE_NAME))
  if (normalized.issues.length > 0) {
    throw new Error(`Invalid resource package manifest: ${normalized.issues.map(issue => `${issue.path}: ${issue.message}`).join('; ')}`)
  }
  return normalized.manifest
}

export async function inspectResourcePackage(options: {
  fs?: Pick<FileSystemService, 'readBinaryFile' | 'readFile' | 'fileExists'>
  projectRootPath: string
  bytes?: Uint8Array
  sourcePath?: string
  limits?: ResourcePackageInstallerLimits
}): Promise<ResourcePackageInspection> {
  const limits: Required<ResourcePackageInstallerLimits> = {
    maxArchiveBytes: options.limits?.maxArchiveBytes ?? DEFAULT_RESOURCE_PACKAGE_MAX_ARCHIVE_BYTES,
    maxUnpackedBytes: options.limits?.maxUnpackedBytes ?? DEFAULT_RESOURCE_PACKAGE_MAX_UNPACKED_BYTES,
    maxEntries: options.limits?.maxEntries ?? DEFAULT_RESOURCE_PACKAGE_MAX_ENTRIES,
  }
  const archiveBytes = options.bytes ?? (options.sourcePath && options.fs
    ? await options.fs.readBinaryFile(options.sourcePath)
    : null)
  if (!archiveBytes) throw new Error('Resource package archive bytes are required')
  const entries = normalizeArchiveEntries(archiveBytes, limits)
  const manifestBytes = entries.manifestBytes!
  delete entries.manifestBytes
  const manifest = parseManifest(manifestBytes)
  validatePackageProjection(entries)
  const contentHash = await createResourcePackageContentHash(entries)
  if (contentHash !== manifest.contentHash) throw new Error('Resource package content hash does not match its manifest')
  const targetPath = packageTarget(options.projectRootPath, manifest.key)
  let existingManifest: ResourcePackageManifest | null = null
  if (options.fs && await options.fs.fileExists(`${targetPath}/${RESOURCE_PACKAGE_MANIFEST_FILE_NAME}`)) {
    existingManifest = parseManifest(new TextEncoder().encode(
      await options.fs.readFile(`${targetPath}/${RESOURCE_PACKAGE_MANIFEST_FILE_NAME}`),
    ))
  }
  return { manifest, files: entries, archiveBytes: new Uint8Array(archiveBytes), existingManifest, targetPath }
}

async function writeProjection(
  fs: ResourcePackageInstallFileSystem,
  targetPath: string,
  inspection: ResourcePackageInspection,
): Promise<void> {
  await fs.createDirectory(targetPath)
  await fs.createDirectory(`${targetPath}/.opencard`)
  await fs.writeFile(`${targetPath}/${RESOURCE_PACKAGE_MANIFEST_FILE_NAME}`, JSON.stringify(inspection.manifest, null, 2) + '\n')
  for (const file of inspection.files) {
    const target = `${targetPath}/${file.path}`
    await fs.createDirectory(dirname(target))
    await fs.writeBinaryFile(target, file.bytes)
  }
}

export async function commitResourcePackageInstallation(options: {
  fs: ResourcePackageInstallFileSystem
  inspection: ResourcePackageInspection
  confirmReplacement?: (next: ResourcePackageManifest, previous: ResourcePackageManifest | null) => boolean | Promise<boolean>
  createId?: () => string
}): Promise<ResourcePackageInstallResult> {
  const { fs, inspection } = options
  const confirmed = options.confirmReplacement
    ? await options.confirmReplacement(inspection.manifest, inspection.existingManifest)
    : true
  if (!confirmed) throw new Error('Resource package installation was cancelled')
  const transactionId = (options.createId ?? (() => crypto.randomUUID()))().replace(/[^a-z0-9_-]/gi, '')
  if (!transactionId) throw new Error('Invalid resource package installation transaction ID')
  const temporaryPath = `${inspection.targetPath}.install-${transactionId}`
  const backupPath = `${inspection.targetPath}.backup-${transactionId}`
  if (await fs.fileExists(temporaryPath) || await fs.fileExists(backupPath)) {
    throw new Error('Resource package installation transaction path already exists')
  }
  await fs.createDirectory(dirname(inspection.targetPath))
  let movedExisting = false
  try {
    await writeProjection(fs, temporaryPath, inspection)
    if (await fs.fileExists(inspection.targetPath)) {
      await fs.renameFile(inspection.targetPath, backupPath)
      movedExisting = true
    }
    try {
      await fs.renameFile(temporaryPath, inspection.targetPath)
    } catch (cause) {
      if (movedExisting && await fs.fileExists(backupPath)) await fs.renameFile(backupPath, inspection.targetPath)
      throw cause
    }
    if (movedExisting && await fs.fileExists(backupPath)) await fs.deleteFile(backupPath).catch(() => undefined)
    return { manifest: inspection.manifest, targetPath: inspection.targetPath, replaced: movedExisting }
  } catch (cause) {
    if (await fs.fileExists(temporaryPath)) await fs.deleteFile(temporaryPath).catch(() => undefined)
    if (movedExisting && await fs.fileExists(backupPath) && !await fs.fileExists(inspection.targetPath)) {
      await fs.renameFile(backupPath, inspection.targetPath).catch(() => undefined)
    }
    throw cause
  }
}

export async function installResourcePackage(options: {
  fs: ResourcePackageInstallFileSystem
  projectRootPath: string
  bytes?: Uint8Array
  sourcePath?: string
  limits?: ResourcePackageInstallerLimits
  confirmReplacement?: (next: ResourcePackageManifest, previous: ResourcePackageManifest | null) => boolean | Promise<boolean>
  createId?: () => string
}): Promise<ResourcePackageInstallResult> {
  const inspection = await inspectResourcePackage(options)
  return await commitResourcePackageInstallation({ ...options, inspection })
}

export async function uninstallResourcePackage(options: {
  fs: Pick<FileSystemService, 'fileExists' | 'deleteFile'>
  projectRootPath: string
  packageKey: string
  dependents?: readonly ResourcePackageManifest[]
  confirmRemoval?: (impact: ResourcePackageRemovalImpact) => boolean | Promise<boolean>
  manifest?: ResourcePackageManifest | null
}): Promise<boolean> {
  const key = options.packageKey.trim().toLocaleLowerCase()
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(key)) throw new Error('Invalid resource package Key')
  const targetPath = packageTarget(options.projectRootPath, key)
  if (!await options.fs.fileExists(targetPath)) return false
  const manifest = options.manifest ?? null
  const dependents = (options.dependents ?? []).filter(candidate => (
    candidate.dependencies.some(dependency => dependency.key.toLocaleLowerCase() === key)
  ))
  if (dependents.length > 0) {
    if (!manifest) throw new Error('Resource package removal impact is unavailable')
    const impact = { manifest, dependents } satisfies ResourcePackageRemovalImpact
    if (!options.confirmRemoval || !await options.confirmRemoval(impact)) {
      throw new Error('Resource package removal was cancelled')
    }
  }
  await options.fs.deleteFile(targetPath)
  return true
}
