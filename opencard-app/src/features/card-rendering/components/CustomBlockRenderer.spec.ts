import { mount } from '@vue/test-utils'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'
import enUS from '../../../locales/en-US'
import type { RenderReadyCustomBlock, RenderReadyTextBlock } from '../render.types'
import { cardEditorContextKey } from './cardEditorContext'
import CustomBlockRenderer from './CustomBlockRenderer.vue'

function createBlock(content: RenderReadyTextBlock | null): RenderReadyCustomBlock {
  return {
    id: 'host',
    type: 'custom-block',
    name: 'Badge',
    customBlockKey: 'private-package',
    width: '100px',
    height: '50px',
    content,
  } as unknown as RenderReadyCustomBlock
}

function mountRenderer(block: RenderReadyCustomBlock) {
  return mount(CustomBlockRenderer, {
    props: { block, layoutMode: 'static' },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })],
      provide: {
        [cardEditorContextKey as symbol]: {
          transformDisabledBlockIds: computed(() => new Set<string>()),
          handleBlockClick: vi.fn(),
          resolveAssetSrc: (source: string) => source,
        },
      },
      stubs: {
        OcIcon: true,
        NativeBlockRenderer: {
          props: ['block'],
          template: '<div class="native-content" />',
        },
      },
    },
  })
}

describe('CustomBlockRenderer', () => {
  it('shows a sanitized host placeholder without package internals', () => {
    const wrapper = mountRenderer(createBlock(null))
    expect(wrapper.attributes('role')).toBe('alert')
    expect(wrapper.text()).toContain('Custom block unavailable')
    expect(wrapper.text()).not.toContain('private-package')
    expect(wrapper.text()).not.toContain('private-interface-hash')
    expect(wrapper.find('code').exists()).toBe(false)
  })

  it('renders expanded native content through the shared renderer', () => {
    const content = {
      id: 'host', type: 'text-block', name: 'Text', content: 'Ready', width: '100px', height: '50px',
    } as RenderReadyTextBlock
    const wrapper = mountRenderer(createBlock(content))
    expect(wrapper.find('.native-content').exists()).toBe(true)
    expect(wrapper.classes()).not.toContain('is-error')
  })
})
