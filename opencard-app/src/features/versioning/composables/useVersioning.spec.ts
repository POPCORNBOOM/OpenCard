import { ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VersioningService } from '../services/versioningService'
import { useVersioning } from './useVersioning'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useVersioning project preparation', () => {
  it('prepares the active project without blocking its lifecycle', async () => {
    const projectPath = ref('D:/project')
    const service: VersioningService = {
      prepareProject: vi.fn(async request => ({
        identity: {
          projectId: 'project-id',
          canonicalRoot: request.projectRoot,
          generation: request.generation,
        },
      })),
    }
    const versioning = useVersioning({ projectPath, service })

    expect(versioning.readiness.value.status).toBe('preparing')
    await vi.waitFor(() => expect(versioning.readiness.value).toEqual({
      status: 'ready',
      projectId: 'project-id',
    }))
    versioning.dispose()
  })

  it('drops a stale preparation response after the project changes', async () => {
    let finishFirst: ((projectId: string) => void) | undefined
    const projectPath = ref('D:/first')
    const service: VersioningService = {
      prepareProject: vi.fn(async request => {
        if (request.projectRoot === 'D:/first') {
          const projectId = await new Promise<string>(resolve => { finishFirst = resolve })
          return { identity: { projectId, canonicalRoot: request.projectRoot, generation: request.generation } }
        }
        return {
          identity: {
            projectId: 'second-id',
            canonicalRoot: request.projectRoot,
            generation: request.generation,
          },
        }
      }),
    }
    const versioning = useVersioning({ projectPath, service })
    projectPath.value = 'D:/second'
    await vi.waitFor(() => expect(versioning.readiness.value).toEqual({
      status: 'ready',
      projectId: 'second-id',
    }))
    finishFirst?.('first-id')
    await Promise.resolve()

    expect(versioning.identity.value?.projectId).toBe('second-id')
    versioning.dispose()
  })

  it('degrades only versioning when native history is unavailable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const projectPath = ref('D:/project')
    const service: VersioningService = {
      prepareProject: vi.fn(async () => {
        throw { code: 'history-corrupt', projectId: 'project-id' }
      }),
    }
    const versioning = useVersioning({ projectPath, service })

    await vi.waitFor(() => expect(versioning.readiness.value).toEqual({
      status: 'degraded',
      projectId: 'project-id',
      reason: 'corrupt',
    }))
    versioning.dispose()
  })
})
