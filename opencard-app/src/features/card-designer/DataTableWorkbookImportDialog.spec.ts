import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import enUS from '../../locales/en-US'
import DataTableWorkbookImportDialog from './DataTableWorkbookImportDialog.vue'

describe('DataTableWorkbookImportDialog', () => {
  it('summarizes structural changes and confirms through the custom dialog', async () => {
    const wrapper = mount(DataTableWorkbookImportDialog, {
      attachTo: document.body,
      props: {
        result: {
          newInstances: [{
            type: 'card-instance',
            id: 'new-instance',
            name: 'Imported Instance',
            amount: '1',
            data: {},
          }],
          blockRenames: [{ blockId: 'block', previousName: 'Before', nextName: 'After' }],
          updates: [{ cardId: 'new-instance', blockId: 'block', fieldKey: 'content', reset: true }],
          warnings: [],
        },
      },
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })],
      },
    })

    const dialog = document.body.querySelector('.workbook-import-dialog')!
    expect(dialog.textContent).toContain('Imported Instance')
    expect(dialog.textContent).toContain('Before → After')
    const buttons = Array.from(dialog.querySelectorAll('button'))
    await buttons[buttons.length - 1]!.click()
    expect(wrapper.emitted('confirm')).toHaveLength(1)
    wrapper.unmount()
  })
})
