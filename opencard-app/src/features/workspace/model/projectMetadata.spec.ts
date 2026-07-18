import { describe, expect, it } from 'vitest'
import { resolveFileType } from './fileTypes'
import { parseProjectMetadataText, serializeProjectMetadata } from './projectMetadata'

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
})
