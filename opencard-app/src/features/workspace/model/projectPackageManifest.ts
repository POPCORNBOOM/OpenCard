import { normalizeKeySlug } from '../../../shared/model/keySlug'

export const PROJECT_PACKAGE_MANIFEST_TYPE = 'opencard-project-packages' as const
export const PROJECT_PACKAGE_MANIFEST_FILE_NAME = 'packages/packages.json'

export type ProjectPackageRequirement = {
  readonly key: string
  readonly version: string
  readonly repositoryPath?: string
}

export type ProjectPackageManifest = {
  readonly type: typeof PROJECT_PACKAGE_MANIFEST_TYPE
  readonly packages: readonly ProjectPackageRequirement[]
}

export type ProjectPackageManifestIssue = {
  readonly path: string
  readonly message: string
}

export type ProjectPackageManifestReadResult = {
  readonly manifest: ProjectPackageManifest
  readonly issues: readonly ProjectPackageManifestIssue[]
}

export type ProjectPackageDifferenceKind = 'missing' | 'version-mismatch' | 'extra'

export type ProjectPackageDifference = {
  readonly kind: ProjectPackageDifferenceKind
  readonly key: string
  readonly requestedVersion?: string
  readonly installedVersion?: string
  readonly repositoryPath?: string
}

export type ProjectPackageAction =
  | 'import-local-package'
  | 'check-repository'
  | 'install-package'
  | 'update-package'
  | 'open-repository'
  | 'remove-declaration'

export function projectPackageActions(difference: ProjectPackageDifference): readonly ProjectPackageAction[] {
  if (difference.kind === 'missing') return difference.repositoryPath
    ? ['check-repository', 'install-package', 'import-local-package']
    : ['import-local-package']
  if (difference.kind === 'version-mismatch') return difference.repositoryPath
    ? ['check-repository', 'update-package', 'import-local-package']
    : ['import-local-package']
  return ['remove-declaration']
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function normalizeProjectPackageManifest(value: unknown): ProjectPackageManifestReadResult {
  const issues: ProjectPackageManifestIssue[] = []
  const source = isRecord(value) ? value : {}
  if (source.type !== undefined && source.type !== PROJECT_PACKAGE_MANIFEST_TYPE) {
    issues.push({ path: 'type', message: 'Invalid project package manifest type was ignored' })
  }
  const rawPackages = source.packages
  if (rawPackages !== undefined && !Array.isArray(rawPackages)) {
    issues.push({ path: 'packages', message: 'Expected an array; used an empty list' })
  }
  const packages: ProjectPackageRequirement[] = []
  const identities = new Set<string>()
  for (const [index, candidate] of (Array.isArray(rawPackages) ? rawPackages : []).entries()) {
    if (!isRecord(candidate)) {
      issues.push({ path: `packages[${index}]`, message: 'Expected a package requirement object' })
      continue
    }
    const key = typeof candidate.key === 'string' ? normalizeKeySlug(candidate.key) : null
    const version = typeof candidate.version === 'string' ? candidate.version.trim() : ''
    const repositoryPath = typeof candidate.repositoryPath === 'string' ? candidate.repositoryPath.trim() : ''
    if (!key || !version) {
      issues.push({ path: `packages[${index}]`, message: 'Package Key and target version are required' })
      continue
    }
    if (identities.has(key)) {
      issues.push({ path: `packages[${index}].key`, message: 'Duplicate package Key was ignored' })
      continue
    }
    identities.add(key)
    packages.push({ key, version, ...(repositoryPath ? { repositoryPath } : {}) })
  }
  packages.sort((left, right) => left.key.localeCompare(right.key))
  return {
    manifest: { type: PROJECT_PACKAGE_MANIFEST_TYPE, packages },
    issues,
  }
}

export function serializeProjectPackageManifest(manifest: ProjectPackageManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`
}

export function compareProjectPackageManifest(
  manifest: ProjectPackageManifest,
  installed: ReadonlyMap<string, { version: string }>,
): readonly ProjectPackageDifference[] {
  const differences: ProjectPackageDifference[] = []
  const requested = new Set<string>()
  for (const requirement of manifest.packages) {
    requested.add(requirement.key)
    const current = installed.get(requirement.key)
    if (!current) {
      differences.push({ kind: 'missing', key: requirement.key, requestedVersion: requirement.version, repositoryPath: requirement.repositoryPath })
    } else if (current.version !== requirement.version) {
      differences.push({
        kind: 'version-mismatch', key: requirement.key,
        requestedVersion: requirement.version, installedVersion: current.version,
        repositoryPath: requirement.repositoryPath,
      })
    }
  }
  for (const [key, current] of installed) {
    if (!requested.has(key)) differences.push({ kind: 'extra', key, installedVersion: current.version })
  }
  return differences.sort((left, right) => left.key.localeCompare(right.key) || left.kind.localeCompare(right.kind))
}
