import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcOverlayToolbar from './OcOverlayToolbar.vue'

describe('OcOverlayToolbar', () => {
  it('renders action, text and divider items from one viewmodel and emits intent', async () => {
    const wrapper = mount(OcOverlayToolbar, {
      props: {
        orientation: 'vertical',
        items: [
          { key: 'zoom-in', icon: 'tool.zoom-in', title: 'Zoom in' },
          '100%',
          { type: 'divider', key: 'viewport-actions' },
          { key: 'toggle-grid', icon: 'tool.grid', title: 'Grid', active: true },
        ],
      },
    })

    expect(wrapper.classes()).toContain('oc-overlay-toolbar--vertical')
    expect(wrapper.findAll('.oc-overlay-toolbar__text').map(node => node.text())).toEqual(['100%'])
    expect(wrapper.findAll('[role="separator"]').length).toBe(1)
    expect(wrapper.get('button[aria-label="Grid"]').attributes('aria-pressed')).toBe('true')

    await wrapper.get('button[aria-label="Grid"]').trigger('click')
    expect(wrapper.emitted('select')).toEqual([[{ key: 'toggle-grid' }]])
  })
})
