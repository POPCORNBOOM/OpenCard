import { describe, expect, it, vi } from 'vitest'
import {
  buildProjectIconCatalog,
  createProjectIconPreviewStyle,
  createProjectIconStyle,
  findProjectIcon,
} from './projectIconCatalog'

describe('projectIconCatalog', () => {
  it('loads natural dimensions without adding them to the profile model', async () => {
    const loadDimensions = vi.fn().mockResolvedValue({ width: 64, height: 32 })
    const catalog = await buildProjectIconCatalog([{
      name: 'Status icons',
      key: 'status',
      source: 'assets/icons/status.png',
      icons: [{ iconKey: 'warning', name: 'Warning', x: 16, y: 0, width: 16, height: 8 }],
    }], source => `asset://${source}`, loadDimensions)
    expect(loadDimensions).toHaveBeenCalledWith('asset://assets/icons/status.png')
    expect(catalog.series).toEqual([expect.objectContaining({ key: 'status', imageWidth: 64, imageHeight: 32 })])
    expect(findProjectIcon(catalog, 'STATUS', 'WARNING')).toMatchObject({ imageWidth: 64, imageHeight: 32 })
  })

  it('reports failed images and out-of-bounds records without exposing them', async () => {
    const catalog = await buildProjectIconCatalog([{
      name: 'Status icons',
      key: 'status',
      source: 'assets/icons/status.png',
      icons: [{ iconKey: 'bad', name: 'Bad', x: 60, y: 0, width: 8, height: 8 }],
    }], source => source, async () => ({ width: 64, height: 32 }))
    expect(catalog.entries).toEqual([])
    expect(catalog.errors).toEqual([expect.objectContaining({ reason: 'icon-out-of-bounds', iconKey: 'bad' })])

    const failed = await buildProjectIconCatalog([{
      name: 'Missing icons', key: 'missing', source: 'assets/icons/missing.png', icons: [],
    }], source => source, async () => { throw new Error('missing') })
    expect(failed.errors).toEqual([expect.objectContaining({ reason: 'load-failed' })])
  })

  it('creates 1em crop geometry while preserving aspect ratio', async () => {
    const catalog = await buildProjectIconCatalog([{
      name: 'Status icons', key: 'status', source: 'status.png',
      icons: [{ iconKey: 'wide', name: 'Wide', x: 16, y: 8, width: 24, height: 8, pixelated: true }],
    }], source => source, async () => ({ width: 64, height: 32 }))
    expect(createProjectIconStyle(catalog.entries[0]!)).toMatchObject({
      width: '3em',
      height: '1em',
      backgroundImage: 'none',
      backgroundSize: '8em 4em',
      backgroundPosition: '-2em -1em',
      imageRendering: 'pixelated',
      '--oc-project-icon-background-image': 'url("status.png")',
      '--oc-project-icon-source-width': '3em',
      '--oc-project-icon-source-height': '1em',
      '--oc-project-icon-transform': 'rotate(0deg)',
    })
    expect(createProjectIconPreviewStyle(catalog.entries[0]!)).toMatchObject({
      width: '1em',
      height: `${1 / 3}em`,
      imageRendering: 'pixelated',
    })
  })

  it('swaps displayed dimensions and rotates the crop for quarter turns', async () => {
    const catalog = await buildProjectIconCatalog([{
      name: 'Status icons', key: 'status', source: 'status.png',
      icons: [{ iconKey: 'wide', name: 'Wide', x: 16, y: 8, width: 24, height: 8, rotation: 90 }],
    }], source => source, async () => ({ width: 64, height: 32 }))
    expect(createProjectIconStyle(catalog.entries[0]!)).toMatchObject({
      width: `${8 / 24}em`, height: '1em', '--oc-project-icon-transform': 'rotate(90deg)',
    })
    expect(createProjectIconPreviewStyle(catalog.entries[0]!)).toMatchObject({
      width: `${8 / 24}em`, height: '1em', '--oc-project-icon-transform': 'rotate(90deg)',
    })
  })

  it('composes atlas rotation with the user-facing display rotation', async () => {
    const catalog = await buildProjectIconCatalog([{
      name: 'Status icons', key: 'status', source: 'status.png',
      icons: [{ iconKey: 'wide', name: 'Wide', x: 16, y: 8, width: 8, height: 24, atlasRotation: 90, rotation: 90 }],
    }], source => source, async () => ({ width: 64, height: 32 }))
    expect(createProjectIconStyle(catalog.entries[0]!)).toMatchObject({
      width: `${8 / 24}em`, height: '1em', '--oc-project-icon-transform': 'rotate(0deg)',
      '--oc-project-icon-source-width': `${8 / 24}em`, '--oc-project-icon-source-height': '1em',
    })
  })
})
