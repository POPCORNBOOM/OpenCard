import type { ProjectRemoteResourcePolicy } from '../workspace/model/projectMetadata'
import {
  EMPTY_PROJECT_ICON_CATALOG,
  type ProjectIconCatalog,
} from '../workspace/services/projectIconCatalog'
import type { ProjectInformation } from '../workspace/model/projectMetadata'
import type { PreparedRichTextCatalog } from './prepareRichText'
import {
  createProjectResourceNamespace,
  createScopedProjectFontFamily,
  projectResourceScopeIdentity,
  type ProjectResourceEnvironment,
  type ProjectResourceScopeMap,
} from '../workspace/services/projectResourceEnvironment'
import {
  parseResourceReference,
  parseResourceReferenceList,
  resolveResourceReferenceText,
  type ResourceReferenceResolutionOptions,
} from '../workspace/services/resourceReference'
import type { ProjectFontRegistryEntry } from '../workspace/model/projectFontRegistry'
import { toCssFontFamily } from '../workspace/model/projectFonts'
import { convertFileSrc } from '@tauri-apps/api/core'
import { isRemoteResourceAllowed } from '../editor-runtime/services/editorResource'
import { resolveResourcePath } from '../workspace/model/scopedResourcePath'

export type CardRenderResourceContext = {
  readonly resourceRootPath: string | null
  readonly sourceFilePath: string | null
  readonly hostEnvironment: ProjectResourceEnvironment
  readonly remoteResourcePolicy?: ProjectRemoteResourcePolicy
  readonly resolveRemoteResource?: (url: string) => string | null
  readonly projectIconCatalog: ProjectIconCatalog
  readonly resourceScopes: ProjectResourceScopeMap
  readonly packageEnvironments: ReadonlyMap<string, ProjectResourceEnvironment>
  readonly richText?: PreparedRichTextCatalog
  readonly resolveFontFamily?: (references: string) => string
  readonly bindingProject?: Readonly<ProjectInformation> | null
  readonly bindingDictionary?: Readonly<Record<string, string>> | null
}

export type CardRenderResourceContextSource = CardRenderResourceContext | (() => CardRenderResourceContext)
export type CardRenderResourceScopeSource = ProjectResourceScopeMap | (() => ProjectResourceScopeMap)

export type ResolvedImageSource =
  | { kind: 'empty' }
  | { kind: 'image', src: string }
  | { kind: 'icon', entry: ProjectIconCatalog['entries'][number] }
  | { kind: 'unavailable' }

export interface CardResourceResolver {
  readonly hostEnvironment: ProjectResourceEnvironment
  resolveAsset: (source: string, blockId?: string, fieldKey?: string) => string
  resolveImageSource: (source: string, blockId?: string, fieldKey?: string) => ResolvedImageSource
  resolveFont: (value: string, blockId?: string, fieldKey?: string) => string
  resolveIcon: (source: string, blockId?: string, fieldKey?: string) => ProjectIconCatalog['entries'][number] | null
  withScopes: (scopes: CardRenderResourceScopeSource) => CardResourceResolver
}

function readSource<T>(source: T | (() => T)): T {
  return typeof source === 'function' ? (source as () => T)() : source
}

export function createCardResourceResolver(
  contextSource: CardRenderResourceContextSource,
  scopeSources: readonly CardRenderResourceScopeSource[] = [],
): CardResourceResolver {
  function context(): CardRenderResourceContext {
    const base = readSource(contextSource)
    if (scopeSources.length === 0) return base
    return {
      ...base,
      resourceScopes: new Map([
        ...base.resourceScopes,
        ...scopeSources.flatMap(source => [...readSource(source)]),
      ]),
    }
  }

  return {
    get hostEnvironment() { return context().hostEnvironment },
    resolveAsset: (source, blockId, fieldKey) => resolveCardAssetSrc(source, context(), blockId, fieldKey),
    resolveImageSource: (source, blockId, fieldKey) => resolveCardImageSource(source, context(), blockId, fieldKey),
    resolveFont: (value, blockId, fieldKey) => resolveCardFontFamily(value, context(), blockId, fieldKey),
    resolveIcon: (source, blockId, fieldKey) => resolveCardIconReference(source, context(), blockId, fieldKey),
    withScopes: scopes => createCardResourceResolver(contextSource, [...scopeSources, scopes]),
  }
}

export function resolveCardImageSource(
  source: string,
  context: CardRenderResourceContext,
  blockId?: string,
  fieldKey = 'source',
): ResolvedImageSource {
  const value = source.trim()
  if (!value) return { kind: 'empty' }

  const parsed = parseResourceReference(value)
  if (parsed.reference?.kind === 'icon') {
    const entry = resolveCardIconReference(value, context, blockId, fieldKey)
    return entry ? { kind: 'icon', entry } : { kind: 'unavailable' }
  }
  if (parsed.reference) return { kind: 'unavailable' }
  if (/^(?:[a-z0-9._-]+@|@)?(?:font|icon):/i.test(value)) return { kind: 'unavailable' }

  const src = resolveCardAssetSrc(value, context, blockId, fieldKey)
  return src ? { kind: 'image', src } : { kind: 'unavailable' }
}

function fallbackEnvironment(
  resourceRootPath: string | null,
  projectIconCatalog: ProjectIconCatalog,
): ProjectResourceEnvironment {
  return {
    kind: 'project',
    namespace: createProjectResourceNamespace('project', resourceRootPath ?? 'root'),
    rootPath: resourceRootPath,
    generation: 0,
    fontDocument: {},
    fonts: {},
    iconDocument: {},
    iconCatalog: projectIconCatalog,
    packages: new Map(),
    issues: [],
  }
}

export function createCardRenderResourceContext(options: {
  resourceRootPath?: string | null
  sourceFilePath?: string | null
  hostEnvironment?: ProjectResourceEnvironment
  remoteResourcePolicy?: ProjectRemoteResourcePolicy
  resolveRemoteResource?: (url: string) => string | null
  projectIconCatalog?: ProjectIconCatalog
  resourceScopes?: ProjectResourceScopeMap
  packageEnvironments?: ReadonlyMap<string, ProjectResourceEnvironment>
  richText?: PreparedRichTextCatalog
  resolveFontFamily?: (references: string) => string
  bindingProject?: Readonly<ProjectInformation> | null
  bindingDictionary?: Readonly<Record<string, string>> | null
}): CardRenderResourceContext {
  const projectIconCatalog = options.projectIconCatalog ?? options.hostEnvironment?.iconCatalog
    ?? EMPTY_PROJECT_ICON_CATALOG
  const resourceRootPath = options.resourceRootPath ?? options.hostEnvironment?.rootPath ?? null
  const sourceFilePath = options.sourceFilePath && resourceRootPath
    && !/^[a-z]:[\\/]/i.test(options.sourceFilePath) && !options.sourceFilePath.startsWith('/')
    ? `${resourceRootPath.replace(/[\\/]+$/, '')}/${options.sourceFilePath.replace(/^[\\/]+/, '')}`
    : options.sourceFilePath ?? null
  return {
    resourceRootPath,
    sourceFilePath,
    hostEnvironment: options.hostEnvironment
      ?? fallbackEnvironment(options.resourceRootPath ?? null, projectIconCatalog),
    remoteResourcePolicy: options.remoteResourcePolicy,
    resolveRemoteResource: options.resolveRemoteResource,
    projectIconCatalog,
    resourceScopes: options.resourceScopes ?? new Map(),
    packageEnvironments: options.packageEnvironments ?? new Map(),
    richText: options.richText ?? new Map(),
    resolveFontFamily: options.resolveFontFamily,
    bindingProject: options.bindingProject,
    bindingDictionary: options.bindingDictionary,
  }
}

export function resolveCardResourceEnvironment(
  context: CardRenderResourceContext,
  blockId?: string,
  fieldKey?: string,
): ProjectResourceEnvironment {
  return blockId && fieldKey
    ? context.resourceScopes.get(projectResourceScopeIdentity(blockId, fieldKey)) ?? context.hostEnvironment
    : context.hostEnvironment
}

export function resolveCardAssetSrc(
  source: string,
  context: CardRenderResourceContext,
  blockId?: string,
  fieldKey = 'source',
  ): string {
  const environment = resolveCardResourceEnvironment(context, blockId, fieldKey)
  const value = source.trim()
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^[a-z]:[\\/]/i.test(value)) {
    if (!isRemoteResourceAllowed(value, context.remoteResourcePolicy)) return ''
    return context.resolveRemoteResource?.(value) ?? value
  }
  const projectRootPath = context.resourceRootPath ?? context.hostEnvironment.rootPath ?? environment.rootPath
  if (!projectRootPath) return ''
  const sourceFilePath = resolveAssetScopeSourceFile(context, environment, projectRootPath)
  const resolved = resolveResourcePath(projectRootPath, sourceFilePath, value)
  return resolved.ok ? convertFileSrc(resolved.value) : ''
}

function resolveAssetScopeSourceFile(
  context: CardRenderResourceContext,
  environment: ProjectResourceEnvironment,
  projectRootPath: string,
): string {
  if (environment === context.hostEnvironment || environment.rootPath === context.hostEnvironment.rootPath) {
    return context.sourceFilePath ?? `${projectRootPath.replace(/[\\/]+$/, '')}/.opencard/project.json`
  }

  const environmentRoot = environment.rootPath?.replace(/\\/g, '/').replace(/\/+$/, '')
  const hostRoot = context.hostEnvironment.rootPath?.replace(/\\/g, '/').replace(/\/+$/, '')
  const renderRoot = projectRootPath.replace(/\\/g, '/').replace(/\/+$/, '')
  if (environmentRoot && hostRoot && environmentRoot.toLocaleLowerCase().startsWith(`${hostRoot.toLocaleLowerCase()}/`)) {
    return `${renderRoot}/${environmentRoot.slice(hostRoot.length + 1)}/.opencard/manifest.json`
  }
  return environmentRoot
    ? `${environmentRoot}/.opencard/manifest.json`
    : context.sourceFilePath ?? `${renderRoot}/.opencard/project.json`
}

export function resolveCardFontFamily(
  value: string,
  context: CardRenderResourceContext,
  blockId?: string,
  fieldKey = 'fontFamily',
  ): string {
  const scopeKey = blockId && fieldKey ? projectResourceScopeIdentity(blockId, fieldKey) : null
  const scopedEnvironment = scopeKey ? context.resourceScopes.get(scopeKey) : undefined
  const environment = scopedEnvironment ?? context.hostEnvironment
  const fallback = context.resolveFontFamily ?? toCssFontFamily
  const options: ResourceReferenceResolutionOptions = {
    environment,
    hostEnvironment: context.hostEnvironment,
    packageEnvironments: context.packageEnvironments,
  }
  const result = parseResourceReferenceList(value, 'font').map(token => {
    if (token.diagnostics.length > 0) return ''
    if (!token.reference) return token.source
    const resolved = resolveResourceReferenceText<ProjectFontRegistryEntry>(token.source, options)
    if (!resolved.value || !resolved.reference) return ''
    const key = resolved.value.kind === 'family'
      ? resolved.value.family.key
      : resolved.value.composition.key
    if (resolved.environment?.kind === 'package') {
      return JSON.stringify(createScopedProjectFontFamily(resolved.environment.namespace, key))
    }
    return fallback(`font:${key}`)
  }).filter(Boolean).join(', ')

  if (import.meta.env.DEV && blockId && blockId.includes('::') && fieldKey === 'fontFamily') {
    console.debug('[OpenCard][font-resolution]', {
      blockId,
      source: value || '(empty)',
      scopeKey,
      scopeMatched: Boolean(scopedEnvironment),
      environmentKind: environment.kind,
      environmentNamespace: environment.namespace,
      environmentRootPath: environment.rootPath,
      availableFontKeys: Object.keys(environment.fonts),
      result,
      resolver: context.resolveFontFamily ? 'project-resolver' : 'default-css-resolver',
    })
  }

  return result
}

export function resolveCardIconCatalog(
  context: CardRenderResourceContext,
  blockId?: string,
  fieldKey = 'content',
): ProjectIconCatalog {
  return resolveCardResourceEnvironment(context, blockId, fieldKey).iconCatalog
}

export function resolveCardIconReference(
  source: string,
  context: CardRenderResourceContext,
  blockId?: string,
  fieldKey = 'content',
  ): ProjectIconCatalog['entries'][number] | null {
  const environment = resolveCardResourceEnvironment(context, blockId, fieldKey)
  return resolveResourceReferenceText<ProjectIconCatalog['entries'][number]>(source, {
    environment,
    hostEnvironment: context.hostEnvironment,
    packageEnvironments: context.packageEnvironments,
  }).value
}
