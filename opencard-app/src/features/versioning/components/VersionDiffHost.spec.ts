import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'
import enUS from '../../../locales/en-US'

const readFile = vi.hoisted(() => vi.fn<(path: string) => Promise<string>>(async (path: string) => (
  path.includes('historical') ? 'before' : 'after'
)))
vi.mock('../../workspace/services/fileSystemService', () => ({
  fileSystemService: { readFile },
}))
vi.mock('../../../components/editors/MonacoEditor.vue', () => ({
  default: {
    props: ['comparison'],
    template: '<div data-test="comparison" tabindex="0" @keydown.stop>{{ comparison.historicalContent }}|{{ comparison.currentContent }}</div>',
  },
}))

import VersionDiffHost from './VersionDiffHost.vue'

describe('VersionDiffHost', () => {
  it('closes from an editor-owned Escape without stealing Escape from an open menu', async () => {
    const wrapper = mount(VersionDiffHost, {
      props: {
        session: {
          id: 'compare-escape', projectRoot: 'D:/project', projectId: 'project-id', generation: 1,
          leaseId: 'f'.repeat(40), sourceSessionId: 'session-1', sourcePath: 'D:/project/notes.txt',
          editorId: 'monaco', openedFromHistorySource: 'version', openedFromHistoryItemId: 'commit-1',
          historical: { rootPath: 'D:/historical', relativePath: 'notes.txt', completeness: 'project', exists: true },
          current: { rootPath: 'D:/current', relativePath: 'notes.txt', completeness: 'project', exists: true },
        },
        language: 'plaintext', themeId: 'dark',
      },
      attachTo: document.body,
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })],
      },
    })
    await vi.waitFor(() => expect(wrapper.find('[data-test="comparison"]').exists()).toBe(true))
    const editor = wrapper.get('[data-test="comparison"]')

    await editor.trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('close')).toHaveLength(1)

    const menu = document.createElement('div')
    menu.className = 'oc-action-menu'
    menu.setAttribute('role', 'menu')
    document.body.append(menu)
    await editor.trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('close')).toHaveLength(1)
    menu.remove()
    wrapper.unmount()
    readFile.mockClear()
  })

  it('loads the immutable historical and current snapshot paths', async () => {
    const wrapper = mount(VersionDiffHost, {
      props: {
        session: {
          id: 'compare-1',
          projectRoot: 'D:/project',
          projectId: 'project-id',
          generation: 1,
          leaseId: 'a'.repeat(40),
          sourceSessionId: 'session-1',
          sourcePath: 'D:/project/cards/main.json',
          editorId: 'monaco',
          openedFromHistorySource: 'version',
          openedFromHistoryItemId: 'commit-1',
          historicalLabel: 'v0.0.1',
          historical: {
            rootPath: 'D:/historical', relativePath: 'cards/main.json', completeness: 'project', exists: true,
          },
          current: {
            rootPath: 'D:/current', relativePath: 'cards/main.json', completeness: 'project', exists: true,
          },
        },
        language: 'json',
        themeId: 'dark',
      },
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })],
      },
    })
    await vi.waitFor(() => expect(wrapper.get('[data-test="comparison"]').text()).toBe('before|after'))
    expect(wrapper.text()).toContain('v0.0.1')

    expect(readFile).toHaveBeenNthCalledWith(1, 'D:/historical/cards/main.json')
    expect(readFile).toHaveBeenNthCalledWith(2, 'D:/current/cards/main.json')
  })

  it('keeps the compare host mounted and retries snapshot reads in place', async () => {
    readFile.mockRejectedValueOnce(new Error('historical read failed'))
      .mockRejectedValueOnce(new Error('current read failed'))
    const wrapper = mount(VersionDiffHost, {
      props: {
        session: {
          id: 'compare-retry', projectRoot: 'D:/project', projectId: 'project-id', generation: 1,
          leaseId: 'c'.repeat(40), sourceSessionId: 'session-1', sourcePath: 'D:/project/notes.txt',
          editorId: 'monaco', openedFromHistorySource: 'version', openedFromHistoryItemId: 'commit-1',
          historical: { rootPath: 'D:/historical', relativePath: 'notes.txt', completeness: 'project', exists: true },
          current: { rootPath: 'D:/current', relativePath: 'notes.txt', completeness: 'project', exists: true },
        },
        language: 'plaintext', themeId: 'dark',
      },
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })],
      },
    })
    await vi.waitFor(() => expect(wrapper.text()).toContain('The historical content could not be loaded.'))
    readFile.mockImplementation(async (path: string) => path.includes('historical') ? 'before' : 'after')
    await wrapper.findAll('button').find(button => button.text().includes('Refresh'))!.trigger('click')
    await vi.waitFor(() => expect(wrapper.get('[data-test="comparison"]').text()).toBe('before|after'))
  })

  it('offers restore only for a missing current file opened from Local History', async () => {
    const wrapper = mount(VersionDiffHost, {
      props: {
        session: {
          id: 'compare-deleted',
          projectRoot: 'D:/project',
          projectId: 'project-id',
          generation: 1,
          leaseId: 'b'.repeat(40),
          sourceSessionId: null,
          sourcePath: 'D:/project/notes/deleted.md',
          editorId: 'monaco',
          openedFromHistorySource: 'local-history',
          openedFromHistoryItemId: 'entry-1',
          historical: {
            rootPath: 'D:/historical', relativePath: 'notes/deleted.md', completeness: 'single-file', exists: true,
          },
          current: {
            rootPath: 'D:/current', relativePath: 'notes/deleted.md', completeness: 'project', exists: false,
          },
        },
        language: 'markdown',
        themeId: 'dark',
      },
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })],
      },
    })
    await vi.waitFor(() => expect(wrapper.get('[data-test="comparison"]').text()).toBe('before|'))

    const restore = wrapper.findAll('button').find(button => button.text().includes('Restore this file'))!
    await restore.trigger('click')
    expect(wrapper.emitted('restore-file')).toHaveLength(1)
  })

  it('falls back to Monaco when icon identities are ambiguous', async () => {
    const duplicateRegistry = JSON.stringify({ iconSeries: [
      { name: 'One', key: 'duplicate', source: 'icons/one.png', icons: [] },
      { name: 'Two', key: 'duplicate', source: 'icons/two.png', icons: [] },
    ] })
    readFile.mockResolvedValue(duplicateRegistry)
    const wrapper = mount(VersionDiffHost, {
      props: {
        session: {
          id: 'compare-icons', projectRoot: 'D:/project', projectId: 'project-id', generation: 1,
          leaseId: 'd'.repeat(40), sourceSessionId: 'session-1', sourcePath: 'D:/project/.ocicons',
          editorId: 'icon-registry', openedFromHistorySource: 'version', openedFromHistoryItemId: 'commit-1',
          historical: { rootPath: 'D:/historical', relativePath: '.ocicons', completeness: 'project', exists: true },
          current: { rootPath: 'D:/current', relativePath: '.ocicons', completeness: 'project', exists: true },
        },
        language: 'json', themeId: 'dark',
      },
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })],
      },
    })
    await vi.waitFor(() => expect(wrapper.find('[data-test="comparison"]').exists()).toBe(true))
    expect(wrapper.find('.snapshot-icon-registry-diff-editor').exists()).toBe(false)
  })

  it('uses the full Monaco deletion diff when a structured current file is missing', async () => {
    readFile.mockImplementation(async path => path.includes('historical')
      ? JSON.stringify({ base: { title: 'Historical title' } }) : '')
    const wrapper = mount(VersionDiffHost, {
      props: {
        session: {
          id: 'compare-deleted-dictionary', projectRoot: 'D:/project', projectId: 'project-id', generation: 1,
          leaseId: 'e'.repeat(40), sourceSessionId: null, sourcePath: 'D:/project/.oclocale',
          editorId: 'dictionary', openedFromHistorySource: 'local-history', openedFromHistoryItemId: 'entry-2',
          historical: { rootPath: 'D:/historical', relativePath: '.oclocale', completeness: 'single-file', exists: true },
          current: { rootPath: 'D:/current', relativePath: '.oclocale', completeness: 'project', exists: false },
        },
        language: 'json', themeId: 'dark',
      },
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })],
      },
    })
    await vi.waitFor(() => expect(wrapper.find('[data-test="comparison"]').exists()).toBe(true))
    expect(wrapper.find('.dictionary-diff-editor').exists()).toBe(false)
  })
})
