import { beforeEach, describe, expect, it, vi } from 'vitest'
import { inspectProjectFontSource } from './projectFontMetadata'

const mocks = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('fontkit', () => ({ create: mocks.create }))

describe('project font metadata', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reads fixed face descriptors from font metadata', async () => {
    mocks.create.mockReturnValue({
      familyName: 'Brand Sans',
      subfamilyName: 'Bold Italic',
      variationAxes: {},
      'OS/2': {
        usWeightClass: 700,
        usWidthClass: 5,
        fsSelection: { italic: true },
      },
      post: { italicAngle: -12 },
    })
    await expect(inspectProjectFontSource(new Uint8Array([1]))).resolves.toEqual([{
      familyName: 'Brand Sans',
      faceName: 'Bold Italic',
      weight: { min: 700, max: 700 },
      stretch: { min: 100, max: 100 },
      style: { kind: 'italic' },
    }])
  })

  it('enumerates collection members and preserves variable axes', async () => {
    mocks.create.mockReturnValue({
      fonts: [{
        familyName: 'Variable Sans',
        subfamilyName: 'Regular',
        variationAxes: {
          wght: { min: 200, default: 400, max: 900 },
          wdth: { min: 75, default: 100, max: 125 },
          slnt: { min: -10, default: 0, max: 0 },
        },
      }],
    })
    await expect(inspectProjectFontSource(new Uint8Array([2]))).resolves.toEqual([{
      collectionIndex: 0,
      familyName: 'Variable Sans',
      faceName: 'Regular',
      weight: { min: 200, max: 900 },
      stretch: { min: 75, max: 125 },
      style: { kind: 'oblique', angle: { min: -10, max: 0 } },
    }])
  })
})
