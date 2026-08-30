import { normalizeKeySlug } from '../../../shared/model/keySlug'

export const RESOURCE_PACKAGE_TYPE = 'opencard-resource-package' as const
export const RESOURCE_PACKAGE_MANIFEST_FILE_NAME = '.opencard/manifest.json'
export const RESOURCE_PACKAGE_EXTENSION = 'ocpack'
export const RESOURCE_PACKAGE_SUFFIX = `.${RESOURCE_PACKAGE_EXTENSION}`

export type ResourcePackagePublicFont = {
  key: string
  title: string
}

export type ResourcePackagePublicResources = {
  fonts: readonly ResourcePackagePublicFont[]
  iconSeries: readonly string[]
  assets: readonly string[]
}

export type ResourcePackageDependency = {
  key: string
  version: string
  contentHash: string
}

export type ResourcePackageDependencyKind = 'asset' | 'font' | 'icon' | 'package'

export type ResourcePackageHostDependency = {
  kind: ResourcePackageDependencyKind
  key: string
  requiredBy: readonly string[]
}

export type ResourcePackageManifest = {
  type: typeof RESOURCE_PACKAGE_TYPE
  key: string
  name: string
  version: string
  contentHash: string
  public: ResourcePackagePublicResources
  dependencies: readonly ResourcePackageDependency[]
  hostDependencies?: readonly ResourcePackageHostDependency[]
}

export type ResourcePackageManifestIssue = {
  path: string
  message: string
}

export type ResourcePackageManifestNormalization = {
  manifest: ResourcePackageManifest
  issues: readonly ResourcePackageManifestIssue[]
}

const semanticVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/
const hashPattern = /^[0-9a-f]{64}$/i
const dependencyKinds = new Set<ResourcePackageDependencyKind>(['asset', 'font', 'icon', 'package'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function addIssue(issues: ResourcePackageManifestIssue[], path: string, message: string): void {
  issues.push({ path, message })
}

function normalizeStringList(
  value: unknown,
  issues: ResourcePackageManifestIssue[],
  path: string,
): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    addIssue(issues, path, 'Expected an array; used an empty list')
    return []
  }
  const result: string[] = []
  const identities = new Set<string>()
  for (const [index, candidate] of value.entries()) {
    if (typeof candidate !== 'string') {
      addIssue(issues, `${path}[${index}]`, 'Expected a string; ignored the entry')
      continue
    }
    const normalized = candidate.trim().replace(/\\/g, '/')
    const identity = normalized.toLocaleLowerCase()
    if (!normalized || identities.has(identity)) {
      addIssue(issues, `${path}[${index}]`, 'Empty or duplicate entry was ignored')
      continue
    }
    identities.add(identity)
    result.push(normalized)
  }
  return result
}

function normalizePublicFonts(
  value: unknown,
  issues: ResourcePackageManifestIssue[],
): ResourcePackagePublicFont[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    addIssue(issues, 'public.fonts', 'Expected an array; used an empty list')
    return []
  }
  const result: ResourcePackagePublicFont[] = []
  const identities = new Set<string>()
  for (const [index, candidate] of value.entries()) {
    const path = `public.fonts[${index}]`
    if (!isRecord(candidate)) {
      addIssue(issues, path, 'Expected a public font object; ignored the entry')
      continue
    }
    const key = typeof candidate.key === 'string' ? normalizeKeySlug(candidate.key) : null
    const title = typeof candidate.title === 'string' ? candidate.title.trim() : ''
    if (!key || !title) {
      addIssue(issues, path, 'Public font Key and title are required; ignored the entry')
      continue
    }
    if (identities.has(key)) {
      addIssue(issues, `${path}.key`, 'Duplicate public font Key was ignored')
      continue
    }
    identities.add(key)
    result.push({ key, title })
  }
  return result
}

function normalizeVersion(
  value: unknown,
  fallback: string,
  issues: ResourcePackageManifestIssue[],
  path: string,
): string {
  if (typeof value === 'string' && semanticVersionPattern.test(value.trim())) return value.trim()
  addIssue(issues, path, `Missing or invalid version used ${fallback}`)
  return fallback
}

function normalizeHash(
  value: unknown,
  issues: ResourcePackageManifestIssue[],
  path: string,
): string {
  if (typeof value === 'string' && hashPattern.test(value.trim())) return value.trim().toLocaleLowerCase()
  addIssue(issues, path, 'Missing or invalid SHA-256 content hash used an empty value')
  return ''
}

function normalizeDependencies(
  value: unknown,
  issues: ResourcePackageManifestIssue[],
): ResourcePackageDependency[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    addIssue(issues, 'dependencies', 'Expected an array; used an empty list')
    return []
  }
  const result: ResourcePackageDependency[] = []
  const identities = new Set<string>()
  for (const [index, candidate] of value.entries()) {
    const path = `dependencies[${index}]`
    if (!isRecord(candidate)) {
      addIssue(issues, path, 'Expected an object; ignored the entry')
      continue
    }
    const key = typeof candidate.key === 'string' ? normalizeKeySlug(candidate.key) : null
    if (!key) {
      addIssue(issues, `${path}.key`, 'Missing or invalid package Key; ignored the entry')
      continue
    }
    if (identities.has(key)) {
      addIssue(issues, `${path}.key`, 'Duplicate dependency Key was ignored')
      continue
    }
    identities.add(key)
    result.push({
      key,
      version: normalizeVersion(candidate.version, '0.0.0', issues, `${path}.version`),
      contentHash: normalizeHash(candidate.contentHash, issues, `${path}.contentHash`),
    })
  }
  return result.sort((left, right) => left.key.localeCompare(right.key))
}

function normalizeHostDependencies(
  value: unknown,
  issues: ResourcePackageManifestIssue[],
): ResourcePackageHostDependency[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    addIssue(issues, 'hostDependencies', 'Expected an array; used an empty list')
    return []
  }
  const result: ResourcePackageHostDependency[] = []
  const identities = new Set<string>()
  for (const [index, candidate] of value.entries()) {
    const path = `hostDependencies[${index}]`
    if (!isRecord(candidate) || typeof candidate.key !== 'string'
      || typeof candidate.kind !== 'string' || !dependencyKinds.has(candidate.kind as ResourcePackageDependencyKind)) {
      addIssue(issues, path, 'Invalid host dependency was ignored')
      continue
    }
    const key = candidate.key.trim().replace(/\\/g, '/')
    const identity = `${candidate.kind}:${key}`.toLocaleLowerCase()
    if (!key || identities.has(identity)) {
      addIssue(issues, path, 'Empty or duplicate host dependency was ignored')
      continue
    }
    identities.add(identity)
    result.push({
      kind: candidate.kind as ResourcePackageDependencyKind,
      key,
      requiredBy: normalizeStringList(candidate.requiredBy, issues, `${path}.requiredBy`),
    })
  }
  return result.sort((left, right) => `${left.kind}:${left.key}`.localeCompare(`${right.kind}:${right.key}`))
}

export function normalizeResourcePackageManifest(
  value: unknown,
  fallbackKey = 'resource-package',
): ResourcePackageManifestNormalization {
  const issues: ResourcePackageManifestIssue[] = []
  const source = isRecord(value) ? value : {}
  const key = typeof source.key === 'string' ? normalizeKeySlug(source.key) : null
  const resolvedKey = key ?? normalizeKeySlug(fallbackKey) ?? 'resource-package'
  if (!key) addIssue(issues, 'key', `Missing or invalid package Key used ${resolvedKey}`)
  if (source.type !== RESOURCE_PACKAGE_TYPE) addIssue(issues, 'type', 'Invalid package type used the current type')
  const name = typeof source.name === 'string' && source.name.trim() ? source.name.trim() : resolvedKey
  if (name === resolvedKey && source.name !== undefined) addIssue(issues, 'name', 'Missing package name used the package Key')
  const version = normalizeVersion(source.version, '0.0.0', issues, 'version')
  const publicSource = isRecord(source.public) ? source.public : {}
  if (!isRecord(source.public) && source.public !== undefined) addIssue(issues, 'public', 'Expected an object; used empty public indexes')
  return {
    manifest: {
      type: RESOURCE_PACKAGE_TYPE,
      key: resolvedKey,
      name,
      version,
      contentHash: normalizeHash(source.contentHash, issues, 'contentHash'),
      public: {
        fonts: normalizePublicFonts(publicSource.fonts, issues),
        iconSeries: normalizeStringList(publicSource.iconSeries, issues, 'public.iconSeries'),
        assets: normalizeStringList(publicSource.assets, issues, 'public.assets'),
      },
      dependencies: normalizeDependencies(source.dependencies, issues),
      ...(source.hostDependencies !== undefined
        ? { hostDependencies: normalizeHostDependencies(source.hostDependencies, issues) }
        : {}),
    },
    issues,
  }
}

export function serializeResourcePackageManifest(manifest: ResourcePackageManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`
}
