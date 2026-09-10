import { zipSync } from 'fflate'
import {
  RESOURCE_PACKAGE_MANIFEST_FILE_NAME,
  RESOURCE_PACKAGE_SUFFIX,
  normalizeResourcePackageManifest,
  serializeResourcePackageManifest,
  type ResourcePackageManifest,
  type ResourcePackagePublicResources,
} from '../model/resourcePackage'
import type { ResourcePackageContentFile } from './resourcePackageHash'
import { createResourcePackageContentHash, normalizeResourcePackageContent } from './resourcePackageHash'
import type { FileSystemService } from './fileSystemService'

export type ResourcePackageBuildOptions = {
  fs?: Pick<FileSystemService, 'writeBinaryFile'>
  outputPath?: string
  key: string
  name: string
  version: string
  files: readonly ResourcePackageContentFile[]
  public?: Partial<ResourcePackagePublicResources>
  /** 包封面：包根相对路径，指向 files 中已包含的图片。 */
  cover?: string
  compressionLevel?: number
}

export type ResourcePackageBuildResult = {
  manifest: ResourcePackageManifest
  files: readonly ResourcePackageContentFile[]
  archive: Uint8Array
  outputPath?: string
}

function normalizePublicResources(
  publicResources: Partial<ResourcePackagePublicResources> | undefined,
): ResourcePackagePublicResources {
  const values = publicResources ?? {}
  return {
    fonts: [...(values.fonts ?? [])],
    iconSeries: [...(values.iconSeries ?? [])],
  }
}

function archiveEntries(
  files: readonly ResourcePackageContentFile[],
  manifest: ResourcePackageManifest,
): Record<string, Uint8Array> {
  const entries: Record<string, Uint8Array> = {}
  for (const file of files) entries[file.path] = file.bytes
  entries[RESOURCE_PACKAGE_MANIFEST_FILE_NAME] = new TextEncoder().encode(serializeResourcePackageManifest(manifest))
  return entries
}

export async function buildResourcePackageArchive(
  options: ResourcePackageBuildOptions,
): Promise<ResourcePackageBuildResult> {
  const files = normalizeResourcePackageContent(options.files)
  const contentHash = await createResourcePackageContentHash(files)
  const normalized = normalizeResourcePackageManifest({
    type: 'opencard-resource-package',
    key: options.key,
    name: options.name,
    version: options.version,
    contentHash,
    ...(options.cover ? { cover: options.cover } : {}),
    public: normalizePublicResources(options.public),
  }, options.key)
  if (normalized.issues.length > 0) {
    throw new Error(`Invalid package manifest: ${normalized.issues.map(issue => `${issue.path}: ${issue.message}`).join('; ')}`)
  }
  const manifest = normalized.manifest
  const archive = zipSync(archiveEntries(files, manifest), {
    level: (options.compressionLevel ?? 6) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
  })
  const outputPath = options.outputPath
    ? options.outputPath.toLocaleLowerCase().endsWith(RESOURCE_PACKAGE_SUFFIX)
      ? options.outputPath
      : `${options.outputPath}${RESOURCE_PACKAGE_SUFFIX}`
    : undefined
  if (outputPath && options.fs) await options.fs.writeBinaryFile(outputPath, archive)
  if (outputPath && !options.fs) throw new Error('A file system service is required when outputPath is provided')
  return { manifest, files, archive, ...(outputPath ? { outputPath } : {}) }
}

export async function exportResourcePackage(
  options: ResourcePackageBuildOptions & { fs: Pick<FileSystemService, 'writeBinaryFile'>, outputPath: string },
): Promise<string> {
  const result = await buildResourcePackageArchive(options)
  return result.outputPath!
}
