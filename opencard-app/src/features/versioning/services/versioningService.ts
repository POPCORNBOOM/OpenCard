import { invoke } from '@tauri-apps/api/core'
import type {
  PrepareProjectRequest,
  PrepareProjectResponse,
  VersionProjectRequest,
  VersionStatusDto,
} from '../model/versioning'

export interface VersioningService {
  prepareProject(request: PrepareProjectRequest): Promise<PrepareProjectResponse>
  getStatus(request: VersionProjectRequest): Promise<VersionStatusDto>
}

class VersioningServiceImpl implements VersioningService {
  async prepareProject(request: PrepareProjectRequest): Promise<PrepareProjectResponse> {
    return await invoke<PrepareProjectResponse>('version_prepare_project', { request })
  }

  async getStatus(request: VersionProjectRequest): Promise<VersionStatusDto> {
    return await invoke<VersionStatusDto>('version_get_status', { request })
  }
}

export const versioningService = new VersioningServiceImpl()
