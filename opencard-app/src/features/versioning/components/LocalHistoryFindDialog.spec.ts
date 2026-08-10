import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { afterEach, describe, expect, it } from 'vitest'
import OcTree from '../../../components/standard/OcTree.vue'
import enUS from '../../../locales/en-US'
import type { LocalHistoryEntryDto, LocalHistoryFileRecordDto } from '../model/versioning'
import LocalHistoryFindDialog from './LocalHistoryFindDialog.vue'

const files: LocalHistoryFileRecordDto[] = [{
  relativePath: 'notes/deleted.md',
  latestEntryAtUnixMs: Date.parse('2026-08-10T08:00:00Z'),
  entryCount: 2,
  currentlyExists: false,
}]
const entries: LocalHistoryEntryDto[] = [{
  schemaVersion: 1,
  entryId: 'entry-1',
  relativePath: 'notes/deleted.md',
  createdAtUnixMs: Date.parse('2026-08-10T08:00:00Z'),
  source: 'manual-save',
  sourceDescription: null,
  contentOid: 'oid-1',
  size: 12,
}]

afterEach(() => {
  document.body.innerHTML = ''
})

function mountDialog(selectedPath: string | null = null) {
  return mount(LocalHistoryFindDialog, {
    attachTo: document.body,
    props: {
      open: true,
      files,
      entries,
      selectedPath,
      nextCursor: null,
      locale: 'en-US',
      busy: false,
      error: '',
    },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })],
      stubs: { transition: false },
    },
  })
}

describe('LocalHistoryFindDialog', () => {
  it('searches paths and opens the selected path through the shared tree contract', async () => {
    const wrapper = mountDialog()
    const input = document.body.querySelector<HTMLInputElement>('input')!
    input.value = 'notes'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await wrapper.vm.$nextTick()

    wrapper.getComponent(OcTree).vm.$emit('intent', {
      type: 'node.activate',
      key: 'path:notes/deleted.md',
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('search')).toEqual([['notes']])
    expect(wrapper.emitted('select-path')).toEqual([['notes/deleted.md']])
    expect(document.body.textContent).toContain('current file is deleted')
  })

  it('opens one history entry and returns to the path list', async () => {
    const wrapper = mountDialog('notes/deleted.md')
    wrapper.getComponent(OcTree).vm.$emit('intent', {
      type: 'node.activate',
      key: 'entry:entry-1',
    })
    await wrapper.vm.$nextTick()
    const back = [...document.body.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => button.textContent?.includes('Back to files'))!
    back.click()
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('select-entry')).toEqual([[entries[0]]])
    expect(wrapper.emitted('back')).toHaveLength(1)
  })
})
