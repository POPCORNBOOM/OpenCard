import { describe, expect, it, vi } from 'vitest'
import { createBlock } from '../../../entities/card/model'
import { EMPTY_PROJECT_ICON_CATALOG, projectIconIdentity } from './projectIconCatalog'
import { resolveProjectEnvironmentAssetSrc, type ProjectResourceEnvironment } from './projectResourceEnvironment'

const mocks = vi.hoisted(() => ({ prepareRender: vi.fn() }))
vi.mock('../../card-rendering/renderPipeline', () => ({ prepareCardRender: mocks.prepareRender }))
vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: (path: string) => `asset://${path}` }))

import { createProjectCustomBlockPreview } from './projectCustomBlockPreview'

const sourceEnvironment: ProjectResourceEnvironment = {
  kind: 'project', namespace: 'project-source', rootPath: '/project',
  fontDocument: {}, fonts: {}, iconDocument: {}, iconCatalog: EMPTY_PROJECT_ICON_CATALOG, issues: [],
  customBlockCatalog: new Map(),
}

function prepared() {
  return {
    manifest: {
      type: 'opencard-custom-block' as const, packageId: 'alice/card', version: '0.1.0', name: 'Card',
      publicFieldKeys: ['name', 'notes', 'suit'], resize: { widthLocked: false, heightLocked: false },
    },
    block: createBlock('image-block', { id: 'root', image: 'assets/allowed.png' }),
    previewHostSize: { width: '570', height: '880' },
    resourceAnalysis: {
      candidates: [
        { id: 'image:allowed', kind: 'image' as const, path: 'assets/allowed.png', label: 'allowed.png', automatic: true, suggested: false, referenceCount: 1, references: ['root.image'] },
        { id: 'image:excluded', kind: 'image' as const, path: 'assets/excluded.png', label: 'excluded.png', automatic: false, suggested: false, referenceCount: 0, references: [] },
        { id: 'font:normal', kind: 'font' as const, path: '.opencard/fonts/body-normal.ttf', label: 'body-normal.ttf', fontKey: 'body', automatic: true, suggested: false, referenceCount: 1, references: ['root.fontFamily'] },
        { id: 'icon:suits', kind: 'icon' as const, path: '.opencard/icons/suits.ocicons', label: 'Suits', iconSeriesKey: 'suits', iconKeys: ['heart'], automatic: true, suggested: false, referenceCount: 1, references: ['root.content'] },
        { id: 'custom-block:bob/label', kind: 'custom-block' as const, path: '.opencard/blocks/bob/label', label: 'Label', packageId: 'bob/label', automatic: true, suggested: false, referenceCount: 1, references: ['nested'] },
      ],
      defaultSelectedIds: new Set<string>(),
      issues: [],
    },
  }
}

describe('createProjectCustomBlockPreview', () => {
  it('projects selected resources into an in-memory runtime without package transport', async () => {
    mocks.prepareRender.mockReturnValue({ document: { faces: { front: {}, back: {} } }, resources: {}, issues: [] })
    const dependency = { manifest: { packageId: 'bob/label' } }
    const sourceIconCatalog = {
      series: [{ name: 'Suits', key: 'suits', source: 'icons/suits.png', src: 'asset://suits', imageWidth: 100, imageHeight: 100 }],
      entries: [
        { iconKey: 'heart', name: 'Heart', x: 0, y: 0, width: 10, height: 10, seriesKey: 'suits', source: 'icons/suits.png', src: 'asset://suits', imageWidth: 100, imageHeight: 100 },
        { iconKey: 'spade', name: 'Spade', x: 10, y: 0, width: 10, height: 10, seriesKey: 'suits', source: 'icons/suits.png', src: 'asset://suits', imageWidth: 100, imageHeight: 100 },
      ],
      errors: [],
      seriesByKey: new Map(), entriesByIdentity: new Map(),
    }
    const sourceIconSeries = [{
      name: 'Suits', key: 'suits', source: 'icons/suits.png', snapToGrid: false, rows: 1, columns: 2,
      icons: [
        { iconKey: 'heart', name: 'Heart', x: 0, y: 0, width: 10, height: 10 },
        { iconKey: 'spade', name: 'Spade', x: 10, y: 0, width: 10, height: 10 },
      ],
    }]
    await createProjectCustomBlockPreview({
      prepared: prepared(),
      selectedResourceIds: new Set(['image:allowed', 'font:normal', 'icon:suits', 'custom-block:bob/label']),
      overrides: { suit: 'heart' }, sourceEnvironment,
      sourceFonts: {
        body: { kind: 'family', name: 'Body', family: { key: 'body', name: 'Body', files: {
          normal: { upright: 'fonts/body-normal.ttf', italic: 'fonts/body-italic.ttf' },
        } } },
      },
      sourceIconSeries,
      sourceIconCatalog,
      sourceCustomBlockCatalog: new Map([['bob/label', dependency as never]]),
    })
    const request = mocks.prepareRender.mock.calls[0]![0]
    expect(request.document).toMatchObject({ width: '570', height: '880' })
    expect(request.document.faces.front.children[0].block).toMatchObject({ suit: 'heart' })
    const entry = request.environment.customBlockCatalog.get('alice/card')
    expect(request.environment.projectResourceEnvironment.customBlockCatalog.get('alice/card')).toBe(entry)
    expect(resolveProjectEnvironmentAssetSrc('assets/allowed.png', entry.environment)).not.toBe('')
    expect(resolveProjectEnvironmentAssetSrc('assets/excluded.png', entry.environment)).toBe('')
    expect(entry.environment.fontDocument.families[0].files.normal).toEqual({ upright: 'fonts/body-normal.ttf' })
    expect(entry.environment.iconCatalog.entriesByIdentity.has(projectIconIdentity('suits', 'heart'))).toBe(true)
    expect(entry.environment.iconCatalog.entriesByIdentity.has(projectIconIdentity('suits', 'spade'))).toBe(false)
    expect(entry.dependencies.get('bob/label')).toBe(dependency)
  })
})
