import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { ImageBlock as ImageBlockModel } from '../../entities/card/model'
import ImageBlockRenderer from './ImageBlockRenderer.vue'
import { parseRenderReadyBlockForTest, rendererTestGlobal } from './renderTestUtils'
import type { RenderReadyImageBlock } from './render.types'

vi.mock('../../features/workspace/store/projectStore', () => ({
  useProjectStore: () => ({ resolveAssetSrc: (path: string) => path }),
}))

function createBlock(image: string, fit: ImageBlockModel['fit'] = 'contain'): RenderReadyImageBlock {
  return parseRenderReadyBlockForTest({
    id: 'image-block-test',
    name: 'Test image',
    type: 'image-block',
    image,
    fit,
  })
}

describe('ImageBlockRenderer', () => {
  it.each(['cover', 'contain', 'fill'] as const)('projects the %s fit mode onto the image', (fit) => {
    const wrapper = mount(ImageBlockRenderer, {
      props: { block: createBlock('/image.png', fit), layoutMode: 'static' },
      global: rendererTestGlobal,
    })

    expect((wrapper.get('.image-block__image').element as HTMLImageElement).style.objectFit).toBe(fit)
  })

  it('replaces the native broken-image state and retries when the source changes', async () => {
    const wrapper = mount(ImageBlockRenderer, {
      props: { block: createBlock('/missing.png'), layoutMode: 'static' },
      global: rendererTestGlobal,
    })

    expect(wrapper.get('.image-block__image').classes()).not.toContain('is-loaded')
    await wrapper.get('.image-block__image').trigger('error')
    expect(wrapper.get('[aria-label="图片加载失败"]')).toBeDefined()

    await wrapper.setProps({ block: createBlock('/available.png') })
    await wrapper.get('.image-block__image').trigger('load')
    expect(wrapper.find('.image-block__placeholder').exists()).toBe(false)
    expect(wrapper.get('.image-block__image').classes()).toContain('is-loaded')
  })
})
