import type { CardBlock } from '../../../entities/card/model'
import type { PropertyFieldType } from '../../../entities/card/schema'
import { normalizeKeySlug } from '../../../shared/model/keySlug'
import { PROJECT_INTERNAL_DIRECTORY_NAME } from './projectStructure'

export const PROJECT_CUSTOM_BLOCK_EXTENSION = 'ocblock'
export const PROJECT_CUSTOM_BLOCK_SUFFIX = `.${PROJECT_CUSTOM_BLOCK_EXTENSION}`
export const DEFAULT_PROJECT_CUSTOM_BLOCK_DIRECTORY = 'blocks'
export const PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME = 'manifest.json'
export const PROJECT_CUSTOM_BLOCK_BLOCK_FILE_NAME = 'block.json'
export const PROJECT_CUSTOM_BLOCK_RESOURCES_DIRECTORY_NAME = 'resources'
export const PROJECT_CUSTOM_BLOCK_DEFAULT_VERSION = '0.1.0'
export const PROJECT_CUSTOM_BLOCK_ALWAYS_PUBLIC_FIELD_KEYS = ['name', 'notes'] as const

export type ProjectCustomBlockPublicField = {
  key: string
  fieldType: PropertyFieldType
  title?: string
  defaultValue?: string
}

export type ProjectCustomBlockResizePolicy = {
  widthLocked: boolean
  heightLocked: boolean
}

export type ProjectCustomBlockManifest = {
  type: 'opencard-custom-block'
  packageId: string
  version: string
  name: string
  description?: string
  publicFieldKeys: readonly string[]
}

export type ProjectCustomBlockPackageIssue = {
  code:
    | 'manifest-field-ignored'
    | 'block-unavailable'
    | 'block-entry-ignored'
    | 'resource-unavailable'
    | 'dependency-unavailable'
    | 'dependency-cycle'
    | 'package-structure-ignored'
  path: string
  message: string
}

export type ProjectCustomBlockCatalogEntry = {
  manifest: ProjectCustomBlockManifest
  block: CardBlock
  installationPath: string
  resourceRootPath: string
  issues?: readonly ProjectCustomBlockPackageIssue[]
  hasResourceErrors?: boolean
}

export type ProjectCustomBlockCatalog = ReadonlyMap<string, ProjectCustomBlockCatalogEntry>

export type ProjectCustomBlockManifestCatalogEntry = {
  manifest: ProjectCustomBlockManifest
  installationPath: string
  resourceRootPath: string
  loadState: 'unloaded' | 'loading' | 'ready' | 'error'
  issues?: readonly ProjectCustomBlockPackageIssue[]
  unavailable?: boolean
}

export type ProjectCustomBlockManifestCatalog = ReadonlyMap<string, ProjectCustomBlockManifestCatalogEntry>

const semanticVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function normalizeProjectCustomBlockKey(value: string): string | null {
  return normalizeKeySlug(value)
}

export function createProjectCustomBlockPackageId(publisherKey: string, blockKey: string): string | null {
  const publisher = normalizeProjectCustomBlockKey(publisherKey)
  const block = normalizeProjectCustomBlockKey(blockKey)
  return publisher && block ? `${publisher}/${block}` : null
}

export function normalizeProjectCustomBlockPackageId(value: string): string | null {
  const segments = value.trim().replace(/\\/g, '/').split('/')
  return segments.length === 2
    ? createProjectCustomBlockPackageId(segments[0]!, segments[1]!)
    : null
}

export function splitProjectCustomBlockPackageId(packageId: string): {
  publisherKey: string
  blockKey: string
} | null {
  const normalized = normalizeProjectCustomBlockPackageId(packageId)
  if (!normalized) return null
  const [publisherKey, blockKey] = normalized.split('/')
  return { publisherKey: publisherKey!, blockKey: blockKey! }
}

export function normalizeProjectCustomBlockVersion(value: string): string | null {
  const version = value.trim()
  return semanticVersionPattern.test(version) ? version : null
}

export function projectCustomBlockInstallationRelativePath(packageId: string): string | null {
  const normalized = normalizeProjectCustomBlockPackageId(packageId)
  return normalized
    ? `${PROJECT_INTERNAL_DIRECTORY_NAME}/${DEFAULT_PROJECT_CUSTOM_BLOCK_DIRECTORY}/${normalized}`
    : null
}

export function projectCustomBlockResourceRelativePath(packageId: string): string | null {
  const installationPath = projectCustomBlockInstallationRelativePath(packageId)
  return installationPath ? `${installationPath}/${PROJECT_CUSTOM_BLOCK_RESOURCES_DIRECTORY_NAME}` : null
}

function warn(issues: ProjectCustomBlockPackageIssue[], path: string, message: string): void {
  issues.push({ code: 'manifest-field-ignored', path, message })
}

function parsePublicFieldKeys(value: unknown, issues: ProjectCustomBlockPackageIssue[]): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    warn(issues, 'publicFieldKeys', 'Invalid public field list used an empty list')
    return []
  }
  const fields: string[] = []
  const identities = new Set<string>()
  for (const [index, candidate] of value.entries()) {
    if (typeof candidate !== 'string') {
      warn(issues, `publicFieldKeys[${index}]`, 'Invalid public field Key was ignored')
      continue
    }
    const key = candidate.trim()
    const identity = key.toLocaleLowerCase()
    if (!key || identities.has(identity)) {
      warn(issues, `publicFieldKeys[${index}]`, 'Empty or duplicate public field Key was ignored')
      continue
    }
    identities.add(identity)
    fields.push(key)
  }
  return fields
}


export function normalizeProjectCustomBlockManifest(
  value: unknown,
  fallbackPackageId = 'local/custom-block',
): { manifest: ProjectCustomBlockManifest, issues: readonly ProjectCustomBlockPackageIssue[] } {
  const issues: ProjectCustomBlockPackageIssue[] = []
  const source = isRecord(value) ? value : {}
  const normalizedFallback = normalizeProjectCustomBlockPackageId(fallbackPackageId) ?? 'local/custom-block'
  const packageId = typeof source.packageId === 'string'
    ? normalizeProjectCustomBlockPackageId(source.packageId)
    : null
  if (!packageId) warn(issues, 'packageId', 'Missing or invalid Package ID used the path fallback')
  const resolvedPackageId = packageId ?? normalizedFallback
  const version = typeof source.version === 'string'
    ? normalizeProjectCustomBlockVersion(source.version)
    : null
  if (!version) warn(issues, 'version', `Missing or invalid version used ${PROJECT_CUSTOM_BLOCK_DEFAULT_VERSION}`)
  const parsedPublicFieldKeys = parsePublicFieldKeys(source.publicFieldKeys, issues)
  const alwaysPublicIdentities = new Set(
    PROJECT_CUSTOM_BLOCK_ALWAYS_PUBLIC_FIELD_KEYS.map(key => key.toLocaleLowerCase()),
  )
  const publicFieldKeys = [
    ...PROJECT_CUSTOM_BLOCK_ALWAYS_PUBLIC_FIELD_KEYS,
    ...parsedPublicFieldKeys.filter(key => !alwaysPublicIdentities.has(key.toLocaleLowerCase())),
  ]
  const fallbackName = splitProjectCustomBlockPackageId(resolvedPackageId)?.blockKey ?? 'custom-block'
  return {
    manifest: {
      type: 'opencard-custom-block',
      packageId: resolvedPackageId,
      version: version ?? PROJECT_CUSTOM_BLOCK_DEFAULT_VERSION,
      name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : fallbackName,
      ...(typeof source.description === 'string' && source.description.trim()
        ? { description: source.description.trim() }
        : {}),
      publicFieldKeys,
    },
    issues,
  }
}

export function serializeProjectCustomBlockManifest(manifest: ProjectCustomBlockManifest): string {
  return JSON.stringify(
    normalizeProjectCustomBlockManifest(manifest, manifest.packageId).manifest,
    null,
    2,
  )
}
