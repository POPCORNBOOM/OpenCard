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
import type { CustomBlockRuntimeCatalog } from '../../card-rendering/expandCustomBlocks'

export type ProjectResourceScopeKind = 'project' | 'package'

export type ProjectResourceEnvironment = {
  readonly kind: ProjectResourceScopeKind
  readonly namespace: string
  readonly rootPath: string | null
  readonly fontDocument: ProjectFontRegistryDocument
  readonly fonts: ProjectFontRegistry
  readonly iconDocument: ProjectIconRegistryDocument
  readonly iconCatalog: ProjectIconCatalog
  readonly issues: readonly ProjectResourceEnvironmentIssue[]
  readonly customBlockCatalog?: CustomBlockRuntimeCatalog
}

export type ProjectResourceEnvironmentIssue = {
  resource: 'fonts' | 'icons'
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
  environment: Pick<ProjectResourceEnvironment, 'rootPath'>,
  remoteResourcePolicy?: ProjectRemoteResourcePolicy,
): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(source) && !/^[a-z]:[\\/]/i.test(source)) {
    return isRemoteResourceAllowed(source, remoteResourcePolicy) ? source : ''
  }
  const path = resolveProjectResourceFilePath(environment, source)
  return path ? convertFileSrc(path) : ''
}

export function resolveProjectEnvironmentFontFamily(
  references: string,
  environment: ProjectResourceEnvironment,
  projectFallback: (references: string) => string,
): string {
  if (environment.kind === 'project') return projectFallback(references)
  return references.split(';').map(candidate => {
    const value = candidate.trim()
    if (!value.toLocaleLowerCase().startsWith('font:')) return value
    const key = value.slice('font:'.length)
    const entry = Object.entries(environment.fonts).find(([candidateKey]) => (
      candidateKey.toLocaleLowerCase() === key.toLocaleLowerCase()
    ))?.[1]
    return entry ? JSON.stringify(createScopedProjectFontFamily(environment.namespace, key)) : ''
  }).filter(Boolean).join(', ')
}

export async function loadProjectResourceEnvironment(options: {
  fs: Pick<FileSystemService, 'fileExists' | 'readFile'>
  rootPath: string | null
  kind: ProjectResourceScopeKind
  identity: string
  loadDimensions?: ProjectImageDimensionLoader
}): Promise<ProjectResourceEnvironment> {
  const namespace = createProjectResourceNamespace(options.kind, options.identity)
  const issues: ProjectResourceEnvironmentIssue[] = []
  const root = options.rootPath?.replace(/[\\/]+$/, '') ?? null
  let fontDocument: ProjectFontRegistryDocument = {}
  let iconDocument: ProjectIconRegistryDocument = {}

  if (root) {
    const fontPath = `${root}/.opencard/.ocfonts`
    if (await options.fs.fileExists(fontPath)) {
      try {
        const parsed = parseProjectFontRegistryText(await options.fs.readFile(fontPath))
        if (parsed) fontDocument = parsed
        else issues.push({ resource: 'fonts', path: fontPath, message: 'Invalid font registry was ignored' })
      } catch (cause) {
        issues.push({ resource: 'fonts', path: fontPath, message: cause instanceof Error ? cause.message : String(cause) })
      }
    }

    const iconPath = `${root}/.opencard/.ocicons`
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

  return {
    kind: options.kind,
    namespace,
    rootPath: root,
    fontDocument,
    fonts: buildProjectFontRegistry(fontDocument),
    iconDocument,
    iconCatalog,
    issues,
  }
}
