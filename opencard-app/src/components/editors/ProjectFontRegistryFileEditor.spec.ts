import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ProjectFontRegistryFileEditor from './ProjectFontRegistryFileEditor.vue'
import ProjectFontRegistryEditor from './ProjectFontRegistryEditor.vue'
import ProjectFontRegistrationDialog from './ProjectFontRegistrationDialog.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('./MonacoEditor.vue', () => ({ default: { template: '<div class="monaco-stub" />' } }))

describe('ProjectFontRegistryFileEditor', () => {
  it('owns font edits and the registration dialog', async () => {
    const wrapper = mount(ProjectFontRegistryFileEditor, {
      props: {
        filePath: 'D:/Demo/.fontreg',
        modelValue: JSON.stringify({
          fonts: { brand: { name: 'Brand', source: 'assets/fonts/Brand.woff2' } },
        }),
      },
    })
    const registry = wrapper.getComponent(ProjectFontRegistryEditor)
    registry.vm.$emit('configure-font', 'brand')
    await wrapper.vm.$nextTick()
    expect(wrapper.getComponent(ProjectFontRegistrationDialog).props('originalKey')).toBe('brand')
    registry.vm.$emit('update:fonts', {
      display: { name: 'Display', source: 'assets/fonts/Display.woff2' },
    })
    await wrapper.vm.$nextTick()

    const updates = wrapper.emitted('update:modelValue') ?? []
    expect(JSON.parse(updates.at(-1)?.[0] as string)).toEqual({
      fonts: { display: { name: 'Display', source: 'assets/fonts/Display.woff2' } },
    })

  })

  it('uses raw repair mode for invalid JSON and saves valid content', async () => {
    const invalid = mount(ProjectFontRegistryFileEditor, {
      props: { filePath: 'D:/Demo/.fontreg', modelValue: '{broken' },
    })
    expect(invalid.find('.monaco-stub').exists()).toBe(true)

    const valid = mount(ProjectFontRegistryFileEditor, {
      props: { filePath: 'D:/Demo/.fontreg', modelValue: '{}' },
    })
    await valid.get('.project-registry-shell').trigger('keydown', { ctrlKey: true, key: 's' })
    expect(valid.emitted('save')).toHaveLength(1)
  })
})
