import { describe, expect, it } from 'vitest'
import type { CardDesignerLayoutState } from '../../editor-runtime/model/editorUiState'
import { useEditorSessionStore } from './editorSessionStore'

describe('editorSessionStore card designer layout', () => {
  it('keeps layout state isolated by session', () => {
    const store = useEditorSessionStore()
    const first = store.createUntitledSession({ fileTypeId: 'opencard' })
    const second = store.createUntitledSession({ fileTypeId: 'opencard' })
    const layout: CardDesignerLayoutState = {
      panels: {
        instanceExpanded: false,
        previewExpanded: true,
        structureExpanded: false,
        propertyExpanded: true,
      },
      leftTopHeight: 240,
      rightTopHeight: 320,
    }

    store.updateSessionUiState(first.id, {
      cardDesigner: { layout },
    })

    expect(store.sessions.value.find((session) => session.id === first.id)?.uiState?.cardDesigner?.layout)
      .toEqual(layout)
    expect(store.sessions.value.find((session) => session.id === second.id)?.uiState?.cardDesigner?.layout)
      .toBeUndefined()

    store.closeSession(first.id)
    store.closeSession(second.id)
  })
})
