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
])

const blockedTags = new Set(['IFRAME', 'OBJECT', 'SCRIPT', 'STYLE', 'TEMPLATE'])
const allowedStyleProperties = [
  'background-color',
  'color',
  'font-family',
  'text-align',
  '-webkit-text-stroke-color',
  '-webkit-text-stroke-width',
] as const

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

function sanitizeBindingExpression(value: string | null): string | null {
  if (value === null) return null
  const expression = value.trim()
  if (/[{}<>\u0000-\u001f\u007f]/.test(expression)) return null
  return expression
}

export function normalizeRichTextHtml(source: string): string {
  const sourceDocument = new DOMParser().parseFromString(source, 'text/html')
  if (sourceDocument.body.children.length > 0) return sanitizeRichTextHtml(source)

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
