import { describe, expect, it } from 'vitest'
import { createBlock } from '../../../entities/card/model'
import { analyzeProjectCustomBlockExport } from './projectCustomBlockExportAnalyzer'

describe('analyzeProjectCustomBlockExport', () => {
  it('counts root self references and locks referenced axes', () => {
    const root = createBlock('text-block', { width: '{{self:size}}', height: '{{self:size}}' })
    root.additionalFieldDefinition = { size: { fieldType: 'number', title: '尺寸' } }
    const result = analyzeProjectCustomBlockExport(root)
    expect(result.fields[0]).toMatchObject({ key: 'size', referenceCount: 2 })
    expect(result.resize).toEqual({ widthLocked: true, heightLocked: true })
  })

  it('counts descendant parent references and locations', () => {
    const root = createBlock('simple-container-block')
    root.additionalFieldDefinition = { size: { fieldType: 'number' } }
    const child = createBlock('text-block', { width: '{{parent.size}}' })
    root.children.push({ block: child, location: { id: 'loc-1', type: 'simple-container-location', anchor: 'lt', x: '{{parent.size}}' } })
    expect(analyzeProjectCustomBlockExport(root).fields[0].referenceCount).toBe(2)
  })

  it('ignores descendant self, escaped tokens, and parent chains that do not resolve to the root', () => {
    const root = createBlock('simple-container-block')
    root.additionalFieldDefinition = { size: { fieldType: 'number' } }
    const nested = createBlock('simple-container-block')
    nested.children.push({
      block: createBlock('text-block', { content: '{{self:size}} \\{{parent.parent:size}} {{parent:size}} {{parent.parent:size}}' }),
      location: { id: 'deep-location', type: 'simple-container-location', anchor: 'lt' },
    })
    root.children.push({
      block: nested,
      location: { id: 'nested-location', type: 'simple-container-location', anchor: 'lt' },
    })
    expect(analyzeProjectCustomBlockExport(root).fields[0].referenceCount).toBe(1)
  })
})
