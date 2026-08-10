import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'
import enUS from '../../../locales/en-US'

vi.mock('../../card-designer/CardDesignEditor.vue', () => ({
  default: {
    name: 'CardDesignEditor',
    props: ['comparisonLayout', 'comparisonRole', 'comparisonSelectedBlockId', 'cardDesignerView', 'viewportTransform'],
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
    const wrapper = mount(SnapshotCardDiffEditor, {
      props: {
        historical: side('D:/historical'),
        current: side('D:/current'),
        comparison: {
          historicalContent: '{}', currentContent: '{}', historicalLabel: 'v0.0.1', currentLabel: 'Current',
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

    await wrapper.findAll('.card-editor-stub')[1]!.trigger('click')
    expect(wrapper.findAll('.card-editor-stub')).toHaveLength(2)
    expect(wrapper.find('.snapshot-card-diff-editor').classes()).toContain('is-layout-vertical')
  })
})
