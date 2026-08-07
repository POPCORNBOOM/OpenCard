import type { CardBlock } from '../../../entities/card/model'
import { additionalFieldTypes, type PropertyFieldType } from '../../../entities/card/schema'
import type { ProjectIconSeries } from './projectIcons'

export const PROJECT_CUSTOM_BLOCK_REGISTRY_FILE_NAME = '.ocblocks'
export const PROJECT_CUSTOM_BLOCK_EXTENSION = 'ocblock'
export const PROJECT_CUSTOM_BLOCK_SUFFIX = `.${PROJECT_CUSTOM_BLOCK_EXTENSION}`
export const PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME = 'block.json'
export const PROJECT_CUSTOM_BLOCK_SCHEMA_VERSION = '1'

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

export type ProjectCustomBlockFontResource = {
  key: string
  name: string
  source: string
}

export type ProjectCustomBlockImageResource = {
  key: string
  source: string
}

export type ProjectCustomBlockResourceIndex = {
  fonts?: readonly ProjectCustomBlockFontResource[]
  images?: readonly ProjectCustomBlockImageResource[]
  iconSeries?: readonly ProjectIconSeries[]
}

export type ProjectCustomBlockManifest = {
  type: 'opencard-custom-block'
  schemaVersion: typeof PROJECT_CUSTOM_BLOCK_SCHEMA_VERSION
  key: string
  name: string
  description?: string
  interfaceHash: string
  root: CardBlock
  publicFields: readonly ProjectCustomBlockPublicField[]
  resize: ProjectCustomBlockResizePolicy
  resources?: ProjectCustomBlockResourceIndex
}

export type ProjectCustomBlockRegistryDocument = {
  blocks?: readonly string[]
}

export type ProjectCustomBlockCatalogEntry = {
  manifest: ProjectCustomBlockManifest
  archivePath: string
  files: ReadonlyMap<string, Uint8Array>
}

export type ProjectCustomBlockCatalog = ReadonlyMap<string, ProjectCustomBlockCatalogEntry>

const additionalFieldTypeSet = new Set<string>(additionalFieldTypes)

const customBlockKeyPattern = /^[a-z0-9][a-z0-9._-]*$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function normalizeProjectCustomBlockKey(value: string): string | null {
  const key = value.trim()
  return customBlockKeyPattern.test(key) ? key : null
}

export function normalizeProjectCustomBlockArchivePath(value: string): string | null {
  const path = value.trim().replace(/\\/g, '/').replace(/\/+/g, '/')
  if (!path || path.startsWith('/') || /^[a-z]:\//i.test(path)
    || path.split('/').some(segment => !segment || segment === '.' || segment === '..')
    || !path.toLocaleLowerCase().endsWith(PROJECT_CUSTOM_BLOCK_SUFFIX)) return null
  return path
}

function parsePublicFields(value: unknown): ProjectCustomBlockPublicField[] | null {
  if (!Array.isArray(value)) return null
  const fields: ProjectCustomBlockPublicField[] = []
  const keys = new Set<string>()
  for (const candidate of value) {
    if (!isRecord(candidate) || typeof candidate.key !== 'string'
      || typeof candidate.fieldType !== 'string' || keys.has(candidate.key.toLocaleLowerCase())) return null
    const key = candidate.key.trim()
    if (!key || keys.has(key.toLocaleLowerCase())) return null
    if (candidate.title !== undefined && typeof candidate.title !== 'string') return null
    if (candidate.defaultValue !== undefined && typeof candidate.defaultValue !== 'string') return null
    if (!additionalFieldTypeSet.has(candidate.fieldType)) return null
    keys.add(key.toLocaleLowerCase())
    fields.push({
      key,
      fieldType: candidate.fieldType as PropertyFieldType,
      ...(candidate.title ? { title: candidate.title.trim() } : {}),
      ...(candidate.defaultValue !== undefined ? { defaultValue: candidate.defaultValue } : {}),
    })
  }
  return fields
}

function parseResources(value: unknown): ProjectCustomBlockResourceIndex | null {
  if (value === undefined) return {}
  if (!isRecord(value)) return null
  const parseList = <T extends { key: string }>(candidate: unknown, extra: (record: Record<string, unknown>) => boolean): T[] | undefined | null => {
    if (candidate === undefined) return undefined
    if (!Array.isArray(candidate)) return null
    const seen = new Set<string>()
    const result: T[] = []
    for (const item of candidate) {
      if (!isRecord(item) || typeof item.key !== 'string' || !item.key.trim() || seen.has(item.key.toLocaleLowerCase()) || !extra(item)) return null
      seen.add(item.key.toLocaleLowerCase())
      result.push(item as T)
    }
    return result
  }
  const fonts = parseList<ProjectCustomBlockFontResource>(value.fonts, item => typeof item.name === 'string' && typeof item.source === 'string')
  const images = parseList<ProjectCustomBlockImageResource>(value.images, item => typeof item.source === 'string')
  if (fonts === null || images === null) return null
  if (value.iconSeries !== undefined && !Array.isArray(value.iconSeries)) return null
  return {
    ...(fonts ? { fonts } : {}),
    ...(images ? { images } : {}),
    ...(value.iconSeries ? { iconSeries: value.iconSeries as ProjectIconSeries[] } : {}),
  }
}

function parseResize(value: unknown): ProjectCustomBlockResizePolicy | null {
  if (!isRecord(value) || typeof value.widthLocked !== 'boolean' || typeof value.heightLocked !== 'boolean') return null
  return { widthLocked: value.widthLocked, heightLocked: value.heightLocked }
}

export function parseProjectCustomBlockManifest(value: unknown): ProjectCustomBlockManifest | null {
  if (!isRecord(value) || value.type !== 'opencard-custom-block'
    || value.schemaVersion !== PROJECT_CUSTOM_BLOCK_SCHEMA_VERSION
    || typeof value.key !== 'string' || !normalizeProjectCustomBlockKey(value.key)
    || typeof value.name !== 'string' || !value.name.trim()
    || typeof value.interfaceHash !== 'string' || !value.interfaceHash.trim()
    || !isRecord(value.root) || typeof value.root.type !== 'string'
    || typeof value.root.id !== 'string') return null
  const publicFields = parsePublicFields(value.publicFields)
  const resize = parseResize(value.resize)
  if (!publicFields || !resize) return null
  if (value.description !== undefined && typeof value.description !== 'string') return null
  const resources = parseResources(value.resources)
  if (!resources) return null
  return {
    type: 'opencard-custom-block',
    schemaVersion: PROJECT_CUSTOM_BLOCK_SCHEMA_VERSION,
    key: value.key.trim(),
    name: value.name.trim(),
    ...(value.description ? { description: value.description.trim() } : {}),
    interfaceHash: value.interfaceHash.trim(),
    root: value.root as CardBlock,
    publicFields,
    resize,
    ...(Object.keys(resources).length ? { resources } : {}),
  }
}

/** Stable interface contract hash. Titles/defaults intentionally do not participate. */
export async function computeProjectCustomBlockInterfaceHash(
  fields: readonly ProjectCustomBlockPublicField[],
  resize: ProjectCustomBlockResizePolicy,
): Promise<string> {
  const canonical = JSON.stringify({
    fields: [...fields].map(field => ({ key: field.key, fieldType: field.fieldType })).sort((a, b) => a.key.localeCompare(b.key)),
    resize,
  })
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

export function serializeProjectCustomBlockManifest(manifest: ProjectCustomBlockManifest): string {
  const normalized = parseProjectCustomBlockManifest(manifest)
  if (!normalized) throw new Error('Invalid custom block manifest')
  return JSON.stringify(normalized, null, 2)
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
    if (!path || seen.has(path.toLocaleLowerCase())) return null
    seen.add(path.toLocaleLowerCase())
    blocks.push(path)
  }
  return blocks.length > 0 ? { blocks } : {}
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
