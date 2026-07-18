import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { ImageBlock as ImageBlockModel } from '../../entities/card/model'
import ImageBlock from './ImageBlock.vue'

vi.mock('../../features/workspace/store/projectStore', () => ({
  useProjectStore: () => ({ resolveAssetSrc: (path: string) => path }),
}))

function createBlock(image: string, fit: ImageBlockModel['fit'] = 'contain'): ImageBlockModel {
  return {
    id: 'image-block-test',
    name: 'Test image',
    type: 'image-block',
    image,
    fit,
  }
}

describe('ImageBlock', () => {
  it.each(['cover', 'contain', 'fill'] as const)('projects the %s fit mode onto the image', (fit) => {
    const wrapper = mount(ImageBlock, {
      props: { block: createBlock('/image.png', fit), layoutMode: 'static' },
    })

    expect((wrapper.get('.image-block__image').element as HTMLImageElement).style.objectFit).toBe(fit)
  })

  it('replaces the native broken-image state and retries when the source changes', async () => {
    const wrapper = mount(ImageBlock, {
      props: { block: createBlock('/missing.png'), layoutMode: 'static' },
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
