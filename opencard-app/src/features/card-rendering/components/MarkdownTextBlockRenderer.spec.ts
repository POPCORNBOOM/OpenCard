import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MarkdownTextBlockRenderer from './MarkdownTextBlockRenderer.vue'
import { parseRenderReadyBlockForTest, rendererTestGlobal } from './renderTestUtils'

describe('MarkdownTextBlockRenderer', () => {
  it('renders Markdown structure from source content', () => {
    const block = parseRenderReadyBlockForTest({
      id: 'markdown-text-block',
      type: 'markdown-text-block',
      content: '# Sentinel\n\n**Power:** 5\n\n- Guard\n- Counter',
    })

    const wrapper = mount(MarkdownTextBlockRenderer, {
      props: { block, layoutMode: 'static' },
      global: rendererTestGlobal,
    })
    const content = wrapper.get('.markdown-text-block-content')

    expect(content.get('h1').text()).toBe('Sentinel')
    expect(content.get('strong').text()).toBe('Power:')
    expect(content.findAll('li').map(item => item.text())).toEqual(['Guard', 'Counter'])
  })

  it('rejects raw HTML and resolves Markdown images through the project asset protocol', () => {
    const block = parseRenderReadyBlockForTest({
      id: 'safe-markdown-text-block',
      type: 'markdown-text-block',
      content: '<script>alert(1)</script>\n\n![Portrait](assets/portrait.png){width=40% height=160px fit=cover align=center onclick=alert(1)}',
    })

    const wrapper = mount(MarkdownTextBlockRenderer, {
      props: { block, layoutMode: 'static' },
      global: rendererTestGlobal,
    })
    const content = wrapper.get('.markdown-text-block-content')

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

  it('drops attributes from non-image Markdown elements and rejects unsafe image values', () => {
    const block = parseRenderReadyBlockForTest({
      id: 'restricted-markdown-attributes',
      type: 'markdown-text-block',
      content: '# Heading {width=20px}\n\n![Portrait](assets/portrait.png){width="100%;color:red" fit=unknown align=outside}',
    })

    const wrapper = mount(MarkdownTextBlockRenderer, {
      props: { block, layoutMode: 'static' },
      global: rendererTestGlobal,
    })
    const content = wrapper.get('.markdown-text-block-content')

    expect(content.get('h1').attributes('width')).toBeUndefined()
    expect(content.get('img').attributes('style')).toBeUndefined()
  })
})
