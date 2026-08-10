import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCardRenderResourceContext, resolveCardAssetSrc } from './cardRenderResources'

const { convertFileSrc } = vi.hoisted(() => ({
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
}))

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc }))

describe('cardRenderResources', () => {
  beforeEach(() => convertFileSrc.mockClear())

  it('resolves package identities only through the controlled runtime catalog', () => {
    const context = createCardRenderResourceContext({
      customBlockCatalog: new Map([['picture', {
        manifest: {
          key: 'picture', interfaceHash: 'hash', root: {}, publicFields: [],
          resize: { widthLocked: false, heightLocked: false },
        },
        resourceUrls: new Map([['resources/images/a.png', 'blob:controlled']]),
      }]]),
    })

    expect(resolveCardAssetSrc('ocblock:PICTURE/RESOURCES/IMAGES/A.PNG', context))
      .toBe('blob:controlled')
    expect(resolveCardAssetSrc('ocblock:picture/resources/images/missing.png', context)).toBe('')
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
