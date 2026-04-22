import { describe, expect, it } from 'vitest'
import { resolveAppView } from './appView'

describe('resolveAppView', () => {
  it('maps view=ui-kit to ui-kit page', () => {
    expect(resolveAppView('?view=ui-kit')).toBe('ui-kit')
  })

  it('keeps compatibility for view=buttons', () => {
    expect(resolveAppView('?view=buttons')).toBe('ui-kit')
  })

  it('falls back to ide when view is missing or unknown', () => {
    expect(resolveAppView('')).toBe('ide')
    expect(resolveAppView('?view=unknown')).toBe('ide')
  })
})

