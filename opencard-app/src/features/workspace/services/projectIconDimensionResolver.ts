/**
 * 模块说明：
 * - 按需解析项目图标的自然尺寸
 * 职责边界：
 * - 只负责解析与缓存尺寸 不定义绘制契约 不决定图标是否渲染
 */

/**
 * An icon's size is resolved when the icon is drawn, not while the catalog is assembled.
 *
 * The only thing ever needed is the aspect ratio, and only by a style function that is about to paint
 * one icon. Measuring the whole registry up front made opening a project cost one file read per icon
 * — 651 reads before the first card was painted, while a session paints a few dozen. So the catalog
 * carries no sizes and the first paint resolves just that icon.
 *
 * The size lives in the icon's own file, so a reader for it is installed by the project store: a
 * vector states its size in its markup, and anything else is decoded by the webview.
 */

import { shallowRef } from 'vue'
import type { ProjectIconCatalogEntry } from './projectIconCatalog'
import type { ProjectIconDimensions } from './projectIconDimensions'

/** How one icon's size is obtained: `src` is the asset URL the paint uses, `source` the file path. */
export type ProjectIconDimensionLoader = (src: string, source: string) => Promise<ProjectIconDimensions>

/**
 * Sizes already measured, keyed by project-relative source. The map is replaced rather than mutated
 * because a style function reads it while computing: that read is what makes the consumer re-run once
 * the size it was missing arrives.
 */
const resolved = shallowRef<ReadonlyMap<string, ProjectIconDimensions>>(new Map())
const inFlight = new Set<string>()
const failed = new Set<string>()

let loader: ProjectIconDimensionLoader | null = null

/** Installs the reader for the project whose icons are drawn. Called by the project store. */
export function setProjectIconDimensionLoader(next: ProjectIconDimensionLoader | null): void {
  loader = next
}

/** Measures an icon by letting the webview decode it, which covers every raster format. */
export async function loadProjectImageDimensions(src: string): Promise<ProjectIconDimensions> {
  return await new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const complete = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
      if (typeof image.decode === 'function') void image.decode().then(complete, reject)
      else complete()
    }
    image.onerror = () => reject(new Error('Unable to load project icon image'))
    image.src = src
  })
}

/**
 * The size an entry is painted with, asked for on the render path. A size that is known answers
 * immediately; otherwise the icon is set to be measured and reads as unknown until it arrives.
 *
 * Nothing is written onto the entry: a catalog published through `ref` is deeply reactive and its
 * entries are readonly. The size therefore lives only here, and the consumer that read this re-runs
 * when the map changes.
 */
export function readProjectIconSize(entry: ProjectIconCatalogEntry): ProjectIconDimensions | undefined {
  const known = resolved.value.get(entry.source)
  if (known) return known

  const source = entry.source
  if (!loader || inFlight.has(source) || failed.has(source)) return undefined

  inFlight.add(source)
  void loader(entry.src, source).then((dimensions) => {
    resolved.value = new Map(resolved.value).set(source, dimensions)
  }, () => {
    // A file that cannot be measured stays square rather than being retried on every frame.
    failed.add(source)
  }).finally(() => {
    inFlight.delete(source)
  })
  return undefined
}

/** Forgets one icon's size, because its file changed. */
export function forgetProjectIconDimensions(source: string): void {
  if (resolved.value.has(source)) {
    const next = new Map(resolved.value)
    next.delete(source)
    resolved.value = next
  }
  failed.delete(source)
}

/** Forgets every size, because the project that owned them is closing. */
export function clearProjectIconDimensions(): void {
  resolved.value = new Map()
  inFlight.clear()
  failed.clear()
}
