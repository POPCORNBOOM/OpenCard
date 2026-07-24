import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(),
  unlisten: vi.fn(),
  eventHandler: null as (() => void) | null,
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/api/event', () => ({
  listen: mocks.listen,
}))

import {
  classifyExternalOpenPath,
  filterSupportedExternalOpenPaths,
  listenForExternalOpenRequests,
} from './externalOpenService'

describe('externalOpenService', () => {
  it('classifies only OpenCard file types', () => {
    expect(classifyExternalOpenPath('D:\\Cards\\main.opencard')).toBe('card')
    expect(classifyExternalOpenPath('D:/Cards/.opencardprojectprofile')).toBe('project-resource')
    expect(classifyExternalOpenPath('D:/Cards/.DICTIONARY')).toBe('project-resource')
    expect(classifyExternalOpenPath('D:/Cards/en_US.opencardproject')).toBeNull()
    expect(classifyExternalOpenPath('/cards/.DICTIONARY')).toBeNull()
    expect(classifyExternalOpenPath('D:/Cards/demo.opencardtemplate')).toBe('template')
    expect(classifyExternalOpenPath('D:/Cards/demo.zip')).toBeNull()
    expect(filterSupportedExternalOpenPaths([
      'D:/Cards/main.opencard',
      'D:/Cards/readme.txt',
    ])).toEqual(['D:/Cards/main.opencard'])
  })

  it('drains startup paths and paths queued by later app launches', async () => {
    mocks.invoke
      .mockResolvedValueOnce(['D:/Cards/main.opencard'])
      .mockResolvedValueOnce(['D:/Templates/demo.opencardtemplate'])
    mocks.listen.mockImplementation(async (_event, handler: () => void) => {
      mocks.eventHandler = handler
      return mocks.unlisten
    })
    const handlePaths = vi.fn()

    const unlisten = await listenForExternalOpenRequests(handlePaths)
    expect(handlePaths).toHaveBeenCalledWith(['D:/Cards/main.opencard'])

    mocks.eventHandler?.()
    await vi.waitFor(() => {
      expect(handlePaths).toHaveBeenCalledWith(['D:/Templates/demo.opencardtemplate'])
    })
    expect(unlisten).toBe(mocks.unlisten)
  })
})
