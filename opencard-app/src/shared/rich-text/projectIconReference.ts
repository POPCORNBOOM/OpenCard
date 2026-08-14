export type ProjectIconReference = {
  seriesKey: string
  iconKey: string
}

export const PROJECT_ICON_ELEMENT_SELECTOR = '[data-oc-icon-path]'

const projectIconKeyPattern = /^[a-z0-9][a-z0-9._-]*$/

export function formatProjectIconPath(seriesKey: string, iconKey: string): string {
  return `${seriesKey}/${iconKey}`
}

export function parseProjectIconPath(path: string): ProjectIconReference | null {
  const separator = path.indexOf('/')
  if (separator <= 0 || separator === path.length - 1) return null
  const seriesKey = path.slice(0, separator).trim()
  const iconKey = path.slice(separator + 1).trim()
  return projectIconKeyPattern.test(seriesKey) && projectIconKeyPattern.test(iconKey)
    ? { seriesKey, iconKey }
    : null
}

export function readProjectIconElement(element: Element): ProjectIconReference | null {
  return parseProjectIconPath(element.getAttribute('data-oc-icon-path')?.trim() ?? '')
}

export function writeProjectIconElement(element: Element, reference: ProjectIconReference): void {
  element.setAttribute('data-oc-icon-path', formatProjectIconPath(reference.seriesKey, reference.iconKey))
  element.replaceChildren()
}

export function collectProjectIconReferences(source: string): ProjectIconReference[] {
  const documentNode = new DOMParser().parseFromString(source, 'text/html')
  const references: ProjectIconReference[] = []
  const iconElements = Array.from(documentNode.body.querySelectorAll(PROJECT_ICON_ELEMENT_SELECTOR))
  for (const element of iconElements) {
    const reference = readProjectIconElement(element)
    if (reference) references.push(reference)
  }

  return references
}

export function rewriteProjectIconReferences(
  source: string,
  replace: (reference: ProjectIconReference) => ProjectIconReference | null,
): string {
  const documentNode = new DOMParser().parseFromString(source, 'text/html')
  let changed = false

  for (const element of Array.from(documentNode.body.querySelectorAll(PROJECT_ICON_ELEMENT_SELECTOR))) {
    const reference = readProjectIconElement(element)
    const replacement = reference ? replace(reference) : null
    if (!reference || !replacement
      || (replacement.seriesKey === reference.seriesKey && replacement.iconKey === reference.iconKey)) continue
    writeProjectIconElement(element, replacement)
    changed = true
  }

  return changed ? documentNode.body.innerHTML : source
}
