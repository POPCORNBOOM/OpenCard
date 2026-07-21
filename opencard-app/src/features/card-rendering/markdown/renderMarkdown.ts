import MarkdownIt from 'markdown-it'
import markdownItAttrs from 'markdown-it-attrs'
import type Token from 'markdown-it/lib/token.mjs'

const IMAGE_ATTRIBUTE_NAMES = new Set(['width', 'height', 'fit', 'align'])
const CSS_LENGTH_PATTERN = /^(?:auto|0|(?:\d+(?:\.\d+)?|\.\d+)(?:px|%|em|rem|vw|vh|vmin|vmax|ch|ex|cm|mm|in|pt|pc))$/i
const IMAGE_FIT_VALUES = new Set(['contain', 'cover', 'fill'])
const IMAGE_ALIGN_VALUES = new Set(['start', 'center', 'end'])

const markdown = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: false,
  typographer: false,
})

markdown.use(markdownItAttrs, {
  allowedAttributes: [...IMAGE_ATTRIBUTE_NAMES],
})

function removeImageAttributesFromNonImageTokens(tokens: Token[]): void {
  for (const token of tokens) {
    if (token.type !== 'image' && token.attrs) {
      token.attrs = token.attrs.filter(([name]) => !IMAGE_ATTRIBUTE_NAMES.has(name))
    }
    if (token.children) {
      removeImageAttributesFromNonImageTokens(token.children)
    }
  }
}

markdown.core.ruler.after('curly_attributes', 'opencard_image_attributes', (state) => {
  removeImageAttributesFromNonImageTokens(state.tokens)
})

export type MarkdownRenderOptions = {
  resolveImageSrc?: (path: string) => string
}

type MarkdownEnvironment = {
  resolveImageSrc?: (path: string) => string
}

function readCssLength(token: Token, name: 'width' | 'height'): string | null {
  const value = token.attrGet(name)?.trim() ?? ''
  return CSS_LENGTH_PATTERN.test(value) ? value : null
}

function createImageStyle(token: Token): string {
  const declarations: string[] = []
  const width = readCssLength(token, 'width')
  const height = readCssLength(token, 'height')
  const fit = token.attrGet('fit')?.trim().toLowerCase() ?? ''
  const align = token.attrGet('align')?.trim().toLowerCase() ?? ''

  if (width) declarations.push(`width:${width}`)
  if (height) declarations.push(`height:${height}`)
  if (IMAGE_FIT_VALUES.has(fit)) declarations.push(`object-fit:${fit}`)
  if (IMAGE_ALIGN_VALUES.has(align)) {
    declarations.push('display:block')
    if (align === 'start') declarations.push('margin-inline-end:auto')
    if (align === 'center') declarations.push('margin-inline:auto')
    if (align === 'end') declarations.push('margin-inline-start:auto')
  }

  return declarations.join(';')
}

markdown.renderer.rules.image = (tokens, index, _options, environment) => {
  const token = tokens[index]
  const alt = markdown.utils.escapeHtml(token?.content ?? '')
  const encodedSourcePath = token?.attrGet('src') ?? ''
  let sourcePath = encodedSourcePath
  try {
    sourcePath = decodeURI(encodedSourcePath)
  } catch {
    // Keep the original path when Markdown contains malformed URL escapes.
  }

  let resolvedSource = ''
  try {
    resolvedSource = (environment as MarkdownEnvironment).resolveImageSrc?.(sourcePath) ?? ''
  } catch {
    // Missing project context or invalid paths degrade to the image alt text.
  }
  if (!resolvedSource) {
    return alt
  }

  const title = token?.attrGet('title')
  const titleAttribute = title
    ? ` title="${markdown.utils.escapeHtml(title)}"`
    : ''
  const style = createImageStyle(token)
  const styleAttribute = style
    ? ` style="${markdown.utils.escapeHtml(style)}"`
    : ''
  return `<img class="text-block-markdown-image" src="${markdown.utils.escapeHtml(resolvedSource)}" alt="${alt}"${titleAttribute}${styleAttribute}>`
}

export function renderMarkdown(source: string, options: MarkdownRenderOptions = {}): string {
  return markdown.render(source, {
    resolveImageSrc: options.resolveImageSrc,
  } satisfies MarkdownEnvironment)
}
