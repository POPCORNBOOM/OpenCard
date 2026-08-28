import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { RenderReadySimpleContainerBlock } from '../render.types'
import SimpleContainerBlockRenderer from './SimpleContainerBlockRenderer.vue'
import { rendererTestGlobal } from './renderTestUtils'

describe('SimpleContainerBlockRenderer', () => {
  it('clips children at the container edge when enabled', () => {
    const block = {
      type: 'simple-container-block',
      id: 'simple',
      clip: true,
      width: '300px',
      height: '200px',
      visible: true,
      name: 'Simple',
      notes: '',
      borderColor: '#000000',
      borderWidth: 0,
      borderStyle: 'solid',
      borderRadius: '',
      background: '',
      translateX: '0px',
      translateY: '0px',
      scaleX: 1,
      scaleY: 1,
      transformAnchor: 'cc',
      zIndex: 0,
      rotation: 0,
      opacity: 1,
      customCss: '',
      children: [],
    } as RenderReadySimpleContainerBlock
    const wrapper = mount(SimpleContainerBlockRenderer, {
      props: { block, placement: { kind: 'root' } },
      global: rendererTestGlobal,
    })

    expect(wrapper.get('[data-block-id="simple"]').attributes('style')).toContain('overflow: hidden')
  })

  it('preserves absolute placement instead of replacing it with container positioning', () => {
    const block = {
      type: 'simple-container-block',
      id: 'nested-simple',
      clip: false,
      width: '300px',
      height: '200px',
      visible: true,
      name: 'Nested Simple',
      notes: '',
      borderColor: '#000000',
      borderWidth: 0,
      borderStyle: 'solid',
      borderRadius: '',
      background: '',
      translateX: '0px',
      translateY: '0px',
      scaleX: 1,
      scaleY: 1,
      transformAnchor: 'cc',
      zIndex: 0,
      rotation: 0,
      opacity: 1,
      customCss: '',
      children: [],
    } as RenderReadySimpleContainerBlock
    const wrapper = mount(SimpleContainerBlockRenderer, {
      props: {
        block,
        placement: {
          kind: 'absolute',
          location: { id: 'location', type: 'simple-container-location', anchor: 'lt', x: '40px', y: '60px' },
        },
      },
      global: rendererTestGlobal,
    })

    const style = wrapper.get('[data-block-id="nested-simple"]').attributes('style')
    expect(style).toContain('position: absolute')
    expect(style).toContain('left: 40px')
    expect(style).toContain('top: 60px')
    expect(style).not.toContain('position: relative')
  })
})
