import { describe, expect, it } from 'vitest'
import { isProjectIconStyle, projectIconRenderers } from './projectIconStyle'

describe('projectIconStyle', () => {
  it('accepts every paint mode the shared contract renders', () => {
    for (const renderer of projectIconRenderers) {
      expect(isProjectIconStyle({ '--oc-project-icon-renderer': renderer })).toBe(true)
    }
  })

  it('rejects styles that do not paint a project icon', () => {
    expect(isProjectIconStyle(undefined)).toBe(false)
    expect(isProjectIconStyle({})).toBe(false)
    expect(isProjectIconStyle({ '--oc-project-icon-renderer': 'inline-style' })).toBe(false)
    expect(isProjectIconStyle({ '--oc-project-icon-renderer': 'atlas-crop' })).toBe(false)
    expect(isProjectIconStyle({ background: 'red' })).toBe(false)
  })
})
