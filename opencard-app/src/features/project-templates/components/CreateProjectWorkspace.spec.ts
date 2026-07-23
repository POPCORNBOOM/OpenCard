import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { computed, ref, type Ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CreatedProject,
  ProjectTemplate,
  ProjectTemplateKey,
  TemplateProjectInspection,
} from '../model/projectTemplate'
import type { ProjectTemplateStore } from '../store/projectTemplateStore'
import CreateProjectWorkspace from './CreateProjectWorkspace.vue'

let store: ProjectTemplateStore
let appSettingsStore: {
  settings: Ref<{ projectCreation: { lastParentPath: string } }>
  updateProjectCreation: ReturnType<typeof vi.fn>
}

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => 'asset://' + path,
}))

vi.mock('../../settings/store/appSettingsStore', () => ({
  useAppSettingsStore: () => appSettingsStore,
}))

vi.mock('../store/projectTemplateStore', () => ({
  useProjectTemplateStore: () => store,
}))

const messages = {
  projectTemplates: {
    title: 'New Project',
    subtitle: 'Create from a template',
    catalogLabel: 'Template details',
    formTitle: 'Project',
    sections: { builtin: 'Built-in templates', user: 'My templates' },
    actions: {
      back: 'Back',
      saveTemplate: 'Save template',
      import: 'Import template',
      confirmImport: 'Import',
      cancel: 'Cancel',
      delete: 'Delete',
      browse: 'Browse',
      create: 'Create project',
    },
    status: {
      loading: 'Loading',
      selectTemplate: 'Select a template',
      noDescription: 'No description',
      chooseLocation: 'Choose a location',
      creating: 'Creating',
      skippedTemplates: 'Skipped {count}',
      creatingFromProject: 'Creating from project',
      noCoverCandidates: 'No covers',
    },
    fields: {
      entry: 'Entry',
      templateName: 'Template name',
      description: 'Description',
      covers: 'Covers',
      projectName: 'Project name',
      location: 'Location',
      target: 'Target',
    },
    confirmDelete: 'Delete this template?',
    defaults: { projectName: 'Untitled Project' },
    dialogs: {
      chooseParent: 'Choose parent',
      chooseTemplatePackage: 'Choose package',
    },
    errors: {
      invalidCatalog: 'Invalid catalog',
      invalidManifest: 'Invalid manifest',
      invalidProjectName: 'Invalid project name',
      invalidTemplateName: 'Invalid template name',
      descriptionTooLong: 'Description too long',
      sourceNotProject: 'Source is not a project',
      sourceNotTemplate: 'Source is not a template',
      sourceHasSymlink: 'Source has a symlink',
      entryNotFound: 'Entry not found',
      coverNotFound: 'Cover not found',
      templateExists: 'Template exists',
      parentNotFound: 'Parent not found',
      targetExists: 'Target exists',
      builtinDeleteForbidden: 'Cannot delete built-in template',
      copyFailed: 'Copy failed',
      unknown: 'Unknown error',
    },
  },
}

function template(
  id: string,
  source: ProjectTemplate['source'],
  name: string,
): ProjectTemplate {
  return {
    schemaVersion: 1,
    id,
    key: `${source}:${id}`,
    source,
    name,
    description: `${name} description`,
    entry: 'main.opencard',
    rootPath: `/${source}/${id}`,
    contentPath: `/${source}/${id}/content`,
    coverPaths: [],
  }
}

function createStore(templates: ProjectTemplate[]): ProjectTemplateStore {
  const templateList = ref(templates)
  return {
    templates: templateList,
    builtinTemplates: computed(() => templateList.value.filter((item) => item.source === 'builtin')),
    userTemplates: computed(() => templateList.value.filter((item) => item.source === 'user')),
    warnings: ref([]),
    isLoading: ref(false),
    error: ref(null),
    load: vi.fn(async () => undefined),
    pickProjectParentDirectory: vi.fn(async () => null),
    pickTemplateSourceFile: vi.fn(async () => null),
    pickTemplateExportPath: vi.fn(async () => null),
    findTemplate: vi.fn((key: ProjectTemplateKey) => (
      templateList.value.find((item) => item.key === key) ?? null
    )),
    inspectProjectSource: vi.fn(),
    importUserTemplate: vi.fn(),
    createUserTemplate: vi.fn(),
    exportProjectTemplate: vi.fn(),
    deleteUserTemplate: vi.fn(async () => undefined),
    createProject: vi.fn(async () => ({ path: '/projects/example', entry: '/projects/example/main.opencard' })),
  }
}

function mountWorkspace(selectedKey: ProjectTemplateKey | null): VueWrapper {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: messages } })
  return mount(CreateProjectWorkspace, {
    props: { selectedKey },
    global: { plugins: [i18n] },
  })
}

describe('CreateProjectWorkspace', () => {
  const builtin = template('blank', 'builtin', 'Blank')
  const user = template('personal', 'user', 'Personal')

  beforeEach(() => {
    store = createStore([builtin, user])
    appSettingsStore = {
      settings: ref({ projectCreation: { lastParentPath: '/cached-projects' } }),
      updateProjectCreation: vi.fn(),
    }
  })

  it('starts with a default name and restores and updates the last parent path', async () => {
    vi.mocked(store.pickProjectParentDirectory).mockResolvedValue('/next-projects')
    const wrapper = mountWorkspace(builtin.key)
    await flushPromises()

    expect(wrapper.get<HTMLInputElement>('input[maxlength="80"]').element.value).toBe('Untitled Project')
    expect(wrapper.get<HTMLInputElement>('input[readonly]').element.value).toBe('/cached-projects')

    await wrapper.findAll('button').find((button) => button.text().includes('Browse'))!.trigger('click')
    await flushPromises()

    expect(appSettingsStore.updateProjectCreation).toHaveBeenCalledWith({
      lastParentPath: '/next-projects',
    })
    expect(wrapper.get<HTMLInputElement>('input[readonly]').element.value).toBe('/next-projects')
  })

  it('uses selectedKey for details and only offers deletion for user templates', async () => {
    const wrapper = mountWorkspace(builtin.key)
    await flushPromises()

    expect(wrapper.get('.create-project__details').text()).toContain('Blank')
    expect(wrapper.find('.create-project__details-actions').exists()).toBe(false)

    await wrapper.setProps({ selectedKey: user.key })

    expect(wrapper.get('.create-project__details').text()).toContain('Personal')
    const actions = wrapper.get('.create-project__details-actions')
    expect(actions.text()).toContain('Delete')
    expect(actions.find('.create-project__delete-confirm').exists()).toBe(false)

    await actions.get('button').trigger('click')

    const confirmation = wrapper.get('.create-project__delete-confirm')
    expect(confirmation.text()).toContain('Delete this template?')
    await confirmation.findAll('button')[0].trigger('click')
    await flushPromises()

    expect(store.deleteUserTemplate).toHaveBeenCalledWith(user)
    expect(wrapper.emitted('update:selectedKey')).toEqual([[builtin.key]])
  })

  it('disables creation until template, project name, and parent location are complete', async () => {
    appSettingsStore.settings.value.projectCreation.lastParentPath = ''
    const wrapper = mountWorkspace(builtin.key)
    await flushPromises()
    const submit = () => wrapper.get<HTMLButtonElement>('button[type="submit"]')

    expect(submit().element.disabled).toBe(true)
    await wrapper.get<HTMLInputElement>('input[maxlength="80"]').setValue('Example')
    expect(submit().element.disabled).toBe(true)

    vi.mocked(store.pickProjectParentDirectory).mockResolvedValue('/projects')
    await wrapper.findAll('button').find((button) => button.text().includes('Browse'))!.trigger('click')
    await flushPromises()
    expect(submit().element.disabled).toBe(false)

    await wrapper.setProps({ selectedKey: null })
    expect(submit().element.disabled).toBe(true)
  })

  it('imports a prepared template package without opening a metadata form', async () => {
    vi.mocked(store.pickTemplateSourceFile).mockResolvedValue('/packages/prepared.opencardtemplate')
    vi.mocked(store.importUserTemplate).mockResolvedValue(user)
    const wrapper = mountWorkspace(builtin.key)
    await flushPromises()

    await (wrapper.vm as unknown as { beginImport(): Promise<void> }).beginImport()
    await flushPromises()

    expect(store.pickTemplateSourceFile).toHaveBeenCalledWith('Choose package')
    expect(store.importUserTemplate).toHaveBeenCalledWith('/packages/prepared.opencardtemplate')
    expect(wrapper.emitted('update:selectedKey')).toEqual([[user.key]])
    expect(wrapper.find('.create-project__template-editor').exists()).toBe(false)
  })

  it('creates a template from the current project with selected cover images', async () => {
    const inspection: TemplateProjectInspection = {
      sourcePath: '/source/project',
      suggestedName: 'Imported project',
      entries: ['cards.opencard', 'tokens.opencard'],
      entryNames: { 'cards.opencard': 'Cards', 'tokens.opencard': 'Tokens' },
      coverCandidates: ['assets/cover-a.png', 'assets/cover-b.webp'],
    }
    vi.mocked(store.inspectProjectSource).mockResolvedValue(inspection)
    vi.mocked(store.createUserTemplate).mockResolvedValue(user)
    const wrapper = mountWorkspace(builtin.key)
    await flushPromises()

    await (wrapper.vm as unknown as { beginCreateTemplate(path: string): Promise<void> })
      .beginCreateTemplate(inspection.sourcePath)
    await flushPromises()

    const editor = wrapper.get('.create-project__template-editor')
    expect(store.inspectProjectSource).toHaveBeenCalledWith(inspection.sourcePath)
    expect(editor.findAll('option').map((option) => option.text())).toEqual(['Cards', 'Tokens'])

    await editor.findAll<HTMLInputElement>('input[type="checkbox"]')[1].setValue(true)
    await editor.findAll('button').find((button) => button.text() === 'Save template')!.trigger('click')
    await flushPromises()

    expect(store.createUserTemplate).toHaveBeenCalledWith({
      sourcePath: inspection.sourcePath,
      name: inspection.suggestedName,
      description: '',
      entry: inspection.entries[0],
      entries: [inspection.entries[0]],
      covers: ['assets/cover-b.webp'],
    })
    expect(wrapper.emitted('update:selectedKey')).toEqual([[user.key]])
    expect(wrapper.find('.create-project__template-editor').exists()).toBe(false)
  })

  it('crossfades through all covers of the selected template', async () => {
    vi.useFakeTimers()
    const covered = {
      ...builtin,
      coverPaths: ['/covers/first.png', '/covers/second.webp'],
    }
    store = createStore([covered])
    const wrapper = mountWorkspace(covered.key)

    try {
      await flushPromises()
      expect(wrapper.get('.create-project__catalog-cover img').attributes('src'))
        .toBe('asset:///covers/first.png')

      await vi.advanceTimersByTimeAsync(4500)
      await wrapper.vm.$nextTick()

      expect(wrapper.get('.create-project__catalog-cover img').attributes('src'))
        .toBe('asset:///covers/second.webp')
    } finally {
      wrapper.unmount()
      vi.useRealTimers()
    }
  })

  it('emits the created project returned by the store', async () => {
    const created: CreatedProject = {
      path: '/projects/example',
      entry: '/projects/example/main.opencard',
    }
    vi.mocked(store.pickProjectParentDirectory).mockResolvedValue('/projects')
    vi.mocked(store.createProject).mockResolvedValue(created)
    const wrapper = mountWorkspace(builtin.key)
    await flushPromises()

    await wrapper.get<HTMLInputElement>('input[maxlength="80"]').setValue('Example')
    await wrapper.findAll('button').find((button) => button.text().includes('Browse'))!.trigger('click')
    await flushPromises()
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.emitted('created')).toEqual([[created]])
  })

  it('creates a project with the selected candidate entry', async () => {
    const multiEntry = {
      ...builtin,
      entries: ['main.opencard', 'alternate.opencard'],
      entryNames: { 'main.opencard': 'Main Blueprint', 'alternate.opencard': 'Alternate Blueprint' },
    }
    store = createStore([multiEntry])
    const wrapper = mountWorkspace(multiEntry.key)
    await flushPromises()

    expect(wrapper.get('.create-project__form select').findAll('option').map((option) => option.text()))
      .toEqual(['Main Blueprint', 'Alternate Blueprint'])

    await wrapper.get('.create-project__form select').setValue('alternate.opencard')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(store.createProject).toHaveBeenCalledWith(expect.objectContaining({
      template: multiEntry,
      entry: 'alternate.opencard',
    }))
  })
})
