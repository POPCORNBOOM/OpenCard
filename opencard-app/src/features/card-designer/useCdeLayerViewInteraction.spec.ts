import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import {
  useCdeLayerViewInteraction,
  type CdeLayerViewPort,
} from './useCdeLayerViewInteraction'

type LayerViewInteraction = ReturnType<typeof useCdeLayerViewInteraction>

function createHarness() {
  const hasRenderableFace = ref(true)
  const selectedBlockId = ref<string | null>('selected')
  const selectedLocationType = ref<
    'simple-container-location' | 'flow-container-location' | null
  >('simple-container-location')
  const nudgeSelection = vi.fn(() => true)
  const runSelectionQuickAction = vi.fn(() => true)
  const stepLayer = vi.fn()
  const focusLayerBlock = vi.fn()
  const getFocusedLayerBlockId = vi.fn((): string | null => 'focused')
  const cycleLayerByInitial = vi.fn(() => true)
  const viewportPort = ref<CdeLayerViewPort | null>({
    nudgeSelection,
    runSelectionQuickAction,
    stepLayer,
    focusLayerBlock,
    getFocusedLayerBlockId,
    cycleLayerByInitial,
  })
  const selectBlock = vi.fn((blockId: string) => {
    selectedBlockId.value = blockId
  })
  const changeZIndex = vi.fn(() => true)
  let interaction!: LayerViewInteraction

  const Host = defineComponent({
    setup() {
      const rootElement = ref<HTMLElement | null>(null)
      interaction = useCdeLayerViewInteraction({
        rootElement,
        hasRenderableFace,
        selectedBlockId,
        selectedLocationType,
        viewportPort,
        selectBlock,
        changeZIndex,
      })
      return () => h('div', {
        ref: rootElement,
        class: 'root',
        tabindex: -1,
        onKeydown: interaction.handleRootKeydown,
        onPointerdown: interaction.handleCanvasPointerDown,
      }, [
        h('input', { class: 'input' }),
        h('button', { class: 'button' }, 'Button'),
        h('span', { class: 'canvas' }),
      ])
    },
  })

  const wrapper = mount(Host)
  return {
    changeZIndex,
    cycleLayerByInitial,
    focusLayerBlock,
    getFocusedLayerBlockId,
    hasRenderableFace,
    interaction,
    nudgeSelection,
    runSelectionQuickAction,
    selectBlock,
    selectedBlockId,
    selectedLocationType,
    stepLayer,
    wrapper,
  }
}

describe('useCdeLayerViewInteraction', () => {
  it('ignores child targets, handled events, and command modifiers', async () => {
    const { interaction, nudgeSelection, wrapper } = createHarness()

    await wrapper.get('.input').trigger('keydown', { key: 'ArrowRight' })
    await wrapper.get('.root').trigger('keydown', { key: 'ArrowRight', ctrlKey: true })
    await wrapper.get('.root').trigger('keydown', { key: 'ArrowRight', metaKey: true })
    await wrapper.get('.root').trigger('keydown', { key: 'ArrowRight', altKey: true })
    const handled = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    })
    handled.preventDefault()
    wrapper.get('.root').element.dispatchEvent(handled)

    expect(nudgeSelection).not.toHaveBeenCalled()
    expect(interaction.layerViewActive.value).toBe(false)
    wrapper.unmount()
  })

  it('owns Tab activation and clears transient state on keyup, blur, and unmount', async () => {
    const { hasRenderableFace, interaction, wrapper } = createHarness()
    const root = wrapper.get('.root')

    hasRenderableFace.value = false
    await root.trigger('keydown', { key: 'Tab' })
    expect(interaction.layerViewActive.value).toBe(false)
    hasRenderableFace.value = true
    await root.trigger('keydown', { key: 'Tab' })
    expect(interaction.layerViewActive.value).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Tab' }))
    expect(interaction.layerViewActive.value).toBe(false)

    await root.trigger('keydown', { key: 'Tab' })
    await root.trigger('keydown', { key: ' ', code: 'Space' })
    window.dispatchEvent(new Event('blur'))
    expect(interaction.layerViewActive.value).toBe(false)
    expect(interaction.spaceHeld.value).toBe(false)

    wrapper.unmount()
    interaction.layerViewActive.value = true
    interaction.spaceHeld.value = true
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Tab' }))
    window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space' }))
    expect(interaction.layerViewActive.value).toBe(true)
    expect(interaction.spaceHeld.value).toBe(true)
  })

  it('routes Layer View arrows and Unicode initials before normal shortcuts', async () => {
    const {
      cycleLayerByInitial,
      runSelectionQuickAction,
      stepLayer,
      wrapper,
    } = createHarness()
    const root = wrapper.get('.root')
    await root.trigger('keydown', { key: 'Tab' })
    await root.trigger('keydown', { key: 'ArrowUp' })
    await root.trigger('keydown', { key: 'ArrowDown', shiftKey: true })
    await root.trigger('keydown', { key: 'f' })
    await root.trigger('keydown', { key: '花', shiftKey: true })
    const composing = new KeyboardEvent('keydown', {
      key: 'a',
      bubbles: true,
      isComposing: true,
    })
    root.element.dispatchEvent(composing)

    expect(stepLayer.mock.calls).toEqual([[-1, false], [1, true]])
    expect(cycleLayerByInitial.mock.calls).toEqual([['f', false], ['花', true]])
    expect(runSelectionQuickAction).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('selects the focused plane once per Space press and shares the zIndex route', async () => {
    const {
      changeZIndex,
      focusLayerBlock,
      interaction,
      selectBlock,
      wrapper,
    } = createHarness()
    const root = wrapper.get('.root')

    await root.trigger('keydown', { key: ' ', code: 'Space' })
    await root.trigger('keydown', { key: ' ', code: 'Space', repeat: true })
    expect(selectBlock).toHaveBeenCalledTimes(1)
    expect(selectBlock).toHaveBeenCalledWith('focused')

    await root.trigger('keydown', { key: 'ArrowUp' })
    await nextTick()
    expect(changeZIndex).toHaveBeenLastCalledWith({
      blockId: 'focused',
      delta: 1,
      existingLayersOnly: false,
    })
    expect(focusLayerBlock).toHaveBeenLastCalledWith('focused')

    await root.trigger('keydown', { key: 'ArrowDown', shiftKey: true })
    expect(changeZIndex).toHaveBeenLastCalledWith({
      blockId: 'focused',
      delta: -1,
      existingLayersOnly: true,
    })
    window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space' }))
    expect(interaction.spaceHeld.value).toBe(false)

    interaction.handleLayerZIndexStep({ delta: -1, existingLayersOnly: false })
    await nextTick()
    expect(changeZIndex).toHaveBeenLastCalledWith({
      blockId: 'focused',
      delta: -1,
      existingLayersOnly: false,
    })

    changeZIndex.mockReturnValue(false)
    const focusCount = focusLayerBlock.mock.calls.length
    interaction.handleLayerZIndexStep({ delta: 1, existingLayersOnly: false })
    await nextTick()
    expect(focusLayerBlock).toHaveBeenCalledTimes(focusCount)
    wrapper.unmount()
  })

  it('routes normal movement and Simple or Flow quick actions', async () => {
    const {
      nudgeSelection,
      runSelectionQuickAction,
      selectedBlockId,
      selectedLocationType,
      wrapper,
    } = createHarness()
    const root = wrapper.get('.root')

    await root.trigger('keydown', { key: 'ArrowRight' })
    await root.trigger('keydown', { key: 'ArrowUp', shiftKey: true })
    for (const key of ['f', 'C', 'i', 'o']) await root.trigger('keydown', { key })
    expect(nudgeSelection.mock.calls).toEqual([[1, 0], [0, -10]])
    expect(runSelectionQuickAction.mock.calls).toEqual([
      ['fill-parent'],
      ['center'],
      ['inset'],
      ['outset'],
    ])

    runSelectionQuickAction.mockClear()
    selectedLocationType.value = 'flow-container-location'
    await root.trigger('keydown', { key: 'f' })
    await root.trigger('keydown', { key: 'c' })
    expect(runSelectionQuickAction.mock.calls).toEqual([
      ['fill-cross-axis'],
      ['center-cross-axis'],
    ])

    selectedBlockId.value = null
    await root.trigger('keydown', { key: 'ArrowLeft' })
    expect(nudgeSelection).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('focuses the canvas without stealing focus from interactive controls', async () => {
    const { interaction, selectBlock, wrapper } = createHarness()
    const root = wrapper.get('.root').element as HTMLElement
    const focus = vi.spyOn(root, 'focus')

    wrapper.get('.input').element.dispatchEvent(new MouseEvent('pointerdown', { button: 0, bubbles: true }))
    wrapper.get('.button').element.dispatchEvent(new MouseEvent('pointerdown', { button: 0, bubbles: true }))
    expect(focus).not.toHaveBeenCalled()
    wrapper.get('.canvas').element.dispatchEvent(new MouseEvent('pointerdown', { button: 0, bubbles: true }))
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })

    focus.mockClear()
    interaction.handleViewportBlockClick('block-2')
    await nextTick()
    expect(selectBlock).toHaveBeenCalledWith('block-2')
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
    wrapper.unmount()
  })
})
