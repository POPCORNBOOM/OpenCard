import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type { FileSystemService } from './fileSystemService'
import {
  parseProjectCustomBlockManifest,
  PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME,
  PROJECT_CUSTOM_BLOCK_SCHEMA_VERSION,
  serializeProjectCustomBlockManifest,
  type ProjectCustomBlockManifest,
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
  return zipSync(archive, { level: 9 })
}

export function readProjectCustomBlockPackageFromBytes(bytes: Uint8Array): ProjectCustomBlockPackage {
  if (bytes.byteLength > MAX_CUSTOM_BLOCK_BYTES) throw new Error('Custom block package is too large')
  const unpacked = unzipSync(bytes)
  const files = new Map<string, Uint8Array>()
  let unpackedBytes = 0
  for (const [rawPath, content] of Object.entries(unpacked)) {
    const path = normalizeArchivePath(rawPath)
    if (!path || files.has(path)) throw new Error('Invalid custom block archive path')
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
  const indexedPaths = [
    ...(manifest.resources?.fonts ?? []).map(resource => resource.source),
    ...(manifest.resources?.images ?? []).map(resource => resource.source),
  ]
  for (const rawPath of indexedPaths) {
    const path = normalizeArchivePath(rawPath)
    if (!path || path === PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME || !files.has(path)) {
      throw new Error('Custom block resource is missing')
    }
  }
  return { manifest, files }
}

export async function readProjectCustomBlockPackage(
  fs: Pick<FileSystemService, 'readBinaryFile'>,
  sourcePath: string,
): Promise<ProjectCustomBlockPackage> {
  return readProjectCustomBlockPackageFromBytes(await fs.readBinaryFile(sourcePath))
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
