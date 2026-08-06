import { describe, expect, it } from 'vitest'
import type { CardBlock } from '../../entities/card/model'
import { getBlockPresentation } from './blockPresentation'

const blockTypes: CardBlock['type'][] = [
  'text-block',
  'markdown-text-block',
  'image-block',
  'qrcode-block',
  'shape-block',
  'simple-container-block',
  'flow-container-block',
]

describe('block presentation', () => {
  it('assigns every block type a distinct semantic icon tone', () => {
    const presentations = blockTypes.map(getBlockPresentation)

    expect(new Set(presentations.map(presentation => presentation.icon)).size).toBe(blockTypes.length)
    expect(new Set(presentations.map(presentation => presentation.iconTone)).size).toBe(blockTypes.length)
  })
})
