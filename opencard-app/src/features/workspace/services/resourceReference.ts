import { convertFileSrc } from '@tauri-apps/api/core'
import { isRemoteResourceAllowed } from '../../editor-runtime/services/editorResource'
import { normalizeKeySlug } from '../../../shared/model/keySlug'
import type { CustomBlockRuntimeEntry } from '../../card-rendering/expandCustomBlocks'
import {
  findProjectIcon,
  type ProjectIconCatalogEntry,
} from './projectIconCatalog'
import type { ProjectFontRegistryEntry } from '../model/projectFontRegistry'
import {
  normalizeProjectResourcePath,
  resolveProjectResourceFilePath,
  type ProjectResourceEnvironment,
  type ProjectResourcePackage,
} from './projectResourceEnvironment'

export type ResourceReferenceScope = 'current' | 'host' | 'package'
export type ResourceReferenceKind = 'asset' | 'font' | 'icon' | 'block'

export type ResourceReference = {
  scope: ResourceReferenceScope
  packageKey?: string
  kind: ResourceReferenceKind
  key: string
}

export type ResourceReferenceDiagnosticCode =
  | 'syntax-error'
  | 'scope-unavailable'
  | 'package-unavailable'
  | 'resource-unavailable'
  | 'unsafe-path'
  | 'type-mismatch'

export type ResourceReferenceDiagnostic = {
  code: ResourceReferenceDiagnosticCode
  reference: string
  message: string
}

export type ParsedResourceReference = {
  reference: ResourceReference | null
  diagnostics: readonly ResourceReferenceDiagnostic[]
}

export type ResolvedResource<T> = {
  reference: ResourceReference | null
  environment: ProjectResourceEnvironment | null
  value: T | null
  diagnostics: readonly ResourceReferenceDiagnostic[]
}

export type ResourceReferenceResolutionOptions = {
  environment: ProjectResourceEnvironment
  hostEnvironment?: ProjectResourceEnvironment
  packageEnvironments?: ReadonlyMap<string, ProjectResourceEnvironment>
}

function diagnostic(
  code: ResourceReferenceDiagnosticCode,
  source: string,
  message: string,
): ResourceReferenceDiagnostic {
  return { code, reference: source, message }
}

function splitReference(source: string): { qualifier: string | null, body: string } | null {
  const at = source.indexOf('@')
  if (at < 0) return { qualifier: null, body: source }
  if (source.indexOf('@', at + 1) >= 0) return null
  return { qualifier: source.slice(0, at), body: source.slice(at + 1) }
}

function normalizeKind(value: string): ResourceReferenceKind | null {
  return value === 'asset' || value === 'font' || value === 'icon' || value === 'block'
    ? value
    : null
}

function normalizeTypedKey(kind: ResourceReferenceKind, value: string): string | null {
  if (kind === 'asset') return normalizeProjectResourcePath(value)
  if (kind === 'icon') {
    const segments = value.split('/')
    if (segments.length !== 2) return null
    const seriesKey = normalizeKeySlug(segments[0] ?? '')
    const iconKey = normalizeKeySlug(segments[1] ?? '')
    return seriesKey && iconKey ? `${seriesKey}/${iconKey}` : null
  }
  return normalizeKeySlug(value)
}

export function parseResourceReference(source: string): ParsedResourceReference {
  const original = source
  const value = source.trim()
  if (!value) return {
    reference: null,
    diagnostics: [diagnostic('syntax-error', original, 'Resource reference is empty')],
  }

  const split = splitReference(value)
  if (!split) return {
    reference: null,
    diagnostics: [diagnostic('syntax-error', original, 'Resource reference contains more than one package separator')],
  }

  const separator = split.body.indexOf(':')
  if (separator <= 0) return {
    reference: null,
    diagnostics: [diagnostic('syntax-error', original, 'Resource reference must use kind:key syntax')],
  }
  const kind = normalizeKind(split.body.slice(0, separator).toLocaleLowerCase())
  if (!kind) return {
    reference: null,
    diagnostics: [diagnostic('syntax-error', original, 'Resource reference type is unknown')],
  }

  const keyValue = split.body.slice(separator + 1).trim()
  const key = normalizeTypedKey(kind, keyValue)
  if (!key) return {
    reference: null,
    diagnostics: [diagnostic(kind === 'asset' ? 'unsafe-path' : 'syntax-error', original,
      kind === 'asset' ? 'Resource asset path is unsafe' : 'Resource key is invalid')],
  }
  if (kind === 'asset' && (key === '.opencard' || key.startsWith('.opencard/'))) return {
    reference: null,
    diagnostics: [diagnostic('type-mismatch', original, 'Asset references cannot access internal project files')],
  }

  if (split.qualifier === null) return {
    reference: { scope: 'current', kind, key },
    diagnostics: [],
  }
  if (!split.qualifier) return {
    reference: { scope: 'host', kind, key },
    diagnostics: [],
  }
  const packageKey = normalizeKeySlug(split.qualifier)
  if (!packageKey) return {
    reference: null,
    diagnostics: [diagnostic('syntax-error', original, 'Package Key is invalid')],
  }
  return {
    reference: { scope: 'package', packageKey, kind, key },
    diagnostics: [],
  }
}

export function formatResourceReference(reference: ResourceReference): string {
  const qualifier = reference.scope === 'host'
    ? '@'
    : reference.scope === 'package'
      ? `${reference.packageKey ?? ''}@`
      : ''
  return `${qualifier}${reference.kind}:${reference.key}`
}

function lookupPackage(
  environment: ProjectResourceEnvironment,
  packageKey: string,
): ProjectResourcePackage | null {
  return environment.packages?.get(packageKey.toLocaleLowerCase()) ?? null
}

function resolveEnvironment(
  reference: ResourceReference,
  options: ResourceReferenceResolutionOptions,
): { environment: ProjectResourceEnvironment | null, package?: ProjectResourcePackage, diagnostics: ResourceReferenceDiagnostic[] } {
  if (reference.scope === 'current') return { environment: options.environment, diagnostics: [] }
  if (reference.scope === 'host') {
    if (!options.hostEnvironment) return {
      environment: null,
      diagnostics: [diagnostic('scope-unavailable', formatResourceReference(reference), 'Host project environment is unavailable')],
    }
    return { environment: options.hostEnvironment, diagnostics: [] }
  }

  const source = formatResourceReference(reference)
  const pkg = lookupPackage(options.environment, reference.packageKey ?? '')
  if (!pkg) return {
    environment: null,
    diagnostics: [diagnostic('package-unavailable', source, 'Referenced package is not visible from the current environment')],
  }
  if (pkg.unavailable) return {
    environment: null,
    package: pkg,
    diagnostics: [diagnostic('package-unavailable', source, 'Referenced package is unavailable')],
  }
  const packageEnvironment = options.packageEnvironments?.get(pkg.manifest.key.toLocaleLowerCase())
  return packageEnvironment
    ? { environment: packageEnvironment, package: pkg, diagnostics: [] }
    : {
      environment: null,
      package: pkg,
      diagnostics: [diagnostic('scope-unavailable', source, 'Referenced package environment is not loaded')],
    }
}

function findFont(environment: ProjectResourceEnvironment, key: string): ProjectFontRegistryEntry | null {
  return Object.entries(environment.fonts).find(([candidate]) => candidate.toLocaleLowerCase() === key.toLocaleLowerCase())?.[1] ?? null
}

function findBlock(environment: ProjectResourceEnvironment, key: string): CustomBlockRuntimeEntry | null {
  const catalog = environment.customBlockCatalog
  return catalog?.get(`block:${key}`) ?? catalog?.get(key) ?? null
}

function resourceUnavailable<T>(
  reference: ResourceReference,
  environment: ProjectResourceEnvironment | null,
  message: string,
  code: ResourceReferenceDiagnosticCode = 'resource-unavailable',
): ResolvedResource<T> {
  return {
    reference,
    environment,
    value: null,
    diagnostics: [diagnostic(code, formatResourceReference(reference), message)],
  }
}

export function resolveResourceReference<T extends string | ProjectFontRegistryEntry | ProjectIconCatalogEntry | CustomBlockRuntimeEntry>(
  reference: ResourceReference,
  options: ResourceReferenceResolutionOptions,
): ResolvedResource<T> {
  const selected = resolveEnvironment(reference, options)
  if (!selected.environment) {
    return {
      reference,
      environment: null,
      value: null,
      diagnostics: selected.diagnostics,
    }
  }
  const environment = selected.environment
  if (reference.kind === 'asset') {
    const path = resolveProjectResourceFilePath(environment, reference.key)
    if (!path) return resourceUnavailable(reference, environment, 'Resource asset path is unavailable')
    const allowed = environment.accessPolicy?.mode !== 'allow-list'
      || environment.accessPolicy.assetPaths.has(reference.key.toLocaleLowerCase())
    if (!allowed) return resourceUnavailable(reference, environment, 'Resource asset is not allowed by the environment')
    return { reference, environment, value: convertFileSrc(path) as T, diagnostics: [] }
  }
  if (reference.kind === 'font') {
    const font = findFont(environment, reference.key)
    return font
      ? { reference, environment, value: font as T, diagnostics: [] }
      : resourceUnavailable(reference, environment, 'Referenced font is unavailable')
  }
  if (reference.kind === 'icon') {
    const [seriesKey, iconKey] = reference.key.split('/')
    const icon = findProjectIcon(environment.iconCatalog, seriesKey ?? '', iconKey ?? '')
    return icon
      ? { reference, environment, value: icon as T, diagnostics: [] }
      : resourceUnavailable(reference, environment, 'Referenced icon is unavailable')
  }
  const block = findBlock(environment, reference.key)
  return block
    ? { reference, environment, value: block as T, diagnostics: [] }
    : resourceUnavailable(reference, environment, 'Referenced custom block is unavailable')
}

export function resolveResourceReferenceText<T extends string | ProjectFontRegistryEntry | ProjectIconCatalogEntry | CustomBlockRuntimeEntry>(
  source: string,
  options: ResourceReferenceResolutionOptions,
): ResolvedResource<T> {
  const parsed = parseResourceReference(source)
  if (!parsed.reference) return {
    reference: null,
    environment: null,
    value: null,
    diagnostics: parsed.diagnostics,
  }
  const result = resolveResourceReference<T>(parsed.reference, options)
  return parsed.diagnostics.length === 0
    ? result
    : { ...result, diagnostics: [...parsed.diagnostics, ...result.diagnostics] }
}

export function resolveAssetReferenceSource(
  source: string,
  options: ResourceReferenceResolutionOptions,
  remoteResourcePolicy?: import('../model/projectMetadata').ProjectRemoteResourcePolicy,
): ResolvedResource<string> {
  const value = source.trim()
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^[a-z]:[\\/]/i.test(value)) {
    
    if (!isRemoteResourceAllowed(value, remoteResourcePolicy)) {
      return {
        reference: null,
        environment: null,
        value: null,
        diagnostics: [diagnostic('resource-unavailable', source, 'Remote resource is not allowed')],
      }
    }
    return { reference: null, environment: options.environment, value, diagnostics: [] }
  }
  const typedSource = value.toLocaleLowerCase().startsWith('asset:') || value.includes('@asset:')
    ? value
    : `asset:${value}`
  return resolveResourceReferenceText<string>(typedSource, options)
}


export type ParsedResourceReferenceToken = {
  source: string
  reference: ResourceReference | null
  diagnostics: readonly ResourceReferenceDiagnostic[]
}

export function parseResourceReferenceList(
  source: string,
  kind: ResourceReferenceKind,
 ): ParsedResourceReferenceToken[] {
  return source.split(';').map(value => {
    const candidate = value.trim()
    if (!candidate) return { source: candidate, reference: null, diagnostics: [] }
    const lower = candidate.toLocaleLowerCase()
    if (!lower.startsWith(`${kind}:`) && !lower.includes(`@${kind}:`)) {
      return { source: candidate, reference: null, diagnostics: [] }
    }
    const parsed = parseResourceReference(candidate)
    return { source: candidate, reference: parsed.reference, diagnostics: parsed.diagnostics }
  }).filter(token => token.source.length > 0)
}

export function parseEmbeddedResourceReferences(source: string): ParsedResourceReferenceToken[] {
  const tokens: ParsedResourceReferenceToken[] = []
  const canonicalPattern = /\[\[([a-z0-9._-]+@)?icon:([^\]]+)\]\]/gi
  for (const match of source.matchAll(canonicalPattern)) {
    const token = `${match[1] ?? ''}icon:${match[2] ?? ''}`
    const parsed = parseResourceReference(token)
    tokens.push({ source: match[0] ?? token, reference: parsed.reference, diagnostics: parsed.diagnostics })
  }
  if (typeof DOMParser === 'undefined') return tokens
  const documentNode = new DOMParser().parseFromString(source, 'text/html')
  for (const element of Array.from(documentNode.body.querySelectorAll('[data-oc-icon-path]'))) {
    const path = element.getAttribute('data-oc-icon-path') ?? ''
    const parsed = parseResourceReference(`icon:${path}`)
    tokens.push({ source: path, reference: parsed.reference, diagnostics: parsed.diagnostics })
  }
  return tokens
}

export function buildResourceFontCatalog(
  environment: ProjectResourceEnvironment,
  packageEnvironments: ReadonlyMap<string, ProjectResourceEnvironment> = new Map(),
): readonly import('../model/projectFonts').FontCatalogEntry[] {
  const entries: import('../model/projectFonts').FontCatalogEntry[] = []
  for (const [key, entry] of Object.entries(environment.fonts)) {
    entries.push({ value: `font:${key}`, label: entry.name, source: 'project', detail: `font:${key}` })
  }
  for (const [packageKey, packageEnvironment] of packageEnvironments) {
    if (environment.packages?.get(packageKey)?.unavailable) continue
    for (const [key, entry] of Object.entries(packageEnvironment.fonts)) {
      entries.push({
        value: `${packageKey}@font:${key}`,
        label: entry.name,
        source: 'project',
        detail: `${packageKey}@font:${key}`,
      })
    }
  }
  return entries
}
