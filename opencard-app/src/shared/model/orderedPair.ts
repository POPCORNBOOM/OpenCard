export type OrderedPairStatus = 'matched' | 'left-only' | 'right-only' | 'ambiguous'

export type OrderedPairEntry<T> =
  | { status: 'matched'; leftItem: T; leftIndex: number; rightItem: T; rightIndex: number }
  | { status: 'left-only'; leftItem: T; leftIndex: number; rightItem: null; rightIndex: null }
  | { status: 'right-only'; leftItem: null; leftIndex: null; rightItem: T; rightIndex: number }
  | { status: 'ambiguous'; leftItem: null; leftIndex: null; rightItem: null; rightIndex: null }

type IndexedItem<T, Identity> = { identity: Identity; item: T; index: number }

function indexItems<T, Identity>(items: readonly T[], identity: (item: T) => Identity): {
  items: IndexedItem<T, Identity>[]
  byIdentity: Map<Identity, IndexedItem<T, Identity>>
} | null {
  const indexed = items.map((item, index) => ({ identity: identity(item), item, index }))
  const byIdentity = new Map<Identity, IndexedItem<T, Identity>>()
  for (const entry of indexed) {
    if (byIdentity.has(entry.identity)) return null
    byIdentity.set(entry.identity, entry)
  }
  return { items: indexed, byIdentity }
}

export function orderedPair<T, Identity>(
  left: readonly T[], right: readonly T[], identity: (item: T) => Identity,
): OrderedPairEntry<T>[] {
  const indexedLeft = indexItems(left, identity)
  const indexedRight = indexItems(right, identity)
  if (!indexedLeft || !indexedRight) return [{ status: 'ambiguous', leftItem: null, leftIndex: null, rightItem: null, rightIndex: null }]

  const before = right.map(() => [] as OrderedPairEntry<T>[])
  const after = right.map(() => [] as OrderedPairEntry<T>[])
  const unanchored: OrderedPairEntry<T>[] = []
  const nextRightIndexes = new Array<number | null>(left.length).fill(null)
  let nextRightIndex: number | null = null
  for (let index = indexedLeft.items.length - 1; index >= 0; index -= 1) {
    nextRightIndexes[index] = nextRightIndex
    nextRightIndex = indexedRight.byIdentity.get(indexedLeft.items[index]!.identity)?.index ?? nextRightIndex
  }

  let previousRightIndex: number | null = null
  for (const leftEntry of indexedLeft.items) {
    const matchingRight = indexedRight.byIdentity.get(leftEntry.identity)
    if (matchingRight) {
      previousRightIndex = matchingRight.index
      continue
    }
    const entry: OrderedPairEntry<T> = {
      status: 'left-only', leftItem: leftEntry.item, leftIndex: leftEntry.index, rightItem: null, rightIndex: null,
    }
    const followingRightIndex = nextRightIndexes[leftEntry.index]
    if (followingRightIndex !== null) before[followingRightIndex]!.push(entry)
    else if (previousRightIndex !== null) after[previousRightIndex]!.push(entry)
    else unanchored.push(entry)
  }

  const pairs: OrderedPairEntry<T>[] = []
  for (const rightEntry of indexedRight.items) {
    pairs.push(...before[rightEntry.index]!)
    const matchingLeft = indexedLeft.byIdentity.get(rightEntry.identity)
    pairs.push(matchingLeft
      ? { status: 'matched', leftItem: matchingLeft.item, leftIndex: matchingLeft.index, rightItem: rightEntry.item, rightIndex: rightEntry.index }
      : { status: 'right-only', leftItem: null, leftIndex: null, rightItem: rightEntry.item, rightIndex: rightEntry.index })
    pairs.push(...after[rightEntry.index]!)
  }
  pairs.push(...unanchored)
  return pairs
}
