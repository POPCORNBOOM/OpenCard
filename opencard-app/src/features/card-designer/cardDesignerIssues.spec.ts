import { describe, expect, it } from 'vitest'
import { createTextBlock, type CardDocument, type CardInstanceRecord } from '../../entities/card/model'
import type { RenderPipelineResult } from '../card-rendering/renderPipeline'
import { createCardDesignerIssueSnapshot, createCardDesignerIssues } from './cardDesignerIssues'

const translate = (key: string) => `translated:${key}`
const resolveFieldLabel = (key: string) => `field:${key}`

function createDocument(): CardDocument {
  return {
    type: 'card-document',
    id: 'card-doc',
    name: 'Card',
    version: '1.0.0',
    width: '540',
    height: '850',
    background: '#fff',
    instances: [{ type: 'card-instance', id: 'instance-1', name: 'Instance 1', amount: '1', data: {} }],
    children: [{
      block: createTextBlock({ id: 'title', name: 'Title' }),
      location: { id: 'location-1', type: 'simple-container-location', anchor: 'lt' },
    }],
  }
}

function createResult(): RenderPipelineResult {
  const document = createDocument()
  return {
    document: document as never,
    issues: [{
      id: 'issue-1',
      type: 'card-designer.render-parse.out-of-range',
      severity: 'warning',
      location: {
        documentId: document.id,
        instanceId: 'instance-1',
        owner: { kind: 'block', id: 'title' },
        blockId: 'title',
        blockPath: 'Container.Title',
        fieldKey: 'opacity',
      },
    }],
  }
}

describe('cardDesignerIssues', () => {
  it('creates display-ready issues with opaque card navigation tokens', () => {
    const instance: CardInstanceRecord = {
      type: 'card-instance', id: 'instance-1', name: 'Instance 1', amount: '1', data: {},
    }
    expect(createCardDesignerIssues(createResult(), instance, translate, resolveFieldLabel)).toEqual([
      expect.objectContaining({
        id: 'issue-1',
        type: 'card-designer.render-parse.out-of-range',
        severity: 'warning',
        locationText: 'Instance 1 · Container.Title · field:opacity',
        description: 'translated:app.problems.renderCodes.OUT_OF_RANGE',
        navigationToken: {
          protocol: 'card-designer',
          version: 1,
          target: {
            kind: 'property',
            instanceId: 'instance-1',
            blockId: 'title',
            owner: 'block',
            fieldKey: 'opacity',
          },
        },
      }),
    ])
  })

  it('reports an ordered per-card snapshot and clears all scopes without a document', () => {
    const document = createDocument()
    expect(createCardDesignerIssueSnapshot({
      document,
      instance: document.instances[0]!,
      result: createResult(),
      translate,
      resolveFieldLabel,
    })).toMatchObject({
      scopeKey: 'card:instance:instance-1',
      scopeOrder: ['card:blueprint', 'card:instance:instance-1'],
    })

    expect(createCardDesignerIssueSnapshot({
      document: null,
      instance: null,
      result: null,
      translate,
      resolveFieldLabel,
    })).toEqual({ scopeKey: 'card:blueprint', scopeOrder: [], issues: [] })
  })

  it('routes document-owned issues to the blueprint property projection', () => {
    const result = createResult()
    result.issues[0] = {
      ...result.issues[0]!,
      location: {
        documentId: 'card-doc',
        instanceId: 'instance-1',
        owner: { kind: 'document', id: 'card-doc' },
        fieldKey: 'width',
      },
    }
    const issue = createCardDesignerIssues(
      result,
      createDocument().instances[0]!,
      translate,
      resolveFieldLabel,
    )[0]!

    expect(issue.navigationToken).toMatchObject({
      target: { instanceId: null, owner: 'document', fieldKey: 'width' },
    })
  })

  it('does not expose a navigation token without a stable block id', () => {
    const result = createResult()
    result.issues[0] = {
      ...result.issues[0]!,
      location: {
        documentId: 'card-doc',
        instanceId: null,
        owner: { kind: 'block', id: '' },
        fieldKey: 'id',
      },
    }

    expect(createCardDesignerIssues(result, null, translate, resolveFieldLabel)[0])
      .not.toHaveProperty('navigationToken')
  })
})
