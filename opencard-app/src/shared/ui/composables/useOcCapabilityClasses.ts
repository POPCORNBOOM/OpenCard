import { computed, type ComputedRef } from 'vue'

export interface OcModifierClassEntry {
  namespace?: string
  value: string
}

export type OcStateFlags = Record<string, boolean | undefined>

export type OcForwardAttrs = Record<string, unknown>

export function useOcModifierClasses(
  blockClass: string,
  getEntries: () => OcModifierClassEntry[],
): ComputedRef<string[]> {
  return computed(() =>
    getEntries()
      .filter((entry) => entry.value.length > 0)
      .map((entry) => (
        entry.namespace
          ? `${blockClass}--${entry.namespace}-${entry.value}`
          : `${blockClass}--${entry.value}`
      )),
  )
}

export function useOcStateClasses(
  getFlags: () => OcStateFlags,
  prefix = 'is-',
): ComputedRef<string[]> {
  return computed(() =>
    Object.entries(getFlags())
      .filter(([, enabled]) => Boolean(enabled))
      .map(([name]) => `${prefix}${name}`),
  )
}

const DEFAULT_BLOCKED_ATTR_KEYS = ['style'] as const

export function useOcForwardAttrs(
  attrs: OcForwardAttrs,
  blockedKeys: readonly string[] = DEFAULT_BLOCKED_ATTR_KEYS,
): ComputedRef<OcForwardAttrs> {
  const blockedKeySet = new Set(blockedKeys)
  return computed(() => {
    return Object.fromEntries(
      Object.entries(attrs).filter(([key]) => !blockedKeySet.has(key)),
    )
  })
}
