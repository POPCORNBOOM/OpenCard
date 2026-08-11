import { describe, expect, it } from 'vitest'
import { createTextBlock, type CardDocument } from '../../entities/card/model'
import type { ProjectExportTask } from '../workspace/model/projectMetadata'
import { EMPTY_PROJECT_ICON_CATALOG } from '../workspace/services/projectIconCatalog'
import { prepareExportTask } from './exportPlanner'
import { validateExportTask, type ExportDestination, type ExportDocumentSource } from './exportTask'

const environment = {
  project: null,
  dictionary: null,
  projectIconCatalog: EMPTY_PROJECT_ICON_CATALOG,
}

function document(instances = ['Knight']): CardDocument {
  return {
    type: 'card-document', id: 'document', name: 'Card', version: '1',
    width: '540', height: '850',
    faces: {
      front: { type: 'card-face', id: 'front', background: '#fff', children: [] },
      back: { type: 'card-face', id: 'back', background: '#000', children: [] },
    },
    instances: instances.map((name, index) => ({
      type: 'card-instance', id: `instance-${index}`, name, amount: '1', data: {},
    })),
  }
}

const destination: ExportDestination = {
  exists: async () => true,
  ensureDirectory: async () => undefined,
  write: async () => undefined,
}

function task(selectionMode: ProjectExportTask['selectionMode'], paths = ['cards/main.ocdocument']): ProjectExportTask {
  return {
    documentPaths: paths,
    selectionMode,
    scale: 2,
    layoutMode: 'none',
    outputDirectory: 'D:/exports',
    conflictMode: 'replace',
    errorPolicy: 'continue',
  }
}

describe('prepareExportTask', () => {
  it('validates static task invariants before loading documents', () => {
    const issues = validateExportTask({
      ...task('blueprint', ['cards/main.ocdocument', 'CARDS/main.ocdocument']),
      scale: 0,
      layoutMode: 'layout',
      outputDirectory: '',
    })
    expect(issues.map(issue => issue.code)).toEqual([
      'duplicate-document', 'invalid-scale', 'layout-unavailable', 'output-required',
    ])
  })

  it.each([
    ['blueprint', 2],
    ['instances', 2],
    ['blueprint-and-instances', 4],
  ] as const)('plans both faces for %s selection', async (selectionMode, expectedCount) => {
    const source: ExportDocumentSource = {
      load: async sourcePath => ({ sourcePath, resourceRootPath: 'D:/project/cards', document: document() }),
    }
    const result = await prepareExportTask({ task: task(selectionMode), source, destination, environment })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.plan.entries).toHaveLength(expectedCount)
  })

  it('keeps document normalization warnings non-blocking', async () => {
    const source: ExportDocumentSource = {
      load: async sourcePath => ({
        sourcePath, resourceRootPath: 'D:/project/cards', document: document(),
        storageWarnings: [{ code: 'entry-ignored', path: '$.faces.front.children[0]', message: 'ignored' }],
      }),
    }
    const result = await prepareExportTask({ task: task('blueprint'), source, destination, environment })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.warnings).toEqual([expect.objectContaining({ code: 'document-normalized' })])
  })

  it('keeps the custom-block runtime catalog in the prepared renderer resources', async () => {
    const customBlockCatalog = new Map([['picture', {
      manifest: {
        customBlockKey: 'picture', publicFieldKeys: [],
        resize: { widthLocked: false, heightLocked: false },
      },
      block: {},
      resourceUrls: new Map([['resources/images/a.png', 'blob:export-picture']]),
    }]])
    const source: ExportDocumentSource = {
      load: async sourcePath => ({ sourcePath, resourceRootPath: 'D:/project/cards', document: document() }),
    }

    const result = await prepareExportTask({
      task: task('blueprint'), source, destination,
      environment: { ...environment, customBlockCatalog },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.entries[0]?.render.resources.customBlockCatalog).toBe(customBlockCatalog)
    expect(result.plan.entries[0]?.render.resources.resourceRootPath).toBe('D:/project/cards')
  })

  it('flattens project-relative paths and deterministically deduplicates names', async () => {
    const source: ExportDocumentSource = {
      load: async sourcePath => ({
        sourcePath,
        resourceRootPath: `D:/project/${sourcePath.slice(0, sourcePath.lastIndexOf('/'))}`,
        document: document(['Knight', 'Knight']),
      }),
    }
    const result = await prepareExportTask({
      task: task('instances', ['cards/main.ocdocument', 'other/main.ocdocument']),
      source,
      destination,
      environment,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.entries.map(entry => entry.outputPath)).toEqual([
      'D:/exports/cards_main_instance_Knight_front.png',
      'D:/exports/cards_main_instance_Knight_back.png',
      'D:/exports/cards_main_instance_Knight_front_2.png',
      'D:/exports/cards_main_instance_Knight_back_2.png',
      'D:/exports/other_main_instance_Knight_front.png',
      'D:/exports/other_main_instance_Knight_back.png',
      'D:/exports/other_main_instance_Knight_front_2.png',
      'D:/exports/other_main_instance_Knight_back_2.png',
    ])
  })

  it('freezes instance, project, and dictionary bindings into every planned face', async () => {
    const sourceDocument = document(['Knight'])
    const block = createTextBlock({
      id: 'text',
      content: '{{self:label}} / {{project:name}} / {{dictionary:greeting}}',
    })
    block.additionalFieldDefinition = { label: { fieldType: 'string' } }
    ;(block as unknown as Record<string, unknown>).label = 'Blueprint'
    sourceDocument.faces.front.children = [{
      block,
      location: { id: 'location', type: 'simple-container-location', anchor: 'lt' },
    }]
    sourceDocument.instances[0]!.data = { text: { label: 'Instance' } }
    const source: ExportDocumentSource = {
      load: async sourcePath => ({
        sourcePath,
        resourceRootPath: 'D:/project/cards',
        document: sourceDocument,
      }),
    }

    const result = await prepareExportTask({
      task: task('blueprint-and-instances'),
      source,
      destination,
      environment: {
        ...environment,
        project: { name: 'Demo', description: '', version: '' },
        dictionary: { greeting: 'Hello {{project:name}}' },
      },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const frontContents = result.plan.entries
      .filter(entry => entry.faceKey === 'front')
      .map(entry => (
        entry.render.document.faces.front.children[0]!.block as { content: string }
      ).content)
    expect(frontContents).toEqual([
      'Blueprint / Demo / Hello Demo',
      'Instance / Demo / Hello Demo',
    ])
  })

  it('returns preparation issues instead of a partial plan', async () => {
    const source: ExportDocumentSource = { load: async () => { throw new Error('broken') } }
    const result = await prepareExportTask({ task: task('blueprint'), source, destination, environment })
    expect(result).toEqual({
      ok: false,
      issues: [{ code: 'document-unavailable', path: 'cards/main.ocdocument', message: 'broken' }],
    })
  })

  it('turns output probing failures into a validation issue', async () => {
    const source: ExportDocumentSource = {
      load: async sourcePath => ({ sourcePath, resourceRootPath: 'D:/project/cards', document: document() }),
    }
    const result = await prepareExportTask({
      task: task('blueprint'), source,
      destination: { ...destination, exists: async () => { throw new Error('denied') } },
      environment,
    })
    expect(result).toEqual({ ok: false, issues: [{ code: 'output-unavailable' }] })
  })
})
