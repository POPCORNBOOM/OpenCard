import { defineComponent, h, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import { shallowMount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createCardFace,
  createFlowContainerBlock,
  createSimpleContainerBlock,
  createTextBlock,
  type CardDocument,
} from '../../entities/card/model'
import enUS from '../../locales/en-US'
import type { SessionNavigationToken } from '../editor-runtime/model/editorIssue'
import CardDesignEditor from './CardDesignEditor.vue'

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function createDocument(): CardDocument {
  return {
    type: 'card-document',
    schemaVersion: '2',
    id: 'document-1',
    name: 'Document',
    description: 'Reusable hero\ncard.',
    notes: 'Review print\nmargins.',
    version: '1.0.0',
    width: '540',
    height: '850',
    instances: [{
      type: 'card-instance',
      id: 'instance-1',
      name: 'Instance 1',
      amount: '1',
      data: {},
    }],
    faces: {
      front: createCardFace({
        id: 'face-front',
        children: [{
          block: createSimpleContainerBlock({
            id: 'container-1',
            name: 'Container',
            children: [{
              block: createTextBlock({ id: 'text-1', name: 'Title', content: 'Hello' }),
              location: {
                id: 'location-2',
                type: 'simple-container-location',
                anchor: 'lt',
              },
            }],
          }),
          location: {
            id: 'location-1',
            type: 'simple-container-location',
            anchor: 'lt',
          },
        }],
      }),
      back: createCardFace({ id: 'face-back' }),
    },
  }
}

describe('CardDesignEditor issue navigation', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('selects the instance and block, forces tree reveal, and focuses the property field', async () => {
    const revealField = vi.fn().mockResolvedValue(true)
    const treePropSnapshots: Array<Record<string, unknown>> = []
    const PropertyEditorStub = defineComponent({
      name: 'PropertyEditor',
      setup(_, { expose }) {
        expose({ revealField })
        return () => h('div')
      },
    })
    const OcTreeStub = defineComponent({
      name: 'OcTree',
      inheritAttrs: false,
      props: {
        role: String,
        selectedKeys: Array,
        selectionExpansionMode: String,
        scrollToSelection: Boolean,
      },
      setup(props) {
        return () => {
          treePropSnapshots.push({
            role: props.role,
            selectedKeys: [...(props.selectedKeys ?? [])],
            selectionExpansionMode: props.selectionExpansionMode,
            scrollToSelection: props.scrollToSelection,
          })
          return h('div')
        }
      },
    })
    const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })
    const wrapper = shallowMount(CardDesignEditor, {
      props: {
        filePath: 'card.opencard',
        modelValue: JSON.stringify(createDocument()),
        structureTreeSelectionBehavior: 'none',
        structureTreeScrollToSelection: false,
      },
      global: {
        plugins: [i18n],
        stubs: {
          PropertyEditor: PropertyEditorStub,
          OcTree: OcTreeStub,
          OcCard: { template: '<div><slot /></div>' },
          OcPanel: { template: '<div><slot /></div>' },
          Teleport: true,
        },
      },
    })
    await nextTick()
    await nextTick()

    const token: SessionNavigationToken = {
      protocol: 'card-designer',
      version: 2,
      target: {
        kind: 'property',
        instanceId: 'instance-1',
        faceKey: 'front',
        blockId: 'text-1',
        owner: 'block',
        fieldKey: 'opacity',
        characterOffset: 4,
      },
    }
    const navigation = (wrapper.vm as unknown as {
      navigate: (value: SessionNavigationToken) => Promise<string>
    }).navigate(token)
    await nextTick()

    expect(treePropSnapshots).toContainEqual(expect.objectContaining({
      selectedKeys: ['text-1'],
      selectionExpansionMode: 'expand',
      scrollToSelection: true,
    }))
    await expect(navigation).resolves.toBe('success')
    expect(revealField).toHaveBeenCalledWith('text-1', 'opacity', 4)

    const instanceTree = wrapper.findAllComponents(OcTreeStub)
      .find((tree) => tree.props('role') === 'listbox')
    expect(instanceTree?.props('selectedKeys')).toEqual(['instance-1'])
  })

  it('projects relative file, blueprint, and instance information for the viewport', async () => {
    const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })
    const CardViewportStub = defineComponent({
      name: 'CardViewport',
      setup(_, { slots }) {
        return () => h('div', { class: 'card-viewport-stub' }, slots.info?.())
      },
    })
    const wrapper = shallowMount(CardDesignEditor, {
      props: {
        filePath: 'D:/Project/cards/hero.opencard',
        fileName: 'hero.opencard',
        resourceRootPath: 'D:/Project',
        modelValue: JSON.stringify(createDocument()),
      },
      global: {
        plugins: [i18n],
        stubs: {
          CardViewport: CardViewportStub,
          OcCard: { template: '<div><slot /></div>' },
          OcPanel: { template: '<div><slot /></div>' },
          Teleport: true,
        },
      },
    })
    await nextTick()

    const infoValues = () => wrapper.findAll('.card-design-editor__card-info > span')
      .map((item) => item.text())
    expect(infoValues()).toEqual([
      'cards/hero.opencard',
      'Document @ 1.0.0',
      '"Reusable hero\ncard."',
      '1 instances',
      'Front Face',
      '2 blocks',
      'Review print\nmargins.',
    ])
    expect(wrapper.findAll('.card-design-editor__card-info > .is-group-separated').map((item) => item.text()))
      .toEqual(['Front Face', 'Review print\nmargins.'])

    await wrapper.setProps({
      cardDesignerView: {
        activeFace: 'front',
        clipToFace: false,
        selectedInstanceId: 'instance-1',
      },
    })
    await nextTick()

    expect(infoValues()).toEqual([
      'cards/hero.opencard',
      'Document @ 1.0.0',
      '"Reusable hero\ncard."',
      '1 instances',
      '"Instance 1" (1 of 1)',
      'Front Face',
      '2 blocks',
      'Review print\nmargins.',
    ])
    expect(wrapper.findAll('.card-design-editor__card-info > .is-group-separated').map((item) => item.text()))
      .toEqual(['"Instance 1" (1 of 1)', 'Front Face', 'Review print\nmargins.'])
  })

  it('switches face and clipping through session state without modifying the document', async () => {
    const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })
    const CardViewportStub = defineComponent({
      name: 'CardViewport',
      props: {
        face: Object,
        clipToFace: Boolean,
      },
      emits: ['face-dimension-change'],
      setup(_, { slots }) {
        return () => h('div', { class: 'card-viewport-stub' }, slots.info?.())
      },
    })
    const wrapper = shallowMount(CardDesignEditor, {
      props: {
        filePath: 'draft://53e4786d-a867-4a8c-b235-cbedb03ea801',
        fileName: 'UNTITLED.opencard',
        modelValue: JSON.stringify(createDocument()),
        cardDesignerView: {
          activeFace: 'back',
          clipToFace: false,
          selectedInstanceId: null,
        },
      },
      global: {
        plugins: [i18n],
        stubs: {
          CardViewport: CardViewportStub,
          OcCard: { template: '<div><slot /></div>' },
          OcPanel: { template: '<div><slot /></div>' },
          Teleport: true,
        },
      },
    })
    await nextTick()
    await nextTick()

    const viewport = wrapper.findComponent({ name: 'CardViewport' })
    expect(viewport.props('face')).toEqual(expect.objectContaining({ faceKey: 'back' }))
    expect(viewport.props('clipToFace')).toBe(false)
    expect(wrapper.find('.card-viewport-stub').text()).toContain('UNTITLED.opencard')
    expect(wrapper.find('.card-viewport-stub').text()).not.toContain('53e4786d-a867')

    const actions = wrapper.findAllComponents({ name: 'OcActionButton' })
    const viewportControls = wrapper.findComponent({ name: 'OcViewportControls' })
    expect(viewportControls.props('orientation')).toBe('vertical')
    expect(viewportControls.props('embedded')).toBe(true)
    expect(viewportControls.element.parentElement).toBe(wrapper.get('.card-design-editor__face-tools').element)
    const faceAction = actions.find((action) => action.props('action').key === 'switch-face')
    const clipAction = actions.find((action) => action.props('action').key === 'toggle-face-clip')
    expect(faceAction?.props('variant')).toBe('ghost')
    expect(faceAction?.props('action').icon).toBe('tool.flip-to-back')
    expect(clipAction?.props('variant')).toBe('ghost')
    faceAction?.vm.$emit('select', { key: 'switch-face' })
    clipAction?.vm.$emit('select', { key: 'toggle-face-clip' })
    await nextTick()

    expect(faceAction?.props('action').icon).toBe('tool.flip-to-front')

    const viewUpdates = wrapper.emitted('update-card-designer-view') ?? []
    expect(viewUpdates[viewUpdates.length - 1]?.[0]).toEqual({
      activeFace: 'front',
      clipToFace: true,
      selectedInstanceId: null,
    })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('modified')).toBeUndefined()

    viewport.vm.$emit('face-dimension-change', { dimension: 'width', value: 600, final: false })
    viewport.vm.$emit('face-dimension-change', { dimension: 'width', value: 600, final: true })
    await nextTick()
    const contentUpdates = wrapper.emitted('update:modelValue') ?? []
    const latestContent = contentUpdates[contentUpdates.length - 1]?.[0]
    expect(JSON.parse(String(latestContent)).width).toBe('600')
    expect(wrapper.emitted('modified')?.[0]?.[0]).toBe(true)
  })

  it('fills a simple-container child without changing its anchor', async () => {
    const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })
    const CardViewportStub = defineComponent({
      name: 'CardViewport',
      props: { selectedBlockId: String },
      emits: ['block-click', 'selection-action'],
      template: '<div class="card-viewport-stub" />',
    })
    const wrapper = shallowMount(CardDesignEditor, {
      props: {
        filePath: 'D:/Project/cards/hero.opencard',
        fileName: 'hero.opencard',
        modelValue: JSON.stringify(createDocument()),
      },
      global: {
        plugins: [i18n],
        stubs: {
          CardViewport: CardViewportStub,
          OcCard: { template: '<div><slot /></div>' },
          OcPanel: { template: '<div><slot /></div>' },
          Teleport: true,
        },
      },
    })
    await nextTick()

    const viewport = wrapper.findComponent({ name: 'CardViewport' })
    viewport.vm.$emit('block-click', 'text-1', new MouseEvent('click'))
    await nextTick()
    expect(viewport.props('selectedBlockId')).toBe('text-1')

    viewport.vm.$emit('selection-action', { type: 'fill-parent', key: 'text-1' })
    await nextTick()

    const updates = wrapper.emitted('update:modelValue') ?? []
    const document = JSON.parse(String(updates[updates.length - 1]?.[0])) as CardDocument
    const container = document.faces.front.children[0]!.block
    expect(container.type).toBe('simple-container-block')
    if (container.type !== 'simple-container-block') return
    const child = container.children[0]!
    expect(child.block).toMatchObject({ width: '100%', height: '100%' })
    expect(child.location).toMatchObject({ anchor: 'lt', x: '0px', y: '0px' })
  })

  it('fits the viewport when opening a card file without refitting content updates', async () => {
    const fitView = vi.fn()
    const CardViewportStub = defineComponent({
      name: 'CardViewport',
      props: {
        transform: Object,
      },
      emits: ['viewport-size-change'],
      setup(_, { expose }) {
        expose({ fitView })
        return {}
      },
      template: '<div class="card-viewport-stub" />',
    })
    const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })
    const wrapper = shallowMount(CardDesignEditor, {
      props: {
        filePath: 'D:/Project/cards/hero.opencard',
        fileName: 'hero.opencard',
        modelValue: JSON.stringify(createDocument()),
        viewportTransform: { x: 80, y: -40, scale: 2 },
      },
      global: {
        plugins: [i18n],
        stubs: {
          CardViewport: CardViewportStub,
          OcCard: { template: '<div><slot /></div>' },
          OcPanel: { template: '<div><slot /></div>' },
          Teleport: true,
        },
      },
    })
    await nextTick()

    const viewport = wrapper.findComponent({ name: 'CardViewport' })
    expect(viewport.props('transform')).toEqual({ x: 0, y: 0, scale: 1 })
    viewport.vm.$emit('viewport-size-change', { width: 1000, height: 800 })
    await nextTick()
    expect(fitView).toHaveBeenCalledTimes(1)

    const updatedDocument = createDocument()
    updatedDocument.name = 'Updated Document'
    await wrapper.setProps({ modelValue: JSON.stringify(updatedDocument) })
    await nextTick()
    expect(fitView).toHaveBeenCalledTimes(1)

    await wrapper.setProps({ filePath: 'D:/Project/cards/other.opencard' })
    await nextTick()
    expect(fitView).toHaveBeenCalledTimes(2)
  })

  it('maps canvas keyboard shortcuts to viewport selection commands', async () => {
    const nudgeSelection = vi.fn(() => true)
    const runSelectionQuickAction = vi.fn(() => true)
    const stepLayer = vi.fn()
    const focusLayerBlock = vi.fn()
    const getFocusedLayerBlockId = vi.fn(() => 'container-1')
    const cycleLayerByInitial = vi.fn(() => true)
    const CardViewportStub = defineComponent({
      name: 'CardViewport',
      props: {
        selectedBlockId: String,
        selectionActionLabels: Object,
        layerViewActive: Boolean,
        spaceModifierActive: Boolean,
        layerViewShortcutLegendLabel: String,
        layerViewShortcutHints: Array,
        face: Object,
      },
      emits: ['block-click', 'blank-click', 'z-index-step'],
      setup(_, { expose }) {
        expose({
          nudgeSelection,
          runSelectionQuickAction,
          stepLayer,
          focusLayerBlock,
          getFocusedLayerBlockId,
          cycleLayerByInitial,
        })
        return {}
      },
      template: '<div class="card-viewport-stub"><input class="shortcut-input" /></div>',
    })
    const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })
    const source = createDocument()
    source.faces.front.children[0]!.block.zIndex = '2'
    const wrapper = shallowMount(CardDesignEditor, {
      props: {
        filePath: 'D:/Project/cards/hero.opencard',
        fileName: 'hero.opencard',
        modelValue: JSON.stringify(source),
      },
      global: {
        plugins: [i18n],
        stubs: {
          CardViewport: CardViewportStub,
          OcCard: { template: '<div><slot /></div>' },
          OcPanel: { template: '<div><slot /></div>' },
          Teleport: true,
        },
      },
    })
    await nextTick()

    const viewport = wrapper.findComponent({ name: 'CardViewport' })
    viewport.vm.$emit('block-click', 'text-1', new MouseEvent('click'))
    await nextTick()

    const labels = viewport.props('selectionActionLabels') as Record<string, string>
    expect(labels).toMatchObject({
      fillParent: 'Fill parent (F)',
      centerInParent: 'Center in parent (C)',
      inset: 'Inset 10 px (I)',
      outset: 'Outset 10 px (O)',
    })
    expect(viewport.props('layerViewShortcutLegendLabel')).toBe('Layer view shortcuts')
    expect(viewport.props('layerViewShortcutHints')).toEqual([
      { keys: ['Wheel', '↑ / ↓'], label: 'Step through planes' },
      { keys: ['Shift', 'Wheel', '↑ / ↓'], label: 'Jump between layers' },
      { keys: ['A-Z'], label: 'Cycle by name initial' },
      { keys: ['Shift', 'A-Z'], label: 'Cycle names in current layer' },
      { keys: ['Space'], label: 'Select the focused plane' },
      { keys: ['Space', 'Wheel', '↑ / ↓'], label: 'Adjust zIndex' },
      {
        keys: ['Shift', 'Space', 'Wheel', '↑ / ↓'],
        label: 'Switch to an existing layer',
      },
    ])

    const root = wrapper.get('.card-design-editor')
    await root.trigger('keydown', { key: 'Tab' })
    expect(viewport.props('layerViewActive')).toBe(true)
    expect(wrapper.get('.card-design-editor__stage').classes()).toContain('is-layer-view-active')
    await root.trigger('keydown', { key: 'ArrowUp' })
    await root.trigger('keydown', { key: 'ArrowDown' })
    await root.trigger('keydown', { key: 'ArrowDown', shiftKey: true })
    expect(stepLayer.mock.calls).toEqual([[-1, false], [1, false], [1, true]])
    await root.trigger('keydown', { key: 'a' })
    await root.trigger('keydown', { key: 'A', shiftKey: true })
    await root.trigger('keydown', { key: 'f' })
    expect(cycleLayerByInitial.mock.calls).toEqual([
      ['a', false],
      ['A', true],
      ['f', false],
    ])
    expect(runSelectionQuickAction).not.toHaveBeenCalled()

    await root.trigger('keydown', { key: ' ', code: 'Space' })
    await nextTick()
    expect(viewport.props('selectedBlockId')).toBe('container-1')
    expect(focusLayerBlock).not.toHaveBeenCalled()
    window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space' }))
    viewport.vm.$emit('block-click', 'text-1', new MouseEvent('click'))
    getFocusedLayerBlockId.mockReturnValue('text-1')
    await nextTick()

    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Tab' }))
    await nextTick()
    expect(viewport.props('layerViewActive')).toBe(false)
    expect(wrapper.get('.card-design-editor__stage').classes()).not.toContain('is-layer-view-active')

    await root.trigger('keydown', { key: ' ', code: 'Space' })
    expect(viewport.props('spaceModifierActive')).toBe(true)
    await root.trigger('keydown', { key: 'ArrowUp' })
    window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space' }))
    await nextTick()
    expect(viewport.props('spaceModifierActive')).toBe(false)
    const projectedFace = viewport.props('face') as {
      children: Array<{ block: { children: Array<{ block: { zIndex: number } }> } }>
    }
    expect(projectedFace.children[0]?.block.children[0]?.block.zIndex).toBe(1)
    expect(focusLayerBlock).toHaveBeenCalledWith('text-1')

    await root.trigger('keydown', { key: ' ', code: 'Space', shiftKey: true })
    await root.trigger('keydown', { key: 'ArrowUp', shiftKey: true })
    window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space' }))
    await nextTick()
    const shiftedFace = viewport.props('face') as {
      children: Array<{ block: { children: Array<{ block: { zIndex: number } }> } }>
    }
    expect(shiftedFace.children[0]?.block.children[0]?.block.zIndex).toBe(2)

    await root.trigger('keydown', { key: ' ', code: 'Space' })
    viewport.vm.$emit('z-index-step', { delta: -1, existingLayersOnly: false })
    window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space' }))
    await nextTick()
    const wheelAdjustedFace = viewport.props('face') as {
      children: Array<{ block: { children: Array<{ block: { zIndex: number } }> } }>
    }
    expect(wheelAdjustedFace.children[0]?.block.children[0]?.block.zIndex).toBe(1)

    await root.trigger('keydown', { key: 'ArrowRight' })
    await root.trigger('keydown', { key: 'ArrowUp', shiftKey: true })
    await root.trigger('keydown', { key: 'f' })
    await root.trigger('keydown', { key: 'C' })
    await root.trigger('keydown', { key: 'i' })
    await root.trigger('keydown', { key: 'o' })

    expect(nudgeSelection).toHaveBeenNthCalledWith(1, 1, 0)
    expect(nudgeSelection).toHaveBeenNthCalledWith(2, 0, -10)
    expect(runSelectionQuickAction.mock.calls).toEqual([
      ['fill-parent'],
      ['center'],
      ['inset'],
      ['outset'],
    ])

    await wrapper.get('.shortcut-input').trigger('keydown', { key: 'ArrowLeft' })
    expect(nudgeSelection).toHaveBeenCalledTimes(2)
    await wrapper.get('.shortcut-input').trigger('keydown', { key: 'Tab' })
    expect(viewport.props('layerViewActive')).toBe(false)

    viewport.vm.$emit('blank-click', new MouseEvent('click'))
    await nextTick()
    expect(viewport.props('selectedBlockId')).toBeNull()
    await root.trigger('keydown', { key: 'Tab' })
    await root.trigger('keydown', { key: ' ', code: 'Space' })
    await nextTick()
    expect(viewport.props('selectedBlockId')).toBe('text-1')
    window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space' }))
    window.dispatchEvent(new Event('blur'))
    await nextTick()
    expect(viewport.props('layerViewActive')).toBe(false)
  })

  it('fills and centers a flow child only on the cross axis', async () => {
    const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })
    const source = createDocument()
    source.faces.front.children[0]!.block = createFlowContainerBlock({
      id: 'flow-1',
      direction: 'lr',
      children: [{
        block: createTextBlock({ id: 'flow-text', width: '120px', height: '40px' }),
        location: { id: 'flow-location', type: 'flow-container-location', index: '0', align: 'start' },
      }],
    })
    const CardViewportStub = defineComponent({
      name: 'CardViewport',
      emits: ['block-click', 'selection-action'],
      template: '<div class="card-viewport-stub" />',
    })
    const wrapper = shallowMount(CardDesignEditor, {
      props: {
        filePath: 'D:/Project/cards/flow.opencard',
        fileName: 'flow.opencard',
        modelValue: JSON.stringify(source),
      },
      global: {
        plugins: [i18n],
        stubs: {
          CardViewport: CardViewportStub,
          OcCard: { template: '<div><slot /></div>' },
          OcPanel: { template: '<div><slot /></div>' },
          Teleport: true,
        },
      },
    })
    await nextTick()

    const viewport = wrapper.findComponent({ name: 'CardViewport' })
    viewport.vm.$emit('block-click', 'flow-text', new MouseEvent('click'))
    await nextTick()
    viewport.vm.$emit('selection-action', { type: 'fill-cross-axis', key: 'flow-text' })
    await nextTick()

    let updates = wrapper.emitted('update:modelValue') ?? []
    let document = JSON.parse(String(updates[updates.length - 1]?.[0])) as CardDocument
    let flow = document.faces.front.children[0]!.block
    expect(flow.type).toBe('flow-container-block')
    if (flow.type !== 'flow-container-block') return
    expect(flow.children[0]!.block).toMatchObject({ width: '120px', height: '100%' })
    expect(flow.children[0]!.location.align).toBe('justify')

    viewport.vm.$emit('selection-action', { type: 'center-cross-axis', key: 'flow-text' })
    await nextTick()
    updates = wrapper.emitted('update:modelValue') ?? []
    document = JSON.parse(String(updates[updates.length - 1]?.[0])) as CardDocument
    flow = document.faces.front.children[0]!.block
    if (flow.type !== 'flow-container-block') return
    expect(flow.children[0]!.location.align).toBe('center')
  })

  it('keeps face tools visible and right-aligned when both right panels are collapsed', async () => {
    const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })
    const wrapper = shallowMount(CardDesignEditor, {
      props: {
        filePath: 'D:/Project/cards/hero.opencard',
        fileName: 'hero.opencard',
        modelValue: JSON.stringify(createDocument()),
        cardDesignerLayout: {
          panels: {
            instanceExpanded: true,
            previewExpanded: true,
            structureExpanded: false,
            propertyExpanded: false,
          },
          leftTopHeight: null,
          rightTopHeight: null,
        },
      },
      global: {
        plugins: [i18n],
        stubs: {
          CardViewport: true,
          OcCard: { template: '<div><slot /></div>' },
          OcPanel: { template: '<div><slot /></div>' },
          Teleport: true,
        },
      },
    })
    await nextTick()

    const tools = wrapper.get('.card-design-editor__face-tools')
    expect(tools.classes()).toContain('is-right-sidebar-collapsed')
    const viewportControls = tools.findComponent({ name: 'OcViewportControls' })
    expect(viewportControls.exists()).toBe(true)
    expect(tools.findAllComponents({ name: 'OcActionButton' })).toHaveLength(2)
  })

  it('slides full-width sidebars through the stage edges and snaps symmetrically', async () => {
    const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })
    const wrapper = shallowMount(CardDesignEditor, {
      props: {
        filePath: 'D:/Project/cards/hero.opencard',
        fileName: 'hero.opencard',
        modelValue: JSON.stringify(createDocument()),
      },
      global: {
        plugins: [i18n],
        stubs: {
          CardViewport: true,
          OcCard: { template: '<div><slot /></div>' },
          OcPanel: { template: '<div><slot /></div>' },
          Teleport: true,
        },
      },
    })
    await nextTick()

    const root = wrapper.get('.card-design-editor').element as HTMLElement
    const flushSidebarSnap = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const leftSidebar = wrapper.get('.card-design-editor__sidebar--left')
    const rightSidebar = wrapper.get('.card-design-editor__sidebar--right')
    expect(leftSidebar.classes()).not.toContain('is-width-clipped')
    expect(rightSidebar.classes()).not.toContain('is-width-clipped')
    expect(root.style.getPropertyValue('--card-editor-left-sidebar-edge-inset')).toBe('6px')
    expect(root.style.getPropertyValue('--card-editor-right-sidebar-edge-inset')).toBe('6px')
    const leftResizebar = wrapper.get('[aria-label="调整左侧栏宽度"]')
    leftResizebar.element.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      clientX: 320,
    }))
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 220 }))
    expect(root.style.getPropertyValue('--card-editor-left-panel-width')).toBe('280px')
    expect(root.style.getPropertyValue('--card-editor-left-sidebar-visible-width')).toBe('220px')
    expect(root.style.getPropertyValue('--card-editor-left-sidebar-edge-inset')).toBe('4.71px')
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 220 }))
    await flushSidebarSnap()
    expect(root.style.getPropertyValue('--card-editor-left-sidebar-visible-width')).toBe('280px')
    expect(root.style.getPropertyValue('--card-editor-left-sidebar-edge-inset')).toBe('6px')

    leftResizebar.element.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      clientX: 320,
    }))
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 240 }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 240 }))
    await flushSidebarSnap()
    expect(root.style.getPropertyValue('--card-editor-left-sidebar-visible-width')).toBe('0px')
    expect(root.style.getPropertyValue('--card-editor-left-sidebar-edge-inset')).toBe('0px')

    leftResizebar.element.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      clientX: 100,
    }))
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 300 }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 300 }))
    await flushSidebarSnap()
    expect(root.style.getPropertyValue('--card-editor-left-sidebar-visible-width')).toBe('280px')
    expect(root.style.getPropertyValue('--card-editor-left-sidebar-edge-inset')).toBe('6px')

    const rightResizebar = wrapper.get('[aria-label="调整右侧栏宽度"]')
    rightResizebar.element.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      clientX: 700,
    }))
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 800 }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 800 }))
    await flushSidebarSnap()
    expect(root.style.getPropertyValue('--card-editor-right-panel-width')).toBe('280px')
    expect(root.style.getPropertyValue('--card-editor-right-sidebar-visible-width')).toBe('280px')

    rightResizebar.element.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      clientX: 700,
    }))
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 780 }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 780 }))
    await flushSidebarSnap()
    expect(root.style.getPropertyValue('--card-editor-right-sidebar-visible-width')).toBe('0px')
    expect(root.style.getPropertyValue('--card-editor-right-sidebar-edge-inset')).toBe('0px')

    rightResizebar.element.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      clientX: 900,
    }))
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 880 }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 880 }))
    await flushSidebarSnap()
    expect(root.style.getPropertyValue('--card-editor-right-sidebar-visible-width')).toBe('0px')

    rightResizebar.element.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      clientX: 900,
    }))
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 870 }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 870 }))
    await flushSidebarSnap()
    expect(root.style.getPropertyValue('--card-editor-right-sidebar-visible-width')).toBe('280px')
    expect(root.style.getPropertyValue('--card-editor-right-sidebar-edge-inset')).toBe('6px')

    rightResizebar.element.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      clientX: 700,
    }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 700 }))
    await flushSidebarSnap()
    expect(root.style.getPropertyValue('--card-editor-right-sidebar-visible-width')).toBe('0px')

    rightResizebar.element.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      clientX: 700,
    }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 700 }))
    await flushSidebarSnap()
    expect(root.style.getPropertyValue('--card-editor-right-sidebar-visible-width')).toBe('280px')

    rightResizebar.element.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      clientX: 700,
    }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 700 }))
    await flushSidebarSnap()
    expect(root.style.getPropertyValue('--card-editor-right-sidebar-visible-width')).toBe('0px')

    rightResizebar.element.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      clientX: 700,
    }))
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 280 }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 280 }))
    await flushSidebarSnap()
    expect(root.style.getPropertyValue('--card-editor-right-panel-width')).toBe('420px')
    expect(root.style.getPropertyValue('--card-editor-right-sidebar-visible-width')).toBe('420px')
  })
})
