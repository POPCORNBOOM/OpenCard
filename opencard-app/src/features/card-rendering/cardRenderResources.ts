import type { ProjectRemoteResourcePolicy } from '../workspace/model/projectMetadata'
import {
  EMPTY_PROJECT_ICON_CATALOG,
  type ProjectIconCatalog,
  type ProjectIconDimensionReader,
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
  type ResourceReferenceDiagnostic,
  type ResourceReferenceResolutionOptions,
} from '../workspace/services/resourceReference'
import type { ProjectFontRegistryEntry } from '../workspace/model/projectFontRegistry'
import { toCssFontFamily } from '../workspace/model/projectFonts'
import { convertFileSrc } from '@tauri-apps/api/core'
import { isRemoteResourceAllowed } from '../editor-runtime/services/editorResource'
import { resolveResourcePath, type ScopedResourcePathIssueCode } from '../workspace/model/scopedResourcePath'

export type CardRenderResourceContext = {
  readonly resourceRootPath: string | null
  readonly sourceFilePath: string | null
  readonly hostEnvironment: ProjectResourceEnvironment
  readonly remoteResourcePolicy?: ProjectRemoteResourcePolicy
  readonly resolveRemoteResource?: (url: string) => string | null
  readonly projectIconCatalog: ProjectIconCatalog
  /** Reads an icon's size, which is what asks for it and re-renders the consumer that read it. */
  readonly resolveIconDimensions?: ProjectIconDimensionReader
  readonly resourceScopes: ProjectResourceScopeMap
  readonly packageEnvironments: ReadonlyMap<string, ProjectResourceEnvironment>
  readonly richText?: PreparedRichTextCatalog
  readonly resolveFontFamily?: (references: string) => string
  readonly bindingProject?: Readonly<ProjectInformation> | null
  readonly bindingDictionary?: Readonly<Record<string, string>> | null
}

export type CardRenderResourceContextSource = CardRenderResourceContext | (() => CardRenderResourceContext)
export type CardRenderResourceScopeSource = ProjectResourceScopeMap | (() => ProjectResourceScopeMap)

/** Why a render-side resource could not be produced. */
export type ResourceIssueCode =
  | 'syntax-error'
  | 'unsafe-path'
  | 'reserved-path'
  | 'source-outside-project'
  | 'scope-unavailable'
  | 'package-unavailable'
  | 'resource-unavailable'
  | 'kind-mismatch'

/** What the field is asking for: one asset reference — a path or an icon — or a font list. */
export type ResourceExpectation = 'asset' | 'font'

export type ResourceRequest = {
  /** The field's raw text: `xx.png` / `pkg@xx.png` / `icon:a/b` / `pkg@icon:a/b` / `font:x; Arial`. */
  readonly value: string
  readonly expect: ResourceExpectation
  /** Scope lookup: the binding of this block and field. */
  readonly blockId?: string
  readonly fieldKey?: string
}

export type ResolvedResource =
  | { kind: 'empty' }
  | { kind: 'url', src: string }
  | { kind: 'icon', entry: ProjectIconCatalog['entries'][number] }
  | { kind: 'font', cssFamily: string }
  | { kind: 'unavailable', code: ResourceIssueCode, message: string }

export interface CardResourceResolver {
  readonly hostEnvironment: ProjectResourceEnvironment
  resolve: (request: ResourceRequest) => ResolvedResource
  /** Reads an icon's size, which is what asks for it. */
  resolveIconDimensions: ProjectIconDimensionReader
  withScopes: (scopes: CardRenderResourceScopeSource) => CardResourceResolver
}

function readSource<T>(source: T | (() => T)): T {
  return typeof source === 'function' ? (source as () => T)() : source
}

/** A render without a project behind it — a fixture, a preview — simply keeps the square default. */
const noopIconDimensionReader: ProjectIconDimensionReader = () => undefined

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
    resolve: request => resolveCardResource(request, context()),
    resolveIconDimensions: entry => (context().resolveIconDimensions ?? noopIconDimensionReader)(entry),
    withScopes: scopes => createCardResourceResolver(contextSource, [...scopeSources, scopes]),
  }
}

/** The single decision for a render-side field: what its raw text resolves to. */
export function resolveCardResource(
  request: ResourceRequest,
  context: CardRenderResourceContext,
): ResolvedResource {
  switch (request.expect) {
    case 'asset': return resolveImageResource(request, context)
    case 'font': return resolveFontResource(request, context)
  }
}

function resolveImageResource(
  request: ResourceRequest,
  context: CardRenderResourceContext,
): ResolvedResource {
  const fieldKey = request.fieldKey ?? 'source'
  const value = request.value.trim()
  if (!value) return { kind: 'empty' }

  const parsed = parseResourceReference(value)
  if (parsed.reference?.kind === 'icon') {
    const resolved = resolveIconReference(value, context, request.blockId, fieldKey)
    return resolved.value
      ? { kind: 'icon', entry: resolved.value }
      : unavailable(resolved.diagnostics, 'Referenced icon is unavailable')
  }
  if (parsed.reference) {
    return {
      kind: 'unavailable',
      code: 'kind-mismatch',
      message: `An image field cannot resolve the ${parsed.reference.kind} reference "${value}"`,
    }
  }
  // A font-or-icon reference that could not even be parsed still names no image.
  if (/^(?:[a-z0-9._-]+@|@)?(?:font|icon):/i.test(value)) {
    return unavailable(parsed.diagnostics, `Image source "${value}" is not a readable resource reference`)
  }

  return resolveAssetResource(value, context, request.blockId, fieldKey)
}

function resolveFontResource(
  request: ResourceRequest,
  context: CardRenderResourceContext,
): ResolvedResource {
  if (!request.value.trim()) return { kind: 'empty' }

  const environment = resolveCardResourceEnvironment(context, request.blockId, request.fieldKey ?? 'fontFamily')
  const fallback = context.resolveFontFamily ?? toCssFontFamily
  const options: ResourceReferenceResolutionOptions = {
    environment,
    hostEnvironment: context.hostEnvironment,
    packageEnvironments: context.packageEnvironments,
  }
  const cssFamily = parseResourceReferenceList(request.value, 'font').map(token => {
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

  return { kind: 'font', cssFamily }
}

/** An asset field resolves to a URL or to a coded failure — nothing else. */
type AssetResource = Extract<ResolvedResource, { kind: 'url' | 'unavailable' }>

function resolveAssetResource(
  value: string,
  context: CardRenderResourceContext,
  blockId?: string,
  fieldKey?: string,
): AssetResource {
  const environment = resolveCardResourceEnvironment(context, blockId, fieldKey)
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^[a-z]:[\\/]/i.test(value)) {
    if (!isRemoteResourceAllowed(value, context.remoteResourcePolicy)) {
      return { kind: 'unavailable', code: 'unsafe-path', message: `Resource scheme is not permitted: ${value}` }
    }
    return { kind: 'url', src: context.resolveRemoteResource?.(value) ?? value }
  }
  const projectRootPath = context.resourceRootPath ?? context.hostEnvironment.rootPath ?? environment.rootPath
  if (!projectRootPath) {
    return { kind: 'unavailable', code: 'scope-unavailable', message: `No project root is available to resolve "${value}"` }
  }
  const sourceFilePath = resolveAssetScopeSourceFile(context, environment, projectRootPath)
  const resolved = resolveResourcePath(projectRootPath, sourceFilePath, value)
  return resolved.ok
    ? { kind: 'url', src: convertFileSrc(resolved.value) }
    : { kind: 'unavailable', code: pathIssueCode(resolved.code), message: resolved.message }
}

/** `resolveResourcePath` carries its own taxonomy; only its syntax name differs here. */
function pathIssueCode(code: ScopedResourcePathIssueCode): ResourceIssueCode {
  switch (code) {
    case 'unsafe-path':
    case 'reserved-path':
    case 'source-outside-project': return code
    case 'invalid-reference': return 'syntax-error'
    // `resolveResourcePath` never reports these two; they belong to relativizing a path.
    case 'target-outside-project':
    case 'unrepresentable-scope': return 'resource-unavailable'
  }
}

function unavailable(
  diagnostics: readonly ResourceReferenceDiagnostic[],
  fallbackMessage: string,
): Extract<ResolvedResource, { kind: 'unavailable' }> {
  const [diagnostic] = diagnostics
  return diagnostic
    ? { kind: 'unavailable', code: diagnostic.code, message: diagnostic.message }
    : { kind: 'unavailable', code: 'resource-unavailable', message: fallbackMessage }
}

function resolveIconReference(
  source: string,
  context: CardRenderResourceContext,
  blockId?: string,
  fieldKey?: string,
) {
  return resolveResourceReferenceText<ProjectIconCatalog['entries'][number]>(source, {
    environment: resolveCardResourceEnvironment(context, blockId, fieldKey),
    hostEnvironment: context.hostEnvironment,
    packageEnvironments: context.packageEnvironments,
  })
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
  resolveIconDimensions?: ProjectIconDimensionReader
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
    resolveIconDimensions: options.resolveIconDimensions,
    resourceScopes: options.resourceScopes ?? new Map(),
    packageEnvironments: options.packageEnvironments ?? new Map(),
    richText: options.richText ?? new Map(),
    resolveFontFamily: options.resolveFontFamily,
    bindingProject: options.bindingProject,
    bindingDictionary: options.bindingDictionary,
  }
}

/**
 * The scoped environment a block field resolves against. It stays exported because the render-side
 * validator asks the same question of the same context.
 */
export function resolveCardResourceEnvironment(
  context: CardRenderResourceContext,
  blockId?: string,
  fieldKey?: string,
): ProjectResourceEnvironment {
  return blockId && fieldKey
    ? context.resourceScopes.get(projectResourceScopeIdentity(blockId, fieldKey)) ?? context.hostEnvironment
    : context.hostEnvironment
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
