import { describe, expect, it } from 'vitest'
import { relativizeResourcePath, resolveResourcePath } from './scopedResourcePath'

const REGISTRY = 'C:/project/.opencard/icons/icons.json'

describe('per-set icon folder round trip', () => {
  it('writes a set-relative reference that resolves back to the same file', () => {
    const target = 'C:/project/.opencard/icons/outline/warn.svg'
    const reference = relativizeResourcePath('C:/project', REGISTRY, target)
    expect(reference).toEqual({ ok: true, value: '.opencard/icons/outline/warn.svg' })
    expect(resolveResourcePath('C:/project', REGISTRY, '.opencard/icons/outline/warn.svg'))
      .toEqual({ ok: true, value: target })
  })

  it('refuses a set folder that escapes the project', () => {
    expect(relativizeResourcePath('C:/project', REGISTRY, 'C:/elsewhere/warn.svg').ok).toBe(false)
    expect(resolveResourcePath('C:/project', REGISTRY, '.opencard/icons/../../warn.svg').ok).toBe(false)
  })
})
