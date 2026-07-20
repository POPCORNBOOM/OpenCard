import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PropertyEditor from './PropertyEditor.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    te: () => false,
  }),
}))

describe('PropertyEditor custom fields', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('creates a custom field through the modal form', async () => {
    const wrapper = mount(PropertyEditor, {
      attachTo: document.body,
      props: {
        sortMode: 'category',
        inputs: [{
          key: 'block',
          record: { type: 'text-block', id: 'block' },
          customFields: {
            keys: [],
            canCreate: true,
            occupiedKeys: ['id', 'type'],
            allowedDatatypes: ['string', 'number'],
            deleteImpactByKey: {},
          },
        }],
      },
    })

    await wrapper.get('button[aria-label="propertyEditor.customFields.create"]').trigger('click')
    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')!
    const inputs = dialog.querySelectorAll<HTMLInputElement>('input')
    const select = dialog.querySelector<HTMLSelectElement>('select')!
    select.value = 'number'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    inputs[0]!.value = 'score'
    inputs[0]!.dispatchEvent(new Event('input', { bubbles: true }))
    inputs[1]!.value = 'Score'
    inputs[1]!.dispatchEvent(new Event('input', { bubbles: true }))
    await wrapper.vm.$nextTick()
    const buttons = Array.from(dialog.querySelectorAll('button'))
    buttons.find((button) => button.textContent?.includes('propertyEditor.customFields.confirmCreate'))!.click()

    expect(wrapper.emitted('create-custom-field')).toEqual([[
      { key: 'block', fieldKey: 'score', title: 'Score', datatype: 'number' },
    ]])
  })

  it('keeps invalid drafts open and restores focus after Escape', async () => {
    const wrapper = mount(PropertyEditor, {
      attachTo: document.body,
      props: {
        sortMode: 'category',
        inputs: [{
          key: 'block',
          record: { type: 'text-block', id: 'block' },
          customFields: {
            keys: [],
            canCreate: true,
            occupiedKeys: ['score'],
            allowedDatatypes: ['number'],
            deleteImpactByKey: {},
          },
        }],
      },
    })

    const trigger = wrapper.get('button[aria-label="propertyEditor.customFields.create"]')
    ;(trigger.element as HTMLButtonElement).focus()
    await trigger.trigger('click')
    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')!
    const keyInput = dialog.querySelector<HTMLInputElement>('input')!
    keyInput.value = 'Score'
    keyInput.dispatchEvent(new Event('input', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(dialog.querySelector('[role="alert"]')?.textContent)
      .toContain('propertyEditor.customFields.errors.duplicate')
    expect(wrapper.emitted('create-custom-field')).toBeUndefined()

    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(trigger.element)
  })

  it('confirms deletion with the prepared instance impact', async () => {
    const wrapper = mount(PropertyEditor, {
      attachTo: document.body,
      props: {
        sortMode: 'category',
        inputs: [{
          key: 'block',
          record: { type: 'text-block', id: 'block', score: 10 },
          override: { score: { datatype: 'number', categoryId: 'custom' } },
          fieldLabels: { score: 'Score' },
          customFields: {
            keys: ['score'],
            canCreate: true,
            occupiedKeys: ['id', 'type', 'score'],
            allowedDatatypes: ['number'],
            deleteImpactByKey: { score: 2 },
          },
        }],
      },
    })

    await wrapper.get('.custom-field-delete-button').trigger('click')
    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')!
    expect(dialog.textContent).toContain('propertyEditor.customFields.deleteConfirmation')
    const buttons = Array.from(dialog.querySelectorAll('button'))
    buttons.find((button) => button.textContent?.includes('propertyEditor.customFields.confirmDelete'))!.click()

    expect(wrapper.emitted('delete-custom-field')).toEqual([[
      { key: 'block', fieldKey: 'score' },
    ]])
  })

  it('replaces a bound number editor and clears to the datatype default', async () => {
    const wrapper = mount(PropertyEditor, {
      props: {
        sortMode: 'category',
        inputs: [{
          key: 'block',
          record: { type: 'text-block', id: 'block', opacity: '{{s:score}}' },
        }],
        referenceContexts: {
          block: {
            opacity: {
              targetKind: 'number',
              scopes: [{
                token: 's',
                label: 'Current block',
                fields: [{ key: 'score', valueKind: 'number' }],
              }],
            },
          },
        },
      },
    })

    expect(wrapper.find('input[type="number"]').exists()).toBe(false)
    await wrapper.get('button[aria-label="propertyEditor.bindings.clear"]').trigger('click')
    expect(wrapper.emitted('update-property')).toEqual([[
      { key: 'block', fieldKey: 'opacity', value: 1 },
    ]])
  })
})
