import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RenderReadyCardFace } from '../render.types'
import { createTextBlock } from '../../../entities/card/model'
import CardViewport from './CardViewport.vue'
import { parseRenderReadyBlockForTest } from './renderTestUtils'
import { useFloatingMenu } from '../../../composables/useFloatingMenu'

const face: RenderReadyCardFace = {
  type: 'card-face',
  id: 'test-face',
  faceKey: 'front',
  width: 630,
  height: 880,
  background: '#ffffff',
  children: [],
}

const layeredFace: RenderReadyCardFace = {
  ...face,
  children: [{
    block: parseRenderReadyBlockForTest(createTextBlock({ id: 'layer-block', zIndex: '2' })),
    location: {
      id: 'layer-location',
      type: 'simple-container-location',
      anchor: 'lt',
      x: '0px',
      y: '0px',
    },
  }],
}

const snappingFace: RenderReadyCardFace = {
  ...face,
  children: [
    {
      block: parseRenderReadyBlockForTest(createTextBlock({ id: 'selected' })),
      location: { id: 'selected-location', type: 'simple-container-location', anchor: 'lt', x: '50px', y: '50px' },
    },
    {
      block: parseRenderReadyBlockForTest(createTextBlock({ id: 'sibling' })),
      location: { id: 'sibling-location', type: 'simple-container-location', anchor: 'lt', x: '158px', y: '20px' },
    },
  ],
}

class ResizeObserverMock {
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(target: Element): void {
    Object.defineProperties(target, {
      clientWidth: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 800 },
    })
    this.callback([{
      target,
      contentRect: { width: 1000, height: 800 },
    } as ResizeObserverEntry], this as unknown as ResizeObserver)
  }

  disconnect(): void {}
}

describe('CardViewport wheel zoom API', () => {
  let animationFrames: FrameRequestCallback[]

  beforeEach(() => {
    animationFrames = []
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      animationFrames.push(callback)
      return animationFrames.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => {
    useFloatingMenu().closeMenu()
    vi.unstubAllGlobals()
  })

  async function flushAnimation(): Promise<void> {
    for (let index = 0; index < 100 && animationFrames.length > 0; index += 1) {
      animationFrames.shift()?.(index * 16)
    }
    await nextTick()
  }

  it('zooms in around the supplied viewport anchor', async () => {
    const wrapper = mount(CardViewport, {
      props: { face },
      global: { stubs: { CardFaceRenderer: true } },
    })
    const viewport = wrapper.vm as unknown as {
      zoomByWheelAt(deltaY: number, deltaMode: number, viewportX: number, viewportY: number): void
    }
    const anchorX = 250
    const anchorY = 200
    const initialWorldX = anchorX - (1000 - face.width) / 2
    const initialWorldY = anchorY - (800 - face.height) / 2

    viewport.zoomByWheelAt(-120, WheelEvent.DOM_DELTA_PIXEL, anchorX, anchorY)
    await flushAnimation()
    const zoomEvents = wrapper.emitted('viewport-transform-change') ?? []
    const zoomedIn = zoomEvents[zoomEvents.length - 1]?.[0] as {
      x: number
      y: number
      scale: number
    }
    expect(zoomedIn.scale).toBeGreaterThan(1)
    const zoomedWorldX = (
      anchorX - (1000 - face.width * zoomedIn.scale) / 2 - zoomedIn.x
    ) / zoomedIn.scale
    const zoomedWorldY = (
      anchorY - (800 - face.height * zoomedIn.scale) / 2 - zoomedIn.y
    ) / zoomedIn.scale
    expect(zoomedWorldX).toBeCloseTo(initialWorldX, 4)
    expect(zoomedWorldY).toBeCloseTo(initialWorldY, 4)
  })

  it('fits the face into a supplied visible region instead of resetting to 100%', async () => {
    const wrapper = mount(CardViewport, {
      props: { face },
      global: { stubs: { CardFaceRenderer: true } },
    })
    const viewport = wrapper.vm as unknown as {
      fitView(targetRect?: { left: number; top: number; width: number; height: number }): void
    }

    viewport.fitView({ left: 200, top: 100, width: 500, height: 600 })
    await nextTick()

    const transformEvents = wrapper.emitted('viewport-transform-change') ?? []
    const fitted = transformEvents[transformEvents.length - 1]?.[0] as {
      x: number
      y: number
      scale: number
    }
    expect(fitted.scale).toBeCloseTo(536 / face.height, 4)
    expect(fitted.scale).not.toBe(1)
    expect(fitted.x).toBe(-50)
    expect(fitted.y).toBe(0)
  })

  it('forwards face clipping to the face renderer', () => {
    const wrapper = mount(CardViewport, {
      props: { face, clipToFace: true },
    })

    expect(wrapper.find('.card-canvas').classes()).toContain('card-canvas--clipped')
  })

  it('pauses viewport zoom while layer view is active and restores it on exit', async () => {
    const LayerSourceStub = defineComponent({
      name: 'CardFaceRenderer',
      template: '<div data-block-id="layer-block">Layer</div>',
    })
    const wrapper = mount(CardViewport, {
      props: { face: layeredFace, layerViewActive: true, layerViewBasePlaneLabel: 'Base plate' },
      global: { stubs: { CardFaceRenderer: LayerSourceStub } },
    })
    const viewport = wrapper.vm as unknown as {
      zoomBy: (factor: number) => void
      cycleLayerByInitial: (initial: string, currentLayerOnly?: boolean) => boolean
    }

    const layerName = layeredFace.children[0]!.block.name || 'layer-block'
    expect(wrapper.get('.card-layer-view__base-index').text()).toBe('Base plate')
    expect(viewport.cycleLayerByInitial(Array.from(layerName.trimStart())[0]!)).toBe(true)

    viewport.zoomBy(1.25)
    await flushAnimation()
    expect(wrapper.emitted('viewport-transform-change')).toBeUndefined()
    expect(wrapper.get('.card-viewport').classes()).toContain('card-viewport--layer-view')

    await wrapper.setProps({ layerViewActive: false })
    viewport.zoomBy(1.25)
    await flushAnimation()
    expect(wrapper.emitted('viewport-transform-change')?.length).toBeGreaterThan(0)
    expect(wrapper.get('.card-viewport').classes()).not.toContain('card-viewport--layer-view')
  })

  it('anchors supplemental information to the top-right of the face', async () => {
    const wrapper = mount(CardViewport, {
      props: { face },
      slots: {
        info: '<div data-test="face-info">Details</div>',
        'left-info': '<div data-test="height-info">Height</div>',
        'bottom-info': '<div data-test="width-info">Width</div>',
      },
      global: { stubs: { CardFaceRenderer: true } },
    })

    const info = wrapper.find('.card-viewport-info')
    expect(info.exists()).toBe(true)
    expect(info.attributes('style')).toContain(`left: ${face.width + 16}px`)
    expect(info.find('[data-test="face-info"]').text()).toBe('Details')
    expect(wrapper.find('.card-viewport-left-info').attributes('style'))
      .toContain(`top: ${face.height / 2}px`)
    expect(wrapper.find('.card-viewport-left-info .card-viewport-dimension-line').classes())
      .toContain('card-viewport-dimension-line--vertical')
    expect(wrapper.find('[data-test="height-info"]').text()).toBe('Height')
    expect(wrapper.find('.card-viewport-bottom-info').attributes('style'))
      .toContain(`left: ${face.width / 2}px`)
    expect(wrapper.find('[data-test="width-info"]').text()).toBe('Width')
    expect(wrapper.find('.card-viewport-left-info .card-viewport-dimension-line').attributes('style'))
      .toContain(`height: ${face.height}px`)
    expect(wrapper.find('.card-viewport-bottom-info .card-viewport-dimension-line').attributes('style'))
      .toContain(`width: ${face.width}px`)

    await wrapper.setProps({ showInfo: false })
    expect(wrapper.find('.card-viewport-info').exists()).toBe(false)
    expect(wrapper.find('.card-viewport-left-info').exists()).toBe(true)
    expect(wrapper.find('.card-viewport-bottom-info').exists()).toBe(true)
  })

  it('emits anchor-preserving geometry actions from the selection toolbar', async () => {
    const SelectionRendererStub = defineComponent({
      name: 'CardFaceRenderer',
      setup() {
        return () => h('div', { 'data-block-id': 'parent' }, [
          h('div', { 'data-block-id': 'selected' }),
        ])
      },
    })
    const wrapper = mount(CardViewport, {
      props: {
        face,
        selectedBlockId: null,
        selectedLocationType: 'simple-container-location',
        selectedAnchor: 'rb',
        selectedParentBlockId: 'parent',
        selectionInfo: {
          icon: 'entity.block-text',
          iconTone: 'block-text',
          name: 'Title',
          notes: 'Primary heading',
        },
        selectionCommandActions: [{
          key: 'content.edit-rich-text',
          icon: 'format.text-variant-outline',
          title: 'Edit rich text',
        }],
      },
      global: { stubs: { CardFaceRenderer: SelectionRendererStub } },
    })
    const viewport = wrapper.get('.card-viewport').element
    const parent = wrapper.get('[data-block-id="parent"]').element
    const selected = wrapper.get('[data-block-id="selected"]').element
    Object.defineProperty(viewport, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800 }),
    })
    Object.defineProperty(parent, 'getBoundingClientRect', {
      value: () => ({ left: 100, top: 100, width: 400, height: 300, right: 500, bottom: 400 }),
    })
    Object.defineProperty(selected, 'getBoundingClientRect', {
      value: () => ({ left: 150, top: 150, width: 100, height: 80, right: 250, bottom: 230 }),
    })

    await wrapper.setProps({ selectedBlockId: 'selected' })
    await nextTick()
    const actions = wrapper.findAllComponents({ name: 'OcActionButton' })
    expect(actions.map((action) => action.props('action').key))
      .toEqual(['content.edit-rich-text', 'fill-parent', 'center', 'inset', 'outset'])
    expect(actions.map((action) => action.props('action').icon))
      .toEqual([
        'format.text-variant-outline',
        'layout.fill',
        'layout.center',
        'layout.inset',
        'layout.outset',
      ])
    expect(wrapper.get('.selection-block-info__title').text()).toContain('Title')
    expect(wrapper.get('.selection-block-info__notes').text()).toBe('Primary heading')
    await wrapper.get('.selection-block-info').trigger('pointerdown')
    expect(wrapper.get('.selection-frame').classes()).not.toContain('is-moving')

    actions.find((action) => action.props('action').key === 'fill-parent')
      ?.vm.$emit('select', { key: 'fill-parent' })
    actions.find((action) => action.props('action').key === 'center')
      ?.vm.$emit('select', { key: 'center' })
    actions.find((action) => action.props('action').key === 'content.edit-rich-text')
      ?.vm.$emit('select', { key: 'content.edit-rich-text' })

    expect(wrapper.emitted('selection-action')).toEqual([
      [{ type: 'fill-parent', blockId: 'selected', width: true, height: true }],
      [{
        type: 'geometry.apply',
        operation: 'center',
        blockId: 'selected',
        x: 150,
        y: 110,
      }],
    ])
    expect(wrapper.emitted('selection-command')).toEqual([[
      { key: 'content.edit-rich-text', blockId: 'selected' },
    ]])

    expect(wrapper.vm.runSelectionQuickAction('outset')).toBe(true)
    expect(wrapper.vm.nudgeSelection(1, -1)).toBe(true)
    const selectionActions = wrapper.emitted('selection-action') ?? []
    expect(selectionActions[selectionActions.length - 1]).toEqual([{
      type: 'geometry.apply',
      operation: 'outset',
      blockId: 'selected',
      width: 120,
      height: 100,
      x: 240,
      y: 160,
    }])
    expect(wrapper.emitted('move-selection')).toEqual([[{
      blockId: 'selected',
      x: 249,
      y: 171,
    }]])

    await wrapper.get('.selection-frame').trigger('contextmenu')
    const menu = useFloatingMenu()
    expect(menu.state.value.items.map(item => item.key))
      .toEqual(['content.edit-rich-text', 'fill-parent', 'center', 'inset', 'outset'])
    menu.selectMenuItem('fill-parent')
    const contextSelectionActions = wrapper.emitted('selection-action') ?? []
    expect(contextSelectionActions[contextSelectionActions.length - 1]).toEqual([
      { type: 'fill-parent', blockId: 'selected', width: true, height: true },
    ])

    await wrapper.get('.selection-handle-t').trigger('pointerdown')
    expect(wrapper.find('.selection-block-info').exists()).toBe(false)
    expect(wrapper.find('.selection-size-label--width').exists()).toBe(false)
    expect(wrapper.get('.selection-size-label--height').text()).toBe('80px')
    await wrapper.setProps({ selectedBlockId: 'other' })
    const resizeMove = new Event('pointermove')
    Object.defineProperties(resizeMove, {
      movementX: { value: 0 },
      movementY: { value: -10 },
    })
    window.dispatchEvent(resizeMove)
    window.dispatchEvent(new Event('pointerup'))
    expect(wrapper.emitted('resize-selection')?.[0]?.[0]).toMatchObject({
      blockId: 'selected',
      width: 100,
      height: 90,
    })
    await wrapper.setProps({ selectedBlockId: 'selected' })
    await nextTick()

    await wrapper.get('.selection-frame').trigger('pointerdown')
    expect(wrapper.find('.selection-block-info').exists()).toBe(false)
    expect(wrapper.get('.selection-frame').classes()).toContain('is-moving')
    expect(wrapper.get('.selection-anchor-guide-label--x').text()).toBe('x 250px')
    expect(wrapper.get('.selection-anchor-guide-label--y').text()).toBe('y 170px')
    expect(wrapper.get('.selection-anchor-badge').text()).toBe('RB')
    window.dispatchEvent(new Event('pointercancel'))
    await wrapper.setProps({ showPositionOnMove: false, showSizeOnResize: false })
    await wrapper.get('.selection-handle-t').trigger('pointerdown')
    expect(wrapper.find('.selection-size-label').exists()).toBe(false)
    window.dispatchEvent(new Event('pointercancel'))
    await nextTick()
    await wrapper.get('.selection-frame').trigger('pointerdown')
    expect(wrapper.find('.selection-anchor-guide').exists()).toBe(false)
    window.dispatchEvent(new Event('pointercancel'))

    await wrapper.setProps({ widthLocked: true, heightLocked: false })
    expect(wrapper.findAll('.selection-handle').map(handle => handle.classes()[1]))
      .toEqual(['selection-handle-t', 'selection-handle-b'])
    expect(wrapper.vm.runSelectionQuickAction('outset')).toBe(true)
    const lockedActions = wrapper.emitted('selection-action') ?? []
    expect(lockedActions[lockedActions.length - 1]).toEqual([{
      type: 'geometry.apply', operation: 'outset', blockId: 'selected',
      height: 100, y: 160,
    }])
    await wrapper.setProps({ heightLocked: true })
    expect(wrapper.findAll('.selection-handle')).toHaveLength(0)
    expect(wrapper.findAllComponents({ name: 'OcActionButton' }).map(action => action.props('action').key))
      .toEqual(['content.edit-rich-text', 'center'])
  })

  it('uses direction-aware flow handles and emits only the resized axis', async () => {
    const SelectionRendererStub = defineComponent({
      name: 'CardFaceRenderer',
      setup() {
        return () => h('div', { 'data-block-id': 'parent' }, [
          h('div', { 'data-block-id': 'selected' }),
        ])
      },
    })
    const wrapper = mount(CardViewport, {
      props: {
        face,
        selectedBlockId: null,
        selectedLocationType: 'flow-container-location',
        selectedParentBlockId: 'parent',
        selectedParentFlowDirection: 'lr',
        selectedFlowAlign: 'start',
      },
      global: { stubs: { CardFaceRenderer: SelectionRendererStub } },
    })
    const viewport = wrapper.get('.card-viewport').element
    const parent = wrapper.get('[data-block-id="parent"]').element
    const selected = wrapper.get('[data-block-id="selected"]').element
    Object.defineProperty(viewport, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800 }),
    })
    Object.defineProperty(parent, 'getBoundingClientRect', {
      value: () => ({ left: 100, top: 100, width: 400, height: 300, right: 500, bottom: 400 }),
    })
    Object.defineProperty(selected, 'getBoundingClientRect', {
      value: () => ({ left: 150, top: 150, width: 225, height: 80, right: 375, bottom: 230 }),
    })

    await wrapper.setProps({ selectedBlockId: 'selected' })
    await nextTick()
    expect(wrapper.findAll('.selection-handle').map(handle => handle.classes()[1]))
      .toEqual(['selection-handle-r', 'selection-handle-b'])

    await wrapper.get('.selection-handle-b').trigger('pointerdown')
    const crossAxisMove = new Event('pointermove')
    Object.defineProperties(crossAxisMove, {
      movementX: { value: 0 },
      movementY: { value: 20 },
    })
    window.dispatchEvent(crossAxisMove)
    window.dispatchEvent(new Event('pointerup'))
    expect(wrapper.emitted('resize-selection')?.[0]?.[0]).toEqual({
      blockId: 'selected',
      height: 100,
    })

    await wrapper.setProps({ selectedParentFlowDirection: 'rl', selectedFlowAlign: 'end' })
    expect(wrapper.findAll('.selection-handle').map(handle => handle.classes()[1]))
      .toEqual(['selection-handle-l', 'selection-handle-t'])
    await wrapper.setProps({ selectedFlowAlign: 'justify' })
    expect(wrapper.findAll('.selection-handle').map(handle => handle.classes()[1]))
      .toEqual(['selection-handle-l'])
    await wrapper.setProps({ selectedParentFlowDirection: 'lr', selectedFlowAlign: 'center' })
    expect(wrapper.findAll('.selection-handle').map(handle => handle.classes()[1]))
      .toEqual(['selection-handle-r', 'selection-handle-t', 'selection-handle-b'])
    await wrapper.get('.selection-handle-b').trigger('pointerdown')
    const centeredCrossAxisMove = new Event('pointermove')
    Object.defineProperties(centeredCrossAxisMove, {
      movementX: { value: 0 },
      movementY: { value: 10 },
    })
    window.dispatchEvent(centeredCrossAxisMove)
    window.dispatchEvent(new Event('pointerup'))
    expect(wrapper.emitted('resize-selection')?.[1]?.[0]).toEqual({
      blockId: 'selected',
      height: 100,
    })
    await wrapper.setProps({ widthLocked: true, heightLocked: false })
    expect(wrapper.findAll('.selection-handle').map(handle => handle.classes()[1]))
      .toEqual(['selection-handle-t', 'selection-handle-b'])
    await wrapper.setProps({ widthLocked: false, heightLocked: true })
    expect(wrapper.findAll('.selection-handle').map(handle => handle.classes()[1]))
      .toEqual(['selection-handle-r'])
    expect(wrapper.findAllComponents({ name: 'OcActionButton' }).map(action => action.props('action').key))
      .not.toContain('fill-cross-axis')
  })

  it('keeps a minimum-size resize handle pinned until the pointer catches up', async () => {
    const SelectionRendererStub = defineComponent({
      name: 'CardFaceRenderer',
      setup() {
        return () => h('div', { class: 'card-canvas' }, [
          h('div', { 'data-block-id': 'selected' }),
        ])
      },
    })
    const wrapper = mount(CardViewport, {
      props: {
        face: snappingFace,
        selectedBlockId: null,
        selectedLocationType: 'simple-container-location',
        selectedAnchor: 'lt',
        alignmentSnappingEnabled: false,
      },
      global: { stubs: { CardFaceRenderer: SelectionRendererStub } },
    })
    const viewport = wrapper.get<HTMLElement>('.card-viewport')
    const parent = wrapper.get('.card-canvas')
    const selected = wrapper.get('[data-block-id="selected"]')
    Object.defineProperty(viewport.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800 }),
    })
    Object.defineProperty(parent.element, 'getBoundingClientRect', {
      value: () => ({ left: 100, top: 100, width: 400, height: 300, right: 500, bottom: 400 }),
    })
    Object.defineProperty(selected.element, 'getBoundingClientRect', {
      value: () => ({ left: 150, top: 150, width: 100, height: 80, right: 250, bottom: 230 }),
    })

    await wrapper.setProps({ selectedBlockId: 'selected' })
    await nextTick()
    await wrapper.get('.selection-handle-r').trigger('pointerdown')

    const moveBy = async (movementX: number) => {
      const move = new Event('pointermove')
      Object.defineProperties(move, {
        movementX: { value: movementX },
        movementY: { value: 0 },
      })
      window.dispatchEvent(move)
      await nextTick()
    }

    await moveBy(-100)
    expect(wrapper.get('.selection-frame').attributes('style')).toContain('width: 24px')
    await moveBy(-40)
    await moveBy(20)
    expect(wrapper.get('.selection-frame').attributes('style')).toContain('width: 24px')
    await moveBy(45)
    expect(wrapper.get('.selection-frame').attributes('style')).toContain('width: 25px')

    window.dispatchEvent(new Event('pointerup'))
    expect(wrapper.emitted('resize-selection')?.[0]?.[0]).toEqual({
      blockId: 'selected',
      width: 25,
      height: 80,
      x: 50,
      y: 50,
    })
  })

  it('snaps absolute resize and move edges to a direct sibling with aligned previews', async () => {
    const SelectionRendererStub = defineComponent({
      name: 'CardFaceRenderer',
      setup() {
        return () => h('div', { class: 'card-canvas' }, [
          h('div', { 'data-block-id': 'selected' }),
          h('div', { 'data-block-id': 'sibling' }),
        ])
      },
    })
    const wrapper = mount(CardViewport, {
      props: {
        face: snappingFace,
        selectedBlockId: null,
        selectedLocationType: 'simple-container-location',
        selectedAnchor: 'lt',
      },
      global: { stubs: { CardFaceRenderer: SelectionRendererStub } },
    })
    const viewport = wrapper.get<HTMLElement>('.card-viewport')
    const parent = wrapper.get('[class="card-canvas"]')
    const selected = wrapper.get('[data-block-id="selected"]')
    const sibling = wrapper.get('[data-block-id="sibling"]')
    viewport.element.style.setProperty('--oc-viewport-alignment-snap-distance', '8px')
    viewport.element.style.setProperty('--oc-viewport-alignment-snap-release-distance', '12px')
    Object.defineProperty(viewport.element, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800 }),
    })
    Object.defineProperty(parent.element, 'getBoundingClientRect', {
      value: () => ({ left: 100, top: 100, width: 400, height: 300, right: 500, bottom: 400 }),
    })
    Object.defineProperty(selected.element, 'getBoundingClientRect', {
      value: () => ({ left: 150, top: 150, width: 100, height: 80, right: 250, bottom: 230 }),
    })
    Object.defineProperty(sibling.element, 'getBoundingClientRect', {
      value: () => ({ left: 258, top: 120, width: 80, height: 60, right: 338, bottom: 180 }),
    })

    await wrapper.setProps({ selectedBlockId: 'selected' })
    await nextTick()
    await wrapper.get('.selection-handle-r').trigger('pointerdown')
    const resizeMove = new Event('pointermove')
    Object.defineProperties(resizeMove, {
      movementX: { value: 5 },
      movementY: { value: 0 },
    })
    window.dispatchEvent(resizeMove)
    await nextTick()

    const guide = wrapper.get('.selection-alignment-guides line')
    expect(guide.attributes()).toMatchObject({ x1: '258', x2: '258', y1: '120', y2: '230' })
    expect(wrapper.get('.selection-frame').attributes('style')).toContain('width: 108px')

    window.dispatchEvent(new Event('pointerup'))
    await nextTick()
    expect(wrapper.emitted('resize-selection')?.[0]?.[0]).toEqual({
      blockId: 'selected',
      width: 108,
      height: 80,
      x: 50,
      y: 50,
    })
    expect(wrapper.find('.selection-alignment-guides').exists()).toBe(false)

    await wrapper.get('.selection-frame').trigger('pointerdown')
    const move = new Event('pointermove')
    Object.defineProperties(move, {
      movementX: { value: 5 },
      movementY: { value: 0 },
    })
    window.dispatchEvent(move)
    await nextTick()
    expect(wrapper.get('.selection-alignment-guides line').attributes())
      .toMatchObject({ x1: '258', x2: '258', y1: '120', y2: '230' })
    expect(wrapper.get('.selection-frame').attributes('style')).toContain('left: 158px')

    window.dispatchEvent(new Event('pointerup'))
    expect(wrapper.emitted('move-selection')?.[0]?.[0]).toEqual({
      blockId: 'selected',
      x: 58,
      y: 50,
    })

    await wrapper.setProps({ alignmentSnappingEnabled: false })
    await wrapper.get('.selection-frame').trigger('pointerdown')
    const unsnappedMove = new Event('pointermove')
    Object.defineProperties(unsnappedMove, {
      movementX: { value: 5 },
      movementY: { value: 0 },
    })
    window.dispatchEvent(unsnappedMove)
    await nextTick()
    expect(wrapper.find('.selection-alignment-guides').exists()).toBe(false)
    expect(wrapper.get('.selection-frame').attributes('style')).toContain('left: 155px')
    window.dispatchEvent(new Event('pointerup'))
    expect(wrapper.emitted('move-selection')?.[1]?.[0]).toEqual({
      blockId: 'selected',
      x: 55,
      y: 50,
    })
  })

  it('drags dimensions by axis, changes cursors, and snaps to tens with Shift', async () => {
    const wrapper = mount(CardViewport, {
      props: { face },
      slots: {
        'left-info': 'Height',
        'bottom-info': 'Width',
      },
      global: { stubs: { CardFaceRenderer: true } },
    })

    wrapper.find('.card-viewport-bottom-info').element.dispatchEvent(new MouseEvent('pointerdown', {
      button: 0,
      clientX: 100,
      bubbles: true,
    }))
    expect(document.body.style.cursor).toBe('ew-resize')
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 135, shiftKey: true }))
    window.dispatchEvent(new MouseEvent('pointerup'))

    wrapper.find('.card-viewport-left-info').element.dispatchEvent(new MouseEvent('pointerdown', {
      button: 0,
      clientY: 100,
      bubbles: true,
    }))
    expect(document.body.style.cursor).toBe('ns-resize')
    window.dispatchEvent(new MouseEvent('pointermove', { clientY: 70 }))
    window.dispatchEvent(new MouseEvent('pointerup'))

    expect(document.body.style.cursor).toBe('')
    expect(wrapper.emitted('face-dimension-change')).toEqual([
      [{ dimension: 'width', value: face.width + 40, final: false }],
      [{ dimension: 'width', value: face.width + 40, final: true }],
      [{ dimension: 'height', value: face.height + 30, final: false }],
      [{ dimension: 'height', value: face.height + 30, final: true }],
    ])
  })
})
