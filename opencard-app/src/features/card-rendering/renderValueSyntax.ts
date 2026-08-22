const cssColorFunctions = /^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark|var)\(.+\)$/i
const cssNamedColor = /^[a-z]+$/i
const cssHexColor = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const cssLength = /^(?:-?(?:\d+\.?\d*|\.\d+)(?:px|%|em|rem|vw|vh|vmin|vmax|cm|mm|q|in|pc|pt|ch|ex|cap|ic|lh|rlh)?|0|auto|min-content|max-content|fit-content|(?:calc|min|max|clamp|var)\(.+\))$/i
const cssSimpleLength = /^-?(?:\d+\.?\d*|\.\d+)(?:px|%|em|rem|vw|vh|vmin|vmax|cm|mm|q|in|pc|pt|ch|ex|cap|ic|lh|rlh)?$/i

export function isRenderCssColor(value: string): boolean {
  const candidate = value.trim()
  if (!candidate) return true
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
    return CSS.supports('color', candidate)
  }
  return cssHexColor.test(candidate)
    || cssColorFunctions.test(candidate)
    || cssNamedColor.test(candidate)
    || candidate === 'transparent'
    || candidate === 'currentColor'
}

export function normalizeRenderCssLength(value: string): string {
  const trimmed = value.trim()
  if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) return `${trimmed}px`
  if (/^calc\(.+\)$/i.test(trimmed)) return trimmed
  if (/\S\s+[+\-*/]\s+\S/.test(trimmed)) return `calc(${trimmed})`
  return trimmed
}

export function isRenderCssLength(value: string): boolean {
  const candidate = value.trim()
  if (!candidate) return true
  if (cssSimpleLength.test(candidate)) return true
  if (/\S\s+[+\-*/]\s+\S/.test(candidate)) return true
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
    return CSS.supports('width', candidate)
  }
  return cssLength.test(candidate)
}
