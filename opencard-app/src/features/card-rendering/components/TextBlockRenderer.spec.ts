import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { TextBlock as TextBlockModel } from '../../../entities/card/model'
import TextBlockRenderer from './TextBlockRenderer.vue'
import { parseRenderReadyBlockForTest, rendererTestGlobal } from './renderTestUtils'

vi.mock('../../workspace/store/projectStore', () => ({
  useProjectStore: () => ({ resolveAssetSrc: (path: string) => `asset://${path}` }),
}))

describe('TextBlockRenderer', () => {
  it('preserves plain-text line breaks without parsing HTML', () => {
    const source: TextBlockModel = {
      id: 'plain-text-block',
      type: 'text-block',
      content: 'first line\n<strong>second line</strong>',
      mode: 'plain',
    }
    const block = parseRenderReadyBlockForTest(source)

    const wrapper = mount(TextBlockRenderer, {
      props: { block, layoutMode: 'static' },
      global: rendererTestGlobal,
    })
    const content = wrapper.get('.text-block-content--plain')

    expect(content.text()).toBe(block.content)
    expect(content.find('strong').exists()).toBe(false)
  })

  it('keeps horizontal text alignment independent from vertical content alignment', () => {
    const source: TextBlockModel = {
      id: 'text-block-test',
      type: 'text-block',
      content: 'A paragraph long enough to exercise text layout.',
      mode: 'plain',
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

  it('renders Markdown structure after bindings have produced the final content', () => {
    const block = parseRenderReadyBlockForTest({
      id: 'markdown-text-block',
      type: 'text-block',
      mode: 'markdown',
      content: '# Sentinel\n\n**Power:** 5\n\n- Guard\n- Counter',
    })

    const wrapper = mount(TextBlockRenderer, {
      props: { block, layoutMode: 'static' },
      global: rendererTestGlobal,
    })
    const content = wrapper.get('.text-block-content--markdown')

    expect(content.get('h1').text()).toBe('Sentinel')
    expect(content.get('strong').text()).toBe('Power:')
    expect(content.findAll('li').map((item) => item.text())).toEqual(['Guard', 'Counter'])
  })

  it('rejects raw HTML and resolves Markdown images through the project asset protocol', () => {
    const block = parseRenderReadyBlockForTest({
      id: 'safe-markdown-text-block',
      type: 'text-block',
      mode: 'markdown',
      content: '<script>alert(1)</script>\n\n![Portrait](assets/portrait.png){width=40% height=160px fit=cover align=center onclick=alert(1)}',
    })

    const wrapper = mount(TextBlockRenderer, {
      props: { block, layoutMode: 'static' },
      global: rendererTestGlobal,
    })
    const content = wrapper.get('.text-block-content--markdown')

    expect(content.find('script').exists()).toBe(false)
    expect(content.text()).toContain('<script>alert(1)</script>')
    const image = content.get('img')
    expect(image.attributes('src')).toBe('asset://assets/portrait.png')
    expect(image.attributes('alt')).toBe('Portrait')
    const imageStyle = (image.element as HTMLImageElement).style
    expect(imageStyle.width).toBe('40%')
    expect(imageStyle.height).toBe('160px')
    expect(imageStyle.objectFit).toBe('cover')
    expect(imageStyle.display).toBe('block')
    expect(imageStyle.marginInline).toBe('auto')
    expect(image.attributes('onclick')).toBeUndefined()
  })

  it('drops image attributes from other Markdown elements and rejects unsafe values', () => {
    const block = parseRenderReadyBlockForTest({
      id: 'restricted-markdown-attributes',
      type: 'text-block',
      mode: 'markdown',
      content: '# Heading {width=20px}\n\n![Portrait](assets/portrait.png){width="100%;color:red" fit=unknown align=outside}',
    })

    const wrapper = mount(TextBlockRenderer, {
      props: { block, layoutMode: 'static' },
      global: rendererTestGlobal,
    })
    const content = wrapper.get('.text-block-content--markdown')

    expect(content.get('h1').attributes('width')).toBeUndefined()
    expect(content.get('img').attributes('style')).toBeUndefined()
  })
})
