import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import enUS from '../../../locales/en-US'
import ProjectExportDialog from './ProjectExportDialog.vue'

describe('ProjectExportDialog', () => {
  it('submits a valid one-off task and can close without changing defaults', async () => {
    const wrapper = mount(ProjectExportDialog, {
      props: {
        open: true,
        modelValue: {
          documentPaths: ['cards/main.ocdocument'],
          selectionMode: 'blueprint-and-instances',
          scale: 1,
          layoutMode: 'none',
          outputDirectory: 'C:/exports',
          conflictMode: 'replace',
          errorPolicy: 'continue',
        },
        documents: [{ path: 'cards/main.ocdocument', width: 540, height: 850 }],
        busy: false,
        preparationIssues: [],
      },
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })],
        stubs: { Teleport: true, OcAutocompletePopover: true },
      },
    })
    await wrapper.vm.$nextTick()

    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toHaveLength(1)
    const cancelButton = wrapper.findAll('button').find(button => button.text() === 'Cancel')
    expect(cancelButton).toBeDefined()
    await cancelButton!.trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
