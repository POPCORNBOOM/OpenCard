import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { QRCodeBlock as QRCodeBlockModel } from '../../entities/card/model'
import QRCodeBlockRenderer from './QRCodeBlockRenderer.vue'

function createBlock(content: string): QRCodeBlockModel {
  return {
    id: 'qr-test',
    name: 'QR test',
    type: 'qrcode-block',
    content,
    errorCorrection: 'H',
    foreground: '#112233',
    backgroundColor: '#FDFDFD',
    quietZone: 2,
  }
}

describe('QRCodeBlockRenderer', () => {
  it('shows an OC placeholder for empty content', () => {
    const wrapper = mount(QRCodeBlockRenderer, {
      props: { block: createBlock(''), layoutMode: 'static' },
    })

    expect(wrapper.get('[aria-label="未配置二维码内容"]')).toBeDefined()
    expect(wrapper.find('.qrcode-block__graphic').exists()).toBe(false)
  })

  it('generates a square SVG using the configured QR semantics', async () => {
    const wrapper = mount(QRCodeBlockRenderer, {
      props: { block: createBlock('https://opencard.local/card/42'), layoutMode: 'static' },
    })

    await vi.waitFor(() => expect(wrapper.find('.qrcode-block__graphic svg').exists()).toBe(true))
    const svg = wrapper.get('.qrcode-block__graphic svg')
    expect(svg.attributes('viewBox')).toMatch(/^0 0 \d+ \d+$/)
    expect(wrapper.get('path[stroke]').attributes('stroke')).toBe('#112233')
    expect(wrapper.get('path[fill]').attributes('fill')).toBe('#FDFDFD')
  })
})
