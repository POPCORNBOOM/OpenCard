import type { ProjectRemoteResourcePolicy } from '../workspace/model/projectMetadata'
import {
  EMPTY_PROJECT_ICON_CATALOG,
  type ProjectIconCatalog,
} from '../workspace/services/projectIconCatalog'
import type { CustomBlockRuntimeCatalog, CustomBlockRuntimeEntry } from './expandCustomBlocks'
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

export type CardRenderResourceContext = {
  readonly hostEnvironment: ProjectResourceEnvironment
  readonly remoteResourcePolicy?: ProjectRemoteResourcePolicy
  readonly customBlockCatalog: CustomBlockRuntimeCatalog
  readonly projectIconCatalog: ProjectIconCatalog
  readonly resourceScopes: ProjectResourceScopeMap
  readonly packageEnvironments: ReadonlyMap<string, ProjectResourceEnvironment>
  readonly richText?: PreparedRichTextCatalog
  readonly resolveFontFamily?: (references: string) => string
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
  customBlockCatalog?: CustomBlockRuntimeCatalog
  projectIconCatalog?: ProjectIconCatalog
  resourceScopes?: ProjectResourceScopeMap
  packageEnvironments?: ReadonlyMap<string, ProjectResourceEnvironment>
  richText?: PreparedRichTextCatalog
  resolveFontFamily?: (references: string) => string
}): CardRenderResourceContext {
  const projectIconCatalog = options.projectIconCatalog ?? options.hostEnvironment?.iconCatalog
    ?? EMPTY_PROJECT_ICON_CATALOG
  return {
    hostEnvironment: options.hostEnvironment
      ?? fallbackEnvironment(options.resourceRootPath ?? null, projectIconCatalog),
    remoteResourcePolicy: options.remoteResourcePolicy,
    customBlockCatalog: options.customBlockCatalog ?? new Map(),
    projectIconCatalog,
    resourceScopes: options.resourceScopes ?? new Map(),
    packageEnvironments: options.packageEnvironments ?? new Map(),
    richText: options.richText ?? new Map(),
    resolveFontFamily: options.resolveFontFamily,
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
  const environment = resolveCardResourceEnvironment(context, blockId, fieldKey)
  const fallback = context.resolveFontFamily ?? (references => references)
  const options: ResourceReferenceResolutionOptions = {
    environment,
    hostEnvironment: context.hostEnvironment,
    packageEnvironments: context.packageEnvironments,
  }
  return parseResourceReferenceList(value, 'font').map(token => {
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

export function resolveCardBlockReference(
  source: string,
  context: CardRenderResourceContext,
  blockId?: string,
  fieldKey = 'content',
  ): CustomBlockRuntimeEntry | null {
  const environment = resolveCardResourceEnvironment(context, blockId, fieldKey)
  return resolveResourceReferenceText<CustomBlockRuntimeEntry>(source, {
    environment,
    hostEnvironment: context.hostEnvironment,
  }).value
}
