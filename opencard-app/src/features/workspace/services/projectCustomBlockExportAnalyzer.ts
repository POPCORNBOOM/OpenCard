import type { CardBlock, FlowContainerBlock, SimpleContainerBlock } from '../../../entities/card/model'
import { getTypePropertyEditorSchema, parseAdditionalFieldDefinitions } from '../../../entities/card/schema'
import { isBindingStartEscaped, parseFieldReference } from '../../editor-runtime/model/bindingExpression'
import { PROJECT_CUSTOM_BLOCK_ALWAYS_PUBLIC_FIELD_KEYS,
  type ProjectCustomBlockPublicField, type ProjectCustomBlockResizePolicy } from '../model/projectCustomBlocks'

export type CustomBlockFieldAnalysis = ProjectCustomBlockPublicField & {
  referenceCount: number
  definitionOrder: number
  exposed: boolean
}

export type CustomBlockExportAnalysis = {
  fields: readonly CustomBlockFieldAnalysis[]
  resize: ProjectCustomBlockResizePolicy
}

const bindingTokenPattern = /\{\{\s*([^{}]+?)\s*\}\}/g

function isContainer(block: CardBlock): block is SimpleContainerBlock | FlowContainerBlock {
  return block.type === 'simple-container-block' || block.type === 'flow-container-block'
}

function scanValue(value: unknown, rootFields: ReadonlySet<string>, depth: number): Map<string, number> {
  if (typeof value !== 'string') return new Map()
  const counts = new Map<string, number>()
  for (const match of value.matchAll(bindingTokenPattern)) {
    if (match.index !== undefined && isBindingStartEscaped(value, match.index)) continue
    const reference = parseFieldReference(match[1])
    if (!reference || !rootFields.has(reference.fieldKey)) continue
    if (depth === 0 && reference.kind === 'current-block') {
      counts.set(reference.fieldKey, (counts.get(reference.fieldKey) ?? 0) + 1)
      continue
    }
    if (depth > 0 && reference.kind === 'parent' && reference.parentDepth === depth) {
      counts.set(reference.fieldKey, (counts.get(reference.fieldKey) ?? 0) + 1)
    }
  }
  return counts
}

function scanRecord(value: unknown, rootFields: ReadonlySet<string>, depth: number, seen: Set<object>): Map<string, number> {
  if (!value || typeof value !== 'object') return scanValue(value, rootFields, depth)
  if (seen.has(value)) return new Map()
  seen.add(value)
  const counts = new Map<string, number>()
  const merge = (next: Map<string, number>) => next.forEach((count, key) => counts.set(key, (counts.get(key) ?? 0) + count))
  if (Array.isArray(value)) {
    for (const item of value) merge(scanRecord(item, rootFields, depth, seen))
  } else {
    for (const item of Object.values(value)) merge(scanRecord(item, rootFields, depth, seen))
  }
  return counts
}

export function analyzeProjectCustomBlockExport(root: CardBlock): CustomBlockExportAnalysis {
  const alwaysPublicKeys = new Set(PROJECT_CUSTOM_BLOCK_ALWAYS_PUBLIC_FIELD_KEYS.map(key => key.toLowerCase()))
  const nativeFields = Object.entries(getTypePropertyEditorSchema(root.type)).flatMap(([key, definition]) => (
    key === 'width' || key === 'height' || alwaysPublicKeys.has(key.toLowerCase())
      || definition.isHidden || definition.isReadonly || definition.fieldType === 'object'
      ? []
      : [{ key, fieldType: definition.fieldType, title: undefined }]
  ))
  const nativeKeys = new Set(nativeFields.map(field => field.key.toLowerCase()))
  const additionalFields = Object.entries(parseAdditionalFieldDefinitions(root.additionalFieldDefinition))
    .flatMap(([key, definition]) => nativeKeys.has(key.toLowerCase()) ? [] : [{ key, ...definition }])
  const definitions = [...nativeFields, ...additionalFields]
  const keys = new Set(definitions.map(definition => definition.key))
  const counts = new Map<string, number>(definitions.map(definition => [definition.key, 0]))
  const seen = new Set<object>()
  const mergeCounts = (next: Map<string, number>) => next.forEach((count, key) => counts.set(key, (counts.get(key) ?? 0) + count))
  const visit = (block: CardBlock, depth: number) => {
    const ownFields = Object.fromEntries(Object.entries(block)
      .filter(([key]) => key !== 'children' && key !== 'additionalFieldDefinition'))
    mergeCounts(scanRecord(ownFields, keys, depth, seen))
    if (!isContainer(block)) return
    for (const child of block.children) {
      visit(child.block, depth + 1)
      mergeCounts(scanRecord(child.location, keys, depth + 1, seen))
    }
  }
  visit(root, 0)
  const fields = definitions.map((definition, definitionOrder) => ({
    ...definition,
    referenceCount: counts.get(definition.key) ?? 0,
    definitionOrder,
    exposed: false,
  })).sort((a, b) => b.referenceCount - a.referenceCount || a.definitionOrder - b.definitionOrder)
  const widthLocked = (scanValue(root.width, keys, 0).size > 0)
  const heightLocked = (scanValue(root.height, keys, 0).size > 0)
  return { fields, resize: { widthLocked, heightLocked } }
}
