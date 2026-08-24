import { describe, expect, it, vi } from 'vitest'
import { EMPTY_PROJECT_ICON_CATALOG, projectIconIdentity } from './projectIconCatalog'
import type { ProjectResourceEnvironment } from './projectResourceEnvironment'
import type { ProjectIconCatalog, ProjectIconCatalogEntry } from './projectIconCatalog'
import type { CustomBlockRuntimeCatalog, CustomBlockRuntimeEntry } from '../../card-rendering/expandCustomBlocks'
import {
  formatResourceReference,
  parseResourceReference,
  resolveAssetReferenceSource,
  parseResourceReferenceList,
  resolveResourceReferenceText,
  buildResourceFontCatalog,
} from './resourceReference'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `asset://${path}`,
}))

function environment(kind: 'project' | 'package', rootPath: string, options: {
  iconCatalog?: ProjectIconCatalog
  customBlockCatalog?: CustomBlockRuntimeCatalog
} = {}): ProjectResourceEnvironment {
  return {
    kind,
    namespace: `${kind}-test`,
    rootPath,
    fontDocument: {},
    fonts: {
      body: {
        kind: 'family',
        name: 'Body',
        family: { key: 'body', name: 'Body', files: { normal: { upright: 'fonts/body.ttf' } } },
      },
    },
    iconDocument: {},
    iconCatalog: options.iconCatalog ?? EMPTY_PROJECT_ICON_CATALOG,
    customBlockCatalog: options.customBlockCatalog,
    issues: [],
  }
}

function iconCatalog(name: string): ProjectIconCatalog {
  const entry = {
    iconKey: 'check', name, x: 0, y: 0, width: 1, height: 1, seriesKey: 'status',
    source: `${name}.png`, src: `${name}.png`, imageWidth: 1, imageHeight: 1,
  } as ProjectIconCatalogEntry
  return {
    series: [], entries: [entry], errors: [],
    seriesByKey: new Map(),
    entriesByIdentity: new Map([[projectIconIdentity('status', 'check'), entry]]),
  }
}

describe('resourceReference', () => {
  it('parses and formats all reference scopes', () => {
    const cases = [
      ['asset:images/card.png', { scope: 'current', kind: 'asset', key: 'images/card.png' }],
      ['@asset:images/card.png', { scope: 'host', kind: 'asset', key: 'images/card.png' }],
      ['theme@asset:images/card.png', { scope: 'package', packageKey: 'theme', kind: 'asset', key: 'images/card.png' }],
      ['font:body', { scope: 'current', kind: 'font', key: 'body' }],
      ['theme@font:body', { scope: 'package', packageKey: 'theme', kind: 'font', key: 'body' }],
      ['icon:status/check', { scope: 'current', kind: 'icon', key: 'status/check' }],
      ['theme@icon:status/check', { scope: 'package', packageKey: 'theme', kind: 'icon', key: 'status/check' }],
      ['block:badge', { scope: 'current', kind: 'block', key: 'badge' }],
      ['theme@block:badge', { scope: 'package', packageKey: 'theme', kind: 'block', key: 'badge' }],
    ] as const

    for (const [source, expected] of cases) {
      const parsed = parseResourceReference(source)
      expect(parsed.diagnostics).toEqual([])
      expect(parsed.reference).toEqual(expected)
      expect(formatResourceReference(parsed.reference!)).toBe(source)
    }
  })

  it('splits font references while preserving CSS fallback candidates', () => {
    expect(parseResourceReferenceList('font:body; Arial; theme@font:body', 'font')).toEqual([
      expect.objectContaining({ source: 'font:body', reference: { scope: 'current', kind: 'font', key: 'body' } }),
      expect.objectContaining({ source: 'Arial', reference: null, diagnostics: [] }),
      expect.objectContaining({ source: 'theme@font:body', reference: { scope: 'package', packageKey: 'theme', kind: 'font', key: 'body' } }),
    ])
  })

  it('builds font completion candidates from the visible resource environment', () => {
    const packageEnvironment = environment('package', '/packages/theme')
    const current = {
      ...environment('project', '/project'),
      packages: new Map([
        ['theme', {
          manifest: {
            type: 'opencard-resource-package' as const, key: 'theme', name: 'Theme', version: '1.0.0', contentHash: '',
            public: { blocks: [], fonts: [], iconSeries: [], assets: [] }, dependencies: [],
          },
          rootPath: '/packages/theme', issues: [],
        }],
        ['broken', {
          manifest: {
            type: 'opencard-resource-package' as const, key: 'broken', name: 'Broken', version: '1.0.0', contentHash: '',
            public: { blocks: [], fonts: [], iconSeries: [], assets: [] }, dependencies: [],
          },
          rootPath: '/packages/broken', issues: [], unavailable: true,
        }],
      ]),
    }
    expect(buildResourceFontCatalog(current, new Map([['theme', packageEnvironment]])).map(entry => entry.value)).toEqual([
      'font:body', 'theme@font:body',
    ])
  })

  it('resolves current, host, and directly visible package environments', () => {
    const host = environment('project', '/project')
    const packageEnvironment = environment('package', '/project/.opencard/packages/theme')
    const current: ProjectResourceEnvironment = {
      ...host,
      kind: 'package',
      rootPath: '/project/.opencard/packages/current',
      packages: new Map([['theme', {
        manifest: {
          type: 'opencard-resource-package',
          key: 'theme',
          name: 'Theme',
          version: '1.0.0',
          contentHash: '',
          public: { blocks: [], fonts: [], iconSeries: [], assets: [] },
          dependencies: [],
        },
        rootPath: '/project/.opencard/packages/current/.opencard/packages/theme',
        issues: [],
      }]]),
    }

    expect(resolveAssetReferenceSource('images/current.png', { environment: current, hostEnvironment: host }).value)
      .toBe('asset:///project/.opencard/packages/current/images/current.png')
    expect(resolveAssetReferenceSource('@asset:images/host.png', { environment: current, hostEnvironment: host }).value)
      .toBe('asset:///project/images/host.png')
    expect(resolveAssetReferenceSource('theme@asset:images/theme.png', { environment: current, hostEnvironment: host, packageEnvironments: new Map([['theme', packageEnvironment]]) }).value)
      .toBe('asset:///project/.opencard/packages/theme/images/theme.png')

    const font = resolveResourceReferenceText('theme@font:body', { environment: current, hostEnvironment: host, packageEnvironments: new Map([['theme', packageEnvironment]]) })
    expect(font.value).toMatchObject({ kind: 'family', family: { key: 'body' } })
    expect(font.environment).toBe(packageEnvironment)
  })

  it('does not use public indexes as runtime access control', () => {
    const current = environment('project', '/project')
    const resolved = resolveResourceReferenceText('asset:images/not-indexed.png', { environment: current })
    expect(resolved.value).toBe('asset:///project/images/not-indexed.png')
  })

  it('reports unsafe paths and packages outside the current catalog', () => {
    const current = environment('package', '/package')
    expect(parseResourceReference('asset:../secret.png').diagnostics[0]?.code).toBe('unsafe-path')
    expect(parseResourceReference('asset:/absolute.png').diagnostics[0]?.code).toBe('unsafe-path')
    expect(resolveResourceReferenceText('other@asset:image.png', { environment: current }).diagnostics[0]?.code)
      .toBe('package-unavailable')
  })

  it('isolates package-qualified icon and block resources by package scope', () => {
    const hostBlock = { marker: 'host' } as unknown as CustomBlockRuntimeEntry
    const packageBlock = { marker: 'package' } as unknown as CustomBlockRuntimeEntry
    const host = environment('project', '/project', {
      iconCatalog: iconCatalog('host'),
      customBlockCatalog: new Map([['block:badge', hostBlock]]),
    })
    const packageEnvironment = environment('package', '/project/.opencard/packages/theme', {
      iconCatalog: iconCatalog('package'),
      customBlockCatalog: new Map([['block:badge', packageBlock]]),
    })
    const current: ProjectResourceEnvironment = {
      ...host, kind: 'package', namespace: 'package-current',
      rootPath: '/project/.opencard/packages/current',
      packages: new Map([['theme', {
        manifest: {
          type: 'opencard-resource-package', key: 'theme', name: 'Theme', version: '1.0.0', contentHash: '',
          public: { blocks: [], fonts: [], iconSeries: [], assets: [] }, dependencies: [],
        },
        rootPath: '/project/.opencard/packages/theme', issues: [],
      }]]),
    }
    expect(resolveResourceReferenceText('theme@icon:status/check', { environment: current, hostEnvironment: host, packageEnvironments: new Map([['theme', packageEnvironment]]) }).value)
      .toMatchObject({ name: 'package' })
    expect(resolveResourceReferenceText('@icon:status/check', { environment: current, hostEnvironment: host }).value)
      .toMatchObject({ name: 'host' })
    expect(resolveResourceReferenceText('theme@block:badge', { environment: current, hostEnvironment: host, packageEnvironments: new Map([['theme', packageEnvironment]]) }).value).toBe(packageBlock)
    expect(resolveResourceReferenceText('theme@icon:status/missing', { environment: current, packageEnvironments: new Map([['theme', packageEnvironment]]) }).diagnostics[0]?.code)
      .toBe('resource-unavailable')
    expect(resolveResourceReferenceText('unknown@block:badge', { environment: current }).diagnostics[0]?.code)
      .toBe('package-unavailable')
  })
})
