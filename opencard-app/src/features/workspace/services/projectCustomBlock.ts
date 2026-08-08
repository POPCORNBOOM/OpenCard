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
      const identity = path?.toLocaleLowerCase()
      if (!path || !path.toLocaleLowerCase().startsWith(group.prefix) || identities.has(identity!)) {
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
  const allowed = new Set([PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME, ...indexed].map(path => path.toLocaleLowerCase()))
  for (const path of files.keys()) {
    if (!allowed.has(path.toLocaleLowerCase())) throw new Error('Custom block package contains an unlisted file')
  }
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
  validatePackageFiles(manifest, new Map(Object.entries(archive)))
  return zipSync(archive, { level: 9 })
}

export async function readProjectCustomBlockPackageFromBytes(bytes: Uint8Array): Promise<ProjectCustomBlockPackage> {
  if (bytes.byteLength > MAX_CUSTOM_BLOCK_BYTES) throw new Error('Custom block package is too large')
  const unpacked = unzipSync(bytes)
  const files = new Map<string, Uint8Array>()
  const pathIdentities = new Set<string>()
  let unpackedBytes = 0
  for (const [rawPath, content] of Object.entries(unpacked)) {
    const path = normalizeArchivePath(rawPath)
    const identity = path?.toLocaleLowerCase()
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
  validateNativeRoot(manifest.root, manifest)
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
  const outputPath = options.outputPath.toLocaleLowerCase().endsWith('.ocblock')
    ? options.outputPath
    : `${options.outputPath}.ocblock`
  await options.fs.writeBinaryFile(outputPath, createProjectCustomBlockArchive(options.manifest, options.files))
  return outputPath
}
