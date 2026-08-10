use super::*;
use git2::{Commit, ObjectType, Repository, Tree};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use std::path::Component;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionProjectRequest {
    operation_id: String,
    project_root: String,
    project_id: String,
    generation: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateVersionRequest {
    pub(super) operation_id: String,
    pub(super) project_root: String,
    pub(super) project_id: String,
    pub(super) generation: u64,
    pub(super) expected_head_commit_id: Option<String>,
    pub(super) expected_snapshot_id: String,
    pub(super) description: String,
    #[serde(default)]
    pub(super) requested_version: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListVersionsRequest {
    operation_id: String,
    project_root: String,
    project_id: String,
    generation: u64,
    cursor: Option<String>,
    limit: Option<usize>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileHistoryRequest {
    operation_id: String,
    project_root: String,
    project_id: String,
    generation: u64,
    relative_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishVersionRequest {
    operation_id: String,
    project_root: String,
    project_id: String,
    generation: u64,
    commit_id: String,
    version: String,
    description: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditReleaseDescriptionRequest {
    operation_id: String,
    project_root: String,
    project_id: String,
    generation: u64,
    commit_id: String,
    description: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreProjectRequest {
    operation_id: String,
    project_root: String,
    project_id: String,
    generation: u64,
    target_commit_id: String,
    expected_head_commit_id: Option<String>,
    expected_snapshot_id: String,
    description: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DraftOverlayDto {
    session_id: String,
    relative_path: String,
    content: String,
    content_revision: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewChangesRequest {
    operation_id: String,
    project_root: String,
    project_id: String,
    generation: u64,
    overlays: Vec<DraftOverlayDto>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChangeDto {
    path: String,
    status: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangeSummaryDto {
    added: usize,
    modified: usize,
    deleted: usize,
    files: Vec<FileChangeDto>,
    pub(super) snapshot_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseDto {
    published_at_unix_ms: u64,
    description: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionChangeCountsDto {
    added: usize,
    modified: usize,
    deleted: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionRecordDto {
    pub(super) commit_id: String,
    parent_commit_id: Option<String>,
    previous_version: Option<String>,
    version: String,
    kind: String,
    description: String,
    saved_at_unix_ms: u64,
    restored_from: Option<String>,
    release: Option<ReleaseDto>,
    changes: VersionChangeCountsDto,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionStatusDto {
    identity: ProjectIdentityDto,
    current: Option<VersionRecordDto>,
    next_version: String,
    expected_head_commit_id: Option<String>,
    pub(super) change_summary: ChangeSummaryDto,
    has_managed_content: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateVersionResponse {
    pub(super) version: VersionRecordDto,
    change_summary: ChangeSummaryDto,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionListResponse {
    project_id: String,
    items: Vec<VersionRecordDto>,
    next_cursor: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileHistoryResponse {
    project_id: String,
    relative_path: String,
    items: Vec<VersionRecordDto>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishVersionResponse {
    version: VersionRecordDto,
    renumbered_from: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreProjectResponse {
    version: VersionRecordDto,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlayRevisionDto {
    session_id: String,
    relative_path: String,
    content_revision: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewChangesResponse {
    project_id: String,
    change_summary: ChangeSummaryDto,
    overlay_revisions: Vec<OverlayRevisionDto>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct VersionCommitMetadata {
    schema_version: u32,
    whitelist_version: u32,
    kind: String,
    version: String,
    description: String,
    saved_at_unix_ms: u64,
    restored_from: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct VersionTransactionJournal {
    schema_version: u32,
    phase: String,
    old_head_commit_id: Option<String>,
    new_head_commit_id: String,
    profile_existed: bool,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct RestoreTransactionJournal {
    schema_version: u32,
    phase: String,
    files: Vec<RestoreFileRecord>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct RestoreFileRecord {
    relative_path: String,
    existed: bool,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReleaseMetadata {
    schema_version: u32,
    description: String,
    published_at_unix_ms: u64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct SnapshotEntry {
    comparison_oid: Oid,
    mode: i32,
}

#[tauri::command]
pub async fn version_get_status(
    request: VersionProjectRequest,
    app_handle: tauri::AppHandle,
) -> Result<VersionStatusDto, VersionErrorDto> {
    let operation = "version_get_status";
    if request.operation_id.trim().is_empty()
        || request.project_root.trim().is_empty()
        || request.project_id.trim().is_empty()
    {
        return Err(to_error_dto(
            operation,
            HistoryFailure::new(
                "invalid-request",
                "validate-request",
                "missing operation, project root, or project identity",
            ),
        ));
    }
    let storage_root =
        resolve_storage_root(&app_handle).map_err(|error| to_error_dto(operation, error))?;
    let result = tauri::async_runtime::spawn_blocking(move || {
        let context = load_project_context(
            Path::new(&request.project_root),
            &storage_root,
            &request.project_id,
        )?;
        get_status(&context, request.generation)
    })
    .await
    .map_err(|error| {
        to_error_dto(
            operation,
            HistoryFailure::new("history-io", "join-worker", error.to_string()).retryable(),
        )
    })?;
    result.map_err(|error| to_error_dto(operation, error))
}

#[tauri::command]
pub async fn version_create(
    request: CreateVersionRequest,
    app_handle: tauri::AppHandle,
    state: State<'_, VersionHistoryState>,
) -> Result<CreateVersionResponse, VersionErrorDto> {
    let operation = "version_create";
    if request.operation_id.trim().is_empty()
        || request.project_root.trim().is_empty()
        || request.project_id.trim().is_empty()
        || request.expected_snapshot_id.trim().is_empty()
    {
        return Err(to_error_dto(
            operation,
            HistoryFailure::new(
                "invalid-request",
                "validate-request",
                "missing version request field",
            ),
        ));
    }
    validate_description(&request.description).map_err(|error| to_error_dto(operation, error))?;
    let storage_root =
        resolve_storage_root(&app_handle).map_err(|error| to_error_dto(operation, error))?;
    let write_lock = Arc::clone(&state.write_lock);
    let compare_leases = Arc::clone(&state.compare_leases);
    let result = tauri::async_runtime::spawn_blocking(move || {
        let _guard = write_lock.lock().map_err(|_| {
            HistoryFailure::new(
                "history-busy",
                "acquire-lock",
                "version history lock is poisoned",
            )
            .retryable()
        })?;
        let context = load_project_context(
            Path::new(&request.project_root),
            &storage_root,
            &request.project_id,
        )?;
        ensure_project_not_compared(&compare_leases, &context.project_id)?;
        create_version(&context, request)
    })
    .await
    .map_err(|error| {
        to_error_dto(
            operation,
            HistoryFailure::new("history-io", "join-worker", error.to_string()).retryable(),
        )
    })?;
    result.map_err(|error| to_error_dto(operation, error))
}

#[tauri::command]
pub async fn version_list(
    request: ListVersionsRequest,
    app_handle: tauri::AppHandle,
) -> Result<VersionListResponse, VersionErrorDto> {
    let operation = "version_list";
    if request.operation_id.trim().is_empty()
        || request.project_root.trim().is_empty()
        || request.project_id.trim().is_empty()
    {
        return Err(to_error_dto(
            operation,
            HistoryFailure::new(
                "invalid-request",
                "validate-request",
                "missing version list request field",
            ),
        ));
    }
    let storage_root =
        resolve_storage_root(&app_handle).map_err(|error| to_error_dto(operation, error))?;
    let result = tauri::async_runtime::spawn_blocking(move || {
        let context = load_project_context(
            Path::new(&request.project_root),
            &storage_root,
            &request.project_id,
        )?;
        list_versions(&context, request)
    })
    .await
    .map_err(|error| {
        to_error_dto(
            operation,
            HistoryFailure::new("history-io", "join-worker", error.to_string()).retryable(),
        )
    })?;
    result.map_err(|error| to_error_dto(operation, error))
}

#[tauri::command]
pub async fn version_list_file_history(
    request: FileHistoryRequest,
    app_handle: tauri::AppHandle,
) -> Result<FileHistoryResponse, VersionErrorDto> {
    let operation = "version_list_file_history";
    if request.operation_id.trim().is_empty()
        || request.project_root.trim().is_empty()
        || request.project_id.trim().is_empty()
    {
        return Err(to_error_dto(
            operation,
            HistoryFailure::new(
                "invalid-request",
                "validate-request",
                "missing file history request field",
            ),
        ));
    }
    let storage_root =
        resolve_storage_root(&app_handle).map_err(|error| to_error_dto(operation, error))?;
    let result = tauri::async_runtime::spawn_blocking(move || {
        let context = load_project_context(
            Path::new(&request.project_root),
            &storage_root,
            &request.project_id,
        )?;
        list_file_history(&context, request)
    })
    .await
    .map_err(|error| {
        to_error_dto(
            operation,
            HistoryFailure::new("history-io", "join-worker", error.to_string()).retryable(),
        )
    })?;
    result.map_err(|error| to_error_dto(operation, error))
}

#[tauri::command]
pub async fn version_publish(
    request: PublishVersionRequest,
    app_handle: tauri::AppHandle,
    state: State<'_, VersionHistoryState>,
) -> Result<PublishVersionResponse, VersionErrorDto> {
    let operation = "version_publish";
    validate_publish_request(&request).map_err(|error| to_error_dto(operation, error))?;
    let storage_root =
        resolve_storage_root(&app_handle).map_err(|error| to_error_dto(operation, error))?;
    let write_lock = Arc::clone(&state.write_lock);
    let compare_leases = Arc::clone(&state.compare_leases);
    let result = tauri::async_runtime::spawn_blocking(move || {
        let _guard = write_lock.lock().map_err(|_| {
            HistoryFailure::new(
                "history-busy",
                "acquire-lock",
                "version history lock is poisoned",
            )
            .retryable()
        })?;
        let context = load_project_context(
            Path::new(&request.project_root),
            &storage_root,
            &request.project_id,
        )?;
        ensure_project_not_compared(&compare_leases, &context.project_id)?;
        publish_version(&context, request)
    })
    .await
    .map_err(|error| {
        to_error_dto(
            operation,
            HistoryFailure::new("history-io", "join-worker", error.to_string()).retryable(),
        )
    })?;
    result.map_err(|error| to_error_dto(operation, error))
}

#[tauri::command]
pub async fn version_edit_release_description(
    request: EditReleaseDescriptionRequest,
    app_handle: tauri::AppHandle,
    state: State<'_, VersionHistoryState>,
) -> Result<VersionRecordDto, VersionErrorDto> {
    let operation = "version_edit_release_description";
    validate_edit_release_request(&request).map_err(|error| to_error_dto(operation, error))?;
    let storage_root =
        resolve_storage_root(&app_handle).map_err(|error| to_error_dto(operation, error))?;
    let write_lock = Arc::clone(&state.write_lock);
    let compare_leases = Arc::clone(&state.compare_leases);
    let result = tauri::async_runtime::spawn_blocking(move || {
        let _guard = write_lock.lock().map_err(|_| {
            HistoryFailure::new(
                "history-busy",
                "acquire-lock",
                "version history lock is poisoned",
            )
            .retryable()
        })?;
        let context = load_project_context(
            Path::new(&request.project_root),
            &storage_root,
            &request.project_id,
        )?;
        ensure_project_not_compared(&compare_leases, &context.project_id)?;
        edit_release_description(&context, request)
    })
    .await
    .map_err(|error| {
        to_error_dto(
            operation,
            HistoryFailure::new("history-io", "join-worker", error.to_string()).retryable(),
        )
    })?;
    result.map_err(|error| to_error_dto(operation, error))
}

#[tauri::command]
pub async fn version_restore_project(
    request: RestoreProjectRequest,
    app_handle: tauri::AppHandle,
    state: State<'_, VersionHistoryState>,
) -> Result<RestoreProjectResponse, VersionErrorDto> {
    let operation = "version_restore_project";
    validate_restore_request(&request).map_err(|error| to_error_dto(operation, error))?;
    let storage_root =
        resolve_storage_root(&app_handle).map_err(|error| to_error_dto(operation, error))?;
    let write_lock = Arc::clone(&state.write_lock);
    let compare_leases = Arc::clone(&state.compare_leases);
    let result = tauri::async_runtime::spawn_blocking(move || {
        let _guard = write_lock.lock().map_err(|_| {
            HistoryFailure::new(
                "history-busy",
                "acquire-lock",
                "version history lock is poisoned",
            )
            .retryable()
        })?;
        let context = load_project_context(
            Path::new(&request.project_root),
            &storage_root,
            &request.project_id,
        )?;
        ensure_project_not_compared(&compare_leases, &context.project_id)?;
        restore_project(&context, request)
    })
    .await
    .map_err(|error| {
        to_error_dto(
            operation,
            HistoryFailure::new("history-io", "join-worker", error.to_string()).retryable(),
        )
    })?;
    result.map_err(|error| to_error_dto(operation, error))
}

#[tauri::command]
pub async fn version_preview_changes(
    request: PreviewChangesRequest,
    app_handle: tauri::AppHandle,
) -> Result<PreviewChangesResponse, VersionErrorDto> {
    let operation = "version_preview_changes";
    if request.operation_id.trim().is_empty()
        || request.project_root.trim().is_empty()
        || request.project_id.trim().is_empty()
    {
        return Err(to_error_dto(
            operation,
            HistoryFailure::new(
                "invalid-request",
                "validate-request",
                "missing preview request field",
            ),
        ));
    }
    let storage_root =
        resolve_storage_root(&app_handle).map_err(|error| to_error_dto(operation, error))?;
    let result = tauri::async_runtime::spawn_blocking(move || {
        let context = load_project_context(
            Path::new(&request.project_root),
            &storage_root,
            &request.project_id,
        )?;
        preview_changes(&context, request)
    })
    .await
    .map_err(|error| {
        to_error_dto(
            operation,
            HistoryFailure::new("history-io", "join-worker", error.to_string()).retryable(),
        )
    })?;
    result.map_err(|error| to_error_dto(operation, error))
}

fn preview_changes(
    context: &ProjectHistoryContext,
    request: PreviewChangesRequest,
) -> Result<PreviewChangesResponse, HistoryFailure> {
    let _request_generation = request.generation;
    let repository = open_repository(context)?;
    let current_entries = snapshot_entries(context, &request.overlays)?;
    let head_entries = match head_commit(&repository)? {
        Some(commit) => tree_entries(
            &repository,
            &commit.tree().map_err(repository_error("read-head-tree"))?,
        )?,
        None => BTreeMap::new(),
    };
    let snapshot_id = snapshot_id(&current_entries)?;
    Ok(PreviewChangesResponse {
        project_id: context.project_id.clone(),
        change_summary: summarize_changes(
            compare_entries(&head_entries, &current_entries),
            snapshot_id,
        ),
        overlay_revisions: request
            .overlays
            .into_iter()
            .map(|overlay| OverlayRevisionDto {
                session_id: overlay.session_id,
                relative_path: overlay.relative_path,
                content_revision: overlay.content_revision,
            })
            .collect(),
    })
}

fn validate_publish_request(request: &PublishVersionRequest) -> Result<(), HistoryFailure> {
    if request.operation_id.trim().is_empty()
        || request.project_root.trim().is_empty()
        || request.project_id.trim().is_empty()
        || request.commit_id.trim().is_empty()
        || parse_version(request.version.trim()).is_none()
    {
        return Err(HistoryFailure::new(
            "invalid-request",
            "validate-request",
            "invalid publish request",
        ));
    }
    validate_description(&request.description)
}

fn validate_edit_release_request(
    request: &EditReleaseDescriptionRequest,
) -> Result<(), HistoryFailure> {
    if request.operation_id.trim().is_empty()
        || request.project_root.trim().is_empty()
        || request.project_id.trim().is_empty()
        || request.commit_id.trim().is_empty()
    {
        return Err(HistoryFailure::new(
            "invalid-request",
            "validate-request",
            "invalid release description request",
        ));
    }
    validate_description(&request.description)
}

fn validate_restore_request(request: &RestoreProjectRequest) -> Result<(), HistoryFailure> {
    if request.operation_id.trim().is_empty()
        || request.project_root.trim().is_empty()
        || request.project_id.trim().is_empty()
        || request.target_commit_id.trim().is_empty()
        || request.expected_snapshot_id.trim().is_empty()
    {
        return Err(HistoryFailure::new(
            "invalid-request",
            "validate-request",
            "invalid restore request",
        ));
    }
    validate_description(&request.description)
}

fn restore_project(
    context: &ProjectHistoryContext,
    request: RestoreProjectRequest,
) -> Result<RestoreProjectResponse, HistoryFailure> {
    let repository = open_repository(context)?;
    let current_head = head_commit(&repository)?;
    let current_head_id = current_head.as_ref().map(|commit| commit.id().to_string());
    if current_head_id != request.expected_head_commit_id {
        return Err(HistoryFailure::new(
            "version-conflict",
            "compare-head",
            "project version head changed",
        )
        .project_id(&context.project_id)
        .retryable());
    }
    let current_entries = current_snapshot_entries(context)?;
    let current_snapshot_id = snapshot_id(&current_entries)?;
    if current_snapshot_id != request.expected_snapshot_id {
        return Err(HistoryFailure::new(
            "version-conflict",
            "compare-snapshot",
            "project content changed before restore",
        )
        .project_id(&context.project_id)
        .retryable());
    }
    let target = find_version_commit(&repository, &request.target_commit_id)?;
    let target_tree = target
        .tree()
        .map_err(repository_error("read-restore-tree"))?;
    let target_entries = tree_entries(&repository, &target_tree)?;
    let changed_paths = current_entries
        .keys()
        .chain(target_entries.keys())
        .cloned()
        .collect::<BTreeSet<_>>();
    if compare_entries(&current_entries, &target_entries).is_empty() {
        return Err(HistoryFailure::new(
            "invalid-request",
            "restore-project",
            "target content is already current",
        ));
    }
    for path in &target_entries {
        if !is_managed_file(
            path.0,
            context
                .template_managed_paths
                .iter()
                .any(|item| item == path.0),
        ) {
            return Err(HistoryFailure::new(
                "history-corrupt",
                "validate-restore-tree",
                "target version contains an unmanaged path",
            )
            .relative_path(path.0));
        }
    }

    let restore_root = context
        .project_history_root
        .join("restore-transactions")
        .join(transaction_id(&request.operation_id)?);
    let backup_root = restore_root.join("before");
    fs::create_dir_all(&backup_root).map_err(|error| {
        HistoryFailure::new("history-io", "prepare-restore", error.to_string())
            .project_id(&context.project_id)
            .retryable()
    })?;
    let records = changed_paths
        .iter()
        .map(|relative_path| RestoreFileRecord {
            relative_path: relative_path.clone(),
            existed: current_entries.contains_key(relative_path),
        })
        .collect::<Vec<_>>();
    write_restore_journal(
        &restore_root,
        &RestoreTransactionJournal {
            schema_version: SCHEMA_VERSION,
            phase: "backing-up".to_owned(),
            files: records,
        },
    )?;
    if let Err(error) = backup_restore_files(context, &backup_root, &changed_paths) {
        let _ = fs::remove_dir_all(&restore_root);
        return Err(error);
    }
    write_restore_journal(
        &restore_root,
        &RestoreTransactionJournal {
            schema_version: SCHEMA_VERSION,
            phase: "backed-up".to_owned(),
            files: changed_paths
                .iter()
                .map(|relative_path| RestoreFileRecord {
                    relative_path: relative_path.clone(),
                    existed: current_entries.contains_key(relative_path),
                })
                .collect(),
        },
    )?;
    let apply_result = apply_restore_tree(
        context,
        &repository,
        &target_tree,
        &target_entries,
        &changed_paths,
    );
    if let Err(error) = apply_result {
        let rollback = rollback_restore_files(context, &backup_root, &changed_paths);
        let _ = fs::remove_dir_all(&restore_root);
        return Err(rollback.err().unwrap_or(error));
    }
    if let Err(error) = write_restore_journal(
        &restore_root,
        &RestoreTransactionJournal {
            schema_version: SCHEMA_VERSION,
            phase: "applied".to_owned(),
            files: changed_paths
                .iter()
                .map(|relative_path| RestoreFileRecord {
                    relative_path: relative_path.clone(),
                    existed: current_entries.contains_key(relative_path),
                })
                .collect(),
        },
    ) {
        let rollback = rollback_restore_files(context, &backup_root, &changed_paths);
        let _ = fs::remove_dir_all(&restore_root);
        return Err(rollback.err().unwrap_or(error));
    }

    let restored_snapshot_id =
        match current_snapshot_entries(context).and_then(|entries| snapshot_id(&entries)) {
            Ok(snapshot_id) => snapshot_id,
            Err(error) => {
                let rollback = rollback_restore_files(context, &backup_root, &changed_paths);
                let _ = fs::remove_dir_all(&restore_root);
                return Err(rollback.err().unwrap_or(error));
            }
        };
    let create_request = CreateVersionRequest {
        operation_id: request.operation_id.clone(),
        project_root: request.project_root,
        project_id: request.project_id,
        generation: request.generation,
        expected_head_commit_id: request.expected_head_commit_id,
        expected_snapshot_id: restored_snapshot_id,
        description: request.description,
        requested_version: None,
    };
    let created = match create_version_with_kind(
        context,
        create_request,
        "restored",
        Some(&target.id().to_string()),
    ) {
        Ok(created) => created,
        Err(error) => {
            let rollback = rollback_restore_files(context, &backup_root, &changed_paths);
            let _ = fs::remove_dir_all(&restore_root);
            return Err(rollback.err().unwrap_or(error));
        }
    };
    if let Err(error) = write_restore_journal(
        &restore_root,
        &RestoreTransactionJournal {
            schema_version: SCHEMA_VERSION,
            phase: "committed".to_owned(),
            files: changed_paths
                .iter()
                .map(|relative_path| RestoreFileRecord {
                    relative_path: relative_path.clone(),
                    existed: current_entries.contains_key(relative_path),
                })
                .collect(),
        },
    ) {
        eprintln!(
            "[OpenCard/version-history] committed restore cleanup deferred: {}",
            error.detail
        );
    }
    if let Err(error) = fs::remove_dir_all(&restore_root) {
        eprintln!("[OpenCard/version-history] committed restore cleanup deferred: {error}");
    }
    Ok(RestoreProjectResponse {
        version: created.version,
    })
}

fn backup_restore_files(
    context: &ProjectHistoryContext,
    backup_root: &Path,
    changed_paths: &BTreeSet<String>,
) -> Result<(), HistoryFailure> {
    for relative_path in changed_paths {
        let source = context.canonical_root.join(Path::new(relative_path));
        if !source.is_file() {
            continue;
        }
        let content = fs::read(&source).map_err(|error| {
            HistoryFailure::new("history-io", "backup-restore", error.to_string())
                .relative_path(relative_path)
                .retryable()
        })?;
        write_restore_file(backup_root, relative_path, &content)
            .map_err(|error| error.relative_path(relative_path))?;
    }
    Ok(())
}

fn apply_restore_tree(
    context: &ProjectHistoryContext,
    repository: &Repository,
    target_tree: &Tree<'_>,
    target_entries: &BTreeMap<String, SnapshotEntry>,
    changed_paths: &BTreeSet<String>,
) -> Result<(), HistoryFailure> {
    for relative_path in changed_paths {
        let path = context.canonical_root.join(Path::new(relative_path));
        if target_entries.contains_key(relative_path) {
            let entry = target_tree
                .get_path(Path::new(relative_path))
                .map_err(repository_error("read-restore-entry"))?;
            let blob = repository
                .find_blob(entry.id())
                .map_err(repository_error("read-restore-blob"))?;
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).map_err(|error| {
                    HistoryFailure::new("history-io", "apply-restore", error.to_string())
                        .relative_path(relative_path)
                        .retryable()
                })?;
            }
            write_file_atomically(&path, blob.content()).map_err(|error| {
                HistoryFailure::new("history-io", "apply-restore", error.to_string())
                    .relative_path(relative_path)
                    .retryable()
            })?;
        } else if path.exists() {
            fs::remove_file(&path).map_err(|error| {
                HistoryFailure::new("history-io", "apply-restore", error.to_string())
                    .relative_path(relative_path)
                    .retryable()
            })?;
        }
    }
    Ok(())
}

fn rollback_restore_files(
    context: &ProjectHistoryContext,
    backup_root: &Path,
    changed_paths: &BTreeSet<String>,
) -> Result<(), HistoryFailure> {
    for relative_path in changed_paths {
        let destination = context.canonical_root.join(Path::new(relative_path));
        let backup = backup_root.join(Path::new(relative_path));
        if backup.is_file() {
            let content = fs::read(&backup).map_err(|error| {
                HistoryFailure::new("recovery-required", "rollback-restore", error.to_string())
                    .relative_path(relative_path)
            })?;
            write_file_atomically(&destination, &content).map_err(|error| {
                HistoryFailure::new("recovery-required", "rollback-restore", error.to_string())
                    .relative_path(relative_path)
            })?;
        } else if destination.exists() {
            fs::remove_file(&destination).map_err(|error| {
                HistoryFailure::new("recovery-required", "rollback-restore", error.to_string())
                    .relative_path(relative_path)
            })?;
        }
    }
    Ok(())
}

fn write_restore_journal(
    restore_root: &Path,
    journal: &RestoreTransactionJournal,
) -> Result<(), HistoryFailure> {
    let content = serde_json::to_vec_pretty(journal).map_err(|error| {
        HistoryFailure::new("history-io", "serialize-restore", error.to_string())
    })?;
    write_file_atomically(&restore_root.join("journal.json"), &content).map_err(|error| {
        HistoryFailure::new("history-io", "write-restore", error.to_string()).retryable()
    })
}

fn write_restore_file(
    root: &Path,
    relative_path: &str,
    content: &[u8],
) -> Result<(), HistoryFailure> {
    let path = root.join(Path::new(relative_path));
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            HistoryFailure::new("history-io", "prepare-restore", error.to_string())
                .relative_path(relative_path)
                .retryable()
        })?;
    }
    write_file_atomically(&path, content).map_err(|error| {
        HistoryFailure::new("history-io", "write-restore", error.to_string())
            .relative_path(relative_path)
            .retryable()
    })
}

fn publish_version(
    context: &ProjectHistoryContext,
    request: PublishVersionRequest,
) -> Result<PublishVersionResponse, HistoryFailure> {
    let _request_generation = request.generation;
    let repository = open_repository(context)?;
    let mut commit = find_version_commit(&repository, &request.commit_id)?;
    let mut metadata = parse_commit_metadata(&commit)?;
    if release_for_version(&repository, commit.id(), &metadata.version)?.is_some() {
        return Err(HistoryFailure::new(
            "version-conflict",
            "publish-version",
            "version is already published",
        ));
    }

    let requested_version = normalize_version(&request.version)?;
    let renumbered_from = if requested_version != metadata.version {
        let head = head_commit(&repository)?.ok_or_else(|| {
            HistoryFailure::new(
                "version-not-found",
                "publish-version",
                "project has no versions",
            )
        })?;
        if head.id() != commit.id() {
            return Err(HistoryFailure::new(
                "invalid-request",
                "publish-version",
                "only the latest version can be renumbered",
            ));
        }
        ensure_project_matches_commit(context, &repository, &commit)?;
        ensure_version_follows_parent(&commit, &requested_version)?;
        ensure_version_not_used(&repository, &requested_version)?;

        let old_version = metadata.version.clone();
        metadata.version = requested_version.clone();
        let message = serde_json::to_vec(&metadata).map_err(|error| {
            HistoryFailure::new("history-io", "serialize-version", error.to_string())
        })?;
        let signature = git_signature(metadata.saved_at_unix_ms)?;
        let tree = commit
            .tree()
            .map_err(repository_error("read-version-tree"))?;
        let parent = match commit.parent_count() {
            0 => None,
            1 => Some(
                commit
                    .parent(0)
                    .map_err(repository_error("read-version-parent"))?,
            ),
            _ => {
                return Err(HistoryFailure::new(
                    "history-corrupt",
                    "read-version-parent",
                    "version history is not linear",
                ))
            }
        };
        let parents = parent.iter().collect::<Vec<_>>();
        let replacement_id = repository
            .commit(
                None,
                &signature,
                &signature,
                std::str::from_utf8(&message).map_err(|error| {
                    HistoryFailure::new("history-io", "serialize-version", error.to_string())
                })?,
                &tree,
                &parents,
            )
            .map_err(repository_error("renumber-version"))?;
        let projection = prepare_profile_projection(context, &requested_version)?;
        commit_version_transaction(
            context,
            &repository,
            &request.operation_id,
            Some(commit.id()),
            replacement_id,
            projection.as_ref(),
        )?;
        commit = repository
            .find_commit(replacement_id)
            .map_err(repository_error("read-renumbered-version"))?;
        Some(old_version)
    } else {
        None
    };

    create_release_tag(
        &repository,
        &commit,
        &requested_version,
        request.description.trim(),
        unix_time_ms(),
        false,
    )?;
    Ok(PublishVersionResponse {
        version: version_record(&repository, &commit)?,
        renumbered_from,
    })
}

fn edit_release_description(
    context: &ProjectHistoryContext,
    request: EditReleaseDescriptionRequest,
) -> Result<VersionRecordDto, HistoryFailure> {
    let _request_generation = request.generation;
    let repository = open_repository(context)?;
    let commit = find_version_commit(&repository, &request.commit_id)?;
    let metadata = parse_commit_metadata(&commit)?;
    let release =
        release_for_version(&repository, commit.id(), &metadata.version)?.ok_or_else(|| {
            HistoryFailure::new(
                "version-not-found",
                "edit-release",
                "version has not been published",
            )
        })?;
    create_release_tag(
        &repository,
        &commit,
        &metadata.version,
        request.description.trim(),
        release.published_at_unix_ms,
        true,
    )?;
    version_record(&repository, &commit)
}

fn find_version_commit<'repo>(
    repository: &'repo Repository,
    commit_id: &str,
) -> Result<Commit<'repo>, HistoryFailure> {
    let expected = Oid::from_str(commit_id).map_err(|error| {
        HistoryFailure::new("invalid-request", "parse-version", error.to_string())
    })?;
    let mut commit = head_commit(repository)?;
    while let Some(current) = commit {
        if current.id() == expected {
            return Ok(current);
        }
        commit = match current.parent_count() {
            0 => None,
            1 => Some(
                current
                    .parent(0)
                    .map_err(repository_error("read-version-parent"))?,
            ),
            _ => {
                return Err(HistoryFailure::new(
                    "history-corrupt",
                    "read-version-parent",
                    "version history is not linear",
                ))
            }
        };
    }
    Err(HistoryFailure::new(
        "version-not-found",
        "find-version",
        "version is not in project history",
    ))
}

fn ensure_project_matches_commit(
    context: &ProjectHistoryContext,
    repository: &Repository,
    commit: &Commit<'_>,
) -> Result<(), HistoryFailure> {
    let current = current_snapshot_entries(context)?;
    let version = tree_entries(
        repository,
        &commit
            .tree()
            .map_err(repository_error("read-version-tree"))?,
    )?;
    if compare_entries(&version, &current).is_empty() {
        return Ok(());
    }
    Err(HistoryFailure::new(
        "version-conflict",
        "publish-version",
        "project has saved content changes",
    )
    .project_id(&context.project_id)
    .retryable())
}

fn ensure_version_follows_parent(commit: &Commit<'_>, version: &str) -> Result<(), HistoryFailure> {
    let Some(requested) = parse_version(version) else {
        return Err(HistoryFailure::new(
            "invalid-request",
            "validate-version",
            "invalid semantic version",
        ));
    };
    if commit.parent_count() == 0 {
        return Ok(());
    }
    if commit.parent_count() != 1 {
        return Err(HistoryFailure::new(
            "history-corrupt",
            "read-version-parent",
            "version history is not linear",
        ));
    }
    let parent = commit
        .parent(0)
        .map_err(repository_error("read-version-parent"))?;
    let parent_version = parse_commit_metadata(&parent)?.version;
    let parent_version = parse_version(&parent_version).ok_or_else(|| {
        HistoryFailure::new(
            "history-corrupt",
            "validate-version",
            "invalid parent version",
        )
    })?;
    if requested > parent_version {
        return Ok(());
    }
    Err(HistoryFailure::new(
        "version-conflict",
        "validate-version",
        "version must be greater than its parent",
    ))
}

fn normalize_version(version: &str) -> Result<String, HistoryFailure> {
    let (major, minor, patch) = parse_version(version.trim()).ok_or_else(|| {
        HistoryFailure::new(
            "invalid-request",
            "validate-version",
            "invalid semantic version",
        )
    })?;
    Ok(format!("{major}.{minor}.{patch}"))
}

fn create_release_tag(
    repository: &Repository,
    commit: &Commit<'_>,
    version: &str,
    description: &str,
    published_at_unix_ms: u64,
    force: bool,
) -> Result<(), HistoryFailure> {
    let metadata = ReleaseMetadata {
        schema_version: SCHEMA_VERSION,
        description: description.to_owned(),
        published_at_unix_ms,
    };
    let message = serde_json::to_vec(&metadata).map_err(|error| {
        HistoryFailure::new("history-io", "serialize-release", error.to_string())
    })?;
    let signature = git_signature(published_at_unix_ms)?;
    repository
        .tag(
            &format!("v{version}"),
            commit.as_object(),
            &signature,
            std::str::from_utf8(&message).map_err(|error| {
                HistoryFailure::new("history-io", "serialize-release", error.to_string())
            })?,
            force,
        )
        .map(|_| ())
        .map_err(repository_error("publish-version"))
}

fn list_versions(
    context: &ProjectHistoryContext,
    request: ListVersionsRequest,
) -> Result<VersionListResponse, HistoryFailure> {
    let _request_generation = request.generation;
    let repository = open_repository(context)?;
    let limit = request.limit.unwrap_or(50).clamp(1, 100);
    let mut commit = match request.cursor {
        Some(cursor) => {
            let cursor_id = Oid::from_str(&cursor).map_err(|error| {
                HistoryFailure::new("invalid-request", "parse-cursor", error.to_string())
            })?;
            let cursor_commit = repository.find_commit(cursor_id).map_err(|_| {
                HistoryFailure::new("invalid-request", "parse-cursor", "unknown version cursor")
            })?;
            if cursor_commit.parent_count() == 0 {
                None
            } else if cursor_commit.parent_count() == 1 {
                Some(
                    cursor_commit
                        .parent(0)
                        .map_err(repository_error("read-version-parent"))?,
                )
            } else {
                return Err(HistoryFailure::new(
                    "history-corrupt",
                    "read-version-parent",
                    "version history is not linear",
                ));
            }
        }
        None => head_commit(&repository)?,
    };
    let mut items = Vec::new();
    while let Some(current) = commit {
        if items.len() == limit {
            return Ok(VersionListResponse {
                project_id: context.project_id.clone(),
                next_cursor: items
                    .last()
                    .map(|item: &VersionRecordDto| item.commit_id.clone()),
                items,
            });
        }
        let next = if current.parent_count() == 0 {
            None
        } else if current.parent_count() == 1 {
            Some(
                current
                    .parent(0)
                    .map_err(repository_error("read-version-parent"))?,
            )
        } else {
            return Err(HistoryFailure::new(
                "history-corrupt",
                "read-version-parent",
                "version history is not linear",
            ));
        };
        items.push(version_record(&repository, &current)?);
        commit = next;
    }
    Ok(VersionListResponse {
        project_id: context.project_id.clone(),
        items,
        next_cursor: None,
    })
}

fn list_file_history(
    context: &ProjectHistoryContext,
    request: FileHistoryRequest,
) -> Result<FileHistoryResponse, HistoryFailure> {
    let _request_generation = request.generation;
    let relative_path = normalize_history_path(context, &request.relative_path)?;
    let repository = open_repository(context)?;
    let mut commit = head_commit(&repository)?;
    let mut items = Vec::new();
    while let Some(current) = commit {
        let current_entries = tree_entries(
            &repository,
            &current
                .tree()
                .map_err(repository_error("read-version-tree"))?,
        )?;
        let parent_entries = if current.parent_count() == 0 {
            BTreeMap::new()
        } else if current.parent_count() == 1 {
            let parent = current
                .parent(0)
                .map_err(repository_error("read-version-parent"))?;
            tree_entries(
                &repository,
                &parent
                    .tree()
                    .map_err(repository_error("read-version-tree"))?,
            )?
        } else {
            return Err(HistoryFailure::new(
                "history-corrupt",
                "read-version-parent",
                "version history is not linear",
            ));
        };
        if current_entries.get(&relative_path) != parent_entries.get(&relative_path) {
            items.push(version_record(&repository, &current)?);
        }
        commit = if current.parent_count() == 0 {
            None
        } else {
            Some(
                current
                    .parent(0)
                    .map_err(repository_error("read-version-parent"))?,
            )
        };
    }
    Ok(FileHistoryResponse {
        project_id: context.project_id.clone(),
        relative_path,
        items,
    })
}

pub(super) fn normalize_history_path(
    context: &ProjectHistoryContext,
    relative_path: &str,
) -> Result<String, HistoryFailure> {
    let normalized = relative_path.replace('\\', "/");
    let path = Path::new(&normalized);
    let valid = !normalized.is_empty()
        && path
            .components()
            .all(|component| matches!(component, Component::Normal(_)))
        && !is_excluded_path(&normalized);
    let template_managed = context
        .template_managed_paths
        .iter()
        .any(|candidate| candidate == &normalized);
    if !valid || !is_managed_file(&normalized, template_managed) {
        return Err(HistoryFailure::new(
            "unsupported-entry",
            "validate-path",
            "file history path is not managed",
        )
        .project_id(&context.project_id)
        .relative_path(&normalized));
    }
    Ok(normalized)
}

pub(super) fn create_version(
    context: &ProjectHistoryContext,
    request: CreateVersionRequest,
) -> Result<CreateVersionResponse, HistoryFailure> {
    create_version_with_kind(context, request, "saved", None)
}

fn create_version_with_kind(
    context: &ProjectHistoryContext,
    request: CreateVersionRequest,
    kind: &str,
    restored_from: Option<&str>,
) -> Result<CreateVersionResponse, HistoryFailure> {
    let _request_generation = request.generation;
    let repository = open_repository(context)?;
    let current_entries = current_snapshot_entries(context)?;
    let current_snapshot_id = snapshot_id(&current_entries)?;
    if current_snapshot_id != request.expected_snapshot_id {
        return Err(HistoryFailure::new(
            "stale-state",
            "compare-snapshot",
            "project content changed during confirmation",
        )
        .project_id(&context.project_id)
        .retryable());
    }
    let current_head = head_commit(&repository)?;
    let actual_head_id = current_head.as_ref().map(|commit| commit.id().to_string());
    if actual_head_id != request.expected_head_commit_id {
        return Err(HistoryFailure::new(
            "version-conflict",
            "compare-head",
            "project version head changed",
        )
        .project_id(&context.project_id)
        .retryable());
    }
    if current_entries.is_empty() {
        return Err(HistoryFailure::new(
            "invalid-request",
            "create-version",
            "there is no managed project content",
        ));
    }
    let head_entries = match &current_head {
        Some(commit) => tree_entries(
            &repository,
            &commit.tree().map_err(repository_error("read-head-tree"))?,
        )?,
        None => BTreeMap::new(),
    };
    let changed_files = compare_entries(&head_entries, &current_entries);
    if changed_files.is_empty() {
        return Err(HistoryFailure::new(
            "invalid-request",
            "create-version",
            "there are no saved content changes",
        ));
    }
    let current_record = current_head
        .as_ref()
        .map(|commit| version_record(&repository, commit))
        .transpose()?;
    let version = match request.requested_version.as_deref() {
        Some(version) => normalize_version(version)?,
        None => next_version(context, current_record.as_ref())?,
    };
    if let Some(current) = &current_record {
        let requested = parse_version(&version).ok_or_else(|| {
            HistoryFailure::new(
                "invalid-request",
                "validate-version",
                "invalid semantic version",
            )
        })?;
        let parent = parse_version(&current.version).ok_or_else(|| {
            HistoryFailure::new(
                "history-corrupt",
                "validate-version",
                "invalid parent version",
            )
        })?;
        if requested <= parent {
            return Err(HistoryFailure::new(
                "version-conflict",
                "validate-version",
                "version must be greater than its parent",
            ));
        }
    }
    ensure_version_not_used(&repository, &version)?;
    let saved_at_unix_ms = unix_time_ms();
    let projection = prepare_profile_projection(context, &version)?;
    let tree_id = build_tree(&repository, context, projection.as_ref())?;
    let tree = repository
        .find_tree(tree_id)
        .map_err(repository_error("read-created-tree"))?;
    let committed_snapshot_id = snapshot_id(&tree_entries(&repository, &tree)?)?;
    if committed_snapshot_id != current_snapshot_id {
        return Err(HistoryFailure::new(
            "version-conflict",
            "verify-created-tree",
            "project files changed while creating the version tree",
        )
        .project_id(&context.project_id)
        .retryable());
    }
    let metadata = VersionCommitMetadata {
        schema_version: SCHEMA_VERSION,
        whitelist_version: WHITELIST_VERSION,
        kind: kind.to_owned(),
        version: version.clone(),
        description: request.description.trim().to_owned(),
        saved_at_unix_ms,
        restored_from: restored_from.map(str::to_owned),
    };
    let message = serde_json::to_vec(&metadata).map_err(|error| {
        HistoryFailure::new("history-io", "serialize-version", error.to_string())
    })?;
    let signature = git_signature(saved_at_unix_ms)?;
    let parents = current_head.iter().collect::<Vec<_>>();
    let commit_id = repository
        .commit(
            None,
            &signature,
            &signature,
            std::str::from_utf8(&message).map_err(|error| {
                HistoryFailure::new("history-io", "serialize-version", error.to_string())
            })?,
            &tree,
            &parents,
        )
        .map_err(repository_error("create-version"))?;
    commit_version_transaction(
        context,
        &repository,
        &request.operation_id,
        current_head.as_ref().map(|commit| commit.id()),
        commit_id,
        projection.as_ref(),
    )?;
    let commit = repository
        .find_commit(commit_id)
        .map_err(repository_error("read-created-version"))?;
    Ok(CreateVersionResponse {
        version: version_record(&repository, &commit)?,
        change_summary: summarize_changes(changed_files, current_snapshot_id),
    })
}

fn validate_description(description: &str) -> Result<(), HistoryFailure> {
    let trimmed = description.trim();
    let length = trimmed.chars().count();
    if !(1..=500).contains(&length) {
        return Err(HistoryFailure::new(
            "invalid-request",
            "validate-description",
            "version description must contain 1 to 500 Unicode scalar values",
        ));
    }
    Ok(())
}

fn ensure_version_not_used(repository: &Repository, version: &str) -> Result<(), HistoryFailure> {
    let reference = match repository.find_reference("refs/heads/main") {
        Ok(reference) => reference,
        Err(error) if error.code() == git2::ErrorCode::NotFound => return Ok(()),
        Err(error) => return Err(repository_error("read-versions")(error)),
    };
    if reference.target().is_none() {
        return Ok(());
    }
    let mut revisions = repository
        .revwalk()
        .map_err(repository_error("read-versions"))?;
    revisions
        .set_sorting(git2::Sort::TIME | git2::Sort::REVERSE)
        .map_err(repository_error("read-versions"))?;
    revisions
        .push(reference.target().unwrap())
        .map_err(repository_error("read-versions"))?;
    for revision in revisions {
        let commit_id = revision.map_err(repository_error("read-versions"))?;
        let commit = repository
            .find_commit(commit_id)
            .map_err(repository_error("read-versions"))?;
        let metadata = parse_commit_metadata(&commit)?;
        if metadata.version == version {
            return Err(HistoryFailure::new(
                "version-conflict",
                "validate-version",
                "version already exists in project history",
            ));
        }
    }
    Ok(())
}

struct ProfileProjection {
    path: PathBuf,
    content: Vec<u8>,
}

fn prepare_profile_projection(
    context: &ProjectHistoryContext,
    version: &str,
) -> Result<Option<ProfileProjection>, HistoryFailure> {
    let path = context.canonical_root.join(".ocproject");
    let Ok(bytes) = fs::read(&path) else {
        return Ok(None);
    };
    let Ok(mut profile) = serde_json::from_slice::<serde_json::Value>(&bytes) else {
        return Ok(None);
    };
    let Some(profile) = profile.as_object_mut() else {
        return Ok(None);
    };
    profile.insert(
        "version".to_owned(),
        serde_json::Value::String(version.to_owned()),
    );
    let content = serde_json::to_vec_pretty(profile).map_err(|error| {
        HistoryFailure::new("history-io", "serialize-profile-version", error.to_string())
    })?;
    if content == bytes {
        return Ok(None);
    }
    Ok(Some(ProfileProjection { path, content }))
}

#[derive(Default)]
struct TreeNode {
    files: BTreeMap<String, (Oid, i32)>,
    directories: BTreeMap<String, TreeNode>,
}

fn build_tree(
    repository: &Repository,
    context: &ProjectHistoryContext,
    projection: Option<&ProfileProjection>,
) -> Result<Oid, HistoryFailure> {
    let paths = scan_managed_files(&context.canonical_root, &context.template_managed_paths)?;
    let mut root = TreeNode::default();
    for relative_path in paths {
        let absolute_path = context.canonical_root.join(Path::new(&relative_path));
        let oid = if relative_path == ".ocproject" {
            if let Some(projection) = projection {
                repository.blob(&projection.content)
            } else {
                repository.blob_path(&absolute_path)
            }
        } else {
            repository.blob_path(&absolute_path)
        }
        .map_err(|error| {
            HistoryFailure::new("history-io", "create-blob", error.to_string())
                .relative_path(&relative_path)
                .retryable()
        })?;
        let mode = file_mode(&absolute_path)?;
        insert_tree_entry(&mut root, &relative_path, oid, mode)?;
    }
    write_tree(repository, &root)
}

fn insert_tree_entry(
    root: &mut TreeNode,
    relative_path: &str,
    oid: Oid,
    mode: i32,
) -> Result<(), HistoryFailure> {
    let mut components = relative_path.split('/').peekable();
    let mut node = root;
    while let Some(component) = components.next() {
        if components.peek().is_none() {
            node.files.insert(component.to_owned(), (oid, mode));
            return Ok(());
        }
        node = node.directories.entry(component.to_owned()).or_default();
    }
    Err(HistoryFailure::new(
        "history-io",
        "create-tree",
        "managed path has no file name",
    ))
}

fn write_tree(repository: &Repository, node: &TreeNode) -> Result<Oid, HistoryFailure> {
    let mut builder = repository
        .treebuilder(None)
        .map_err(repository_error("create-tree"))?;
    for (name, (oid, mode)) in &node.files {
        builder
            .insert(name, *oid, *mode)
            .map_err(repository_error("create-tree"))?;
    }
    for (name, child) in &node.directories {
        let child_id = write_tree(repository, child)?;
        builder
            .insert(name, child_id, 0o040000)
            .map_err(repository_error("create-tree"))?;
    }
    builder.write().map_err(repository_error("create-tree"))
}

fn git_signature(saved_at_unix_ms: u64) -> Result<git2::Signature<'static>, HistoryFailure> {
    git2::Signature::new(
        "OpenCard",
        "history@opencard.invalid",
        &git2::Time::new((saved_at_unix_ms / 1000) as i64, 0),
    )
    .map_err(repository_error("create-signature"))
}

fn commit_version_transaction(
    context: &ProjectHistoryContext,
    repository: &Repository,
    operation_id: &str,
    old_head: Option<Oid>,
    new_head: Oid,
    projection: Option<&ProfileProjection>,
) -> Result<(), HistoryFailure> {
    let transaction_root = context
        .project_history_root
        .join("transactions")
        .join(transaction_id(operation_id)?);
    if let Some(projection) = projection {
        fs::create_dir_all(&transaction_root).map_err(|error| {
            HistoryFailure::new("history-io", "prepare-transaction", error.to_string())
                .project_id(&context.project_id)
                .retryable()
        })?;
        let before = fs::read(&projection.path).map_err(|error| {
            HistoryFailure::new("history-io", "backup-profile", error.to_string())
                .project_id(&context.project_id)
                .relative_path(".ocproject")
                .retryable()
        })?;
        write_file_atomically(&transaction_root.join("profile.before"), &before).map_err(
            |error| {
                HistoryFailure::new("history-io", "backup-profile", error.to_string())
                    .project_id(&context.project_id)
                    .relative_path(".ocproject")
                    .retryable()
            },
        )?;
        write_file_atomically(&transaction_root.join("profile.after"), &projection.content)
            .map_err(|error| {
                HistoryFailure::new("history-io", "backup-profile", error.to_string())
                    .project_id(&context.project_id)
                    .relative_path(".ocproject")
                    .retryable()
            })?;
        write_transaction_journal(
            &transaction_root,
            &VersionTransactionJournal {
                schema_version: SCHEMA_VERSION,
                phase: "prepared".to_owned(),
                old_head_commit_id: old_head.map(|oid| oid.to_string()),
                new_head_commit_id: new_head.to_string(),
                profile_existed: true,
            },
        )?;
        if let Err(error) = write_file_atomically(&projection.path, &projection.content) {
            let _ = fs::remove_dir_all(&transaction_root);
            return Err(HistoryFailure::new(
                "history-io",
                "write-profile-version",
                error.to_string(),
            )
            .project_id(&context.project_id)
            .relative_path(".ocproject")
            .retryable());
        }
        write_transaction_journal(
            &transaction_root,
            &VersionTransactionJournal {
                schema_version: SCHEMA_VERSION,
                phase: "profile-written".to_owned(),
                old_head_commit_id: old_head.map(|oid| oid.to_string()),
                new_head_commit_id: new_head.to_string(),
                profile_existed: true,
            },
        )?;
    }

    if let Err(error) = move_head(repository, old_head, new_head) {
        if projection.is_some() {
            let before =
                fs::read(transaction_root.join("profile.before")).map_err(|read_error| {
                    HistoryFailure::new(
                        "recovery-required",
                        "rollback-profile",
                        format!("{error:?}; {read_error}"),
                    )
                    .project_id(&context.project_id)
                })?;
            write_file_atomically(&context.canonical_root.join(".ocproject"), &before).map_err(
                |write_error| {
                    HistoryFailure::new(
                        "recovery-required",
                        "rollback-profile",
                        format!("{error:?}; {write_error}"),
                    )
                    .project_id(&context.project_id)
                },
            )?;
            let _ = fs::remove_dir_all(&transaction_root);
        }
        return Err(error);
    }

    if projection.is_some() {
        if let Err(error) = write_transaction_journal(
            &transaction_root,
            &VersionTransactionJournal {
                schema_version: SCHEMA_VERSION,
                phase: "committed".to_owned(),
                old_head_commit_id: old_head.map(|oid| oid.to_string()),
                new_head_commit_id: new_head.to_string(),
                profile_existed: true,
            },
        ) {
            eprintln!(
                "[OpenCard/version-history] committed transaction cleanup deferred: {}",
                error.detail
            );
        } else if let Err(error) = fs::remove_dir_all(&transaction_root) {
            eprintln!("[OpenCard/version-history] committed transaction cleanup deferred: {error}");
        }
    }
    Ok(())
}

fn move_head(
    repository: &Repository,
    old_head: Option<Oid>,
    new_head: Oid,
) -> Result<(), HistoryFailure> {
    match old_head {
        Some(old_head) => repository
            .reference_matching(
                "refs/heads/main",
                new_head,
                true,
                old_head,
                "save OpenCard version",
            )
            .map(|_| ())
            .map_err(repository_error("commit-version")),
        None => match repository.find_reference("refs/heads/main") {
            Ok(mut reference) => reference
                .set_target(new_head, "save first OpenCard version")
                .map(|_| ())
                .map_err(repository_error("commit-version")),
            Err(error) if error.code() == git2::ErrorCode::NotFound => repository
                .reference(
                    "refs/heads/main",
                    new_head,
                    false,
                    "save first OpenCard version",
                )
                .map(|_| ())
                .map_err(repository_error("commit-version")),
            Err(error) => Err(repository_error("commit-version")(error)),
        },
    }
}

fn transaction_id(operation_id: &str) -> Result<String, HistoryFailure> {
    Oid::hash_object(ObjectType::Blob, operation_id.as_bytes())
        .map(|oid| oid.to_string())
        .map_err(|error| {
            HistoryFailure::new("history-io", "prepare-transaction", error.to_string())
        })
}

fn write_transaction_journal(
    transaction_root: &Path,
    journal: &VersionTransactionJournal,
) -> Result<(), HistoryFailure> {
    let content = serde_json::to_vec_pretty(journal).map_err(|error| {
        HistoryFailure::new("history-io", "serialize-transaction", error.to_string())
    })?;
    write_file_atomically(&transaction_root.join("journal.json"), &content).map_err(|error| {
        HistoryFailure::new("history-io", "write-transaction", error.to_string()).retryable()
    })
}

pub(super) fn recover_pending_transactions(
    context: &ProjectHistoryContext,
) -> Result<(), HistoryFailure> {
    let transactions_root = context.project_history_root.join("transactions");
    let Ok(entries) = fs::read_dir(&transactions_root) else {
        return Ok(());
    };
    let repository = open_repository(context)?;
    for entry in entries {
        let entry = entry.map_err(|error| {
            HistoryFailure::new("history-io", "read-transaction", error.to_string())
                .project_id(&context.project_id)
                .retryable()
        })?;
        let transaction_root = entry.path();
        if !transaction_root.is_dir() {
            continue;
        }
        let journal_path = transaction_root.join("journal.json");
        if !journal_path.is_file() {
            fs::remove_dir_all(&transaction_root).map_err(|error| {
                HistoryFailure::new("history-io", "cleanup-transaction", error.to_string())
                    .project_id(&context.project_id)
                    .retryable()
            })?;
            continue;
        }
        let journal: VersionTransactionJournal =
            serde_json::from_slice(&fs::read(&journal_path).map_err(|error| {
                HistoryFailure::new("history-io", "read-transaction", error.to_string())
                    .project_id(&context.project_id)
                    .retryable()
            })?)
            .map_err(|error| {
                HistoryFailure::new("history-corrupt", "parse-transaction", error.to_string())
                    .project_id(&context.project_id)
            })?;
        if journal.schema_version != SCHEMA_VERSION {
            return Err(HistoryFailure::new(
                "history-incompatible",
                "parse-transaction",
                "unsupported transaction schema",
            )
            .project_id(&context.project_id));
        }
        recover_transaction(context, &repository, &transaction_root, &journal)?;
        fs::remove_dir_all(&transaction_root).map_err(|error| {
            HistoryFailure::new("history-io", "cleanup-transaction", error.to_string())
                .project_id(&context.project_id)
                .retryable()
        })?;
    }
    Ok(())
}

pub(super) fn recover_pending_restore_transactions(
    context: &ProjectHistoryContext,
) -> Result<(), HistoryFailure> {
    let root = context.project_history_root.join("restore-transactions");
    let Ok(entries) = fs::read_dir(&root) else {
        return Ok(());
    };
    for entry in entries {
        let entry = entry.map_err(|error| {
            HistoryFailure::new("history-io", "read-restore", error.to_string())
                .project_id(&context.project_id)
                .retryable()
        })?;
        let transaction_root = entry.path();
        if !transaction_root.is_dir() {
            continue;
        }
        let journal_path = transaction_root.join("journal.json");
        if !journal_path.is_file() {
            fs::remove_dir_all(&transaction_root).map_err(|error| {
                HistoryFailure::new("history-io", "cleanup-restore", error.to_string())
                    .project_id(&context.project_id)
                    .retryable()
            })?;
            continue;
        }
        let journal: RestoreTransactionJournal =
            serde_json::from_slice(&fs::read(&journal_path).map_err(|error| {
                HistoryFailure::new("history-io", "read-restore", error.to_string())
                    .project_id(&context.project_id)
                    .retryable()
            })?)
            .map_err(|error| {
                HistoryFailure::new("history-corrupt", "parse-restore", error.to_string())
                    .project_id(&context.project_id)
            })?;
        if journal.schema_version != SCHEMA_VERSION {
            return Err(HistoryFailure::new(
                "history-incompatible",
                "parse-restore",
                "unsupported restore transaction schema",
            )
            .project_id(&context.project_id));
        }
        let committed = journal.phase == "applied" && project_matches_head(context)?;
        if journal.phase == "backed-up" || (journal.phase == "applied" && !committed) {
            let changed_paths = journal
                .files
                .iter()
                .map(|file| file.relative_path.clone())
                .collect::<BTreeSet<_>>();
            rollback_restore_files(context, &transaction_root.join("before"), &changed_paths)?;
        }
        fs::remove_dir_all(&transaction_root).map_err(|error| {
            HistoryFailure::new("history-io", "cleanup-restore", error.to_string())
                .project_id(&context.project_id)
                .retryable()
        })?;
    }
    Ok(())
}

fn project_matches_head(context: &ProjectHistoryContext) -> Result<bool, HistoryFailure> {
    let repository = open_repository(context)?;
    let Some(commit) = head_commit(&repository)? else {
        return Ok(false);
    };
    let tree = commit.tree().map_err(repository_error("read-head-tree"))?;
    Ok(compare_entries(
        &tree_entries(&repository, &tree)?,
        &current_snapshot_entries(context)?,
    )
    .is_empty())
}

fn recover_transaction(
    context: &ProjectHistoryContext,
    repository: &Repository,
    transaction_root: &Path,
    journal: &VersionTransactionJournal,
) -> Result<(), HistoryFailure> {
    let actual_head = head_commit(repository)?.map(|commit| commit.id().to_string());
    let profile_path = context.canonical_root.join(".ocproject");
    let source = if actual_head.as_deref() == Some(&journal.new_head_commit_id) {
        transaction_root.join("profile.after")
    } else if actual_head == journal.old_head_commit_id {
        transaction_root.join("profile.before")
    } else {
        return Err(HistoryFailure::new(
            "recovery-required",
            "recover-transaction",
            "version head does not match pending transaction",
        )
        .project_id(&context.project_id));
    };
    if journal.profile_existed {
        let content = fs::read(&source).map_err(|error| {
            HistoryFailure::new("recovery-required", "recover-profile", error.to_string())
                .project_id(&context.project_id)
                .relative_path(".ocproject")
        })?;
        write_file_atomically(&profile_path, &content).map_err(|error| {
            HistoryFailure::new("recovery-required", "recover-profile", error.to_string())
                .project_id(&context.project_id)
                .relative_path(".ocproject")
        })?;
    } else if profile_path.exists() {
        fs::remove_file(&profile_path).map_err(|error| {
            HistoryFailure::new("recovery-required", "recover-profile", error.to_string())
                .project_id(&context.project_id)
                .relative_path(".ocproject")
        })?;
    }
    Ok(())
}

pub(super) fn get_status(
    context: &ProjectHistoryContext,
    generation: u64,
) -> Result<VersionStatusDto, HistoryFailure> {
    let repository = open_repository(context)?;
    let current_entries = current_snapshot_entries(context)?;
    let snapshot_id = snapshot_id(&current_entries)?;
    let head_commit = head_commit(&repository)?;
    let head_entries = match &head_commit {
        Some(commit) => tree_entries(
            &repository,
            &commit.tree().map_err(repository_error("read-head-tree"))?,
        )?,
        None => BTreeMap::new(),
    };
    let files = compare_entries(&head_entries, &current_entries);
    let change_summary = summarize_changes(files, snapshot_id);
    let current = head_commit
        .as_ref()
        .map(|commit| version_record(&repository, commit))
        .transpose()?;
    let next_version = next_version(context, current.as_ref())?;

    Ok(VersionStatusDto {
        identity: ProjectIdentityDto {
            project_id: context.project_id.clone(),
            canonical_root: context.canonical_root_text.clone(),
            generation,
        },
        current,
        next_version,
        expected_head_commit_id: head_commit.map(|commit| commit.id().to_string()),
        has_managed_content: !current_entries.is_empty(),
        change_summary,
    })
}

pub(super) fn open_repository(
    context: &ProjectHistoryContext,
) -> Result<Repository, HistoryFailure> {
    Repository::open_bare(context.project_history_root.join("history.git")).map_err(|error| {
        HistoryFailure::new("history-corrupt", "open-repository", error.to_string())
            .project_id(&context.project_id)
    })
}

pub(super) fn head_commit(repository: &Repository) -> Result<Option<Commit<'_>>, HistoryFailure> {
    match repository.find_reference("refs/heads/main") {
        Ok(reference) => {
            let oid = reference.target().ok_or_else(|| {
                HistoryFailure::new(
                    "history-corrupt",
                    "read-head",
                    "main reference has no direct target",
                )
            })?;
            repository
                .find_commit(oid)
                .map(Some)
                .map_err(repository_error("read-head"))
        }
        Err(error) if error.code() == git2::ErrorCode::NotFound => Ok(None),
        Err(error) => Err(repository_error("read-head")(error)),
    }
}

fn current_snapshot_entries(
    context: &ProjectHistoryContext,
) -> Result<BTreeMap<String, SnapshotEntry>, HistoryFailure> {
    snapshot_entries(context, &[])
}

fn snapshot_entries(
    context: &ProjectHistoryContext,
    overlays: &[DraftOverlayDto],
) -> Result<BTreeMap<String, SnapshotEntry>, HistoryFailure> {
    let paths = scan_managed_files(&context.canonical_root, &context.template_managed_paths)?;
    let mut entries = BTreeMap::new();
    for relative_path in paths {
        let absolute_path = context.canonical_root.join(Path::new(&relative_path));
        let oid = Oid::hash_file(ObjectType::Blob, &absolute_path).map_err(|error| {
            HistoryFailure::new("history-io", "hash-file", error.to_string())
                .project_id(&context.project_id)
                .relative_path(&relative_path)
                .retryable()
        })?;
        entries.insert(
            relative_path.clone(),
            SnapshotEntry {
                comparison_oid: comparison_oid_for_file(&absolute_path, &relative_path, oid)?,
                mode: file_mode(&absolute_path)?,
            },
        );
    }
    let mut overlay_paths = BTreeSet::new();
    for overlay in overlays {
        let relative_path = overlay.relative_path.replace('\\', "/");
        let path = Path::new(&relative_path);
        let valid_path = !relative_path.is_empty()
            && !path.is_absolute()
            && path
                .components()
                .all(|component| matches!(component, Component::Normal(_)));
        let template_managed = context
            .template_managed_paths
            .iter()
            .any(|candidate| candidate == &relative_path);
        if !valid_path || !is_managed_file(&relative_path, template_managed) {
            return Err(HistoryFailure::new(
                "unsupported-entry",
                "validate-overlay",
                "overlay path is not managed",
            )
            .relative_path(&relative_path));
        }
        if !overlay_paths.insert(relative_path.clone()) {
            return Err(HistoryFailure::new(
                "invalid-request",
                "validate-overlay",
                "duplicate overlay path",
            )
            .relative_path(&relative_path));
        }
        if overlay.content.len() as u64 > MAX_FILE_SIZE {
            return Err(HistoryFailure::new(
                "snapshot-limit",
                "validate-overlay",
                "overlay exceeds size limit",
            )
            .relative_path(&relative_path));
        }
        let content_oid = Oid::hash_object(ObjectType::Blob, overlay.content.as_bytes())
            .map_err(repository_error("hash-overlay"))?;
        let absolute_path = context.canonical_root.join(&relative_path);
        let mode = if absolute_path.is_file() {
            file_mode(&absolute_path)?
        } else {
            0o100644
        };
        entries.insert(
            relative_path.clone(),
            SnapshotEntry {
                comparison_oid: if relative_path == ".ocproject" {
                    comparison_oid_for_profile(overlay.content.as_bytes(), content_oid)?
                } else {
                    content_oid
                },
                mode,
            },
        );
    }
    Ok(entries)
}

fn tree_entries(
    repository: &Repository,
    tree: &Tree<'_>,
) -> Result<BTreeMap<String, SnapshotEntry>, HistoryFailure> {
    let mut entries = BTreeMap::new();
    collect_tree_entries(repository, tree, "", &mut entries)?;
    Ok(entries)
}

fn collect_tree_entries(
    repository: &Repository,
    tree: &Tree<'_>,
    prefix: &str,
    entries: &mut BTreeMap<String, SnapshotEntry>,
) -> Result<(), HistoryFailure> {
    for entry in tree {
        let name = entry.name().map_err(repository_error("read-tree"))?;
        let path = if prefix.is_empty() {
            name.to_owned()
        } else {
            format!("{prefix}/{name}")
        };
        match entry.kind() {
            Some(ObjectType::Blob) => {
                let comparison_oid = if path == ".ocproject" {
                    let blob = repository
                        .find_blob(entry.id())
                        .map_err(repository_error("read-profile-blob"))?;
                    comparison_oid_for_profile(blob.content(), entry.id())?
                } else {
                    entry.id()
                };
                entries.insert(
                    path,
                    SnapshotEntry {
                        comparison_oid,
                        mode: entry.filemode(),
                    },
                );
            }
            Some(ObjectType::Tree) => {
                let child = repository
                    .find_tree(entry.id())
                    .map_err(repository_error("read-tree"))?;
                collect_tree_entries(repository, &child, &path, entries)?;
            }
            _ => {
                return Err(HistoryFailure::new(
                    "history-corrupt",
                    "read-tree",
                    "tree contains an unsupported object",
                )
                .relative_path(&path));
            }
        }
    }
    Ok(())
}

fn comparison_oid_for_file(
    absolute_path: &Path,
    relative_path: &str,
    fallback: Oid,
) -> Result<Oid, HistoryFailure> {
    if relative_path != ".ocproject" {
        return Ok(fallback);
    }
    let bytes = fs::read(absolute_path).map_err(|error| {
        HistoryFailure::new("history-io", "read-profile", error.to_string())
            .relative_path(relative_path)
            .retryable()
    })?;
    comparison_oid_for_profile(&bytes, fallback)
}

fn comparison_oid_for_profile(bytes: &[u8], fallback: Oid) -> Result<Oid, HistoryFailure> {
    let Ok(mut profile) = serde_json::from_slice::<serde_json::Value>(bytes) else {
        return Ok(fallback);
    };
    let Some(profile) = profile.as_object_mut() else {
        return Ok(fallback);
    };
    if profile.shift_remove("version").is_none() {
        return Ok(fallback);
    }
    let normalized = serde_json::to_vec(&profile).map_err(|error| {
        HistoryFailure::new("history-io", "normalize-profile", error.to_string())
    })?;
    Oid::hash_object(ObjectType::Blob, &normalized)
        .map_err(|error| HistoryFailure::new("history-io", "hash-profile", error.to_string()))
}

fn snapshot_id(entries: &BTreeMap<String, SnapshotEntry>) -> Result<String, HistoryFailure> {
    let mut bytes = Vec::new();
    for (path, entry) in entries {
        bytes.extend_from_slice(path.as_bytes());
        bytes.push(0);
        bytes.extend_from_slice(entry.comparison_oid.as_bytes());
        bytes.extend_from_slice(&entry.mode.to_be_bytes());
    }
    Oid::hash_object(ObjectType::Blob, &bytes)
        .map(|oid| oid.to_string())
        .map_err(|error| HistoryFailure::new("history-io", "hash-snapshot", error.to_string()))
}

fn compare_entries(
    historical: &BTreeMap<String, SnapshotEntry>,
    current: &BTreeMap<String, SnapshotEntry>,
) -> Vec<FileChangeDto> {
    let paths = historical
        .keys()
        .chain(current.keys())
        .cloned()
        .collect::<BTreeSet<_>>();
    paths
        .into_iter()
        .filter_map(|path| {
            let status = match (historical.get(&path), current.get(&path)) {
                (None, Some(_)) => "added",
                (Some(_), None) => "deleted",
                (Some(left), Some(right)) if left != right => "modified",
                _ => return None,
            };
            Some(FileChangeDto { path, status })
        })
        .collect()
}

fn summarize_changes(files: Vec<FileChangeDto>, snapshot_id: String) -> ChangeSummaryDto {
    let mut added = 0;
    let mut modified = 0;
    let mut deleted = 0;
    for file in &files {
        match file.status {
            "added" => added += 1,
            "modified" => modified += 1,
            "deleted" => deleted += 1,
            _ => unreachable!(),
        }
    }
    ChangeSummaryDto {
        added,
        modified,
        deleted,
        files,
        snapshot_id,
    }
}

fn version_record(
    repository: &Repository,
    commit: &Commit<'_>,
) -> Result<VersionRecordDto, HistoryFailure> {
    let metadata = parse_commit_metadata(commit)?;
    let current_entries = tree_entries(
        repository,
        &commit
            .tree()
            .map_err(repository_error("read-version-tree"))?,
    )?;
    let (parent_entries, previous_version) = if commit.parent_count() == 0 {
        (BTreeMap::new(), None)
    } else if commit.parent_count() == 1 {
        let parent = commit
            .parent(0)
            .map_err(repository_error("read-version-parent"))?;
        let previous_version = parse_commit_metadata(&parent)?.version;
        let entries = tree_entries(
            repository,
            &parent
                .tree()
                .map_err(repository_error("read-version-tree"))?,
        )?;
        (entries, Some(previous_version))
    } else {
        return Err(HistoryFailure::new(
            "history-corrupt",
            "read-version-parent",
            "version history is not linear",
        ));
    };
    let changes = summarize_changes(
        compare_entries(&parent_entries, &current_entries),
        String::new(),
    );
    Ok(VersionRecordDto {
        commit_id: commit.id().to_string(),
        parent_commit_id: if commit.parent_count() == 1 {
            Some(
                commit
                    .parent_id(0)
                    .map_err(repository_error("read-version-parent"))?
                    .to_string(),
            )
        } else {
            None
        },
        previous_version,
        version: metadata.version.clone(),
        kind: metadata.kind,
        description: metadata.description,
        saved_at_unix_ms: metadata.saved_at_unix_ms,
        restored_from: metadata.restored_from,
        release: release_for_version(repository, commit.id(), &metadata.version)?,
        changes: VersionChangeCountsDto {
            added: changes.added,
            modified: changes.modified,
            deleted: changes.deleted,
        },
    })
}

fn parse_commit_metadata(commit: &Commit<'_>) -> Result<VersionCommitMetadata, HistoryFailure> {
    let metadata: VersionCommitMetadata =
        serde_json::from_slice(commit.message_bytes()).map_err(|error| {
            HistoryFailure::new("history-corrupt", "parse-version", error.to_string())
        })?;
    if metadata.schema_version != SCHEMA_VERSION
        || metadata.whitelist_version != WHITELIST_VERSION
        || !matches!(metadata.kind.as_str(), "saved" | "restored")
        || parse_version(&metadata.version).is_none()
    {
        return Err(HistoryFailure::new(
            "history-incompatible",
            "parse-version",
            "unsupported version commit metadata",
        ));
    }
    Ok(metadata)
}

fn release_for_version(
    repository: &Repository,
    commit_id: Oid,
    version: &str,
) -> Result<Option<ReleaseDto>, HistoryFailure> {
    let reference_name = format!("refs/tags/v{version}");
    let reference = match repository.find_reference(&reference_name) {
        Ok(reference) => reference,
        Err(error) if error.code() == git2::ErrorCode::NotFound => return Ok(None),
        Err(error) => return Err(repository_error("read-release")(error)),
    };
    let tag = reference
        .peel_to_tag()
        .map_err(repository_error("read-release"))?;
    if tag.target_id() != commit_id {
        return Err(HistoryFailure::new(
            "history-corrupt",
            "read-release",
            "release tag points to another commit",
        ));
    }
    let message = tag.message_bytes().ok_or_else(|| {
        HistoryFailure::new(
            "history-corrupt",
            "parse-release",
            "release tag has no message",
        )
    })?;
    let metadata: ReleaseMetadata = serde_json::from_slice(message).map_err(|error| {
        HistoryFailure::new("history-corrupt", "parse-release", error.to_string())
    })?;
    if metadata.schema_version != SCHEMA_VERSION {
        return Err(HistoryFailure::new(
            "history-incompatible",
            "parse-release",
            "unsupported release metadata",
        ));
    }
    Ok(Some(ReleaseDto {
        published_at_unix_ms: metadata.published_at_unix_ms,
        description: metadata.description,
    }))
}

fn next_version(
    context: &ProjectHistoryContext,
    current: Option<&VersionRecordDto>,
) -> Result<String, HistoryFailure> {
    if let Some(current) = current {
        let (major, minor, patch) = parse_version(&current.version).ok_or_else(|| {
            HistoryFailure::new(
                "history-corrupt",
                "next-version",
                "current version is invalid",
            )
        })?;
        let patch = patch.checked_add(1).ok_or_else(|| {
            HistoryFailure::new("version-conflict", "next-version", "patch version overflow")
        })?;
        return Ok(format!("{major}.{minor}.{patch}"));
    }
    let profile_path = context.canonical_root.join(".ocproject");
    let Ok(bytes) = fs::read(profile_path) else {
        return Ok("0.0.1".to_owned());
    };
    let Ok(profile) = serde_json::from_slice::<serde_json::Value>(&bytes) else {
        return Ok("0.0.1".to_owned());
    };
    let Some(version) = profile.get("version").and_then(serde_json::Value::as_str) else {
        return Ok("0.0.1".to_owned());
    };
    Ok(parse_version(version)
        .map(|(major, minor, patch)| format!("{major}.{minor}.{patch}"))
        .unwrap_or_else(|| "0.0.1".to_owned()))
}

fn parse_version(value: &str) -> Option<(u32, u32, u32)> {
    let value = value.strip_prefix('v').unwrap_or(value);
    let parts = value.split('.').collect::<Vec<_>>();
    if parts.len() != 3
        || parts
            .iter()
            .any(|part| part.is_empty() || (part.len() > 1 && part.starts_with('0')))
    {
        return None;
    }
    Some((
        parts[0].parse().ok()?,
        parts[1].parse().ok()?,
        parts[2].parse().ok()?,
    ))
}

fn file_mode(path: &Path) -> Result<i32, HistoryFailure> {
    let metadata = fs::metadata(path).map_err(|error| {
        HistoryFailure::new("history-io", "read-file-mode", error.to_string()).retryable()
    })?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        return Ok(if metadata.permissions().mode() & 0o111 == 0 {
            0o100644
        } else {
            0o100755
        });
    }
    #[cfg(not(unix))]
    {
        let _ = metadata;
        Ok(0o100644)
    }
}

fn repository_error(phase: &'static str) -> impl FnOnce(git2::Error) -> HistoryFailure {
    move |error| HistoryFailure::new("history-corrupt", phase, error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_history_reports_managed_files_and_first_profile_version() {
        let project = tempfile::tempdir().unwrap();
        let storage = tempfile::tempdir().unwrap();
        fs::write(
            project.path().join(".ocproject"),
            br#"{"name":"Fixture","version":"v0.2.4"}"#,
        )
        .unwrap();
        fs::create_dir_all(project.path().join("cards")).unwrap();
        fs::write(project.path().join("cards/main.ocdocument"), b"{}").unwrap();
        let prepared = prepare_project(project.path(), storage.path(), 1, Vec::new()).unwrap();
        let context = load_project_context(
            project.path(),
            storage.path(),
            &prepared.identity.project_id,
        )
        .unwrap();

        let status = get_status(&context, 7).unwrap();

        assert_eq!(status.identity.generation, 7);
        assert_eq!(status.next_version, "0.2.4");
        assert!(status.current.is_none());
        assert!(status.expected_head_commit_id.is_none());
        assert!(status.has_managed_content);
        assert_eq!(status.change_summary.added, 2);
        assert_eq!(status.change_summary.modified, 0);
        assert_eq!(status.change_summary.deleted, 0);
        assert_eq!(status.change_summary.files[0].path, ".ocproject");
        assert!(!status.change_summary.snapshot_id.is_empty());
    }

    #[test]
    fn profile_version_projection_is_neutral_in_snapshot_comparison() {
        let before = br#"{"name":"Fixture","version":"0.0.1"}"#;
        let after = br#"{"name":"Fixture","version":"9.9.9"}"#;
        let before_oid = Oid::hash_object(ObjectType::Blob, before).unwrap();
        let after_oid = Oid::hash_object(ObjectType::Blob, after).unwrap();

        assert_eq!(
            comparison_oid_for_profile(before, before_oid).unwrap(),
            comparison_oid_for_profile(after, after_oid).unwrap(),
        );
    }

    #[test]
    fn semantic_versions_reject_leading_zeroes_and_non_release_syntax() {
        assert_eq!(parse_version("v1.2.3"), Some((1, 2, 3)));
        assert_eq!(parse_version("0.0.1"), Some((0, 0, 1)));
        for version in ["1.2", "01.2.3", "1.2.3-beta", "1.2.3+build", "-1.2.3"] {
            assert_eq!(parse_version(version), None);
        }
    }

    #[test]
    fn requested_version_is_written_to_the_single_new_commit() {
        let project = tempfile::tempdir().unwrap();
        let storage = tempfile::tempdir().unwrap();
        fs::write(project.path().join("README.md"), b"fixture").unwrap();
        let prepared = prepare_project(project.path(), storage.path(), 1, Vec::new()).unwrap();
        let context = load_project_context(
            project.path(),
            storage.path(),
            &prepared.identity.project_id,
        )
        .unwrap();
        let status = get_status(&context, 1).unwrap();

        let created = create_version(
            &context,
            CreateVersionRequest {
                operation_id: "requested-version".to_owned(),
                project_root: display_path(project.path()),
                project_id: context.project_id.clone(),
                generation: 1,
                expected_head_commit_id: None,
                expected_snapshot_id: status.change_summary.snapshot_id,
                description: "Release candidate".to_owned(),
                requested_version: Some("1.2.3".to_owned()),
            },
        )
        .unwrap();

        assert_eq!(created.version.version, "1.2.3");
        assert_eq!(
            list_versions(
                &context,
                ListVersionsRequest {
                    operation_id: "list".to_owned(),
                    project_root: display_path(project.path()),
                    project_id: context.project_id.clone(),
                    generation: 1,
                    cursor: None,
                    limit: Some(10),
                },
            )
            .unwrap()
            .items
            .len(),
            1
        );
    }

    #[test]
    fn invalid_profile_bytes_remain_unchanged_when_saving_a_version() {
        let project = tempfile::tempdir().unwrap();
        let storage = tempfile::tempdir().unwrap();
        fs::write(project.path().join(".ocproject"), b"not-json").unwrap();
        fs::write(project.path().join("README.md"), b"fixture").unwrap();
        let prepared = prepare_project(project.path(), storage.path(), 1, Vec::new()).unwrap();
        let context = load_project_context(
            project.path(),
            storage.path(),
            &prepared.identity.project_id,
        )
        .unwrap();
        let status = get_status(&context, 1).unwrap();

        create_version(
            &context,
            CreateVersionRequest {
                operation_id: "invalid-profile".to_owned(),
                project_root: display_path(project.path()),
                project_id: context.project_id.clone(),
                generation: 1,
                expected_head_commit_id: None,
                expected_snapshot_id: status.change_summary.snapshot_id,
                description: "Keep source bytes".to_owned(),
                requested_version: None,
            },
        )
        .unwrap();

        assert_eq!(
            fs::read(project.path().join(".ocproject")).unwrap(),
            b"not-json"
        );
    }

    #[test]
    fn pending_profile_transaction_recovers_before_or_after_head_commit() {
        let project = tempfile::tempdir().unwrap();
        let storage = tempfile::tempdir().unwrap();
        fs::write(
            project.path().join(".ocproject"),
            br#"{"name":"Fixture","version":"0.0.0"}"#,
        )
        .unwrap();
        let prepared = prepare_project(project.path(), storage.path(), 1, Vec::new()).unwrap();
        let context = load_project_context(
            project.path(),
            storage.path(),
            &prepared.identity.project_id,
        )
        .unwrap();
        let status = get_status(&context, 1).unwrap();
        let first = create_version(
            &context,
            CreateVersionRequest {
                operation_id: "first".to_owned(),
                project_root: display_path(project.path()),
                project_id: context.project_id.clone(),
                generation: 1,
                expected_head_commit_id: None,
                expected_snapshot_id: status.change_summary.snapshot_id,
                description: "First".to_owned(),
                requested_version: None,
            },
        )
        .unwrap();
        let repository = open_repository(&context).unwrap();
        let old_head = repository
            .find_commit(Oid::from_str(&first.version.commit_id).unwrap())
            .unwrap();
        let signature = git_signature(unix_time_ms()).unwrap();
        let tree = old_head.tree().unwrap();
        let new_head = repository
            .commit(None, &signature, &signature, "pending", &tree, &[&old_head])
            .unwrap();
        let before = fs::read(project.path().join(".ocproject")).unwrap();
        let after = br#"{"name":"Fixture","version":"0.0.2"}"#.to_vec();

        let rollback_root = context.project_history_root.join("transactions/rollback");
        fs::create_dir_all(&rollback_root).unwrap();
        write_file_atomically(&rollback_root.join("profile.before"), &before).unwrap();
        write_file_atomically(&rollback_root.join("profile.after"), &after).unwrap();
        write_transaction_journal(
            &rollback_root,
            &VersionTransactionJournal {
                schema_version: SCHEMA_VERSION,
                phase: "profile-written".to_owned(),
                old_head_commit_id: Some(old_head.id().to_string()),
                new_head_commit_id: new_head.to_string(),
                profile_existed: true,
            },
        )
        .unwrap();
        fs::write(project.path().join(".ocproject"), &after).unwrap();

        recover_pending_transactions(&context).unwrap();
        assert_eq!(fs::read(project.path().join(".ocproject")).unwrap(), before);

        let replay_root = context.project_history_root.join("transactions/replay");
        fs::create_dir_all(&replay_root).unwrap();
        write_file_atomically(&replay_root.join("profile.before"), &before).unwrap();
        write_file_atomically(&replay_root.join("profile.after"), &after).unwrap();
        write_transaction_journal(
            &replay_root,
            &VersionTransactionJournal {
                schema_version: SCHEMA_VERSION,
                phase: "profile-written".to_owned(),
                old_head_commit_id: Some(old_head.id().to_string()),
                new_head_commit_id: new_head.to_string(),
                profile_existed: true,
            },
        )
        .unwrap();
        move_head(&repository, Some(old_head.id()), new_head).unwrap();
        fs::write(project.path().join(".ocproject"), &before).unwrap();

        recover_pending_transactions(&context).unwrap();
        assert_eq!(fs::read(project.path().join(".ocproject")).unwrap(), after);
    }

    #[test]
    fn publishing_tags_existing_versions_and_only_renumbers_the_clean_tip() {
        let project = tempfile::tempdir().unwrap();
        let storage = tempfile::tempdir().unwrap();
        fs::write(
            project.path().join(".ocproject"),
            br#"{"name":"Fixture","version":"0.0.1"}"#,
        )
        .unwrap();
        fs::write(project.path().join("README.md"), b"first").unwrap();
        let prepared = prepare_project(project.path(), storage.path(), 1, Vec::new()).unwrap();
        let context = load_project_context(
            project.path(),
            storage.path(),
            &prepared.identity.project_id,
        )
        .unwrap();
        let first_status = get_status(&context, 1).unwrap();
        let first = create_version(
            &context,
            CreateVersionRequest {
                operation_id: "first".to_owned(),
                project_root: display_path(project.path()),
                project_id: context.project_id.clone(),
                generation: 1,
                expected_head_commit_id: None,
                expected_snapshot_id: first_status.change_summary.snapshot_id,
                description: "First".to_owned(),
                requested_version: None,
            },
        )
        .unwrap();
        fs::write(project.path().join("README.md"), b"second").unwrap();
        let second_status = get_status(&context, 1).unwrap();
        let second = create_version(
            &context,
            CreateVersionRequest {
                operation_id: "second".to_owned(),
                project_root: display_path(project.path()),
                project_id: context.project_id.clone(),
                generation: 1,
                expected_head_commit_id: second_status.expected_head_commit_id,
                expected_snapshot_id: second_status.change_summary.snapshot_id,
                description: "Second".to_owned(),
                requested_version: None,
            },
        )
        .unwrap();

        let historical = publish_version(
            &context,
            PublishVersionRequest {
                operation_id: "publish-first".to_owned(),
                project_root: display_path(project.path()),
                project_id: context.project_id.clone(),
                generation: 1,
                commit_id: first.version.commit_id.clone(),
                version: first.version.version.clone(),
                description: "First release".to_owned(),
            },
        )
        .unwrap();
        assert_eq!(
            historical.version.release.unwrap().description,
            "First release"
        );
        assert_eq!(
            head_commit(&open_repository(&context).unwrap())
                .unwrap()
                .unwrap()
                .id()
                .to_string(),
            second.version.commit_id
        );

        let current = publish_version(
            &context,
            PublishVersionRequest {
                operation_id: "publish-second".to_owned(),
                project_root: display_path(project.path()),
                project_id: context.project_id.clone(),
                generation: 1,
                commit_id: second.version.commit_id,
                version: "1.0.0".to_owned(),
                description: "Major release".to_owned(),
            },
        )
        .unwrap();
        assert_eq!(current.renumbered_from.as_deref(), Some("0.0.2"));
        assert_eq!(current.version.version, "1.0.0");
        assert_eq!(
            current.version.release.as_ref().unwrap().description,
            "Major release"
        );
        let profile: serde_json::Value =
            serde_json::from_slice(&fs::read(project.path().join(".ocproject")).unwrap()).unwrap();
        assert_eq!(profile["version"], "1.0.0");

        let edited = edit_release_description(
            &context,
            EditReleaseDescriptionRequest {
                operation_id: "edit-first".to_owned(),
                project_root: display_path(project.path()),
                project_id: context.project_id.clone(),
                generation: 1,
                commit_id: first.version.commit_id,
                description: "Updated notes".to_owned(),
            },
        )
        .unwrap();
        assert_eq!(edited.release.unwrap().description, "Updated notes");
    }

    #[test]
    fn restore_appends_a_new_tip_and_preserves_later_versions() {
        let project = tempfile::tempdir().unwrap();
        let storage = tempfile::tempdir().unwrap();
        fs::write(project.path().join("README.md"), b"first").unwrap();
        let prepared = prepare_project(project.path(), storage.path(), 1, Vec::new()).unwrap();
        let context = load_project_context(
            project.path(),
            storage.path(),
            &prepared.identity.project_id,
        )
        .unwrap();
        let first_status = get_status(&context, 1).unwrap();
        let first = create_version(
            &context,
            CreateVersionRequest {
                operation_id: "first".to_owned(),
                project_root: display_path(project.path()),
                project_id: context.project_id.clone(),
                generation: 1,
                expected_head_commit_id: None,
                expected_snapshot_id: first_status.change_summary.snapshot_id,
                description: "First".to_owned(),
                requested_version: None,
            },
        )
        .unwrap();
        fs::write(project.path().join("README.md"), b"second").unwrap();
        fs::write(project.path().join("extra.json"), b"{}").unwrap();
        let second_status = get_status(&context, 1).unwrap();
        let second = create_version(
            &context,
            CreateVersionRequest {
                operation_id: "second".to_owned(),
                project_root: display_path(project.path()),
                project_id: context.project_id.clone(),
                generation: 1,
                expected_head_commit_id: second_status.expected_head_commit_id,
                expected_snapshot_id: second_status.change_summary.snapshot_id,
                description: "Second".to_owned(),
                requested_version: None,
            },
        )
        .unwrap();
        let restore_status = get_status(&context, 1).unwrap();

        let restored = restore_project(
            &context,
            RestoreProjectRequest {
                operation_id: "restore-first".to_owned(),
                project_root: display_path(project.path()),
                project_id: context.project_id.clone(),
                generation: 1,
                target_commit_id: first.version.commit_id.clone(),
                expected_head_commit_id: restore_status.expected_head_commit_id,
                expected_snapshot_id: restore_status.change_summary.snapshot_id,
                description: "Restore first".to_owned(),
            },
        )
        .unwrap();

        assert_eq!(
            fs::read(project.path().join("README.md")).unwrap(),
            b"first"
        );
        assert!(!project.path().join("extra.json").exists());
        assert_eq!(restored.version.kind, "restored");
        assert_eq!(
            restored.version.restored_from.as_deref(),
            Some(first.version.commit_id.as_str())
        );
        assert_eq!(
            restored.version.parent_commit_id.as_deref(),
            Some(second.version.commit_id.as_str())
        );
        let versions = list_versions(
            &context,
            ListVersionsRequest {
                operation_id: "list".to_owned(),
                project_root: display_path(project.path()),
                project_id: context.project_id.clone(),
                generation: 1,
                cursor: None,
                limit: Some(10),
            },
        )
        .unwrap();
        assert_eq!(versions.items.len(), 3);
        assert_eq!(versions.items[1].commit_id, second.version.commit_id);
        assert_eq!(versions.items[2].commit_id, first.version.commit_id);
    }

    #[test]
    fn pending_restore_rolls_back_before_commit_and_keeps_committed_head() {
        let project = tempfile::tempdir().unwrap();
        let storage = tempfile::tempdir().unwrap();
        fs::write(project.path().join("README.md"), b"first").unwrap();
        let prepared = prepare_project(project.path(), storage.path(), 1, Vec::new()).unwrap();
        let context = load_project_context(
            project.path(),
            storage.path(),
            &prepared.identity.project_id,
        )
        .unwrap();
        let first_status = get_status(&context, 1).unwrap();
        let first = create_version(
            &context,
            CreateVersionRequest {
                operation_id: "first".to_owned(),
                project_root: display_path(project.path()),
                project_id: context.project_id.clone(),
                generation: 1,
                expected_head_commit_id: None,
                expected_snapshot_id: first_status.change_summary.snapshot_id,
                description: "First".to_owned(),
                requested_version: None,
            },
        )
        .unwrap();
        fs::write(project.path().join("README.md"), b"second").unwrap();
        let second_status = get_status(&context, 1).unwrap();
        create_version(
            &context,
            CreateVersionRequest {
                operation_id: "second".to_owned(),
                project_root: display_path(project.path()),
                project_id: context.project_id.clone(),
                generation: 1,
                expected_head_commit_id: second_status.expected_head_commit_id,
                expected_snapshot_id: second_status.change_summary.snapshot_id,
                description: "Second".to_owned(),
                requested_version: None,
            },
        )
        .unwrap();

        let pending = context
            .project_history_root
            .join("restore-transactions/pending");
        fs::create_dir_all(pending.join("before")).unwrap();
        write_restore_file(&pending.join("before"), "README.md", b"second").unwrap();
        write_restore_journal(
            &pending,
            &RestoreTransactionJournal {
                schema_version: SCHEMA_VERSION,
                phase: "applied".to_owned(),
                files: vec![RestoreFileRecord {
                    relative_path: "README.md".to_owned(),
                    existed: true,
                }],
            },
        )
        .unwrap();
        fs::write(project.path().join("README.md"), b"first").unwrap();

        recover_pending_restore_transactions(&context).unwrap();
        assert_eq!(
            fs::read(project.path().join("README.md")).unwrap(),
            b"second"
        );

        let restore_status = get_status(&context, 1).unwrap();
        restore_project(
            &context,
            RestoreProjectRequest {
                operation_id: "restore-first".to_owned(),
                project_root: display_path(project.path()),
                project_id: context.project_id.clone(),
                generation: 1,
                target_commit_id: first.version.commit_id,
                expected_head_commit_id: restore_status.expected_head_commit_id,
                expected_snapshot_id: restore_status.change_summary.snapshot_id,
                description: "Restore first".to_owned(),
            },
        )
        .unwrap();
        let committed = context
            .project_history_root
            .join("restore-transactions/committed");
        fs::create_dir_all(committed.join("before")).unwrap();
        write_restore_file(&committed.join("before"), "README.md", b"second").unwrap();
        write_restore_journal(
            &committed,
            &RestoreTransactionJournal {
                schema_version: SCHEMA_VERSION,
                phase: "applied".to_owned(),
                files: vec![RestoreFileRecord {
                    relative_path: "README.md".to_owned(),
                    existed: true,
                }],
            },
        )
        .unwrap();

        recover_pending_restore_transactions(&context).unwrap();
        assert_eq!(
            fs::read(project.path().join("README.md")).unwrap(),
            b"first"
        );
        assert!(!committed.exists());
    }

    #[test]
    fn create_version_commits_whitelisted_tree_and_projects_profile_version() {
        let project = tempfile::tempdir().unwrap();
        let storage = tempfile::tempdir().unwrap();
        fs::write(
            project.path().join(".ocproject"),
            br#"{"name":"Fixture","version":"v0.2.4","unknown":{"kept":true}}"#,
        )
        .unwrap();
        fs::create_dir_all(project.path().join("cards")).unwrap();
        fs::write(project.path().join("cards/main.ocdocument"), b"first").unwrap();
        let prepared = prepare_project(project.path(), storage.path(), 1, Vec::new()).unwrap();
        let context = load_project_context(
            project.path(),
            storage.path(),
            &prepared.identity.project_id,
        )
        .unwrap();
        let before = get_status(&context, 1).unwrap();
        let first = create_version(
            &context,
            CreateVersionRequest {
                operation_id: "create-first".to_owned(),
                project_root: project.path().to_string_lossy().into_owned(),
                project_id: prepared.identity.project_id.clone(),
                generation: 1,
                expected_head_commit_id: before.expected_head_commit_id.clone(),
                expected_snapshot_id: before.change_summary.snapshot_id.clone(),
                description: "Initial card set".to_owned(),
                requested_version: None,
            },
        )
        .unwrap();

        assert_eq!(first.version.version, "0.2.4");
        assert_eq!(first.version.parent_commit_id, None);
        assert_eq!(first.version.previous_version, None);
        assert_eq!(first.change_summary.added, 2);
        let profile: serde_json::Value =
            serde_json::from_slice(&fs::read(project.path().join(".ocproject")).unwrap()).unwrap();
        assert_eq!(profile["version"], "0.2.4");
        assert_eq!(profile["unknown"]["kept"], true);

        let after_first = get_status(&context, 1).unwrap();
        assert_eq!(after_first.current.as_ref().unwrap().version, "0.2.4");
        assert_eq!(after_first.next_version, "0.2.5");
        assert_eq!(after_first.change_summary.files.len(), 0);

        fs::write(project.path().join("cards/main.ocdocument"), b"second").unwrap();
        let before_second = get_status(&context, 1).unwrap();
        let second = create_version(
            &context,
            CreateVersionRequest {
                operation_id: "create-second".to_owned(),
                project_root: project.path().to_string_lossy().into_owned(),
                project_id: prepared.identity.project_id,
                generation: 1,
                expected_head_commit_id: before_second.expected_head_commit_id,
                expected_snapshot_id: before_second.change_summary.snapshot_id,
                description: "Update card set".to_owned(),
                requested_version: None,
            },
        )
        .unwrap();

        assert_eq!(second.version.version, "0.2.5");
        assert_eq!(
            second.version.parent_commit_id,
            Some(first.version.commit_id)
        );
        assert_eq!(second.version.previous_version.as_deref(), Some("0.2.4"));
        assert_eq!(second.change_summary.modified, 1);

        let first_page = list_versions(
            &context,
            ListVersionsRequest {
                operation_id: "list-first".to_owned(),
                project_root: project.path().to_string_lossy().into_owned(),
                project_id: context.project_id.clone(),
                generation: 1,
                cursor: None,
                limit: Some(1),
            },
        )
        .unwrap();
        assert_eq!(first_page.items.len(), 1);
        assert_eq!(first_page.items[0].version, "0.2.5");
        let second_page = list_versions(
            &context,
            ListVersionsRequest {
                operation_id: "list-second".to_owned(),
                project_root: project.path().to_string_lossy().into_owned(),
                project_id: context.project_id.clone(),
                generation: 1,
                cursor: first_page.next_cursor,
                limit: Some(1),
            },
        )
        .unwrap();
        assert_eq!(second_page.items.len(), 1);
        assert_eq!(second_page.items[0].version, "0.2.4");
        assert!(second_page.next_cursor.is_none());

        fs::write(project.path().join("notes.txt"), b"unrelated").unwrap();
        let before_third = get_status(&context, 1).unwrap();
        create_version(
            &context,
            CreateVersionRequest {
                operation_id: "create-third".to_owned(),
                project_root: project.path().to_string_lossy().into_owned(),
                project_id: context.project_id.clone(),
                generation: 1,
                expected_head_commit_id: before_third.expected_head_commit_id,
                expected_snapshot_id: before_third.change_summary.snapshot_id,
                description: "Add notes".to_owned(),
                requested_version: None,
            },
        )
        .unwrap();
        let history = list_file_history(
            &context,
            FileHistoryRequest {
                operation_id: "file-history".to_owned(),
                project_root: project.path().to_string_lossy().into_owned(),
                project_id: context.project_id.clone(),
                generation: 1,
                relative_path: "cards/main.ocdocument".to_owned(),
            },
        )
        .unwrap();
        assert_eq!(
            history
                .items
                .iter()
                .map(|item| item.version.as_str())
                .collect::<Vec<_>>(),
            ["0.2.5", "0.2.4"]
        );
    }

    #[test]
    fn create_version_rejects_stale_snapshot_without_moving_head() {
        let project = tempfile::tempdir().unwrap();
        let storage = tempfile::tempdir().unwrap();
        fs::write(project.path().join("notes.txt"), b"first").unwrap();
        let prepared = prepare_project(project.path(), storage.path(), 1, Vec::new()).unwrap();
        let context = load_project_context(
            project.path(),
            storage.path(),
            &prepared.identity.project_id,
        )
        .unwrap();
        let status = get_status(&context, 1).unwrap();
        fs::write(project.path().join("notes.txt"), b"changed").unwrap();

        let error = create_version(
            &context,
            CreateVersionRequest {
                operation_id: "stale".to_owned(),
                project_root: project.path().to_string_lossy().into_owned(),
                project_id: prepared.identity.project_id,
                generation: 1,
                expected_head_commit_id: status.expected_head_commit_id,
                expected_snapshot_id: status.change_summary.snapshot_id,
                description: "Stale".to_owned(),
                requested_version: None,
            },
        )
        .unwrap_err();

        assert_eq!(error.code, "stale-state");
        assert!(get_status(&context, 1).unwrap().current.is_none());
    }

    #[test]
    fn preview_changes_applies_dirty_overlay_without_writing_project_file() {
        let project = tempfile::tempdir().unwrap();
        let storage = tempfile::tempdir().unwrap();
        fs::write(project.path().join("notes.txt"), b"first").unwrap();
        let prepared = prepare_project(project.path(), storage.path(), 1, Vec::new()).unwrap();
        let context = load_project_context(
            project.path(),
            storage.path(),
            &prepared.identity.project_id,
        )
        .unwrap();
        let status = get_status(&context, 1).unwrap();
        create_version(
            &context,
            CreateVersionRequest {
                operation_id: "initial".to_owned(),
                project_root: project.path().to_string_lossy().into_owned(),
                project_id: context.project_id.clone(),
                generation: 1,
                expected_head_commit_id: status.expected_head_commit_id,
                expected_snapshot_id: status.change_summary.snapshot_id,
                description: "Initial".to_owned(),
                requested_version: None,
            },
        )
        .unwrap();

        let preview = preview_changes(
            &context,
            PreviewChangesRequest {
                operation_id: "preview".to_owned(),
                project_root: project.path().to_string_lossy().into_owned(),
                project_id: context.project_id.clone(),
                generation: 1,
                overlays: vec![DraftOverlayDto {
                    session_id: "session".to_owned(),
                    relative_path: "notes.txt".to_owned(),
                    content: "second".to_owned(),
                    content_revision: 3,
                }],
            },
        )
        .unwrap();

        assert_eq!(preview.change_summary.modified, 1);
        assert_eq!(preview.overlay_revisions[0].content_revision, 3);
        assert_eq!(
            fs::read(project.path().join("notes.txt")).unwrap(),
            b"first"
        );
        assert_eq!(get_status(&context, 1).unwrap().change_summary.modified, 0);
    }
}
