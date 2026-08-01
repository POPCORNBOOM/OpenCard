import { describe, expect, it } from 'vitest'
import {
  getReadableForegroundTone,
  hexToHsv,
  hexToHsva,
  hsvaToHex,
  hsvToHex,
  normalizeHexColor,
} from './colorModel'

describe('colorModel', () => {
  it('normalizes short and long hex values', () => {
    expect(normalizeHexColor('#1aF')).toBe('#11AAFF')
    expect(normalizeHexColor('#1aF8')).toBe('#11AAFF88')
    expect(normalizeHexColor('#12abEF')).toBe('#12ABEF')
    expect(normalizeHexColor('#12abEF80')).toBe('#12ABEF80')
    expect(normalizeHexColor('red')).toBeNull()
  })

  it.each(['#FF0000', '#00FF00', '#0000FF', '#7C6CFF', '#000000', '#FFFFFF'])(
    'round-trips %s through HSV',
    (hex) => expect(hsvToHex(hexToHsv(hex)!)).toBe(hex),
  )

  it('round-trips alpha through HSVA and omits opaque alpha from HEX', () => {
    expect(hsvaToHex(hexToHsva('#33669980')!)).toBe('#33669980')
    expect(hsvaToHex({ hue: 210, saturation: 2 / 3, value: 0.6, alpha: 1 }))
      .toBe('#336699')
  })

  it('chooses whether a dark or light foreground has higher contrast', () => {
    expect(getReadableForegroundTone('#111111')).toBe('light')
    expect(getReadableForegroundTone('#F5F6FB')).toBe('dark')
    expect(getReadableForegroundTone('#7C6CFF')).toBe('dark')
  })
})
