import { invoke } from '@tauri-apps/api/core'
import type {
  PrepareProjectRequest,
  PrepareProjectResponse,
} from '../model/versioning'

export interface VersioningService {
  prepareProject(request: PrepareProjectRequest): Promise<PrepareProjectResponse>
}

class VersioningServiceImpl implements VersioningService {
  async prepareProject(request: PrepareProjectRequest): Promise<PrepareProjectResponse> {
    return await invoke<PrepareProjectResponse>('version_prepare_project', { request })
  }
}

export const versioningService = new VersioningServiceImpl()
