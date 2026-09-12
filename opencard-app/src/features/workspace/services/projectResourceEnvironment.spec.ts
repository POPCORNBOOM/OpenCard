import { describe, expect, it, vi } from 'vitest'
vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: (path: string) => `asset://${path}` }))
import { EMPTY_PROJECT_ICON_CATALOG } from './projectIconCatalog'
import {
  createProjectResourceNamespace,
  loadProjectResourceEnvironment,
  projectResourceScopeIdentity,
  resolveProjectEnvironmentFontFamily,
  type ProjectResourceEnvironment,
} from './projectResourceEnvironment'

function packageEnvironment(packageId: string): ProjectResourceEnvironment {
  const namespace = createProjectResourceNamespace('package', packageId)
  return {
    kind: 'package',
    namespace,
    rootPath: `/packages/${packageId}/resources`,
    fontDocument: {},
    fonts: { body: { kind: 'family', name: 'Body', family: { key: 'body', name: 'Body', files: {} } } },
    iconDocument: {},
    iconCatalog: EMPTY_PROJECT_ICON_CATALOG,
    issues: [],
  }
}

describe('ProjectResourceEnvironment', () => {
  it('isolates same-key package fonts by Package ID namespace', () => {
    const alice = packageEnvironment('alice/badge')
    const bob = packageEnvironment('bob/badge')
    const fallback = (value: string) => value
    const aliceFamily = resolveProjectEnvironmentFontFamily('font:body', alice, fallback)
    const bobFamily = resolveProjectEnvironmentFontFamily('font:body', bob, fallback)
    expect(aliceFamily).toContain('package-alice-badge')
    expect(bobFamily).toContain('package-bob-badge')
    expect(aliceFamily).not.toBe(bobFamily)
  })

  it('keeps field-level scope identities distinct for the same block', () => {
    expect(projectResourceScopeIdentity('block', 'image')).not.toBe(projectResourceScopeIdentity('block', 'fontFamily'))
    expect(projectResourceScopeIdentity('block', 'image')).not.toBe(projectResourceScopeIdentity('other', 'image'))
  })

  it('assembles the project icon catalog from the registry without reading any icon file', async () => {
    const files = new Map<string, string>([[
      '/project/.opencard/icons/icons.json',
      JSON.stringify({
        iconSeries: [{
          name: 'Outline', key: 'outline',
          icons: [{ iconKey: 'warn', name: 'Warn', source: '.opencard/icons/outline/warn.svg', tint: 'theme' }],
        }],
      }),
    ]])
    const environment = await loadProjectResourceEnvironment({
      rootPath: '/project',
      kind: 'project',
      identity: 'project',
      fs: {
        fileExists: async path => files.has(path),
        readFile: async path => files.get(path) ?? '',
      },
    })

    expect(environment.iconCatalog.entries).toHaveLength(1)
    expect(environment.iconCatalog.entries[0]).toMatchObject({
      iconKey: 'warn', seriesKey: 'outline', src: expect.stringContaining('warn.svg'),
    })
    // No size: it belongs to the file, and is resolved when the icon is painted.
    expect(environment.iconCatalog.entries[0]).not.toHaveProperty('imageWidth')
  })

  it('reuses a catalog the caller already assembled for the same root', async () => {
    const files = new Map<string, string>([[
      '/project/.opencard/icons/icons.json',
      JSON.stringify({
        iconSeries: [{
          name: 'Outline', key: 'outline',
          icons: [{ iconKey: 'warn', name: 'Warn', source: '.opencard/icons/outline/warn.svg', tint: 'theme' }],
        }],
      }),
    ]])
    const providedCatalog = {
      series: [{ name: 'Outline', key: 'outline' }],
      entries: [{
        iconKey: 'warn', name: 'Warn', source: '.opencard/icons/outline/warn.svg',
        tint: 'theme' as const, seriesKey: 'outline', src: 'asset:///warn.svg',
        imageWidth: 8, imageHeight: 4,
      }],
      errors: [],
    }

    const environment = await loadProjectResourceEnvironment({
      rootPath: '/project',
      kind: 'project',
      identity: 'project',
      iconCatalog: providedCatalog,
      fs: {
        fileExists: async path => files.has(path),
        readFile: async path => files.get(path) ?? '',
      },
    })

    // The caller's catalog is the one carried, so its entries survive intact.
    expect(environment.iconCatalog.entries).toEqual(providedCatalog.entries)
    expect(environment.iconCatalog.entries[0]).toMatchObject({ imageWidth: 8, imageHeight: 4 })
  })

  it('resolves a package cover and stays silent when it is missing', async () => {
    const files = new Map<string, string>([
      ['/project/.opencard/packages', ''],
      ['/project/.opencard/packages/theme/.opencard/manifest.json', JSON.stringify({
        type: 'opencard-resource-package', key: 'theme', name: 'Theme', version: '1.0.0',
        cover: 'assets/cover.png', contentHash: '0'.repeat(64),
        public: { fonts: [], iconSeries: [] },
      })],
      ['/project/.opencard/packages/theme/assets/cover.png', 'bytes'],
      ['/project/.opencard/packages/plain/.opencard/manifest.json', JSON.stringify({
        type: 'opencard-resource-package', key: 'plain', name: 'Plain', version: '1.0.0',
        cover: 'assets/missing.png', contentHash: '0'.repeat(64),
        public: { fonts: [], iconSeries: [] },
      })],
    ])
    const environment = await loadProjectResourceEnvironment({
      rootPath: '/project',
      kind: 'project',
      identity: 'project',
      fs: {
        fileExists: async path => files.has(path),
        readFile: async path => files.get(path) ?? '',
        readDirectoryEntries: async () => [
          { name: 'theme', isDirectory: true, isFile: false, isSymlink: false },
          { name: 'plain', isDirectory: true, isFile: false, isSymlink: false },
        ],
      },
    })

    expect(environment.packages?.get('theme')?.cover).toEqual({
      relativePath: 'assets/cover.png',
      absolutePath: '/project/.opencard/packages/theme/assets/cover.png',
      src: 'asset:///project/.opencard/packages/theme/assets/cover.png',
    })
    expect(environment.packages?.get('plain')?.cover).toBeNull()
    expect(environment.packages?.get('plain')?.issues).toEqual([])
  })
})
