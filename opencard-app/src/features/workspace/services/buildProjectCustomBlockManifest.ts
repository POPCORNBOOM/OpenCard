import type { CardBlock } from '../../../entities/card/model'
import { visitCardBlockTree } from '../../../entities/card/tree'
import { parseAdditionalFieldDefinitions } from '../../../entities/card/schema'
import {
  createProjectCustomBlockPackageId,
  normalizeProjectCustomBlockVersion,
  PROJECT_CUSTOM_BLOCK_ALWAYS_PUBLIC_FIELD_KEYS,
  PROJECT_CUSTOM_BLOCK_DEFAULT_VERSION,
  type ProjectCustomBlockManifest,
  type ProjectCustomBlockResizePolicy,
} from '../model/projectCustomBlocks'
import { analyzeProjectCustomBlockExport } from './projectCustomBlockExportAnalyzer'

function clonePackageValue<T>(value: T, seen = new WeakMap<object, object>()): T {
  if (value === null || typeof value !== 'object') return value
  const source = value as object
  const existing = seen.get(source)
  if (existing) return existing as T
  const copy: unknown[] | Record<string, unknown> = Array.isArray(value) ? [] : {}
  seen.set(source, copy)
  for (const [key, entry] of Object.entries(source)) {
    ;(copy as Record<string, unknown>)[key] = clonePackageValue(entry, seen)
  }
  return copy as T
}

export function buildProjectCustomBlockRoot(
  root: CardBlock,
  resize?: ProjectCustomBlockResizePolicy,
): CardBlock {
  const cloned = clonePackageValue(root)
  visitCardBlockTree(cloned, block => {
    const rawDefinitions = block.additionalFieldDefinition
    if (rawDefinitions !== undefined) {
      const definitions = parseAdditionalFieldDefinitions(rawDefinitions, [], block.type)
      if (Object.keys(definitions).length > 0) block.additionalFieldDefinition = definitions
      else delete block.additionalFieldDefinition
    }
    if (block.type === 'simple-container-block' || block.type === 'flow-container-block') delete block.packaged
  })
  if (resize) {
    setRootFieldReadonly(cloned, 'width', resize.widthLocked)
    setRootFieldReadonly(cloned, 'height', resize.heightLocked)
  }
  return cloned
}

function setRootFieldReadonly(
  root: CardBlock,
  fieldKey: 'width' | 'height',
  readonly: boolean,
): void {
  const definitions = { ...(root.additionalFieldDefinition ?? {}) }
  const current = definitions[fieldKey]
  if (readonly) {
    definitions[fieldKey] = { ...(current ?? {}), isReadonly: true } as typeof definitions[string]
  } else if (current) {
    const { isReadonly: _isReadonly, ...next } = current
    if (Object.keys(next).length === 0) delete definitions[fieldKey]
    else definitions[fieldKey] = next as typeof current
  }
  if (Object.keys(definitions).length > 0) root.additionalFieldDefinition = definitions
  else delete root.additionalFieldDefinition
}

export async function buildProjectCustomBlockManifest(options: {
  root: CardBlock
  publisherKey: string
  blockKey: string
  version?: string
  name?: string
  description?: string
  exposedFieldKeys?: readonly string[]
}): Promise<ProjectCustomBlockManifest> {
  const packageId = createProjectCustomBlockPackageId(options.publisherKey, options.blockKey)
  if (!packageId) throw new Error('Invalid custom block Package ID')
  const version = normalizeProjectCustomBlockVersion(options.version ?? PROJECT_CUSTOM_BLOCK_DEFAULT_VERSION)
  if (!version) throw new Error('Invalid custom block version')
  const analysis = analyzeProjectCustomBlockExport(options.root)
  const exposed = new Set(options.exposedFieldKeys ?? [])
  const exposableKeys = new Set(analysis.fields.map(field => field.key))
  for (const fieldKey of exposed) {
    if (!exposableKeys.has(fieldKey)) {
      throw new Error(`Custom block public field is not available on the root: ${fieldKey}`)
    }
  }
  const publicFieldKeys = [
    ...PROJECT_CUSTOM_BLOCK_ALWAYS_PUBLIC_FIELD_KEYS,
    ...analysis.fields.filter(field => exposed.has(field.key)).map(field => field.key),
  ]
  return {
    type: 'opencard-custom-block',
    packageId,
    version,
    name: options.name?.trim() || options.root.name?.trim() || options.blockKey,
    ...(options.description?.trim() ? { description: options.description.trim() } : {}),
    publicFieldKeys,
  }
}
