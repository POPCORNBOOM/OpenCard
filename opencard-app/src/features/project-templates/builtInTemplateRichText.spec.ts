import { describe, expect, it } from 'vitest'
import playingCardSource from '../../../src-tauri/resources/templates/playing-card-reskin/content/playing-card.opencard?raw'
import tacticalSource from '../../../src-tauri/resources/templates/tactical-showcase/content/tactical-showcase.opencard?raw'

function collectTextBlockContents(value: unknown, contents: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectTextBlockContents(item, contents)
    return
  }
  if (!value || typeof value !== 'object') return

  const record = value as Record<string, unknown>
  if (record.type === 'text-block' && typeof record.content === 'string') {
    contents.push(record.content)
  }
  for (const child of Object.values(record)) collectTextBlockContents(child, contents)
}

function findRawBindingText(content: string): string[] {
  const documentNode = new DOMParser().parseFromString(content, 'text/html')
  const violations: string[] = []

  function visit(node: Node, insideBinding: boolean): void {
    const bindingElement = node instanceof Element && node.matches('span[data-oc-binding]')
      ? node
      : null
    if (bindingElement) {
      const expression = bindingElement.getAttribute('data-oc-binding')?.trim() ?? ''
      if (!expression || bindingElement.textContent !== `{{${expression}}}`) {
        violations.push(bindingElement.outerHTML)
      }
    }
    const isBinding = insideBinding || bindingElement !== null
    if (node instanceof Text && !isBinding && node.data.includes('{{')) {
      violations.push(node.data)
    }
    for (const child of Array.from(node.childNodes)) visit(child, isBinding)
  }

  visit(documentNode.body, false)
  return violations
}

describe('built-in template rich text', () => {
  it.each([
    ['playing-card-reskin', playingCardSource],
    ['tactical-showcase', tacticalSource],
  ])('encodes every %s TextBlock binding as a structured node', (_name, source) => {
    const contents: string[] = []
    collectTextBlockContents(JSON.parse(source), contents)

    expect(contents.length).toBeGreaterThan(0)
    expect(contents.flatMap(findRawBindingText)).toEqual([])
  })
})
