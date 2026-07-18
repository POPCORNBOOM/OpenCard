import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { TextBlock as TextBlockModel } from '../../entities/card/model'
import TextBlock from './TextBlock.vue'

describe('TextBlock', () => {
  it('preserves plain-text line breaks without parsing HTML', () => {
    const block: TextBlockModel = {
      id: 'plain-text-block',
      type: 'text-block',
      content: 'first line\n<strong>second line</strong>',
      mode: 'plain',
    }

    const wrapper = mount(TextBlock, {
      props: { block, layoutMode: 'static' },
    })
    const content = wrapper.get('.text-block-content--plain')

    expect(content.text()).toBe(block.content)
    expect(content.find('strong').exists()).toBe(false)
  })

  it('keeps horizontal text alignment independent from vertical content alignment', () => {
    const block: TextBlockModel = {
      id: 'text-block-test',
      type: 'text-block',
      content: 'A paragraph long enough to exercise text layout.',
      mode: 'plain',
      textAlign: 'justify',
      verticalAlign: 'bottom',
    }

    const wrapper = mount(TextBlock, {
      props: { block, layoutMode: 'static' },
    })
    const style = wrapper.element.style

    expect(style.display).toBe('flex')
    expect(style.flexDirection).toBe('column')
    expect(style.justifyContent).toBe('flex-end')
    expect(style.textAlign).toBe('justify')
  })
})
