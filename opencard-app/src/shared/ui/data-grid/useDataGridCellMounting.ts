import {
  onBeforeUnmount,
  onMounted,
  reactive,
  type ComponentPublicInstance,
  type Ref,
} from 'vue'
import { resolveOcPixelToken } from '../foundation'

type DataGridCellMountingOptions = {
  scrollRoot: Ref<HTMLElement | null>
}

export function useDataGridCellMounting(options: DataGridCellMountingOptions) {
  const supportsIntersectionObserver = typeof IntersectionObserver !== 'undefined'
  const mountedKeys = reactive(new Set<string>())
  const elements = new Map<string, HTMLElement>()
  const keyByElement = new WeakMap<Element, string>()
  let observer: IntersectionObserver | null = null

  function setCellElement(
    key: string,
    element: Element | ComponentPublicInstance | null,
  ): void {
    const previous = elements.get(key)
    const next = element instanceof HTMLElement ? element : null
    if (previous === next) return
    if (previous) observer?.unobserve(previous)
    if (!next) {
      elements.delete(key)
      return
    }
    elements.set(key, next)
    keyByElement.set(next, key)
    observer?.observe(next)
  }

  function shouldMountCell(key: string): boolean {
    return !supportsIntersectionObserver || mountedKeys.has(key)
  }

  function mountCell(key: string): void {
    mountedKeys.add(key)
  }

  onMounted(() => {
    if (!supportsIntersectionObserver) return
    const blockDistance = resolveOcPixelToken('--oc-data-grid-preload-block-distance', options.scrollRoot.value)
    const inlineDistance = resolveOcPixelToken('--oc-data-grid-preload-inline-distance', options.scrollRoot.value)
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const key = keyByElement.get(entry.target)
        if (key) mountedKeys.add(key)
      }
    }, {
      root: options.scrollRoot.value,
      rootMargin: `${blockDistance}px ${inlineDistance}px`,
    })
    for (const element of elements.values()) observer.observe(element)
  })

  onBeforeUnmount(() => observer?.disconnect())

  return { setCellElement, shouldMountCell, mountCell }
}
