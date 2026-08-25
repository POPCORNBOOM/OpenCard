import { getBlockProperty, type CardBlock } from '../../../entities/card/model'
import { visitCardBlockTree } from '../../../entities/card/tree'
import { parseAdditionalFieldDefinitions, resolvePropertyEditorSchema } from '../../../entities/card/schema'
import { PROJECT_CUSTOM_BLOCK_ALWAYS_PUBLIC_FIELD_KEYS } from '../model/projectCustomBlocks'
import { normalizeKeySlug } from '../../../shared/model/keySlug'
import type { ProjectCustomBlockDefinition } from './projectCustomBlockDefinition'
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
  exposedFieldKeys: readonly string[] = [],
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
  const exposed = new Set(exposedFieldKeys.map(key => key.toLocaleLowerCase()))
  for (const fieldKey of Object.keys(resolvePropertyEditorSchema(cloned as Readonly<Record<string, unknown>>).fields)) {
    if (fieldKey === 'width' || fieldKey === 'height') {
      setRootFieldReadonly(cloned, fieldKey, !exposed.has(fieldKey.toLocaleLowerCase()))
    }
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

export async function buildProjectCustomBlockDefinition(options: {
  root: CardBlock
  key: string
  name?: string
  exposedFieldKeys?: readonly string[]
}): Promise<ProjectCustomBlockDefinition> {
  const key = normalizeKeySlug(options.key)
  if (!key) throw new Error('Invalid custom block Key')
  const analysis = analyzeProjectCustomBlockExport(options.root)
  const exposed = new Set(options.exposedFieldKeys ?? [])
  const exposableKeys = new Set(analysis.fields.map(field => field.key))
  for (const fieldKey of exposed) {
    if (!exposableKeys.has(fieldKey)) {
      throw new Error(`Custom block public field is not available on the root: ${fieldKey}`)
    }
  }
  return {
    type: 'opencard-custom-block',
    key,
    name: options.name?.trim() || getBlockProperty<string>(options.root, 'name')?.trim() || key,
    root: options.root,
    publicFieldKeys: [
      ...PROJECT_CUSTOM_BLOCK_ALWAYS_PUBLIC_FIELD_KEYS,
      ...analysis.fields.filter(field => exposed.has(field.key)).map(field => field.key),
    ],
    declaredResourceDependencies: [],
  }
}
