import { afterEach, describe, expect, it } from 'vitest'
import type { ProjectCustomBlockCatalog } from '../model/projectCustomBlocks'
import { clearProjectCustomBlockFonts, syncProjectCustomBlockFonts } from './projectCustomBlockFontLoader'

afterEach(clearProjectCustomBlockFonts)

describe('project custom block font loader', () => {
  it('registers packaged fonts without adding them to the project font registry', () => {
    const catalog = new Map([['square', {
      archivePath: 'assets/square.ocblock',
      files: new Map([['resources/fonts/a.woff2', new Uint8Array([1, 2, 3])]]),
      manifest: {
        type: 'opencard-custom-block' as const,
        schemaVersion: '1' as const,
        key: 'square', name: 'Square', interfaceHash: 'hash',
        root: { type: 'text-block', id: 'root' } as never,
        publicFields: [], resize: { widthLocked: false, heightLocked: false },
        resources: { fonts: [{ key: 'body', name: 'Body', source: 'resources/fonts/a.woff2' }] },
      },
    }]]) as ProjectCustomBlockCatalog
    syncProjectCustomBlockFonts(catalog)
    const css = document.querySelector('style[data-opencard-custom-block-fonts]')?.textContent
    expect(css).toContain('OpenCardCustomBlock-square-body')
    expect(css).toContain('data:font/woff2;base64,AQID')
  })
})
