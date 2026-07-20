import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { ShapeBlock as ShapeBlockModel } from '../../entities/card/model'
import ShapeBlockRenderer from './ShapeBlockRenderer.vue'
import { parseRenderReadyBlockForTest, rendererTestGlobal } from './renderTestUtils'
import type { RenderReadyShapeBlock } from './render.types'

function createBlock(shape: ShapeBlockModel['shape']): RenderReadyShapeBlock {
  return parseRenderReadyBlockForTest({
    id: `shape-${shape}`,
    type: 'shape-block',
    shape,
    fill: '#123456',
    stroke: '#ABCDEF',
    strokeWidth: '3',
    strokeStyle: 'dashed',
    strokeAlignment: 'center',
    strokeJoin: 'miter',
    strokeCap: 'butt',
    strokeMiterLimit: '4',
  })
}

describe('ShapeBlockRenderer', () => {
  it.each([
    ['rectangle', 'M0 0H100V100H0Z'],
    ['ellipse', 'M50 0A50 50 0 1 1 50 100A50 50 0 1 1 50 0Z'],
    ['triangle', 'M50 0L100 100H0Z'],
    ['diamond', 'M50 0L100 50L50 100L0 50Z'],
  ] as const)('renders %s as a full-boundary closed path', (shape, pathData) => {
    const wrapper = mount(ShapeBlockRenderer, {
      props: { block: createBlock(shape), layoutMode: 'static' },
      global: rendererTestGlobal,
    })

    expect(wrapper.get('.shape-block__fill').attributes('d')).toBe(pathData)
    expect(wrapper.get('.shape-block__stroke').attributes('d')).toBe(pathData)
    expect(wrapper.get('.shape-block__stroke').attributes('style')).toContain('stroke-dasharray: 8 5')
  })

  it('renders line across the full viewBox width', () => {
    const wrapper = mount(ShapeBlockRenderer, {
      props: { block: createBlock('line'), layoutMode: 'static' },
      global: rendererTestGlobal,
    })

    expect(wrapper.get('line').attributes()).toMatchObject({
      x1: '0',
      y1: '50',
      x2: '100',
      y2: '50',
    })
    expect(wrapper.get('line').attributes('style')).toContain('stroke-dasharray: 8 5')
  })
  it.each([
    ['inside', 'clip-path'],
    ['outside', 'mask'],
  ] as const)('simulates %s alignment with a doubled clipped stroke', (alignment, attribute) => {
    const block = { ...createBlock('triangle'), strokeAlignment: alignment }
    const wrapper = mount(ShapeBlockRenderer, {
      props: { block, layoutMode: 'static' },
      global: rendererTestGlobal,
    })
    const stroke = wrapper.get('.shape-block__stroke')

    expect(stroke.attributes('style')).toContain('stroke-width: 6')
    expect(stroke.attributes(attribute)).toMatch(/^url\(#shape-/)
  })

  it('keeps open lines centered and applies cap, join, and miter semantics', () => {
    const block = {
      ...createBlock('line'),
      strokeAlignment: 'outside' as const,
      strokeJoin: 'round' as const,
      strokeCap: 'square' as const,
      strokeMiterLimit: 8,
    }
    const wrapper = mount(ShapeBlockRenderer, {
      props: { block, layoutMode: 'static' },
      global: rendererTestGlobal,
    })
    const style = wrapper.get('line').attributes('style')

    expect(style).toContain('stroke-width: 3')
    expect(style).toContain('stroke-linejoin: round')
    expect(style).toContain('stroke-linecap: square')
    expect(style).toContain('stroke-miterlimit: 8')
    expect(wrapper.find('defs').exists()).toBe(false)
  })})
