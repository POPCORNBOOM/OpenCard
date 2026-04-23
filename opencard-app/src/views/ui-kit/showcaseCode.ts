import rendererSource from '../../components/ui-kit/ShowcaseExampleRenderer.vue?raw'
import type { ShowcaseMatrixColumn } from './catalog'

export type ShowcaseCodeByColumn = Record<ShowcaseMatrixColumn, string>

const EXAMPLE_START_PATTERN =
  /<div class="showcase-example-case" v-(?:if|else-if)="exampleId === '([^']+)'">/g

const COLUMN_MARKERS: Record<ShowcaseMatrixColumn, string> = {
  default: `<template v-if="column === 'default'">`,
  variants: `<template v-else-if="column === 'variants'">`,
  states: `<template v-else-if="column === 'states'">`,
  layout: '<template v-else>',
}

const TEMPLATE_MARKER_OPEN = '<template'
const TEMPLATE_MARKER_CLOSE = '</template>'
const UNKNOWN_EXAMPLE_MARKER = '<div v-else class="unknown-example">'
const EMPTY_CODE = '<!-- code unavailable -->'

const EMPTY_CODE_BY_COLUMN: ShowcaseCodeByColumn = {
  default: EMPTY_CODE,
  variants: EMPTY_CODE,
  states: EMPTY_CODE,
  layout: EMPTY_CODE,
}

type ExampleRange = {
  id: string
  start: number
  end: number
}

const SCRIPT_SETUP_OPEN_PATTERN = /<script\s+setup(?:\s+lang="[^"]+")?>/i
const SCRIPT_SETUP_CLOSE_PATTERN = '</script>'
const SIMPLE_BINDING_PATTERN = /(?:\s|^):[\w-]+="([A-Za-z_$][\w$]*)"/g
const SIMPLE_VMODEL_PATTERN = /(?:\s|^)v-model(?:[:][\w-]+)?="([A-Za-z_$][\w$]*)"/g
const TOP_LEVEL_DECLARATION_PATTERN =
  /^(?:const|let|var|function|type|interface|enum|class|defineOptions|defineProps|defineEmits|defineExpose|withDefaults|watch|onMounted|onUnmounted)\b/

function trimTemplateSource(source: string): string {
  const rootOpenIndex = source.indexOf('<template>')
  const rootCloseIndex = source.lastIndexOf('</template>')

  if (rootOpenIndex === -1 || rootCloseIndex === -1 || rootCloseIndex <= rootOpenIndex) {
    return ''
  }

  return source.slice(rootOpenIndex + '<template>'.length, rootCloseIndex)
}

function trimScriptSetupSource(source: string): string {
  const openMatch = source.match(SCRIPT_SETUP_OPEN_PATTERN)
  if (!openMatch) {
    return ''
  }

  const openIndex = openMatch.index ?? -1
  if (openIndex < 0) {
    return ''
  }

  const contentStart = openIndex + openMatch[0].length
  const closeIndex = source.indexOf(SCRIPT_SETUP_CLOSE_PATTERN, contentStart)
  if (closeIndex === -1) {
    return ''
  }

  return source.slice(contentStart, closeIndex)
}

function collectExampleRanges(templateSource: string): ExampleRange[] {
  const starts = Array.from(templateSource.matchAll(EXAMPLE_START_PATTERN))
    .map((match) => ({
      id: match[1],
      start: match.index ?? -1,
    }))
    .filter((entry) => entry.start >= 0)

  if (!starts.length) {
    return []
  }

  const fallbackEnd = templateSource.indexOf(UNKNOWN_EXAMPLE_MARKER)
  const finalEnd = fallbackEnd === -1 ? templateSource.length : fallbackEnd

  return starts.map((entry, index) => ({
    id: entry.id,
    start: entry.start,
    end: starts[index + 1]?.start ?? finalEnd,
  }))
}

function normalizeSnippetIndentation(snippet: string): string {
  const normalized = snippet.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')

  while (lines.length > 0 && lines[0].trim() === '') {
    lines.shift()
  }
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop()
  }

  if (!lines.length) {
    return ''
  }

  const indent = lines
    .filter((line) => line.trim().length > 0)
    .reduce((minIndent, line) => {
      const lineIndent = line.match(/^(\s*)/)?.[1].length ?? 0
      return Math.min(minIndent, lineIndent)
    }, Number.POSITIVE_INFINITY)

  return lines
    .map((line) => line.slice(Math.min(indent, line.length)))
    .join('\n')
    .trim()
}

function extractTemplateBody(block: string, marker: string): string {
  const markerIndex = block.indexOf(marker)
  if (markerIndex === -1) {
    return ''
  }

  const contentStart = markerIndex + marker.length
  let cursor = contentStart
  let depth = 1

  while (cursor < block.length) {
    const nextOpen = block.indexOf(TEMPLATE_MARKER_OPEN, cursor)
    const nextClose = block.indexOf(TEMPLATE_MARKER_CLOSE, cursor)

    if (nextClose === -1) {
      return ''
    }

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1
      cursor = nextOpen + TEMPLATE_MARKER_OPEN.length
      continue
    }

    depth -= 1
    if (depth === 0) {
      const snippet = block.slice(contentStart, nextClose)
      return normalizeSnippetIndentation(snippet)
    }

    cursor = nextClose + TEMPLATE_MARKER_CLOSE.length
  }

  return ''
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function collectSimpleBindings(snippet: string): string[] {
  const bindings = new Set<string>()
  const normalizedSnippet = snippet.replace(/\r\n/g, '\n')

  for (const match of normalizedSnippet.matchAll(SIMPLE_BINDING_PATTERN)) {
    const identifier = match[1]?.trim()
    if (identifier) {
      bindings.add(identifier)
    }
  }

  for (const match of normalizedSnippet.matchAll(SIMPLE_VMODEL_PATTERN)) {
    const identifier = match[1]?.trim()
    if (identifier) {
      bindings.add(identifier)
    }
  }

  return Array.from(bindings)
}

function readConstDeclaration(scriptSource: string, identifier: string): string {
  const declarationPattern = new RegExp(
    `(^|\\n)(\\s*)(?:const|let|var)\\s+${escapeRegExp(identifier)}\\b`,
    'm',
  )
  const match = declarationPattern.exec(scriptSource)
  if (!match) {
    return ''
  }

  const declarationStart = (match.index ?? 0) + match[1].length
  const declarationSlice = scriptSource.slice(declarationStart)
  const equalsIndex = declarationSlice.indexOf('=')
  if (equalsIndex === -1) {
    return ''
  }

  let cursor = equalsIndex + 1
  let depthParen = 0
  let depthBracket = 0
  let depthBrace = 0
  let quote: '"' | "'" | '`' | null = null
  let escaped = false
  let lineComment = false
  let blockComment = false

  const isAtTopLevel = () => depthParen === 0 && depthBracket === 0 && depthBrace === 0

  while (cursor < declarationSlice.length) {
    const char = declarationSlice[cursor]
    const nextChar = declarationSlice[cursor + 1]

    if (lineComment) {
      if (char === '\n') {
        lineComment = false
      }
      cursor += 1
      continue
    }

    if (blockComment) {
      if (char === '*' && nextChar === '/') {
        blockComment = false
        cursor += 2
        continue
      }
      cursor += 1
      continue
    }

    if (quote) {
      if (escaped) {
        escaped = false
        cursor += 1
        continue
      }

      if (char === '\\') {
        escaped = true
        cursor += 1
        continue
      }

      if (char === quote) {
        quote = null
      }
      cursor += 1
      continue
    }

    if (char === '/' && nextChar === '/') {
      lineComment = true
      cursor += 2
      continue
    }

    if (char === '/' && nextChar === '*') {
      blockComment = true
      cursor += 2
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char
      cursor += 1
      continue
    }

    if (char === '(') {
      depthParen += 1
      cursor += 1
      continue
    }

    if (char === ')') {
      depthParen = Math.max(0, depthParen - 1)
      cursor += 1
      continue
    }

    if (char === '[') {
      depthBracket += 1
      cursor += 1
      continue
    }

    if (char === ']') {
      depthBracket = Math.max(0, depthBracket - 1)
      cursor += 1
      continue
    }

    if (char === '{') {
      depthBrace += 1
      cursor += 1
      continue
    }

    if (char === '}') {
      depthBrace = Math.max(0, depthBrace - 1)
      cursor += 1
      continue
    }

    if (char === ';' && isAtTopLevel()) {
      cursor += 1
      break
    }

    if (char === '\n' && isAtTopLevel()) {
      const nextSlice = declarationSlice.slice(cursor + 1)
      if (startsWithTopLevelDeclaration(nextSlice)) {
        break
      }
    }

    cursor += 1
  }

  const declaration = declarationSlice.slice(0, cursor)
  return normalizeSnippetIndentation(declaration)
}

function startsWithTopLevelDeclaration(source: string): boolean {
  let cursor = 0

  while (cursor < source.length) {
    const char = source[cursor]
    const nextChar = source[cursor + 1]

    if (char.match(/\s/)) {
      cursor += 1
      continue
    }

    if (char === '/' && nextChar === '/') {
      const lineEnd = source.indexOf('\n', cursor + 2)
      if (lineEnd === -1) {
        return true
      }
      cursor = lineEnd + 1
      continue
    }

    if (char === '/' && nextChar === '*') {
      const commentEnd = source.indexOf('*/', cursor + 2)
      if (commentEnd === -1) {
        return true
      }
      cursor = commentEnd + 2
      continue
    }

    break
  }

  if (cursor >= source.length) {
    return true
  }

  return TOP_LEVEL_DECLARATION_PATTERN.test(source.slice(cursor))
}

function mergeScriptBindings(scriptSource: string, snippet: string): string {
  if (!snippet || !scriptSource) {
    return snippet
  }

  const bindings = collectSimpleBindings(snippet)
  if (!bindings.length) {
    return snippet
  }

  const declarations = bindings
    .map((binding) => readConstDeclaration(scriptSource, binding))
    .filter((declaration) => declaration.length > 0)

  if (!declarations.length) {
    return snippet
  }

  return `${declarations.join('\n\n')}\n\n${snippet}`
}

function buildShowcaseCodeMap(source: string): Record<string, ShowcaseCodeByColumn> {
  const templateSource = trimTemplateSource(source)
  const scriptSource = trimScriptSetupSource(source)
  const ranges = collectExampleRanges(templateSource)

  if (!templateSource || !ranges.length) {
    return {}
  }

  const codeMap: Record<string, ShowcaseCodeByColumn> = {}

  for (const range of ranges) {
    const block = templateSource.slice(range.start, range.end)
    const defaultSnippet = extractTemplateBody(block, COLUMN_MARKERS.default) || EMPTY_CODE
    const variantsSnippet = extractTemplateBody(block, COLUMN_MARKERS.variants) || EMPTY_CODE
    const statesSnippet = extractTemplateBody(block, COLUMN_MARKERS.states) || EMPTY_CODE
    const layoutSnippet = extractTemplateBody(block, COLUMN_MARKERS.layout) || EMPTY_CODE

    codeMap[range.id] = {
      default: mergeScriptBindings(scriptSource, defaultSnippet),
      variants: mergeScriptBindings(scriptSource, variantsSnippet),
      states: mergeScriptBindings(scriptSource, statesSnippet),
      layout: mergeScriptBindings(scriptSource, layoutSnippet),
    }
  }

  return codeMap
}

const SHOWCASE_CODE_MAP = buildShowcaseCodeMap(rendererSource)

export function getShowcaseCode(exampleId: string): ShowcaseCodeByColumn {
  return SHOWCASE_CODE_MAP[exampleId] ?? EMPTY_CODE_BY_COLUMN
}
