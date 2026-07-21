import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { TextBlock as TextBlockModel } from '../../../entities/card/model'
import TextBlockRenderer from './TextBlockRenderer.vue'
import { parseRenderReadyBlockForTest, rendererTestGlobal } from './renderTestUtils'

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
})
