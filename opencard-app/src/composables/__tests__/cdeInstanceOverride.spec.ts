import { describe, expect, it } from 'vitest'
import { resetInstanceOverrideField } from '../cdeInstanceOverride'

describe('resetInstanceOverrideField', () => {
  it('removes field override and prunes empty block override record', () => {
    const instanceData: Record<string, Record<string, unknown>> = {
      'block-1': {
        color: '#ff0000',
      },
    }

    const didReset = resetInstanceOverrideField(instanceData, 'block-1', 'color')

    expect(didReset).toBe(true)
    expect(instanceData).toEqual({})
  })

  it('keeps other override fields when resetting one field', () => {
    const instanceData: Record<string, Record<string, unknown>> = {
      'block-1': {
        color: '#ff0000',
        fontSize: 24,
      },
    }

    const didReset = resetInstanceOverrideField(instanceData, 'block-1', 'color')

    expect(didReset).toBe(true)
    expect(instanceData).toEqual({
      'block-1': {
        fontSize: 24,
      },
    })
  })

  it('returns false when target field override does not exist', () => {
    const instanceData: Record<string, Record<string, unknown>> = {
      'block-1': {
        color: '#ff0000',
      },
    }

    const didReset = resetInstanceOverrideField(instanceData, 'block-1', 'lineHeight')

    expect(didReset).toBe(false)
    expect(instanceData).toEqual({
      'block-1': {
        color: '#ff0000',
      },
    })
  })
})
