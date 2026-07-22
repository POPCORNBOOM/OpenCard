import { describe, expect, it } from 'vitest'
import type {
  CardDesignerLayoutState,
  CardDesignerViewState,
} from '../../editor-runtime/model/editorUiState'
import { useEditorSessionStore } from './editorSessionStore'

describe('editorSessionStore card designer layout', () => {
  it('creates untitled cards with the dual-face v2 protocol', () => {
    const store = useEditorSessionStore()
    const session = store.createUntitledSession({ fileTypeId: 'opencard' })
    const document = JSON.parse(session.draftContent)

    expect(document).toMatchObject({
      type: 'card-document',
      schemaVersion: '2',
      faces: {
        front: { type: 'card-face', background: '#FFFFFF', children: [] },
        back: { type: 'card-face', background: '#FFFFFF', children: [] },
      },
    })
    expect(document.faces.front.id).not.toBe(document.faces.back.id)

    store.closeSession(session.id)
  })

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

  it('merges card designer view state without replacing layout state', () => {
    const store = useEditorSessionStore()
    const session = store.createUntitledSession({ fileTypeId: 'opencard' })
    const layout: CardDesignerLayoutState = {
      panels: {
        instanceExpanded: true,
        previewExpanded: true,
        structureExpanded: true,
        propertyExpanded: true,
      },
      leftTopHeight: null,
      rightTopHeight: null,
    }
    const view: CardDesignerViewState = {
      activeFace: 'back',
      clipToFace: true,
      selectedInstanceId: 'instance-1',
    }

    store.updateSessionUiState(session.id, { cardDesigner: { layout } })
    store.updateSessionUiState(session.id, { cardDesigner: { view } })

    expect(store.sessions.value.find((candidate) => candidate.id === session.id)?.uiState?.cardDesigner)
      .toEqual({ layout, view })

    store.closeSession(session.id)
  })
})
