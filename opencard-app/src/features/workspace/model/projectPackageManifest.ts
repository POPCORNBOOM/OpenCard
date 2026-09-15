import { normalizeKeySlug } from '../../../shared/model/keySlug'
import { isRecord } from '../../../shared/model/record'

export const PROJECT_PACKAGE_MANIFEST_TYPE = 'opencard-project-packages' as const

export type ProjectPackageManifest = {
  readonly type: typeof PROJECT_PACKAGE_MANIFEST_TYPE
  readonly packages: Readonly<Record<string, RequiredPackage>>
}
export type RequiredPackage = {
  readonly version: string
  readonly source?: string | null
}

export type ProjectPackageManifestIssue = { readonly path: string; readonly message: string }
export type ProjectPackageManifestReadResult = { readonly manifest: ProjectPackageManifest; readonly issues: readonly ProjectPackageManifestIssue[] }

export function normalizeProjectPackageManifest(value: unknown): ProjectPackageManifestReadResult {
  const issues: ProjectPackageManifestIssue[] = []
  const source = isRecord(value) ? value : {}
  if (source.type !== undefined && source.type !== PROJECT_PACKAGE_MANIFEST_TYPE) issues.push({ path: 'type', message: 'Invalid project package index type was ignored' })
  const rawPackages = isRecord(source.packages) ? source.packages : {}
  if (source.packages !== undefined && !isRecord(source.packages)) issues.push({ path: 'packages', message: 'Expected a Key-to-manifest object; used an empty object' })
  const packages: Record<string, RequiredPackage> = {}
  for (const [rawKey, candidate] of Object.entries(rawPackages)) {
    if (!isRecord(candidate)) { issues.push({ path: `packages.${rawKey}`, message: 'Invalid package requirement was ignored' }); continue }
    const key = normalizeKeySlug(rawKey)
    if (!key) {
      issues.push({ path: `packages.${rawKey}`, message: 'Package Key that is not a single safe slug was ignored' })
      continue
    }
    const version = typeof candidate.version === 'string' ? candidate.version : ''
    const source = candidate.source === undefined || candidate.source === null
      ? undefined
      : typeof candidate.source === 'string' && candidate.source.trim() ? candidate.source.trim() : null
    if (!version || packages[key] || (candidate.source !== undefined && candidate.source !== null && source === null)) {
      issues.push({ path: `packages.${rawKey}`, message: 'Invalid or duplicate package manifest was ignored' })
      continue
    }
    packages[key] = { version, ...(source ? { source } : {}) }
  }
  return { manifest: { type: PROJECT_PACKAGE_MANIFEST_TYPE, packages }, issues }
}

export function serializeProjectPackageManifest(manifest: ProjectPackageManifest): string {
  const ordered = Object.fromEntries(Object.entries(manifest.packages).sort(([left], [right]) => left.localeCompare(right)))
  return `${JSON.stringify({ type: PROJECT_PACKAGE_MANIFEST_TYPE, packages: ordered }, null, 2)}\n`
}
