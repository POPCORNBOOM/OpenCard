import { isRecord } from '../../shared/model/record'
import type { CardBlock, CardDocument } from './model'

export function parseCardDocument(value: unknown): CardDocument {
  if (!isRecord(value)) throw new Error('Card document must be a JSON object')
  return value as CardDocument
}

export function parseStoredCardBlock(value: unknown): CardBlock | null {
  if (!isRecord(value)) return null
  const type = value.type
  if (typeof type !== 'string' || type.length === 0) return null
  return value as CardBlock
}

export function stringifyCardDocument(document: CardDocument): string {
  return JSON.stringify(document, null, 2)
}
