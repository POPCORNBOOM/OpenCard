const allowedTags = new Set([
  'B',
  'BR',
  'EM',
  'I',
  'MARK',
  'P',
  'S',
  'SPAN',
  'STRIKE',
  'STRONG',
  'U',
])

const blockedTags = new Set(['IFRAME', 'OBJECT', 'SCRIPT', 'STYLE', 'TEMPLATE'])
const allowedStyleProperties = [
  'background-color',
  'color',
  'font-family',
  'font-size',
  'text-align',
  '-webkit-text-stroke-color',
  '-webkit-text-stroke-width',
] as const

export type RichTextTransformResult =
  | { ok: true, value: string }
  | { ok: false }

export type RichTextHtmlTransform = {
  resolveBindingNode: (expression: string) => RichTextTransformResult
  resolveTextNode: (value: string) => RichTextTransformResult
}

export function transformRichTextHtml(
  source: string,
  transform: RichTextHtmlTransform,
): RichTextTransformResult {
  const documentNode = new DOMParser().parseFromString(source, 'text/html')
  const hasElementContent = documentNode.body.children.length > 0
  let changed = false
  let failed = false

  function visit(node: Node): void {
    if (failed) return
    if (node instanceof Element) {
      if (blockedTags.has(node.tagName)) return
      if (node.tagName === 'SPAN' && node.hasAttribute('data-oc-binding')) {
        const expression = node.getAttribute('data-oc-binding')?.trim() ?? ''
        const result = transform.resolveBindingNode(expression)
        if (!result.ok) {
          failed = true
          return
        }
        if (node.textContent !== result.value) {
          node.textContent = result.value
          changed = true
        }
        return
      }
    }

    if (node instanceof Text) {
      const result = transform.resolveTextNode(node.data)
      if (!result.ok) {
        failed = true
        return
      }
      if (result.value !== node.data) {
        node.data = result.value
        changed = true
      }
      return
    }

    for (const child of Array.from(node.childNodes)) visit(child)
  }

  visit(documentNode.body)
  if (failed) return { ok: false }
  if (!changed) return { ok: true, value: source }
  return {
    ok: true,
    value: hasElementContent ? documentNode.body.innerHTML : documentNode.body.textContent ?? '',
  }
}

export function sanitizeRichTextHtml(source: string): string {
  const documentNode = new DOMParser().parseFromString(source, 'text/html')

  for (const element of Array.from(documentNode.body.querySelectorAll('*'))) {
    if (blockedTags.has(element.tagName)) {
      element.remove()
      continue
    }

    if (!allowedTags.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes))
      continue
    }

    const styleValues = Object.fromEntries(allowedStyleProperties.map(property => [
      property,
      (element as HTMLElement).style.getPropertyValue(property),
    ]))
    styleValues['font-family'] = normalizeLegacyProjectFontFamily(styleValues['font-family'])
    const bindingExpression = element.tagName === 'SPAN'
      ? sanitizeBindingExpression(element.getAttribute('data-oc-binding'))
      : null

    for (const attribute of Array.from(element.attributes)) {
      element.removeAttribute(attribute.name)
    }

    for (const property of allowedStyleProperties) {
      const value = styleValues[property]
      if (value) (element as HTMLElement).style.setProperty(property, value)
    }
    if (bindingExpression !== null) {
      element.setAttribute('data-oc-binding', bindingExpression)
    }
  }

  return documentNode.body.innerHTML
}

function normalizeLegacyProjectFontFamily(value: string): string {
  const trimmed = value.trim()
  const unquoted = trimmed.length >= 2
    && ((trimmed.startsWith('"') && trimmed.endsWith('"'))
      || (trimmed.startsWith("'") && trimmed.endsWith("'")))
    ? trimmed.slice(1, -1)
    : trimmed
  if (!unquoted.startsWith('project:')) return value
  const id = unquoted.slice('project:'.length)
  return id ? JSON.stringify(`OpenCardProjectFont-${id}`) : value
}

function sanitizeBindingExpression(value: string | null): string | null {
  if (value === null) return null
  const expression = value.trim()
  if (/[{}<>\u0000-\u001f\u007f]/.test(expression)) return null
  return expression
}

export function normalizeRichTextHtml(source: string): string {
  const sourceDocument = new DOMParser().parseFromString(source, 'text/html')
  if (sourceDocument.body.children.length > 0) {
    const sanitizedDocument = new DOMParser().parseFromString(sanitizeRichTextHtml(source), 'text/html')
    for (const node of Array.from(sanitizedDocument.body.childNodes)) {
      if (node instanceof Text && !node.data.trim()) node.remove()
    }
    return sanitizedDocument.body.innerHTML
  }

  const documentNode = document.implementation.createHTMLDocument('')
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  for (const line of lines) {
    const paragraph = documentNode.createElement('p')
    if (line) paragraph.textContent = line
    else paragraph.append(documentNode.createElement('br'))
    documentNode.body.append(paragraph)
  }

  return documentNode.body.innerHTML
}

export function formatRichTextHtmlSource(source: string): string {
  const documentNode = new DOMParser().parseFromString(normalizeRichTextHtml(source), 'text/html')
  return Array.from(documentNode.body.childNodes)
    .map(node => node instanceof Element ? node.outerHTML : node.textContent ?? '')
    .join('\n')
}
