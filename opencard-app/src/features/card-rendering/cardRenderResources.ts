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
  parseResourceReferenceList,
  resolveAssetReferenceSource,
  resolveResourceReferenceText,
  type ResourceReferenceResolutionOptions,
} from '../workspace/services/resourceReference'
import type { ProjectFontRegistryEntry } from '../workspace/model/projectFontRegistry'
import { toCssFontFamily } from '../workspace/model/projectFonts'

export type CardRenderResourceContext = {
  readonly hostEnvironment: ProjectResourceEnvironment
  readonly remoteResourcePolicy?: ProjectRemoteResourcePolicy
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

export interface CardResourceResolver {
  readonly hostEnvironment: ProjectResourceEnvironment
  resolveAsset: (source: string, blockId?: string, fieldKey?: string) => string
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
    resolveFont: (value, blockId, fieldKey) => resolveCardFontFamily(value, context(), blockId, fieldKey),
    resolveIcon: (source, blockId, fieldKey) => resolveCardIconReference(source, context(), blockId, fieldKey),
    withScopes: scopes => createCardResourceResolver(contextSource, [...scopeSources, scopes]),
  }
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
  hostEnvironment?: ProjectResourceEnvironment
  remoteResourcePolicy?: ProjectRemoteResourcePolicy
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
  return {
    hostEnvironment: options.hostEnvironment
      ?? fallbackEnvironment(options.resourceRootPath ?? null, projectIconCatalog),
    remoteResourcePolicy: options.remoteResourcePolicy,
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
  fieldKey = 'image',
  ): string {
  const environment = resolveCardResourceEnvironment(context, blockId, fieldKey)
  const resolved = resolveAssetReferenceSource(source, {
    environment,
    hostEnvironment: context.hostEnvironment,
    packageEnvironments: context.packageEnvironments,
  }, context.remoteResourcePolicy)
  return resolved.value ?? ''
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
  }).value
}
