import { describe, expect, it } from 'vitest'
import { createProjectCustomBlockInstance } from './createProjectCustomBlockInstance'

describe('createProjectCustomBlockInstance', () => {
  it('copies the public contract and applies changed defaults only to new instances', () => {
    const entry = {
      manifest: {
        key: 'square',
        name: 'Square',
        interfaceHash: 'stable-interface',
        publicFields: [{ key: 'size', fieldType: 'number' as const, title: 'Size', defaultValue: '100' }],
      },
    }
    const first = createProjectCustomBlockInstance(entry)
    const second = createProjectCustomBlockInstance({
      manifest: {
        ...entry.manifest,
        publicFields: [{ ...entry.manifest.publicFields[0], defaultValue: '200' }],
      },
    })

    expect(first).toMatchObject({
      source: 'block:square',
      interfaceHash: 'stable-interface',
      additionalFieldDefinition: { size: { fieldType: 'number', title: 'Size' } },
      size: '100',
    })
    expect(second).toMatchObject({ size: '200' })
    expect((first as unknown as Record<string, unknown>).size).toBe('100')
  })
})
