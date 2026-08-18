import { describe, expect, it } from 'vitest'
import { createBlock, type CardBlock, type CardDocument } from '../../../entities/card/model'
import { materializeProjectCustomBlockExport } from './materializeProjectCustomBlockExport'

function createDocument(root: CardBlock): CardDocument {
  return {
    type: 'card-document', id: 'document', name: 'Document', version: '1',
    width: '540', height: '850', instances: [],
    faces: {
      front: {
        type: 'card-face', id: 'front', background: '#fff',
        children: [{ block: root, location: { id: 'root-location', type: 'simple-container-location', anchor: 'lt' } }],
      },
      back: { type: 'card-face', id: 'back', background: '#000', children: [] },
    },
  }
}

describe('materializeProjectCustomBlockExport', () => {
  it('keeps subtree references and materializes project and dictionary references', () => {
    const root = createBlock('simple-container-block', { id: 'root', width: '{{self:size}}' })
    root.additionalFieldDefinition = { size: { fieldType: 'number' } }
    ;(root as unknown as Record<string, unknown>).size = '{{document:width}}'
    root.children.push({
      block: createBlock('text-block', {
        id: 'child',
        content: '{{parent:size}} / {{project:name}}',
      }),
      location: { id: 'child-location', type: 'simple-container-location', anchor: 'lt', x: '{{parent:size}}' },
    })
    const result = materializeProjectCustomBlockExport({
      document: createDocument(root),
      rootBlockId: root.id,
      environment: {
        project: { name: 'Demo', description: '', version: '' },
        dictionary: {},
      },
    })

    expect(result.issues).toEqual([])
    expect(result.expansionIssues).toEqual([])
    expect(result.root).toMatchObject({ width: '{{self:size}}', size: '540' })
    if (result.root.type !== 'simple-container-block') throw new Error('Expected container')
    expect(result.root.children[0]).toMatchObject({
      block: { content: '{{parent:size}} / Demo' },
      location: { x: '{{parent:size}}' },
    })
  })

  it('bakes nested custom blocks with their public values and no package dependency', () => {
    const packagedRoot = createBlock('text-block', { id: 'package-root', content: '{{self:label}}' })
    packagedRoot.additionalFieldDefinition = { label: { fieldType: 'string' } }
    const host = createBlock('custom-block', { id: 'nested', customBlockKey: 'label' })
    ;(host as unknown as Record<string, unknown>).label = 'Exported'
    const root = createBlock('simple-container-block', { id: 'root' })
    root.children.push({
      block: host,
      location: { id: 'nested-location', type: 'simple-container-location', anchor: 'lt' },
    })

    const result = materializeProjectCustomBlockExport({
      document: createDocument(root),
      rootBlockId: root.id,
      customBlockCatalog: new Map([['label', {
        manifest: {
          customBlockKey: 'label', publicFieldKeys: ['label'],
          resize: { widthLocked: false, heightLocked: false },
        },
        block: packagedRoot,
      }]]),
    })

    expect(result.expansionIssues).toEqual([])
    if (result.root.type !== 'simple-container-block') throw new Error('Expected container')
    expect(result.root.children[0]!.block).toMatchObject({
      type: 'text-block', id: 'nested', content: '{{self:label}}', label: 'Exported',
    })
    expect(result.root.children[0]!.block.type).not.toBe('custom-block')
  })

  it('reports only nested custom block failures inside the exported subtree', () => {
    const root = createBlock('simple-container-block', { id: 'root' })
    root.children.push({
      block: createBlock('custom-block', { id: 'missing-inside', customBlockKey: 'missing' }),
      location: { id: 'inside-location', type: 'simple-container-location', anchor: 'lt' },
    })
    const document = createDocument(root)
    document.faces.back.children.push({
      block: createBlock('custom-block', { id: 'missing-outside', customBlockKey: 'missing' }),
      location: { id: 'outside-location', type: 'simple-container-location', anchor: 'lt' },
    })

    const result = materializeProjectCustomBlockExport({ document, rootBlockId: root.id, customBlockCatalog: new Map() })

    expect(result.expansionIssues).toEqual([
      { blockId: 'missing-inside', faceKey: 'front', reason: 'missing', customBlockKey: 'missing' },
    ])
  })

  it('materializes references that cross the export root and reports failures at their field', () => {
    const parent = createBlock('simple-container-block', { id: 'parent' })
    parent.additionalFieldDefinition = { tone: { fieldType: 'string' } }
    ;(parent as unknown as Record<string, unknown>).tone = '{{dictionary:missing}}'
    parent.children.push({
      block: createBlock('text-block', { id: 'root', content: '{{parent:tone}}' }),
      location: { id: 'root-location', type: 'simple-container-location', anchor: 'lt' },
    })
    const document = createDocument(parent)
    const result = materializeProjectCustomBlockExport({ document, rootBlockId: 'root', environment: { dictionary: {} } })

    expect(result.root).toMatchObject({ content: '{{parent:tone}}' })
    expect(result.issues).toContainEqual(expect.objectContaining({
      type: 'card-designer.binding.field-not-found',
      location: expect.objectContaining({ owner: { kind: 'block', id: 'parent' }, fieldKey: 'tone' }),
    }))
  })

  it('does not include unrelated document binding failures', () => {
    const root = createBlock('text-block', { id: 'root', content: '{{project:name}}' })
    const document = createDocument(root)
    document.faces.back.children.push({
      block: createBlock('text-block', { id: 'unrelated', content: '{{dictionary:missing}}' }),
      location: { id: 'unrelated-location', type: 'simple-container-location', anchor: 'lt' },
    })
    const result = materializeProjectCustomBlockExport({
      document,
      rootBlockId: root.id,
      environment: { project: { name: 'Demo', description: '', version: '' }, dictionary: {} },
    })

    expect(result.issues).toEqual([])
    expect(result.root).toMatchObject({ content: 'Demo' })
  })
})
