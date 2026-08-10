import { describe, expect, it } from 'vitest'
import { createCardComparisonChanges } from './cardComparison'
import type { CardDocument } from '../../../entities/card/model'

const createDocument = (name: string): CardDocument => ({
  type: 'card-document', schemaVersion: '2', id: 'doc', name, version: '1', width: '640', height: '900',
  faces: {
    front: { type: 'card-face', id: 'face-front', background: '#000', children: [{
      block: { type: 'text-block', id: 'block-a', content: 'A' },
      location: { id: 'location-a', type: 'simple-container-location', anchor: 'lt', x: '0', y: '0' },
    }] },
    back: { type: 'card-face', id: 'face-back', background: '#000', children: [] },
  },
  instances: [{ type: 'card-instance', id: 'instance-a', name: 'A', amount: '1', data: {} }],
})

describe('createCardComparisonChanges', () => {
  it('marks direct document, instance and block changes without cascading child changes', () => {
    const historical = createDocument('old')
    const current = structuredClone(historical)
    current.name = 'new'
    current.instances[0]!.name = 'new instance'
    const block = current.faces.front.children[0]!.block
    if (block.type !== 'text-block') throw new Error('fixture block type changed')
    block.content = 'changed'

    const changes = createCardComparisonChanges(historical, current)
    expect(changes.documentChanged).toBe(true)
    expect(changes.instanceIds).toEqual(new Set(['instance-a']))
    expect(changes.blockIds).toEqual(new Set(['block-a']))
    expect(changes.faceIds).toEqual(new Set())
  })

  it('marks additions and deletions by stable ids', () => {
    const historical = createDocument('same')
    const current = structuredClone(historical)
    current.faces.front.children = []
    current.instances = []

    const changes = createCardComparisonChanges(historical, current)
    expect(changes.blockIds).toEqual(new Set(['block-a']))
    expect(changes.instanceIds).toEqual(new Set(['instance-a']))
  })
})
