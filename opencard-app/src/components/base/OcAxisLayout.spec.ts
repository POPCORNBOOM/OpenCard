import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import OcAxisLayout, { type AxisRegion } from './OcAxisLayout.vue'

describe('OcAxisLayout', () => {
  it('renders regions in declaration order', () => {
    const regions: AxisRegion[] = [
      { slot: 'right', track: '120px' },
      { slot: 'left', track: '80px' },
      { slot: 'center', track: '*' },
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

  it('maps horizontal tracks and star syntax to grid template columns', () => {
    const wrapper = mount(OcAxisLayout, {
      props: {
        axis: 'horizontal',
        regions: [
          { slot: 'left', track: '80px' },
          { slot: 'main', track: '*' },
          { slot: 'preview', track: '3*' },
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
    expect(style).toContain('grid-template-columns: 80px minmax(0, 1fr) minmax(0, 3fr) auto;')
    expect(style).toContain('grid-template-rows: minmax(0, 1fr);')
  })

  it('maps vertical tracks to grid template rows', () => {
    const wrapper = mount(OcAxisLayout, {
      props: {
        axis: 'vertical',
        regions: [
          { slot: 'top', track: '48px' },
          { slot: 'content', track: '*' },
          { slot: 'bottom', track: '36px' },
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
          { slot: 'right', track: '*' },
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
          { slot: 'left', track: '72px' },
          { slot: 'missing', track: '*' },
          { slot: 'right', track: '96px' },
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
      { slot: 'missing', track: '*' },
    ])
  })

  it('falls back to auto when star track weight is invalid', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const wrapper = mount(OcAxisLayout, {
      props: {
        regions: [
          { slot: 'left', track: '0*' },
          { slot: 'right', track: '*' },
        ],
      },
      slots: {
        left: '<div>left</div>',
        right: '<div>right</div>',
      },
    })

    expect(wrapper.attributes('style')).toContain('grid-template-columns: auto minmax(0, 1fr);')
    expect(warnSpy).toHaveBeenCalledWith(
      '[OcAxisLayout] track "0*" is invalid, fallback to "auto"',
      { slot: 'left', track: '0*' },
    )
  })

  it('supports fill and non-interactive layout states', () => {
    const wrapper = mount(OcAxisLayout, {
      props: {
        fill: true,
        interactive: false,
        regions: [
          { slot: 'content', track: '*' },
        ],
      },
      slots: {
        content: '<div>content</div>',
      },
    })

    expect(wrapper.classes()).toContain('is-fill')
    expect(wrapper.classes()).toContain('is-non-interactive')
  })
})
