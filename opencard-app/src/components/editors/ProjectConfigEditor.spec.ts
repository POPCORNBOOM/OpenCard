import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProjectConfigEditor from './ProjectConfigEditor.vue'
import ProjectConfigSection from './ProjectConfigSection.vue'
import OcOptionGroup from '../standard/OcOptionGroup.vue'
import OcButton from '../base/OcButton.vue'
import { useAppSettingsStore } from '../../features/settings/store/appSettingsStore'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key, te: () => false }) }))
vi.mock('./MonacoEditor.vue', () => ({ default: { template: '<div class="monaco-stub" />' } }))
vi.mock('../../features/workspace/services/projectIconCatalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../features/workspace/services/projectIconCatalog')>()
  return {
    ...actual,
    buildProjectIconCatalog: vi.fn(async () => ({ series: [], entries: [], errors: [] })),
  }
})

describe('ProjectConfigEditor', () => {
  beforeEach(() => {
    useAppSettingsStore().updateProjectCreation({ workspaceStates: {} })
  })

  it('edits only project name, description, and version', async () => {
    const wrapper = mount(ProjectConfigEditor, {
      props: {
        filePath: 'D:/Demo/.opencardprojectprofile',
        modelValue: JSON.stringify({ name: 'Demo', description: 'Info', version: '1.0.0' }),
      },
    })

    expect(wrapper.find('[data-field-key="extends"]').exists()).toBe(false)
    expect(wrapper.find('[data-field-key="globalvariables"]').exists()).toBe(false)
    expect(wrapper.find('.property-editor').exists()).toBe(false)
    await wrapper.get('[data-field-key="version"] input').setValue('2.0.0')

    const updates = wrapper.emitted('update:modelValue') ?? []
    const updated = updates[updates.length - 1]?.[0] as string
    expect(JSON.parse(updated)).toEqual({ name: 'Demo', description: 'Info', version: '2.0.0' })
  })

  it('omits empty profile fields', async () => {
    const wrapper = mount(ProjectConfigEditor, {
      props: { filePath: 'D:/Demo/.opencardprojectprofile', modelValue: '{"name":"Demo"}' },
    })
    await wrapper.get('[data-field-key="name"] input').setValue('')
    const updates = wrapper.emitted('update:modelValue') ?? []
    expect(JSON.parse(updates[updates.length - 1]?.[0] as string)).toEqual({})
  })

  it('edits the project HTTPS host allowlist with custom controls', async () => {
    const wrapper = mount(ProjectConfigEditor, {
      props: { filePath: 'D:/Demo/.opencardprojectprofile', modelValue: '{}' },
    })

    const modeControl = wrapper.getComponent(OcOptionGroup)
    expect(modeControl.props('fill')).toBe(true)
    expect(modeControl.classes()).toContain('project-profile-editor__remote-mode')
    modeControl.vm.$emit('update:modelValue', 'allowlist')
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.project-profile-editor__field-caption [data-tooltip]').attributes('aria-label'))
      .toBe('projectConfig.remoteResources.hostHelp')
    await wrapper.get('.project-profile-editor__add-host').trigger('click')
    await wrapper.get('.project-profile-editor__host-row input').setValue('images.example.com')
    await wrapper.get('.project-profile-editor__add-host').trigger('click')
    await wrapper.findAll('.project-profile-editor__host-row input')[1]!.setValue('*.cdn.example.com')

    const updates = wrapper.emitted('update:modelValue') ?? []
    expect(JSON.parse(updates[updates.length - 1]?.[0] as string).remoteResources).toEqual({
      mode: 'allowlist',
      allowedHosts: ['images.example.com', '*.cdn.example.com'],
    })
  })

  it('stores allow-all without rendering a host list', async () => {
    const wrapper = mount(ProjectConfigEditor, {
      props: { filePath: 'D:/Demo/.opencardprojectprofile', modelValue: '{}' },
    })

    wrapper.getComponent(OcOptionGroup).vm.$emit('update:modelValue', 'allow-all')
    await wrapper.vm.$nextTick()

    const updates = wrapper.emitted('update:modelValue') ?? []
    expect(JSON.parse(updates[updates.length - 1]?.[0] as string).remoteResources).toEqual({ mode: 'allow-all' })
    expect(wrapper.find('.project-profile-editor__host-list').exists()).toBe(false)
  })

  it('persists collapsed project-profile sections and exposes them in the outline', async () => {
    const wrapper = mount(ProjectConfigEditor, {
      props: { filePath: 'D:/Demo/.opencardprojectprofile', modelValue: '{}' },
    })

    expect(wrapper.findAll('.project-profile-editor__outline-item')).toHaveLength(3)
    expect(wrapper.findAll('.project-profile-editor__outline-node')).toHaveLength(3)
    expect(wrapper.find('.project-profile-editor__outline').text()).not.toContain('projectConfig.outline.title')
    expect(wrapper.getComponent(ProjectConfigSection).getComponent(OcButton).props('icon')).toBe('tree.chevron-right')
    await wrapper.get('#project-profile-section-information .project-config-section__toggle').trigger('click')

    expect(wrapper.get('#project-profile-section-information-content').attributes('aria-hidden')).toBe('true')
    expect(wrapper.find('[data-field-key="name"]').exists()).toBe(true)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(useAppSettingsStore().settings.value.projectCreation.workspaceStates['D:/Demo']).toEqual({
      expandedDirectories: [],
      projectProfile: { collapsedSections: ['information'] },
    })
  })

  it('expands a collapsed section when navigating from the outline', async () => {
    useAppSettingsStore().updateProjectCreation({
      workspaceStates: {
        'D:/Demo': {
          expandedDirectories: [],
          projectProfile: { collapsedSections: ['remote-resources'] },
        },
      },
    })
    const wrapper = mount(ProjectConfigEditor, {
      props: {
        filePath: 'D:/Demo/.opencardprojectprofile',
        modelValue: '{}',
      },
    })

    expect(wrapper.get('#project-profile-section-remote-resources-content').attributes('aria-hidden')).toBe('true')
    await wrapper.findAll('.project-profile-editor__outline-item')[1]!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.get('#project-profile-section-remote-resources-content').attributes('aria-hidden')).toBe('false')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(useAppSettingsStore().settings.value.projectCreation.workspaceStates['D:/Demo']).toEqual({
      expandedDirectories: [],
    })
  })

  it('shows the embedded JSON repair editor for invalid content', () => {
    const wrapper = mount(ProjectConfigEditor, {
      props: { filePath: 'D:/Demo/.opencardprojectprofile', modelValue: '{broken' },
    })
    expect(wrapper.find('.project-profile-editor__repair').exists()).toBe(true)
    expect(wrapper.find('.monaco-stub').exists()).toBe(true)
  })

  it('emits the standard save command from Ctrl+S for valid content', async () => {
    const wrapper = mount(ProjectConfigEditor, {
      props: { filePath: 'D:/Demo/.opencardprojectprofile', modelValue: '{}' },
    })
    await wrapper.get('.project-profile-editor').trigger('keydown', { ctrlKey: true, key: 's' })
    expect(wrapper.emitted('save')).toHaveLength(1)
  })

})
