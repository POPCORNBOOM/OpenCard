import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OcAutocompletePopover from '../../../../components/standard/OcAutocompletePopover.vue'
import FilePathPropertyField from './FilePathPropertyField.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

describe('FilePathPropertyField', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('keeps an existing complete file committed independently of the stale focus cursor', async () => {
    const directoryProvider = vi.fn(async () => [
      { name: 'assets/icons', isDirectory: true },
      { name: 'assets/portrait.png', isDirectory: false },
      { name: 'assets/readme.txt', isDirectory: false },
    ])
    const wrapper = mount(FilePathPropertyField, {
      props: {
        definition: {
          title: 'Image',
          fieldType: 'filePath',
          filter: { target: 'file', extensions: ['png'] },
          directoryProvider,
        },
        value: 'assets/portrait.png',
      },
    })
    const input = wrapper.get('input')
    ;(input.element as HTMLInputElement).setSelectionRange(0, 0)

    await input.trigger('focus')
    await flushPromises()

    expect(directoryProvider).toHaveBeenCalledWith('assets')
    expect(wrapper.getComponent(OcAutocompletePopover).props('items')).toEqual([
      expect.objectContaining({
        label: 'propertyEditor.filePath.clearSelection',
        insertText: 'assets/',
        keepOpen: true,
      }),
    ])
    expect(wrapper.getComponent(OcAutocompletePopover).props('open')).toBe(true)

    const clearItem = wrapper.getComponent(OcAutocompletePopover).props('items')[0]!
    wrapper.getComponent(OcAutocompletePopover).vm.$emit('select', clearItem.key)
    await flushPromises()

    const updates = wrapper.emitted('update:value') ?? []
    expect(updates[updates.length - 1]).toEqual(['assets/'])
    expect(wrapper.getComponent(OcAutocompletePopover).props('items')).toEqual([
      expect.objectContaining({ label: 'icons' }),
      expect.objectContaining({ label: 'portrait.png' }),
      expect.objectContaining({ label: '..' }),
    ])
  })

  it('uses strict path-prefix filtering for every cursor and focus refresh', async () => {
    const directoryProvider = vi.fn(async () => [
      { name: 'Outputs/main_instance.png', isDirectory: false },
      { name: 'Outputs/main_blueprint.png', isDirectory: false },
      { name: 'Outputs/domain_main_input.png', isDirectory: false },
    ])
    const wrapper = mount(FilePathPropertyField, {
      props: {
        definition: { title: 'Image', fieldType: 'filePath', directoryProvider },
        value: 'Outputs/main_in',
      },
    })
    const input = wrapper.get('input')

    await input.trigger('focus')
    await input.trigger('click')
    await flushPromises()

    const labels = wrapper.getComponent(OcAutocompletePopover).props('items').map(item => item.label)
    expect(labels).toContain('main_instance.png')
    expect(labels).not.toContain('main_blueprint.png')
    expect(labels).not.toContain('domain_main_input.png')
  })

  it('filters typed fragments and continues browsing after selecting a directory', async () => {
    const directoryProvider = vi.fn(async (directory: string) => directory === 'assets/icons'
      ? [{ name: 'assets/icons/card.png', isDirectory: false }]
      : [
          { name: 'assets/icons', isDirectory: true },
          { name: 'assets/card.png', isDirectory: false },
          { name: 'assets/portrait.png', isDirectory: false },
        ])
    const wrapper = mount(FilePathPropertyField, {
      props: {
        definition: {
          title: 'Image',
          fieldType: 'filePath',
          filter: { target: 'file', extensions: ['.png'] },
          directoryProvider,
        },
        value: '',
      },
    })
    const input = wrapper.get('input')
    const control = input.element as HTMLInputElement
    await input.trigger('focus')
    await flushPromises()
    control.value = 'assets/ca'
    control.setSelectionRange(control.value.length, control.value.length)

    await input.trigger('input')
    await flushPromises()
    expect(wrapper.getComponent(OcAutocompletePopover).props('items')).toEqual([
      expect.objectContaining({ label: 'card.png' }),
      expect.objectContaining({ label: '..' }),
    ])

    control.value = 'assets/'
    control.setSelectionRange(control.value.length, control.value.length)
    await input.trigger('input')
    await flushPromises()
    const directoryItem = wrapper.getComponent(OcAutocompletePopover).props('items')
      .find(item => item.label === 'icons')!
    wrapper.getComponent(OcAutocompletePopover).vm.$emit('select', directoryItem.key)
    await flushPromises()

    const updates = wrapper.emitted('update:value') ?? []
    expect(updates[updates.length - 1]).toEqual(['assets/icons/'])
    expect(directoryProvider).toHaveBeenLastCalledWith('assets/icons')

    const fileItem = wrapper.getComponent(OcAutocompletePopover).props('items')
      .find(item => item.label === 'card.png')!
    wrapper.getComponent(OcAutocompletePopover).vm.$emit('select', fileItem.key)
    await wrapper.setProps({
      value: 'assets/icons/card.png',
      definition: {
        title: 'Image',
        fieldType: 'filePath',
        filter: { target: 'file', extensions: ['png'] },
        directoryProvider,
        completion: { provider: () => null },
      },
    })
    await flushPromises()

    expect(wrapper.getComponent(OcAutocompletePopover).props('open')).toBe(true)
    expect(wrapper.getComponent(OcAutocompletePopover).props('items')).toEqual([
      expect.objectContaining({
        label: 'propertyEditor.filePath.clearSelection',
        insertText: 'assets/icons/',
      }),
    ])
  })

  it('supports directory-only filters while keeping binding completion authoritative', async () => {
    const directoryProvider = vi.fn(async () => [
      { name: 'assets', isDirectory: true },
      { name: 'portrait.png', isDirectory: false },
    ])
    const bindingProvider = vi.fn(({ value }: { value: string }) => value.startsWith('{{')
      ? {
          replaceStart: 2,
          replaceEnd: value.length,
          items: [{ key: 'binding', label: 'card:image', insertText: 'card:image' }],
        }
      : null)
    const wrapper = mount(FilePathPropertyField, {
      props: {
        definition: {
          title: 'Directory',
          fieldType: 'filePath',
          filter: { target: 'directory' },
          directoryProvider,
          completion: { provider: bindingProvider },
        },
        value: '',
      },
    })
    const input = wrapper.get('input')
    await input.trigger('focus')
    await flushPromises()
    expect(wrapper.getComponent(OcAutocompletePopover).props('items')).toEqual([
      expect.objectContaining({ label: 'assets' }),
    ])

    const control = input.element as HTMLInputElement
    control.value = '{{'
    control.setSelectionRange(2, 2)
    await input.trigger('input')
    await flushPromises()

    expect(bindingProvider).toHaveBeenLastCalledWith({ value: '{{', cursor: 2 })
    expect(wrapper.getComponent(OcAutocompletePopover).props('items')).toEqual([
      expect.objectContaining({ key: 'binding' }),
    ])
  })

  it('discards a pending directory result after blur', async () => {
    let resolveEntries: ((entries: Array<{ name: string; isDirectory: boolean }>) => void) | undefined
    const directoryProvider = vi.fn(() => new Promise<Array<{ name: string; isDirectory: boolean }>>((resolve) => {
      resolveEntries = resolve
    }))
    const wrapper = mount(FilePathPropertyField, {
      props: {
        definition: { title: 'Image', fieldType: 'filePath', directoryProvider },
        value: 'assets/portrait.png',
      },
    })
    const input = wrapper.get('input')

    await input.trigger('focus')
    await input.trigger('blur')
    resolveEntries?.([{ name: 'assets/portrait.png', isDirectory: false }])
    await flushPromises()

    expect(wrapper.getComponent(OcAutocompletePopover).props('open')).toBe(false)
    expect(wrapper.getComponent(OcAutocompletePopover).props('items')).toEqual([])
  })
})
