import {
  normalizeProjectPackageManifest,
  type RequiredPackage,
  type ProjectPackageManifest,
} from '../model/projectPackageManifest'
import { parseResourceReferenceList } from './resourceReference'
import type { ResourcePackageManifest, ResourcePackageManifestIssue } from '../model/resourcePackage'
import { normalizeResourcePackageManifest } from '../model/resourcePackage'
import { convertFileSrc } from '@tauri-apps/api/core'
import type { ProjectFontRegistry, ProjectFontRegistryDocument } from '../model/projectFontRegistry'
import { buildProjectFontRegistry, parseProjectFontRegistryText } from '../model/projectFontRegistry'
import type { ProjectIconRegistryDocument } from '../model/projectIconRegistry'
import { parseProjectIconRegistryText } from '../model/projectIconRegistry'
import type { ProjectIconCatalog, ProjectImageDimensionLoader } from './projectIconCatalog'
import { buildProjectIconCatalog, EMPTY_PROJECT_ICON_CATALOG } from './projectIconCatalog'
import type { FileSystemService } from './fileSystemService'
import { recoverResourcePackageTransactions } from './resourcePackageInstaller'
import { resolveProjectCover } from './projectCoverService'
import type { ProjectCover } from '../model/projectCover'
import { resolveResourcePath } from '../model/scopedResourcePath'

export type ProjectResourceScopeKind = 'project' | 'package'

export type ProjectResourcePackage = {
  readonly manifest: ResourcePackageManifest
  readonly rootPath: string
  /** 包封面：清单声明且文件存在时才有值。 */
  readonly cover: ProjectCover | null
  readonly issues: readonly ResourcePackageManifestIssue[]
  readonly unavailable?: boolean
  readonly required?: RequiredPackage
  readonly requirementStatus?: 'ok' | 'missing' | 'version'
}

export type ProjectResourcePackageCatalog = ReadonlyMap<string, ProjectResourcePackage>

export type ProjectResourceEnvironment = {
  readonly kind: ProjectResourceScopeKind
  readonly namespace: string
  readonly rootPath: string | null
  readonly generation?: number
  readonly fontDocument: ProjectFontRegistryDocument
  readonly fonts: ProjectFontRegistry
  readonly iconDocument: ProjectIconRegistryDocument
  readonly iconCatalog: ProjectIconCatalog
  readonly packages?: ProjectResourcePackageCatalog
  readonly packageIndex?: ProjectPackageManifest
  readonly packageEnvironments?: ReadonlyMap<string, ProjectResourceEnvironment>
  readonly issues: readonly ProjectResourceEnvironmentIssue[]
}

export type ProjectResourceEnvironmentIssue = {
  resource: 'fonts' | 'icons' | 'packages'
  path: string
  message: string
}

export type ProjectResourceScopeMap = ReadonlyMap<string, ProjectResourceEnvironment>

export function projectResourceScopeIdentity(blockId: string, fieldKey: string): string {
  return `${blockId}\u0000${fieldKey}`
}

export function createProjectResourceNamespace(kind: ProjectResourceScopeKind, identity: string): string {
  const normalized = identity.toLocaleLowerCase().replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-').replace(/^-|-$/g, '') || 'root'
  return `${kind}-${normalized}`
}

export function createScopedProjectFontFamily(namespace: string, fontKey: string): string {
  return `OpenCardResource-${namespace}-${fontKey}`
}

export function resolveProjectEnvironmentFontFamily(
  references: string,
  environment: ProjectResourceEnvironment,
  projectFallback: (references: string) => string,
): string {
  if (environment.kind === 'project') return projectFallback(references)
  return parseResourceReferenceList(references, 'font').map(token => {
    if (token.diagnostics.length > 0) return ''
    if (!token.reference) return token.source
    if (token.reference.scope !== 'current') return ''
    const key = token.reference.key
    const entry = Object.entries(environment.fonts).find(([candidateKey]) => (
      candidateKey.toLocaleLowerCase() === key.toLocaleLowerCase()
    ))?.[1]
    return entry ? JSON.stringify(createScopedProjectFontFamily(environment.namespace, key)) : ''
  }).filter(Boolean).join(', ')
}

async function discoverProjectResourcePackages(options: {
  fs: Pick<FileSystemService, 'fileExists' | 'readFile'> & Partial<Pick<FileSystemService, 'readDirectoryEntries'>>
  root: string
}): Promise<ProjectResourcePackageCatalog> {
  if (!options.fs.readDirectoryEntries) return new Map()
  const packagesRoot = `${options.root}/.opencard/packages`
  if (!await options.fs.fileExists(packagesRoot)) return new Map()
  const entries = await options.fs.readDirectoryEntries(packagesRoot, 1)
  const packages = new Map<string, ProjectResourcePackage>()
  for (const entry of entries) {
    if (!entry.isDirectory || entry.isSymlink || entry.name.includes('/') || /\.(?:install|backup)-\d+$/.test(entry.name)) continue
    const key = entry.name.trim().toLocaleLowerCase()
    if (!key || packages.has(key)) continue
    const packageRoot = `${packagesRoot}/${entry.name}`
    const manifestPath = `${packageRoot}/.opencard/manifest.json`
    const issues: ResourcePackageManifestIssue[] = []
    let manifest: ResourcePackageManifest
    try {
      const content = await options.fs.fileExists(manifestPath) ? await options.fs.readFile(manifestPath) : undefined
      if (content === undefined) throw new Error('Package manifest is missing')
      const normalized = normalizeResourcePackageManifest(JSON.parse(content), key)
      manifest = normalized.manifest
      issues.push(...normalized.issues)
      if (manifest.key.toLocaleLowerCase() !== key) issues.push({ path: 'key', message: 'Package Key does not match its directory name' })
    } catch (cause) {
      manifest = normalizeResourcePackageManifest({}, key).manifest
      issues.push({ path: manifestPath, message: cause instanceof Error ? cause.message : String(cause) })
    }
    packages.set(key, {
      manifest: manifest.key.toLocaleLowerCase() === key ? manifest : { ...manifest, key },
      rootPath: packageRoot,
      cover: await resolveProjectCover({ fs: options.fs, rootPath: packageRoot, relativePath: manifest.cover }),
      issues,
      ...(issues.length > 0 ? { unavailable: true } : {}),
    })
  }
  return packages
}


export async function loadProjectResourceEnvironment(options: {
  fs: Pick<FileSystemService, 'fileExists' | 'readFile'> & Partial<Pick<FileSystemService, 'readDirectoryEntries'>>
  rootPath: string | null
  projectRootPath?: string | null
  kind: ProjectResourceScopeKind
  identity: string
  generation?: number
  loadDimensions?: ProjectImageDimensionLoader
  loadPackageEnvironments?: boolean
}): Promise<ProjectResourceEnvironment> {
  const namespace = createProjectResourceNamespace(options.kind, options.identity)
  const issues: ProjectResourceEnvironmentIssue[] = []
  const root = options.rootPath?.replace(/[\\/]+$/, '') ?? null
  const projectRoot = options.projectRootPath?.replace(/[\\/]+$/, '') ?? root
  let fontDocument: ProjectFontRegistryDocument = {}
  let iconDocument: ProjectIconRegistryDocument = {}

  if (root) {
    try {
      await recoverResourcePackageTransactions(root)
    } catch (cause) {
      issues.push({ resource: 'packages', path: `${root}/.opencard/packages`, message: cause instanceof Error ? cause.message : String(cause) })
    }
    const fontPath = `${root}/.opencard/fonts/fonts.json`
    if (await options.fs.fileExists(fontPath)) {
      try {
        const parsed = parseProjectFontRegistryText(await options.fs.readFile(fontPath))
        if (parsed) fontDocument = parsed
        else issues.push({ resource: 'fonts', path: fontPath, message: 'Invalid font registry was ignored' })
      } catch (cause) {
        issues.push({ resource: 'fonts', path: fontPath, message: cause instanceof Error ? cause.message : String(cause) })
      }
    }

    const iconPath = `${root}/.opencard/icons/icons.json`
    if (await options.fs.fileExists(iconPath)) {
      try {
        const parsed = parseProjectIconRegistryText(await options.fs.readFile(iconPath))
        if (parsed) iconDocument = parsed
        else issues.push({ resource: 'icons', path: iconPath, message: 'Invalid icon registry was ignored' })
      } catch (cause) {
        issues.push({ resource: 'icons', path: iconPath, message: cause instanceof Error ? cause.message : String(cause) })
      }
    }
  }

  let iconCatalog = EMPTY_PROJECT_ICON_CATALOG
  if (root && (iconDocument.iconSeries?.length ?? 0) > 0) {
    const iconRegistryPath = `${root}/.opencard/icons/icons.json`
    iconCatalog = await buildProjectIconCatalog(
      iconDocument.iconSeries,
      source => {
        const path = projectRoot ? resolveResourcePath(projectRoot, iconRegistryPath, source) : null
        return path?.ok ? convertFileSrc(path.value) : ''
      },
      options.loadDimensions,
    )
    for (const error of iconCatalog.errors) {
      issues.push({ resource: 'icons', path: error.source, message: error.reason })
    }
  }
  let packageIndex: ProjectPackageManifest | undefined
  if (root) {
    const packageManifestPath = `${root}/.opencard/packages/packages.json`
    if (await options.fs.fileExists(packageManifestPath)) {
      try {
        const normalized = normalizeProjectPackageManifest(JSON.parse(await options.fs.readFile(packageManifestPath)))
        packageIndex = normalized.manifest
        for (const issue of normalized.issues) issues.push({ resource: 'packages', path: `${packageManifestPath}#${issue.path}`, message: issue.message })
      } catch (cause) {
        issues.push({ resource: 'packages', path: packageManifestPath, message: cause instanceof Error ? cause.message : String(cause) })
      }
    }
  }
  const packages = new Map(root ? await discoverProjectResourcePackages({ fs: options.fs, root }) : [])
  for (const [key, required] of Object.entries(packageIndex?.packages ?? {})) {
    const pkg = packages.get(key)
    if (!pkg) continue
    const requirementStatus = pkg.manifest.version !== required.version ? 'version' : 'ok'
    packages.set(key, { ...pkg, required, requirementStatus })
  }
  for (const [, pkg] of packages) {
    for (const issue of pkg.issues) {
      issues.push({ resource: 'packages', path: `${pkg.rootPath}/.opencard/manifest.json#${issue.path}`, message: issue.message })
    }
    if (pkg.unavailable) issues.push({ resource: 'packages', path: pkg.rootPath, message: 'Package is unavailable' })
  }
  const packageEnvironments = new Map<string, ProjectResourceEnvironment>()
  if (options.loadPackageEnvironments !== false) {
    for (const [key, pkg] of packages) {
      if (pkg.unavailable) continue
      packageEnvironments.set(key, await loadProjectResourceEnvironment({
        fs: options.fs,
        rootPath: pkg.rootPath,
        projectRootPath: projectRoot,
        kind: 'package',
        identity: pkg.manifest.key,
        generation: options.generation,
        loadDimensions: options.loadDimensions,
        loadPackageEnvironments: true,
      }))
    }
  }
  return {
    kind: options.kind,
    namespace,
    rootPath: root,
    generation: options.generation ?? 0,
    fontDocument,
    fonts: buildProjectFontRegistry(fontDocument),
    iconDocument,
    iconCatalog,
    packages,
    packageIndex,
    packageEnvironments,
    issues,
  }
}
