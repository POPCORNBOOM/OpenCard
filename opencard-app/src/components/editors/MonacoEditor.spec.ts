import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const models: Array<{
    value: string
    getValue: ReturnType<typeof vi.fn>
    setValue: ReturnType<typeof vi.fn>
    dispose: ReturnType<typeof vi.fn>
  }> = []
  const diffEditor = {
    setModel: vi.fn(),
    updateOptions: vi.fn(),
    dispose: vi.fn(),
  }
  return {
    models,
    diffEditor,
    create: vi.fn(),
    createDiffEditor: vi.fn(() => diffEditor),
    setModelLanguage: vi.fn(),
    setTheme: vi.fn(),
  }
})

vi.mock('monaco-editor', () => ({
  editor: {
    create: mocks.create,
    createDiffEditor: mocks.createDiffEditor,
    createModel: vi.fn((value: string) => {
      const model = {
        value,
        getValue: vi.fn(() => model.value),
        setValue: vi.fn((next: string) => { model.value = next }),
        dispose: vi.fn(),
      }
      mocks.models.push(model)
      return model
    }),
    setModelLanguage: mocks.setModelLanguage,
    setTheme: mocks.setTheme,
  },
  KeyMod: { CtrlCmd: 1 },
  KeyCode: { KeyS: 2 },
}))

vi.mock('../../features/editor-runtime/services/monacoTheme', () => ({
  registerOcMonacoTheme: vi.fn(() => ({ themeName: 'opencard-dark', fontFamily: 'monospace' })),
}))

import MonacoEditor from './MonacoEditor.vue'

describe('MonacoEditor comparison', () => {
  beforeEach(() => {
    mocks.models.length = 0
    mocks.create.mockClear()
    mocks.createDiffEditor.mockClear()
    mocks.diffEditor.setModel.mockClear()
    mocks.diffEditor.dispose.mockClear()
  })

  it('uses one native read-only diff editor and disposes both models', () => {
    const wrapper = mount(MonacoEditor, {
      props: {
        modelValue: '',
        language: 'json',
        comparison: {
          historicalContent: '{"value":1}',
          currentContent: '{"value":2}',
          historicalLabel: 'History',
          currentLabel: 'Current',
        },
      },
    })

    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.createDiffEditor).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({
      readOnly: true,
      originalEditable: false,
      renderSideBySide: true,
    }))
    expect(mocks.diffEditor.setModel).toHaveBeenCalledWith({
      original: mocks.models[0],
      modified: mocks.models[1],
    })

    wrapper.unmount()
    expect(mocks.diffEditor.dispose).toHaveBeenCalledOnce()
    expect(mocks.models.every(model => model.dispose.mock.calls.length === 1)).toBe(true)
  })
})
