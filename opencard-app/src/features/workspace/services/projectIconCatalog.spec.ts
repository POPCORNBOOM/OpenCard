import { describe, expect, it, vi } from 'vitest'
import {
  buildProjectIconCatalog,
  createProjectIconCssProperties,
  createProjectIconPreviewStyle,
  createProjectIconStyle,
  EMPTY_PROJECT_ICON_CATALOG,
  findProjectIcon,
  renderProjectIconsInRichText,
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

  it('renders canonical rich-text icon elements', async () => {
    const catalog = await buildProjectIconCatalog([{
      name: 'Status icons', key: 'status', source: 'status.png',
      icons: [{ iconKey: 'warning', name: 'Warning', x: 0, y: 0, width: 16, height: 16 }],
    }], source => source, async () => ({ width: 16, height: 16 }))
    const html = renderProjectIconsInRichText('<p>A <span data-oc-icon-path="status/warning"></span> B</p>', catalog)
    expect(html).toContain('project-inline-icon oc-project-icon')
    expect(html).toContain('aria-label="Warning"')
    expect(html).toContain('--oc-project-icon-background-image: url(&quot;status.png&quot;)')
  })

  it('renders missing rich-text icons as a stable placeholder instead of machine syntax', () => {
    const html = renderProjectIconsInRichText(
      '<p><span data-oc-icon-path="status/missing"></span></p>', EMPTY_PROJECT_ICON_CATALOG, { missingLabel: 'Unavailable icon' },
    )
    expect(html).toContain('project-inline-icon--missing')
    expect(html).toContain('aria-label="Unavailable icon"')
    expect(html).not.toContain('data-oc-icon-path="status/missing"></span>')
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
    expect(createProjectIconCssProperties(catalog.entries[0]!)).toMatchObject({
      width: '3em',
      height: '1em',
      'background-image': 'none',
      'image-rendering': 'pixelated',
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
