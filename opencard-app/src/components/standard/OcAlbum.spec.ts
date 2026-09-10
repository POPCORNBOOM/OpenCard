import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { OcNode, OcNodeCollection } from '../../shared/ui/node/node.types'
import OcAlbum from './OcAlbum.vue'

function createData(options: {
  roots?: string[]
  items?: Array<[string, OcNode]>
} = {}): OcNodeCollection {
  const items = options.items ?? [['root', { label: 'Root', icon: 'file.package' }]]
  return {
    rootKeys: options.roots ?? items.map(([key]) => key),
    items: new Map(items),
    children: new Map(),
  }
}

describe('OcAlbum', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders one card per root key and ignores nested children', () => {
    const wrapper = mount(OcAlbum, {
      props: {
        data: {
          rootKeys: ['root', 'second'],
          items: new Map<string, OcNode>([
            ['root', { label: 'Root', icon: 'file.package' }],
            ['second', { label: 'Second', icon: 'file.package' }],
            ['nested', { label: 'Nested', icon: 'file.package' }],
          ]),
          children: new Map([['root', ['nested']]]),
        },
      },
    })

    expect(wrapper.findAll('[data-oc-album-key]')).toHaveLength(2)
    expect(wrapper.find('[data-oc-album-key="nested"]').exists()).toBe(false)
  })

  it('prefers a resolved cover image over the node icon and exposes its label', () => {
    const wrapper = mount(OcAlbum, {
      props: {
        data: createData({
          items: [['root', {
            label: 'Theme',
            icon: 'file.package',
            thumbnailSrc: 'asset://cover.png',
            thumbnailLabel: 'Theme cover',
          }]],
        }),
      },
    })

    const image = wrapper.get('.oc-album__cover-image')
    expect(image.attributes('src')).toBe('asset://cover.png')
    expect(image.attributes('alt')).toBe('Theme cover')
    expect(wrapper.find('.oc-album__cover .oc-icon').exists()).toBe(false)
  })

  it('renders text and status-badge tail parts without turning them into actions', () => {
    const wrapper = mount(OcAlbum, {
      props: {
        data: createData({
          items: [['root', {
            label: 'Theme',
            icon: 'file.package',
            tail: ['Local', { type: 'badge', label: 'Missing', icon: 'status.warning', tone: 'warning' }],
          }]],
        }),
      },
    })

    expect(wrapper.get('.oc-album__tail').text()).toContain('Local')
    const badge = wrapper.get('.oc-album__tail-badge')
    expect(badge.attributes('aria-label')).toBe('Missing')
    expect(badge.attributes('data-tooltip')).toBe('Missing')
    expect(wrapper.find('.oc-album__tail button').exists()).toBe(false)
  })

  it('reports the card key and action key when a card action is invoked', async () => {
    const wrapper = mount(OcAlbum, {
      props: {
        data: createData({
          items: [['theme', {
            label: 'Theme',
            icon: 'file.package',
            actions: [{
              key: 'remove',
              title: 'No longer needed',
              icon: 'action.delete',
              iconTone: 'danger',
            }],
          }]],
        }),
      },
    })

    await wrapper.get('button[aria-label="No longer needed"]').trigger('click')

    expect(wrapper.emitted('action')).toEqual([[
      { key: 'theme', actionKey: 'remove', source: 'inline' },
    ]])
  })

  it('keeps a disabled action visible with its reason and does not invoke it', async () => {
    const wrapper = mount(OcAlbum, {
      props: {
        data: createData({
          items: [['theme', {
            label: 'Theme',
            icon: 'file.package',
            actions: [{
              key: 'remove',
              title: 'Remove',
              icon: 'action.delete',
              disabled: true,
              disabledReason: 'Required',
            }],
          }]],
        }),
      },
    })

    const button = wrapper.get('button[aria-label="Remove: Required"]')
    expect(button.attributes('disabled')).toBeDefined()
    await button.trigger('click')
    expect(wrapper.emitted('action')).toBeUndefined()
  })

  it('emits a selection change for the clicked card', async () => {
    const wrapper = mount(OcAlbum, {
      props: {
        data: createData({
          items: [
            ['first', { label: 'First', icon: 'file.package' }],
            ['second', { label: 'Second', icon: 'file.package' }],
          ],
        }),
        selectedKeys: ['first'],
      },
    })

    expect(wrapper.get('[data-oc-album-key="first"] .oc-album__card').classes()).toContain('is-selected')
    await wrapper.get('[data-oc-album-key="second"] .oc-album__card').trigger('click')

    expect(wrapper.emitted('selection-change')).toEqual([[
      { triggerKey: 'second', selectedKeys: ['second'] },
    ]])
  })

  it('stays inert when selection is disabled', async () => {
    const wrapper = mount(OcAlbum, {
      props: {
        data: createData(),
        selectionMode: 'none',
        activationMode: 'none',
      },
    })

    const card = wrapper.get('.oc-album__card')
    expect(card.attributes('role')).toBe('listitem')
    await card.trigger('click')

    expect(wrapper.emitted('selection-change')).toBeUndefined()
    expect(wrapper.emitted('node-activate')).toBeUndefined()
  })

  it('activates a card on double click when the consumer asks for it', async () => {
    const wrapper = mount(OcAlbum, {
      props: {
        data: createData(),
        activationMode: 'double-click',
      },
    })

    await wrapper.get('.oc-album__card').trigger('dblclick')

    expect(wrapper.emitted('node-activate')).toEqual([[{ key: 'root' }]])
  })

  it('shows the placeholder while there is nothing to render', () => {
    const wrapper = mount(OcAlbum, {
      props: {
        data: createData({ roots: [], items: [] }),
        placeholder: 'No packages',
      },
    })

    expect(wrapper.classes()).toContain('is-empty')
    expect(wrapper.get('.oc-album__placeholder').text()).toBe('No packages')
  })
})
