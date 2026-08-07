import { invoke } from '@tauri-apps/api/core'
import type {
  CreateVersionRequest,
  CreateVersionResponse,
  ListVersionsRequest,
  PrepareProjectRequest,
  PrepareProjectResponse,
  VersionProjectRequest,
  VersionStatusDto,
  VersionListResponse,
} from '../model/versioning'

export interface VersioningService {
  prepareProject(request: PrepareProjectRequest): Promise<PrepareProjectResponse>
  getStatus(request: VersionProjectRequest): Promise<VersionStatusDto>
  createVersion(request: CreateVersionRequest): Promise<CreateVersionResponse>
  listVersions(request: ListVersionsRequest): Promise<VersionListResponse>
}

class VersioningServiceImpl implements VersioningService {
  async prepareProject(request: PrepareProjectRequest): Promise<PrepareProjectResponse> {
    return await invoke<PrepareProjectResponse>('version_prepare_project', { request })
  }

  async getStatus(request: VersionProjectRequest): Promise<VersionStatusDto> {
    return await invoke<VersionStatusDto>('version_get_status', { request })
  }

  async createVersion(request: CreateVersionRequest): Promise<CreateVersionResponse> {
    return await invoke<CreateVersionResponse>('version_create', { request })
  }

  async listVersions(request: ListVersionsRequest): Promise<VersionListResponse> {
    return await invoke<VersionListResponse>('version_list', { request })
  }
}

export const versioningService = new VersioningServiceImpl()
