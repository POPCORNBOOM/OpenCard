import { describe, expect, it } from 'vitest'
import { createBlock, type CardDocument, type CardInstanceRecord } from '../../entities/card/model'
import { prepareRichText } from './prepareRichText'
import { createDefaultProjectInformation } from '../workspace/model/projectMetadata'

function documentWithContent(content: string): CardDocument {
  const host = createBlock('text-block', { id: 'host', content })
  return {
    type: 'card-document', id: 'doc', version: '1', width: '540', height: '850', instances: [],
    faces: {
      front: { type: 'card-face', id: 'front', background: '', children: [{
        block: host,
        location: { id: 'host-location', type: 'simple-container-location', anchor: 'lt', x: '0', y: '0' },
      }] },
      back: { type: 'card-face', id: 'back', background: '', children: [] },
    },
  }
}

describe('prepareRichText', () => {
  it('parses one host once and prepares fifty embedded blocks as one batch', () => {
    const embeds = Array.from({ length: 50 }, (_, index) => (
      `<oc-custom-block data-oc-id="badge-${index}" data-oc-key="badge" data-oc-layout="inline">`
      + `<oc-prop data-oc-key="label">Item ${index}</oc-prop></oc-custom-block>`
    )).join('')
    const root = createBlock('text-block', { id: 'badge-root', content: '{{self:label}}' })
    root.additionalFieldDefinition = { label: { fieldType: 'string' } }
    ;(root as unknown as Record<string, unknown>).label = 'Default'

    const result = prepareRichText({
      document: documentWithContent(`<p>${embeds}</p>`),
      customBlockCatalog: new Map([['badge', {
        manifest: { customBlockKey: 'badge', publicFieldKeys: ['label'], resize: { widthLocked: true, heightLocked: true } },
        block: root,
      }]]),
    })

    expect(result.rootParseCount).toBe(1)
    expect(result.nestedParseCount).toBe(50)
    expect(result.batchCount).toBe(1)
    expect(result.catalog.get('host')?.embeddedBlocks).toHaveLength(50)
    expect(result.catalog.get('host')?.embeddedBlocks.get('badge-49')?.content)
      .toMatchObject({ content: 'Item 49' })
  })

  it('keeps source HTML when a private field fails validation', () => {
    const root = createBlock('text-block', { id: 'badge-root', content: 'Ready' })
    const source = '<p>Before</p><oc-custom-block data-oc-id="badge" data-oc-key="badge" data-oc-layout="block">'
      + '<oc-prop data-oc-key="private">No</oc-prop></oc-custom-block><p>After</p>'
    const result = prepareRichText({
      document: documentWithContent(source),
      customBlockCatalog: new Map([['badge', {
        manifest: { customBlockKey: 'badge', publicFieldKeys: [], resize: { widthLocked: true, heightLocked: true } }, block: root,
      }]]),
    })
    expect(result.catalog.get('host')?.document.html).toBe(source)
    expect(result.catalog.get('host')?.embeddedBlocks).toHaveLength(0)
    expect(result.issues.some(issue => issue.type === 'card-designer.rich-text.invalid-html')).toBe(true)
    expect(result.catalog.get('host')?.diagnostics).toEqual([
      expect.objectContaining({ type: 'card-designer.rich-text.invalid-html' }),
    ])
  })

  it('never materializes structural or private native fields even when a manifest exposes them', () => {
    const root = createBlock('simple-container-block', { id: 'unsafe-root' })
    const source = '<p><oc-custom-block data-oc-id="unsafe" data-oc-key="unsafe" data-oc-layout="inline">'
      + '<oc-prop data-oc-key="customCss">position:fixed</oc-prop>'
      + '<oc-prop data-oc-key="children">bad</oc-prop></oc-custom-block></p>'
    const result = prepareRichText({
      document: documentWithContent(source),
      customBlockCatalog: new Map([['unsafe', {
        manifest: {
          customBlockKey: 'unsafe', publicFieldKeys: ['customCss', 'children'],
          resize: { widthLocked: true, heightLocked: true },
        },
        block: root,
      }]]),
    })
    expect(result.catalog.get('host')?.embeddedBlocks).toHaveLength(0)
    expect(result.catalog.get('host')?.diagnostics).toContainEqual(expect.objectContaining({
      type: 'card-designer.rich-text.invalid-html',
    }))
  })

  it('preserves every ordinary binding scope inside an embedded package', () => {
    const document = documentWithContent('<p><oc-custom-block data-oc-id="scope" data-oc-key="scope" data-oc-layout="inline">'
      + '<oc-prop data-oc-key="own">Embed</oc-prop></oc-custom-block></p>')
    document.name = 'Document'
    document.faces.front.background = '#front'
    document.faces.back.background = '#back'
    const host = document.faces.front.children[0]!.block
    host.additionalFieldDefinition = { hostValue: { fieldType: 'string' } }
    ;(host as unknown as Record<string, unknown>).hostValue = 'Host'
    const root = createBlock('text-block', {
      id: 'scope-root',
      content: '{{self:own}}|{{parent:hostValue}}|{{card:name}}|{{project:name}}|{{dictionary:word}}|{{document:name}}|{{face:background}}|{{opposite:background}}',
    })
    root.additionalFieldDefinition = { own: { fieldType: 'string' } }
    const currentCard: CardInstanceRecord = {
      type: 'card-instance', id: 'card', name: 'Card', amount: '1', data: {},
    }
    const project = createDefaultProjectInformation('Project')

    const result = prepareRichText({
      document, currentCard, project, dictionary: { word: 'Dictionary' },
      customBlockCatalog: new Map([['scope', {
        manifest: { customBlockKey: 'scope', publicFieldKeys: ['own'], resize: { widthLocked: true, heightLocked: true } },
        block: root,
      }]]),
    })

    expect(result.issues).toEqual([])
    expect(result.catalog.get('host')?.embeddedBlocks.get('scope')?.content)
      .toMatchObject({ content: 'Embed|Host|Card|Project|Dictionary|Document|#front|#back' })
  })

  it('validates embedded number and boolean properties through the ordinary render parser', () => {
    const root = createBlock('text-block', { id: 'typed-root', content: 'Typed' })
    root.additionalFieldDefinition = {
      amount: { fieldType: 'number', min: 1, max: 10 },
      active: { fieldType: 'boolean' },
    }
    const result = prepareRichText({
      document: documentWithContent('<p><oc-custom-block data-oc-id="typed" data-oc-key="typed" data-oc-layout="inline">'
        + '<oc-prop data-oc-key="amount">99</oc-prop><oc-prop data-oc-key="active">maybe</oc-prop>'
        + '</oc-custom-block></p>'),
      customBlockCatalog: new Map([['typed', {
        manifest: {
          customBlockKey: 'typed', publicFieldKeys: ['amount', 'active'],
          resize: { widthLocked: true, heightLocked: true },
        },
        block: root,
      }]]),
    })
    expect(result.catalog.get('host')?.diagnostics).toEqual([
      expect.objectContaining({ type: 'card-designer.custom-block.content-error' }),
    ])
    expect(JSON.stringify(result.catalog.get('host')?.diagnostics)).not.toContain('amount')
    expect(JSON.stringify(result.catalog.get('host')?.diagnostics)).not.toContain('active')
  })

  it('prepares nested rich text by depth and blocks package cycles', () => {
    const a = createBlock('text-block', {
      id: 'a-root',
      content: '<p><oc-custom-block data-oc-id="b-1" data-oc-key="b" data-oc-layout="inline"></oc-custom-block></p>',
    })
    const b = createBlock('text-block', { id: 'b-root', content: 'Nested' })
    const catalog = new Map([
      ['a', { manifest: { customBlockKey: 'a', publicFieldKeys: [], resize: { widthLocked: true, heightLocked: true } }, block: a }],
      ['b', { manifest: { customBlockKey: 'b', publicFieldKeys: [], resize: { widthLocked: true, heightLocked: true } }, block: b }],
    ])
    const nested = prepareRichText({
      document: documentWithContent('<p><oc-custom-block data-oc-id="a-1" data-oc-key="a" data-oc-layout="inline"></oc-custom-block></p>'),
      customBlockCatalog: catalog,
    })
    expect(nested.batchCount).toBe(2)
    expect(nested.catalog.get('host::embed:a-1')?.embeddedBlocks.get('b-1')?.content)
      .toMatchObject({ content: 'Nested' })

    a.content = '<p><oc-custom-block data-oc-id="a-2" data-oc-key="a" data-oc-layout="inline"></oc-custom-block></p>'
    const cyclic = prepareRichText({
      document: documentWithContent('<p><oc-custom-block data-oc-id="a-1" data-oc-key="a" data-oc-layout="inline"></oc-custom-block></p>'),
      customBlockCatalog: catalog,
    })
    expect(cyclic.batchCount).toBe(1)
    expect(cyclic.issues).toContainEqual(expect.objectContaining({
      type: 'card-designer.custom-block.content-error',
      location: expect.objectContaining({ owner: { kind: 'block', id: 'host::embed:a-1' } }),
    }))
  })

  it('reports missing packages and total embed limits on the rich-text host', () => {
    const missing = prepareRichText({
      document: documentWithContent('<p><oc-custom-block data-oc-id="missing" data-oc-key="missing" data-oc-layout="inline"></oc-custom-block></p>'),
    })
    expect(missing.issues).toContainEqual(expect.objectContaining({
      type: 'card-designer.custom-block.unavailable',
      location: expect.objectContaining({ owner: { kind: 'block', id: 'host' } }),
    }))

    const embeds = Array.from({ length: 513 }, (_, index) => (
      `<oc-custom-block data-oc-id="item-${index}" data-oc-key="item" data-oc-layout="inline"></oc-custom-block>`
    )).join('')
    const limited = prepareRichText({
      document: documentWithContent(`<p>${embeds}</p>`),
      customBlockCatalog: new Map([['item', {
        manifest: { customBlockKey: 'item', publicFieldKeys: [], resize: { widthLocked: true, heightLocked: true } },
        block: createBlock('text-block', { id: 'item-root', content: 'Item' }),
      }]]),
    })
    expect(limited.catalog.get('host')?.embeddedBlocks).toHaveLength(512)
    expect(limited.issues.filter(issue => issue.type === 'card-designer.rich-text.limit-exceeded')).toHaveLength(1)
  })
})
