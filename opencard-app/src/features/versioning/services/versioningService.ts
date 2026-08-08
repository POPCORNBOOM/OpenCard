import { invoke } from '@tauri-apps/api/core'
import type {
  CreateVersionRequest,
  CreateVersionResponse,
  ListVersionsRequest,
  PreviewChangesRequest,
  PreviewChangesResponse,
  PrepareProjectRequest,
  PrepareProjectResponse,
  VersionProjectRequest,
  VersionStatusDto,
  VersionListResponse,
  FileHistoryRequest,
  FileHistoryResponse,
  LocalHistoryRecordRequest,
  LocalHistoryRecordResponse,
  LocalHistoryPathRequest,
  LocalHistoryListResponse,
  LocalHistoryEntryRequest,
  LocalHistoryReadResponse,
  LocalHistoryDeleteResponse,
  PrepareCompareRequest,
  PrepareCompareResponse,
  ReleaseCompareRequest,
  ReleaseCompareResponse,
  PublishVersionRequest,
  PublishVersionResponse,
  EditReleaseDescriptionRequest,
  VersionRecordDto,
} from '../model/versioning'

export interface VersioningService {
  prepareProject(request: PrepareProjectRequest): Promise<PrepareProjectResponse>
  getStatus(request: VersionProjectRequest): Promise<VersionStatusDto>
  createVersion(request: CreateVersionRequest): Promise<CreateVersionResponse>
  listVersions(request: ListVersionsRequest): Promise<VersionListResponse>
  listFileHistory(request: FileHistoryRequest): Promise<FileHistoryResponse>
  previewChanges(request: PreviewChangesRequest): Promise<PreviewChangesResponse>
  recordLocalHistory(request: LocalHistoryRecordRequest): Promise<LocalHistoryRecordResponse>
  listLocalHistory(request: LocalHistoryPathRequest): Promise<LocalHistoryListResponse>
  readLocalHistory(request: LocalHistoryEntryRequest): Promise<LocalHistoryReadResponse>
  deleteLocalHistory(request: LocalHistoryEntryRequest): Promise<LocalHistoryDeleteResponse>
  prepareCompare(request: PrepareCompareRequest): Promise<PrepareCompareResponse>
  releaseCompare(request: ReleaseCompareRequest): Promise<ReleaseCompareResponse>
  publishVersion(request: PublishVersionRequest): Promise<PublishVersionResponse>
  editReleaseDescription(request: EditReleaseDescriptionRequest): Promise<VersionRecordDto>
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

  async listFileHistory(request: FileHistoryRequest): Promise<FileHistoryResponse> {
    return await invoke<FileHistoryResponse>('version_list_file_history', { request })
  }

  async previewChanges(request: PreviewChangesRequest): Promise<PreviewChangesResponse> {
    return await invoke<PreviewChangesResponse>('version_preview_changes', { request })
  }

  async recordLocalHistory(request: LocalHistoryRecordRequest): Promise<LocalHistoryRecordResponse> {
    return await invoke<LocalHistoryRecordResponse>('local_history_record', { request })
  }

  async listLocalHistory(request: LocalHistoryPathRequest): Promise<LocalHistoryListResponse> {
    return await invoke<LocalHistoryListResponse>('local_history_list', { request })
  }

  async readLocalHistory(request: LocalHistoryEntryRequest): Promise<LocalHistoryReadResponse> {
    return await invoke<LocalHistoryReadResponse>('local_history_read', { request })
  }

  async deleteLocalHistory(request: LocalHistoryEntryRequest): Promise<LocalHistoryDeleteResponse> {
    return await invoke<LocalHistoryDeleteResponse>('local_history_delete', { request })
  }

  async prepareCompare(request: PrepareCompareRequest): Promise<PrepareCompareResponse> {
    return await invoke<PrepareCompareResponse>('version_prepare_compare', { request })
  }

  async releaseCompare(request: ReleaseCompareRequest): Promise<ReleaseCompareResponse> {
    return await invoke<ReleaseCompareResponse>('version_release_compare', { request })
  }

  async publishVersion(request: PublishVersionRequest): Promise<PublishVersionResponse> {
    return await invoke<PublishVersionResponse>('version_publish', { request })
  }

  async editReleaseDescription(request: EditReleaseDescriptionRequest): Promise<VersionRecordDto> {
    return await invoke<VersionRecordDto>('version_edit_release_description', { request })
  }
}

export const versioningService = new VersioningServiceImpl()
