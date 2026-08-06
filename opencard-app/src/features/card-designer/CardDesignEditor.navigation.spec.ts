import { defineComponent, h, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import { shallowMount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createCardFace,
  createFlowContainerBlock,
  createImageBlock,
  createSimpleContainerBlock,
  createTextBlock,
  type CardDocument,
} from '../../entities/card/model'
import enUS from '../../locales/en-US'
import type { IconToken } from '../../shared/ui/icon/iconTokens'
import type { SessionNavigationToken } from '../editor-runtime/model/editorIssue'
import { fileSystemService } from '../workspace/services/fileSystemService'
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

  it('toggles structure containers through double-click activation', async () => {
    const OcTreeStub = defineComponent({
      name: 'OcTree',
      props: {
        role: String,
        activationMode: String,
        expandedKeys: Array,
      },
      emits: ['intent'],
      template: '<div />',
    })
    const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })
    const wrapper = shallowMount(CardDesignEditor, {
      props: {
        filePath: 'card.ocdocument',
        modelValue: JSON.stringify(createDocument()),
      },
      global: {
        plugins: [i18n],
        stubs: {
          OcTree: OcTreeStub,
          OcCard: { template: '<div><slot /></div>' },
          OcPanel: { template: '<div><slot /></div>' },
          Teleport: true,
        },
      },
    })
    const structureTree = wrapper.findAllComponents(OcTreeStub)
      .find(tree => tree.props('role') !== 'listbox')!

    expect(structureTree.props('activationMode')).toBe('double-click')
    structureTree.vm.$emit('intent', { type: 'node.activate', key: 'container-1' })
    await nextTick()
    expect(structureTree.props('expandedKeys')).toContain('container-1')

    structureTree.vm.$emit('intent', { type: 'node.activate', key: 'container-1' })
    await nextTick()
    expect(structureTree.props('expandedKeys')).not.toContain('container-1')
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
        filePath: 'card.ocdocument',
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

  it('shows reset after an instance Block field is overridden', async () => {
    const PropertyEditorStub = defineComponent({
      name: 'PropertyEditor',
      props: { inputs: Array },
      emits: ['update-property'],
      setup(_, { expose }) {
        expose({ revealField: vi.fn().mockResolvedValue(true) })
        return () => h('div')
      },
    })
    const OcTreeStub = defineComponent({
      name: 'OcTree',
      props: { role: String, selectedKeys: Array },
      emits: ['intent'],
      template: '<div />',
    })
    const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })
    const wrapper = shallowMount(CardDesignEditor, {
      props: {
        filePath: 'card.ocdocument',
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

    const trees = wrapper.findAllComponents(OcTreeStub)
    const instanceTree = trees.find(tree => tree.props('role') === 'listbox')!
    const structureTree = trees.find(tree => tree.props('role') !== 'listbox')!
    instanceTree.vm.$emit('intent', {
      type: 'selection.change',
      triggerKey: 'instance-1',
      selectedKeys: ['instance-1'],
      mode: 'replace',
      input: 'left',
    })
    structureTree.vm.$emit('intent', {
      type: 'selection.change',
      triggerKey: 'text-1',
      selectedKeys: ['text-1'],
      mode: 'replace',
      input: 'left',
    })
    await nextTick()

    const propertyEditor = wrapper.findComponent({ name: 'PropertyEditor' })
    propertyEditor.vm.$emit('update-property', {
      key: 'text-1',
      fieldKey: 'content',
      value: 'Instance title',
    })
    await nextTick()

    const inputs = propertyEditor.props('inputs') as Array<{
      key: string
      fields: Record<string, { resettable?: boolean }>
    }>
    expect(inputs.find(input => input.key === 'text-1')?.fields.content?.resettable).toBe(true)
  })

  it('keeps data-table mode and reveals a block field Cell', async () => {
    const document = createDocument()
    document.dataTable = { blocks: { 'text-1': ['content'] } }
    const revealCell = vi.fn().mockResolvedValue(true)
    const CardDataTableStub = defineComponent({
      name: 'CardDataTable',
      setup(_, { expose }) {
        expose({ revealCell })
        return () => h('div', { class: 'card-data-table-stub' })
      },
    })
    const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })
    const wrapper = shallowMount(CardDesignEditor, {
      props: {
        filePath: 'card.ocdocument',
        modelValue: JSON.stringify(document),
        cardDesignerMode: 'data-table',
        cardDesignerView: {
          activeFace: 'front',
          clipToFace: false,
          selectedInstanceId: null,
        },
      },
      global: {
        plugins: [i18n],
        stubs: {
          CardDataTable: CardDataTableStub,
          Teleport: true,
        },
      },
    })
    await nextTick()

    const result = await (wrapper.vm as unknown as {
      navigate: (value: SessionNavigationToken) => Promise<string>
    }).navigate({
      protocol: 'card-designer',
      version: 2,
      target: {
        kind: 'property',
        instanceId: 'instance-1',
        faceKey: 'front',
        blockId: 'text-1',
        owner: 'block',
        fieldKey: 'content',
        characterOffset: 2,
      },
    })

    expect(result).toBe('success')
    expect(revealCell).toHaveBeenCalledWith('instance-1', 'text-1', 'content', 2)
    expect(wrapper.find('.card-data-table-stub').exists()).toBe(true)
    const viewUpdates = wrapper.emitted('update-card-designer-view') ?? []
    expect(viewUpdates[viewUpdates.length - 1]?.[0]).toMatchObject({
      selectedInstanceId: 'instance-1',
    })
  })

  it('marks a data-table instance Cell as resettable after editing it', async () => {
    const document = createDocument()
    document.dataTable = { blocks: { 'text-1': ['content'] } }
    const CardDataTableStub = defineComponent({
      name: 'CardDataTable',
      props: { faceGroups: Array },
      emits: ['update-cell'],
      template: '<div />',
    })
    const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })
    const wrapper = shallowMount(CardDesignEditor, {
      props: {
        filePath: 'card.ocdocument',
        modelValue: JSON.stringify(document),
        cardDesignerMode: 'data-table',
      },
      global: {
        plugins: [i18n],
        stubs: { CardDataTable: CardDataTableStub, Teleport: true },
      },
    })
    const table = wrapper.findComponent({ name: 'CardDataTable' })
    table.vm.$emit('update-cell', {
      cardId: 'instance-1',
      blockId: 'text-1',
      fieldKey: 'content',
      value: 'Instance title',
    })
    await nextTick()

    const faceGroups = table.props('faceGroups') as Array<{
      blocks: Array<{ fields: Array<{ cells: Array<{ cardId: string; overridden: boolean }> }> }>
    }>
    const instanceCell = faceGroups[0]?.blocks[0]?.fields[0]?.cells
      .find(cell => cell.cardId === 'instance-1')
    expect(instanceCell?.overridden).toBe(true)
  })

  it('returns from data-table mode to PropertyEditor for a non-block issue', async () => {
    const revealField = vi.fn().mockResolvedValue(true)
    const PropertyEditorStub = defineComponent({
      name: 'PropertyEditor',
      setup(_, { expose }) {
        expose({ revealField })
        return () => h('div', { class: 'property-editor-stub' })
      },
    })
    const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })
    const wrapper = shallowMount(CardDesignEditor, {
      props: {
        filePath: 'card.ocdocument',
        modelValue: JSON.stringify(createDocument()),
        cardDesignerMode: 'data-table',
        cardDesignerView: {
          activeFace: 'front',
          clipToFace: false,
          selectedInstanceId: null,
        },
      },
      global: {
        plugins: [i18n],
        stubs: {
          PropertyEditor: PropertyEditorStub,
          OcCard: { template: '<div><slot /></div>' },
          OcPanel: { template: '<div><slot /></div>' },
          Teleport: true,
        },
      },
    })
    await nextTick()

    const navigation = (wrapper.vm as unknown as {
      navigate: (value: SessionNavigationToken) => Promise<string>
    }).navigate({
      protocol: 'card-designer',
      version: 2,
      target: {
        kind: 'property',
        instanceId: null,
        faceKey: null,
        owner: 'document',
        fieldKey: 'version',
      },
    })
    await nextTick()
    expect(wrapper.emitted('update:card-designer-mode')).toEqual([['design']])
    await wrapper.setProps({ cardDesignerMode: 'design' })
    const result = await navigation

    expect(result).toBe('success')
    expect(revealField).toHaveBeenCalledWith('document-1', 'version', undefined)
    expect(wrapper.find('.property-editor-stub').exists()).toBe(true)
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
        filePath: 'D:/Project/cards/hero.ocdocument',
        fileName: 'hero.ocdocument',
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
      'cards/hero.ocdocument',
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
      'cards/hero.ocdocument',
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
        alignmentSnappingEnabled: Boolean,
      },
      emits: ['face-dimension-change'],
      setup(_, { slots }) {
        return () => h('div', { class: 'card-viewport-stub' }, slots.info?.())
      },
    })
    const wrapper = shallowMount(CardDesignEditor, {
      props: {
        filePath: 'draft://53e4786d-a867-4a8c-b235-cbedb03ea801',
        fileName: 'UNTITLED.ocdocument',
        modelValue: JSON.stringify(createDocument()),
        cardDesignerView: {
          activeFace: 'back',
          clipToFace: false,
          selectedInstanceId: null,
        },
        alignmentSnappingEnabledByDefault: false,
      },
      global: {
        plugins: [i18n],
        stubs: {
          CardViewport: CardViewportStub,
          OcOverlayToolbar: false,
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
    expect(viewport.props('alignmentSnappingEnabled')).toBe(false)
    expect(wrapper.find('.card-viewport-stub').text()).toContain('UNTITLED.ocdocument')
    expect(wrapper.find('.card-viewport-stub').text()).not.toContain('53e4786d-a867')

    const actions = wrapper.findAllComponents({ name: 'OcActionButton' })
    const viewportControls = wrapper.findComponent({ name: 'OcViewportControls' })
    expect(viewportControls.props('orientation')).toBe('vertical')
    expect(viewportControls.props('embedded')).toBe(true)
    expect(viewportControls.props('buttonSize')).toBe('sm')
    expect(viewportControls.props('iconSize')).toBe('action')
    expect(viewportControls.element.parentElement).toBe(wrapper.get('.card-design-editor__face-tools').element)
    const faceAction = actions.find((action) => action.props('action').key === 'switch-face')
    const clipAction = actions.find((action) => action.props('action').key === 'toggle-face-clip')
    const alignmentSnappingAction = actions.find(
      action => action.props('action').key === 'toggle-alignment-snapping',
    )
    expect(faceAction?.props('variant')).toBe('ghost')
    expect(faceAction?.props('size')).toBe('sm')
    expect(faceAction?.props('iconSize')).toBe('action')
    expect(faceAction?.props('action').icon).toBe('tool.flip-to-back')
    expect(clipAction?.props('variant')).toBe('ghost')
    expect(clipAction?.props('size')).toBe('sm')
    expect(clipAction?.props('iconSize')).toBe('action')
    expect(clipAction?.props('action').icon).toBe('tool.box-cutter-off')
    expect(alignmentSnappingAction?.props('variant')).toBe('ghost')
    expect(alignmentSnappingAction?.props('size')).toBe('sm')
    expect(alignmentSnappingAction?.props('iconSize')).toBe('action')
    expect(alignmentSnappingAction?.props('action').icon).toBe('tool.snap-grid')
    faceAction?.vm.$emit('select', { key: 'switch-face' })
    clipAction?.vm.$emit('select', { key: 'toggle-face-clip' })
    alignmentSnappingAction?.vm.$emit('select', { key: 'toggle-alignment-snapping' })
    await nextTick()

    expect(faceAction?.props('action').icon).toBe('tool.flip-to-front')
    expect(clipAction?.props('action').icon).toBe('tool.box-cutter')
    expect(alignmentSnappingAction?.props('variant')).toBe('soft')
    expect(alignmentSnappingAction?.props('action').icon).toBe('tool.snap-grid-on')
    expect(viewport.props('alignmentSnappingEnabled')).toBe(true)

    const viewUpdates = wrapper.emitted('update-card-designer-view') ?? []
    expect(viewUpdates[viewUpdates.length - 1]?.[0]).toEqual({
      activeFace: 'front',
      clipToFace: true,
      alignmentSnappingEnabled: true,
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
        filePath: 'D:/Project/cards/hero.ocdocument',
        fileName: 'hero.ocdocument',
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

    viewport.vm.$emit('selection-action', { type: 'fill-parent', blockId: 'text-1' })
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

  it('projects rich-text selection Actions and activates the existing content field editor', async () => {
    const activateField = vi.fn(async () => true)
    const CardViewportStub = defineComponent({
      name: 'CardViewport',
      props: {
        selectedBlockId: String,
        selectionCommandActions: Array,
      },
      emits: ['block-click', 'selection-command'],
      template: '<div class="card-viewport-stub" />',
    })
    const PropertyEditorStub = defineComponent({
      name: 'PropertyEditor',
      setup(_, { expose }) {
        expose({ activateField, revealField: vi.fn(async () => true) })
        return () => h('div', { class: 'property-editor-stub' })
      },
    })
    const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })
    const wrapper = shallowMount(CardDesignEditor, {
      props: {
        filePath: 'D:/Project/cards/hero.ocdocument',
        fileName: 'hero.ocdocument',
        modelValue: JSON.stringify(createDocument()),
      },
      global: {
        plugins: [i18n],
        stubs: {
          CardViewport: CardViewportStub,
          PropertyEditor: PropertyEditorStub,
          OcCard: { template: '<div><slot /></div>' },
          OcPanel: { template: '<div><slot /></div>' },
          Teleport: true,
        },
      },
    })
    await nextTick()

    const viewport = wrapper.findComponent(CardViewportStub)
    viewport.vm.$emit('block-click', 'text-1', new MouseEvent('click'))
    await nextTick()
    expect(viewport.props('selectionCommandActions')).toEqual([{
      key: 'content.edit-rich-text',
      icon: 'format.text-variant-outline',
      title: 'Edit rich text',
    }])

    viewport.vm.$emit('selection-command', {
      key: 'content.edit-rich-text',
      blockId: 'text-1',
    })
    await nextTick()
    expect(activateField).toHaveBeenCalledWith('text-1', 'content')
  })

  it('projects four Flow Container direction Actions and writes each direction through Block commands', async () => {
    const source = createDocument()
    source.faces.front.children[0]!.block = createFlowContainerBlock({
      id: 'flow-1',
      direction: 'lr',
    })
    const CardViewportStub = defineComponent({
      name: 'CardViewport',
      props: {
        selectedBlockId: String,
        selectionCommandActions: Array,
      },
      emits: ['block-click', 'selection-command'],
      template: '<div class="card-viewport-stub" />',
    })
    const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })
    const wrapper = shallowMount(CardDesignEditor, {
      props: {
        filePath: 'D:/Project/cards/flow.ocdocument',
        fileName: 'flow.ocdocument',
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

    const viewport = wrapper.findComponent(CardViewportStub)
    viewport.vm.$emit('block-click', 'flow-1', new MouseEvent('click'))
    await nextTick()
    expect(viewport.props('selectionCommandActions')).toEqual([
      { key: 'flow.direction.left', icon: 'nav.arrow-left', iconTone: 'default', title: 'Flow left' },
      { key: 'flow.direction.up', icon: 'nav.arrow-up', iconTone: 'default', title: 'Flow up' },
      { key: 'flow.direction.down', icon: 'nav.arrow-down', iconTone: 'default', title: 'Flow down' },
      { key: 'flow.direction.right', icon: 'nav.arrow-right', iconTone: 'primary', title: 'Flow right' },
    ])

    const directions = [
      ['flow.direction.left', 'rl'],
      ['flow.direction.up', 'bt'],
      ['flow.direction.down', 'tb'],
      ['flow.direction.right', 'lr'],
    ] as const
    for (const [key, direction] of directions) {
      viewport.vm.$emit('selection-command', { key, blockId: 'flow-1' })
      await nextTick()
      const updates = wrapper.emitted('update:modelValue') ?? []
      const document = JSON.parse(String(updates[updates.length - 1]?.[0])) as CardDocument
      expect(document.faces.front.children[0]!.block).toMatchObject({ direction })
    }
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
        filePath: 'D:/Project/cards/hero.ocdocument',
        fileName: 'hero.ocdocument',
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

    await wrapper.setProps({ filePath: 'D:/Project/cards/other.ocdocument' })
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
        filePath: 'D:/Project/cards/hero.ocdocument',
        fileName: 'hero.ocdocument',
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
      {
        keys: [{ icon: 'input.mouse-scroll-wheel' }, { separator: 'or' }, '↑ / ↓'],
        label: 'Step through planes',
      },
      {
        keys: [
          { icon: 'input.keyboard-shift' },
          { icon: 'input.mouse-scroll-wheel' },
          { separator: 'or' },
          '↑ / ↓',
        ],
        label: 'Jump between layers',
      },
      { keys: ['A-Z'], label: 'Cycle by name or Pinyin initial' },
      {
        keys: [{ icon: 'input.keyboard-shift' }, 'A-Z'],
        label: 'Cycle names or Pinyin in current layer',
      },
      { keys: [{ icon: 'input.keyboard-space' }], label: 'Select the focused plane' },
      {
        keys: [
          { icon: 'input.keyboard-space' },
          { icon: 'input.mouse-scroll-wheel' },
          { separator: 'or' },
          '↑ / ↓',
        ],
        label: 'Adjust zIndex',
      },
      {
        keys: [
          { icon: 'input.keyboard-shift' },
          { icon: 'input.keyboard-space' },
          { icon: 'input.mouse-scroll-wheel' },
          { separator: 'or' },
          '↑ / ↓',
        ],
        label: 'Switch to an existing layer',
      },
    ])

    const root = wrapper.get('.card-design-editor')
    await root.trigger('keydown', { key: 'Tab' })
    expect(viewport.props('layerViewActive')).toBe(true)
    expect(wrapper.get('.card-design-editor__stage').classes()).toContain('is-layer-view-active')
    await root.trigger('keydown', { key: 'ArrowUp' })
    await root.trigger('keydown', { key: 'a' })
    expect(stepLayer).toHaveBeenCalledWith(-1, false)
    expect(cycleLayerByInitial).toHaveBeenCalledWith('a', false)
    expect(runSelectionQuickAction).not.toHaveBeenCalled()

    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Tab' }))
    await root.trigger('keydown', { key: ' ', code: 'Space' })
    await nextTick()
    expect(viewport.props('selectedBlockId')).toBe('container-1')
    window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space' }))
    viewport.vm.$emit('block-click', 'text-1', new MouseEvent('click'))
    getFocusedLayerBlockId.mockReturnValue('text-1')
    await nextTick()

    await root.trigger('keydown', { key: ' ', code: 'Space' })
    await root.trigger('keydown', { key: 'ArrowUp' })
    window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space' }))
    await nextTick()
    const projectedFace = viewport.props('face') as {
      children: Array<{ block: { children: Array<{ block: { zIndex: number } }> } }>
    }
    expect(projectedFace.children[0]?.block.children[0]?.block.zIndex).toBe(1)
    expect(focusLayerBlock).toHaveBeenCalledWith('text-1')

    viewport.vm.$emit('z-index-step', { delta: -1, existingLayersOnly: false })
    await nextTick()
    const wheelAdjustedFace = viewport.props('face') as {
      children: Array<{ block: { children: Array<{ block: { zIndex: number } }> } }>
    }
    expect(wheelAdjustedFace.children[0]?.block.children[0]?.block.zIndex).toBe(0)

    await root.trigger('keydown', { key: 'ArrowRight' })
    await root.trigger('keydown', { key: 'f' })
    expect(nudgeSelection).toHaveBeenCalledWith(1, 0)
    expect(runSelectionQuickAction).toHaveBeenCalledWith('fill-parent')

    await wrapper.get('.shortcut-input').trigger('keydown', { key: 'ArrowLeft' })
    expect(nudgeSelection).toHaveBeenCalledTimes(1)
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
        filePath: 'D:/Project/cards/flow.ocdocument',
        fileName: 'flow.ocdocument',
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
    viewport.vm.$emit('selection-action', { type: 'fill-cross-axis', blockId: 'flow-text' })
    await nextTick()

    let updates = wrapper.emitted('update:modelValue') ?? []
    let document = JSON.parse(String(updates[updates.length - 1]?.[0])) as CardDocument
    let flow = document.faces.front.children[0]!.block
    expect(flow.type).toBe('flow-container-block')
    if (flow.type !== 'flow-container-block') return
    expect(flow.children[0]!.block).toMatchObject({ width: '120px', height: '100%' })
    expect(flow.children[0]!.location.align).toBe('justify')

    viewport.vm.$emit('selection-action', { type: 'center-cross-axis', blockId: 'flow-text' })
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
        filePath: 'D:/Project/cards/hero.ocdocument',
        fileName: 'hero.ocdocument',
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
          OcOverlayToolbar: false,
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
    expect(tools.findAllComponents({ name: 'OcActionButton' })).toHaveLength(3)
  })

  it('slides full-width sidebars through the stage edges and snaps symmetrically', async () => {
    const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })
    const wrapper = shallowMount(CardDesignEditor, {
      props: {
        filePath: 'D:/Project/cards/hero.ocdocument',
        fileName: 'hero.ocdocument',
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

  it('renders the Card Designer mode controlled by its prop', async () => {
    const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })
    const wrapper = shallowMount(CardDesignEditor, {
      props: {
        filePath: 'card.ocdocument',
        modelValue: JSON.stringify(createDocument()),
        cardDesignerMode: 'data-table',
        cardDesignerView: {
          activeFace: 'front',
          clipToFace: false,
          selectedInstanceId: null,
        },
      },
      global: { plugins: [i18n] },
    })
    await nextTick()

    const table = wrapper.findComponent({ name: 'CardDataTable' })
    expect(table.exists()).toBe(true)
    expect((table.props('faceGroups') as Array<{ blocks: unknown[] }>)[0]?.blocks).toEqual([])
    expect(wrapper.find('.card-design-editor__face-tools').exists()).toBe(false)

    table.vm.$emit('add-block', 'text-1')
    await nextTick()
    const blockUpdates = wrapper.emitted('update:modelValue') ?? []
    const blockConfiguredDocument = JSON.parse(String(blockUpdates[blockUpdates.length - 1]?.[0])) as CardDocument
    expect(blockConfiguredDocument.dataTable?.blocks).toEqual({ 'text-1': [] })
    table.vm.$emit('include-field', 'text-1', 'content')
    await nextTick()
    const configuredGroups = table.props('faceGroups') as Array<{
      blocks: Array<{ key: string; fields: Array<{ key: string }> }>
    }>
    expect(configuredGroups[0]?.blocks).toEqual([
      expect.objectContaining({ key: 'text-1', fields: [expect.objectContaining({ key: 'content' })] }),
    ])
    const contentUpdates = wrapper.emitted('update:modelValue') ?? []
    const configuredDocument = JSON.parse(String(contentUpdates[contentUpdates.length - 1]?.[0])) as CardDocument
    expect(configuredDocument.dataTable?.blocks).toEqual({ 'text-1': ['content'] })
    const modifiedUpdates = wrapper.emitted('modified') ?? []
    expect(modifiedUpdates[modifiedUpdates.length - 1]?.[0]).toBe(true)

    await wrapper.setProps({ cardDesignerMode: 'design' })
    await nextTick()
    expect(wrapper.findComponent({ name: 'CardDataTable' }).exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'OcOptionGroup' }).exists()).toBe(false)
  })

  it('keeps delete as a stable toggle and uses one property sort action', async () => {
    const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })
    const OcCardStub = defineComponent({
      name: 'OcCard',
      props: ['title', 'actions'],
      emits: ['action'],
      template: '<div><slot /></div>',
    })
    const wrapper = shallowMount(CardDesignEditor, {
      props: {
        filePath: 'card.ocdocument',
        modelValue: JSON.stringify(createDocument()),
      },
      global: {
        plugins: [i18n],
        stubs: {
          OcCard: OcCardStub,
          OcPanel: { template: '<div><slot /></div>' },
          PropertyEditor: false,
        },
      },
    })
    await nextTick()

    const propertyCard = wrapper.findAllComponents(OcCardStub)
      .find(card => card.props('title') === '属性')!
    const getAction = (key: string) => (propertyCard.props('actions') as Array<{
      key: string
      icon: IconToken
      disabled?: boolean
    }>).find(action => action.key === key)!
    const propertyEditor = wrapper.getComponent({ name: 'PropertyEditor' })

    expect(getAction('toggle-property-sort').icon).toBe('action.sort-alphabetical-ascending')
    propertyCard.vm.$emit('action', { key: 'toggle-property-sort' })
    await nextTick()
    expect(propertyEditor.props('sortMode')).toBe('alphabetical')
    expect(getAction('toggle-property-sort').icon).toBe('action.sort-category')

    propertyCard.vm.$emit('action', { key: 'toggle-property-delete-mode' })
    await nextTick()
    expect(propertyEditor.props('deleteMode')).toBe(true)
    expect(wrapper.findAllComponents({ name: 'PropertyFieldActionRail' })
      .some(rail => rail.props('actions')?.some(
        (action: { key: string }) => action.key === 'delete-property',
      ))).toBe(true)
    expect(getAction('toggle-property-delete-mode').disabled).toBeUndefined()
  })

  it('creates a custom field for the explicit table Block and persists it in the document', async () => {
    const document = createDocument()
    document.dataTable = { blocks: { 'text-1': [] } }
    const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })
    const wrapper = shallowMount(CardDesignEditor, {
      props: {
        filePath: 'card.ocdocument',
        modelValue: JSON.stringify(document),
        cardDesignerMode: 'data-table',
        cardDesignerView: {
          activeFace: 'front',
          clipToFace: false,
          selectedInstanceId: null,
        },
      },
      global: { plugins: [i18n] },
    })
    await nextTick()

    wrapper.getComponent({ name: 'CardDataTable' }).vm.$emit('create-field', 'text-1')
    await nextTick()
    const dialog = wrapper.getComponent({ name: 'AdditionalFieldCreateDialog' })
    expect(dialog.props('open')).toBe(true)
    dialog.vm.$emit('update-field-key', 'score')
    dialog.vm.$emit('update-field-type', 'number')
    dialog.vm.$emit('update-title', 'Score')
    await nextTick()
    dialog.vm.$emit('submit')
    await nextTick()

    const contentUpdates = wrapper.emitted('update:modelValue') ?? []
    const updatedDocument = JSON.parse(String(contentUpdates[contentUpdates.length - 1]?.[0])) as CardDocument
    const textBlock = (updatedDocument.faces.front.children[0]!.block as ReturnType<typeof createSimpleContainerBlock>)
      .children[0]!.block
    expect(textBlock.additionalFieldDefinition?.score).toMatchObject({ fieldType: 'number', title: 'Score' })

    expect(updatedDocument.dataTable?.blocks).toEqual({ 'text-1': ['score'] })
    expect(dialog.props('open')).toBe(false)
  })

  it('builds binding completion from each data-table column card', async () => {
    const document = createDocument()
    document.dataTable = { blocks: { 'text-1': ['content'] } }
    const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })
    const wrapper = shallowMount(CardDesignEditor, {
      props: {
        filePath: 'card.ocdocument',
        modelValue: JSON.stringify(document),
        cardDesignerMode: 'data-table',
        cardDesignerView: {
          activeFace: 'front',
          clipToFace: false,
          selectedInstanceId: null,
        },
      },
      global: { plugins: [i18n] },
    })
    await nextTick()

    const table = wrapper.findComponent({ name: 'CardDataTable' })
    const faceGroups = table.props('faceGroups') as Array<{
      blocks: Array<{
        key: string
        fields: Array<{
          key: string
          definition: Record<string, unknown>
          cells: Array<{ cardId: string; identity: string }>
        }>
      }>
    }>
    const content = faceGroups[0]?.blocks.find(block => block.key === 'text-1')
      ?.fields.find(field => field.key === 'content')
    expect(content).toBeDefined()
    const getDefinition = table.props('getCellDefinition') as (
      blockId: string,
      field: typeof content,
      cell: NonNullable<typeof content>['cells'][number],
    ) => { completion?: { provider?: (request: { value: string; cursor: number }) => unknown } }
    const completionItems = async (cellIndex: number) => {
      const definition = getDefinition('text-1', content, content!.cells[cellIndex]!)
      const result = await Promise.resolve(definition.completion?.provider?.({ value: '{{card:}}', cursor: 7 })) as {
        items?: Array<{ insertText: string }>
      } | null
      return result?.items?.map(item => item.insertText) ?? []
    }

    expect(await completionItems(0)).toContain('card:version')
    expect(await completionItems(1)).not.toContain('card:version')
    expect(await completionItems(1)).toContain('card:name')
  })

  it('provides file and font completion to data-table Cells', async () => {
    const document = createDocument()
    document.faces.front.children.push({
      block: createImageBlock({ id: 'image-1', name: 'Portrait', image: '' }),
      location: { id: 'location-image', type: 'simple-container-location', anchor: 'lt' },
    })
    document.dataTable = {
      blocks: {
        'text-1': ['content', 'fontFamily'],
        'image-1': ['image'],
      },
    }
    const readDirectoryEntries = vi.spyOn(fileSystemService, 'readDirectoryEntries').mockResolvedValue([{
      name: 'portrait.png',
      isDirectory: false,
      isFile: true,
      isSymlink: false,
    }])
    const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })
    const wrapper = shallowMount(CardDesignEditor, {
      props: {
        filePath: 'D:/Project/cards/card.ocdocument',
        resourceRootPath: 'D:/Project',
        modelValue: JSON.stringify(document),
        cardDesignerMode: 'data-table',
        cardDesignerView: {
          activeFace: 'front',
          clipToFace: false,
          selectedInstanceId: null,
        },
      },
      global: { plugins: [i18n] },
    })
    await nextTick()

    const table = wrapper.findComponent({ name: 'CardDataTable' })
    const faceGroups = table.props('faceGroups') as Array<{
      blocks: Array<{
        key: string
        fields: Array<{
          key: string
          cells: Array<{ cardId: string; identity: string }>
        }>
      }>
    }>
    const getDefinition = table.props('getCellDefinition') as (
      blockId: string,
      field: { key: string; cells: Array<{ cardId: string; identity: string }> },
      cell: { cardId: string; identity: string },
    ) => {
      completion?: { provider?: (request: { value: string; cursor: number }) => unknown }
      directoryProvider?: (directory: string) => Promise<Array<{ name: string }>>
      fontOptions?: Array<{ value: string }>
    }
    const textBlock = faceGroups[0]!.blocks.find(block => block.key === 'text-1')!
    const fontField = textBlock.fields.find(field => field.key === 'fontFamily')!
    const fontDefinition = getDefinition('text-1', fontField, fontField.cells[0]!)
    const fontResult = await Promise.resolve(fontDefinition.completion?.provider?.({ value: 'Arial', cursor: 5 })) as {
      items?: Array<{ value?: string }>
    } | null
    const contentField = textBlock.fields.find(field => field.key === 'content')!
    const contentDefinition = getDefinition('text-1', contentField, contentField.cells[0]!)

    const imageBlock = faceGroups[0]!.blocks.find(block => block.key === 'image-1')!
    const imageField = imageBlock.fields.find(field => field.key === 'image')!
    const imageDefinition = getDefinition('image-1', imageField, imageField.cells[0]!)
    const imageEntries = await imageDefinition.directoryProvider?.('')

    expect(fontResult?.items?.map(item => item.value)).toContain('Arial')
    expect(contentDefinition.fontOptions?.map(item => item.value)).toContain('Arial')
    expect(imageEntries?.map(item => item.name)).toContain('portrait.png')
    expect(readDirectoryEntries).toHaveBeenCalledWith('D:/Project', 1, '')
    readDirectoryEntries.mockRestore()
  })
})
