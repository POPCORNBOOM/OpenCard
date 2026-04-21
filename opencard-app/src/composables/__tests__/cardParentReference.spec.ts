import { describe, expect, it } from 'vitest'
import {
  buildParentLookup,
  resolveParentFieldReferenceKey,
  type CardDocument,
} from '../../entities/card/model'

function createDocumentForParentReference(): CardDocument {
  return {
    type: 'card-document',
    name: 'doc',
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
                id: 'container-2',
                name: 'container-2',
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
                      content: 'leaf',
                      mode: 'plain',
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    ],
    instances: [],
  }
}

describe('resolveParentFieldReferenceKey', () => {
  it('resolves parent reference to blockId:field', () => {
    const document = createDocumentForParentReference()
    const parentLookup = buildParentLookup(document)

    expect(resolveParentFieldReferenceKey('leaf-1', 'p:name', parentLookup)).toBe('container-2:name')
  })

  it('supports multi-level parent reference', () => {
    const document = createDocumentForParentReference()
    const parentLookup = buildParentLookup(document)

    expect(resolveParentFieldReferenceKey('leaf-1', 'p.p:name', parentLookup)).toBe('container-1:name')
  })

  it('returns null when parent chain reaches document boundary', () => {
    const document = createDocumentForParentReference()
    const parentLookup = buildParentLookup(document)

    expect(resolveParentFieldReferenceKey('leaf-1', 'p.p.p:width', parentLookup)).toBeNull()
  })

  it('resolves document reference to documentId:field', () => {
    const document = createDocumentForParentReference()
    const parentLookup = buildParentLookup(document)

    expect(resolveParentFieldReferenceKey('leaf-1', 'd:height', parentLookup)).toBe('doc-1:height')
  })

  it('returns null for invalid reference token', () => {
    const document = createDocumentForParentReference()
    const parentLookup = buildParentLookup(document)

    expect(resolveParentFieldReferenceKey('leaf-1', '_doc_:name', parentLookup)).toBeNull()
    expect(resolveParentFieldReferenceKey('leaf-1', 'p:', parentLookup)).toBeNull()
  })
})
