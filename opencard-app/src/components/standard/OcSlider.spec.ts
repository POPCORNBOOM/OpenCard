import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import OcSlider from './OcSlider.vue'

describe('OcSlider', () => {
  it('supports keyboard preview and commit without a native range input', async () => {
    const wrapper = mount(OcSlider, {
      props: { modelValue: 40, min: 0, max: 100, step: 2 },
    })

    expect(wrapper.find('input[type="range"]').exists()).toBe(false)
    await wrapper.trigger('keydown', { key: 'ArrowRight' })

    expect(wrapper.emitted('preview')).toEqual([[42]])
    expect(wrapper.emitted('update:modelValue')).toEqual([[42]])
    expect(wrapper.emitted('commit')).toEqual([[42]])
    expect(wrapper.attributes('aria-valuenow')).toBe('42')
  })

  it('does not interact while disabled', async () => {
    const wrapper = mount(OcSlider, {
      props: { modelValue: 40, disabled: true },
    })
    await wrapper.trigger('keydown', { key: 'End' })
    expect(wrapper.emitted('preview')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('commit')).toBeUndefined()
    expect(wrapper.attributes('tabindex')).toBe('-1')
  })

  it('renders explicit valid ticks in value order and marks the filled range', () => {
    const wrapper = mount(OcSlider, {
      props: { modelValue: 40, min: 0, max: 100, ticks: [100, 20, 40, 20, -10, Number.NaN] },
    })

    const ticks = wrapper.findAll('.oc-slider__tick')
    expect(ticks).toHaveLength(3)
    expect(ticks.map(tick => tick.attributes('style'))).toEqual([
      'left: 0%;', 'left: 50%;', 'left: 100%;',
    ])
    expect(ticks.map(tick => tick.classes().includes('is-filled'))).toEqual([true, true, false])
    expect(wrapper.get('.oc-slider__ticks').attributes('aria-hidden')).toBe('true')
  })

  it('snaps pointer interaction to the nearest explicit tick', async () => {
    const wrapper = mount(OcSlider, {
      props: { modelValue: 40, min: 0, max: 100, ticks: [0, 25, 50, 75, 100] },
    })
    vi.spyOn(wrapper.element, 'getBoundingClientRect').mockReturnValue({
      left: 0, right: 100, width: 100, top: 0, bottom: 4, height: 4,
      x: 0, y: 0, toJSON: () => ({}),
    })

    const event = new Event('pointerdown', { bubbles: true }) as PointerEvent
    Object.defineProperties(event, {
      button: { value: 0 }, pointerId: { value: 1 }, clientX: { value: 47 },
    })
    wrapper.element.dispatchEvent(event)

    expect(wrapper.emitted('preview')).toEqual([[50]])
  })
})
