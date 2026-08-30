import {
  type ResourcePackageDependency,
  type ResourcePackageHostDependency,
  type ResourcePackagePublicFont,
  type ResourcePackagePublicResources,
} from '../model/resourcePackage'
import {
  parseProjectFontRegistryText,
  projectFontSources,
  serializeProjectFontRegistry,
  type ProjectFontRegistryDocument,
} from '../model/projectFontRegistry'
import { PROJECT_FONT_REGISTRY_FILE_NAME } from '../model/projectStructure'
import type { FileSystemService } from './fileSystemService'
import { buildResourcePackageArchive, type ResourcePackageBuildResult } from './resourcePackageBuilder'
import type { ResourcePackageContentFile } from './resourcePackageHash'
import { normalizeKeySlug } from '../../../shared/model/keySlug'

export type ResourcePackageProjectBuildOptions = {
  fs: Pick<FileSystemService, 'readBinaryFile' | 'readFile' | 'fileExists' | 'writeBinaryFile'>
  projectRootPath: string
  key: string
  name: string
  version: string
  resourcePaths?: readonly string[]
  fontSelection?: {
    familyKeys: readonly string[]
    compositionKeys: readonly string[]
  }
  public?: Partial<ResourcePackagePublicResources>
  dependencies?: readonly ResourcePackageDependency[]
  hostDependencies?: readonly ResourcePackageHostDependency[]
  outputPath?: string
}

type ResourcePackageFontProjection = {
  document: ProjectFontRegistryDocument | null
  files: readonly ResourcePackageContentFile[]
  publicFonts: readonly ResourcePackagePublicFont[]
}

export type ResourcePackageProjectBuildResult = ResourcePackageBuildResult & {
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

function selectedIdentities(keys: readonly string[]): Set<string> {
  return new Set(keys.map(key => key.toLocaleLowerCase()))
}

async function buildFontProjection(
  options: ResourcePackageProjectBuildOptions,
  root: string,
): Promise<ResourcePackageFontProjection> {
  const selectedFamilyKeys = selectedIdentities(options.fontSelection?.familyKeys ?? [])
  const selectedCompositionKeys = selectedIdentities(options.fontSelection?.compositionKeys ?? [])
  if (selectedFamilyKeys.size === 0 && selectedCompositionKeys.size === 0) {
    return { document: null, files: [], publicFonts: [] }
  }

  const registryPath = `${root}/${PROJECT_FONT_REGISTRY_FILE_NAME}`
  if (!await options.fs.fileExists(registryPath)) throw new Error('Project font registry is missing')
  const document = parseProjectFontRegistryText(await options.fs.readFile(registryPath))
  if (!document) throw new Error('Project font registry is invalid')
  const families = document.families ?? []
  const compositions = document.compositions ?? []
  const familiesByKey = new Map(families.map(family => [family.key.toLocaleLowerCase(), family]))
  const compositionsByKey = new Map(compositions.map(composition => [composition.key.toLocaleLowerCase(), composition]))

  for (const key of selectedFamilyKeys) {
    if (!familiesByKey.has(key)) throw new Error(`Selected project font is unavailable: ${key}`)
  }
  for (const key of selectedCompositionKeys) {
    const composition = compositionsByKey.get(key)
    if (!composition) throw new Error(`Selected font composition is unavailable: ${key}`)
    for (const member of composition.members) {
      const memberKey = member.fontKey.toLocaleLowerCase()
      if (!familiesByKey.has(memberKey)) {
        throw new Error(`Font composition ${composition.key} references unavailable project font: ${member.fontKey}`)
      }
      selectedFamilyKeys.add(memberKey)
    }
  }

  const selectedFamilies = families.filter(family => selectedFamilyKeys.has(family.key.toLocaleLowerCase()))
  const selectedCompositions = compositions.filter(composition => selectedCompositionKeys.has(composition.key.toLocaleLowerCase()))
  const projectedDocument: ProjectFontRegistryDocument = {
    ...(selectedFamilies.length ? { families: selectedFamilies } : {}),
    ...(selectedCompositions.length ? { compositions: selectedCompositions } : {}),
  }
  const files = new Map<string, ResourcePackageContentFile>()
  for (const family of selectedFamilies) {
    for (const source of projectFontSources(family)) {
      const sourcePath = `${root}/.opencard/${source}`
      if (!await options.fs.fileExists(sourcePath)) {
        throw new Error(`Project font file is missing: ${source}`)
      }
      const packagePath = `.opencard/${source}`
      const identity = packagePath.toLocaleLowerCase()
      if (!files.has(identity)) files.set(identity, {
        path: packagePath,
        bytes: await options.fs.readBinaryFile(sourcePath),
      })
    }
  }
  files.set(PROJECT_FONT_REGISTRY_FILE_NAME.toLocaleLowerCase(), {
    path: PROJECT_FONT_REGISTRY_FILE_NAME,
    bytes: new TextEncoder().encode(serializeProjectFontRegistry(projectedDocument)),
  })
  return {
    document: projectedDocument,
    files: [...files.values()],
    publicFonts: [
      ...selectedFamilies.map(family => ({ key: family.key, title: family.name })),
      ...selectedCompositions.map(composition => ({ key: composition.key, title: composition.name })),
    ],
  }
}

export async function buildResourcePackageFromProject(
  options: ResourcePackageProjectBuildOptions,
): Promise<ResourcePackageProjectBuildResult> {
  const key = normalizeKeySlug(options.key)
  if (!key) throw new Error('Invalid resource package Key')
  const root = options.projectRootPath.replace(/[\\/]+$/, '')
  const selectedResources = [...new Set((options.resourcePaths ?? []).map(path => normalizeProjectPath(root, path)))]
  const fontProjection = await buildFontProjection(options, root)
  if (selectedResources.length === 0 && !fontProjection.document) throw new Error('Select at least one resource')
  const projectRelativePaths = selectedResources.map(path => relativePath(root, path).toLocaleLowerCase())
  if (projectRelativePaths.some(path => path === '.git' || path.startsWith('.git/'))) {
    throw new Error('Git metadata cannot be included in a resource package')
  }
  const files: ResourcePackageContentFile[] = [...fontProjection.files]
  for (const path of selectedResources) {
    if (!await options.fs.fileExists(path)) throw new Error(`Selected resource is missing: ${path}`)
    files.push({ path: relativePath(root, path), bytes: await options.fs.readBinaryFile(path) })
  }
  const registryPaths = [
    `${root}/.opencard/icons/icons.json`, `${root}/.opencard/locale.json`,
  ]
  for (const path of registryPaths) {
    if (await options.fs.fileExists(path)) files.push({ path: relativePath(root, path), bytes: new TextEncoder().encode(await options.fs.readFile(path)) })
  }
  const result = await buildResourcePackageArchive({
    fs: options.fs,
    outputPath: options.outputPath,
    key, name: options.name, version: options.version, files,
    public: { ...options.public, fonts: fontProjection.publicFonts },
    dependencies: options.dependencies,
    hostDependencies: options.hostDependencies,
  })
  return { ...result, resourcePaths: selectedResources }
}
