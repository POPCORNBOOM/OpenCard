import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_PROJECT_ICON_CATALOG } from '../workspace/services/projectIconCatalog'
import {
  projectResourceScopeIdentity,
  type ProjectResourceEnvironment,
} from '../workspace/services/projectResourceEnvironment'
import { createCardRenderResourceContext, createCardResourceResolver, resolveCardAssetSrc, resolveCardFontFamily } from './cardRenderResources'
import { setProjectFonts } from '../workspace/model/projectFonts'
import { normalizeResourcePackageManifest } from '../workspace/model/resourcePackage'

const { convertFileSrc } = vi.hoisted(() => ({
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
}))

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc }))

describe('cardRenderResources', () => {
  beforeEach(() => convertFileSrc.mockClear())
  afterEach(() => setProjectFonts([]))

  it('keeps project font conversion identical after field scopes are derived', () => {
    const font = { key: 'brand', name: 'Brand', files: { normal: { upright: 'fonts/Brand.ttf' } } }
    setProjectFonts([font])
    const environment: ProjectResourceEnvironment = {
      kind: 'project', namespace: 'project-root', rootPath: '/project',
      fontDocument: {}, fonts: { brand: { kind: 'family', name: 'Brand', family: font } },
      iconDocument: {}, iconCatalog: EMPTY_PROJECT_ICON_CATALOG, issues: [],
    }
    const root = createCardResourceResolver(createCardRenderResourceContext({ hostEnvironment: environment }))
    const derived = root.withScopes(new Map([[
      projectResourceScopeIdentity('custom-text', 'fontFamily'),
      environment,
    ]]))

    expect(root.resolveFont('font:brand', 'native-text', 'fontFamily'))
      .toBe('"OpenCardProjectFont-brand"')
    expect(derived.resolveFont('font:brand', 'custom-text', 'fontFamily'))
      .toBe('"OpenCardProjectFont-brand"')
  })

  it('keeps assets, icons, and missing-resource behavior identical after scopes are derived', () => {
    const icon = {
      seriesKey: 'status', iconKey: 'warning', name: 'Warning', source: 'icons.png', src: 'asset://icons.png',
      x: 0, y: 0, width: 16, height: 16, imageWidth: 16, imageHeight: 16,
    }
    const environment: ProjectResourceEnvironment = {
      kind: 'project', namespace: 'project-root', rootPath: '/project', fontDocument: {}, fonts: {},
      iconDocument: {}, iconCatalog: { series: [], entries: [icon], errors: [] }, issues: [],
    }
    const root = createCardResourceResolver(createCardRenderResourceContext({ hostEnvironment: environment }))
    const derived = root.withScopes(new Map([
      [projectResourceScopeIdentity('custom-image', 'source'), environment],
      [projectResourceScopeIdentity('custom-text', 'content'), environment],
    ]))

    expect(derived.resolveAsset('assets/a.png', 'custom-image', 'source'))
      .toBe(root.resolveAsset('assets/a.png', 'native-image', 'source'))
    expect(derived.resolveIcon('icon:status/warning', 'custom-text', 'content'))
      .toBe(root.resolveIcon('icon:status/warning', 'native-text', 'content'))
    expect(root.resolveImageSource('icon:status/warning', 'native-image', 'source'))
      .toEqual({ kind: 'icon', entry: icon })
    expect(derived.resolveImageSource('icon:status/warning', 'custom-image', 'source'))
      .toEqual({ kind: 'icon', entry: icon })
    expect(root.resolveImageSource('assets/a.png', 'native-image', 'source'))
      .toEqual({ kind: 'image', src: 'asset:///project/assets/a.png' })
    expect(root.resolveImageSource('', 'native-image', 'source')).toEqual({ kind: 'empty' })
    expect(root.resolveImageSource('icon:status', 'native-image', 'source')).toEqual({ kind: 'unavailable' })
    expect(root.resolveImageSource('icon:status/missing', 'native-image', 'source')).toEqual({ kind: 'unavailable' })
    expect(root.resolveImageSource('font:brand', 'native-image', 'source')).toEqual({ kind: 'unavailable' })
    expect(derived.resolveIcon('icon:status/missing', 'custom-text', 'content')).toBeNull()
    expect(root.resolveIcon('icon:status/missing', 'native-text', 'content')).toBeNull()
  })

  it('resolves package-qualified icon references for image blocks', () => {
    const icon = {
      seriesKey: 'status', iconKey: 'warning', name: 'Warning', source: 'icons.png', src: 'asset://icons.png',
      x: 0, y: 0, width: 16, height: 16, imageWidth: 16, imageHeight: 16,
    }
    const packageEnvironment: ProjectResourceEnvironment = {
      kind: 'package', namespace: 'package-theme', rootPath: '/project/.opencard/packages/theme',
      fontDocument: {}, fonts: {}, iconDocument: {}, iconCatalog: { series: [], entries: [icon], errors: [] }, issues: [],
    }
    const hostEnvironment: ProjectResourceEnvironment = {
      kind: 'project', namespace: 'project', rootPath: '/project', fontDocument: {}, fonts: {},
      iconDocument: {}, iconCatalog: EMPTY_PROJECT_ICON_CATALOG, issues: [],
      packages: new Map([['theme', {
        manifest: normalizeResourcePackageManifest({}, 'theme').manifest,
        rootPath: packageEnvironment.rootPath!, cover: null, issues: [],
      }]]),
    }
    const resolver = createCardResourceResolver(createCardRenderResourceContext({
      hostEnvironment,
      packageEnvironments: new Map([['theme', packageEnvironment]]),
    }))

    expect(resolver.resolveIcon('theme@icon:status/warning', 'image', 'source')).toBe(icon)
    expect(resolver.resolveImageSource('theme@icon:status/warning', 'image', 'source'))
      .toEqual({ kind: 'icon', entry: icon })
  })

  it('resolves package-local paths only through an explicit field scope', () => {
    const packageEnvironment: ProjectResourceEnvironment = {
      kind: 'package',
      namespace: 'package-alice-picture',
      rootPath: 'D:/Cards/.opencard/blocks/alice/picture/resources',
      fontDocument: {},
      fonts: {},
      iconDocument: {},
      iconCatalog: EMPTY_PROJECT_ICON_CATALOG,
      issues: [],
    }
    const context = createCardRenderResourceContext({
      resourceScopes: new Map([[
        projectResourceScopeIdentity('package-image', 'source'),
        packageEnvironment,
      ]]),
    })

    expect(resolveCardAssetSrc('assets/a.png', context, 'package-image'))
      .toBe('asset://D:/Cards/.opencard/blocks/alice/picture/resources/assets/a.png')
    expect(resolveCardAssetSrc('assets/a.png', context)).toBe('')
  })

  it('resolves local files and applies the remote HTTPS policy', () => {
    const context = createCardRenderResourceContext({
      resourceRootPath: 'D:/Cards',
      sourceFilePath: 'D:/Cards/decks/card.ocdocument',
      remoteResourcePolicy: { mode: 'allowlist', allowedHosts: ['images.example.com'] },
    })

    expect(resolveCardAssetSrc('assets/portrait.png', context))
      .toBe('asset://D:/Cards/assets/portrait.png')
    expect(resolveCardAssetSrc('https://images.example.com/portrait.png', context))
      .toBe('https://images.example.com/portrait.png')
    expect(createCardResourceResolver(context).resolveImageSource('https://images.example.com/portrait.png'))
      .toEqual({ kind: 'image', src: 'https://images.example.com/portrait.png' })
    expect(resolveCardAssetSrc('https://other.example.com/portrait.png', context)).toBe('')
  })

  it('resolves project, current-package, and child-package shorthand from the document scope', () => {
    const projectContext = createCardRenderResourceContext({
      resourceRootPath: 'D:/Cards',
      sourceFilePath: 'D:/Cards/decks/card.ocdocument',
    })
    expect(resolveCardAssetSrc('theme@images/frame.png', projectContext))
      .toBe('asset://D:/Cards/.opencard/packages/theme/images/frame.png')

    const packageContext = createCardRenderResourceContext({
      resourceRootPath: 'D:/Cards',
      sourceFilePath: 'D:/Cards/.opencard/packages/theme/cards/card.ocdocument',
    })
    expect(resolveCardAssetSrc('images/frame.png', packageContext))
      .toBe('asset://D:/Cards/.opencard/packages/theme/images/frame.png')
    expect(resolveCardAssetSrc('@images/logo.png', packageContext))
      .toBe('asset://D:/Cards/images/logo.png')
    expect(resolveCardAssetSrc('palette@images/swatch.png', packageContext))
      .toBe('asset://D:/Cards/.opencard/packages/theme/.opencard/packages/palette/images/swatch.png')
  })

  it('resolves an allowed remote asset through the project cache when provided', () => {
    const resolveRemoteResource = vi.fn((url: string) => `asset://cached/${encodeURIComponent(url)}`)
    const context = createCardRenderResourceContext({
      remoteResourcePolicy: { mode: 'allowlist', allowedHosts: ['images.example.com'] },
      resolveRemoteResource,
    })

    expect(resolveCardAssetSrc('https://images.example.com/portrait.png', context))
      .toBe('asset://cached/https%3A%2F%2Fimages.example.com%2Fportrait.png')
    expect(resolveRemoteResource).toHaveBeenCalledWith('https://images.example.com/portrait.png')
    expect(resolveCardAssetSrc('https://other.example.com/portrait.png', context)).toBe('')
    expect(resolveRemoteResource).toHaveBeenCalledTimes(1)
  })

  it('rejects runtime schemes supplied directly by a document', () => {
    const context = createCardRenderResourceContext({})

    expect(resolveCardAssetSrc('blob:untrusted', context)).toBe('')
    expect(resolveCardAssetSrc('data:image/png;base64,abc', context)).toBe('')
    expect(convertFileSrc).not.toHaveBeenCalled()
  })

  it('resolves package-qualified font references with a package namespace', () => {
    const packageEnvironment: ProjectResourceEnvironment = {
      kind: 'package',
      namespace: 'package-theme',
      rootPath: '/project/.opencard/packages/theme',
      fontDocument: {},
      fonts: { body: { kind: 'family', name: 'Body', family: { key: 'body', name: 'Body', files: {} } } },
      iconDocument: {},
      iconCatalog: EMPTY_PROJECT_ICON_CATALOG,
      issues: [],
    }
    const projectEnvironment: ProjectResourceEnvironment = {
      kind: 'project',
      namespace: 'project-root',
      rootPath: '/project',
      fontDocument: {},
      fonts: { body: { kind: 'family', name: 'Body', family: { key: 'body', name: 'Body', files: {} } } },
      iconDocument: {},
      iconCatalog: EMPTY_PROJECT_ICON_CATALOG,
      packages: new Map([['theme', {
        manifest: {
          type: 'opencard-resource-package', key: 'theme', name: 'Theme', version: '1.0.0', contentHash: '',
          public: { fonts: [], iconSeries: [] },
        },
        rootPath: '/project/.opencard/packages/theme', cover: null, issues: [],
      }]]),
      issues: [],
    }
    const context = createCardRenderResourceContext({
      hostEnvironment: projectEnvironment,
      packageEnvironments: new Map([['theme', packageEnvironment]]),
    })
    expect(resolveCardFontFamily('theme@font:body; Arial', context)).toContain('OpenCardResource-package-theme-body')
    expect(resolveCardFontFamily('theme@font:body; Arial', context)).toContain('Arial')
  })
})
