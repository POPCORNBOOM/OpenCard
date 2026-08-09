import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProjectIconCatalogEntry } from './projectIconCatalog'
import { composeProjectCustomBlockIconAtlas } from './projectCustomBlockIconAtlas'

function icon(iconKey: string, x: number): ProjectIconCatalogEntry {
  return {
    seriesKey: 'items',
    source: 'assets/icons/items.png',
    src: 'asset://localhost/assets/icons/items.png',
    imageWidth: 32,
    imageHeight: 16,
    iconKey,
    name: iconKey,
    x,
    y: 0,
    width: 16,
    height: 16,
  }
}

function installCanvas(options: { throwOnExport?: boolean } = {}) {
  const drawImage = vi.fn()
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({ drawImage })),
    toBlob: vi.fn((callback: BlobCallback) => {
      if (options.throwOnExport) throw new DOMException('Tainted canvases may not be exported')
      callback(new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }))
    }),
  } as unknown as HTMLCanvasElement
  const createElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tagName, elementOptions) => (
    tagName === 'canvas' ? canvas : createElement(tagName, elementOptions)
  ))
  return { canvas, drawImage }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('composeProjectCustomBlockIconAtlas', () => {
  it('decodes controlled bytes through one temporary Blob URL and releases it', async () => {
    const { drawImage } = installCanvas()
    const assignedSources: string[] = []
    class LoadedImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(value: string) {
        assignedSources.push(value)
        queueMicrotask(() => this.onload?.())
      }
    }
    vi.stubGlobal('Image', LoadedImage)
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:controlled-icon-source')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const loadSourceBytes = vi.fn(async () => new Uint8Array([1, 2, 3]))

    const result = await composeProjectCustomBlockIconAtlas([
      icon('left', 0),
      icon('right', 16),
    ], loadSourceBytes)

    expect(result.bytes).toEqual(new Uint8Array([137, 80, 78, 71]))
    expect(result.icons).toHaveLength(2)
    expect(loadSourceBytes).toHaveBeenCalledTimes(1)
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(assignedSources).toEqual(['blob:controlled-icon-source'])
    expect(drawImage).toHaveBeenCalledTimes(2)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:controlled-icon-source')
  })

  it('converts Canvas security errors to a stable export error and still releases URLs', async () => {
    installCanvas({ throwOnExport: true })
    class LoadedImage {
      onload: (() => void) | null = null
      set src(_value: string) { queueMicrotask(() => this.onload?.()) }
    }
    vi.stubGlobal('Image', LoadedImage)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:controlled-icon-source')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    await expect(composeProjectCustomBlockIconAtlas(
      [icon('left', 0)],
      async () => new Uint8Array([1]),
    )).rejects.toThrow('Could not encode custom block icon atlas')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:controlled-icon-source')
  })
})
