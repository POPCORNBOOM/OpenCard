import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type { FileSystemService } from './fileSystemService'
import { parseStoredCardBlock } from '../../../entities/card/storage'
import type { CardBlock } from '../../../entities/card/model'
import { parseAdditionalFieldDefinitions } from '../../../entities/card/schema'
import {
  parseProjectCustomBlockManifest,
  PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME,
  PROJECT_CUSTOM_BLOCK_SCHEMA_VERSION,
  serializeProjectCustomBlockManifest,
  type ProjectCustomBlockManifest,
  computeProjectCustomBlockInterfaceHash,
} from '../model/projectCustomBlocks'

const MAX_CUSTOM_BLOCK_BYTES = 128 * 1024 * 1024
const MAX_CUSTOM_BLOCK_UNPACKED_BYTES = 512 * 1024 * 1024
const MAX_CUSTOM_BLOCK_ENTRIES = 256
const MAX_CUSTOM_BLOCK_ENTRY_BYTES = 256 * 1024 * 1024
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50
const ZIP_CENTRAL_DIRECTORY_ENTRY = 0x02014b50

export type ProjectCustomBlockPackage = {
  manifest: ProjectCustomBlockManifest
  files: ReadonlyMap<string, Uint8Array>
}

function normalizeArchivePath(value: string): string | null {
  const path = value.replace(/\\/g, '/').replace(/\/+/g, '/')
  if (!path || path.startsWith('/') || /^[a-z]:/i.test(path)
    || path.split('/').some(segment => !segment || segment === '.' || segment === '..')) return null
  return path
}

function normalizeAdditionalFieldDefinitions(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeAdditionalFieldDefinitions)
  if (!value || typeof value !== 'object') return value

  const source = value as Record<string, unknown>
  const normalized: Record<string, unknown> = {}
  for (const [key, fieldValue] of Object.entries(source)) {
    if (key === 'additionalFieldDefinition') {
      const definitions = parseAdditionalFieldDefinitions(fieldValue)
      if (Object.keys(definitions).length > 0) normalized[key] = definitions
      continue
    }
    normalized[key] = normalizeAdditionalFieldDefinitions(fieldValue)
  }
  return normalized
}

function preflightZipArchive(bytes: Uint8Array): void {
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
    const uncompressedSize = view.getUint32(cursor + 24, true)
    const nameLength = view.getUint16(cursor + 28, true)
    const extraLength = view.getUint16(cursor + 30, true)
    const commentLength = view.getUint16(cursor + 32, true)
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

function validateNativeRoot(root: unknown, manifest: ProjectCustomBlockManifest): CardBlock {
  const block = parseStoredCardBlock(normalizeAdditionalFieldDefinitions(root))
  const ids = new Set<string>()
  const visit = (candidate: CardBlock): void => {
    if (!candidate.id.trim() || ids.has(candidate.id)) throw new Error('Custom block tree contains an invalid or duplicate ID')
    ids.add(candidate.id)
    if (candidate.type === 'custom-block') throw new Error('Custom block package contains an unresolved custom block')
    if ((candidate.type === 'simple-container-block' || candidate.type === 'flow-container-block')
      && Object.prototype.hasOwnProperty.call(candidate, 'packaged')) {
      throw new Error('Custom block package contains editor packaging state')
    }
    const rawDefinitions = candidate.additionalFieldDefinition
    const parsedDefinitions = parseAdditionalFieldDefinitions(rawDefinitions)
    if (rawDefinitions !== undefined
      && (!rawDefinitions || typeof rawDefinitions !== 'object' || Array.isArray(rawDefinitions)
        || Object.keys(parsedDefinitions).length !== Object.keys(rawDefinitions).length)) {
      throw new Error('Custom block tree contains invalid additional field definitions')
    }
    if (candidate.type !== 'simple-container-block' && candidate.type !== 'flow-container-block') return
    for (const child of candidate.children) {
      if (!child.location.id.trim() || ids.has(child.location.id)) {
        throw new Error('Custom block tree contains an invalid or duplicate ID')
      }
      ids.add(child.location.id)
      visit(child.block)
    }
  }
  visit(block)
  const rootDefinitions = parseAdditionalFieldDefinitions(block.additionalFieldDefinition)
  for (const field of manifest.publicFields) {
    const definition = rootDefinitions[field.key]
    if (!definition || definition.fieldType !== field.fieldType) {
      throw new Error(`Custom block public field is not defined on the root: ${field.key}`)
    }
    if (field.defaultValue !== undefined
      && (block as unknown as Record<string, unknown>)[field.key] !== field.defaultValue) {
      throw new Error(`Custom block public field default does not match the root: ${field.key}`)
    }
  }
  return block
}

function indexedResourcePaths(manifest: ProjectCustomBlockManifest): string[] {
  const resources = manifest.resources
  const groups = [
    { prefix: 'resources/fonts/', paths: (resources?.fonts ?? []).map(resource => resource.source) },
    { prefix: 'resources/images/', paths: (resources?.images ?? []).map(resource => resource.source) },
    { prefix: 'resources/icons/', paths: (resources?.iconSeries ?? []).map(series => series.source) },
  ]
  const paths: string[] = []
  const identities = new Set<string>()
  for (const group of groups) {
    for (const rawPath of group.paths) {
      const path = normalizeArchivePath(rawPath)
      const identity = path?.toLowerCase()
      if (!path || !path.toLowerCase().startsWith(group.prefix) || identities.has(identity!)) {
        throw new Error('Custom block resource index is invalid')
      }
      identities.add(identity!)
      paths.push(path)
    }
  }
  return paths
}

function validatePackageFiles(manifest: ProjectCustomBlockManifest, files: ReadonlyMap<string, Uint8Array>): void {
  const indexed = indexedResourcePaths(manifest)
  for (const path of indexed) {
    if (!files.has(path)) throw new Error('Custom block resource is missing')
  }
  const allowed = new Set([PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME, ...indexed].map(path => path.toLowerCase()))
  for (const path of files.keys()) {
    if (!allowed.has(path.toLowerCase())) throw new Error('Custom block package contains an unlisted file')
  }
}

function validateResourceReferences(manifest: ProjectCustomBlockManifest, root: CardBlock): void {
  const imagePaths = new Set((manifest.resources?.images ?? []).map(resource => resource.source))
  const iconSeries = new Map((manifest.resources?.iconSeries ?? []).map(series => [series.key, new Set(series.icons.map(icon => icon.iconKey))]))
  const iconTokenPattern = /\[\[icon:([a-z0-9][a-z0-9._-]*)\/([a-z0-9][a-z0-9._-]*)\]\]/gi
  const richIconTagPattern = /<[^>]*data-oc-icon-series\s*=\s*(["'])([^"']+)\1[^>]*data-oc-icon-key\s*=\s*(["'])([^"']+)\3[^>]*>/gi
  const validateIconReference = (seriesKey: string, iconKey: string): void => {
    const icons = iconSeries.get(seriesKey)
    if (seriesKey.toLowerCase().startsWith('ocblock-') && (!icons || !icons.has(iconKey))) {
      throw new Error('Custom block icon reference is not indexed')
    }
  }
  const visit = (block: CardBlock): void => {
    if (block.type === 'image-block' && block.image.toLowerCase().startsWith('ocblock:')) {
      const prefix = `ocblock:${manifest.key}/`
      if (!block.image.startsWith(prefix) || !imagePaths.has(block.image.slice(prefix.length))) {
        throw new Error('Custom block image reference is not indexed')
      }
    }
    for (const value of Object.values(block)) {
      if (typeof value !== 'string') continue
      for (const match of value.matchAll(iconTokenPattern)) {
        validateIconReference(match[1]!, match[2]!)
      }
      for (const match of value.matchAll(richIconTagPattern)) {
        validateIconReference(match[2]!, match[4]!)
      }
    }
    if (block.type !== 'simple-container-block' && block.type !== 'flow-container-block') return
    for (const child of block.children) visit(child.block)
  }
  visit(root)
}

export function createProjectCustomBlockArchive(
  manifest: ProjectCustomBlockManifest,
  files: ReadonlyMap<string, Uint8Array> = new Map(),
): Uint8Array {
  const archive: Record<string, Uint8Array> = {
    [PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME]: strToU8(serializeProjectCustomBlockManifest(manifest)),
  }
  for (const [rawPath, bytes] of files) {
    const path = normalizeArchivePath(rawPath)
    if (!path || path === PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME) throw new Error('Invalid custom block archive path')
    archive[path] = bytes
  }
  validateNativeRoot(manifest.root, manifest)
  validateResourceReferences(manifest, manifest.root)
  validatePackageFiles(manifest, new Map(Object.entries(archive)))
  return zipSync(archive, { level: 9 })
}

export async function readProjectCustomBlockPackageFromBytes(bytes: Uint8Array): Promise<ProjectCustomBlockPackage> {
  if (bytes.byteLength > MAX_CUSTOM_BLOCK_BYTES) throw new Error('Custom block package is too large')
  preflightZipArchive(bytes)
  const unpacked = unzipSync(bytes)
  const files = new Map<string, Uint8Array>()
  const pathIdentities = new Set<string>()
  let unpackedBytes = 0
  for (const [rawPath, content] of Object.entries(unpacked)) {
    const path = normalizeArchivePath(rawPath)
    const identity = path?.toLowerCase()
    if (!path || pathIdentities.has(identity!)) throw new Error('Invalid custom block archive path')
    pathIdentities.add(identity!)
    unpackedBytes += content.byteLength
    if (unpackedBytes > MAX_CUSTOM_BLOCK_UNPACKED_BYTES) throw new Error('Unpacked custom block package is too large')
    files.set(path, content)
  }
  const manifestBytes = files.get(PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME)
  if (!manifestBytes) throw new Error('Custom block manifest is missing')
  let parsed: unknown
  try {
    parsed = JSON.parse(strFromU8(manifestBytes))
  } catch {
    throw new Error('Custom block manifest is invalid')
  }
  const manifest = parseProjectCustomBlockManifest(parsed)
  if (!manifest || manifest.schemaVersion !== PROJECT_CUSTOM_BLOCK_SCHEMA_VERSION) {
    throw new Error('Custom block manifest is invalid')
  }
  const root = validateNativeRoot(manifest.root, manifest)
  validateResourceReferences(manifest, root)
  validatePackageFiles(manifest, files)
  const interfaceHash = await computeProjectCustomBlockInterfaceHash(manifest.publicFields, manifest.resize)
  if (interfaceHash !== manifest.interfaceHash) throw new Error('Custom block interface hash does not match')
  return { manifest, files }
}

export async function readProjectCustomBlockPackage(
  fs: Pick<FileSystemService, 'readBinaryFile'>,
  sourcePath: string,
): Promise<ProjectCustomBlockPackage> {
  return await readProjectCustomBlockPackageFromBytes(await fs.readBinaryFile(sourcePath))
}

export async function exportProjectCustomBlockPackage(options: {
  fs: Pick<FileSystemService, 'writeBinaryFile'>
  manifest: ProjectCustomBlockManifest
  files?: ReadonlyMap<string, Uint8Array>
  outputPath: string
}): Promise<string> {
  const outputPath = options.outputPath.toLowerCase().endsWith('.ocblock')
    ? options.outputPath
    : `${options.outputPath}.ocblock`
  await options.fs.writeBinaryFile(outputPath, createProjectCustomBlockArchive(options.manifest, options.files))
  return outputPath
}
