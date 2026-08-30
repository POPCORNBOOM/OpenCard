import { describe, expect, it } from 'vitest'
import { createImageBlock, type CardDocument } from '../../entities/card/model'
import { EMPTY_PROJECT_ICON_CATALOG } from '../workspace/services/projectIconCatalog'
import { parseRenderDocument } from './renderParser'
import { prepareCardRender } from './renderPipeline'
import { validateRenderResources } from './validateRenderResources'

function documentWithImage(url: string): CardDocument {
  return {
    type: 'card-document', id: 'document', name: 'Document', version: '1.0.0',
    description: '', notes: '', width: '540', height: '850', instances: [],
    faces: {
      front: {
        type: 'card-face', id: 'front', background: '#fff',
        children: [{
          block: createImageBlock({ id: 'image', name: 'Portrait', image: url }),
          location: { id: 'location', type: 'simple-container-location', anchor: 'lt' },
        }],
      },
      back: { type: 'card-face', id: 'back', background: '#fff', children: [] },
    },
  }
}

function readyImage(url: string) {
  return parseRenderDocument(documentWithImage(url), { instanceId: 'instance' }).document
}

describe('validateRenderResources', () => {
  it('reports an allowed-format remote image blocked by the project policy', () => {
    const issues = validateRenderResources(
      readyImage('https://images.example.com/portrait.png'),
      { mode: 'deny' },
      'instance',
    )

    expect(issues).toEqual([expect.objectContaining({
      type: 'card-designer.resource.remote-blocked',
      location: expect.objectContaining({
        documentId: 'document', instanceId: 'instance', faceKey: 'front',
        owner: { kind: 'block', id: 'image' }, blockId: 'image', blockPath: 'Portrait', fieldKey: 'image',
      }),
      parameters: { fieldName: 'image' },
      details: { url: 'https://images.example.com/portrait.png' },
    })])
  })

  it('does not report an allowed host or a local project image', () => {
    const policy = { mode: 'allowlist', allowedHosts: ['images.example.com'] } as const
    expect(validateRenderResources(readyImage('https://images.example.com/portrait.png'), policy, null)).toEqual([])
    expect(validateRenderResources(readyImage('assets/portrait.png'), { mode: 'deny' }, null)).toEqual([])
  })

  it('adds the resource policy issue to the prepared render result', () => {
    const result = prepareCardRender({
      document: documentWithImage('https://images.example.com/portrait.png'),
      instance: null,
      resourceRootPath: 'D:/Cards',
      environment: {
        remoteResourcePolicy: { mode: 'deny' },
        projectIconCatalog: EMPTY_PROJECT_ICON_CATALOG,
      },
    })

    expect(result.issues).toContainEqual(expect.objectContaining({
      type: 'card-designer.resource.remote-blocked',
    }))
  })
})
