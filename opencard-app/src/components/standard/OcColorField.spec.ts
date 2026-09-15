import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import OcColorField from './OcColorField.vue'

function fieldInput(wrapper: ReturnType<typeof mount>): HTMLInputElement {
  return wrapper.get('.oc-color-picker__field-input').element as HTMLInputElement
}

describe('OcColorField', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders the color picker in its field variant with the current value', () => {
    const wrapper = mount(OcColorField, { props: { modelValue: '#112233' } })

    const root = wrapper.get('.oc-color-picker')
    expect(root.classes()).toContain('oc-color-field')
    expect(wrapper.find('.oc-color-picker__field').exists()).toBe(true)
    expect(wrapper.find('.oc-color-picker__trigger').exists()).toBe(false)
    expect(fieldInput(wrapper).value).toBe('#112233')
    expect(wrapper.get('.oc-color-picker__field-trigger').attributes('aria-label')).toBe('Choose color')
  })

  it('forwards the label to the field trigger and the hex input', () => {
    const wrapper = mount(OcColorField, { props: { modelValue: '#112233', label: 'Border color' } })

    expect(wrapper.get('.oc-color-picker__field-trigger').attributes('aria-label')).toBe('Border color')
    expect(wrapper.get('.oc-color-picker__field-input').attributes('aria-label')).toBe('Border color')
  })

  it('limits the hex draft according to allowAlpha', () => {
    const withAlpha = mount(OcColorField, { props: { modelValue: '#11223380' } })
    expect(withAlpha.get('.oc-color-picker__field-input').attributes('maxlength')).toBe('9')

    const opaque = mount(OcColorField, { props: { modelValue: '#112233', allowAlpha: false } })
    expect(opaque.get('.oc-color-picker__field-input').attributes('maxlength')).toBe('7')
  })

  it('previews the draft and emits both the model update and the commit on blur', async () => {
    const wrapper = mount(OcColorField, { props: { modelValue: '#112233' } })

    await wrapper.get('.oc-color-picker__field-input').setValue('#AABBCC')

    expect(wrapper.emitted('preview')).toEqual([['#AABBCC']])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('commit')).toBeUndefined()

    await wrapper.get('.oc-color-picker__field-input').trigger('blur')

    expect(wrapper.emitted('update:modelValue')).toEqual([['#AABBCC']])
    expect(wrapper.emitted('commit')).toEqual([['#AABBCC']])
  })

  it('blocks the picker while disabled', async () => {
    const wrapper = mount(OcColorField, {
      props: { modelValue: '#112233', disabled: true },
      attachTo: document.body,
    })

    expect(wrapper.get('.oc-color-picker__field-trigger').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.oc-color-picker__field-input').attributes('disabled')).toBeDefined()

    wrapper.get('.oc-color-picker__field-trigger').element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(document.body.querySelector('.oc-color-picker__panel')).toBeNull()
    wrapper.unmount()
  })

  it('cancels an uncommitted preview when the open picker is dismissed', async () => {
    const wrapper = mount(OcColorField, {
      props: { modelValue: '#112233' },
      attachTo: document.body,
    })

    await wrapper.get('.oc-color-picker__field-trigger').trigger('click')
    const panel = document.body.querySelector<HTMLElement>('.oc-color-picker__panel')
    expect(panel).not.toBeNull()

    await wrapper.get('.oc-color-picker__field-input').setValue('#AABBCC')
    panel!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()

    expect(wrapper.emitted('cancel')).toEqual([[]])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(fieldInput(wrapper).value).toBe('#112233')
    wrapper.unmount()
  })

  it('follows the parent model value', async () => {
    const wrapper = mount(OcColorField, { props: { modelValue: '#112233' } })

    await wrapper.setProps({ modelValue: '#445566' })

    expect(fieldInput(wrapper).value).toBe('#445566')
  })
})
