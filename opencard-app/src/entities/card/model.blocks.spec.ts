import { describe, expect, it } from 'vitest'
import {
  applyInstance,
  createBlock,
  toViewBlock,
  type CardDocument,
  type CardInstanceRecord,
} from './model'

describe('QR code and shape blocks', () => {
  it('creates sparse blocks with their semantic defaults', () => {
    expect(createBlock('qrcode-block', { id: 'qr' })).toMatchObject({
      id: 'qr',
      type: 'qrcode-block',
      content: '',
      errorCorrection: 'M',
      foreground: '#000000',
      backgroundColor: '#FFFFFF',
      quietZone: 4,
    })
    expect(createBlock('shape-block', { id: 'shape' })).toMatchObject({
      id: 'shape',
      type: 'shape-block',
      shape: 'rectangle',
      fill: '#7C6CFF',
      stroke: '#000000',
      strokeWidth: 0,
      strokeStyle: 'solid',
      strokeAlignment: 'center',
      strokeJoin: 'miter',
      strokeCap: 'butt',
      strokeMiterLimit: 4,
    })
  })

  it('materializes missing render defaults and applies instance overrides', () => {
    const qr = toViewBlock({ id: 'qr', type: 'qrcode-block', content: 'blueprint' })
    expect(qr).toMatchObject({ errorCorrection: 'M', quietZone: 4 })

    const document: CardDocument = {
      type: 'card-document',
      id: 'doc',
      name: 'Document',
      version: '1.0.0',
      width: 540,
      height: 850,
      background: '#FFFFFF',
      instances: [],
      children: [{
        block: qr,
        location: { id: 'location', type: 'simple-container-location', anchor: 'lt' },
      }],
    }
    const instance: CardInstanceRecord = {
      type: 'card-instance',
      id: 'instance',
      name: 'Instance',
      amount: 1,
      data: { qr: { content: 'instance', errorCorrection: 'H' } },
    }

    expect(applyInstance(document, instance).children[0]?.block).toMatchObject({
      type: 'qrcode-block',
      content: 'instance',
      errorCorrection: 'H',
    })
  })
})
