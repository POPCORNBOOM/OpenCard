import { describe, expect, it } from 'vitest'
import { createProjectCustomBlockInstance } from './createProjectCustomBlockInstance'

describe('createProjectCustomBlockInstance', () => {
  it('persists only identity and explicit host values, not package defaults', () => {
    const instance = createProjectCustomBlockInstance({
      definition: { key: 'status-badge', name: 'Status Badge' },
    }, { id: 'host', name: 'Preview Badge' })

    expect(instance).toEqual({
      type: 'custom-block',
      id: 'host',
      name: 'Preview Badge',
      customBlockKey: 'block:status-badge',
    })
    expect(instance).not.toHaveProperty('content')
    expect(instance).not.toHaveProperty('width')
  })
})
