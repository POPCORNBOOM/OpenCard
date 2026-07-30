import { describe, expect, it } from 'vitest'
import { createOcMonacoTheme } from './monacoTheme'

describe('createOcMonacoTheme', () => {
  it('maps dark OC tokens and converts rgba colors for Monaco', () => {
    const theme = createOcMonacoTheme('dark')

    expect(theme.base).toBe('vs-dark')
    expect(theme.colors['editor.background']).toBe('#2d2d2d')
    expect(theme.colors['editor.selectionBackground']).toBe('#A260FF29')
  })

  it('uses the light Monaco base for the light OC theme', () => {
    const theme = createOcMonacoTheme('light')

    expect(theme.base).toBe('vs')
    expect(theme.colors['editor.foreground']).toBe('#1f2430')
  })

  it('uses the same derived accent family as the application theme', () => {
    const theme = createOcMonacoTheme('light', { '--oc-accent': '#123456' })

    expect(theme.colors['focusBorder']).toBe('#123456')
    expect(theme.colors['editorCursor.foreground']).toBe('#123456')
    expect(theme.colors['editor.selectionBackground']).toBe('#1234561F')
    expect(theme.colors['editor.inactiveSelectionBackground']).toBe('#1234561A')
  })
})
