import { defineComponent, h, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import { shallowMount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCardFace, createSimpleContainerBlock, createTextBlock, type CardDocument } from '../../entities/card/model'
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

  it('switches face and clipping through session state without modifying the document', async () => {
    const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })
    const wrapper = shallowMount(CardDesignEditor, {
      props: {
        filePath: 'card.opencard',
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

    const actions = wrapper.findAllComponents({ name: 'OcActionButton' })
    const faceAction = actions.find((action) => action.props('action').key === 'switch-face')
    const clipAction = actions.find((action) => action.props('action').key === 'toggle-face-clip')
    faceAction?.vm.$emit('select', { key: 'switch-face' })
    clipAction?.vm.$emit('select', { key: 'toggle-face-clip' })
    await nextTick()

    const viewUpdates = wrapper.emitted('update-card-designer-view') ?? []
    expect(viewUpdates[viewUpdates.length - 1]?.[0]).toEqual({
      activeFace: 'front',
      clipToFace: true,
      selectedInstanceId: null,
    })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('modified')).toBeUndefined()
  })
})
