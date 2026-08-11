import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createBlock } from '../../../entities/card/model'
import { createCardRenderResourceContext } from '../cardRenderResources'
import type { RenderReadyCardFace } from '../render.types'
import CardFaceRenderer from './CardFaceRenderer.vue'
import { parseRenderReadyBlockForTest } from './renderTestUtils'

describe('CardFaceRenderer resources', () => {
  it('does not expose package-local image keys to an ordinary native block', () => {
    const image = parseRenderReadyBlockForTest(createBlock('image-block', {
      id: 'picture',
      image: 'resource:image:a',
    }))
    const face: RenderReadyCardFace = {
      type: 'card-face', id: 'front', faceKey: 'front', width: 100, height: 100,
      background: '#fff',
      children: [{
        block: image,
        location: { id: 'location', type: 'simple-container-location', anchor: 'lt', x: '0px', y: '0px' },
      }],
    }
    const resourceContext = createCardRenderResourceContext({
      customBlockCatalog: new Map([['picture', {
        manifest: {
          customBlockKey: 'picture', publicFieldKeys: [],
          resize: { widthLocked: false, heightLocked: false },
          resources: { images: [{ key: 'a', source: 'resources/images/a.png' }] },
        },
        block: {},
        resourceUrls: new Map([['resources/images/a.png', 'blob:controlled-renderer']]),
      }]]),
    })

    const wrapper = mount(CardFaceRenderer, { props: { face, resourceContext } })

    expect(wrapper.find('img').exists()).toBe(false)
  })
})
