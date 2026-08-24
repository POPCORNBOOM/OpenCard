import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_PROJECT_ICON_CATALOG } from '../workspace/services/projectIconCatalog'
import {
  projectResourceScopeIdentity,
  type ProjectResourceEnvironment,
} from '../workspace/services/projectResourceEnvironment'
import { createCardRenderResourceContext, resolveCardAssetSrc, resolveCardFontFamily } from './cardRenderResources'

const { convertFileSrc } = vi.hoisted(() => ({
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
}))

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc }))

describe('cardRenderResources', () => {
  beforeEach(() => convertFileSrc.mockClear())

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
        projectResourceScopeIdentity('package-image', 'image'),
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
      remoteResourcePolicy: { mode: 'allowlist', allowedHosts: ['images.example.com'] },
    })

    expect(resolveCardAssetSrc('assets/portrait.png', context))
      .toBe('asset://D:/Cards/assets/portrait.png')
    expect(resolveCardAssetSrc('https://images.example.com/portrait.png', context))
      .toBe('https://images.example.com/portrait.png')
    expect(resolveCardAssetSrc('https://other.example.com/portrait.png', context)).toBe('')
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
          public: { blocks: [], fonts: [], iconSeries: [], assets: [] }, dependencies: [],
        },
        rootPath: '/project/.opencard/packages/theme', issues: [],
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
