import { describe, expect, it } from 'vitest'
import { createProjectCustomBlockInstance } from './createProjectCustomBlockInstance'
import { createTextBlock } from '../../../entities/card/model'

describe('createProjectCustomBlockInstance', () => {
  it('copies the public contract and applies changed defaults only to new instances', () => {
    const entry = {
      manifest: {
        customBlockKey: 'square',
        name: 'Square',
        publicFieldKeys: ['size', 'content'],
      },
      block: Object.assign(createTextBlock(), {
        size: '100',
        content: 'Native default',
        additionalFieldDefinition: { size: { fieldType: 'number' as const, title: 'Size' } },
      }),
    }
    const first = createProjectCustomBlockInstance(entry)
    const second = createProjectCustomBlockInstance({
      manifest: {
        ...entry.manifest,
        publicFieldKeys: ['size'],
      },
      block: Object.assign(createTextBlock(), {
        size: '200',
        additionalFieldDefinition: { size: { fieldType: 'number' as const, title: 'Size' } },
      }),
    })

    expect(first).toMatchObject({
      customBlockKey: 'square',
      size: '100',
      content: 'Native default',
    })
    expect(first).not.toHaveProperty('additionalFieldDefinition')
    expect(second).toMatchObject({ size: '200' })
    expect((first as unknown as Record<string, unknown>).size).toBe('100')
  })
})
