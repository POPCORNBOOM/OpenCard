import { describe, expect, it } from 'vitest'
import {
  createBlock,
  createCardFace,
  type CardDocument,
  type CardInstanceRecord,
} from './model'
import { applyInstance } from './instance'
import { buildParentLookup } from './tree'

describe('QR code and shape blocks', () => {
  it('creates an independent card face root', () => {
    const face = createCardFace({ id: 'front' })

    expect(face).toEqual({
      type: 'card-face',
      id: 'front',
      background: '#FFFFFF',
      children: [],
    })
  })

  it('creates sparse blocks with their semantic defaults', () => {
    expect(createBlock('text-block', { id: 'rich-text' })).toMatchObject({
      id: 'rich-text',
      type: 'text-block',
      content: '',
    })
    expect(createBlock('markdown-text-block', { id: 'markdown' })).toMatchObject({
      id: 'markdown',
      type: 'markdown-text-block',
      content: '',
    })
    expect(createBlock('qrcode-block', { id: 'qr' })).toMatchObject({
      id: 'qr',
      type: 'qrcode-block',
      content: '',
      errorCorrection: 'M',
      foreground: '#000000',
      backgroundColor: '#FFFFFF',
      quietZone: '4',
    })
    expect(createBlock('shape-block', { id: 'shape' })).toMatchObject({
      id: 'shape',
      type: 'shape-block',
      shape: 'rectangle',
      fill: '#7C6CFF',
      stroke: '#000000',
      strokeWidth: '0',
      strokeStyle: 'solid',
      strokeAlignment: 'center',
      strokeJoin: 'miter',
      strokeCap: 'butt',
      strokeMiterLimit: '4',
    })
  })

  it('applies instance overrides without owning render materialization', () => {
    const qr = createBlock('qrcode-block', { id: 'qr', name: 'Blueprint QR', content: 'blueprint' })
    const document: CardDocument = {
      type: 'card-document',

      id: 'doc',
      name: 'Document',
      version: '1.0.0',
      width: '540',
      height: '850',
      instances: [],
      faces: {
        front: {
          type: 'card-face',
          id: 'front',
          background: '#FFFFFF',
          children: [{
            block: qr,
            location: { id: 'location', type: 'simple-container-location', anchor: 'lt' },
          }],
        },
        back: {
          type: 'card-face',
          id: 'back',
          background: '#000000',
          children: [{
            block: createBlock('qrcode-block', { id: 'back-qr', content: 'back-blueprint' }),
            location: { id: 'back-location', type: 'simple-container-location', anchor: 'lt' },
          }],
        },
      },
    }
    const instance: CardInstanceRecord = {
      type: 'card-instance',
      id: 'instance',
      name: 'Instance',
      amount: '1',
      data: {
        qr: { name: 'Instance QR', content: 'instance', errorCorrection: 'H' },
        'back-qr': { content: 'back-instance' },
      },
    }

    const projected = applyInstance(document, instance)
    expect(projected.faces.front.children[0]?.block).toMatchObject({
      type: 'qrcode-block',
      name: 'Blueprint QR',
      content: 'instance',
      errorCorrection: 'H',
    })
    expect(projected.faces.back.children[0]?.block).toMatchObject({
      type: 'qrcode-block',
      content: 'back-instance',
    })
    const parentLookup = buildParentLookup(projected)
    expect(parentLookup.get('qr')).toBe(projected.faces.front)
    expect(parentLookup.get('back-qr')).toBe(projected.faces.back)
  })
})
