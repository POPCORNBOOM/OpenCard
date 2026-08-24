import {
  type ResourcePackageDependency,
  type ResourcePackageHostDependency,
  type ResourcePackagePublicResources,
} from '../model/resourcePackage'
import type { FileSystemService } from './fileSystemService'
import { buildResourcePackageArchive, type ResourcePackageBuildResult } from './resourcePackageBuilder'
import type { ResourcePackageContentFile } from './resourcePackageHash'
import { normalizeKeySlug } from '../../../shared/model/keySlug'
import { PROJECT_CUSTOM_BLOCK_DEFINITION_SUFFIX } from './projectCustomBlockDefinition'

export type ResourcePackageProjectBuildOptions = {
  fs: Pick<FileSystemService, 'readBinaryFile' | 'readFile' | 'fileExists' | 'writeBinaryFile'>
  projectRootPath: string
  key: string
  name: string
  version: string
  blockPaths: readonly string[]
  resourcePaths?: readonly string[]
  public?: Partial<ResourcePackagePublicResources>
  dependencies?: readonly ResourcePackageDependency[]
  hostDependencies?: readonly ResourcePackageHostDependency[]
  outputPath?: string
}

export type ResourcePackageProjectBuildResult = ResourcePackageBuildResult & {
  blockPaths: readonly string[]
  resourcePaths: readonly string[]
}

function normalizeProjectPath(root: string, path: string): string {
  const normalizedRoot = root.replace(/[\\/]+$/, '').replace(/\\/g, '/')
  const normalizedPath = path.replace(/\\/g, '/')
  const rootIdentity = normalizedRoot.toLocaleLowerCase()
  if (normalizedPath.toLocaleLowerCase().startsWith(`${rootIdentity}/`)
    || normalizedPath.toLocaleLowerCase() === rootIdentity) return normalizedPath
  return `${normalizedRoot}/${normalizedPath.replace(/^\/+/, '')}`
}

function relativePath(root: string, path: string): string {
  const normalizedRoot = root.replace(/[\\/]+$/, '').replace(/\\/g, '/')
  const normalizedPath = path.replace(/\\/g, '/')
  return normalizedPath.toLocaleLowerCase().startsWith(`${normalizedRoot.toLocaleLowerCase()}/`)
    ? normalizedPath.slice(normalizedRoot.length + 1)
    : normalizedPath
}

function blockArchivePath(path: string, root: string): string {
  const relative = relativePath(root, path)
  if (relative.toLocaleLowerCase().startsWith('.opencard/blocks/')) return relative
  const fileName = relative.split('/').pop() ?? 'custom-block.ocblock'
  return `.opencard/blocks/${fileName.endsWith(PROJECT_CUSTOM_BLOCK_DEFINITION_SUFFIX) ? fileName : `${fileName}.ocblock`}`
}

export async function buildResourcePackageFromProject(
  options: ResourcePackageProjectBuildOptions,
): Promise<ResourcePackageProjectBuildResult> {
  const key = normalizeKeySlug(options.key)
  if (!key) throw new Error('Invalid resource package Key')
  const root = options.projectRootPath.replace(/[\\/]+$/, '')
  const selectedBlocks = [...new Set(options.blockPaths.map(path => normalizeProjectPath(root, path)))]
  if (selectedBlocks.length === 0) throw new Error('Select at least one custom block')
  const selectedResources = [...new Set((options.resourcePaths ?? []).map(path => normalizeProjectPath(root, path)))]
  const projectRelativePaths = [...selectedBlocks, ...selectedResources].map(path => relativePath(root, path).toLocaleLowerCase())
  if (projectRelativePaths.some(path => path === '.git' || path.startsWith('.git/'))) {
    throw new Error('Git metadata cannot be included in a resource package')
  }
  const files: ResourcePackageContentFile[] = []
  for (const path of selectedBlocks) {
    if (!await options.fs.fileExists(path)) throw new Error(`Selected custom block is missing: ${path}`)
    files.push({ path: blockArchivePath(path, root), bytes: await options.fs.readBinaryFile(path) })
  }
  for (const path of selectedResources) {
    if (!await options.fs.fileExists(path)) throw new Error(`Selected resource is missing: ${path}`)
    files.push({ path: relativePath(root, path), bytes: await options.fs.readBinaryFile(path) })
  }
  const registryPaths = [
    `${root}/.opencard/fonts/fonts.json`, `${root}/.opencard/icons/icons.json`, `${root}/.opencard/locale.json`,
  ]
  for (const path of registryPaths) {
    if (await options.fs.fileExists(path)) files.push({ path: relativePath(root, path), bytes: new TextEncoder().encode(await options.fs.readFile(path)) })
  }
  const result = await buildResourcePackageArchive({
    fs: options.fs,
    outputPath: options.outputPath,
    key, name: options.name, version: options.version, files,
    public: { blocks: selectedBlocks.map(path => blockArchivePath(path, root)), ...(options.public ?? {}) },
    dependencies: options.dependencies,
    hostDependencies: options.hostDependencies,
  })
  return { ...result, blockPaths: selectedBlocks, resourcePaths: selectedResources }
}
