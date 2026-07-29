import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OcActionButton from '../../components/standard/OcActionButton.vue'
import CardDataTable from './CardDataTable.vue'
import type {
  CdeDataTableFaceCatalog,
  CdeDataTableFaceGroup,
  CdeDataTableFieldRow,
} from './useCdeDataTableModel'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

const columns = [
  { key: '__blueprint__', kind: 'blueprint' as const, title: 'Blueprint' },
  { key: 'instance', kind: 'instance' as const, title: 'Instance' },
]

const faceGroups: CdeDataTableFaceGroup[] = [{
  key: 'front',
  title: 'Front',
  blocks: [{
    key: 'text',
    title: 'Title',
    type: 'text-block',
    depth: 1,
    fields: [{
      key: 'content',
      title: 'Content',
      definition: { title: 'Content', fieldType: 'string' },
      deletable: true,
      cells: [
        {
          identity: '__blueprint__\0text\0content', cardId: '__blueprint__', value: 'Blueprint',
          inherited: false, overridden: false,
        },
        {
          identity: 'instance\0text\0content', cardId: 'instance', value: 'Override',
          inherited: false, overridden: true,
        },
      ],
    }],
  }],
}, {
  key: 'back',
  title: 'Back',
  blocks: [],
}]

const catalogFaceGroups: CdeDataTableFaceCatalog[] = faceGroups.map(face => ({
  key: face.key,
  title: face.title,
  blocks: face.blocks.map(block => ({
    ...block,
    fields: block.fields.map(({ cells: _cells, ...field }) => field),
  })),
}))
catalogFaceGroups[0]!.blocks[0]!.fields.push({
  key: 'fontSize',
  title: 'Font Size',
  definition: { title: 'Font Size', fieldType: 'string' },
  deletable: false,
})
catalogFaceGroups[0]!.blocks.push({
  key: 'image',
  title: 'Image',
  type: 'image-block',
  depth: 0,
  fields: [],
})

describe('CardDataTable', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders both face groups and emits key-only field and cell intents', async () => {
    const inheritedGroups = structuredClone(faceGroups)
    inheritedGroups[0]!.blocks[0]!.fields[0]!.cells[1] = {
      ...inheritedGroups[0]!.blocks[0]!.fields[0]!.cells[1]!,
      value: 'Blueprint',
      inherited: true,
      overridden: false,
    }
    const wrapper = mount(CardDataTable, {
      props: { columns, catalogFaceGroups, faceGroups: inheritedGroups },
    })

    expect(wrapper.findAll('.card-data-table__face-row')).toHaveLength(2)
    expect(wrapper.get('.card-data-table__block-heading').attributes('style')).toContain('14px')
    expect(wrapper.get('[data-card-id="instance"]').classes()).toContain('is-inherited')

    const faceAction = wrapper.findAllComponents(OcActionButton)
      .find(action => action.props('action').key === 'add-block')!
    faceAction.vm.$emit('select', { key: 'image' })
    expect(wrapper.emitted('add-block')).toEqual([['image']])

    const blockAction = wrapper.findAllComponents(OcActionButton)
      .find(action => action.props('action').key === 'manage-fields')!
    blockAction.vm.$emit('select', { key: 'include-field:fontSize' })
    blockAction.vm.$emit('select', { key: 'create-field' })
    expect(wrapper.emitted('include-field')).toEqual([['text', 'fontSize']])
    expect(wrapper.emitted('create-field')).toEqual([['text']])

    await wrapper.get('button[aria-label="cardDesigner.dataTable.excludeField"]').trigger('click')
    expect(wrapper.emitted('exclude-field')).toEqual([['text', 'content']])
    await wrapper.get('button[aria-label="cardDesigner.dataTable.deleteField"]').trigger('click')
    expect(wrapper.emitted('delete-field')).toEqual([['text', 'content']])

    const blueprintInput = wrapper.get('[data-card-id="__blueprint__"] input')
    await blueprintInput.setValue('Changed')
    const updates = wrapper.emitted('update-cell') ?? []
    expect(updates[updates.length - 1]).toEqual([{
      cardId: '__blueprint__', blockId: 'text', fieldKey: 'content', value: 'Changed',
    }])
  })

  it('supports blueprint duplication and instance rename, copy, delete and reset actions', async () => {
    const wrapper = mount(CardDataTable, { props: { columns, catalogFaceGroups, faceGroups } })
    const columnActions = wrapper.findAllComponents(OcActionButton)
      .filter(action => action.element.closest('thead'))
    expect(columnActions).toHaveLength(2)

    columnActions[0]!.vm.$emit('select', { key: 'duplicate' })
    expect(wrapper.emitted('duplicate-card')).toEqual([['__blueprint__']])

    columnActions[1]!.vm.$emit('select', { key: 'rename' })
    await nextTick()
    await wrapper.get('.card-data-table__rename input').setValue('Renamed')
    await wrapper.get('.card-data-table__rename').trigger('submit')
    expect(wrapper.emitted('rename-instance')).toEqual([['instance', 'Renamed']])

    const instanceAction = wrapper.findAllComponents(OcActionButton)
      .filter(action => action.element.closest('thead'))[1]!
    instanceAction.vm.$emit('select', { key: 'duplicate' })
    instanceAction.vm.$emit('select', { key: 'delete' })
    expect(wrapper.emitted('duplicate-card')).toEqual([['__blueprint__'], ['instance']])
    expect(wrapper.emitted('delete-instance')).toEqual([['instance']])

    await wrapper.get('button[aria-label="cardDesigner.dataTable.resetOverride"]').trigger('click')
    expect(wrapper.emitted('reset-cell')).toEqual([[
      { cardId: 'instance', blockId: 'text', fieldKey: 'content' },
    ]])
  })

  it('reveals a Cell and places the caret at the issue character offset', async () => {
    const wrapper = mount(CardDataTable, {
      attachTo: document.body,
      props: { columns, catalogFaceGroups, faceGroups },
    })
    const cell = wrapper.get('[data-card-id="instance"]')
    const input = cell.get('input').element as HTMLInputElement
    const scrollIntoView = vi.fn()
    cell.element.scrollIntoView = scrollIntoView

    await expect((wrapper.vm as unknown as {
      revealCell: (
        cardId: string,
        blockId: string,
        fieldKey: string,
        characterOffset?: number,
      ) => Promise<boolean>
    }).revealCell('instance', 'text', 'content', 3)).resolves.toBe(true)

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' })
    expect(document.activeElement).toBe(input)
    expect(input.selectionStart).toBe(3)
    expect(cell.classes()).toContain('is-revealed')
    wrapper.unmount()
  })

  it('mounts field editors only when their Cell enters the lazy overscan area', async () => {
    let revealIntersection: ((element: Element) => void) | null = null
    class IntersectionObserverMock {
      constructor(callback: IntersectionObserverCallback) {
        revealIntersection = element => callback([{
          target: element,
          isIntersecting: true,
          intersectionRatio: 1,
        } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)
    const getCellDefinition = vi.fn((_blockId: string, field: CdeDataTableFieldRow) => field.definition)

    const wrapper = mount(CardDataTable, {
      props: { columns, catalogFaceGroups, faceGroups, getCellDefinition },
    })
    await nextTick()

    const blueprintCell = wrapper.get('[data-card-id="__blueprint__"]')
    const instanceCell = wrapper.get('[data-card-id="instance"]')
    expect(blueprintCell.find('input').exists()).toBe(false)
    expect(instanceCell.find('input').exists()).toBe(false)
    expect(wrapper.findAll('.card-data-table__cell-preview')).toHaveLength(2)
    expect(getCellDefinition).not.toHaveBeenCalled()

    revealIntersection!(instanceCell.element)
    await nextTick()

    expect(blueprintCell.find('input').exists()).toBe(false)
    expect(instanceCell.find('input').exists()).toBe(true)
    expect(wrapper.findAll('.card-data-table__cell-preview')).toHaveLength(1)
    expect(getCellDefinition).toHaveBeenCalledTimes(1)
  })
})
