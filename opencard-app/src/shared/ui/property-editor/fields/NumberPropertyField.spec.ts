import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OcButton from '../../../../components/base/OcButton.vue'
import NumberPropertyField from './NumberPropertyField.vue'

describe('NumberPropertyField', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses themed steppers and clamps values to the schema range', async () => {
    const wrapper = mount(NumberPropertyField, {
      props: {
        definition: { title: 'Number', fieldType: 'number', min: 0, max: 2 },
        value: '1',
      },
    })

    const steppers = wrapper.findAll('.number-field__stepper')
    expect(steppers).toHaveLength(2)
    expect(wrapper.findAllComponents(OcButton).map(button => button.props('icon')))
      .toEqual(['nav.chevron-up', 'nav.chevron-down'])

    await steppers[0].trigger('click')
    await steppers[1].trigger('click')
    expect(wrapper.emitted('update:value')).toEqual([['2'], ['0']])

    await wrapper.setProps({ value: '2' })
    expect(wrapper.findAll('.number-field__stepper')[0].attributes('disabled')).toBeDefined()
  })

  it('preserves invalid text for RenderParser diagnostics', async () => {
    const wrapper = mount(NumberPropertyField, {
      props: {
        definition: { title: 'Number', fieldType: 'number' },
        value: 'invalid',
      },
    })

    expect(wrapper.get('input').element.value).toBe('invalid')
    await wrapper.get('input').setValue('12oops')
    expect(wrapper.emitted('update:value')).toEqual([['12oops']])
  })

  it('multiplies click and hold steps by five while Shift is pressed', async () => {
    const wrapper = mount(NumberPropertyField, {
      props: {
        definition: { title: 'Number', fieldType: 'number' },
        value: '1',
      },
    })

    await wrapper.findAll('.number-field__stepper')[0].trigger('click', { shiftKey: true })
    expect(wrapper.emitted('update:value')).toEqual([['6']])
  })

  it('steps between allowed values and exposes raw commits to its parent', async () => {
    const wrapper = mount(NumberPropertyField, {
      props: {
        definition: { title: 'Factor', fieldType: 'number', min: 1, max: 12, allowedValues: [1, 2, 3, 4, 6, 12] },
        value: '4',
      },
    })

    await wrapper.findAll('.number-field__stepper')[0]!.trigger('click')
    await wrapper.findAll('.number-field__stepper')[1]!.trigger('click')
    expect(wrapper.emitted('update:value')).toEqual([['6'], ['3']])

    await wrapper.get('input').setValue('5')
    expect(wrapper.emitted('commit')).toEqual([['5']])
  })

  it('accelerates repeated steps while held and stops on release', async () => {
    vi.useFakeTimers()
    const wrapper = mount(NumberPropertyField, {
      props: {
        definition: { title: 'Number', fieldType: 'number' },
        value: '0',
      },
    })
    const increase = wrapper.findAll('.number-field__stepper')[0]

    await increase.trigger('pointerdown')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', shiftKey: true }))
    await vi.advanceTimersByTimeAsync(420)
    const afterDelay = wrapper.emitted('update:value')?.length ?? 0
    await vi.advanceTimersByTimeAsync(900)
    const afterFirstWindow = wrapper.emitted('update:value')?.length ?? 0
    await vi.advanceTimersByTimeAsync(900)
    const afterSecondWindow = wrapper.emitted('update:value')?.length ?? 0

    expect(afterDelay).toBe(1)
    expect(wrapper.emitted('update:value')?.[0]).toEqual(['5'])
    expect(afterSecondWindow - afterFirstWindow).toBeGreaterThan(afterFirstWindow - afterDelay)

    window.dispatchEvent(new Event('pointerup'))
    const afterRelease = wrapper.emitted('update:value')?.length ?? 0
    await vi.advanceTimersByTimeAsync(1000)
    expect(wrapper.emitted('update:value')).toHaveLength(afterRelease)
  })
})
