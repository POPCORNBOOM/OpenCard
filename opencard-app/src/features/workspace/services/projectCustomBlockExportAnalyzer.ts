import type { CardBlock, FlowContainerBlock, SimpleContainerBlock } from '../../../entities/card/model'
import type { ProjectCustomBlockPublicField, ProjectCustomBlockResizePolicy } from '../model/projectCustomBlocks'

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
    if (match.index !== undefined && value[match.index - 1] === '\\') continue
    const expression = match[1].trim()
    const normalizedExpression = expression.replace(/:/g, '.')
    const parts = normalizedExpression.split('.').map(part => part.trim())
    const field = parts[parts.length - 1]
    if (!field || !rootFields.has(field)) continue
    if (depth === 0 && (parts.length === 1 || (parts.length === 2 && parts[0] === 'self'))) {
      counts.set(field, (counts.get(field) ?? 0) + 1)
      continue
    }
    const parentDepth = parts.slice(0, -1).filter(part => part === 'parent').length
    if (depth > 0 && parentDepth === depth && parts.length === depth + 1
      && parts.slice(0, -1).every(part => part === 'parent')) {
      counts.set(field, (counts.get(field) ?? 0) + 1)
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
  const definitions = Object.entries(root.additionalFieldDefinition ?? {})
  const keys = new Set(definitions.map(([key]) => key))
  const counts = new Map<string, number>(definitions.map(([key]) => [key, 0]))
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
  const fields = definitions.map(([key, definition], definitionOrder) => ({
    key,
    fieldType: definition.fieldType,
    ...(definition.title ? { title: definition.title } : {}),
    referenceCount: counts.get(key) ?? 0,
    definitionOrder,
    exposed: false,
  })).sort((a, b) => b.referenceCount - a.referenceCount || a.definitionOrder - b.definitionOrder)
  const widthLocked = (scanValue(root.width, keys, 0).size > 0)
  const heightLocked = (scanValue(root.height, keys, 0).size > 0)
  return { fields, resize: { widthLocked, heightLocked } }
}
