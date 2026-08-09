use super::*;
use git2::{ObjectType, Oid};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::Arc;

const LOCAL_HISTORY_SCHEMA_VERSION: u32 = 1;
const LOCAL_HISTORY_LIMIT: usize = 100;
const MERGE_WINDOW_MS: u64 = 10_000;
const LOCAL_HISTORY_TEXT_EXTENSIONS: &[&str] = &[
    "ocdocument",
    "txt",
    "json",
    "md",
    "ts",
    "tsx",
    "js",
    "jsx",
    "mjs",
    "cjs",
    "vue",
    "html",
    "css",
    "scss",
    "sass",
    "less",
];
const LOCAL_HISTORY_ROOT_FILES: &[&str] = &[
    ".ocproject",
    ".oclocale",
    ".ocfonts",
    ".ocicons",
    ".ocblocks",
    ".gitignore",
    ".gitattributes",
];
const LOCAL_HISTORY_SOURCES: &[&str] = &[
    "manual-save",
    "close-guard-save",
    "save-version",
    "save-and-publish",
    "file-restored",
    "file-renamed",
    "file-moved",
];
const NON_MERGING_SOURCES: &[&str] = &["file-restored", "file-renamed", "file-moved"];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalHistoryRecordRequest {
    pub operation_id: String,
    pub project_root: String,
    pub project_id: String,
    pub generation: u64,
    pub relative_path: String,
    pub source: String,
    pub source_description: Option<String>,
    pub content: Vec<u8>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalHistoryPathRequest {
    pub operation_id: String,
    pub project_root: String,
    pub project_id: String,
    pub generation: u64,
    pub relative_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalHistoryEntryRequest {
    pub operation_id: String,
    pub project_root: String,
    pub project_id: String,
    pub generation: u64,
    pub relative_path: String,
    pub entry_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalHistoryRestoreRequest {
    pub operation_id: String,
    pub project_root: String,
    pub project_id: String,
    pub generation: u64,
    pub relative_path: String,
    pub entry_id: String,
    pub expected_content_oid: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LocalHistoryEntryDto {
    pub schema_version: u32,
    pub entry_id: String,
    pub relative_path: String,
    pub created_at_unix_ms: u64,
    pub source: String,
    pub source_description: Option<String>,
    pub content_oid: String,
    pub size: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalHistoryWarningDto {
    pub code: String,
    pub entry_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalHistoryRecordResponse {
    pub project_id: String,
    pub entry: LocalHistoryEntryDto,
    pub result: String,
    pub warnings: Vec<LocalHistoryWarningDto>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalHistoryListResponse {
    pub project_id: String,
    pub relative_path: String,
    pub items: Vec<LocalHistoryEntryDto>,
    pub warnings: Vec<LocalHistoryWarningDto>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalHistoryReadResponse {
    pub project_id: String,
    pub entry: LocalHistoryEntryDto,
    pub content: Vec<u8>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalHistoryDeleteResponse {
    pub project_id: String,
    pub deleted: bool,
    pub warnings: Vec<LocalHistoryWarningDto>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalHistoryRestoreResponse {
    pub project_id: String,
    pub relative_path: String,
    pub restored: bool,
    pub warning: Option<LocalHistoryWarningDto>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LocalHistoryManifest {
    schema_version: u32,
    entries: Vec<LocalHistoryEntryDto>,
}

#[derive(Debug)]
struct LoadedEntries {
    entries: Vec<LocalHistoryEntryDto>,
    warnings: Vec<LocalHistoryWarningDto>,
}

#[derive(Debug)]
struct ResolvedHistoryPath {
    relative_path: String,
    path_key: String,
    history_directory: PathBuf,
}

#[tauri::command]
pub async fn local_history_record(
    request: LocalHistoryRecordRequest,
    app_handle: tauri::AppHandle,
    state: State<'_, VersionHistoryState>,
) -> Result<LocalHistoryRecordResponse, VersionErrorDto> {
    let operation = "local_history_record";
    validate_record_request(&request).map_err(|error| to_error_dto(operation, error))?;
    let storage_root =
        resolve_storage_root(&app_handle).map_err(|error| to_error_dto(operation, error))?;
    let write_lock = Arc::clone(&state.write_lock);
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
        record_entry(&context, request)
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
pub async fn local_history_list(
    request: LocalHistoryPathRequest,
    app_handle: tauri::AppHandle,
) -> Result<LocalHistoryListResponse, VersionErrorDto> {
    let operation = "local_history_list";
    validate_path_request(&request).map_err(|error| to_error_dto(operation, error))?;
    let storage_root =
        resolve_storage_root(&app_handle).map_err(|error| to_error_dto(operation, error))?;
    let result = tauri::async_runtime::spawn_blocking(move || {
        let context = load_project_context(
            Path::new(&request.project_root),
            &storage_root,
            &request.project_id,
        )?;
        list_entries(&context, &request.relative_path)
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
pub async fn local_history_read(
    request: LocalHistoryEntryRequest,
    app_handle: tauri::AppHandle,
) -> Result<LocalHistoryReadResponse, VersionErrorDto> {
    let operation = "local_history_read";
    validate_entry_request(&request).map_err(|error| to_error_dto(operation, error))?;
    let storage_root =
        resolve_storage_root(&app_handle).map_err(|error| to_error_dto(operation, error))?;
    let result = tauri::async_runtime::spawn_blocking(move || {
        let context = load_project_context(
            Path::new(&request.project_root),
            &storage_root,
            &request.project_id,
        )?;
        read_entry(&context, &request.relative_path, &request.entry_id)
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
pub async fn local_history_delete(
    request: LocalHistoryEntryRequest,
    app_handle: tauri::AppHandle,
    state: State<'_, VersionHistoryState>,
) -> Result<LocalHistoryDeleteResponse, VersionErrorDto> {
    let operation = "local_history_delete";
    validate_entry_request(&request).map_err(|error| to_error_dto(operation, error))?;
    let storage_root =
        resolve_storage_root(&app_handle).map_err(|error| to_error_dto(operation, error))?;
    let write_lock = Arc::clone(&state.write_lock);
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
        delete_entry(&context, &request.relative_path, &request.entry_id)
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
pub async fn local_history_restore(
    request: LocalHistoryRestoreRequest,
    app_handle: tauri::AppHandle,
    state: State<'_, VersionHistoryState>,
) -> Result<LocalHistoryRestoreResponse, VersionErrorDto> {
    let operation = "local_history_restore";
    validate_restore_request(&request).map_err(|error| to_error_dto(operation, error))?;
    let storage_root =
        resolve_storage_root(&app_handle).map_err(|error| to_error_dto(operation, error))?;
    let write_lock = Arc::clone(&state.write_lock);
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
        restore_entry(&context, &request)
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

fn validate_record_request(request: &LocalHistoryRecordRequest) -> Result<(), HistoryFailure> {
    let _request_generation = request.generation;
    validate_common_request(
        &request.operation_id,
        &request.project_root,
        &request.project_id,
    )?;
    if !LOCAL_HISTORY_SOURCES.contains(&request.source.as_str()) {
        return Err(HistoryFailure::new(
            "invalid-request",
            "validate-source",
            "unsupported Local History source",
        ));
    }
    Ok(())
}

fn validate_path_request(request: &LocalHistoryPathRequest) -> Result<(), HistoryFailure> {
    let _request_generation = request.generation;
    validate_common_request(
        &request.operation_id,
        &request.project_root,
        &request.project_id,
    )
}

fn validate_entry_request(request: &LocalHistoryEntryRequest) -> Result<(), HistoryFailure> {
    let _request_generation = request.generation;
    validate_common_request(
        &request.operation_id,
        &request.project_root,
        &request.project_id,
    )?;
    if !is_safe_entry_id(&request.entry_id) {
        return Err(HistoryFailure::new(
            "invalid-request",
            "validate-entry",
            "invalid Local History entry id",
        ));
    }
    Ok(())
}

fn validate_restore_request(request: &LocalHistoryRestoreRequest) -> Result<(), HistoryFailure> {
    validate_common_request(
        &request.operation_id,
        &request.project_root,
        &request.project_id,
    )?;
    if !is_safe_entry_id(&request.entry_id) {
        return Err(HistoryFailure::new(
            "invalid-request",
            "validate-entry",
            "invalid Local History entry id",
        ));
    }
    Ok(())
}

fn validate_common_request(
    operation_id: &str,
    project_root: &str,
    project_id: &str,
) -> Result<(), HistoryFailure> {
    if operation_id.trim().is_empty()
        || project_root.trim().is_empty()
        || project_id.trim().is_empty()
    {
        return Err(HistoryFailure::new(
            "invalid-request",
            "validate-request",
            "missing operation, project root, or project identity",
        ));
    }
    Ok(())
}

fn record_entry(
    context: &ProjectHistoryContext,
    request: LocalHistoryRecordRequest,
) -> Result<LocalHistoryRecordResponse, HistoryFailure> {
    record_entry_internal(context, request, false)
}

fn record_entry_internal(
    context: &ProjectHistoryContext,
    request: LocalHistoryRecordRequest,
    force: bool,
) -> Result<LocalHistoryRecordResponse, HistoryFailure> {
    let resolved = resolve_history_path(context, &request.relative_path, true)?;
    ensure_local_history_admission(context, &resolved.relative_path, &request.content)?;
    fs::create_dir_all(&resolved.history_directory).map_err(|error| {
        HistoryFailure::new("history-io", "create-directory", error.to_string())
            .project_id(&context.project_id)
            .relative_path(&resolved.relative_path)
            .retryable()
    })?;
    let loaded = load_entries(&resolved)?;
    let mut warnings = loaded.warnings;
    let content_oid = content_oid(&request.content)?;
    if !force {
        if let Some(previous) = loaded
            .entries
            .first()
            .filter(|entry| entry.content_oid == content_oid.to_string())
        {
            return Ok(LocalHistoryRecordResponse {
                project_id: context.project_id.clone(),
                entry: previous.clone(),
                result: "unchanged".to_owned(),
                warnings,
            });
        }
    }

    let now = unix_time_ms();
    let sequence = next_sequence(&loaded.entries);
    let entry_id = format!("{now:013}-{sequence:06}-{}", content_oid);
    let entry = LocalHistoryEntryDto {
        schema_version: LOCAL_HISTORY_SCHEMA_VERSION,
        entry_id: entry_id.clone(),
        relative_path: resolved.relative_path.clone(),
        created_at_unix_ms: now,
        source: request.source.clone(),
        source_description: request.source_description,
        content_oid: content_oid.to_string(),
        size: request.content.len() as u64,
    };
    let mut entries = loaded.entries;
    let mut result = "recorded";
    let mut removed_entries = Vec::new();
    if !NON_MERGING_SOURCES.contains(&request.source.as_str()) {
        if let Some(candidate) = entries.first() {
            let within_window = candidate.created_at_unix_ms <= now
                && now - candidate.created_at_unix_ms <= MERGE_WINDOW_MS;
            if candidate.source == request.source && within_window {
                result = "merged";
                removed_entries.push(entries.remove(0));
            }
        }
    }
    entries.push(entry.clone());
    entries.sort_by(|left, right| {
        right
            .created_at_unix_ms
            .cmp(&left.created_at_unix_ms)
            .then_with(|| right.entry_id.cmp(&left.entry_id))
    });
    if entries.len() > LOCAL_HISTORY_LIMIT {
        removed_entries.extend(entries.drain(LOCAL_HISTORY_LIMIT..));
    }

    let new_content_path = content_path(&resolved.history_directory, &entry.entry_id);
    write_file_atomically(&new_content_path, &request.content).map_err(|error| {
        HistoryFailure::new("history-io", "write-content", error.to_string())
            .project_id(&context.project_id)
            .relative_path(&resolved.relative_path)
            .retryable()
    })?;
    let manifest = LocalHistoryManifest {
        schema_version: LOCAL_HISTORY_SCHEMA_VERSION,
        entries,
    };
    if let Err(error) = write_manifest(&resolved, &manifest) {
        let _ = fs::remove_file(&new_content_path);
        return Err(error);
    }
    for old in removed_entries {
        let old_path = content_path(&resolved.history_directory, &old.entry_id);
        if let Err(error) = fs::remove_file(&old_path) {
            if error.kind() != std::io::ErrorKind::NotFound {
                warnings.push(LocalHistoryWarningDto {
                    code: "history-cleanup".to_owned(),
                    entry_id: Some(old.entry_id),
                });
            }
        }
    }
    Ok(LocalHistoryRecordResponse {
        project_id: context.project_id.clone(),
        entry,
        result: result.to_owned(),
        warnings,
    })
}

fn list_entries(
    context: &ProjectHistoryContext,
    relative_path: &str,
) -> Result<LocalHistoryListResponse, HistoryFailure> {
    let resolved = resolve_history_path(context, relative_path, false)?;
    let loaded = load_entries(&resolved)?;
    Ok(LocalHistoryListResponse {
        project_id: context.project_id.clone(),
        relative_path: resolved.relative_path,
        items: loaded.entries,
        warnings: loaded.warnings,
    })
}

fn read_entry(
    context: &ProjectHistoryContext,
    relative_path: &str,
    entry_id: &str,
) -> Result<LocalHistoryReadResponse, HistoryFailure> {
    let resolved = resolve_history_path(context, relative_path, false)?;
    let loaded = load_entries(&resolved)?;
    let entry = loaded
        .entries
        .into_iter()
        .find(|candidate| candidate.entry_id == entry_id)
        .ok_or_else(|| {
            HistoryFailure::new(
                "version-not-found",
                "read-entry",
                "Local History entry not found",
            )
            .project_id(&context.project_id)
            .relative_path(&resolved.relative_path)
        })?;
    let path = content_path(&resolved.history_directory, &entry.entry_id);
    let content = match fs::read(&path) {
        Ok(content) => content,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Err(
                HistoryFailure::new("history-corrupt", "read-content", error.to_string())
                    .project_id(&context.project_id)
                    .relative_path(&resolved.relative_path),
            )
        }
        Err(error) => {
            return Err(
                HistoryFailure::new("history-io", "read-content", error.to_string())
                    .project_id(&context.project_id)
                    .relative_path(&resolved.relative_path)
                    .retryable(),
            )
        }
    };
    verify_content(&entry, &content).map_err(|error| {
        error
            .project_id(&context.project_id)
            .relative_path(&resolved.relative_path)
    })?;
    Ok(LocalHistoryReadResponse {
        project_id: context.project_id.clone(),
        entry,
        content,
    })
}

fn restore_entry(
    context: &ProjectHistoryContext,
    request: &LocalHistoryRestoreRequest,
) -> Result<LocalHistoryRestoreResponse, HistoryFailure> {
    let _request_generation = request.generation;
    let resolved = resolve_history_path(context, &request.relative_path, false)?;
    let loaded = load_entries(&resolved)?;
    let entry = loaded
        .entries
        .into_iter()
        .find(|candidate| candidate.entry_id == request.entry_id)
        .ok_or_else(|| {
            HistoryFailure::new(
                "version-not-found",
                "restore-entry",
                "Local History entry not found",
            )
            .project_id(&context.project_id)
            .relative_path(&resolved.relative_path)
        })?;
    if let Some(expected) = request.expected_content_oid.as_deref() {
        if expected != entry.content_oid {
            return Err(HistoryFailure::new(
                "version-conflict",
                "restore-entry",
                "Local History entry changed",
            )
            .project_id(&context.project_id)
            .relative_path(&resolved.relative_path)
            .retryable());
        }
    }
    let content_path = content_path(&resolved.history_directory, &entry.entry_id);
    let content = fs::read(&content_path).map_err(|error| {
        HistoryFailure::new("history-corrupt", "read-content", error.to_string())
            .project_id(&context.project_id)
            .relative_path(&resolved.relative_path)
    })?;
    verify_content(&entry, &content)?;
    let target = context
        .canonical_root
        .join(Path::new(&resolved.relative_path));
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            HistoryFailure::new("history-io", "restore-entry", error.to_string())
                .project_id(&context.project_id)
                .relative_path(&resolved.relative_path)
                .retryable()
        })?;
    }
    write_file_atomically(&target, &content).map_err(|error| {
        HistoryFailure::new("history-io", "restore-entry", error.to_string())
            .project_id(&context.project_id)
            .relative_path(&resolved.relative_path)
            .retryable()
    })?;
    let record_warning = record_entry_internal(
        context,
        LocalHistoryRecordRequest {
            operation_id: request.operation_id.clone(),
            project_root: request.project_root.clone(),
            project_id: request.project_id.clone(),
            generation: request.generation,
            relative_path: resolved.relative_path.clone(),
            source: "file-restored".to_owned(),
            source_description: None,
            content: content.clone(),
        },
        true,
    )
    .err()
    .map(|_| LocalHistoryWarningDto {
        code: "restore-history-failed".to_owned(),
        entry_id: Some(entry.entry_id.clone()),
    });
    Ok(LocalHistoryRestoreResponse {
        project_id: context.project_id.clone(),
        relative_path: resolved.relative_path,
        restored: true,
        warning: record_warning,
    })
}

pub(super) fn read_entry_content(
    context: &ProjectHistoryContext,
    relative_path: &str,
    entry_id: &str,
) -> Result<Vec<u8>, HistoryFailure> {
    Ok(read_entry(context, relative_path, entry_id)?.content)
}

fn delete_entry(
    context: &ProjectHistoryContext,
    relative_path: &str,
    entry_id: &str,
) -> Result<LocalHistoryDeleteResponse, HistoryFailure> {
    let resolved = resolve_history_path(context, relative_path, false)?;
    let loaded = load_entries(&resolved)?;
    let Some(index) = loaded
        .entries
        .iter()
        .position(|candidate| candidate.entry_id == entry_id)
    else {
        return Ok(LocalHistoryDeleteResponse {
            project_id: context.project_id.clone(),
            deleted: false,
            warnings: loaded.warnings,
        });
    };
    let mut entries = loaded.entries;
    let removed = entries.remove(index);
    let manifest = LocalHistoryManifest {
        schema_version: LOCAL_HISTORY_SCHEMA_VERSION,
        entries,
    };
    write_manifest(&resolved, &manifest)?;
    let mut warnings = loaded.warnings;
    let path = content_path(&resolved.history_directory, &removed.entry_id);
    if let Err(error) = fs::remove_file(path) {
        if error.kind() != std::io::ErrorKind::NotFound {
            warnings.push(LocalHistoryWarningDto {
                code: "history-cleanup".to_owned(),
                entry_id: Some(removed.entry_id),
            });
        }
    }
    Ok(LocalHistoryDeleteResponse {
        project_id: context.project_id.clone(),
        deleted: true,
        warnings,
    })
}

fn resolve_history_path(
    context: &ProjectHistoryContext,
    relative_path: &str,
    require_file: bool,
) -> Result<ResolvedHistoryPath, HistoryFailure> {
    let normalized = relative_path.replace('\\', "/");
    let path = Path::new(&normalized);
    if normalized.trim().is_empty()
        || normalized.starts_with('/')
        || normalized.starts_with("//")
        || is_drive_path(&normalized)
        || path.components().any(|component| {
            matches!(
                component,
                Component::ParentDir
                    | Component::CurDir
                    | Component::RootDir
                    | Component::Prefix(_)
            )
        })
        || is_excluded_path(&normalized)
    {
        return Err(HistoryFailure::new(
            "project-boundary-violation",
            "validate-path",
            "invalid project-relative Local History path",
        )
        .project_id(&context.project_id)
        .relative_path(&normalized));
    }
    let absolute_path = context.canonical_root.join(path);
    let exists = absolute_path.exists();
    if require_file && !exists {
        return Err(HistoryFailure::new(
            "project-unavailable",
            "validate-path",
            "Local History source file does not exist",
        )
        .project_id(&context.project_id)
        .relative_path(&normalized)
        .retryable());
    }
    if exists {
        let metadata = fs::symlink_metadata(&absolute_path).map_err(|error| {
            HistoryFailure::new("history-io", "validate-path", error.to_string())
                .project_id(&context.project_id)
                .relative_path(&normalized)
                .retryable()
        })?;
        if metadata.file_type().is_symlink() || !metadata.is_file() {
            return Err(HistoryFailure::new(
                "project-boundary-violation",
                "validate-path",
                "Local History target is not a regular file",
            )
            .project_id(&context.project_id)
            .relative_path(&normalized));
        }
    }
    let existing_parent = nearest_existing_parent(&absolute_path).ok_or_else(|| {
        HistoryFailure::new(
            "project-unavailable",
            "validate-path",
            "Local History parent directory is unavailable",
        )
        .project_id(&context.project_id)
        .relative_path(&normalized)
        .retryable()
    })?;
    let canonical_parent = fs::canonicalize(existing_parent).map_err(|error| {
        HistoryFailure::new("history-io", "validate-path", error.to_string())
            .project_id(&context.project_id)
            .relative_path(&normalized)
            .retryable()
    })?;
    ensure_inside_root(&context.canonical_root, &canonical_parent).map_err(|error| {
        error
            .project_id(&context.project_id)
            .relative_path(&normalized)
    })?;
    let relative_path = if exists {
        let canonical_target = fs::canonicalize(&absolute_path).map_err(|error| {
            HistoryFailure::new("history-io", "validate-path", error.to_string())
                .project_id(&context.project_id)
                .relative_path(&normalized)
                .retryable()
        })?;
        ensure_inside_root(&context.canonical_root, &canonical_target)?;
        display_path(
            canonical_target
                .strip_prefix(&context.canonical_root)
                .map_err(|_| {
                    HistoryFailure::new(
                        "project-boundary-violation",
                        "validate-path",
                        "Local History target escaped project root",
                    )
                })?,
        )
    } else {
        normalized.clone()
    };
    let path_key = normalize_path_key(&relative_path);
    let path_hash = path_hash(&path_key)?;
    let history_directory = context
        .project_history_root
        .join("local-history")
        .join(&path_hash);
    Ok(ResolvedHistoryPath {
        relative_path,
        path_key,
        history_directory,
    })
}

fn ensure_local_history_admission(
    context: &ProjectHistoryContext,
    relative_path: &str,
    content: &[u8],
) -> Result<(), HistoryFailure> {
    if content.len() as u64 > MAX_FILE_SIZE {
        return Err(HistoryFailure::new(
            "snapshot-limit",
            "validate-file",
            "Local History content exceeds the managed file size limit",
        )
        .project_id(&context.project_id)
        .relative_path(relative_path));
    }
    let path = Path::new(relative_path);
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default();
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    let root_file = path.components().count() == 1
        && LOCAL_HISTORY_ROOT_FILES
            .iter()
            .any(|candidate| names_equal(file_name, candidate));
    let text_extension = LOCAL_HISTORY_TEXT_EXTENSIONS
        .iter()
        .any(|candidate| names_equal(extension, candidate));
    let template_managed = context
        .template_managed_paths
        .iter()
        .any(|candidate| normalize_path_key(candidate) == normalize_path_key(relative_path));
    if !(root_file || text_extension || template_managed)
        || !is_managed_file(relative_path, template_managed)
    {
        return Err(HistoryFailure::new(
            "unsupported-entry",
            "validate-file",
            "file is not eligible for Local History",
        )
        .project_id(&context.project_id)
        .relative_path(relative_path));
    }
    if (root_file || text_extension || template_managed) && std::str::from_utf8(content).is_err() {
        return Err(HistoryFailure::new(
            "unsupported-entry",
            "validate-file",
            "binary file is not eligible for Local History",
        )
        .project_id(&context.project_id)
        .relative_path(relative_path));
    }
    Ok(())
}

fn load_entries(resolved: &ResolvedHistoryPath) -> Result<LoadedEntries, HistoryFailure> {
    if !resolved.history_directory.exists() {
        return Ok(LoadedEntries {
            entries: Vec::new(),
            warnings: Vec::new(),
        });
    }
    let manifest_path = resolved.history_directory.join("entries.json");
    let bytes = match fs::read(&manifest_path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(LoadedEntries {
                entries: Vec::new(),
                warnings: cleanup_orphans(&resolved.history_directory, &BTreeSet::new()),
            });
        }
        Err(error) => {
            return Err(
                HistoryFailure::new("history-io", "read-metadata", error.to_string()).retryable(),
            )
        }
    };
    let manifest: LocalHistoryManifest = serde_json::from_slice(&bytes).map_err(|error| {
        HistoryFailure::new("history-corrupt", "parse-metadata", error.to_string())
    })?;
    if manifest.schema_version != LOCAL_HISTORY_SCHEMA_VERSION {
        return Err(HistoryFailure::new(
            "history-incompatible",
            "validate-metadata",
            "unsupported Local History schema",
        ));
    }
    let mut entries = Vec::new();
    let mut warnings = Vec::new();
    let mut referenced_files = BTreeSet::new();
    for entry in manifest.entries {
        if entry.schema_version != LOCAL_HISTORY_SCHEMA_VERSION
            || !is_safe_entry_id(&entry.entry_id)
        {
            warnings.push(LocalHistoryWarningDto {
                code: "history-corrupt".to_owned(),
                entry_id: Some(entry.entry_id),
            });
            continue;
        }
        if normalize_path_key(&entry.relative_path) != resolved.path_key {
            warnings.push(LocalHistoryWarningDto {
                code: "history-corrupt".to_owned(),
                entry_id: Some(entry.entry_id),
            });
            continue;
        }
        if entry.size > MAX_FILE_SIZE {
            warnings.push(LocalHistoryWarningDto {
                code: "history-corrupt".to_owned(),
                entry_id: Some(entry.entry_id),
            });
            continue;
        }
        let content_file = format!("{}.bin", entry.entry_id);
        referenced_files.insert(content_file.clone());
        let content_path = resolved.history_directory.join(&content_file);
        if !content_path.is_file() {
            warnings.push(LocalHistoryWarningDto {
                code: "history-corrupt".to_owned(),
                entry_id: Some(entry.entry_id),
            });
            continue;
        }
        entries.push(entry);
    }
    entries.sort_by(|left, right| {
        right
            .created_at_unix_ms
            .cmp(&left.created_at_unix_ms)
            .then_with(|| right.entry_id.cmp(&left.entry_id))
    });
    warnings.extend(cleanup_orphans(
        &resolved.history_directory,
        &referenced_files,
    ));
    Ok(LoadedEntries { entries, warnings })
}

fn cleanup_orphans(
    directory: &Path,
    referenced_files: &BTreeSet<String>,
) -> Vec<LocalHistoryWarningDto> {
    let mut warnings = Vec::new();
    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return warnings,
        Err(_) => {
            warnings.push(LocalHistoryWarningDto {
                code: "history-cleanup".to_owned(),
                entry_id: None,
            });
            return warnings;
        }
    };
    for entry in entries {
        let Ok(entry) = entry else {
            warnings.push(LocalHistoryWarningDto {
                code: "history-cleanup".to_owned(),
                entry_id: None,
            });
            continue;
        };
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name == "entries.json" || referenced_files.contains(&name) || !path.is_file() {
            continue;
        }
        if let Err(error) = fs::remove_file(path) {
            if error.kind() != std::io::ErrorKind::NotFound {
                warnings.push(LocalHistoryWarningDto {
                    code: "history-cleanup".to_owned(),
                    entry_id: None,
                });
            }
        }
    }
    warnings
}

fn write_manifest(
    resolved: &ResolvedHistoryPath,
    manifest: &LocalHistoryManifest,
) -> Result<(), HistoryFailure> {
    let bytes = serde_json::to_vec_pretty(manifest).map_err(|error| {
        HistoryFailure::new("history-io", "serialize-metadata", error.to_string())
    })?;
    write_file_atomically(&resolved.history_directory.join("entries.json"), &bytes).map_err(
        |error| HistoryFailure::new("history-io", "write-metadata", error.to_string()).retryable(),
    )
}

fn content_path(directory: &Path, entry_id: &str) -> PathBuf {
    directory.join(format!("{entry_id}.bin"))
}

fn content_oid(content: &[u8]) -> Result<Oid, HistoryFailure> {
    Oid::hash_object(ObjectType::Blob, content)
        .map_err(|error| HistoryFailure::new("history-io", "hash-content", error.to_string()))
}

fn path_hash(path_key: &str) -> Result<String, HistoryFailure> {
    Oid::hash_object(ObjectType::Blob, path_key.as_bytes())
        .map(|oid| oid.to_string())
        .map_err(|error| HistoryFailure::new("history-io", "hash-path", error.to_string()))
}

fn verify_content(entry: &LocalHistoryEntryDto, content: &[u8]) -> Result<(), HistoryFailure> {
    if entry.size != content.len() as u64 {
        return Err(HistoryFailure::new(
            "history-corrupt",
            "verify-content",
            "Local History content size does not match metadata",
        ));
    }
    let oid = content_oid(content)?;
    if oid.to_string() != entry.content_oid {
        return Err(HistoryFailure::new(
            "history-corrupt",
            "verify-content",
            "Local History content digest does not match metadata",
        ));
    }
    Ok(())
}

fn next_sequence(entries: &[LocalHistoryEntryDto]) -> u64 {
    entries
        .iter()
        .filter_map(|entry| entry.entry_id.split('-').nth(1))
        .filter_map(|value| value.parse::<u64>().ok())
        .max()
        .unwrap_or_default()
        .saturating_add(1)
}

fn is_safe_entry_id(entry_id: &str) -> bool {
    !entry_id.is_empty()
        && entry_id.len() <= 256
        && entry_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'-' | b'_'))
}

fn is_drive_path(path: &str) -> bool {
    let bytes = path.as_bytes();
    bytes.len() >= 2 && bytes[1] == b':' && bytes[0].is_ascii_alphabetic()
}

fn nearest_existing_parent(path: &Path) -> Option<&Path> {
    let mut current = path.parent()?;
    while !current.exists() {
        current = current.parent()?;
    }
    Some(current)
}

fn ensure_inside_root(root: &Path, target: &Path) -> Result<(), HistoryFailure> {
    let root_key = normalize_path_key(&display_path(root));
    let target_key = normalize_path_key(&display_path(target));
    if target_key == root_key || target_key.starts_with(&format!("{root_key}/")) {
        Ok(())
    } else {
        Err(HistoryFailure::new(
            "project-boundary-violation",
            "validate-path",
            "path escaped project root",
        ))
    }
}

fn normalize_path_key(path: &str) -> String {
    let normalized = path.replace('\\', "/").trim_matches('/').to_owned();
    #[cfg(target_os = "windows")]
    {
        normalized.to_lowercase()
    }
    #[cfg(not(target_os = "windows"))]
    {
        normalized
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn context(project: &Path, storage: &Path) -> ProjectHistoryContext {
        let canonical_root = fs::canonicalize(project).unwrap();
        let project_id = "fixture-project".to_owned();
        let project_history_root = storage.join("version-history/v1/p1-fixture-project");
        fs::create_dir_all(&project_history_root).unwrap();
        ProjectHistoryContext {
            canonical_root,
            canonical_root_text: project.to_string_lossy().replace('\\', "/"),
            project_id,
            project_history_root,
            template_managed_paths: vec!["custom.fixture".to_owned()],
        }
    }

    fn record(
        context: &ProjectHistoryContext,
        path: &str,
        source: &str,
        content: &[u8],
    ) -> LocalHistoryRecordResponse {
        record_entry(
            context,
            LocalHistoryRecordRequest {
                operation_id: "op".to_owned(),
                project_root: context.canonical_root_text.clone(),
                project_id: context.project_id.clone(),
                generation: 1,
                relative_path: path.to_owned(),
                source: source.to_owned(),
                source_description: None,
                content: content.to_vec(),
            },
        )
        .unwrap()
    }

    #[test]
    fn records_reads_deduplicates_merges_and_deletes() {
        let project = tempfile::tempdir().unwrap();
        let storage = tempfile::tempdir().unwrap();
        fs::write(project.path().join("notes.txt"), b"one").unwrap();
        let context = context(project.path(), storage.path());
        let first = record(&context, "notes.txt", "manual-save", b"one");
        let unchanged = record(&context, "notes.txt", "save-version", b"one");
        assert_eq!(unchanged.result, "unchanged");
        let second = record(&context, "notes.txt", "manual-save", b"two");
        assert_eq!(second.result, "merged");
        let listed = list_entries(&context, "notes.txt").unwrap();
        assert_eq!(listed.items.len(), 1);
        assert_eq!(listed.items[0].entry_id, second.entry.entry_id);
        let read = read_entry(&context, "notes.txt", &second.entry.entry_id).unwrap();
        assert_eq!(read.content, b"two");
        let deleted = delete_entry(&context, "notes.txt", &second.entry.entry_id).unwrap();
        assert!(deleted.deleted);
        assert!(list_entries(&context, "notes.txt")
            .unwrap()
            .items
            .is_empty());
        assert_ne!(first.entry.entry_id, second.entry.entry_id);
    }

    #[test]
    fn deduplicates_only_against_the_latest_entry() {
        let project = tempfile::tempdir().unwrap();
        let storage = tempfile::tempdir().unwrap();
        fs::write(project.path().join("notes.txt"), b"seed").unwrap();
        let context = context(project.path(), storage.path());
        record(&context, "notes.txt", "file-restored", b"one");
        record(&context, "notes.txt", "file-restored", b"two");
        let repeated = record(&context, "notes.txt", "file-restored", b"one");
        assert_eq!(repeated.result, "recorded");
        assert_eq!(list_entries(&context, "notes.txt").unwrap().items.len(), 3);
    }

    #[test]
    fn merge_requires_the_latest_entry_to_have_the_same_source() {
        let project = tempfile::tempdir().unwrap();
        let storage = tempfile::tempdir().unwrap();
        fs::write(project.path().join("notes.txt"), b"seed").unwrap();
        let context = context(project.path(), storage.path());
        record(&context, "notes.txt", "manual-save", b"one");
        record(&context, "notes.txt", "file-restored", b"two");
        let latest = record(&context, "notes.txt", "manual-save", b"three");
        assert_eq!(latest.result, "recorded");
        assert_eq!(list_entries(&context, "notes.txt").unwrap().items.len(), 3);
    }

    #[test]
    fn enforces_file_level_admission_and_relative_boundary() {
        let project = tempfile::tempdir().unwrap();
        let storage = tempfile::tempdir().unwrap();
        for path in [
            "notes.txt",
            ".ocproject",
            ".ocblocks",
            "assets/image.png",
            ".env.local",
            "custom.fixture",
        ] {
            let target = project.path().join(path);
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent).unwrap();
            }
            fs::write(target, b"fixture").unwrap();
        }
        let context = context(project.path(), storage.path());
        assert!(ensure_local_history_admission(&context, "notes.txt", b"text").is_ok());
        assert!(ensure_local_history_admission(&context, "notes.txt", b"").is_ok());
        assert!(ensure_local_history_admission(&context, "notes.txt", &[0xff]).is_err());
        assert!(ensure_local_history_admission(&context, ".ocproject", b"{}\n").is_ok());
        assert!(ensure_local_history_admission(&context, ".ocblocks", b"{\"blocks\":[]}\n").is_ok());
        assert!(ensure_local_history_admission(&context, "assets/image.png", b"bytes").is_err());
        assert!(ensure_local_history_admission(&context, ".env.local", b"TOKEN=x").is_err());
        assert!(ensure_local_history_admission(&context, "custom.fixture", b"text").is_ok());
        assert!(resolve_history_path(&context, "../outside.txt", false).is_err());
        assert!(resolve_history_path(&context, "D:/outside.txt", false).is_err());
    }

    #[test]
    fn restoring_an_entry_replaces_only_the_target_file() {
        let project = tempfile::tempdir().unwrap();
        let storage = tempfile::tempdir().unwrap();
        fs::write(project.path().join("notes.md"), b"before").unwrap();
        let context = context(project.path(), storage.path());
        let recorded = record(&context, "notes.md", "manual-save", b"before");
        fs::write(project.path().join("notes.md"), b"current").unwrap();
        fs::write(project.path().join("other.md"), b"untouched").unwrap();

        let restored = restore_entry(
            &context,
            &LocalHistoryRestoreRequest {
                operation_id: "restore".to_owned(),
                project_root: display_path(project.path()),
                project_id: context.project_id.clone(),
                generation: 1,
                relative_path: "notes.md".to_owned(),
                entry_id: recorded.entry.entry_id,
                expected_content_oid: Some(recorded.entry.content_oid),
            },
        )
        .unwrap();

        assert!(restored.restored);
        assert_eq!(
            fs::read(project.path().join("notes.md")).unwrap(),
            b"before"
        );
        assert_eq!(
            fs::read(project.path().join("other.md")).unwrap(),
            b"untouched"
        );
        assert_eq!(
            list_entries(&context, "notes.md").unwrap().items[0].source,
            "file-restored"
        );
    }

    #[test]
    fn capacity_keeps_the_newest_hundred_entries() {
        let project = tempfile::tempdir().unwrap();
        let storage = tempfile::tempdir().unwrap();
        fs::write(project.path().join("notes.txt"), b"seed").unwrap();
        let context = context(project.path(), storage.path());
        for index in 0..101 {
            record(
                &context,
                "notes.txt",
                "file-restored",
                format!("{index}").as_bytes(),
            );
        }
        let listed = list_entries(&context, "notes.txt").unwrap();
        assert_eq!(listed.items.len(), LOCAL_HISTORY_LIMIT);
    }
}
