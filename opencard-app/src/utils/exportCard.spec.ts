import { beforeEach, describe, expect, it, vi } from 'vitest'
import { exportCardAsImage } from './exportCard'

const mocks = vi.hoisted(() => ({
  toJpeg: vi.fn(),
  toPng: vi.fn(),
}))

vi.mock('dom-to-image-more', () => ({
  default: mocks,
}))

describe('exportCardAsImage', () => {
  beforeEach(() => {
    mocks.toJpeg.mockReset().mockResolvedValue('jpeg-data')
    mocks.toPng.mockReset().mockResolvedValue('png-data')
  })

  it('scales the output canvas without transforming the cloned card DOM', async () => {
    const element = document.createElement('div')

    await expect(exportCardAsImage(element, { dpi: 192 })).resolves.toBe('png-data')
    expect(mocks.toPng).toHaveBeenCalledWith(element, { scale: 2 })
  })

  it('preserves JPEG quality while using canvas scaling', async () => {
    const element = document.createElement('div')

    await expect(exportCardAsImage(element, {
      dpi: 144,
      format: 'jpeg',
      quality: 0.8,
    })).resolves.toBe('jpeg-data')
    expect(mocks.toJpeg).toHaveBeenCalledWith(element, {
      quality: 0.8,
      scale: 1.5,
    })
  })
})
