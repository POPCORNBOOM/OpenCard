export type ProjectIconReference = {
  seriesKey: string
  iconKey: string
}

export type ProjectIconTokenMatch = ProjectIconReference & {
  token: string
  index: number
}

export const PROJECT_ICON_ELEMENT_SELECTOR = '[data-oc-icon-series][data-oc-icon-key]'

const projectIconKeyPattern = /^[a-z0-9][a-z0-9._-]*$/
const projectIconTokenPatternSource = String.raw`\[\[icon:([a-z0-9][a-z0-9._-]*)\/([a-z0-9][a-z0-9._-]*)\]\]`

export function formatProjectIconToken(seriesKey: string, iconKey: string): string {
  return `[[icon:${seriesKey}/${iconKey}]]`
}

export function parseProjectIconToken(value: string): ProjectIconReference | null {
  const matches = findProjectIconTokenMatches(value)
  const match = matches[0]
  return match && match.index === 0 && match.token.length === value.length
    ? { seriesKey: match.seriesKey, iconKey: match.iconKey }
    : null
}

export function findProjectIconTokenMatches(value: string): ProjectIconTokenMatch[] {
  return [...value.matchAll(new RegExp(projectIconTokenPatternSource, 'g'))].map(match => ({
    token: match[0],
    seriesKey: match[1]!,
    iconKey: match[2]!,
    index: match.index!,
  }))
}

export function readProjectIconElement(element: Element): ProjectIconReference | null {
  const seriesKey = element.getAttribute('data-oc-icon-series')?.trim() ?? ''
  const iconKey = element.getAttribute('data-oc-icon-key')?.trim() ?? ''
  if (!projectIconKeyPattern.test(seriesKey) || !projectIconKeyPattern.test(iconKey)) return null
  return { seriesKey, iconKey }
}

export function writeProjectIconElement(element: Element, reference: ProjectIconReference): void {
  element.setAttribute('data-oc-icon-series', reference.seriesKey)
  element.setAttribute('data-oc-icon-key', reference.iconKey)
  element.textContent = formatProjectIconToken(reference.seriesKey, reference.iconKey)
}

export function collectProjectIconReferences(source: string): ProjectIconReference[] {
  const documentNode = new DOMParser().parseFromString(source, 'text/html')
  const references: ProjectIconReference[] = []
  const iconElements = Array.from(documentNode.body.querySelectorAll(PROJECT_ICON_ELEMENT_SELECTOR))
  for (const element of iconElements) {
    const reference = readProjectIconElement(element)
    if (reference) references.push(reference)
  }

  const walker = documentNode.createTreeWalker(documentNode.body, NodeFilter.SHOW_TEXT)
  let current: Node | null
  while ((current = walker.nextNode())) {
    if (current.parentElement?.closest(PROJECT_ICON_ELEMENT_SELECTOR)) continue
    references.push(...findProjectIconTokenMatches(current.textContent ?? '').map(match => ({
      seriesKey: match.seriesKey,
      iconKey: match.iconKey,
    })))
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

  const walker = documentNode.createTreeWalker(documentNode.body, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  let current: Node | null
  while ((current = walker.nextNode())) {
    if (current.parentElement?.closest(PROJECT_ICON_ELEMENT_SELECTOR)) continue
    if (findProjectIconTokenMatches(current.textContent ?? '').length > 0) textNodes.push(current as Text)
  }

  for (const textNode of textNodes) {
    const value = textNode.data
    const matches = findProjectIconTokenMatches(value)
    let lastIndex = 0
    let rewritten = ''
    for (const match of matches) {
      const replacement = replace(match)
      rewritten += value.slice(lastIndex, match.index)
      rewritten += replacement ? formatProjectIconToken(replacement.seriesKey, replacement.iconKey) : match.token
      if (replacement && (replacement.seriesKey !== match.seriesKey || replacement.iconKey !== match.iconKey)) changed = true
      lastIndex = match.index + match.token.length
    }
    rewritten += value.slice(lastIndex)
    if (rewritten !== value) textNode.data = rewritten
  }

  return changed ? documentNode.body.innerHTML : source
}
