import { describe, expect, it } from 'vitest'
import { isCardDesignerNavigationToken } from './cardDesignerNavigation'

describe('card designer navigation token', () => {
  it('accepts a versioned property target', () => {
    expect(isCardDesignerNavigationToken({
      protocol: 'card-designer',
      version: 2,
      target: {
        kind: 'property',
        instanceId: 'instance-1',
        faceKey: 'front',
        blockId: 'block-1',
        owner: 'location',
        fieldKey: 'x',
        characterOffset: 3,
      },
    })).toBe(true)
  })

  it('rejects ambiguous owner targets and non-JSON payloads', () => {
    expect(isCardDesignerNavigationToken({
      protocol: 'card-designer',
      version: 2,
      target: {
        kind: 'property',
        instanceId: null,
        faceKey: null,
        owner: 'instance',
        fieldKey: 'name',
      },
    })).toBe(false)
    expect(isCardDesignerNavigationToken({
      protocol: 'card-designer',
      version: 2,
      target: {
        kind: 'property',
        instanceId: null,
        faceKey: null,
        owner: 'document',
        fieldKey: 'name',
        characterOffset: -1,
      },
    })).toBe(false)
    expect(isCardDesignerNavigationToken({
      protocol: 'card-designer',
      version: 2,
      target: {
        kind: 'property',
        instanceId: null,
        faceKey: null,
        owner: 'document',
        fieldKey: 'name',
        characterOffset: 1.5,
      },
    })).toBe(false)
    expect(isCardDesignerNavigationToken({
      protocol: 'card-designer',
      version: 2,
      target: {
        kind: 'property',
        instanceId: null,
        faceKey: null,
        owner: 'document',
        fieldKey: 'name',
      },
      invalid: () => undefined,
    })).toBe(false)
  })
})
