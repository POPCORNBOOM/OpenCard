import {
  discoverProjectCustomBlockDefinitions,
  parseProjectCustomBlockDefinitionText,
  readProjectCustomBlockDefinition,
  serializeProjectCustomBlockDefinition,
} from './projectCustomBlockDefinition'
import { strFromU8, strToU8, unzip, zip, zipSync, type UnzipFileInfo } from 'fflate'
import type { FileSystemService } from './fileSystemService'
import { parseStoredCardBlock } from '../../../entities/card/storage'
import type { CardBlock } from '../../../entities/card/model'
import { visitCardBlockTree } from '../../../entities/card/tree'
import { toKeySlug } from '../../../shared/model/keySlug'
import {
  normalizeProjectCustomBlockManifest,
  normalizeProjectCustomBlockPackageId,
  projectCustomBlockInstallationRelativePath,
  PROJECT_CUSTOM_BLOCK_BLOCK_FILE_NAME,
  PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME,
  PROJECT_CUSTOM_BLOCK_RESOURCES_DIRECTORY_NAME,
  serializeProjectCustomBlockManifest,
  splitProjectCustomBlockPackageId,
  type ProjectCustomBlockManifest,
  type ProjectCustomBlockManifestCatalogEntry,
  type ProjectCustomBlockPackageIssue,
} from '../model/projectCustomBlocks'

export const MAX_CUSTOM_BLOCK_ARCHIVE_BYTES = 128 * 1024 * 1024
export const MAX_CUSTOM_BLOCK_UNPACKED_BYTES = 512 * 1024 * 1024
export const MAX_CUSTOM_BLOCK_ENTRIES = 2_048
export const MAX_CUSTOM_BLOCK_ENTRY_BYTES = 256 * 1024 * 1024
export const MAX_CUSTOM_BLOCK_DEPENDENCY_DEPTH = 12
export const MAX_CUSTOM_BLOCK_DEPENDENCIES = 256

const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50
const ZIP_CENTRAL_DIRECTORY_ENTRY = 0x02014b50
const ZIP_UNIX_FILE_TYPE_MASK = 0xf000
const ZIP_UNIX_SYMLINK_TYPE = 0xa000

export type ProjectCustomBlockPackage = {
  manifest: ProjectCustomBlockManifest
  block: CardBlock | null
  /** Transport-only resource payload. Installed runtime code reads the expanded directory instead. */
  files: ReadonlyMap<string, Uint8Array>
  /** Resource candidates explicitly retained by the block author in a standalone .ocblock. */
  declaredResourceDependencies?: readonly string[]
  issues: readonly ProjectCustomBlockPackageIssue[]
  hasResourceErrors: boolean
}

export type ProjectCustomBlockManifestReadResult = {
  manifest: ProjectCustomBlockManifest
  issues: readonly ProjectCustomBlockPackageIssue[]
}

export type ProjectCustomBlockInstallResult = {
  manifest: ProjectCustomBlockManifest
  installationPath: string
  resourceRootPath: string
  replaced: boolean
  issues: readonly ProjectCustomBlockPackageIssue[]
}

type ArchiveEntry = { path: string, isDirectory: boolean, bytes: Uint8Array }

function addIssue(
  issues: ProjectCustomBlockPackageIssue[],
  code: ProjectCustomBlockPackageIssue['code'],
  path: string,
  message: string,
): void {
  issues.push({ code, path, message })
}

function normalizeArchiveEntryPath(value: string): { path: string, isDirectory: boolean } | null {
  const slashNormalized = value.replace(/\\/g, '/').replace(/\/+/g, '/')
  const isDirectory = slashNormalized.endsWith('/')
  const path = slashNormalized.replace(/\/$/, '')
  if (!path || path.startsWith('/') || /^[a-z]:/i.test(path)
    || path.split('/').some(segment => !segment || segment === '.' || segment === '..')) return null
  return { path, isDirectory }
}

function isAllowedArchivePath(path: string, isDirectory: boolean): boolean {
  const identity = path.toLocaleLowerCase()
  if (identity === PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME
    || identity === PROJECT_CUSTOM_BLOCK_BLOCK_FILE_NAME) return !isDirectory
  const resources = PROJECT_CUSTOM_BLOCK_RESOURCES_DIRECTORY_NAME.toLocaleLowerCase()
  return identity === resources || identity.startsWith(`${resources}/`)
}

function preflightZipArchive(bytes: Uint8Array): void {
  if (bytes.byteLength > MAX_CUSTOM_BLOCK_ARCHIVE_BYTES) throw new Error('Custom block archive is too large')
  if (bytes.byteLength < 22) throw new Error('Custom block archive is invalid')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const searchStart = Math.max(0, bytes.byteLength - 0xffff - 22)
  let endOffset = -1
  for (let offset = bytes.byteLength - 22; offset >= searchStart; offset -= 1) {
    if (view.getUint32(offset, true) === ZIP_END_OF_CENTRAL_DIRECTORY) {
      endOffset = offset
      break
    }
  }
  if (endOffset < 0) throw new Error('Custom block archive is invalid')

  const entryCount = view.getUint16(endOffset + 10, true)
  const directorySize = view.getUint32(endOffset + 12, true)
  const directoryOffset = view.getUint32(endOffset + 16, true)
  if (entryCount === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff
    || entryCount > MAX_CUSTOM_BLOCK_ENTRIES || directoryOffset + directorySize > endOffset) {
    throw new Error('Custom block archive exceeds limits')
  }

  let cursor = directoryOffset
  let unpackedBytes = 0
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > directoryOffset + directorySize
      || view.getUint32(cursor, true) !== ZIP_CENTRAL_DIRECTORY_ENTRY) {
      throw new Error('Custom block archive is invalid')
    }
    const versionMadeBy = view.getUint16(cursor + 4, true)
    const uncompressedSize = view.getUint32(cursor + 24, true)
    const nameLength = view.getUint16(cursor + 28, true)
    const extraLength = view.getUint16(cursor + 30, true)
    const commentLength = view.getUint16(cursor + 32, true)
    const externalAttributes = view.getUint32(cursor + 38, true)
    const unixMode = externalAttributes >>> 16
    if ((versionMadeBy >>> 8) === 3
      && (unixMode & ZIP_UNIX_FILE_TYPE_MASK) === ZIP_UNIX_SYMLINK_TYPE) {
      throw new Error('Custom block archive contains a symbolic link')
    }
    if (uncompressedSize > MAX_CUSTOM_BLOCK_ENTRY_BYTES) {
      throw new Error('Custom block archive exceeds limits')
    }
    unpackedBytes += uncompressedSize
    if (unpackedBytes > MAX_CUSTOM_BLOCK_UNPACKED_BYTES) {
      throw new Error('Custom block archive exceeds limits')
    }
    cursor += 46 + nameLength + extraLength + commentLength
  }
  if (cursor !== directoryOffset + directorySize) throw new Error('Custom block archive is invalid')
}

async function unzipArchive(bytes: Uint8Array): Promise<ArchiveEntry[]> {
  preflightZipArchive(bytes)
  return await new Promise((resolve, reject) => {
    const paths = new Set<string>()
    const directories: ArchiveEntry[] = []
    try {
      unzip(bytes, {
        filter: (file: UnzipFileInfo) => {
          const normalized = normalizeArchiveEntryPath(file.name)
          if (!normalized || !isAllowedArchivePath(normalized.path, normalized.isDirectory)) {
            throw new Error('Invalid custom block archive path')
          }
          const identity = normalized.path.toLocaleLowerCase()
          if (paths.has(identity)) throw new Error('Duplicate custom block archive path')
          paths.add(identity)
          if (normalized.isDirectory) directories.push({ ...normalized, bytes: new Uint8Array() })
          return !normalized.isDirectory
        },
      }, (error, data) => {
        if (error) {
          reject(error)
          return
        }
        try {
          resolve([
            ...directories,
            ...Object.entries(data).map(([rawPath, content]) => {
              const normalized = normalizeArchiveEntryPath(rawPath)
              if (!normalized || normalized.isDirectory) throw new Error('Invalid custom block archive path')
              return { ...normalized, bytes: content }
            }),
          ])
        } catch (cause) {
          reject(cause)
        }
      })
    } catch (cause) {
      reject(cause)
    }
  })
}

function findArchiveEntry(entries: readonly ArchiveEntry[], path: string): ArchiveEntry | undefined {
  const identity = path.toLocaleLowerCase()
  return entries.find(entry => entry.path.toLocaleLowerCase() === identity)
}

function fallbackPackageIdFromPath(sourcePath?: string): string {
  const normalized = sourcePath?.replace(/\\/g, '/').replace(/\/$/, '') ?? ''
  const segments = normalized.split('/').filter(Boolean)
  const manifestIndex = segments[segments.length - 1]?.toLocaleLowerCase() === PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME
    ? segments.length - 1
    : segments.length
  if (manifestIndex >= 2) {
    const installed = normalizeProjectCustomBlockPackageId(
      `${segments[manifestIndex - 2]}/${segments[manifestIndex - 1]}`,
    )
    if (installed && !segments[manifestIndex - 1]!.toLocaleLowerCase().endsWith('.ocblock')) return installed
  }
  const fileName = segments[segments.length - 1]?.replace(/\.ocblock$/i, '') ?? ''
  return `local/${toKeySlug(fileName, 'custom-block')}`
}

function parseManifestText(
  content: string | undefined,
  fallbackPackageId: string,
): ProjectCustomBlockManifestReadResult {
  if (content === undefined) {
    const result = normalizeProjectCustomBlockManifest({}, fallbackPackageId)
    return {
      ...result,
      issues: [{
        code: 'manifest-field-ignored',
        path: PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME,
        message: 'Missing manifest used current defaults',
      }, ...result.issues],
    }
  }
  try {
    return normalizeProjectCustomBlockManifest(JSON.parse(content), fallbackPackageId)
  } catch {
    throw new Error('Custom block manifest JSON is unreadable')
  }
}

function normalizeRoot(
  root: unknown,
  manifest: ProjectCustomBlockManifest,
  issues: ProjectCustomBlockPackageIssue[],
): { block: CardBlock | null, manifest: ProjectCustomBlockManifest } {
  const block = parseStoredCardBlock(root)
  if (!block || block.type === 'custom-block') {
    addIssue(issues, 'block-unavailable', PROJECT_CUSTOM_BLOCK_BLOCK_FILE_NAME, 'Root Block is unavailable')
    return { block: null, manifest }
  }

  const ids = new Set<string>()
  let generatedId = 0
  visitCardBlockTree(block, (candidate, _depth, location) => {
    if (!candidate.id.trim() || ids.has(candidate.id)) {
      candidate.id = `package-block-${++generatedId}`
      addIssue(issues, 'block-entry-ignored', PROJECT_CUSTOM_BLOCK_BLOCK_FILE_NAME, 'Missing or duplicate Block ID used a generated ID')
    }
    ids.add(candidate.id)
    if (location && (!location.id.trim() || ids.has(location.id))) {
      location.id = `package-location-${++generatedId}`
      addIssue(issues, 'block-entry-ignored', PROJECT_CUSTOM_BLOCK_BLOCK_FILE_NAME, 'Missing or duplicate Location ID used a generated ID')
    }
    if (location) ids.add(location.id)
    if ((candidate.type === 'simple-container-block' || candidate.type === 'flow-container-block')
      && Object.prototype.hasOwnProperty.call(candidate, 'packaged')) delete candidate.packaged
  })

  const publicFields = new Set([
    'name',
    'notes',
    ...Object.keys(block),
    ...Object.keys(block.additionalFieldDefinition ?? {}),
  ].map(key => key.toLocaleLowerCase()))
  const publicFieldKeys = manifest.publicFieldKeys.filter(fieldKey => {
    const found = publicFields.has(fieldKey.toLocaleLowerCase())
    if (!found) {
      addIssue(issues, 'manifest-field-ignored', `publicFieldKeys.${fieldKey}`, 'Public field unavailable on the root was ignored')
    }
    return found
  })
  return { block, manifest: { ...manifest, publicFieldKeys } }
}

function parseBlockText(
  content: string | undefined,
  manifest: ProjectCustomBlockManifest,
  issues: ProjectCustomBlockPackageIssue[],
): { block: CardBlock | null, manifest: ProjectCustomBlockManifest } {
  if (content === undefined) {
    addIssue(issues, 'block-unavailable', PROJECT_CUSTOM_BLOCK_BLOCK_FILE_NAME, 'Root Block file is missing')
    return { block: null, manifest }
  }
  try {
    return normalizeRoot(JSON.parse(content), manifest, issues)
  } catch {
    addIssue(issues, 'block-unavailable', PROJECT_CUSTOM_BLOCK_BLOCK_FILE_NAME, 'Root Block JSON is unreadable')
    return { block: null, manifest }
  }
}

function collectResourceFiles(entries: readonly ArchiveEntry[]): Map<string, Uint8Array> {
  const prefix = `${PROJECT_CUSTOM_BLOCK_RESOURCES_DIRECTORY_NAME.toLocaleLowerCase()}/`
  return new Map(entries.flatMap(entry => (
    entry.path.toLocaleLowerCase().startsWith(prefix) ? [[entry.path, entry.bytes] as const] : []
  )))
}

export async function readProjectCustomBlockManifestFromBytes(
  bytes: Uint8Array,
  sourcePath?: string,
): Promise<ProjectCustomBlockManifestReadResult> {
  const entries = await unzipArchive(bytes)
  const manifestBytes = findArchiveEntry(entries, PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME)?.bytes
  return parseManifestText(
    manifestBytes ? strFromU8(manifestBytes) : undefined,
    fallbackPackageIdFromPath(sourcePath),
  )
}

export async function readProjectCustomBlockPackageFromBytes(
  bytes: Uint8Array,
  sourcePath?: string,
): Promise<ProjectCustomBlockPackage> {
  const entries = await unzipArchive(bytes)
  const manifestEntry = findArchiveEntry(entries, PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME)
  const manifestResult = parseManifestText(
    manifestEntry ? strFromU8(manifestEntry.bytes) : undefined,
    fallbackPackageIdFromPath(sourcePath),
  )
  const issues = [...manifestResult.issues]
  if (!manifestEntry) {
    addIssue(issues, 'package-structure-ignored', PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME, 'Package manifest is missing')
  }
  const hasResources = entries.some(entry => {
    const path = entry.path.toLocaleLowerCase()
    return path === PROJECT_CUSTOM_BLOCK_RESOURCES_DIRECTORY_NAME
      || path.startsWith(`${PROJECT_CUSTOM_BLOCK_RESOURCES_DIRECTORY_NAME}/`)
  })
  if (!hasResources) {
    addIssue(issues, 'package-structure-ignored', PROJECT_CUSTOM_BLOCK_RESOURCES_DIRECTORY_NAME, 'Package resources directory is missing')
  }
  const blockEntry = findArchiveEntry(entries, PROJECT_CUSTOM_BLOCK_BLOCK_FILE_NAME)
  const normalized = parseBlockText(
    blockEntry ? strFromU8(blockEntry.bytes) : undefined,
    manifestResult.manifest,
    issues,
  )
  return {
    manifest: normalized.manifest,
    block: normalized.block,
    files: collectResourceFiles(entries),
    issues,
    hasResourceErrors: issues.some(issue => issue.code === 'resource-unavailable'),
  }
}

function createProjectCustomBlockArchiveEntries(
  manifest: ProjectCustomBlockManifest,
  block: CardBlock,
  files: ReadonlyMap<string, Uint8Array>,
): Record<string, Uint8Array> {
  const issues: ProjectCustomBlockPackageIssue[] = []
  const normalizedManifest = normalizeProjectCustomBlockManifest(manifest, manifest.packageId).manifest
  const normalizedRoot = normalizeRoot(block, normalizedManifest, issues)
  if (!normalizedRoot.block) throw new Error('Custom block root Block is unavailable')

  const archive: Record<string, Uint8Array> = {
    [PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME]: strToU8(serializeProjectCustomBlockManifest(normalizedRoot.manifest)),
    [PROJECT_CUSTOM_BLOCK_BLOCK_FILE_NAME]: strToU8(JSON.stringify(normalizedRoot.block, null, 2)),
    [`${PROJECT_CUSTOM_BLOCK_RESOURCES_DIRECTORY_NAME}/`]: new Uint8Array(),
  }
  const identities = new Set(Object.keys(archive).map(path => path.replace(/\/$/, '').toLocaleLowerCase()))
  for (const [rawPath, bytes] of files) {
    const normalized = normalizeArchiveEntryPath(rawPath)
    const identity = normalized?.path.toLocaleLowerCase()
    if (!normalized || normalized.isDirectory || !isAllowedArchivePath(normalized.path, false)
      || identities.has(identity!)) throw new Error('Invalid custom block archive path')
    identities.add(identity!)
    archive[normalized.path] = bytes
  }
  return archive
}

export function createProjectCustomBlockArchive(
  manifest: ProjectCustomBlockManifest,
  block: CardBlock,
  files: ReadonlyMap<string, Uint8Array> = new Map(),
): Uint8Array {
  return zipSync(createProjectCustomBlockArchiveEntries(manifest, block, files), { level: 9 })
}

export async function createProjectCustomBlockArchiveAsync(
  manifest: ProjectCustomBlockManifest,
  block: CardBlock,
  files: ReadonlyMap<string, Uint8Array> = new Map(),
): Promise<Uint8Array> {
  const entries = createProjectCustomBlockArchiveEntries(manifest, block, files)
  return await new Promise<Uint8Array>((resolve, reject) => {
    zip(entries, { level: 9 }, (error, data) => {
      if (error) reject(error)
      else resolve(data)
    })
  })
}

export async function readProjectCustomBlockPackage(
  fs: Pick<FileSystemService, 'readBinaryFile'>,
  sourcePath: string,
 ): Promise<ProjectCustomBlockPackage> {
  const bytes = await fs.readBinaryFile(sourcePath)
  if (sourcePath.toLocaleLowerCase().endsWith('.ocblock')) {
    const content = strFromU8(bytes)
    const fileName = sourcePath.replace(/\\/g, '/').split('/').pop() ?? 'custom-block'
    const fallbackKey = fileName.replace(/\.ocblock$/i, '')
    const parsed = parseProjectCustomBlockDefinitionText(content, fallbackKey)
    const definition = parsed.definition
    return {
      manifest: {
        type: 'opencard-custom-block',
        packageId: `block:${definition?.key ?? fallbackKey}`,
        version: '0.0.0',
        name: definition?.name ?? fallbackKey,
        publicFieldKeys: definition?.publicFieldKeys ?? [],
      },
      block: definition?.root ?? null,
      files: new Map(),
      declaredResourceDependencies: definition?.declaredResourceDependencies ?? [],
      issues: parsed.issues.map(issue => ({
        code: issue.code === 'invalid-root' ? 'block-entry-ignored' as const : 'manifest-field-ignored' as const,
        path: issue.path,
        message: issue.message,
      })),
      hasResourceErrors: false,
    }
  }
  return await readProjectCustomBlockPackageFromBytes(bytes, sourcePath)
}

export async function readProjectCustomBlockDefinitionAsPackage(
  fs: Pick<FileSystemService, 'readFile'>,
  sourcePath: string,
 ): Promise<ProjectCustomBlockPackage> {
  const normalizedPath = sourcePath.replace(/[\\/]+$/, '')
  const fileName = normalizedPath.split('/').pop() ?? 'custom-block'
  const fallbackKey = fileName.replace(/\.ocblock$/i, '')
  const result = await readProjectCustomBlockDefinition(fs, sourcePath)
  const issueCode = (code: 'invalid-definition' | 'invalid-root' | 'duplicate-key'): ProjectCustomBlockPackageIssue['code'] => (
    code === 'invalid-root' ? 'block-unavailable' : 'manifest-field-ignored'
  )
  if (!result.definition) {
    return {
      manifest: {
        type: 'opencard-custom-block',
        packageId: `block:${fallbackKey}`,
        version: '0.0.0',
        name: fallbackKey,
        publicFieldKeys: [],
      },
      block: null,
      files: new Map(),
      declaredResourceDependencies: [],
      issues: result.issues.map(issue => ({ code: issueCode(issue.code), path: issue.path, message: issue.message })),
      hasResourceErrors: false,
    }
  }
  const definition = result.definition
  return {
    manifest: {
      type: 'opencard-custom-block',
      packageId: `block:${definition.key}`,
      version: '0.0.0',
      name: definition.name,
      publicFieldKeys: definition.publicFieldKeys,
    },
    block: definition.root,
    files: new Map(),
    declaredResourceDependencies: definition.declaredResourceDependencies,
    issues: result.issues.map(issue => ({ code: issueCode(issue.code), path: issue.path, message: issue.message })),
    hasResourceErrors: false,
  }
}

export async function readProjectCustomBlockManifest(
  fs: Pick<FileSystemService, 'readBinaryFile'>,
  sourcePath: string,
): Promise<ProjectCustomBlockManifestReadResult> {
  return await readProjectCustomBlockManifestFromBytes(await fs.readBinaryFile(sourcePath), sourcePath)
}

export async function readInstalledProjectCustomBlockManifest(
  fs: Pick<FileSystemService, 'readFile' | 'fileExists'>,
  installationPath: string,
): Promise<ProjectCustomBlockManifestReadResult> {
  const manifestPath = `${installationPath.replace(/[\\/]+$/, '')}/${PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME}`
  const content = await fs.fileExists(manifestPath) ? await fs.readFile(manifestPath) : undefined
  return parseManifestText(content, fallbackPackageIdFromPath(installationPath))
}

export async function readInstalledProjectCustomBlockPackage(
  fs: Pick<FileSystemService, 'readFile' | 'fileExists'>,
  installationPath: string,
): Promise<ProjectCustomBlockPackage> {
  const root = installationPath.replace(/[\\/]+$/, '')
  const manifestResult = await readInstalledProjectCustomBlockManifest(fs, root)
  const issues = [...manifestResult.issues]
  const resourcesPath = `${root}/${PROJECT_CUSTOM_BLOCK_RESOURCES_DIRECTORY_NAME}`
  if (!await fs.fileExists(resourcesPath)) {
    addIssue(issues, 'package-structure-ignored', PROJECT_CUSTOM_BLOCK_RESOURCES_DIRECTORY_NAME, 'Package resources directory is missing')
  }
  const blockPath = `${root}/${PROJECT_CUSTOM_BLOCK_BLOCK_FILE_NAME}`
  const content = await fs.fileExists(blockPath) ? await fs.readFile(blockPath) : undefined
  const normalized = parseBlockText(content, manifestResult.manifest, issues)
  return {
    manifest: normalized.manifest,
    block: normalized.block,
    files: new Map(),
    issues,
    hasResourceErrors: issues.some(issue => issue.code === 'resource-unavailable'),
  }
}

export async function discoverInstalledProjectCustomBlocks(
  fs: Pick<FileSystemService, 'readDirectoryEntries' | 'readFile' | 'fileExists'>,
  projectRootPath: string,
): Promise<Map<string, ProjectCustomBlockManifestCatalogEntry>> {
  const root = projectRootPath.replace(/[\\/]+$/, '')
  const blocksRoot = `${root}/.opencard/blocks`
  const catalog = new Map<string, ProjectCustomBlockManifestCatalogEntry>()
  if (await fs.fileExists(blocksRoot)) {
    const localDefinitions = await discoverProjectCustomBlockDefinitions(fs, root)
    for (const [identity, entry] of localDefinitions) {
      catalog.set(`block:${identity}`, {
        manifest: {
          type: 'opencard-custom-block',
          packageId: `block:${entry.definition.key}`,
          version: '0.0.0',
          name: entry.definition.name,
          publicFieldKeys: entry.definition.publicFieldKeys,
        },
        installationPath: entry.path,
        resourceRootPath: root,
        loadState: 'unloaded',
        ...(entry.issues ? { issues: entry.issues.map(issue => ({
          code: issue.code === 'invalid-root' ? 'block-entry-ignored' as const : 'manifest-field-ignored' as const,
          path: issue.path,
          message: issue.message,
        })) } : {}),
      })
    }
  }
  return catalog
}

function dirname(path: string): string {
  return path.slice(0, path.lastIndexOf('/'))
}

async function writeExpandedPackage(
  fs: Pick<FileSystemService, 'createDirectory' | 'writeFile' | 'writeBinaryFile'>,
  targetPath: string,
  pkg: ProjectCustomBlockPackage & { block: CardBlock },
): Promise<void> {
  await fs.createDirectory(`${targetPath}/${PROJECT_CUSTOM_BLOCK_RESOURCES_DIRECTORY_NAME}`)
  await fs.writeFile(
    `${targetPath}/${PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME}`,
    serializeProjectCustomBlockManifest(pkg.manifest),
  )
  await fs.writeFile(
    `${targetPath}/${PROJECT_CUSTOM_BLOCK_BLOCK_FILE_NAME}`,
    JSON.stringify(pkg.block, null, 2),
  )
  for (const [relativePath, bytes] of pkg.files) {
    const normalized = normalizeArchiveEntryPath(relativePath)
    if (!normalized || normalized.isDirectory || !isAllowedArchivePath(normalized.path, false)) {
      throw new Error('Invalid custom block resource path')
    }
    const outputPath = `${targetPath}/${normalized.path}`
    await fs.createDirectory(dirname(outputPath))
    await fs.writeBinaryFile(outputPath, bytes)
  }
}

export async function installProjectCustomBlockPackageFromBytes(options: {
  fs: Pick<FileSystemService,
    'createDirectory' | 'writeFile' | 'writeBinaryFile' | 'readFile' | 'fileExists' | 'renameFile' | 'deleteFile'>
  projectRootPath: string
  bytes: Uint8Array
  sourcePath?: string
  createId?: () => string
}): Promise<ProjectCustomBlockInstallResult> {
  const pkg = await readProjectCustomBlockPackageFromBytes(options.bytes, options.sourcePath)
  if (!pkg.block) throw new Error('Custom block package cannot form a usable Block')
  if (pkg.issues.some(issue => issue.code === 'package-structure-ignored')) {
    throw new Error('Custom block package structure is incomplete')
  }
  const packageParts = splitProjectCustomBlockPackageId(pkg.manifest.packageId)
  const relativePath = projectCustomBlockInstallationRelativePath(pkg.manifest.packageId)
  if (!packageParts || !relativePath) throw new Error('Invalid custom block Package ID')

  const projectRoot = options.projectRootPath.replace(/[\\/]+$/, '')
  const finalPath = `${projectRoot}/${relativePath}`
  const publisherRoot = dirname(finalPath)
  const transactionId = toKeySlug((options.createId ?? (() => crypto.randomUUID()))(), '')
  if (!transactionId) throw new Error('Invalid custom block installation transaction ID')
  const temporaryPath = `${publisherRoot}/.${packageParts.blockKey}.install-${transactionId}`
  const backupPath = `${publisherRoot}/.${packageParts.blockKey}.backup-${transactionId}`
  if (await options.fs.fileExists(temporaryPath) || await options.fs.fileExists(backupPath)) {
    throw new Error('Custom block installation transaction path already exists')
  }

  await options.fs.createDirectory(publisherRoot)
  let movedExisting = false
  try {
    await writeExpandedPackage(options.fs, temporaryPath, { ...pkg, block: pkg.block })
    const verification = await readInstalledProjectCustomBlockPackage(options.fs, temporaryPath)
    if (!verification.block || verification.manifest.packageId !== pkg.manifest.packageId) {
      throw new Error('Expanded custom block package failed validation')
    }
    if (await options.fs.fileExists(finalPath)) {
      await options.fs.renameFile(finalPath, backupPath)
      movedExisting = true
    }
    try {
      await options.fs.renameFile(temporaryPath, finalPath)
    } catch (cause) {
      if (movedExisting && await options.fs.fileExists(backupPath)) {
        await options.fs.renameFile(backupPath, finalPath)
        movedExisting = false
      }
      throw cause
    }
    if (movedExisting && await options.fs.fileExists(backupPath)) {
      await options.fs.deleteFile(backupPath).catch(() => undefined)
    }
    return {
      manifest: verification.manifest,
      installationPath: relativePath,
      resourceRootPath: `${relativePath}/${PROJECT_CUSTOM_BLOCK_RESOURCES_DIRECTORY_NAME}`,
      replaced: movedExisting,
      issues: verification.issues,
    }
  } catch (cause) {
    if (await options.fs.fileExists(temporaryPath)) {
      await options.fs.deleteFile(temporaryPath).catch(() => undefined)
    }
    if (movedExisting && await options.fs.fileExists(backupPath)
      && !await options.fs.fileExists(finalPath)) {
      await options.fs.renameFile(backupPath, finalPath).catch(() => undefined)
    }
    throw cause
  }
}

export async function installProjectCustomBlockPackage(options: {
  fs: Pick<FileSystemService,
    'readBinaryFile' | 'createDirectory' | 'writeFile' | 'writeBinaryFile' | 'readFile' | 'fileExists' | 'renameFile' | 'deleteFile'>
  projectRootPath: string
  sourcePath: string
  createId?: () => string
}): Promise<ProjectCustomBlockInstallResult> {
  if (options.sourcePath.toLocaleLowerCase().endsWith('.ocblock')) {
    const source = await readProjectCustomBlockPackage(options.fs, options.sourcePath)
    if (!source.block) throw new Error('Custom block definition cannot form a usable Block')
    const key = source.manifest.packageId.replace(/^block:/i, '') || 'custom-block'
    const projectRoot = options.projectRootPath.replace(/[\\/]+$/, '')
    const directory = `${projectRoot}/.opencard/blocks`
    const target = `${directory}/${key}.ocblock`
    const replaced = await options.fs.fileExists(target)
    await options.fs.createDirectory(directory)
    await options.fs.writeFile(target, serializeProjectCustomBlockDefinition({
      type: 'opencard-custom-block',
      key,
      name: source.manifest.name,
      root: source.block,
      publicFieldKeys: source.manifest.publicFieldKeys,
      declaredResourceDependencies: source.declaredResourceDependencies ?? [],
    }))
    return {
      manifest: source.manifest,
      installationPath: target,
      resourceRootPath: projectRoot,
      replaced,
      issues: source.issues,
    }
  }
  return await installProjectCustomBlockPackageFromBytes({
    ...options,
    bytes: await options.fs.readBinaryFile(options.sourcePath),
  })
}

export async function uninstallProjectCustomBlockPackage(options: {
  fs: Pick<FileSystemService, 'fileExists' | 'deleteFile'>
  projectRootPath: string
  packageId: string
}): Promise<boolean> {
  const normalized = options.packageId.toLocaleLowerCase()
  if (normalized.startsWith('block:')) {
    const key = normalized.slice('block:'.length)
    const target = `${options.projectRootPath.replace(/[\\/]+$/, '')}/.opencard/blocks/${key}.ocblock`
    if (!await options.fs.fileExists(target)) return false
    await options.fs.deleteFile(target)
    return true
  }
  const relativePath = projectCustomBlockInstallationRelativePath(options.packageId)
  if (!relativePath) throw new Error('Invalid custom block Package ID')
  const target = `${options.projectRootPath.replace(/[\\/]+$/, '')}/${relativePath}`
  if (!await options.fs.fileExists(target)) return false
  await options.fs.deleteFile(target)
  return true
}

export async function exportProjectCustomBlockPackage(options: {
  fs: Pick<FileSystemService, 'writeBinaryFile'> & Partial<Pick<FileSystemService, 'writeFile'>>
  manifest: ProjectCustomBlockManifest
  block: CardBlock
  files?: ReadonlyMap<string, Uint8Array>
  declaredResourceDependencies?: readonly string[]
  outputPath: string
}): Promise<string> {
  const outputPath = options.outputPath.toLocaleLowerCase().endsWith('.ocblock')
    ? options.outputPath
    : `${options.outputPath}.ocblock`
  const content = serializeProjectCustomBlockDefinition({
    type: 'opencard-custom-block',
    key: options.manifest.packageId.split('/').pop()?.replace(/^block:/i, '') ?? 'custom-block',
    name: options.manifest.name,
    root: options.block,
    publicFieldKeys: options.manifest.publicFieldKeys,
    declaredResourceDependencies: options.declaredResourceDependencies ?? [],
  })
  if (options.fs.writeFile) await options.fs.writeFile(outputPath, content)
  else await options.fs.writeBinaryFile(outputPath, strToU8(content))
  return outputPath
}
