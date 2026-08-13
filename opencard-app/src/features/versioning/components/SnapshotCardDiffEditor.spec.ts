import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'
import enUS from '../../../locales/en-US'

vi.mock('../../card-designer/CardDesignEditor.vue', () => ({
  default: {
    name: 'CardDesignEditor',
    props: [
      'comparisonLayout', 'comparisonRole', 'comparisonSelectedBlockId', 'comparisonChangedBlockIds',
      'comparisonChangedInstanceIds', 'comparisonDocumentChanged', 'cardDesignerView', 'viewportTransform',
      'comparisonInspectorTarget', 'comparisonFitFaceSize',
    ],
    emits: ['update-card-comparison-layout', 'update-card-comparison-selection'],
    template: '<button class="card-editor-stub" @click="$emit(\'update-card-comparison-layout\', \'vertical\')">{{ comparisonRole }}|{{ comparisonLayout }}|{{ comparisonSelectedBlockId }}</button>',
  },
}))
vi.mock('../services/snapshotProjectRenderSession', () => ({
  createSnapshotProjectRenderSession: vi.fn(async () => ({
    environment: {},
    release: vi.fn(),
  })),
}))

import SnapshotCardDiffEditor from './SnapshotCardDiffEditor.vue'

const side = (rootPath: string) => ({
  rootPath,
  relativePath: 'cards/main.ocdocument',
  completeness: 'project' as const,
  exists: true,
})

describe('SnapshotCardDiffEditor', () => {
  it('shares selection and viewport state while keeping one inspector side per layout', async () => {
    const historical = {
      type: 'card-document', schemaVersion: '2', id: 'document', version: '1', width: '640', height: '900',
      faces: {
        front: { type: 'card-face', id: 'front', background: '#000', children: [{
          block: { type: 'text-block', id: 'title', content: 'Old' },
          location: { id: 'location', type: 'simple-container-location', anchor: 'lt' },
        }] },
        back: { type: 'card-face', id: 'back', background: '#000', children: [] },
      },
      instances: [],
    }
    const current = structuredClone(historical)
    current.version = '2'
    current.width = '900'
    current.height = '640'
    current.faces.front.children[0]!.block.content = 'New'
    const wrapper = mount(SnapshotCardDiffEditor, {
      props: {
        historical: side('D:/historical'),
        current: side('D:/current'),
        comparison: {
          historicalContent: JSON.stringify(historical), currentContent: JSON.stringify(current),
          historicalLabel: 'v0.0.1', currentLabel: 'Current',
        },
        fileName: 'main.ocdocument',
        themeId: 'dark',
      },
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })],
      },
    })
    await vi.waitFor(() => expect(wrapper.findAll('.card-editor-stub')).toHaveLength(2))

    expect(wrapper.findAll('.card-editor-stub').map(item => item.text())).toEqual([
      'historical|horizontal|',
      'current|horizontal|',
    ])
    const editors = wrapper.findAllComponents({ name: 'CardDesignEditor' })
    expect(editors[0]!.props('comparisonInspectorTarget')).toBeUndefined()
    expect(editors[1]!.props('comparisonInspectorTarget')).toMatch(/^#snapshot-card-diff-inspector-/)
    for (const editor of wrapper.findAllComponents({ name: 'CardDesignEditor' })) {
      expect(editor.props('comparisonChangedBlockIds')).toEqual(['title'])
      expect(editor.props('comparisonDocumentChanged')).toBe(true)
      expect(editor.props('comparisonFitFaceSize')).toEqual({ width: 900, height: 900 })
    }

    await wrapper.findAll('.card-editor-stub')[1]!.trigger('click')
    expect(wrapper.findAll('.card-editor-stub')).toHaveLength(2)
    expect(wrapper.find('.snapshot-card-diff-editor').classes()).toContain('is-layout-vertical')
    for (const editor of wrapper.findAllComponents({ name: 'CardDesignEditor' })) {
      expect(editor.props('comparisonFitFaceSize')).toEqual({ width: 900, height: 900 })
    }
  })
})
