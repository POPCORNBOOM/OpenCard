import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { EditorSession } from '../../workspace/store/editorSessionStore'
import { EMPTY_PROJECT_ICON_CATALOG } from '../../workspace/services/projectIconCatalog'
import { useProjectExport } from './useProjectExport'

function content(width: string): string {
  return JSON.stringify({
    type: 'card-document', schemaVersion: '2', id: 'document', name: 'Card', version: '1',
    width, height: '850', instances: [],
    faces: {
      front: { type: 'card-face', id: 'front', background: '#fff', children: [] },
      back: { type: 'card-face', id: 'back', background: '#000', children: [] },
    },
  })
}

function createAdapter(sessions: EditorSession[], readProjectFile = vi.fn(async () => content('640'))) {
  return {
    adapter: useProjectExport({
      sessions: ref(sessions),
      exportRendererRef: ref(),
      renderEnvironment: ref({
        project: null,
        dictionary: null,
        projectIconCatalog: EMPTY_PROJECT_ICON_CATALOG,
      }),
      readProjectFile,
      resolveProjectPath: path => `D:/project/${path}`,
      getRelativeProjectPath: path => path.replace('D:/project/', ''),
      translate: key => key,
    }),
    readProjectFile,
  }
}

describe('useProjectExport document source', () => {
  it('snapshots an open workspace draft instead of reading disk', async () => {
    const session: EditorSession = {
      id: 'session', resourceKind: 'workspace', path: 'D:/project/cards/main.ocdocument',
      fileTypeId: 'opencard', editorId: 'card-designer', name: 'main.ocdocument',
      savedContent: content('540'), draftContent: content('1080'), isDirty: true, isPreview: false,
    }
    const { adapter, readProjectFile } = createAdapter([session])
    const snapshot = await adapter.loadDocumentSnapshot('cards/main.ocdocument')
    session.draftContent = content('2160')
    expect(snapshot.document.width).toBe('1080')
    expect(snapshot.resourceRootPath).toBe('D:/project/cards')
    expect(readProjectFile).not.toHaveBeenCalled()
  })

  it('reads unopened documents from the project source', async () => {
    const { adapter, readProjectFile } = createAdapter([])
    const snapshot = await adapter.loadDocumentSnapshot('cards/main.ocdocument')
    expect(snapshot.document.width).toBe('640')
    expect(readProjectFile).toHaveBeenCalledWith('cards/main.ocdocument')
  })
})
