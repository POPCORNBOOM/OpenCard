import { afterEach, describe, expect, it, vi } from 'vitest'
import { getOcTheme, setOcTheme } from './theme'
import { OC_THEME_TOKEN_KEYS } from './themeTokens'
import { OC_THEME_REGISTRY } from './themes'

afterEach(() => {
  const root = document.documentElement
  for (const key of OC_THEME_TOKEN_KEYS) {
    root.style.removeProperty(key)
  }
  delete root.dataset.ocTheme
  vi.restoreAllMocks()
})

describe('theme registry', () => {
  it('applies dark theme tokens into :root', () => {
    setOcTheme('dark')

    const root = document.documentElement
    expect(getOcTheme()).toBe('dark')
    expect(root.dataset.ocTheme).toBe('dark')
    expect(root.style.getPropertyValue('--oc-bg-base')).toBe(OC_THEME_REGISTRY.dark['--oc-bg-base'])
  })

  it('falls back to dark theme when theme id is unknown', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    setOcTheme('unknown-theme')

    const root = document.documentElement
    expect(getOcTheme()).toBe('dark')
    expect(root.dataset.ocTheme).toBe('dark')
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })
})
