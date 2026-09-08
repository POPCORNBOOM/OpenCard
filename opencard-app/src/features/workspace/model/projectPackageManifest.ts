import type { ResourcePackageManifest } from './resourcePackage'

export const PROJECT_PACKAGE_MANIFEST_TYPE = 'opencard-project-packages' as const

export type ProjectPackageManifest = {
  readonly type: typeof PROJECT_PACKAGE_MANIFEST_TYPE
  readonly packages: Readonly<Record<string, RequiredPackage>>
}
export type RequiredPackage = Pick<ResourcePackageManifest, 'key' | 'name' | 'version' | 'contentHash'>

export type ProjectPackageManifestIssue = { readonly path: string; readonly message: string }
export type ProjectPackageManifestReadResult = { readonly manifest: ProjectPackageManifest; readonly issues: readonly ProjectPackageManifestIssue[] }

export function reconcileProjectPackageManifest(
  current: ProjectPackageManifest | undefined,
  installed: ReadonlyMap<string, ResourcePackageManifest | null>,
): ProjectPackageManifest {
  const packages: Record<string, RequiredPackage> = {}
  for (const [key, required] of Object.entries(current?.packages ?? {})) packages[key] = required
  for (const [key, manifest] of installed) {
    if (!current && manifest) {
      packages[key] = { key: manifest.key, name: manifest.name, version: manifest.version, contentHash: manifest.contentHash }
    }
  }
  return { type: PROJECT_PACKAGE_MANIFEST_TYPE, packages }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function normalizeProjectPackageManifest(value: unknown): ProjectPackageManifestReadResult {
  const issues: ProjectPackageManifestIssue[] = []
  const source = isRecord(value) ? value : {}
  if (source.type !== undefined && source.type !== PROJECT_PACKAGE_MANIFEST_TYPE) issues.push({ path: 'type', message: 'Invalid project package index type was ignored' })
  const rawPackages = isRecord(source.packages) ? source.packages : {}
  if (source.packages !== undefined && !isRecord(source.packages)) issues.push({ path: 'packages', message: 'Expected a Key-to-manifest object; used an empty object' })
  const packages: Record<string, RequiredPackage> = {}
  for (const [rawKey, candidate] of Object.entries(rawPackages)) {
    if (!isRecord(candidate)) { issues.push({ path: `packages.${rawKey}`, message: 'Invalid package requirement was ignored' }); continue }
    const key = typeof candidate.key === 'string' ? candidate.key : rawKey
    const name = typeof candidate.name === 'string' ? candidate.name : ''
    const version = typeof candidate.version === 'string' ? candidate.version : ''
    const contentHash = typeof candidate.contentHash === 'string' ? candidate.contentHash : ''
    if (!key || !name || !version || !contentHash || key !== rawKey || packages[key]) {
      issues.push({ path: `packages.${rawKey}`, message: 'Invalid or duplicate package manifest was ignored' })
      continue
    }
    packages[key] = { key, name, version, contentHash }
  }
  return { manifest: { type: PROJECT_PACKAGE_MANIFEST_TYPE, packages }, issues }
}

export function serializeProjectPackageManifest(manifest: ProjectPackageManifest): string {
  const ordered = Object.fromEntries(Object.entries(manifest.packages).sort(([left], [right]) => left.localeCompare(right)))
  return `${JSON.stringify({ type: PROJECT_PACKAGE_MANIFEST_TYPE, packages: ordered }, null, 2)}\n`
}
