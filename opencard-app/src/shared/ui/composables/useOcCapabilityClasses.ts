/**
 * @deprecated 此文件已废弃，新组件直接使用 computed class 数组。
 * 保留仅为兼容过渡期。
 */
import { computed, type ComputedRef } from 'vue'

export interface OcModifierClassEntry {
  namespace?: string
  value: string
}

export type OcStateFlags = Record<string, boolean | undefined>

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
