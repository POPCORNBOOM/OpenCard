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

    expect(readFile).toHaveBeenNthCalledWith(1, 'D:/historical/cards/main.json')
    expect(readFile).toHaveBeenNthCalledWith(2, 'D:/current/cards/main.json')
  })
})
