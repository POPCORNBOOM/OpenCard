import { describe, expect, it } from 'vitest'
import {
  resolveReferences,
  type CardDocument,
  type SimpleContainerBlock,
  type TextBlock,
} from '../../entities/card/model'

function createDocumentForReferenceResolve(): CardDocument {
  return {
    type: 'card-document',
    name: '{{d:name}}',
    id: 'doc-1',
    version: '1.0.0',
    width: 800,
    height: 600,
    children: [
      {
        location: {
          type: 'simple-container-location',
          anchor: 'lt',
          x: 0,
          y: 0,
        },
        block: {
          type: 'simple-container-block',
          id: 'container-1',
          name: 'container-1',
          outline: '{{oops}}',
          children: [
            {
              location: {
                type: 'simple-container-location',
                anchor: 'lt',
                x: '{{d:width}}',
                y: 0,
              },
              block: {
                type: 'text-block',
                id: 'leaf-1',
                name: 'leaf-1',
                content: 'Hello {{p:name}} @ {{d:height}}',
                mode: 'plain',
                fontSize: '{{d:width}}',
                lineHeight: '{{p:notThere}}',
                customCss: '{{d:children}}',
              },
            },
          ],
        },
      },
    ],
    instances: [],
  }
}

function createDocumentForInterpolationFailure(): CardDocument {
  return {
    type: 'card-document',
    name: 'doc',
    id: 'doc-1',
    version: '1.0.0',
    width: 100,
    height: 50,
    children: [
      {
        location: {
          type: 'simple-container-location',
          anchor: 'lt',
          x: 0,
          y: 0,
        },
        block: {
          type: 'simple-container-block',
          id: 'container-1',
          name: 'parent',
          children: [
            {
              location: {
                type: 'simple-container-location',
                anchor: 'lt',
                x: 0,
                y: 0,
              },
              block: {
                type: 'text-block',
                id: 'leaf-1',
                name: 'leaf-1',
                content: 'A {{p:name}} + {{p:notThere}}',
                mode: 'plain',
              },
            },
          ],
        },
      },
    ],
    instances: [],
  }
}

describe('resolveReferences', () => {
  it('resolves valid references and reports invalid tokens while keeping raw source immutable', () => {
    const document = createDocumentForReferenceResolve()
    const result = resolveReferences(document)

    const container = result.document.children[0].block as SimpleContainerBlock
    const leafChild = container.children[0]
    const leaf = leafChild.block as TextBlock

    expect(leaf.content).toBe('Hello container-1 @ 600')
    expect(leaf.fontSize).toBe(800)
    expect(leafChild.location.x).toBe(800)
    expect(leaf.lineHeight).toBe('{{p:notThere}}')
    expect(leaf.customCss).toBe('{{d:children}}')
    expect(container.outline).toBe('{{oops}}')
    expect(result.document.name).toBe('{{d:name}}')

    expect(result.issues.some((issue) => issue.code === 'FIELD_NOT_FOUND' && issue.path.endsWith('.lineHeight'))).toBe(true)
    expect(result.issues.some((issue) => issue.code === 'FIELD_NOT_ALLOWED' && issue.path.endsWith('.customCss'))).toBe(true)
    expect(result.issues.some((issue) => issue.code === 'INVALID_TOKEN' && issue.path.endsWith('.outline'))).toBe(true)
    expect(result.issues.some((issue) => issue.code === 'CYCLE' && issue.path === '$.name')).toBe(true)

    const rawContainer = document.children[0].block as SimpleContainerBlock
    const rawLeaf = rawContainer.children[0].block as TextBlock
    expect(rawLeaf.content).toBe('Hello {{p:name}} @ {{d:height}}')
    expect(document.name).toBe('{{d:name}}')
  })

  it('keeps whole interpolated string unchanged when one token fails', () => {
    const document = createDocumentForInterpolationFailure()
    const result = resolveReferences(document)
    const container = result.document.children[0].block as SimpleContainerBlock
    const leaf = container.children[0].block as TextBlock

    expect(leaf.content).toBe('A {{p:name}} + {{p:notThere}}')
    expect(result.issues.some((issue) => issue.code === 'FIELD_NOT_FOUND')).toBe(true)
  })
})
