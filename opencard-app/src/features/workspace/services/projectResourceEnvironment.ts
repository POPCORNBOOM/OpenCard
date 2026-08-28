import {
  compareProjectPackageManifest,
  normalizeProjectPackageManifest,
  type ProjectPackageDifference,
  type ProjectPackageManifest,
} from '../model/projectPackageManifest'
import { parseResourceReferenceList } from './resourceReference'
import type { ResourcePackageManifest, ResourcePackageManifestIssue } from '../model/resourcePackage'
import { normalizeResourcePackageManifest } from '../model/resourcePackage'
import { convertFileSrc } from '@tauri-apps/api/core'
import type { ProjectRemoteResourcePolicy } from '../model/projectMetadata'
import type { ProjectFontRegistry, ProjectFontRegistryDocument } from '../model/projectFontRegistry'
import { buildProjectFontRegistry, parseProjectFontRegistryText } from '../model/projectFontRegistry'
import type { ProjectIconRegistryDocument } from '../model/projectIconRegistry'
import { parseProjectIconRegistryText } from '../model/projectIconRegistry'
import type { ProjectIconCatalog, ProjectImageDimensionLoader } from './projectIconCatalog'
import { buildProjectIconCatalog, EMPTY_PROJECT_ICON_CATALOG } from './projectIconCatalog'
import type { FileSystemService } from './fileSystemService'
import { isRemoteResourceAllowed } from '../../editor-runtime/services/editorResource'

export type ProjectResourceScopeKind = 'project' | 'package'

export type ProjectResourceAccessPolicy = {
  readonly mode: 'allow-list'
  readonly assetPaths: ReadonlySet<string>
  readonly fontFiles: ReadonlyMap<string, ReadonlySet<string>>
  readonly icons: ReadonlyMap<string, ReadonlySet<string>>
  readonly packageIds: ReadonlySet<string>
}

export type ProjectResourcePackage = {
  readonly manifest: ResourcePackageManifest
  readonly rootPath: string
  readonly issues: readonly ResourcePackageManifestIssue[]
  readonly unavailable?: boolean
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
  readonly packageManifest?: ProjectPackageManifest
  readonly packageDifferences?: readonly ProjectPackageDifference[]
  readonly packageEnvironments?: ReadonlyMap<string, ProjectResourceEnvironment>
  readonly issues: readonly ProjectResourceEnvironmentIssue[]
  readonly accessPolicy?: ProjectResourceAccessPolicy
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

export function normalizeProjectResourcePath(value: string): string | null {
  const path = value.trim().replace(/\\/g, '/').replace(/^\.\//, '')
  if (!path || path.startsWith('/') || /^[a-z]:\//i.test(path) || path.startsWith('//')) return null
  const segments = path.split('/')
  if (segments.some(segment => !segment || segment === '.' || segment === '..'
    || /[\u0000-\u001f\u007f]/.test(segment))) return null
  return path
}

export function resolveProjectResourceFilePath(
  environment: Pick<ProjectResourceEnvironment, 'rootPath'>,
  source: string,
): string | null {
  const relative = normalizeProjectResourcePath(source)
  if (!environment.rootPath || !relative) return null
  return `${environment.rootPath.replace(/[\\/]+$/, '')}/${relative}`
}

export function resolveProjectInternalResourceFilePath(
  environment: Pick<ProjectResourceEnvironment, 'rootPath'>,
  source: string,
): string | null {
  const relative = normalizeProjectResourcePath(source)
  if (!environment.rootPath || !relative) return null
  return `${environment.rootPath.replace(/[\\/]+$/, '')}/.opencard/${relative}`
}

export function resolveProjectEnvironmentAssetSrc(
  source: string,
  environment: Pick<ProjectResourceEnvironment, 'rootPath' | 'accessPolicy'>,
  remoteResourcePolicy?: ProjectRemoteResourcePolicy,
): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(source) && !/^[a-z]:[\\/]/i.test(source)) {
    return isRemoteResourceAllowed(source, remoteResourcePolicy) ? source : ''
  }
  const relative = normalizeProjectResourcePath(source)
  if (!relative) return ''
  const allowed = environment.accessPolicy?.mode !== 'allow-list'
    || environment.accessPolicy.assetPaths.has(relative.toLocaleLowerCase())
  if (!allowed) return ''
  const path = resolveProjectResourceFilePath(environment, relative)
  return path ? convertFileSrc(path) : ''
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
    if (!entry.isDirectory || entry.isSymlink || entry.name.includes('/')) continue
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
      issues,
      ...(issues.length > 0 ? { unavailable: true } : {}),
    })
  }
  return packages
}


export async function loadProjectResourceEnvironment(options: {
  fs: Pick<FileSystemService, 'fileExists' | 'readFile'> & Partial<Pick<FileSystemService, 'readDirectoryEntries'>>
  rootPath: string | null
  kind: ProjectResourceScopeKind
  identity: string
  generation?: number
  loadDimensions?: ProjectImageDimensionLoader
  loadPackageEnvironments?: boolean
}): Promise<ProjectResourceEnvironment> {
  const namespace = createProjectResourceNamespace(options.kind, options.identity)
  const issues: ProjectResourceEnvironmentIssue[] = []
  const root = options.rootPath?.replace(/[\\/]+$/, '') ?? null
  let fontDocument: ProjectFontRegistryDocument = {}
  let iconDocument: ProjectIconRegistryDocument = {}

  if (root) {
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
    iconCatalog = await buildProjectIconCatalog(
      iconDocument.iconSeries,
      source => {
        const path = resolveProjectInternalResourceFilePath({ rootPath: root }, source)
        return path ? convertFileSrc(path) : ''
      },
      options.loadDimensions,
    )
    for (const error of iconCatalog.errors) {
      issues.push({ resource: 'icons', path: error.source, message: error.reason })
    }
  }
  let packageManifest: ProjectPackageManifest | undefined
  if (root) {
    const packageManifestPath = `${root}/.opencard/packages/packages.json`
    if (await options.fs.fileExists(packageManifestPath)) {
      try {
        packageManifest = normalizeProjectPackageManifest(JSON.parse(await options.fs.readFile(packageManifestPath))).manifest
      } catch (cause) {
        issues.push({ resource: 'packages', path: packageManifestPath, message: cause instanceof Error ? cause.message : String(cause) })
      }
    }
  }
  const packages = root ? await discoverProjectResourcePackages({ fs: options.fs, root }) : new Map()
  const installedPackageVersions = new Map([...packages].map(([key, pkg]) => [key, { version: pkg.manifest.version }]))
  const packageDifferences = packageManifest
    ? compareProjectPackageManifest(packageManifest, installedPackageVersions)
    : []
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
        kind: 'package',
        identity: pkg.manifest.key,
        generation: options.generation,
        loadDimensions: options.loadDimensions,
        loadPackageEnvironments: false,
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
    packageManifest,
    packageDifferences,
    packageEnvironments,
    issues,
  }
}
