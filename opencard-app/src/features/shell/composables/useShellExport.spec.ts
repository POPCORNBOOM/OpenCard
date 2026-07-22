import { describe, expect, it } from 'vitest'
import type { CardDocument } from '../../../entities/card/model'
import {
  buildCardExportQueue,
  resolveActiveCardExportTarget,
} from './useShellExport'

function createDocument(): CardDocument {
  return {
    type: 'card-document',
    schemaVersion: '2',
    id: 'document',
    name: 'Card',
    version: '1.0.0',
    width: '540',
    height: '850',
    faces: {
      front: {
        type: 'card-face',
        id: 'front-face',
        background: '#FFFFFF',
        children: [],
      },
      back: {
        type: 'card-face',
        id: 'back-face',
        background: '#111111',
        children: [],
      },
    },
    instances: [{
      type: 'card-instance',
      id: 'knight',
      name: 'Knight / Elite',
      amount: '1',
      data: {},
    }],
  }
}

describe('useShellExport queue', () => {
  it('exports both faces for the blueprint and every instance', () => {
    const queue = buildCardExportQueue('card', createDocument(), {
      name: 'Project',
      description: '',
    })

    expect(queue.map((entry) => entry.fileName)).toEqual([
      'card_blueprint_front.png',
      'card_blueprint_back.png',
      'card_instance_Knight___Elite_front.png',
      'card_instance_Knight___Elite_back.png',
    ])
    expect(queue.map((entry) => entry.face.faceKey)).toEqual([
      'front',
      'back',
      'front',
      'back',
    ])
    expect(queue.map((entry) => entry.face.id)).toEqual([
      'front-face',
      'back-face',
      'front-face',
      'back-face',
    ])
  })

  it('uses the current instance and face for a single export', () => {
    const target = resolveActiveCardExportTarget(createDocument(), {
      activeFace: 'back',
      clipToFace: false,
      selectedInstanceId: 'knight',
    })

    expect(target).toMatchObject({
      faceKey: 'back',
      projectionSuffix: 'instance_Knight___Elite',
      instance: { id: 'knight' },
    })
  })

  it('falls back to the front blueprint when the session selection is absent or stale', () => {
    expect(resolveActiveCardExportTarget(createDocument(), undefined)).toEqual({
      faceKey: 'front',
      instance: null,
      projectionSuffix: 'blueprint',
    })
    expect(resolveActiveCardExportTarget(createDocument(), {
      activeFace: 'back',
      clipToFace: true,
      selectedInstanceId: 'missing',
    })).toEqual({
      faceKey: 'back',
      instance: null,
      projectionSuffix: 'blueprint',
    })
  })
})
