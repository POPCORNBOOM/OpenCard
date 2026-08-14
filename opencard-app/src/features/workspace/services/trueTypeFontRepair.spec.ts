import { describe, expect, it } from 'vitest'
import { extractFontCollectionFaces } from './trueTypeFontRepair'

function writeU16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, false)
}

function writeU32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, false)
}

function createSingleFaceCollection(version = 0x00010000): Uint8Array {
  const bytes = new Uint8Array(100)
  const view = new DataView(bytes.buffer)
  writeU32(view, 0, 0x74746366)
  writeU32(view, 4, 0x00010000)
  writeU32(view, 8, 1)
  writeU32(view, 12, 16)

  writeU32(view, 16, version)
  writeU16(view, 20, 1)
  writeU16(view, 22, 16)
  writeU16(view, 24, 0)
  writeU16(view, 26, 0)
  bytes.set(new TextEncoder().encode('head'), 28)
  writeU32(view, 32, 0)
  writeU32(view, 36, 44)
  writeU32(view, 40, 54)
  writeU32(view, 44 + 12, 0x5f0f3cf5)
  return bytes
}

describe('font collection extraction', () => {
  it('extracts a collection face into a standalone sfnt font', () => {
    const [face] = extractFontCollectionFaces(createSingleFaceCollection())
    expect(face?.extension).toBe('ttf')
    expect(new DataView(face!.bytes.buffer, face!.bytes.byteOffset).getUint32(0, false)).toBe(0x00010000)
    expect(new TextDecoder().decode(face!.bytes.slice(12, 16))).toBe('head')
  })

  it('preserves OpenType CFF output type and rejects non-collections', () => {
    expect(extractFontCollectionFaces(createSingleFaceCollection(0x4f54544f))[0]?.extension).toBe('otf')
    expect(() => extractFontCollectionFaces(new Uint8Array(16))).toThrow('collection')
  })
})
