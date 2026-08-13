import type { CardBlock, CardDocument, CardFace, CardInstanceRecord } from '../../../entities/card/model'

export type CardComparisonChanges = {
  documentChanged: boolean
  faceIds: ReadonlySet<string>
  addedFaceIds: ReadonlySet<string>
  removedFaceIds: ReadonlySet<string>
  instanceIds: ReadonlySet<string>
  addedInstanceIds: ReadonlySet<string>
  removedInstanceIds: ReadonlySet<string>
  blockIds: ReadonlySet<string>
  addedBlockIds: ReadonlySet<string>
  removedBlockIds: ReadonlySet<string>
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableValue(entry)]),
  )
}

function differs(left: unknown, right: unknown): boolean {
  return JSON.stringify(stableValue(left)) !== JSON.stringify(stableValue(right))
}

function withoutChildren(value: CardBlock | CardFace): Record<string, unknown> {
  const { children: _children, ...record } = value as CardBlock & { children?: unknown }
  return record
}

function collectBlocks(document: CardDocument): Map<string, CardBlock> {
  const blocks = new Map<string, CardBlock>()
  const visit = (block: CardBlock): void => {
    blocks.set(block.id, block)
    if ('children' in block) block.children.forEach(child => visit(child.block))
  }
  for (const face of Object.values(document.faces)) face.children.forEach(child => visit(child.block))
  return blocks
}

function collectFaces(document: CardDocument): Map<string, CardFace> {
  return new Map(Object.values(document.faces).map(face => [face.id, face]))
}

function collectInstances(document: CardDocument): Map<string, CardInstanceRecord> {
  return new Map(document.instances.map(instance => [instance.id, instance]))
}

function changedIds<T>(historical: Map<string, T>, current: Map<string, T>, project: (value: T) => unknown): Set<string> {
  const ids = new Set([...historical.keys(), ...current.keys()])
  return new Set([...ids].filter(id => differs(
    historical.get(id) === undefined ? undefined : project(historical.get(id)!),
    current.get(id) === undefined ? undefined : project(current.get(id)!),
  )))
}

function addedIds<T>(historical: Map<string, T>, current: Map<string, T>): Set<string> {
  return new Set([...current.keys()].filter(id => !historical.has(id)))
}

function removedIds<T>(historical: Map<string, T>, current: Map<string, T>): Set<string> {
  return new Set([...historical.keys()].filter(id => !current.has(id)))
}

export function createCardComparisonChanges(
  historical: CardDocument,
  current: CardDocument,
): CardComparisonChanges {
  const historicalFaces = collectFaces(historical)
  const currentFaces = collectFaces(current)
  const historicalBlocks = collectBlocks(historical)
  const currentBlocks = collectBlocks(current)
  const historicalInstances = collectInstances(historical)
  const currentInstances = collectInstances(current)

  return {
    documentChanged: differs(
      { ...historical, faces: undefined, instances: undefined },
      { ...current, faces: undefined, instances: undefined },
    ),
    faceIds: changedIds(historicalFaces, currentFaces, withoutChildren),
    addedFaceIds: addedIds(historicalFaces, currentFaces),
    removedFaceIds: removedIds(historicalFaces, currentFaces),
    instanceIds: changedIds(historicalInstances, currentInstances, value => value),
    addedInstanceIds: addedIds(historicalInstances, currentInstances),
    removedInstanceIds: removedIds(historicalInstances, currentInstances),
    blockIds: changedIds(historicalBlocks, currentBlocks, withoutChildren),
    addedBlockIds: addedIds(historicalBlocks, currentBlocks),
    removedBlockIds: removedIds(historicalBlocks, currentBlocks),
  }
}
