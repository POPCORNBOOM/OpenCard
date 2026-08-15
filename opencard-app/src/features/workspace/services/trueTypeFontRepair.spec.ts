import { describe, expect, it, vi } from 'vitest'
import { extractFontCollectionFaces, repairTrueTypeFont } from './trueTypeFontRepair'

vi.mock('fontkit', () => ({
  create: () => ({
    characterSet: [65],
    glyphForCodePoint: () => ({ id: 1 }),
  }),
}))

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

function createMixedCaseTableCollection(): Uint8Array {
  const bytes = new Uint8Array(140)
  writeU32(new DataView(bytes.buffer), 0, 0x74746366)
  writeU32(new DataView(bytes.buffer), 4, 0x00010000)
  writeU32(new DataView(bytes.buffer), 8, 1)
  writeU32(new DataView(bytes.buffer), 12, 16)
  writeU32(new DataView(bytes.buffer), 16, 0x00010000)
  writeU16(new DataView(bytes.buffer), 20, 3)
  const tables = [
    { tag: 'head', offset: 76, length: 54 },
    { tag: 'cmap', offset: 132, length: 4 },
    { tag: 'OS/2', offset: 136, length: 4 },
  ]
  for (const [index, table] of tables.entries()) {
    const entry = 28 + index * 16
    bytes.set(new TextEncoder().encode(table.tag), entry)
    writeU32(new DataView(bytes.buffer), entry + 8, table.offset)
    writeU32(new DataView(bytes.buffer), entry + 12, table.length)
  }
  return bytes
}

function createStandaloneFontWithMatchingGlyphCount(): Uint8Array {
  const tableData = new Map<string, Uint8Array>([
    ['head', new Uint8Array(54)],
    ['maxp', new Uint8Array(6)],
    ['hhea', new Uint8Array(36)],
    ['hmtx', new Uint8Array(8)],
    ['loca', new Uint8Array(6)],
    ['glyf', new Uint8Array(0)],
    ['cmap', new Uint8Array(4)],
  ])
  writeU16(new DataView(tableData.get('maxp')!.buffer), 4, 2)
  writeU16(new DataView(tableData.get('hhea')!.buffer), 34, 2)
  const headerLength = 12 + tableData.size * 16
  const totalLength = headerLength + [...tableData.values()].reduce((sum, data) => sum + ((data.length + 3) & ~3), 0)
  const bytes = new Uint8Array(totalLength)
  const view = new DataView(bytes.buffer)
  writeU32(view, 0, 0x00010000)
  writeU16(view, 4, tableData.size)
  let dataOffset = headerLength
  let index = 0
  for (const [tag, data] of tableData) {
    const entry = 12 + index * 16
    bytes.set(new TextEncoder().encode(tag), entry)
    writeU32(view, entry + 8, dataOffset)
    writeU32(view, entry + 12, data.length)
    bytes.set(data, dataOffset)
    dataOffset += (data.length + 3) & ~3
    index += 1
  }
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

  it('sorts standalone table records by raw OpenType tag order', () => {
    const [face] = extractFontCollectionFaces(createMixedCaseTableCollection())
    const tableCount = new DataView(face!.bytes.buffer, face!.bytes.byteOffset).getUint16(4, false)
    const tags = Array.from({ length: tableCount }, (_, index) => (
      new TextDecoder().decode(face!.bytes.slice(12 + index * 16, 16 + index * 16))
    ))
    expect(tags).toEqual(['OS/2', 'cmap', 'head'])
  })

  it('rebuilds cmap even when the glyph count already matches', async () => {
    const repaired = await repairTrueTypeFont(createStandaloneFontWithMatchingGlyphCount())
    const view = new DataView(repaired.buffer, repaired.byteOffset)
    const tableCount = view.getUint16(4, false)
    const cmapIndex = Array.from({ length: tableCount }, (_, index) => index).find(index => (
      new TextDecoder().decode(repaired.slice(12 + index * 16, 16 + index * 16)) === 'cmap'
    ))
    expect(cmapIndex).toBeDefined()
    const cmapOffset = view.getUint32(12 + cmapIndex! * 16 + 8, false)
    expect(view.getUint16(cmapOffset + 20, false)).toBe(12)
  })
})
