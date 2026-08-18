import type { OcActionDefinition } from '../../components/standard/OcActionMenu.vue'

/** Common title-row presentation used by trees and property rows. */
export type OcItemTailPart = string | OcActionDefinition
export type OcItemTone = 'default' | 'muted' | 'subtle' | 'accent' | 'success' | 'warning' | 'danger'

export interface OcItemViewModel {
  key: string
  action?: OcActionDefinition
  title: string
  tone?: OcItemTone
  tail?: OcItemTailPart | readonly OcItemTailPart[]
}

export function normalizeItemTail(
  tail: OcItemViewModel['tail'],
): readonly OcItemTailPart[] {
  if (!tail) return []
  return Array.isArray(tail) ? tail : [tail]
}
