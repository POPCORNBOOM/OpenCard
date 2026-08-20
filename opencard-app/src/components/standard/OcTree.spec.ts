import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  OcTreeActionDefinition,
  OcTreeData,
  OcTreeItem,
  OcTreeIntent,
} from '../../shared/ui/tree/tree.types'
import OcTree from './OcTree.vue'
import OcActionButton from './OcActionButton.vue'
import { useFloatingMenu } from '../../composables/useFloatingMenu'

function createData(options: {
  roots?: string[]
  items?: Array<[string, OcTreeItem]>
  children?: Array<[string, string[]]>
} = {}): OcTreeData {
  return {
    rootKeys: options.roots ?? ['root'],
    items: new Map(options.items ?? [
      ['root', { label: 'Root', icon: 'data.collection', renamable: true }],
    ]),
    children: new Map(options.children ?? []),
  }
}

function rect(width: number, height: number): DOMRect {
  return {
    x: 0, y: 0, top: 0, right: width, bottom: height, left: 0, width, height,
    toJSON: () => ({}),
  }
}

describe('OcTree', () => {
  afterEach(() => {
    useFloatingMenu().closeMenu()
    vi.restoreAllMocks()
  })

  it('renders roots as list rows and emits key-only selection intent', async () => {
    const wrapper = mount(OcTree, {
      props: {
        data: createData({
          roots: ['first', 'second'],
          items: [
            ['first', { label: 'First' }],
            ['second', { label: 'Second' }],
          ],
        }),
        selectedKeys: ['second'],
      },
    })

    expect(wrapper.findAll('[data-oc-tree-key]')).toHaveLength(2)
    expect(wrapper.get('[data-oc-tree-key="second"]').classes()).toContain('is-selected')

    await wrapper.get('[data-oc-tree-key="first"] .oc-tree__row').trigger('click')
    expect(wrapper.emitted<OcTreeIntent[]>('intent')?.[0]).toEqual([{
      type: 'selection.change',
      triggerKey: 'first',
      selectedKeys: ['first'],
      mode: 'replace',
      input: 'left',
    }])
  })

  it('opts atlas crop thumbnails into the shared project-icon renderer', () => {
    const wrapper = mount(OcTree, {
      props: {
        data: createData({
          items: [['root', {
            label: 'Icon',
            thumbnailStyle: { '--oc-project-icon-renderer': 'atlas-crop' },
          }]],
        }),
      },
    })
    expect(wrapper.get('.oc-tree__thumbnail').classes()).toContain('oc-project-icon')
  })

  it.each([
    ['expand', ['open', 'parent', 'root']],
    ['expand-exclusive', ['parent', 'root']],
  ] as const)('requests %s selection ancestor expansion from tree topology', async (mode, expectedKeys) => {
    const wrapper = mount(OcTree, {
      props: {
        data: createData({
          items: [
            ['root', { label: 'Root' }],
            ['parent', { label: 'Parent' }],
            ['child', { label: 'Child' }],
          ],
          children: [
            ['root', ['parent']],
            ['parent', ['child']],
          ],
        }),
        selectedKeys: ['child'],
        expandedKeys: ['open'],
        selectionExpansionMode: mode,
      },
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted<OcTreeIntent[]>('intent')).toContainEqual([{
      type: 'expansion.sync',
      expandedKeys: expectedKeys,
      reason: 'selection',
    }])
  })

  it('keeps expanded descendants of the selected branch in expand-exclusive mode', async () => {
    const wrapper = mount(OcTree, {
      props: {
        data: createData({
          roots: ['root', 'other'],
          items: [
            ['root', { label: 'Root' }],
            ['parent', { label: 'Parent' }],
            ['selected', { label: 'Selected' }],
            ['child', { label: 'Child' }],
            ['other', { label: 'Other' }],
          ],
          children: [
            ['root', ['parent']],
            ['parent', ['selected']],
            ['selected', ['child']],
          ],
        }),
        selectedKeys: ['selected'],
        expandedKeys: ['other', 'selected', 'child'],
        selectionExpansionMode: 'expand-exclusive',
      },
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted<OcTreeIntent[]>('intent')).toContainEqual([{
      type: 'expansion.sync',
      expandedKeys: ['parent', 'root', 'selected', 'child'],
      reason: 'selection',
    }])
  })

  it('keeps every selected branch visible in expand-exclusive mode', async () => {
    const wrapper = mount(OcTree, {
      props: {
        data: createData({
          roots: ['left-root', 'right-root'],
          items: [
            ['left-root', { label: 'Left root' }],
            ['left-child', { label: 'Left child' }],
            ['right-root', { label: 'Right root' }],
            ['right-child', { label: 'Right child' }],
          ],
          children: [
            ['left-root', ['left-child']],
            ['right-root', ['right-child']],
          ],
        }),
        selectedKeys: ['left-child', 'right-child'],
        expandedKeys: ['left-child'],
        selectionMode: 'multiple',
        selectionExpansionMode: 'expand-exclusive',
      },
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted<OcTreeIntent[]>('intent')).toContainEqual([{
      type: 'expansion.sync',
      expandedKeys: ['left-root', 'right-root', 'left-child'],
      reason: 'selection',
    }])
  })

  it('scrolls the tree viewport to a selected row only when enabled', async () => {
    const data = createData({
      roots: ['first', 'second'],
      items: [
        ['first', { label: 'First' }],
        ['second', { label: 'Second' }],
      ],
    })
    const wrapper = mount(OcTree, {
      props: {
        data,
        selectedKeys: ['first'],
        scrollToSelection: false,
        fill: true,
      },
    })
    const root = wrapper.get('.oc-tree').element as HTMLElement
    const secondRow = wrapper.get('[data-oc-tree-key="second"] .oc-tree__row').element as HTMLElement
    root.scrollTop = 0
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({
      top: 0, bottom: 100, left: 0, right: 200, width: 200, height: 100, x: 0, y: 0,
      toJSON: () => ({}),
    })
    vi.spyOn(secondRow, 'getBoundingClientRect').mockReturnValue({
      top: 120, bottom: 150, left: 0, right: 200, width: 200, height: 30, x: 0, y: 120,
      toJSON: () => ({}),
    })

    await wrapper.setProps({ selectedKeys: ['second'] })
    expect(root.scrollTop).toBe(0)

    await wrapper.setProps({ scrollToSelection: true })
    await wrapper.vm.$nextTick()
    expect(root.scrollTop).toBe(50)
  })

  it('windows a thousand fixed-height rows and reveals an offscreen selection', async () => {
    const keys = Array.from({ length: 1000 }, (_, index) => `item-${index}`)
    const wrapper = mount(OcTree, {
      props: {
        data: createData({
          roots: keys,
          items: keys.map(key => [key, { label: key }]),
        }),
        fill: true,
        virtualized: true,
        scrollToSelection: true,
      },
    })

    expect(wrapper.findAll('[data-oc-tree-key]').length).toBeLessThanOrEqual(12)
    await wrapper.setProps({ selectedKeys: ['item-999'] })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    const selectedRow = wrapper.get('[data-oc-tree-key="item-999"] .oc-tree__row')
    expect(selectedRow.attributes()).toMatchObject({
      'aria-posinset': '1000',
      'aria-setsize': '1000',
      tabindex: '0',
    })
    expect(wrapper.findAll('[data-oc-tree-key]').length).toBeLessThanOrEqual(12)
  })
  it('renders expanded children and rotates the node type icon', () => {
    const wrapper = mount(OcTree, {
      props: {
        data: createData({
          items: [
            ['root', { label: 'Root', icon: 'data.collection' }],
            ['child', { label: 'Child' }],
          ],
          children: [['root', ['child']]],
        }),
        expandedKeys: ['root'],
      },
    })

    expect(wrapper.findAll('[data-oc-tree-key]')).toHaveLength(2)
    expect(wrapper.get('[data-oc-tree-key="child"]').attributes('style')).toContain('12px')
    expect(wrapper.get('[data-oc-tree-key="root"] .oc-tree__node-icon').classes()).toContain('is-expanded')
    expect(wrapper.get('[data-oc-tree-key="root"] .oc-tree__child-count').classes()).toContain('is-expanded')
    expect(wrapper.get('[data-oc-tree-key="root"] .oc-tree__branch-guide').attributes('data-guide-rows')).toBe('1')
    expect(wrapper.find('[data-oc-tree-key="root"] .oc-tree__branch-connector').exists()).toBe(false)
    expect(wrapper.find('[data-oc-tree-key="child"] .oc-tree__branch-connector').exists()).toBe(true)
    expect(wrapper.find('[data-oc-tree-key="child"] .oc-tree__branch-guide').exists()).toBe(false)
  })

  it('can leave the tree out of Tab order while pointer focus keeps keyboard interaction active', async () => {
    const wrapper = mount(OcTree, {
      attachTo: document.body,
      props: {
        data: createData({
          roots: ['root', 'child'],
          items: [
            ['root', { label: 'Root', actions: ['move'] }],
            ['child', { label: 'Child', actions: ['move'] }],
          ],
        }),
        actions: new Map<string, OcTreeActionDefinition>([
          ['move', { title: 'Move', icon: 'action.drag' }],
        ]),
        tabNavigation: 'none',
      },
    })

    expect(wrapper.findAll('.oc-tree__row').map(row => row.attributes('tabindex'))).toEqual(['-1', '-1'])
    expect(wrapper.findAll('.oc-tree__controls button').map(button => button.attributes('tabindex'))).toEqual(['-1', '-1'])
    await wrapper.get('[data-oc-tree-key="child"] .oc-tree__row').trigger('click')
    expect(document.activeElement).toBe(wrapper.get('[data-oc-tree-key="child"] .oc-tree__row').element)
    wrapper.unmount()
  })

  it.each([
    [3, '3'],
    [100, '99+'],
  ])('shows %i direct children as the %s icon badge', (childCount, expectedBadge) => {
    const childKeys = Array.from({ length: childCount }, (_, index) => `child-${index}`)
    const wrapper = mount(OcTree, {
      props: {
        data: createData({
          items: [
            ['root', { label: 'Root', icon: 'data.collection' }],
            ...childKeys.map((key): [string, OcTreeItem] => [key, { label: key }]),
          ],
          children: [['root', childKeys]],
        }),
      },
    })

    expect(wrapper.get('.oc-tree__child-count').text()).toBe(expectedBadge)
    expect(wrapper.get('.oc-tree__child-count').classes()).toContain('oc-number-badge')
  })

  it('emits expansion changes without mutating controlled state', async () => {
    const wrapper = mount(OcTree, {
      props: {
        data: createData({
          items: [
            ['root', { label: 'Root' }],
            ['child', { label: 'Child' }],
          ],
          children: [['root', ['child']]],
        }),
      },
    })

    await wrapper.get('.oc-tree__icon-slot').trigger('click')
    expect(wrapper.emitted<OcTreeIntent[]>('intent')?.[0]).toEqual([{
      type: 'expansion.change',
      key: 'root',
      expanded: true,
    }])
    expect(wrapper.find('[data-oc-tree-key="child"]').exists()).toBe(false)
  })

  it('keeps rename draft local and emits a rename commit on Enter', async () => {
    const data = createData()
    const wrapper = mount(OcTree, { props: { data } })

    await (wrapper.vm as unknown as { beginRename: (key: string) => Promise<void> })
      .beginRename('root')
    const input = wrapper.get('input')
    await input.setValue('Renamed')
    await input.trigger('keydown', { key: 'Enter' })

    expect(data.items.get('root')?.label).toBe('Root')
    expect(wrapper.emitted<OcTreeIntent[]>('intent')).toEqual([[
      { type: 'rename.commit', key: 'root', name: 'Renamed' },
    ]])
  })

  it('applies the consumer-provided rename selection range', async () => {
    const wrapper = mount(OcTree, {
      props: {
        data: createData({
          items: [['root', {
            label: 'archive.tar.gz',
            renamable: true,
            renameSelection: { start: 0, end: 11 },
          }]],
        }),
      },
    })

    await (wrapper.vm as unknown as { beginRename: (key: string) => Promise<void> })
      .beginRename('root')

    const input = wrapper.get('input').element as HTMLInputElement
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 11])
  })

  it('commits rename on a real focus change and cancels it on Escape', async () => {
    const wrapper = mount(OcTree, { attachTo: document.body, props: { data: createData() } })
    const tree = wrapper.vm as unknown as { beginRename: (key: string) => Promise<void> }

    await tree.beginRename('root')
    await wrapper.get('input').setValue('Blurred')
    ;(wrapper.get('.oc-tree__row').element as HTMLElement).focus()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted<OcTreeIntent[]>('intent')).toEqual([[
      { type: 'rename.commit', key: 'root', name: 'Blurred' },
    ]])

    await tree.beginRename('root')
    await wrapper.get('input').setValue('Cancelled')
    await wrapper.get('input').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.emitted<OcTreeIntent[]>('intent')).toHaveLength(1)
    wrapper.unmount()
  })

  it('keeps rename actions generic until the parent calls beginRename', async () => {
    const wrapper = mount(OcTree, {
      attachTo: document.body,
      props: {
        data: createData({
          items: [['root', {
            label: 'Root',
            renamable: true,
            actions: ['rename'],
          }]],
        }),
        actions: new Map<string, OcTreeActionDefinition>([
          ['rename', { title: 'Rename', icon: 'action.edit' }],
        ]),
      },
    })

    expect(wrapper.find('button[aria-label="Rename"]').exists()).toBe(true)
    await wrapper.get('button[aria-label="Rename"]').trigger('click')
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.emitted<OcTreeIntent[]>('intent')).toEqual([[
      { type: 'action.invoke', key: 'root', actionKey: 'rename', source: 'inline' },
    ]])

    await (wrapper.vm as unknown as { beginRename: (key: string) => Promise<void> })
      .beginRename('root')
    expect(wrapper.get('input').element).toBe(document.activeElement)
    wrapper.unmount()
  })

  it('requests parent-owned rename orchestration on F2', async () => {
    const wrapper = mount(OcTree, { props: { data: createData() } })

    await wrapper.get('.oc-tree__row').trigger('keydown', { key: 'F2' })

    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.emitted<OcTreeIntent[]>('intent')).toEqual([[
      { type: 'rename.request', key: 'root' },
    ]])
  })

  it.each([
    ['tree', 'treeitem'],
    ['listbox', 'option'],
    ['menu', 'menuitem'],
  ] as const)('maps the %s role onto its rows', (role, rowRole) => {
    const wrapper = mount(OcTree, {
      props: { data: createData(), role, selectionMode: role === 'menu' ? 'none' : 'single' },
    })

    expect(wrapper.get('.oc-tree').attributes('role')).toBe(role)
    expect(wrapper.get('.oc-tree__row').attributes('role')).toBe(rowRole)
  })

  it('emits controlled multiple selection and keyboard expansion intents', async () => {
    const wrapper = mount(OcTree, {
      props: {
        data: createData({
          roots: ['root', 'second'],
          items: [
            ['root', { label: 'Root' }],
            ['child', { label: 'Child' }],
            ['second', { label: 'Second' }],
          ],
          children: [['root', ['child']]],
        }),
        selectedKeys: ['root'],
        selectionMode: 'multiple',
      },
    })

    await wrapper.get('[data-oc-tree-key="second"] .oc-tree__row').trigger('click', { ctrlKey: true })
    await wrapper.get('[data-oc-tree-key="root"] .oc-tree__row').trigger('keydown', { key: 'ArrowRight' })

    expect(wrapper.emitted<OcTreeIntent[]>('intent')).toEqual([
      [{
        type: 'selection.change',
        triggerKey: 'second',
        selectedKeys: ['root', 'second'],
        mode: 'toggle',
        input: 'left',
      }],
      [{ type: 'expansion.change', key: 'root', expanded: true }],
    ])
  })

  it('keeps middle-button selection distinct from primary selection', async () => {
    const wrapper = mount(OcTree, {
      props: {
        data: createData({
          roots: ['root', 'second'],
          items: [
            ['root', { label: 'Root' }],
            ['second', { label: 'Second' }],
          ],
        }),
        selectedKeys: ['root'],
        selectionMode: 'multiple',
      },
    })

    await wrapper.get('[data-oc-tree-key="second"] .oc-tree__row').trigger('auxclick', { button: 1, ctrlKey: true })

    expect(wrapper.emitted<OcTreeIntent[]>('intent')?.[0]).toEqual([{
      type: 'selection.change',
      triggerKey: 'second',
      selectedKeys: ['root', 'second'],
      mode: 'toggle',
      input: 'middle',
    }])
  })

  it('selects the visible range from the selection anchor with Shift', async () => {
    const wrapper = mount(OcTree, {
      props: {
        data: createData({
          roots: ['first', 'second', 'third'],
          items: [
            ['first', { label: 'First' }],
            ['second', { label: 'Second' }],
            ['third', { label: 'Third' }],
          ],
        }),
        selectedKeys: ['first'],
        selectionMode: 'multiple',
      },
    })

    await wrapper.get('[data-oc-tree-key="third"] .oc-tree__row').trigger('click', { shiftKey: true })

    expect(wrapper.emitted<OcTreeIntent[]>('intent')?.[0]).toEqual([{
      type: 'selection.change',
      triggerKey: 'third',
      selectedKeys: ['first', 'second', 'third'],
      mode: 'range',
      input: 'left',
    }])
  })

  it('shows only declared actions and keeps disabled actions visible with their reason', async () => {
    const actions = new Map<string, OcTreeActionDefinition>([
      ['duplicate', { title: 'Duplicate', icon: 'action.copy' }],
      ['delete', { title: 'Delete', icon: 'action.delete' }],
    ])
    const wrapper = mount(OcTree, {
      props: {
        data: createData({
          items: [['root', {
            label: 'Root',
            tail: 'Metadata',
            actions: ['duplicate', 'delete'],
            disabledActions: new Map([['delete', 'Protected']]),
          }]],
        }),
        actions,
      },
    })

    await wrapper.get('button[aria-label="Duplicate"]').trigger('click')
    expect(wrapper.get('.oc-tree__tail').text()).toBe('Metadata')
    expect(wrapper.get('button[aria-label="Delete: Protected"]').attributes('disabled')).toBeDefined()
    expect(wrapper.emitted<OcTreeIntent[]>('intent')).toEqual([[
      { type: 'action.invoke', key: 'root', actionKey: 'duplicate', source: 'inline' },
    ]])
  })

  it('packs all root actions into one more menu when the row lacks label space', async () => {
    let resize: ResizeObserverCallback = () => undefined
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { resize = callback }
      observe(): void {}
      disconnect(): void {}
    })
    const actions = new Map<string, OcTreeActionDefinition>([
      ['top', { title: 'Move to top', icon: 'tool.flip-to-front' }],
      ['up', { title: 'Move up', icon: 'nav.arrow-up' }],
      ['delete', { title: 'Delete', icon: 'action.delete' }],
    ])
    const wrapper = mount(OcTree, {
      props: {
        data: createData({
          items: [['root', { label: 'A readable label', actions: ['top', 'up', 'delete'] }]],
        }),
        actions,
        actionOverflowTitle: 'Item actions',
      },
    })
    const row = wrapper.get('.oc-tree__row').element as HTMLElement
    const label = wrapper.get('.oc-tree__label').element as HTMLElement
    let controls = wrapper.get('.oc-tree__controls').element as HTMLElement
    Object.defineProperty(row, 'clientWidth', { configurable: true, value: 160 })
    vi.spyOn(label, 'getBoundingClientRect').mockReturnValue(rect(40, 28))
    vi.spyOn(controls, 'getBoundingClientRect').mockReturnValue(rect(130, 22))

    resize([], {} as ResizeObserver)
    await wrapper.vm.$nextTick()
    const overflow = wrapper.getComponent(OcActionButton)
    expect(overflow.props('action')).toMatchObject({
      title: 'Item actions',
      icon: 'nav.more',
      children: [{ key: 'top' }, { key: 'up' }, { key: 'delete' }],
    })
    overflow.vm.$emit('select', { key: 'up' })
    expect(wrapper.emitted<OcTreeIntent[]>('intent')).toContainEqual([{
      type: 'action.invoke', key: 'root', actionKey: 'up', source: 'inline',
    }])

    controls = wrapper.get('.oc-tree__controls').element as HTMLElement
    vi.spyOn(label, 'getBoundingClientRect').mockReturnValue(rect(200, 28))
    vi.spyOn(controls, 'getBoundingClientRect').mockReturnValue(rect(22, 22))
    resize([], {} as ResizeObserver)
    await wrapper.vm.$nextTick()
    expect(wrapper.findAllComponents(OcActionButton).map(button => button.props('action').key))
      .toEqual(['top', 'up', 'delete'])
  })

  it('does not render an empty inline-action container', () => {
    const wrapper = mount(OcTree, {
      props: {
        data: createData({
          items: [['root', { label: 'Root', tail: '2 weeks', actions: [] }]],
        }),
      },
    })

    expect(wrapper.find('.oc-tree__tail').exists()).toBe(true)
    expect(wrapper.find('.oc-tree__controls').exists()).toBe(false)
  })

  it('can keep inline actions visible without row interaction', () => {
    const wrapper = mount(OcTree, {
      props: {
        data: createData({
          items: [['root', { label: 'Root', tail: '2 weeks', actions: ['move'] }]],
        }),
        actions: new Map<string, OcTreeActionDefinition>([
          ['move', { title: 'Move up', icon: 'nav.arrow-up' }],
        ]),
        actionVisibility: 'always',
      },
    })

    expect(wrapper.classes()).toContain('are-actions-always-visible')
    expect(getComputedStyle(wrapper.get('.oc-tree__controls').element).visibility).toBe('visible')
    const rowChildren = Array.from(wrapper.get('.oc-tree__row').element.children)
    expect(rowChildren.indexOf(wrapper.get('.oc-tree__tail').element))
      .toBeLessThan(rowChildren.indexOf(wrapper.get('.oc-tree__controls').element))
  })

  it('opens direct context actions without exposing the inline more wrapper', async () => {
    const actions = new Map<string, OcTreeActionDefinition>([
      ['more', { title: 'More', children: ['rename', 'delete'] }],
      ['rename', { title: 'Rename', icon: 'action.edit' }],
      ['delete', { title: 'Delete', icon: 'action.delete' }],
    ])
    const wrapper = mount(OcTree, {
      props: {
        data: createData({
          items: [['root', {
            label: 'Root',
            actions: ['more'],
            contextActions: ['rename', 'delete'],
          }]],
        }),
        actions,
        selectedKeys: [],
      },
    })

    await wrapper.get('.oc-tree__row').trigger('contextmenu', { clientX: 12, clientY: 18 })
    const menu = useFloatingMenu()
    expect(menu.state.value.items.map(item => item.key)).toEqual(['rename', 'delete'])
    expect(wrapper.emitted<OcTreeIntent[]>('intent')?.[0]).toEqual([{
      type: 'selection.change',
      triggerKey: 'root',
      selectedKeys: ['root'],
      mode: 'replace',
      input: 'right',
    }])

    menu.selectMenuItem('rename')
    expect(wrapper.emitted<OcTreeIntent[]>('intent')?.[1]).toEqual([{
      type: 'action.invoke', key: 'root', actionKey: 'rename', source: 'context',
    }])
  })

  it('preserves an existing multi-selection and supports the keyboard menu key', async () => {
    const wrapper = mount(OcTree, {
      props: {
        data: createData({
          items: [['root', { label: 'Root', contextActions: ['rename'] }]],
        }),
        actions: new Map([['rename', { title: 'Rename' }]]),
        selectedKeys: ['root', 'other'],
        selectionMode: 'multiple',
      },
    })

    await wrapper.get('.oc-tree__row').trigger('keydown', { key: 'ContextMenu' })
    expect(wrapper.emitted('intent')).toBeUndefined()
    expect(useFloatingMenu().state.value.items.map(item => item.key)).toEqual(['rename'])
  })

  it('starts drag only after 4px and emits the visual drop candidate', async () => {
    const wrapper = mount(OcTree, {
      attachTo: document.body,
      props: {
        data: createData({
          roots: ['dragged', 'other', 'target'],
          items: [
            ['dragged', { label: 'Dragged', draggable: true }],
            ['other', { label: 'Other', draggable: true }],
            ['target', { label: 'Target' }],
          ],
        }),
        selectedKeys: ['dragged', 'other'],
        selectionMode: 'multiple',
      },
    })
    const draggedRow = wrapper.get('[data-oc-tree-key="dragged"] .oc-tree__row')
    const targetNode = wrapper.get('[data-oc-tree-key="target"]').element as HTMLElement
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => targetNode),
    })
    vi.spyOn(targetNode, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 140,
      left: 0,
      right: 200,
      width: 200,
      height: 40,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    })

    await draggedRow.trigger('mousedown', { button: 0, clientX: 10, clientY: 110 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 12, clientY: 111 }))
    window.dispatchEvent(new MouseEvent('mouseup'))
    expect(wrapper.emitted('intent')).toBeUndefined()

    await draggedRow.trigger('mousedown', { button: 0, clientX: 10, clientY: 110 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 20, clientY: 105 }))
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-oc-tree-key="dragged"]').classes()).toContain('is-drag-source')
    expect(wrapper.get('[data-oc-tree-key="other"]').classes()).toContain('is-drag-source')
    window.dispatchEvent(new MouseEvent('mouseup'))
    expect(wrapper.emitted<OcTreeIntent[]>('intent')).toEqual([[
      { type: 'move.request', key: 'dragged', targetKey: 'target', position: 'before' },
    ]])
    wrapper.unmount()
    Reflect.deleteProperty(document, 'elementFromPoint')
  })

  it('warns about malformed collapsed topology and action graphs in development', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mount(OcTree, {
      props: {
        data: createData({
          roots: ['root'],
          items: [
            ['root', { label: 'Root', actions: ['loop'] }],
            ['child', { label: 'Child' }],
          ],
          children: [
            ['root', ['child', 'missing']],
            ['child', ['root']],
          ],
        }),
        actions: new Map([
          ['loop', { title: 'Loop', children: ['loop'] }],
        ]),
      },
    })

    const messages = warn.mock.calls.map(([message]) => String(message)).join('\n')
    expect(messages).toContain('Missing item for key "missing"')
    expect(messages).toContain('Children cycle detected')
    expect(messages).toContain('Action children cycle detected')
  })
})
