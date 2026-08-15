import { strFromU8, strToU8, unzip, zipSync, type UnzipFileInfo } from 'fflate'
import type { FileSystemService } from './fileSystemService'
import { normalizeStoredCardBlock } from '../../../entities/card/storage'
import type { CardBlock } from '../../../entities/card/model'
import { projectFontSources } from '../model/projectFontRegistry'
import { visitCardBlockTree } from '../../../entities/card/tree'
import { collectProjectIconReferences } from '../../../shared/rich-text/projectIconReference'
import { toKeySlug } from '../../../shared/model/keySlug'
import { analyzeProjectCustomBlockExport } from './projectCustomBlockExportAnalyzer'
import { normalizeProjectCustomBlockKey, normalizeProjectCustomBlockManifest, PROJECT_CUSTOM_BLOCK_ALWAYS_PUBLIC_FIELD_KEYS,
  PROJECT_CUSTOM_BLOCK_BLOCK_FILE_NAME,
  PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME, serializeProjectCustomBlockManifest, type ProjectCustomBlockManifest,
  type ProjectCustomBlockPackageIssue } from '../model/projectCustomBlocks'

const MAX_CUSTOM_BLOCK_BYTES = 128 * 1024 * 1024
const MAX_CUSTOM_BLOCK_UNPACKED_BYTES = 512 * 1024 * 1024
const MAX_CUSTOM_BLOCK_ENTRIES = 256
const MAX_CUSTOM_BLOCK_ENTRY_BYTES = 256 * 1024 * 1024
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50, ZIP_CENTRAL_DIRECTORY_ENTRY = 0x02014b50

export type ProjectCustomBlockPackage = { manifest: ProjectCustomBlockManifest; block: CardBlock | null
  files: ReadonlyMap<string, Uint8Array>; issues: readonly ProjectCustomBlockPackageIssue[]; hasResourceErrors: boolean }
export type ProjectCustomBlockManifestReadResult = { manifest: ProjectCustomBlockManifest
  issues: readonly ProjectCustomBlockPackageIssue[] }
function addIssue(issues: ProjectCustomBlockPackageIssue[], code: ProjectCustomBlockPackageIssue['code'], path: string, message: string): void {
  issues.push({ code, path, message }) }
export function findProjectCustomBlockFile(files: ReadonlyMap<string, Uint8Array>, path: string): Uint8Array | undefined {
  const identity = path.toLowerCase()
  for (const [candidate, bytes] of files) {
    if (candidate.toLowerCase() === identity) return bytes
  }
  return undefined
}
function normalizeArchivePath(value: string): string | null {
  const path = value.replace(/\\/g, '/').replace(/\/+/g, '/')
  if (!path || path.startsWith('/') || /^[a-z]:/i.test(path)
    || path.split('/').some(segment => !segment || segment === '.' || segment === '..')) return null
  return path
}
function preflightZipArchive(bytes: Uint8Array): void {
  if (bytes.byteLength < 22) throw new Error('Custom block archive is invalid')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const searchStart = Math.max(0, bytes.byteLength - 0xffff - 22)
  let endOffset = -1
  for (let offset = bytes.byteLength - 22; offset >= searchStart; offset -= 1) {
    if (view.getUint32(offset, true) === ZIP_END_OF_CENTRAL_DIRECTORY) { endOffset = offset; break }
  }
  if (endOffset < 0) throw new Error('Custom block archive is invalid')

  const entryCount = view.getUint16(endOffset + 10, true), directorySize = view.getUint32(endOffset + 12, true)
  const directoryOffset = view.getUint32(endOffset + 16, true)
  if (entryCount === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff
    || entryCount > MAX_CUSTOM_BLOCK_ENTRIES || directoryOffset + directorySize > endOffset)
    throw new Error('Custom block archive exceeds limits')

  let cursor = directoryOffset
  let unpackedBytes = 0
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > directoryOffset + directorySize
      || view.getUint32(cursor, true) !== ZIP_CENTRAL_DIRECTORY_ENTRY)
      throw new Error('Custom block archive is invalid')
    const uncompressedSize = view.getUint32(cursor + 24, true), nameLength = view.getUint16(cursor + 28, true)
    const extraLength = view.getUint16(cursor + 30, true), commentLength = view.getUint16(cursor + 32, true)
    if (uncompressedSize > MAX_CUSTOM_BLOCK_ENTRY_BYTES) throw new Error('Custom block archive exceeds limits')
    unpackedBytes += uncompressedSize
    if (unpackedBytes > MAX_CUSTOM_BLOCK_UNPACKED_BYTES) throw new Error('Custom block archive exceeds limits')
    cursor += 46 + nameLength + extraLength + commentLength
  }
  if (cursor !== directoryOffset + directorySize) throw new Error('Custom block archive is invalid')
}

async function unzipArchive(bytes: Uint8Array, filter?: (file: UnzipFileInfo) => boolean): Promise<Record<string, Uint8Array>> {
  return await new Promise((resolve, reject) => {
    const paths = new Set<string>()
    try {
      unzip(bytes, { filter: file => {
        const path = normalizeArchivePath(file.name)
        const identity = path?.toLowerCase()
        if (!path || paths.has(identity!)) throw new Error('Invalid custom block archive path')
        paths.add(identity!)
        return filter?.(file) ?? true
      } }, (error, data) => {
        if (error) reject(error)
        else resolve(Object.fromEntries(Object.entries(data).map(([path, content]) => [normalizeArchivePath(path)!, content])))
      })
    } catch (error) {
      reject(error)
    }
  })
}

function fallbackKeyFromPath(path?: string): string {
  const name = path?.replace(/\\/g, '/').split('/').pop()?.replace(/\.ocblock$/i, '') ?? ''
  return normalizeProjectCustomBlockKey(toKeySlug(name, 'custom-block')) ?? 'custom-block' }

function parseManifestBytes(bytes: Uint8Array | undefined, fallbackKey: string): ProjectCustomBlockManifestReadResult {
  if (!bytes) {
    const result = normalizeProjectCustomBlockManifest({}, fallbackKey)
    return { ...result, issues: [{ code: 'manifest-field-ignored', path: PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME, message: 'Missing manifest used current defaults' }, ...result.issues] }
  }
  try {
    return normalizeProjectCustomBlockManifest(JSON.parse(strFromU8(bytes)), fallbackKey)
  } catch {
    const result = normalizeProjectCustomBlockManifest({}, fallbackKey)
    return { ...result, issues: [{ code: 'manifest-field-ignored', path: PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME, message: 'Unreadable manifest used current defaults' }, ...result.issues] }
  }
}

export async function readProjectCustomBlockManifestFromBytes(bytes: Uint8Array, sourcePath?: string): Promise<ProjectCustomBlockManifestReadResult> {
  if (bytes.byteLength > MAX_CUSTOM_BLOCK_BYTES) throw new Error('Custom block package is too large')
  preflightZipArchive(bytes)
  const unpacked = await unzipArchive(bytes, file => file.name.toLowerCase() === PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME.toLowerCase())
  const manifestBytes = Object.entries(unpacked).find(([path]) => path.toLowerCase() === PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME.toLowerCase())?.[1]
  return parseManifestBytes(manifestBytes, fallbackKeyFromPath(sourcePath))
}

function normalizeNativeRoot(root: unknown, manifest: ProjectCustomBlockManifest, issues: ProjectCustomBlockPackageIssue[]): {
  block: CardBlock | null; manifest: ProjectCustomBlockManifest } {
  const normalized = normalizeStoredCardBlock(root)
  issues.push(...normalized.warnings.map(warning => ({ code: 'block-entry-ignored' as const,
    path: `${PROJECT_CUSTOM_BLOCK_BLOCK_FILE_NAME}${warning.path.slice(1)}`, message: warning.message })))
  const block = normalized.block
  if (!block || block.type === 'custom-block') {
    addIssue(issues, 'block-unavailable', PROJECT_CUSTOM_BLOCK_BLOCK_FILE_NAME, 'Root Block is unavailable')
    return { block: null, manifest }
  }

  const removeNestedCustomBlocks = (candidate: CardBlock): void => {
    if (candidate.type !== 'simple-container-block' && candidate.type !== 'flow-container-block') return
    for (let index = candidate.children.length - 1; index >= 0; index -= 1) {
      if (candidate.children[index]!.block.type !== 'custom-block') continue
      candidate.children.splice(index, 1)
      addIssue(issues, 'block-entry-ignored', `${PROJECT_CUSTOM_BLOCK_BLOCK_FILE_NAME}.children[${index}]`, 'Nested custom Block was ignored')
    }
    candidate.children.forEach(child => removeNestedCustomBlocks(child.block))
  }
  removeNestedCustomBlocks(block)

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
    ...PROJECT_CUSTOM_BLOCK_ALWAYS_PUBLIC_FIELD_KEYS,
    ...analyzeProjectCustomBlockExport(block).fields.map(field => field.key),
  ].map(fieldKey => fieldKey.toLowerCase()))
  const publicFieldKeys = manifest.publicFieldKeys.filter(fieldKey => {
    const found = publicFields.has(fieldKey.toLowerCase())
    if (!found) addIssue(issues, 'manifest-field-ignored', `publicFieldKeys.${fieldKey}`, 'Public field unavailable on the root was ignored')
    return found
  })
  return { block, manifest: { ...manifest, publicFieldKeys } }
}

function indexedResourcePaths(manifest: ProjectCustomBlockManifest, issues: ProjectCustomBlockPackageIssue[]): string[] {
  const resources = manifest.resources
  const groups = [
    { prefix: 'resources/fonts/', paths: (resources?.fonts ?? [])
      .flatMap(resource => resource.kind === 'font' ? projectFontSources(resource) : []) },
    { prefix: 'resources/images/', paths: (resources?.images ?? []).map(resource => resource.source) },
    { prefix: 'resources/icons/', paths: (resources?.iconSeries ?? []).map(series => series.source) },
  ]
  const paths: string[] = []
  const identities = new Set<string>()
  for (const group of groups) {
    for (const rawPath of group.paths) {
      const path = normalizeArchivePath(rawPath)
      const identity = path?.toLowerCase()
      if (!path || !path.toLowerCase().startsWith(group.prefix)) {
        addIssue(issues, 'resource-unavailable', rawPath, 'Invalid resource path was ignored')
        continue
      }
      if (identities.has(identity!)) continue
      identities.add(identity!)
      paths.push(path)
    }
  }
  return paths
}

function collectRuntimeFiles(manifest: ProjectCustomBlockManifest, files: ReadonlyMap<string, Uint8Array>, issues: ProjectCustomBlockPackageIssue[]): ReadonlyMap<string, Uint8Array> {
  const indexed = indexedResourcePaths(manifest, issues)
  const runtimeFiles = new Map<string, Uint8Array>()
  for (const path of indexed) {
    const bytes = findProjectCustomBlockFile(files, path)
    if (bytes) runtimeFiles.set(path, bytes)
    else addIssue(issues, 'resource-unavailable', path, 'Indexed resource file is missing')
  }
  return runtimeFiles
}

function collectResourceReferenceIssues(manifest: ProjectCustomBlockManifest, root: CardBlock): ProjectCustomBlockPackageIssue[] {
  const issues: ProjectCustomBlockPackageIssue[] = []
  const imageKeys = new Set((manifest.resources?.images ?? []).map(resource => resource.key.toLowerCase()))
  const fontKeys = new Set((manifest.resources?.fonts ?? []).map(resource => resource.key.toLowerCase()))
  const fontFamilies = new Set((manifest.resources?.fonts ?? [])
    .filter(resource => resource.kind === 'font')
    .map(resource => resource.key.toLowerCase()))
  const iconSeries = new Map((manifest.resources?.iconSeries ?? []).map(series => [
    series.key.toLowerCase(),
    new Set(series.icons.map(icon => icon.iconKey.toLowerCase())),
  ]))
  for (const font of manifest.resources?.fonts ?? []) {
    if (font.kind !== 'composition') continue
    for (const member of font.members) {
      if (!fontFamilies.has(member.fontKey.toLowerCase())) {
        addIssue(issues, 'resource-unavailable', member.fontKey, 'Font composition member is not an indexed font')
      }
    }
  }
  const validateIconReference = (seriesKey: string, iconKey: string): void => {
    const icons = iconSeries.get(seriesKey.toLowerCase())
    if (!icons || !icons.has(iconKey.toLowerCase())) {
      addIssue(issues, 'resource-unavailable', `${seriesKey}/${iconKey}`, 'Icon reference is not indexed')
    }
  }
  visitCardBlockTree(root, block => {
    if (block.type === 'image-block' && !block.image.includes('{{')) {
      const match = /^resource:image:([a-z0-9][a-z0-9._-]*)$/i.exec(block.image.trim())
      if (!match || !imageKeys.has(match[1]!.toLowerCase())) {
        addIssue(issues, 'resource-unavailable', block.image, 'Image reference is not package-local or indexed')
      }
    }
    if ('fontFamily' in block && typeof block.fontFamily === 'string') {
      for (const entry of block.fontFamily.split(';').map(value => value.trim()).filter(Boolean)) {
        const match = /^resource:font:([a-z0-9][a-z0-9._-]*)$/i.exec(entry)
        if (entry.toLowerCase().startsWith('resource:font:')
          && (!match || !fontKeys.has(match[1]!.toLowerCase()))) {
          addIssue(issues, 'resource-unavailable', entry, 'Font reference is not indexed')
        }
        if (entry.toLowerCase().startsWith('font:') || entry.startsWith('OpenCardCustomBlock-')) {
          addIssue(issues, 'resource-unavailable', entry, 'Font reference is not package-local')
        }
      }
    }
    for (const value of Object.values(block)) {
      if (typeof value !== 'string') continue
      if (/ocblock:/i.test(value)) addIssue(issues, 'resource-unavailable', block.id, 'Cross-package resource reference is unavailable')
      for (const reference of collectProjectIconReferences(value)) {
        validateIconReference(reference.seriesKey, reference.iconKey)
      }
    }
  })
  return issues
}

export function createProjectCustomBlockArchive(manifest: ProjectCustomBlockManifest, block: CardBlock,
  files: ReadonlyMap<string, Uint8Array> = new Map()): Uint8Array {
  const archive: Record<string, Uint8Array> = {
    [PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME]: strToU8(serializeProjectCustomBlockManifest(manifest)),
    [PROJECT_CUSTOM_BLOCK_BLOCK_FILE_NAME]: strToU8(JSON.stringify(block, null, 2)),
  }
  const pathIdentities = new Set([
    PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME.toLowerCase(),
    PROJECT_CUSTOM_BLOCK_BLOCK_FILE_NAME.toLowerCase(),
  ])
  for (const [rawPath, bytes] of files) {
    const path = normalizeArchivePath(rawPath)
    const identity = path?.toLowerCase()
    if (!path || pathIdentities.has(identity!)) throw new Error('Invalid custom block archive path')
    pathIdentities.add(identity!)
    archive[path] = bytes
  }
  const issues: ProjectCustomBlockPackageIssue[] = []
  const normalized = normalizeNativeRoot(block, manifest, issues)
  if (!normalized.block) throw new Error('Custom block root Block is unavailable')
  const runtimeFiles = collectRuntimeFiles(normalized.manifest, new Map(Object.entries(archive)), issues)
  if (runtimeFiles.size !== Object.keys(archive).length - 2) addIssue(issues, 'resource-unavailable', 'resources', 'Package contains an unlisted resource file')
  issues.push(...collectResourceReferenceIssues(normalized.manifest, normalized.block))
  if (issues.length) throw new Error(issues[0]!.message)
  return zipSync(archive, { level: 9 })
}

export async function readProjectCustomBlockPackageFromBytes(bytes: Uint8Array, sourcePath?: string): Promise<ProjectCustomBlockPackage> {
  if (bytes.byteLength > MAX_CUSTOM_BLOCK_BYTES) throw new Error('Custom block package is too large')
  preflightZipArchive(bytes)
  const unpacked = await unzipArchive(bytes)
  const files = new Map(Object.entries(unpacked))
  const manifestResult = parseManifestBytes(
    findProjectCustomBlockFile(files, PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME),
    fallbackKeyFromPath(sourcePath),
  )
  const issues = [...manifestResult.issues]
  const blockBytes = findProjectCustomBlockFile(files, PROJECT_CUSTOM_BLOCK_BLOCK_FILE_NAME)
  let root: unknown
  if (!blockBytes) {
    addIssue(issues, 'block-unavailable', PROJECT_CUSTOM_BLOCK_BLOCK_FILE_NAME, 'Root Block file is missing')
  } else {
    try {
      root = JSON.parse(strFromU8(blockBytes))
    } catch {
      addIssue(issues, 'block-unavailable', PROJECT_CUSTOM_BLOCK_BLOCK_FILE_NAME, 'Root Block JSON is unreadable')
    }
  }
  const normalized = root === undefined
    ? { block: null, manifest: manifestResult.manifest }
    : normalizeNativeRoot(root, manifestResult.manifest, issues)
  const runtimeFiles = collectRuntimeFiles(normalized.manifest, files, issues)
  if (normalized.block) issues.push(...collectResourceReferenceIssues(normalized.manifest, normalized.block))
  return { manifest: normalized.manifest, block: normalized.block, files: runtimeFiles, issues,
    hasResourceErrors: issues.some(issue => issue.code === 'resource-unavailable') }
}

export async function readProjectCustomBlockPackage(fs: Pick<FileSystemService, 'readBinaryFile'>, sourcePath: string): Promise<ProjectCustomBlockPackage> {
  return await readProjectCustomBlockPackageFromBytes(await fs.readBinaryFile(sourcePath), sourcePath) }
export async function readProjectCustomBlockManifest(fs: Pick<FileSystemService, 'readBinaryFile'>, sourcePath: string): Promise<ProjectCustomBlockManifestReadResult> {
  return await readProjectCustomBlockManifestFromBytes(await fs.readBinaryFile(sourcePath), sourcePath) }

export async function exportProjectCustomBlockPackage(options: { fs: Pick<FileSystemService, 'writeBinaryFile'>
  manifest: ProjectCustomBlockManifest; block: CardBlock; files?: ReadonlyMap<string, Uint8Array>; outputPath: string }): Promise<string> {
  const outputPath = options.outputPath.toLowerCase().endsWith('.ocblock')
    ? options.outputPath
    : `${options.outputPath}.ocblock`
  const archive = createProjectCustomBlockArchive(options.manifest, options.block, options.files)
  await options.fs.writeBinaryFile(outputPath, archive)
  return outputPath
}
