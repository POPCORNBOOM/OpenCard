import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import OcCheckbox from '../../../components/base/OcCheckbox.vue'
import enUS from '../../../locales/en-US'
import type { UnsavedEditorDecision } from '../composables/useUnsavedSessionGuard'
import UnsavedEditorsDialog from './UnsavedEditorsDialog.vue'

const rows: UnsavedEditorDecision[] = [
  {
    sessionId: 'pending',
    name: 'Pending.opencard',
    fileTypeId: 'opencard',
    resourceKind: 'draft',
    path: null,
    decision: 'pending',
    savePath: null,
    selected: true,
    error: '',
  },
  {
    sessionId: 'save',
    name: 'Save.opencard',
    fileTypeId: 'opencard',
    resourceKind: 'draft',
    path: null,
    decision: 'save',
    savePath: 'D:/cards/Save.opencard',
    selected: false,
    error: '',
  },
  {
    sessionId: 'discard',
    name: 'Discard.opencard',
    fileTypeId: 'opencard',
    resourceKind: 'draft',
    path: null,
    decision: 'discard',
    savePath: null,
    selected: false,
    error: '',
  },
]

function mountDialog() {
  return mount(UnsavedEditorsDialog, {
    props: {
      open: true,
      intentType: 'app',
      rows,
      busy: false,
      globalError: '',
      selectedCount: 1,
      pendingCount: 1,
      saveCount: 1,
      discardCount: 1,
      allPendingSelected: true,
      somePendingSelected: false,
      canConfirm: false,
    },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })],
      stubs: { Teleport: true },
    },
  })
}

describe('UnsavedEditorsDialog', () => {
  it('shows checkboxes only for undecided rows and keeps decisions reviewable', async () => {
    const wrapper = mountDialog()

    expect(wrapper.findAllComponents(OcCheckbox)).toHaveLength(2)
    expect(wrapper.text()).toContain('Undecided')
    expect(wrapper.text()).toContain('Will save to D:/cards/Save.opencard')
    expect(wrapper.text()).toContain('Will discard changes')
    expect(wrapper.get('.unsaved-editors-dialog__footer-actions .oc-button--variant-solid').attributes('disabled'))
      .toBeDefined()

    const changeButtons = wrapper.findAll('button').filter(button => button.text() === 'Change')
    expect(changeButtons).toHaveLength(2)
    await changeButtons[0]!.trigger('click')
    expect(wrapper.emitted('change-decision')).toEqual([['save']])
  })

  it('emits the two batch decisions for the current selection', async () => {
    const wrapper = mountDialog()
    const buttons = wrapper.findAll('button')

    await buttons.find(button => button.text().startsWith('Set to discard'))!.trigger('click')
    await buttons.find(button => button.text().startsWith('Save selected'))!.trigger('click')

    expect(wrapper.emitted('mark-discard')).toHaveLength(1)
    expect(wrapper.emitted('mark-save')).toHaveLength(1)
  })
})
