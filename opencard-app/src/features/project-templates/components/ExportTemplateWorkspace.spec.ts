import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectTemplateStore } from '../store/projectTemplateStore'
import ExportTemplateWorkspace from './ExportTemplateWorkspace.vue'

let store: ProjectTemplateStore

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: (path: string) => `asset://${path}` }))
vi.mock('../store/projectTemplateStore', () => ({ useProjectTemplateStore: () => store }))

const messages = {
  templateExport: {
    title: 'Export Project Template', projectTitle: 'Current project', formTitle: 'Template information',
    unnamed: 'Untitled', format: 'Format', formatHint: 'Hint', actions: { export: 'Export Template' },
    previewTitle: 'Preview', previewDescription: 'Description', excluded: 'Excluded',
    selectEntry: 'Select entry', selectionHint: 'Use tree',
    dialogs: { chooseOutput: 'Choose output' },
    status: { inspecting: 'Inspecting', exporting: 'Exporting', exported: 'Exported' },
  },
  projectTemplates: {
    fields: { entry: 'Entry', covers: 'Covers', templateName: 'Name', description: 'Description' },
    status: { noCoverCandidates: 'No covers' },
    errors: {
      invalidTemplateName: 'Invalid name', descriptionTooLong: 'Too long', sourceNotProject: 'Not project',
      sourceHasSymlink: 'Symlink', entryNotFound: 'Missing entry', coverNotFound: 'Missing cover',
      archiveFailed: 'Archive failed', unknown: 'Unknown',
    },
  },
}

describe('ExportTemplateWorkspace', () => {
  beforeEach(() => {
    store = {
      inspectProjectSource: vi.fn(async () => ({
        sourcePath: '/project', suggestedName: 'Portable', entries: ['main.opencard', 'alternate.opencard'],
        entryNames: { 'main.opencard': 'Main Blueprint', 'alternate.opencard': 'Alternate Blueprint' },
        coverCandidates: ['cover.png'],
      })),
      pickTemplateExportPath: vi.fn(async () => '/exports/Portable.octemplete'),
      exportProjectTemplate: vi.fn(async () => '/exports/Portable.octemplete'),
    } as unknown as ProjectTemplateStore
  })

  it('inspects the open project and exports configured metadata', async () => {
    const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: messages } })
    const wrapper = mount(ExportTemplateWorkspace, {
      props: { projectPath: '/project' },
      global: { plugins: [i18n] },
    })
    await flushPromises()

    const workspace = wrapper.vm as unknown as {
      toggleCover(path: string): void
      toggleEntry(path: string): void
      togglePathIncluded(path: string): void
    }
    workspace.toggleCover('cover.png')
    workspace.toggleEntry('alternate.opencard')
    workspace.togglePathIncluded('notes')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(store.pickTemplateExportPath).toHaveBeenCalledWith('Portable.octemplete', 'Choose output')
    expect(store.exportProjectTemplate).toHaveBeenCalledWith({
      sourcePath: '/project',
      outputPath: '/exports/Portable.octemplete',
      name: 'Portable',
      description: '',
      entry: 'main.opencard',
      entries: ['main.opencard', 'alternate.opencard'],
      covers: ['cover.png'],
      excludedPaths: ['notes'],
    })
    const selectionEvents = wrapper.emitted('selection-change') ?? []
    expect(selectionEvents[selectionEvents.length - 1]).toEqual([{
      entries: ['main.opencard', 'alternate.opencard'],
      entryNames: { 'main.opencard': 'Main Blueprint', 'alternate.opencard': 'Alternate Blueprint' },
      covers: ['cover.png'],
      excludedPaths: ['notes'],
    }])
    expect(wrapper.text()).toContain('/exports/Portable.octemplete')
  })
})
