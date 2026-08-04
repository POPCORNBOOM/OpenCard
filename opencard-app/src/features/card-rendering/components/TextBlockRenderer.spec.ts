import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { TextBlock as TextBlockModel } from '../../../entities/card/model'
import TextBlockRenderer from './TextBlockRenderer.vue'
import { setProjectFonts } from '../../workspace/model/projectFonts'
import { parseRenderReadyBlockForTest, rendererTestGlobal } from './renderTestUtils'

describe('TextBlockRenderer', () => {
  it('promotes plain-text line breaks to rich-text paragraphs', () => {
    const block = parseRenderReadyBlockForTest({
      id: 'multiline-text-block',
      type: 'text-block',
      content: 'first line\nsecond line',
    })

    const wrapper = mount(TextBlockRenderer, {
      props: { block, layoutMode: 'static' },
      global: rendererTestGlobal,
    })

    expect(wrapper.findAll('.text-block-content--richtext p').map(paragraph => paragraph.text()))
      .toEqual(['first line', 'second line'])
  })

  it('renders content through the rich-text contract', () => {
    const source: TextBlockModel = {
      id: 'rich-text-block',
      type: 'text-block',
      content: '<p style="text-align: center">first <strong>second</strong></p>',
    }
    const block = parseRenderReadyBlockForTest(source)

    const wrapper = mount(TextBlockRenderer, {
      props: { block, layoutMode: 'static' },
      global: rendererTestGlobal,
    })
    const content = wrapper.get('.text-block-content--richtext')

    expect(content.get('p').attributes('style')).toContain('text-align: center')
    expect(content.get('strong').text()).toBe('second')
  })

  it('renders underline and strikethrough marks', () => {
    const block = parseRenderReadyBlockForTest({
      id: 'decorated-rich-text-block',
      type: 'text-block',
      content: '<p><u>Underline</u> <s>Strike</s></p>',
    })

    const wrapper = mount(TextBlockRenderer, {
      props: { block, layoutMode: 'static' },
      global: rendererTestGlobal,
    })
    const content = wrapper.get('.text-block-content--richtext')

    expect(content.get('u').text()).toBe('Underline')
    expect(content.get('s').text()).toBe('Strike')
  })

  it('keeps horizontal text alignment independent from vertical content alignment', () => {
    const source: TextBlockModel = {
      id: 'text-block-test',
      type: 'text-block',
      content: 'A paragraph long enough to exercise text layout.',
      textAlign: 'justify',
      verticalAlign: 'bottom',
    }
    const block = parseRenderReadyBlockForTest(source)

    const wrapper = mount(TextBlockRenderer, {
      props: { block, layoutMode: 'static' },
      global: rendererTestGlobal,
    })
    const style = wrapper.element.style

    expect(style.display).toBe('flex')
    expect(style.flexDirection).toBe('column')
    expect(style.justifyContent).toBe('flex-end')
    expect(style.textAlign).toBe('justify')
  })

  it('renders semicolon-separated project and system font fallbacks', () => {
    setProjectFonts([{ key: 'brand-sans', name: 'Brand Sans', source: 'BrandSans.woff2' }])
    const block = parseRenderReadyBlockForTest({
      id: 'project-font-block',
      type: 'text-block',
      content: 'Brand text',
      fontFamily: 'font:brand-sans; Microsoft YaHei; sans-serif',
    })

    const wrapper = mount(TextBlockRenderer, {
      props: { block, layoutMode: 'static' },
      global: rendererTestGlobal,
    })

    expect(wrapper.element.style.fontFamily)
      .toBe('"OpenCardProjectFont-brand-sans", "Microsoft YaHei", sans-serif')
  })

  it('removes executable markup and unsupported rich-text styles', () => {
    const block = parseRenderReadyBlockForTest({
      id: 'safe-rich-text-block',
      type: 'text-block',
      content: '<script>alert(1)</script><p onclick="alert(1)" style="color: red; position: fixed">Safe <span style="font-family: Impact; background-image: url(x)">text</span></p>',
    })

    const wrapper = mount(TextBlockRenderer, {
      props: { block, layoutMode: 'static' },
      global: rendererTestGlobal,
    })
    const content = wrapper.get('.text-block-content--richtext')

    expect(content.find('script').exists()).toBe(false)
    expect(content.get('p').attributes('onclick')).toBeUndefined()
    expect(content.get('p').attributes('style')).toBe('color: red;')
    expect(content.get('span').attributes('style')).toBe('font-family: Impact;')
  })

  it('preserves only the controlled binding attribute on rich-text spans', () => {
    const block = parseRenderReadyBlockForTest({
      id: 'binding-rich-text-block',
      type: 'text-block',
      content: '<p><span data-oc-binding=" self:name " data-other="unsafe" onclick="alert(1)">OpenCard</span></p>',
    })

    const wrapper = mount(TextBlockRenderer, {
      props: { block, layoutMode: 'static' },
      global: rendererTestGlobal,
    })
    const binding = wrapper.get('[data-oc-binding]')

    expect(binding.attributes('data-oc-binding')).toBe('self:name')
    expect(binding.attributes('data-other')).toBeUndefined()
    expect(binding.attributes('onclick')).toBeUndefined()
  })
})
