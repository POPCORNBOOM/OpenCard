import { describe, expect, it } from 'vitest'
import { getPrimaryShellPage, resolveShellPageAfterProjectClose } from './shellPage'

describe('shellPage', () => {
  it('returns the explicit origin of an auxiliary page', () => {
    expect(getPrimaryShellPage({ type: 'settings', categoryKey: 'general', returnPage: 'welcome' }))
      .toBe('welcome')
    expect(getPrimaryShellPage({ type: 'create-project', returnPage: 'workbench' }))
      .toBe('workbench')
  })

  it('keeps the current page when a project closes', () => {
    expect(resolveShellPageAfterProjectClose({ type: 'workbench' })).toEqual({ type: 'workbench' })
    expect(resolveShellPageAfterProjectClose({ type: 'welcome' })).toEqual({ type: 'welcome' })
    expect(resolveShellPageAfterProjectClose({
      type: 'settings',
      categoryKey: 'workspace',
      returnPage: 'workbench',
    })).toEqual({ type: 'settings', categoryKey: 'workspace', returnPage: 'workbench' })
  })

  it('leaves project-dependent template export for the workbench', () => {
    expect(resolveShellPageAfterProjectClose({ type: 'export-template', returnPage: 'welcome' }))
      .toEqual({ type: 'workbench' })
  })
})
