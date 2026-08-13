const allowedTags = new Set([
  'B', 'BR', 'COL', 'COLGROUP', 'EM', 'I', 'LI', 'MARK', 'OL', 'P', 'S', 'SPAN',
  'STRIKE', 'STRONG', 'TABLE', 'TBODY', 'TD', 'TH', 'THEAD', 'TR', 'U', 'UL',
  'OC-CUSTOM-BLOCK', 'OC-PROP',
])

const blockedTags = new Set(['IFRAME', 'OBJECT', 'SCRIPT', 'STYLE', 'TEMPLATE'])
const allowedStyleProperties = [
  'background-color', 'color', 'font-family', 'font-size', 'text-align',
  '-webkit-text-stroke-color', '-webkit-text-stroke-width',
] as const
const tableStyleProperties = ['min-width', 'width'] as const
const keyPattern = /^[a-z0-9][a-z0-9._-]*$/i
const embedIdPattern = /^[a-z0-9][a-z0-9._:-]*$/i
const tableParents: Readonly<Record<string, ReadonlySet<string>>> = {
  COL: new Set(['COLGROUP']), COLGROUP: new Set(['TABLE']), THEAD: new Set(['TABLE']),
  TBODY: new Set(['TABLE']), TR: new Set(['THEAD', 'TBODY', 'TABLE']),
  TH: new Set(['TR']), TD: new Set(['TR']),
}

export type RichTextDiagnosticCode =
  | 'unsupported-tag' | 'unsupported-attribute' | 'invalid-style' | 'invalid-structure'
  | 'invalid-custom-block' | 'duplicate-embed-id'

export type RichTextDiagnostic = {
  code: RichTextDiagnosticCode
  path: string
  message: string
}

export type RichTextTextNode = { type: 'text', value: string }
export type RichTextElementNode = {
  type: 'element'
  tag: string
  attributes: Readonly<Record<string, string>>
  children: readonly RichTextNode[]
}
export type RichTextIconNode = { type: 'icon', seriesKey: string, iconKey: string }
export type RichTextCustomBlockNode = {
  type: 'customBlock'
  embedId: string
  customBlockKey: string
  layout: 'inline' | 'block'
  properties: Readonly<Record<string, string>>
}
export type RichTextNode = RichTextTextNode | RichTextElementNode | RichTextIconNode | RichTextCustomBlockNode
export type RichTextDocument = { html: string, children: readonly RichTextNode[] }
export type RichTextParseContext = {
  resolveCustomBlock?: (key: string) => { publicFieldKeys: readonly string[] } | null | undefined
  allowUnresolvedBindings?: boolean
}
export type RichTextParseResult = {
  document: RichTextDocument
  diagnostics: RichTextDiagnostic[]
  canEnterVisualMode: boolean
}
export type RichTextRenderDocument = RichTextDocument

function elementPath(element: Element): string {
  const parts: string[] = []
  let current: Element | null = element
  while (current?.parentElement) {
    const siblings = Array.from(current.parentElement.children).filter(item => item.tagName === current!.tagName)
    parts.unshift(`${current.tagName.toLowerCase()}[${siblings.indexOf(current) + 1}]`)
    current = current.parentElement === current.ownerDocument.body ? null : current.parentElement
  }
  return parts.join('/')
}

function pushDiagnostic(diagnostics: RichTextDiagnostic[], element: Element, code: RichTextDiagnosticCode, message: string): void {
  diagnostics.push({ code, path: elementPath(element), message })
}

function isSafeCssValue(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  if (!normalized || /url\s*\(|expression\s*\(|javascript\s*:|vbscript\s*:|data\s*:/i.test(normalized)) return false
  if (/[{}<>\u0000-\u001f]/.test(value)) return false
  return !/@import|behavior\s*:|-moz-binding/i.test(normalized)
}

export function parseRichTextHtml(source: string, context: RichTextParseContext = {}): RichTextParseResult {
  const documentNode = new DOMParser().parseFromString(source, 'text/html')
  const diagnostics: RichTextDiagnostic[] = []
  const embedIds = new Set<string>()

  for (const element of Array.from(documentNode.body.querySelectorAll('*'))) {
    if (!allowedTags.has(element.tagName)) {
      pushDiagnostic(diagnostics, element, 'unsupported-tag', `Unsupported <${element.tagName.toLowerCase()}> element`)
      continue
    }
    const expectedParents = tableParents[element.tagName]
    if (expectedParents && !expectedParents.has(element.parentElement?.tagName ?? '')) {
      pushDiagnostic(diagnostics, element, 'invalid-structure', `Invalid <${element.tagName.toLowerCase()}> parent`)
    }

    const allowedAttributes = new Set<string>()
    if (element.tagName === 'SPAN' && element.hasAttribute('data-oc-binding')) allowedAttributes.add('data-oc-binding')
    if (element.tagName === 'SPAN' && element.hasAttribute('data-oc-icon-series')) {
      allowedAttributes.add('data-oc-icon-series'); allowedAttributes.add('data-oc-icon-key')
    }
    if (element.tagName === 'OC-CUSTOM-BLOCK') {
      allowedAttributes.add('data-oc-id'); allowedAttributes.add('data-oc-key'); allowedAttributes.add('data-oc-layout')
    }
    if (element.tagName === 'OC-PROP') allowedAttributes.add('data-oc-key')
    if (element.tagName === 'COL' || element.tagName === 'TABLE') allowedAttributes.add('style')
    if (['P', 'SPAN', 'MARK'].includes(element.tagName)) allowedAttributes.add('style')
    if (['TH', 'TD'].includes(element.tagName)) {
      allowedAttributes.add('colspan'); allowedAttributes.add('rowspan')
      for (const name of ['colspan', 'rowspan']) {
        const value = element.getAttribute(name)
        if (value !== null && value !== '1') pushDiagnostic(diagnostics, element, 'invalid-structure', 'Merged table cells are not supported')
      }
    }

    for (const attribute of Array.from(element.attributes)) {
      if (!allowedAttributes.has(attribute.name)) {
        pushDiagnostic(diagnostics, element, 'unsupported-attribute', `Unsupported ${attribute.name} attribute`)
      }
    }
    const rawStyle = element.getAttribute('style') ?? ''
    if (!context.allowUnresolvedBindings && (rawStyle.includes('{{') || rawStyle.includes('}}'))) {
      pushDiagnostic(diagnostics, element, 'invalid-style', 'Bindings are not supported inside style attributes')
    }
    if (rawStyle && !rawStyle.includes('{{') && !rawStyle.includes('}}')) {
      const allowed = new Set<string>(element.tagName === 'TABLE' || element.tagName === 'COL'
        ? tableStyleProperties : allowedStyleProperties)
      const declarations = rawStyle.split(';').map(item => item.trim()).filter(Boolean)
      for (const declaration of declarations) {
        const colon = declaration.indexOf(':')
        const property = colon > 0 ? declaration.slice(0, colon).trim().toLowerCase() : ''
        const cssValue = property ? (element as HTMLElement).style.getPropertyValue(property) : ''
        if (!allowed.has(property) || !isSafeCssValue(cssValue)) {
          pushDiagnostic(diagnostics, element, 'invalid-style', `Unsupported or invalid ${property || 'style'} declaration`)
        }
      }
    }

    if (element.tagName === 'OC-CUSTOM-BLOCK') {
      const id = element.getAttribute('data-oc-id')?.trim() ?? ''
      const key = element.getAttribute('data-oc-key')?.trim() ?? ''
      const layout = element.getAttribute('data-oc-layout')?.trim() ?? ''
      if (!embedIdPattern.test(id) || !keyPattern.test(key) || (layout !== 'inline' && layout !== 'block')) {
        pushDiagnostic(diagnostics, element, 'invalid-custom-block', 'Custom Block requires a valid ID, Key, and layout')
      }
      if (id && embedIds.has(id.toLowerCase())) pushDiagnostic(diagnostics, element, 'duplicate-embed-id', `Duplicate embed ID: ${id}`)
      if (id) embedIds.add(id.toLowerCase())
      const contract = key ? context.resolveCustomBlock?.(key) : undefined
      const publicKeys = contract ? new Set(contract.publicFieldKeys.map(item => item.toLowerCase())) : null
      for (const child of Array.from(element.children)) {
        if (child.tagName !== 'OC-PROP') {
          pushDiagnostic(diagnostics, child, 'invalid-custom-block', 'Custom Block may only contain property elements')
          continue
        }
        const fieldKey = child.getAttribute('data-oc-key')?.trim() ?? ''
        if (!keyPattern.test(fieldKey) || (publicKeys && !publicKeys.has(fieldKey.toLowerCase()))) {
          pushDiagnostic(diagnostics, child, 'invalid-custom-block', `Unavailable public field: ${fieldKey}`)
        }
        if (child.children.length > 0) pushDiagnostic(diagnostics, child, 'invalid-custom-block', 'Custom Block property values must be text')
      }
    } else if (element.tagName === 'OC-PROP' && element.parentElement?.tagName !== 'OC-CUSTOM-BLOCK') {
      pushDiagnostic(diagnostics, element, 'invalid-custom-block', 'Property element must belong to a Custom Block')
    }
  }

  function toNode(node: Node): RichTextNode | null {
    if (node instanceof Text) return { type: 'text', value: node.data }
    if (!(node instanceof Element) || !allowedTags.has(node.tagName) || node.tagName === 'OC-PROP') return null
    if (node.tagName === 'SPAN' && node.hasAttribute('data-oc-icon-series')) {
      return {
        type: 'icon',
        seriesKey: node.getAttribute('data-oc-icon-series') ?? '',
        iconKey: node.getAttribute('data-oc-icon-key') ?? '',
      }
    }
    if (node.tagName === 'OC-CUSTOM-BLOCK') {
      return {
        type: 'customBlock',
        embedId: node.getAttribute('data-oc-id') ?? '',
        customBlockKey: node.getAttribute('data-oc-key') ?? '',
        layout: node.getAttribute('data-oc-layout') === 'block' ? 'block' : 'inline',
        properties: Object.fromEntries(Array.from(node.children).flatMap(child => child.tagName === 'OC-PROP'
          ? [[child.getAttribute('data-oc-key') ?? '', child.textContent ?? '']] : [])),
      }
    }
    const attributes: Record<string, string> = {}
    const styleProperties = node.tagName === 'TABLE' || node.tagName === 'COL'
      ? tableStyleProperties : allowedStyleProperties
    const safeStyle = styleProperties.flatMap(property => {
      const value = (node as HTMLElement).style.getPropertyValue(property)
      return value ? [`${property}: ${value};`] : []
    }).join(' ')
    if (safeStyle) attributes.style = safeStyle
    if (node.tagName === 'SPAN' && node.hasAttribute('data-oc-binding')) {
      attributes['data-oc-binding'] = node.getAttribute('data-oc-binding') ?? ''
    }
    if (node.tagName === 'TD' || node.tagName === 'TH') {
      attributes.colspan = '1'; attributes.rowspan = '1'
    }
    return {
      type: 'element',
      tag: node.tagName.toLowerCase(),
      attributes,
      children: Array.from(node.childNodes).flatMap(child => {
        const parsed = toNode(child)
        return parsed ? [parsed] : []
      }),
    }
  }

  const parsedChildren = documentNode.body.children.length === 0
    ? (documentNode.body.textContent ?? '').replace(/\r\n?/g, '\n').split('\n').map(line => ({
        type: 'element' as const,
        tag: 'p',
        attributes: {},
        children: line ? [{ type: 'text' as const, value: line }] : [{
          type: 'element' as const, tag: 'br', attributes: {}, children: [],
        }],
      }))
    : Array.from(documentNode.body.childNodes).flatMap(node => {
        const parsed = toNode(node)
        return parsed ? [parsed] : []
      })

  return {
    document: {
      html: source,
      children: parsedChildren,
    },
    diagnostics,
    canEnterVisualMode: diagnostics.length === 0,
  }
}

export function serializeRichTextHtml(document: RichTextDocument): string {
  return normalizeRichTextHtml(document.html)
}

export function renderRichTextDocument(document: RichTextDocument): RichTextRenderDocument {
  return { ...document, html: serializeRichTextHtml(document) }
}

export function sanitizeRichTextHtml(source: string): string {
  const documentNode = new DOMParser().parseFromString(source, 'text/html')
  for (const element of Array.from(documentNode.body.querySelectorAll('*'))) {
    if (blockedTags.has(element.tagName)) { element.remove(); continue }
    if (!allowedTags.has(element.tagName)) { element.replaceWith(...Array.from(element.childNodes)); continue }
    const styleValues = Object.fromEntries(allowedStyleProperties.map(property => [property, (element as HTMLElement).style.getPropertyValue(property)]))
    styleValues['font-family'] = normalizeProjectFontFamilyStyle(styleValues['font-family'])
    const bindingExpression = element.tagName === 'SPAN' ? sanitizeBindingExpression(element.getAttribute('data-oc-binding')) : null
    const iconSeries = element.tagName === 'SPAN' ? sanitizeKey(element.getAttribute('data-oc-icon-series')) : null
    const iconKey = element.tagName === 'SPAN' ? sanitizeKey(element.getAttribute('data-oc-icon-key')) : null
    const embed = element.tagName === 'OC-CUSTOM-BLOCK' ? {
      id: sanitizeEmbedId(element.getAttribute('data-oc-id')), key: sanitizeKey(element.getAttribute('data-oc-key')),
      layout: element.getAttribute('data-oc-layout') === 'block' ? 'block' : 'inline',
    } : null
    const propertyKey = element.tagName === 'OC-PROP' ? sanitizeKey(element.getAttribute('data-oc-key')) : null
    const columnWidth = element.tagName === 'COL' ? (element as HTMLElement).style.width : ''
    for (const attribute of Array.from(element.attributes)) element.removeAttribute(attribute.name)
    for (const property of allowedStyleProperties) {
      const value = styleValues[property]
      if (value && !(iconSeries && iconKey)) (element as HTMLElement).style.setProperty(property, value)
    }
    if (columnWidth) (element as HTMLElement).style.width = columnWidth
    if (bindingExpression !== null) element.setAttribute('data-oc-binding', bindingExpression)
    if (iconSeries && iconKey) {
      element.setAttribute('data-oc-icon-series', iconSeries); element.setAttribute('data-oc-icon-key', iconKey)
      element.textContent = `[[icon:${iconSeries}/${iconKey}]]`
    }
    if (embed?.id && embed.key) {
      element.setAttribute('data-oc-id', embed.id); element.setAttribute('data-oc-key', embed.key); element.setAttribute('data-oc-layout', embed.layout)
    }
    if (propertyKey) element.setAttribute('data-oc-key', propertyKey)
  }
  return documentNode.body.innerHTML
}

function normalizeProjectFontFamilyStyle(value: string): string {
  const trimmed = value.trim()
  const unquoted = trimmed.length >= 2 && ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")))
    ? trimmed.slice(1, -1) : trimmed
  if (!unquoted.startsWith('font:')) return value
  const id = unquoted.slice('font:'.length)
  return id ? JSON.stringify(`OpenCardProjectFont-${id}`) : value
}
function sanitizeBindingExpression(value: string | null): string | null {
  if (value === null) return null
  const expression = value.trim()
  return /[{}<>\u0000-\u001f\u007f]/.test(expression) ? null : expression
}
function sanitizeKey(value: string | null): string | null { const key = value?.trim() ?? ''; return keyPattern.test(key) ? key : null }
function sanitizeEmbedId(value: string | null): string | null { const id = value?.trim() ?? ''; return embedIdPattern.test(id) ? id : null }

export function normalizeRichTextHtml(source: string): string {
  const sourceDocument = new DOMParser().parseFromString(source, 'text/html')
  if (sourceDocument.body.children.length > 0) {
    const sanitizedDocument = new DOMParser().parseFromString(sanitizeRichTextHtml(source), 'text/html')
    for (const node of Array.from(sanitizedDocument.body.childNodes)) if (node instanceof Text && !node.data.trim()) node.remove()
    return sanitizedDocument.body.innerHTML
  }
  const documentNode = document.implementation.createHTMLDocument('')
  for (const line of source.replace(/\r\n?/g, '\n').split('\n')) {
    const paragraph = documentNode.createElement('p')
    if (line) paragraph.textContent = line; else paragraph.append(documentNode.createElement('br'))
    documentNode.body.append(paragraph)
  }
  return documentNode.body.innerHTML
}

export function formatRichTextHtmlSource(source: string): string {
  const parsed = parseRichTextHtml(source, { allowUnresolvedBindings: true })
  const value = parsed.canEnterVisualMode && /<[^>]+>/.test(source) ? source : normalizeRichTextHtml(source)
  const documentNode = new DOMParser().parseFromString(value, 'text/html')
  // Formatting whitespace between block nodes becomes real text when Tiptap preserves whitespace.
  return Array.from(documentNode.body.childNodes).map(node => node instanceof Element ? node.outerHTML : node.textContent ?? '').join('')
}
