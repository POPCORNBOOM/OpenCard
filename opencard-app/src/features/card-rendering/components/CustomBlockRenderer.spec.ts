import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { cardEditorContextKey } from './cardEditorContext'
import CustomBlockRenderer from './CustomBlockRenderer.vue'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'
import { parseRenderReadyBlockForTest } from './renderTestUtils'
import { createBlock } from '../../../entities/card/model'

describe('CustomBlockRenderer', () => {
  it('renders a static custom block without dropping its content', () => {
    const content = parseRenderReadyBlockForTest(createBlock('shape-block', { id: 'badge' }))
    const block = {
      ...content,
      type: 'custom-block' as const,
      customBlockKey: 'badge',
      content,
    }
    const i18n = createI18n({ legacy: false, locale: 'en-US', messages: {
      'en-US': { cardDesigner: { customBlock: { unavailable: 'Unavailable' } } },
    } })
    const wrapper = mount(CustomBlockRenderer, {
      props: { block, layoutMode: 'static' },
      global: {
        plugins: [i18n],
        provide: { [cardEditorContextKey as symbol]: {
          transformDisabledBlockIds: computed(() => new Set<string>()),
          handleBlockClick: () => undefined,
          resolveAssetSrc: (path: string) => path,
          resolveFontFamily: (value: string) => value,
          customBlockCatalog: computed(() => new Map()),
        } },
      },
    })
    expect(wrapper.find('.shape-block__svg').exists()).toBe(true)
  })
})
