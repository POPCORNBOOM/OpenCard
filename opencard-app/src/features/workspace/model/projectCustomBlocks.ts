import type { CardBlock } from '../../../entities/card/model'
import type { PropertyFieldType } from '../../../entities/card/schema'
import type { ProjectFontCompositionMember, ProjectFontFace } from './projectFontRegistry'
import { parseProjectIconSeries, type ProjectIconSeries } from './projectIcons'
export { PROJECT_CUSTOM_BLOCK_REGISTRY_FILE_NAME } from './projectStructure'
export const PROJECT_CUSTOM_BLOCK_EXTENSION = 'ocblock'
export const PROJECT_CUSTOM_BLOCK_SUFFIX = `.${PROJECT_CUSTOM_BLOCK_EXTENSION}`
export const DEFAULT_PROJECT_CUSTOM_BLOCK_DIRECTORY = 'blocks'
export const PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME = 'manifest.json'
export const PROJECT_CUSTOM_BLOCK_BLOCK_FILE_NAME = 'block.json'
export const PROJECT_CUSTOM_BLOCK_ALWAYS_PUBLIC_FIELD_KEYS = ['name', 'notes'] as const

export type ProjectCustomBlockPublicField = { key: string; fieldType: PropertyFieldType
  title?: string; defaultValue?: string }
export type ProjectCustomBlockResizePolicy = { widthLocked: boolean; heightLocked: boolean }
export type ProjectCustomBlockFontFamilyResource = {
  kind: 'family'
  key: string
  name: string
  faces: readonly ProjectFontFace[]
}
export type ProjectCustomBlockFontCompositionResource = {
  kind: 'composition'
  key: string
  name: string
  members: readonly ProjectFontCompositionMember[]
}
export type ProjectCustomBlockFontResource =
  | ProjectCustomBlockFontFamilyResource
  | ProjectCustomBlockFontCompositionResource
export type ProjectCustomBlockImageResource = { key: string; source: string }
export type ProjectCustomBlockResourceIndex = { fonts?: readonly ProjectCustomBlockFontResource[]
  images?: readonly ProjectCustomBlockImageResource[]; iconSeries?: readonly ProjectIconSeries[] }

export type ProjectCustomBlockManifest = { type: 'opencard-custom-block'; customBlockKey: string; name: string
  description?: string; publicFieldKeys: readonly string[]; resize: ProjectCustomBlockResizePolicy
  resources?: ProjectCustomBlockResourceIndex }
export type ProjectCustomBlockPackageIssue = { code: 'manifest-field-ignored' | 'block-unavailable' | 'block-entry-ignored' | 'resource-unavailable'
  path: string; message: string }

export type ProjectCustomBlockRegistryDocument = { blocks?: readonly string[] }
export type ProjectCustomBlockCatalogEntry = { manifest: ProjectCustomBlockManifest; block: CardBlock; archivePath: string
  files: ReadonlyMap<string, Uint8Array>; issues?: readonly ProjectCustomBlockPackageIssue[]; hasResourceErrors?: boolean }

export type ProjectCustomBlockCatalog = ReadonlyMap<string, ProjectCustomBlockCatalogEntry>
export type ProjectCustomBlockManifestCatalogEntry = { manifest: ProjectCustomBlockManifest; archivePath: string
  loadState: 'unloaded' | 'loading' | 'ready' | 'error'; issues?: readonly ProjectCustomBlockPackageIssue[]; unavailable?: boolean }

export type ProjectCustomBlockManifestCatalog = ReadonlyMap<string, ProjectCustomBlockManifestCatalogEntry>

const customBlockKeyPattern = /^[a-z0-9][a-z0-9._-]*$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function normalizeProjectCustomBlockKey(value: string): string | null {
  const key = value.trim()
  return customBlockKeyPattern.test(key) ? key : null
}

function warn(issues: ProjectCustomBlockPackageIssue[], path: string, message: string): void {
  issues.push({ code: 'manifest-field-ignored', path, message })
}

export function normalizeProjectCustomBlockArchivePath(value: string): string | null {
  const path = value.trim().replace(/\\/g, '/').replace(/\/+/g, '/')
  if (!path || path.startsWith('/') || /^[a-z]:\//i.test(path)
    || path.split('/').some(segment => !segment || segment === '.' || segment === '..')
    || !path.toLowerCase().endsWith(PROJECT_CUSTOM_BLOCK_SUFFIX)) return null
  return path
}

function parsePublicFieldKeys(value: unknown, issues: ProjectCustomBlockPackageIssue[]): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    warn(issues, 'publicFieldKeys', 'Invalid public field list used an empty list')
    return []
  }
  const fields: string[] = []
  const keys = new Set<string>()
  for (const [index, candidate] of value.entries()) {
    if (typeof candidate !== 'string') {
      warn(issues, `publicFieldKeys[${index}]`, 'Invalid public field Key was ignored')
      continue
    }
    const key = candidate.trim()
    if (!key || keys.has(key.toLowerCase())) {
      warn(issues, `publicFieldKeys[${index}]`, 'Empty or duplicate public field Key was ignored')
      continue
    }
    keys.add(key.toLowerCase())
    fields.push(key)
  }
  return fields
}

function parseResources(value: unknown, issues: ProjectCustomBlockPackageIssue[]): ProjectCustomBlockResourceIndex {
  if (value === undefined) return {}
  if (!isRecord(value)) {
    warn(issues, 'resources', 'Invalid resource index used an empty index')
    return {}
  }
  const parseList = <T extends { key: string }>(group: string, candidate: unknown, extra: (record: Record<string, unknown>) => boolean): T[] | undefined => {
    if (candidate === undefined) return undefined
    if (!Array.isArray(candidate)) {
      warn(issues, `resources.${group}`, 'Invalid resource list was ignored')
      return undefined
    }
    const seen = new Set<string>()
    const result: T[] = []
    for (const [index, item] of candidate.entries()) {
      if (!isRecord(item) || typeof item.key !== 'string' || !item.key.trim()
        || seen.has(item.key.toLowerCase()) || !extra(item)) {
        warn(issues, `resources.${group}[${index}]`, 'Invalid or duplicate resource was ignored')
        continue
      }
      seen.add(item.key.toLowerCase())
      result.push(item as T)
    }
    return result
  }
  const parseRange = (candidate: unknown, minimum: number, maximum: number): { min: number; max: number } | null => (
    isRecord(candidate)
      && typeof candidate.min === 'number'
      && typeof candidate.max === 'number'
      && Number.isFinite(candidate.min)
      && Number.isFinite(candidate.max)
      && candidate.min >= minimum
      && candidate.max <= maximum
      && candidate.min <= candidate.max
      ? { min: candidate.min, max: candidate.max }
      : null
  )
  const parseFont = (item: Record<string, unknown>): boolean => {
    if (typeof item.name !== 'string' || !item.name.trim()) return false
    if (item.kind === 'family') {
      if (!Array.isArray(item.faces)) return false
      return item.faces.every(face => {
        if (!isRecord(face) || typeof face.source !== 'string'
          || !face.source.replace(/\\/g, '/').toLowerCase().startsWith('resources/fonts/')) return false
        const weight = parseRange(face.weight, 1, 1000)
        const stretch = parseRange(face.stretch, 0.01, 1000)
        if (!weight || !stretch || !isRecord(face.style)) return false
        if (face.style.kind === 'normal' || face.style.kind === 'italic') return true
        return face.style.kind === 'oblique' && Boolean(parseRange(face.style.angle, -90, 90))
      })
    }
    if (item.kind !== 'composition' || !Array.isArray(item.members)) return false
    return item.members.every(member => {
      if (!isRecord(member) || typeof member.familyKey !== 'string' || !member.familyKey.trim()) return false
      if (member.ranges === undefined) return true
      return Array.isArray(member.ranges) && member.ranges.length > 0 && member.ranges.every(range => (
        isRecord(range)
        && Number.isInteger(range.start)
        && Number.isInteger(range.end)
        && (range.start as number) >= 0
        && (range.end as number) <= 0x10ffff
        && (range.start as number) <= (range.end as number)
      ))
    })
  }
  const fonts = parseList<ProjectCustomBlockFontResource>('fonts', value.fonts, parseFont)
  const images = parseList<ProjectCustomBlockImageResource>('images', value.images, item => typeof item.source === 'string')
  const iconSeries = Array.isArray(value.iconSeries)
    ? value.iconSeries.flatMap((candidate, index) => {
        const parsed = parseProjectIconSeries([candidate])
        if (parsed) return parsed
        warn(issues, `resources.iconSeries[${index}]`, 'Invalid icon series was ignored')
        return []
      })
    : undefined
  return {
    ...(fonts ? { fonts } : {}),
    ...(images ? { images } : {}),
    ...(iconSeries ? { iconSeries } : {}),
  }
}

function parseResize(value: unknown): ProjectCustomBlockResizePolicy {
  return {
    widthLocked: isRecord(value) && typeof value.widthLocked === 'boolean' ? value.widthLocked : false,
    heightLocked: isRecord(value) && typeof value.heightLocked === 'boolean' ? value.heightLocked : false,
  }
}

export function normalizeProjectCustomBlockManifest(
  value: unknown,
  fallbackKey = 'custom-block',
): { manifest: ProjectCustomBlockManifest, issues: readonly ProjectCustomBlockPackageIssue[] } {
  const issues: ProjectCustomBlockPackageIssue[] = []
  const source = isRecord(value) ? value : {}
  const customBlockKey = typeof source.customBlockKey === 'string'
    ? normalizeProjectCustomBlockKey(source.customBlockKey)
    : null
  const normalizedFallback = normalizeProjectCustomBlockKey(fallbackKey) ?? 'custom-block'
  if (!customBlockKey) warn(issues, 'customBlockKey', 'Missing or invalid custom Block Key used the filename fallback')
  const key = customBlockKey ?? normalizedFallback
  const parsedPublicFieldKeys = parsePublicFieldKeys(source.publicFieldKeys, issues)
  const alwaysPublicKeys = new Set(PROJECT_CUSTOM_BLOCK_ALWAYS_PUBLIC_FIELD_KEYS.map(key => key.toLowerCase()))
  const publicFieldKeys = [
    ...PROJECT_CUSTOM_BLOCK_ALWAYS_PUBLIC_FIELD_KEYS,
    ...parsedPublicFieldKeys.filter(key => !alwaysPublicKeys.has(key.toLowerCase())),
  ]
  const resize = parseResize(source.resize)
  const resources = parseResources(source.resources, issues)
  return { manifest: {
    type: 'opencard-custom-block',
    customBlockKey: key,
    name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : key,
    ...(typeof source.description === 'string' && source.description.trim() ? { description: source.description.trim() } : {}),
    publicFieldKeys,
    resize,
    ...(Object.keys(resources).length ? { resources } : {}),
  }, issues }
}

export function serializeProjectCustomBlockManifest(manifest: ProjectCustomBlockManifest): string {
  return JSON.stringify(normalizeProjectCustomBlockManifest(manifest, manifest.customBlockKey).manifest, null, 2)
}

export function parseProjectCustomBlockRegistry(value: unknown): ProjectCustomBlockRegistryDocument | null {
  if (!isRecord(value)) return null
  if (value.blocks === undefined) return {}
  if (!Array.isArray(value.blocks)) return null
  const blocks: string[] = []
  const seen = new Set<string>()
  for (const candidate of value.blocks) {
    if (typeof candidate !== 'string') return null
    const path = normalizeProjectCustomBlockArchivePath(candidate)
    if (!path || seen.has(path.toLowerCase())) return null
    seen.add(path.toLowerCase())
    blocks.push(path)
  }
  return { blocks }
}

export function parseProjectCustomBlockRegistryText(content: string): ProjectCustomBlockRegistryDocument | null {
  try {
    return parseProjectCustomBlockRegistry(JSON.parse(content))
  } catch {
    return null
  }
}

export function serializeProjectCustomBlockRegistry(document: ProjectCustomBlockRegistryDocument): string {
  const normalized = parseProjectCustomBlockRegistry(document)
  if (!normalized) throw new Error('Invalid custom block registry')
  return JSON.stringify(normalized, null, 2)
}
