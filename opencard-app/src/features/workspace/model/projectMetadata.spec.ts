import { describe, expect, it } from 'vitest'
import { resolveFileType } from './fileTypes'
import {
  createDefaultProjectInformation,
  createProjectAdditionalField,
  deleteProjectAdditionalField,
  parseProjectMetadataText,
  projectPropertySchema,
  serializeProjectMetadata,
} from './projectMetadata'

describe('project metadata', () => {
  it('parses the project and workspace sections as one project file', () => {
    const content = serializeProjectMetadata({
      version: 1,
      project: { name: 'Demo', description: 'Cards', entry: 'main.opencard' },
      workspace: { indexedEntries: [], expandedDirectories: ['assets'] },
    })

    expect(parseProjectMetadataText(content)).toEqual({
      version: 1,
      project: { name: 'Demo', description: 'Cards', entry: 'main.opencard' },
      workspace: { indexedEntries: [], expandedDirectories: ['assets'] },
    })
  })

  it('registers the fixed project file name with the project editor', () => {
    expect(resolveFileType('D:/project/.opencardproject')).toMatchObject({
      id: 'opencard-project',
      editorId: 'project-config',
      icon: 'file.opencard-project',
    })
    expect(resolveFileType('D:/project/main.opencard').id).toBe('opencard')
  })

  it('defines project fields as reference-only binding sources', () => {
    expect(projectPropertySchema.name).toMatchObject({
      fieldType: 'string',
      acceptsBinding: false,
    })
    expect(projectPropertySchema.entry).toMatchObject({
      fieldType: 'filePath',
      acceptsBinding: false,
      exposesReference: false,
    })
    expect(projectPropertySchema.additionalFieldDefinition).toMatchObject({
      fieldType: 'object',
      isHidden: true,
      acceptsBinding: false,
      exposesReference: false,
    })
  })

  it('round-trips declared project fields beside native fields', () => {
    const metadata = parseProjectMetadataText(JSON.stringify({
      version: 1,
      project: {
        name: 'Demo',
        description: 'Cards',
        entry: 'main.opencard',
        author: 'Alice',
        edition: '2',
        undeclared: 'discarded',
        additionalFieldDefinition: {
          author: { fieldType: 'string', title: ' Author ' },
          edition: { fieldType: 'number' },
          entry: { fieldType: 'string' },
          invalid: { fieldType: 'object' },
        },
      },
      workspace: { indexedEntries: [], expandedDirectories: [] },
    }))

    expect(metadata?.project).toEqual({
      name: 'Demo',
      description: 'Cards',
      entry: 'main.opencard',
      author: 'Alice',
      edition: '2',
      additionalFieldDefinition: {
        author: { fieldType: 'string', title: 'Author' },
        edition: { fieldType: 'number' },
      },
    })
  })

  it('creates and deletes project fields with the shared additional-field rules', () => {
    const project = createDefaultProjectInformation('Demo')

    expect(createProjectAdditionalField(project, 'author', 'string', ' Author ')).toBeNull()
    expect(project).toMatchObject({
      author: '',
      additionalFieldDefinition: {
        author: { fieldType: 'string', title: 'Author' },
      },
    })
    expect(createProjectAdditionalField(project, 'Name', 'string')).toBe('duplicate')
    expect(deleteProjectAdditionalField(project, 'author')).toBe(true)
    expect(project).not.toHaveProperty('author')
    expect(project).not.toHaveProperty('additionalFieldDefinition')
  })
})
