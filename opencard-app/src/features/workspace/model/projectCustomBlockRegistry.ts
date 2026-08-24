import { normalizeKeySlug } from '../../../shared/model/keySlug'
import { PROJECT_CUSTOM_BLOCK_REGISTRY_FILE_NAME } from './projectStructure'

export { PROJECT_CUSTOM_BLOCK_REGISTRY_FILE_NAME }

export type ProjectCustomBlockRegistryEntry = {
  key: string
  name: string
  source: string
}

export type ProjectCustomBlockRegistryDocument = {
  blocks?: readonly ProjectCustomBlockRegistryEntry[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeSource(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const source = value.trim().replace(/\\/g, '/').replace(/^\/+/, '')
  if (!source || source.includes('..') || (!source.toLocaleLowerCase().startsWith('.opencard/blocks/') && source.startsWith('.'))
    || !source.toLocaleLowerCase().endsWith('.ocblock')) return null
  return source
}

export function parseProjectCustomBlockRegistry(value: unknown): ProjectCustomBlockRegistryDocument | null {
  if (!isRecord(value)) return null
  if (value.blocks === undefined) return {}
  if (!Array.isArray(value.blocks)) return null
  const blocks: ProjectCustomBlockRegistryEntry[] = []
  const keys = new Set<string>()
  for (const item of value.blocks) {
    if (!isRecord(item)) continue
    const key = typeof item.key === 'string' ? normalizeKeySlug(item.key) : null
    const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : null
    const source = normalizeSource(item.source)
    if (!key || !name || !source || keys.has(key.toLocaleLowerCase())) continue
    keys.add(key.toLocaleLowerCase())
    blocks.push({ key, name, source })
  }
  return blocks.length > 0 ? { blocks } : {}
}

export function parseProjectCustomBlockRegistryText(content: string): ProjectCustomBlockRegistryDocument | null {
  try { return parseProjectCustomBlockRegistry(JSON.parse(content)) } catch { return null }
}

export function serializeProjectCustomBlockRegistry(document: ProjectCustomBlockRegistryDocument): string {
  const normalized = parseProjectCustomBlockRegistry(document)
  if (!normalized) throw new Error('Invalid blocks.json content')
  return `${JSON.stringify(normalized, null, 2)}\n`
}
