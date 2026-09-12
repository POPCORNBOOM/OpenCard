import {
  type ResourcePackagePublicFont,
  type ResourcePackagePublicIconSeries,
} from '../model/resourcePackage'
import {
  parseProjectFontRegistryText,
  serializeProjectFontRegistry,
  type ProjectFont,
  type ProjectFontRegistryDocument,
} from '../model/projectFontRegistry'
import {
  parseProjectIconRegistryText,
  serializeProjectIconRegistry,
  type ProjectIconRegistryDocument,
} from '../model/projectIconRegistry'
import { PROJECT_FONT_REGISTRY_FILE_NAME, PROJECT_ICON_REGISTRY_FILE_NAME, PROJECT_PROFILE_FILE_NAME } from '../model/projectStructure'
import { isProjectCoverPath, resolveCoverAbsolutePath } from '../model/projectCover'
import { parseProjectMetadataText } from '../model/projectMetadata'
import type { FileSystemService } from './fileSystemService'
import { buildResourcePackageArchive, type ResourcePackageBuildResult } from './resourcePackageBuilder'
import type { ResourcePackageContentFile } from './resourcePackageHash'
import { normalizeKeySlug } from '../../../shared/model/keySlug'
import { resolveFileType } from '../model/fileTypes'
import { resolveResourcePath } from '../model/scopedResourcePath'
import type { ProjectIcon } from '../model/projectIcons'

export type ResourcePackageProjectBuildOptions = {
  fs: Pick<FileSystemService, 'readBinaryFile' | 'readFile' | 'fileExists' | 'writeBinaryFile'>
  projectRootPath: string
  key: string
  name: string
  version: string
  imageSelection?: {
    paths: readonly string[]
  }
  fontSelection?: {
    familyKeys: readonly string[]
    compositionKeys: readonly string[]
  }
  iconSelection?: {
    seriesKeys: readonly string[]
  }
  outputPath?: string
}

type ResourcePackageFontProjection = {
  document: ProjectFontRegistryDocument | null
  files: readonly ResourcePackageContentFile[]
  publicFonts: readonly ResourcePackagePublicFont[]
}

type ResourcePackageIconProjection = {
  document: ProjectIconRegistryDocument | null
  files: readonly ResourcePackageContentFile[]
  publicIconSeries: readonly ResourcePackagePublicIconSeries[]
}

export type ResourcePackageProjectBuildResult = ResourcePackageBuildResult & {
  imagePaths: readonly string[]
}

type ResourcePackageCoverProjection = {
  relativePath: string
  bytes: Uint8Array
}

/**
 * 包自动沿用项目封面；没有封面、封面缺失或不是图片时返回 null，绝不中断打包。
 */
async function buildCoverProjection(
  options: ResourcePackageProjectBuildOptions,
  root: string,
): Promise<ResourcePackageCoverProjection | null> {
  try {
    const profilePath = `${root}/${PROJECT_PROFILE_FILE_NAME}`
    if (!await options.fs.fileExists(profilePath)) return null
    const profile = parseProjectMetadataText(await options.fs.readFile(profilePath))
    const relativePath = profile?.cover
    if (!relativePath || !isProjectCoverPath(relativePath)) return null
    const absolutePath = resolveCoverAbsolutePath(root, relativePath)
    if (!await options.fs.fileExists(absolutePath)) return null
    return { relativePath, bytes: await options.fs.readBinaryFile(absolutePath) }
  } catch {
    return null
  }
}

function resolveSelectedImage(root: string, value: string): { absolutePath: string, relativePath: string } {
  const path = value.trim().replace(/\\/g, '/')
  const rootIdentity = root.toLocaleLowerCase()
  const pathIdentity = path.toLocaleLowerCase()
  const absolute = path.startsWith('/') || /^[a-z]:\//i.test(path)
  const relativePath = absolute
    ? pathIdentity.startsWith(`${rootIdentity}/`) ? path.slice(root.length + 1) : ''
    : path
  const segments = relativePath.split('/')
  const identity = relativePath.toLocaleLowerCase()
  if (!relativePath || /^[a-z]:/i.test(relativePath)
    || segments.some(segment => !segment || segment === '.' || segment === '..'
    || /[\u0000-\u001f\u007f]/.test(segment))) {
    throw new Error(`Selected image path is outside the project or unsafe: ${value}`)
  }
  if (identity === '.git' || identity.startsWith('.git/')
    || identity === '.opencard' || identity.startsWith('.opencard/')) {
    throw new Error(`Selected image path is managed or internal: ${value}`)
  }
  if (resolveFileType(relativePath, root).id !== 'image') {
    throw new Error(`Selected project file is not an image: ${value}`)
  }
  return { absolutePath: `${root}/${relativePath}`, relativePath }
}

function selectedImages(root: string, paths: readonly string[]): { absolutePath: string, relativePath: string }[] {
  const result = new Map<string, { absolutePath: string, relativePath: string }>()
  for (const path of paths) {
    const image = resolveSelectedImage(root, path)
    const identity = image.relativePath.toLocaleLowerCase()
    if (!result.has(identity)) result.set(identity, image)
  }
  return [...result.values()]
}

function selectedIdentities(keys: readonly string[]): Set<string> {
  return new Set(keys.map(key => key.toLocaleLowerCase()))
}

function allocateDependencyPath(
  directory: 'fonts' | 'icons',
  absolutePath: string,
  allocated: Map<string, string>,
): string {
  const identity = absolutePath.toLocaleLowerCase()
  const existing = allocated.get(identity)
  if (existing) return existing
  const fileName = absolutePath.replace(/\\/g, '/').split('/').pop() ?? 'resource'
  const dot = fileName.lastIndexOf('.')
  const stem = dot > 0 ? fileName.slice(0, dot) : fileName
  const extension = dot > 0 ? fileName.slice(dot) : ''
  const used = new Set(Array.from(allocated.values(), path => path.toLocaleLowerCase()))
  let candidate = `.opencard/${directory}/${fileName}`
  let suffix = 2
  while (used.has(candidate.toLocaleLowerCase())) {
    candidate = `.opencard/${directory}/${stem} (${suffix})${extension}`
    suffix += 1
  }
  allocated.set(identity, candidate)
  return candidate
}

async function buildFontProjection(
  options: ResourcePackageProjectBuildOptions,
  root: string,
): Promise<ResourcePackageFontProjection> {
  const publicFamilyKeys = selectedIdentities(options.fontSelection?.familyKeys ?? [])
  const selectedCompositionKeys = selectedIdentities(options.fontSelection?.compositionKeys ?? [])
  if (publicFamilyKeys.size === 0 && selectedCompositionKeys.size === 0) {
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

  for (const key of publicFamilyKeys) {
    if (!familiesByKey.has(key)) throw new Error(`Selected project font is unavailable: ${key}`)
  }
  const includedFamilyKeys = new Set(publicFamilyKeys)
  for (const key of selectedCompositionKeys) {
    const composition = compositionsByKey.get(key)
    if (!composition) throw new Error(`Selected font composition is unavailable: ${key}`)
    for (const member of composition.members) {
      const memberKey = member.fontKey.toLocaleLowerCase()
      if (!familiesByKey.has(memberKey)) {
        throw new Error(`Font composition ${composition.key} references unavailable project font: ${member.fontKey}`)
      }
      includedFamilyKeys.add(memberKey)
    }
  }

  const selectedFamilies = families.filter(family => includedFamilyKeys.has(family.key.toLocaleLowerCase()))
  const publicFamilies = selectedFamilies.filter(family => publicFamilyKeys.has(family.key.toLocaleLowerCase()))
  const selectedCompositions = compositions.filter(composition => selectedCompositionKeys.has(composition.key.toLocaleLowerCase()))
  const files = new Map<string, ResourcePackageContentFile>()
  const allocated = new Map<string, string>()
  const projectedFamilies: ProjectFont[] = []
  for (const family of selectedFamilies) {
    const projectedFiles: ProjectFont['files'] = {}
    for (const [weight, styles] of Object.entries(family.files)) {
      if (!styles) continue
      const projectedStyles: { upright?: string, italic?: string } = {}
      for (const style of ['upright', 'italic'] as const) {
        const source = styles[style]
        if (!source) continue
        const resolved = resolveResourcePath(root, registryPath, source)
        if (!resolved.ok) throw new Error(`Project font file path is invalid: ${source}`)
        if (!await options.fs.fileExists(resolved.value)) throw new Error(`Project font file is missing: ${source}`)
        const packagePath = allocateDependencyPath('fonts', resolved.value, allocated)
        projectedStyles[style] = packagePath
        const identity = packagePath.toLocaleLowerCase()
        if (!files.has(identity)) files.set(identity, {
          path: packagePath,
          bytes: await options.fs.readBinaryFile(resolved.value),
        })
      }
      projectedFiles[weight as keyof ProjectFont['files']] = projectedStyles
    }
    projectedFamilies.push({ ...family, files: projectedFiles })
  }
  const projectedDocument: ProjectFontRegistryDocument = {
    ...(projectedFamilies.length ? { families: projectedFamilies } : {}),
    ...(selectedCompositions.length ? { compositions: selectedCompositions } : {}),
  }
  files.set(PROJECT_FONT_REGISTRY_FILE_NAME.toLocaleLowerCase(), {
    path: PROJECT_FONT_REGISTRY_FILE_NAME,
    bytes: new TextEncoder().encode(serializeProjectFontRegistry(projectedDocument)),
  })
  return {
    document: projectedDocument,
    files: [...files.values()],
    publicFonts: [
      ...publicFamilies.map(family => ({ key: family.key, title: family.name })),
      ...selectedCompositions.map(composition => ({ key: composition.key, title: composition.name })),
    ],
  }
}

async function buildIconProjection(
  options: ResourcePackageProjectBuildOptions,
  root: string,
): Promise<ResourcePackageIconProjection> {
  const selectedSeriesKeys = selectedIdentities(options.iconSelection?.seriesKeys ?? [])
  if (selectedSeriesKeys.size === 0) return { document: null, files: [], publicIconSeries: [] }

  const registryPath = `${root}/${PROJECT_ICON_REGISTRY_FILE_NAME}`
  if (!await options.fs.fileExists(registryPath)) throw new Error('Project icon registry is missing')
  const document = parseProjectIconRegistryText(await options.fs.readFile(registryPath))
  if (!document) throw new Error('Project icon registry is invalid')
  const series = document.iconSeries ?? []
  const seriesByKey = new Map(series.map(entry => [entry.key.toLocaleLowerCase(), entry]))
  for (const key of selectedSeriesKeys) {
    if (!seriesByKey.has(key)) throw new Error(`Selected project icon series is unavailable: ${key}`)
  }

  const selectedSeries = series.filter(entry => selectedSeriesKeys.has(entry.key.toLocaleLowerCase()))
  const files = new Map<string, ResourcePackageContentFile>()
  const allocated = new Map<string, string>()
  const projectedSeries: typeof selectedSeries = []
  for (const entry of selectedSeries) {
    const icons: ProjectIcon[] = []
    for (const icon of entry.icons) {
      const resolved = resolveResourcePath(root, registryPath, icon.source)
      if (!resolved.ok) throw new Error(`Project icon path is invalid: ${icon.source}`)
      if (!await options.fs.fileExists(resolved.value)) {
        throw new Error(`Project icon file is missing: ${icon.source}`)
      }
      const packagePath = allocateDependencyPath('icons', resolved.value, allocated)
      icons.push({ ...icon, source: packagePath })
      const identity = packagePath.toLocaleLowerCase()
      if (!files.has(identity)) files.set(identity, {
        path: packagePath,
        bytes: await options.fs.readBinaryFile(resolved.value),
      })
    }
    projectedSeries.push({ ...entry, icons })
  }
  const projectedDocument: ProjectIconRegistryDocument = { iconSeries: projectedSeries }
  files.set(PROJECT_ICON_REGISTRY_FILE_NAME.toLocaleLowerCase(), {
    path: PROJECT_ICON_REGISTRY_FILE_NAME,
    bytes: new TextEncoder().encode(serializeProjectIconRegistry(projectedDocument)),
  })
  return {
    document: projectedDocument,
    files: [...files.values()],
    publicIconSeries: selectedSeries.map(entry => ({
      key: entry.key,
      title: entry.name,
      count: entry.icons.length,
    })),
  }
}

export async function buildResourcePackageFromProject(
  options: ResourcePackageProjectBuildOptions,
): Promise<ResourcePackageProjectBuildResult> {
  const key = normalizeKeySlug(options.key)
  if (!key) throw new Error('Invalid package Key')
  const root = options.projectRootPath.replace(/\\/g, '/').replace(/[\\/]+$/, '')
  if (!root) throw new Error('Project root path is required')
  const images = selectedImages(root, options.imageSelection?.paths ?? [])
  const fontProjection = await buildFontProjection(options, root)
  const iconProjection = await buildIconProjection(options, root)
  if (images.length === 0 && !fontProjection.document && !iconProjection.document) {
    throw new Error('Select at least one resource')
  }
  const files: ResourcePackageContentFile[] = [...fontProjection.files, ...iconProjection.files]
  for (const image of images) {
    if (!await options.fs.fileExists(image.absolutePath)) {
      throw new Error(`Selected project image is missing: ${image.relativePath}`)
    }
    files.push({ path: image.relativePath, bytes: await options.fs.readBinaryFile(image.absolutePath) })
  }
  const cover = await buildCoverProjection(options, root)
  if (cover && !files.some(file => file.path.toLocaleLowerCase() === cover.relativePath.toLocaleLowerCase())) {
    files.push({ path: cover.relativePath, bytes: cover.bytes })
  }
  const localePath = `${root}/.opencard/locale.json`
  if (await options.fs.fileExists(localePath)) {
    files.push({ path: '.opencard/locale.json', bytes: new TextEncoder().encode(await options.fs.readFile(localePath)) })
  }
  const result = await buildResourcePackageArchive({
    fs: options.fs,
    outputPath: options.outputPath,
    key, name: options.name, version: options.version, files,
    ...(cover ? { cover: cover.relativePath } : {}),
    public: {
      fonts: fontProjection.publicFonts,
      iconSeries: iconProjection.publicIconSeries,
    },
  })
  return { ...result, imagePaths: images.map(image => image.absolutePath) }
}
