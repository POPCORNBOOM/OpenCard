import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCardRenderResourceContext, resolveCardAssetSrc, resolveCustomBlockAssetSrc } from './cardRenderResources'

const { convertFileSrc } = vi.hoisted(() => ({
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
}))

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc }))

describe('cardRenderResources', () => {
  beforeEach(() => convertFileSrc.mockClear())

  it('resolves package-local logical keys only through an explicit package scope', () => {
    const context = createCardRenderResourceContext({
      customBlockCatalog: new Map([['picture', {
        manifest: {
          customBlockKey: 'picture', publicFieldKeys: [],
          resize: { widthLocked: false, heightLocked: false },
          resources: { images: [{ key: 'a', source: 'resources/images/a.png' }] },
        },
        block: {},
        resourceUrls: new Map([['resources/images/a.png', 'blob:controlled']]),
      }]]),
    })

    expect(resolveCustomBlockAssetSrc('resource:image:A', 'PICTURE', context))
      .toBe('blob:controlled')
    expect(resolveCardAssetSrc('resource:image:a', context)).toBe('')
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
})
