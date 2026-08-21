import type { ProjectRemoteResourcePolicy } from '../workspace/model/projectMetadata'
import {
  EMPTY_PROJECT_ICON_CATALOG,
  type ProjectIconCatalog,
} from '../workspace/services/projectIconCatalog'
import type { CustomBlockRuntimeCatalog } from './expandCustomBlocks'
import type { PreparedRichTextCatalog } from './prepareRichText'
import {
  createProjectResourceNamespace,
  projectResourceScopeIdentity,
  resolveProjectEnvironmentAssetSrc,
  resolveProjectEnvironmentFontFamily,
  type ProjectResourceEnvironment,
  type ProjectResourceScopeMap,
} from '../workspace/services/projectResourceEnvironment'

export type CardRenderResourceContext = {
  readonly hostEnvironment: ProjectResourceEnvironment
  readonly remoteResourcePolicy?: ProjectRemoteResourcePolicy
  readonly customBlockCatalog: CustomBlockRuntimeCatalog
  readonly projectIconCatalog: ProjectIconCatalog
  readonly resourceScopes: ProjectResourceScopeMap
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
    fontDocument: {},
    fonts: {},
    iconDocument: {},
    iconCatalog: projectIconCatalog,
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
  return resolveProjectEnvironmentAssetSrc(
    source,
    resolveCardResourceEnvironment(context, blockId, fieldKey),
    context.remoteResourcePolicy,
  )
}

export function resolveCardFontFamily(
  value: string,
  context: CardRenderResourceContext,
  blockId?: string,
  fieldKey = 'fontFamily',
): string {
  const fallback = context.resolveFontFamily ?? (references => references)
  return resolveProjectEnvironmentFontFamily(
    value,
    resolveCardResourceEnvironment(context, blockId, fieldKey),
    fallback,
  )
}

export function resolveCardIconCatalog(
  context: CardRenderResourceContext,
  blockId?: string,
  fieldKey = 'content',
): ProjectIconCatalog {
  return resolveCardResourceEnvironment(context, blockId, fieldKey).iconCatalog
}
