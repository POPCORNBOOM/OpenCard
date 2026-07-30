import { describe, expect, it } from 'vitest'
import { getReadableForegroundTone, hexToHsv, hsvToHex, normalizeHexColor } from './colorModel'

describe('colorModel', () => {
  it('normalizes short and long hex values', () => {
    expect(normalizeHexColor('#1aF')).toBe('#11AAFF')
    expect(normalizeHexColor('#12abEF')).toBe('#12ABEF')
    expect(normalizeHexColor('red')).toBeNull()
  })

  it.each(['#FF0000', '#00FF00', '#0000FF', '#7C6CFF', '#000000', '#FFFFFF'])(
    'round-trips %s through HSV',
    (hex) => expect(hsvToHex(hexToHsv(hex)!)).toBe(hex),
  )

  it('chooses whether a dark or light foreground has higher contrast', () => {
    expect(getReadableForegroundTone('#111111')).toBe('light')
    expect(getReadableForegroundTone('#F5F6FB')).toBe('dark')
    expect(getReadableForegroundTone('#7C6CFF')).toBe('dark')
  })
})
