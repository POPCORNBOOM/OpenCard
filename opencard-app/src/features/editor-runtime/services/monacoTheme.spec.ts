import { describe, expect, it } from 'vitest'
import { createOcMonacoTheme } from './monacoTheme'

describe('createOcMonacoTheme', () => {
  it('maps dark OC tokens and converts rgba colors for Monaco', () => {
    const theme = createOcMonacoTheme('dark')

    expect(theme.base).toBe('vs-dark')
    expect(theme.colors['editor.background']).toBe('#2d2d2d')
    expect(theme.colors['editor.selectionBackground']).toBe('#7c6cff29')
  })

  it('uses the light Monaco base for the light OC theme', () => {
    const theme = createOcMonacoTheme('light')

    expect(theme.base).toBe('vs')
    expect(theme.colors['editor.foreground']).toBe('#1f2430')
  })
})
