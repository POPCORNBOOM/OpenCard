import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProjectConfigEditor from './ProjectConfigEditor.vue'
import ProjectConfigSection from './ProjectConfigSection.vue'
import ProjectExportTaskEditor from './ProjectExportTaskEditor.vue'
import OcOptionGroup from '../standard/OcOptionGroup.vue'
import OcButton from '../base/OcButton.vue'
import { useAppSettingsStore } from '../../features/settings/store/appSettingsStore'
import { useProjectStore } from '../../features/workspace/store/projectStore'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key, te: () => false }) }))
vi.mock('./MonacoEditor.vue', () => ({ default: { template: '<div class="monaco-stub" />' } }))
vi.mock('../../features/workspace/store/projectStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../features/workspace/store/projectStore')>()
  const store = actual.useProjectStore()
  return { ...actual, useProjectStore: () => store }
})
vi.mock('../../features/workspace/services/projectIconCatalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../features/workspace/services/projectIconCatalog')>()
  return {
    ...actual,
    buildProjectIconCatalog: vi.fn(async () => ({ series: [], entries: [], errors: [] })),
  }
})

describe('ProjectConfigEditor', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useAppSettingsStore().updateProjectCreation({ workspaceStates: {} })
  })

  it('edits only project name, description, and version', async () => {
    const wrapper = mount(ProjectConfigEditor, {
      props: {
        filePath: 'D:/Demo/.ocproject',
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
      props: { filePath: 'D:/Demo/.ocproject', modelValue: '{"name":"Demo"}' },
    })
    await wrapper.get('[data-field-key="name"] input').setValue('')
    const updates = wrapper.emitted('update:modelValue') ?? []
    expect(JSON.parse(updates[updates.length - 1]?.[0] as string)).toEqual({})
  })

  it('edits the project HTTPS host allowlist with custom controls', async () => {
    const wrapper = mount(ProjectConfigEditor, {
      props: { filePath: 'D:/Demo/.ocproject', modelValue: '{}' },
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
      props: { filePath: 'D:/Demo/.ocproject', modelValue: '{}' },
    })

    wrapper.getComponent(OcOptionGroup).vm.$emit('update:modelValue', 'allow-all')
    await wrapper.vm.$nextTick()

    const updates = wrapper.emitted('update:modelValue') ?? []
    expect(JSON.parse(updates[updates.length - 1]?.[0] as string).remoteResources).toEqual({ mode: 'allow-all' })
    expect(wrapper.find('.project-profile-editor__host-list').exists()).toBe(false)
  })

  it('stores export fields only as the default export configuration', async () => {
    const wrapper = mount(ProjectConfigEditor, {
      props: { filePath: 'D:/Demo/.ocproject', modelValue: '{}' },
    })
    const task = {
      documentPaths: ['cards/main.ocdocument'],
      selectionMode: 'blueprint',
      scale: 1,
      layoutMode: 'none',
      outputDirectory: 'D:/exports',
      conflictMode: 'replace',
      errorPolicy: 'continue',
    } as const

    wrapper.getComponent(ProjectExportTaskEditor).vm.$emit('update:modelValue', task)
    await wrapper.vm.$nextTick()
    const updates = wrapper.emitted('update:modelValue') ?? []
    expect(JSON.parse(updates[updates.length - 1]?.[0] as string).exportTask).toEqual(task)
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false)
  })

  it('persists collapsed project-profile sections and exposes them in the outline', async () => {
    const wrapper = mount(ProjectConfigEditor, {
      props: { filePath: 'D:/Demo/.ocproject', modelValue: '{}' },
    })

    expect(wrapper.findAll('.project-profile-editor__outline-item')).toHaveLength(7)
    expect(wrapper.findAll('.project-profile-editor__outline-node')).toHaveLength(7)
    expect(wrapper.findAllComponents(ProjectConfigSection).map(section => section.props('contentIndent')))
      .toEqual(['single', 'single', 'single', 'single', 'single', 'single', 'single'])
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

  it('creates empty font and icon registries directly', async () => {
    const projectStore = useProjectStore()
    const createFile = vi.spyOn(projectStore, 'createFile').mockResolvedValue(undefined)
    vi.spyOn(projectStore, 'resolveProjectPath').mockImplementation(name => `D:/Demo/${name}`)
    const wrapper = mount(ProjectConfigEditor, {
      props: { filePath: 'D:/Demo/.ocproject', modelValue: '{}' },
    })

    await wrapper.get('[data-linked-file="fonts"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-linked-file="icons"]').trigger('click')
    await flushPromises()

    expect(createFile.mock.calls[0]?.[0]).toBe('.ocfonts')
    expect(JSON.parse(createFile.mock.calls[0]?.[1] ?? '')).toEqual({})
    expect(createFile.mock.calls[1]).toEqual(['.ocicons', '{}'])
    const opened = (wrapper.emitted('open-file') ?? []).map(([path]) => String(path).replace(/\\/g, '/'))
    expect(opened[0]).toMatch(/\/\.ocfonts$/)
    expect(opened[1]).toMatch(/\/\.ocicons$/)
    expect(wrapper.get('[data-linked-file="fonts"]').text()).toBe('projectConfig.fonts.openRegistry')
    expect(wrapper.get('[data-linked-file="icons"]').text()).toBe('projectConfig.icons.openRegistry')
    await wrapper.get('[data-linked-file="fonts"]').trigger('click')
    await wrapper.get('[data-linked-file="icons"]').trigger('click')
    await flushPromises()
    expect(createFile).toHaveBeenCalledTimes(2)
    expect(wrapper.emitted('open-file')).toHaveLength(4)
  })

  it('creates and opens an empty custom block registry directly', async () => {
    const projectStore = useProjectStore()
    const createFile = vi.spyOn(projectStore, 'createFile').mockResolvedValue(undefined)
    vi.spyOn(projectStore, 'resolveProjectPath').mockImplementation(name => `D:/Demo/${name}`)
    const wrapper = mount(ProjectConfigEditor, {
      props: { filePath: 'D:/Demo/.ocproject', modelValue: '{}' },
    })

    await wrapper.get('[data-linked-file="custom-blocks"]').trigger('click')
    await flushPromises()

    expect(createFile).toHaveBeenCalledWith('.ocblocks', expect.stringContaining('"blocks": []'))
    const openedFiles = wrapper.emitted('open-file') ?? []
    expect(openedFiles[openedFiles.length - 1]?.[0]).toBe('D:/Demo/.ocblocks')
    expect(wrapper.get('[data-linked-file="custom-blocks"]').text())
      .toBe('projectConfig.customBlocks.openRegistry')
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
        filePath: 'D:/Demo/.ocproject',
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
      props: { filePath: 'D:/Demo/.ocproject', modelValue: '{broken' },
    })
    expect(wrapper.find('.project-profile-editor__repair').exists()).toBe(true)
    expect(wrapper.find('.monaco-stub').exists()).toBe(true)
  })

  it('emits the standard save command from Ctrl+S for valid content', async () => {
    const wrapper = mount(ProjectConfigEditor, {
      props: { filePath: 'D:/Demo/.ocproject', modelValue: '{}' },
    })
    await wrapper.get('.project-profile-editor').trigger('keydown', { ctrlKey: true, key: 's' })
    expect(wrapper.emitted('save')).toHaveLength(1)
  })

})
