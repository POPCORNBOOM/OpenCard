import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'
import enUS from '../../../locales/en-US'

const readFile = vi.hoisted(() => vi.fn(async (path: string) => (
  path.includes('historical') ? 'before' : 'after'
)))
vi.mock('../../workspace/services/fileSystemService', () => ({
  fileSystemService: { readFile },
}))
vi.mock('../../../components/editors/MonacoEditor.vue', () => ({
  default: {
    props: ['comparison'],
    template: '<div data-test="comparison">{{ comparison.historicalContent }}|{{ comparison.currentContent }}</div>',
  },
}))

import VersionDiffHost from './VersionDiffHost.vue'

describe('VersionDiffHost', () => {
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
})
