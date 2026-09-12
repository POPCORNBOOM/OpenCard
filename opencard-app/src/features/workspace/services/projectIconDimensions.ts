/**
 * 模块说明：
 * - 从图标文件内容直接读出自然尺寸，供按需解析时复用
 * 职责边界：
 * - 只解析矢量文本的头部 不解码像素、不访问文件系统
 */

/**
 * Reading an icon's natural size from the file content rather than from a decoded image.
 *
 * The catalog only needs one number per icon — its aspect ratio — and a decode is the expensive way
 * to obtain it: the file has to be fetched over the asset protocol and rasterized by the webview. A
 * vector states its size in its own markup, so a project's icon set is measured by reading the text
 * it already holds.
 *
 * Returning `null` means "this file did not yield a size"; the caller falls back to a real image
 * decode, so an unusual file is still measured correctly instead of being reported as broken.
 */

/** One icon's natural canvas size, as stated by the file itself. */
export type ProjectIconDimensions = { width: number, height: number }

/** Unitless lengths and `px` are absolute; anything relative cannot name a natural size. */
const ABSOLUTE_LENGTH_PATTERN = /^\s*(\d+(?:\.\d+)?)(?:px)?\s*$/i

function toAbsoluteLength(value: string | undefined): number | null {
  if (!value) return null
  const match = ABSOLUTE_LENGTH_PATTERN.exec(value)
  if (!match) return null
  const length = Number(match[1])
  return Number.isFinite(length) && length > 0 ? length : null
}

function positiveDimensions(width: number, height: number): ProjectIconDimensions | null {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return null
  return { width, height }
}

/**
 * Reads `width`/`height` from the root `<svg>` element, falling back to the `viewBox` extent.
 *
 * The root tag alone is examined: a nested `<rect width="4">` must never be mistaken for the canvas
 * size. `viewBox` is the fallback because a vector commonly omits `width`/`height` and relies on it —
 * and because a webview treats a missing `width`/`height` as `100%`, so decoding such a file would
 * report the viewport rather than the artwork's own proportion.
 */
function readSvgDimensions(source: string): ProjectIconDimensions | null {
  const rootTagStart = source.search(/<svg[\s>]/i)
  if (rootTagStart === -1) return null
  const rootTagEnd = source.indexOf('>', rootTagStart)
  if (rootTagEnd === -1) return null
  const rootTag = source.slice(rootTagStart, rootTagEnd)

  const attribute = (name: string): string | undefined => {
    const match = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(rootTag)
    return match?.[2] ?? match?.[3]
  }

  const width = toAbsoluteLength(attribute('width'))
  const height = toAbsoluteLength(attribute('height'))
  if (width !== null && height !== null) {
    return positiveDimensions(Math.round(width), Math.round(height))
  }

  const viewBox = attribute('viewBox')?.trim().split(/[\s,]+/)
  if (viewBox?.length === 4) {
    const viewBoxWidth = Number(viewBox[2])
    const viewBoxHeight = Number(viewBox[3])
    if (Number.isFinite(viewBoxWidth) && Number.isFinite(viewBoxHeight)) {
      return positiveDimensions(Math.round(viewBoxWidth), Math.round(viewBoxHeight))
    }
  }
  return null
}

/**
 * Reads a vector's natural size from its own markup. Returns `null` when the file is not a vector or
 * its markup names no absolute size, so the caller can fall back to decoding the image.
 */
export function readProjectIconDimensions(
  source: string,
  content: string,
): ProjectIconDimensions | null {
  const extension = source.slice(source.lastIndexOf('.') + 1).toLocaleLowerCase()
  return extension === 'svg' ? readSvgDimensions(content) : null
}
