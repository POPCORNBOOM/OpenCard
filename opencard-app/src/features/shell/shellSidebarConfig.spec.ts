import { describe, expect, it } from 'vitest'
import { OC_SHARED_THEME_TOKENS } from '../../shared/ui/foundation/themes'
import { isRepositorySidebarReady, SHELL_SIDEBAR_COLLAPSE_THRESHOLD } from './shellSidebarConfig'

describe('shellSidebarConfig', () => {
  it('projects the collapse threshold from the foundation theme contract', () => {
    expect(SHELL_SIDEBAR_COLLAPSE_THRESHOLD)
      .toBe(Number.parseFloat(OC_SHARED_THEME_TOKENS['--oc-shell-sidebar-collapse-threshold']))
  })

  it('shows repository trees only after Git initialization is confirmed', () => {
    expect(isRepositorySidebarReady(null)).toBe(false)
    expect(isRepositorySidebarReady(false)).toBe(false)
    expect(isRepositorySidebarReady(true)).toBe(true)
  })
})
