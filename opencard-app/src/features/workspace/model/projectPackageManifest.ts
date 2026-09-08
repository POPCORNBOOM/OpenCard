import { normalizeResourcePackageManifest, type ResourcePackageManifest } from './resourcePackage'

export const PROJECT_PACKAGE_MANIFEST_TYPE = 'opencard-project-packages' as const

export type ProjectPackageManifest = {
  readonly type: typeof PROJECT_PACKAGE_MANIFEST_TYPE
  readonly packages: Readonly<Record<string, ResourcePackageManifest>>
}

export type ProjectPackageManifestIssue = { readonly path: string; readonly message: string }
export type ProjectPackageManifestReadResult = { readonly manifest: ProjectPackageManifest; readonly issues: readonly ProjectPackageManifestIssue[] }

export function reconcileProjectPackageManifest(
  current: ProjectPackageManifest | undefined,
  installed: ReadonlyMap<string, ResourcePackageManifest | null>,
): ProjectPackageManifest {
  const packages: Record<string, ResourcePackageManifest> = {}
  for (const [key, manifest] of installed) {
    const resolved = manifest ?? current?.packages[key]
    if (resolved) packages[key] = resolved
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
  const packages: Record<string, ResourcePackageManifest> = {}
  for (const [rawKey, candidate] of Object.entries(rawPackages)) {
    const normalized = normalizeResourcePackageManifest(candidate, rawKey)
    const key = normalized.manifest.key
    if (normalized.issues.length || key !== rawKey || packages[key]) {
      issues.push({ path: `packages.${rawKey}`, message: 'Invalid or duplicate package manifest was ignored' })
      continue
    }
    packages[key] = normalized.manifest
  }
  return { manifest: { type: PROJECT_PACKAGE_MANIFEST_TYPE, packages }, issues }
}

export function serializeProjectPackageManifest(manifest: ProjectPackageManifest): string {
  const ordered = Object.fromEntries(Object.entries(manifest.packages).sort(([left], [right]) => left.localeCompare(right)))
  return `${JSON.stringify({ type: PROJECT_PACKAGE_MANIFEST_TYPE, packages: ordered }, null, 2)}\n`
}
