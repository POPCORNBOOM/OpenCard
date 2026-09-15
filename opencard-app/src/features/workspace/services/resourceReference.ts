import { normalizeKeySlug } from '../../../shared/model/keySlug'
import {
  findProjectIcon,
  type ProjectIconCatalogEntry,
} from './projectIconCatalog'
import type { ProjectFontRegistryEntry } from '../model/projectFontRegistry'
import { resolveProjectEnvironmentFontFamily, type ProjectResourceEnvironment, type ProjectResourcePackage } from './projectResourceEnvironment'
import { toCssFontFamily, type FontCatalogEntry } from '../model/projectFonts'

export type ResourceReferenceScope = 'current' | 'host' | 'package'
export type ResourceReferenceKind = 'font' | 'icon'

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
  return value === 'font' || value === 'icon'
    ? value
    : null
}

function normalizeTypedKey(kind: ResourceReferenceKind, value: string): string | null {
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
    diagnostics: [diagnostic('syntax-error', original, 'Resource key is invalid')],
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

function formatResourceReference(reference: ResourceReference): string {
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

function resolveResourceReference<T extends string | ProjectFontRegistryEntry | ProjectIconCatalogEntry>(
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
  return resourceUnavailable(reference, environment, 'Referenced icon is unavailable')
}

export function resolveResourceReferenceText<T extends string | ProjectFontRegistryEntry | ProjectIconCatalogEntry>(
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

export function buildResourceFontCatalog(
  environment: ProjectResourceEnvironment,
): readonly FontCatalogEntry[] {
  const entries: FontCatalogEntry[] = []
  for (const [key, entry] of Object.entries(environment.fonts)) {
    entries.push({ value: `font:${key}`, label: entry.name, source: 'project', detail: `font:${key}`,
      cssFamily: resolveProjectEnvironmentFontFamily(`font:${key}`, environment, toCssFontFamily) })
  }
  for (const [packageKey, packageEnvironment] of environment.packageEnvironments ?? []) {
    const pkg = environment.packages?.get(packageKey)
    if (!pkg || pkg.unavailable) continue
    for (const [key, entry] of Object.entries(packageEnvironment.fonts)) {
      entries.push({
        value: `${packageKey}@font:${key}`,
        label: entry.name,
        source: 'project',
        detail: `${packageKey}@font:${key}`,
        cssFamily: resolveProjectEnvironmentFontFamily(`font:${key}`, packageEnvironment, toCssFontFamily),
      })
    }
  }
  return entries
}
