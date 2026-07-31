import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { QrCodeBlock as QrCodeBlockModel } from '../../../entities/card/model'
import QrCodeBlockRenderer from './QrCodeBlockRenderer.vue'
import { parseRenderReadyBlockForTest, rendererTestGlobal } from './renderTestUtils'
import type { RenderReadyQrCodeBlock } from '../render.types'

function createBlock(content: string): RenderReadyQrCodeBlock {
  const block: QrCodeBlockModel = {
    id: 'qr-test',
    name: 'QR test',
    type: 'qrcode-block',
    content,
    errorCorrection: 'H',
    foreground: '#112233',
    backgroundColor: '#FDFDFD',
    quietZone: '2',
  }
  return parseRenderReadyBlockForTest(block)
}

describe('QrCodeBlockRenderer', () => {
  it('shows an OC placeholder for empty content', () => {
    const wrapper = mount(QrCodeBlockRenderer, {
      props: { block: createBlock(''), layoutMode: 'static' },
      global: rendererTestGlobal,
    })

    expect(wrapper.get('[aria-label="未配置二维码内容"]')).toBeDefined()
    expect(wrapper.find('.qrcode-block__graphic').exists()).toBe(false)
  })

  it('generates a square SVG using the configured QR semantics', async () => {
    const wrapper = mount(QrCodeBlockRenderer, {
      props: { block: createBlock('https://opencard.local/card/42'), layoutMode: 'static' },
      global: rendererTestGlobal,
    })

    await vi.waitFor(() => expect(wrapper.find('.qrcode-block__graphic svg').exists()).toBe(true))
    const svg = wrapper.get('.qrcode-block__graphic svg')
    expect(svg.attributes('viewBox')).toMatch(/^0 0 \d+ \d+$/)
    expect(wrapper.get('path[stroke]').attributes('stroke')).toBe('#112233')
    expect(wrapper.get('path[fill]').attributes('fill')).toBe('#FDFDFD')
  })

  it('keeps the rendered graphic when only zIndex changes', async () => {
    const wrapper = mount(QrCodeBlockRenderer, {
      props: { block: createBlock('https://opencard.local/card/42'), layoutMode: 'static' },
      global: rendererTestGlobal,
    })

    await vi.waitFor(() => expect(wrapper.find('.qrcode-block__graphic svg').exists()).toBe(true))
    await wrapper.setProps({ block: { ...wrapper.props('block'), zIndex: 7 } })

    expect(wrapper.find('.qrcode-block__graphic svg').exists()).toBe(true)
    expect(wrapper.find('.qrcode-block__placeholder').exists()).toBe(false)
  })
})
