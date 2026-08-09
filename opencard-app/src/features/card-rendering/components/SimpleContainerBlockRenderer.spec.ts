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
      props: { block },
      global: rendererTestGlobal,
    })

    expect(wrapper.get('[data-block-id="simple"]').attributes('style')).toContain('overflow: hidden')
  })
})
