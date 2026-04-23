import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcColorField from './OcColorField.vue'

const HEX_PREFIX = '#'
const COLOR_112233 = `${HEX_PREFIX}112233`
const COLOR_000000 = `${HEX_PREFIX}000000`
const COLOR_AABBCC = `${HEX_PREFIX}aabbcc`
const COLOR_445566 = `${HEX_PREFIX}445566`
const COLOR_ABC = `${HEX_PREFIX}abc`

describe('OcColorField', () => {
  it('renders preview, css input and picker by default', () => {
    const wrapper = mount(OcColorField, {
      props: {
        modelValue: COLOR_112233,
      },
    })

    expect(wrapper.find('.oc-color-field__preview').exists()).toBe(true)
    expect(wrapper.find('input[type="text"]').exists()).toBe(true)
    expect(wrapper.find('input[type="color"]').exists()).toBe(true)
  })

  it('supports toggling preview, picker and css input', () => {
    const wrapper = mount(OcColorField, {
      props: {
        modelValue: COLOR_112233,
        preview: false,
        picker: false,
        cssInput: false,
      },
    })

    expect(wrapper.find('.oc-color-field__preview').exists()).toBe(false)
    expect(wrapper.find('input[type="text"]').exists()).toBe(false)
    expect(wrapper.find('input[type="color"]').exists()).toBe(false)
  })

  it('emits update:modelValue from css input and picker', async () => {
    const wrapper = mount(OcColorField, {
      props: {
        modelValue: COLOR_000000,
      },
    })

    await wrapper.get('input[type="text"]').setValue(COLOR_AABBCC)
    await wrapper.get('input[type="color"]').setValue(COLOR_445566)

    expect(wrapper.emitted('update:modelValue')).toEqual([
      [COLOR_AABBCC],
      [COLOR_445566],
    ])
  })

  it('normalizes 3-digit hex for picker value', () => {
    const wrapper = mount(OcColorField, {
      props: {
        modelValue: COLOR_ABC,
      },
    })

    expect((wrapper.get('input[type="color"]').element as HTMLInputElement).value).toBe(COLOR_AABBCC)
  })

  it('falls back preview to transparent for unsupported color values', () => {
    const wrapper = mount(OcColorField, {
      props: {
        modelValue: 'not-a-color',
      },
    })

    expect(wrapper.get('.oc-color-field__preview-fill').attributes('style')).toContain('background: transparent;')
    expect((wrapper.get('input[type="color"]').element as HTMLInputElement).value).toBe(COLOR_000000)
  })
})
