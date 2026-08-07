import { readonly, ref, watch, type Ref } from 'vue'
import { reportAppError } from '../../logging/appErrorCatalog'
import type {
  ProjectIdentityDto,
  VersionErrorDto,
  VersionReadiness,
  VersionStatusDto,
} from '../model/versioning'
import {
  versioningService,
  type VersioningService,
} from '../services/versioningService'

type UseVersioningOptions = {
  projectPath: Readonly<Ref<string>>
  service?: VersioningService
}

function resolveDegradedReason(error: unknown): 'io' | 'corrupt' | 'incompatible' | 'boundary' {
  const code = (error as Partial<VersionErrorDto> | null)?.code
  if (code === 'history-corrupt') return 'corrupt'
  if (code === 'history-incompatible' || code === 'identity-mismatch') return 'incompatible'
  if (code === 'project-boundary-violation' || code === 'unsupported-entry') return 'boundary'
  return 'io'
}

export function useVersioning(options: UseVersioningOptions) {
  const service = options.service ?? versioningService
  const readiness = ref<VersionReadiness>({ status: 'not-prepared' })
  const identity = ref<ProjectIdentityDto | null>(null)
  const status = ref<VersionStatusDto | null>(null)
  let generation = 0

  async function prepare(projectRoot: string): Promise<void> {
    const requestGeneration = ++generation
    identity.value = null
    status.value = null
    if (!projectRoot) {
      readiness.value = { status: 'not-prepared' }
      return
    }

    readiness.value = { status: 'preparing', projectId: '' }
    try {
      const response = await service.prepareProject({
        operationId: crypto.randomUUID(),
        projectRoot,
        generation: requestGeneration,
      })
      if (requestGeneration !== generation || options.projectPath.value !== projectRoot) return
      identity.value = response.identity
      const projectStatus = await service.getStatus({
        operationId: crypto.randomUUID(),
        projectRoot,
        projectId: response.identity.projectId,
        generation: requestGeneration,
      })
      if (requestGeneration !== generation || options.projectPath.value !== projectRoot) return
      status.value = projectStatus
      readiness.value = { status: 'ready', projectId: response.identity.projectId }
    } catch (error) {
      if (requestGeneration !== generation || options.projectPath.value !== projectRoot) return
      const projectId = (error as Partial<VersionErrorDto> | null)?.projectId ?? ''
      readiness.value = {
        status: 'degraded',
        projectId,
        reason: resolveDegradedReason(error),
      }
      reportAppError('OC-E7001', error)
    }
  }

  const stopProjectWatch = watch(
    options.projectPath,
    (projectRoot) => void prepare(projectRoot),
    { immediate: true },
  )

  function dispose(): void {
    generation += 1
    stopProjectWatch()
  }

  return {
    readiness: readonly(readiness),
    identity: readonly(identity),
    status: readonly(status),
    prepare,
    dispose,
  }
}
