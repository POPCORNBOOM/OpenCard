import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import OcAxisLayout, { type AxisRegion } from './OcAxisLayout.vue'

describe('OcAxisLayout', () => {
  it('renders regions in declaration order', () => {
    const regions: AxisRegion[] = [
      { slot: 'right', track: 'size-xl' },
      { slot: 'left', track: 'size-md' },
      { slot: 'center', track: 'fill' },
    ]

    const wrapper = mount(OcAxisLayout, {
      props: {
        axis: 'horizontal',
        regions,
      },
      slots: {
        left: '<div>left</div>',
        center: '<div>center</div>',
        right: '<div>right</div>',
      },
    })

    const regionTexts = wrapper.findAll('.oc-axis-layout__region').map((node) => node.text())
    expect(regionTexts).toEqual(['right', 'left', 'center'])
  })

  it('exposes stable region semantic hooks bound to slot names', () => {
    const wrapper = mount(OcAxisLayout, {
      props: {
        regions: [
          { slot: 'Left-Pane', track: 'size-md' },
          { slot: 'Main_Content', track: 'fill' },
        ],
      },
      slots: {
        'Left-Pane': '<div>left</div>',
        Main_Content: '<div>main</div>',
      },
    })

    const regions = wrapper.findAll('.oc-axis-layout__region')
    expect(regions).toHaveLength(2)

    expect(regions[0].attributes('data-slot')).toBe('Left-Pane')
    expect(regions[0].classes()).toContain('oc-axis-layout__region')
    expect(regions[0].classes()).toContain('oc-axis-layout__region--slot-left-pane')

    expect(regions[1].attributes('data-slot')).toBe('Main_Content')
    expect(regions[1].classes()).toContain('oc-axis-layout__region')
    expect(regions[1].classes()).toContain('oc-axis-layout__region--slot-main_content')
  })

  it('maps horizontal track tokens to grid template columns', () => {
    const wrapper = mount(OcAxisLayout, {
      props: {
        axis: 'horizontal',
        regions: [
          { slot: 'left', track: 'size-md' },
          { slot: 'main', track: 'fill' },
          { slot: 'preview', track: 'fill-3' },
          { slot: 'right', track: 'auto' },
        ],
      },
      slots: {
        left: '<div>left</div>',
        main: '<div>main</div>',
        preview: '<div>preview</div>',
        right: '<div>right</div>',
      },
    })

    const style = wrapper.attributes('style')
    expect(style).toContain('grid-template-columns: 72px minmax(0, 1fr) minmax(0, 3fr) auto;')
    expect(style).toContain('grid-template-rows: minmax(0, 1fr);')
  })

  it('maps vertical track tokens to grid template rows', () => {
    const wrapper = mount(OcAxisLayout, {
      props: {
        axis: 'vertical',
        regions: [
          { slot: 'top', track: 'size-sm' },
          { slot: 'content', track: 'fill' },
          { slot: 'bottom', track: 'size-xs' },
        ],
      },
      slots: {
        top: '<div>top</div>',
        content: '<div>content</div>',
        bottom: '<div>bottom</div>',
      },
    })

    const style = wrapper.attributes('style')
    expect(style).toContain('grid-template-rows: 48px minmax(0, 1fr) 36px;')
    expect(style).toContain('grid-template-columns: minmax(0, 1fr);')
  })

  it('defaults track to auto when omitted', () => {
    const wrapper = mount(OcAxisLayout, {
      props: {
        axis: 'horizontal',
        regions: [
          { slot: 'left' },
          { slot: 'right' },
        ],
      },
      slots: {
        left: '<div>left</div>',
        right: '<div>right</div>',
      },
    })

    expect(wrapper.attributes('style')).toContain('grid-template-columns: auto auto;')
  })

  it('adds max-content guard style for auto tracks', () => {
    const wrapper = mount(OcAxisLayout, {
      props: {
        axis: 'horizontal',
        regions: [
          { slot: 'left', track: 'auto' },
          { slot: 'right', track: 'fill' },
        ],
      },
      slots: {
        left: '<div>left</div>',
        right: '<div>right</div>',
      },
    })

    const regions = wrapper.findAll('.oc-axis-layout__region')
    expect(regions[0].attributes('style')).toContain('min-width: max-content;')
    expect(regions[1].attributes('style')).toBeUndefined()
  })

  it('filters missing slots with warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const wrapper = mount(OcAxisLayout, {
      props: {
        regions: [
          { slot: 'left', track: 'size-md' },
          { slot: 'missing', track: 'fill' },
          { slot: 'right', track: 'size-lg' },
        ],
      },
      slots: {
        left: '<div>left</div>',
        right: '<div>right</div>',
      },
    })

    const regionTexts = wrapper.findAll('.oc-axis-layout__region').map((node) => node.text())
    expect(regionTexts).toEqual(['left', 'right'])

    const axisWarnings = warnSpy.mock.calls.filter(([message]) => (
      typeof message === 'string' && message.startsWith('[OcAxisLayout]')
    ))
    expect(axisWarnings).toContainEqual([
      '[OcAxisLayout] slot "missing" is not provided',
      { slot: 'missing', track: 'fill' },
    ])
  })

  it('falls back to auto when track token is invalid', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const invalidRegion = { slot: 'left', track: 'legacy-px' } as unknown as AxisRegion
    const wrapper = mount(OcAxisLayout, {
      props: {
        regions: [
          invalidRegion,
          { slot: 'right', track: 'fill' },
        ],
      },
      slots: {
        left: '<div>left</div>',
        right: '<div>right</div>',
      },
    })

    expect(wrapper.attributes('style')).toContain('grid-template-columns: auto minmax(0, 1fr);')
    expect(warnSpy).toHaveBeenCalledWith(
      '[OcAxisLayout] track token "legacy-px" is invalid, fallback to "auto"',
      invalidRegion,
    )
  })

  it('supports fill and non-interactive layout states', () => {
    const wrapper = mount(OcAxisLayout, {
      props: {
        fill: true,
        interactive: false,
        regions: [
          { slot: 'content', track: 'fill' },
        ],
      },
      slots: {
        content: '<div>content</div>',
      },
    })

    expect(wrapper.classes()).toContain('is-fill')
    expect(wrapper.classes()).toContain('is-non-interactive')
  })

  it('maps spacing token to semantic class', () => {
    const wrapper = mount(OcAxisLayout, {
      props: {
        spacing: 'loose',
        regions: [
          { slot: 'content', track: 'fill' },
        ],
      },
      slots: {
        content: '<div>content</div>',
      },
    })

    expect(wrapper.classes()).toContain('oc-axis-layout--spacing-loose')
  })
})
