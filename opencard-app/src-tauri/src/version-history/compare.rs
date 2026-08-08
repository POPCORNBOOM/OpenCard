use super::*;
use git2::{Commit, Repository, Tree};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum CompareSourceRequest {
    Version { commit_id: String },
    LocalHistory { entry_id: String },
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareCompareRequest {
    operation_id: String,
    project_root: String,
    project_id: String,
    generation: u64,
    relative_path: String,
    source: CompareSourceRequest,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseCompareRequest {
    operation_id: String,
    project_root: String,
    project_id: String,
    generation: u64,
    lease_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotDescriptorDto {
    root_path: String,
    relative_path: String,
    completeness: &'static str,
    exists: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareCompareResponse {
    project_id: String,
    generation: u64,
    lease_id: String,
    historical: SnapshotDescriptorDto,
    current: SnapshotDescriptorDto,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseCompareResponse {
    released: bool,
}

#[tauri::command]
pub async fn version_prepare_compare(
    request: PrepareCompareRequest,
    app_handle: tauri::AppHandle,
    state: State<'_, VersionHistoryState>,
) -> Result<PrepareCompareResponse, VersionErrorDto> {
    let operation = "version_prepare_compare";
    validate_prepare_request(&request).map_err(|error| to_error_dto(operation, error))?;
    let storage_root =
        resolve_storage_root(&app_handle).map_err(|error| to_error_dto(operation, error))?;
    let write_lock = Arc::clone(&state.write_lock);
    let compare_leases = Arc::clone(&state.compare_leases);
    let result = tauri::async_runtime::spawn_blocking(move || {
        let _guard = write_lock.lock().map_err(|_| lock_error())?;
        let context = load_project_context(
            Path::new(&request.project_root),
            &storage_root,
            &request.project_id,
        )?;
        let response = prepare_compare(&context, &request)?;
        compare_leases
            .lock()
            .map_err(|_| lock_error())?
            .insert(response.lease_id.clone(), context.project_id.clone());
        Ok(response)
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
pub async fn version_release_compare(
    request: ReleaseCompareRequest,
    app_handle: tauri::AppHandle,
    state: State<'_, VersionHistoryState>,
) -> Result<ReleaseCompareResponse, VersionErrorDto> {
    let operation = "version_release_compare";
    validate_release_request(&request).map_err(|error| to_error_dto(operation, error))?;
    let storage_root =
        resolve_storage_root(&app_handle).map_err(|error| to_error_dto(operation, error))?;
    let write_lock = Arc::clone(&state.write_lock);
    let compare_leases = Arc::clone(&state.compare_leases);
    let result = tauri::async_runtime::spawn_blocking(move || {
        let _guard = write_lock.lock().map_err(|_| lock_error())?;
        let _request_generation = request.generation;
        let context = load_project_context(
            Path::new(&request.project_root),
            &storage_root,
            &request.project_id,
        )?;
        let lease_root = context
            .project_history_root
            .join("compare")
            .join(&request.lease_id);
        let released = lease_root.exists();
        if released {
            fs::remove_dir_all(&lease_root).map_err(|error| {
                HistoryFailure::new("history-io", "release-compare", error.to_string())
                    .project_id(&context.project_id)
                    .retryable()
            })?;
        }
        compare_leases
            .lock()
            .map_err(|_| lock_error())?
            .remove(&request.lease_id);
        Ok(ReleaseCompareResponse { released })
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

fn validate_prepare_request(request: &PrepareCompareRequest) -> Result<(), HistoryFailure> {
    if request.operation_id.trim().is_empty()
        || request.project_root.trim().is_empty()
        || request.project_id.trim().is_empty()
    {
        return Err(HistoryFailure::new(
            "invalid-request",
            "validate-request",
            "missing compare request field",
        ));
    }
    match &request.source {
        CompareSourceRequest::Version { commit_id } if commit_id.trim().is_empty() => {
            Err(HistoryFailure::new(
                "invalid-request",
                "validate-request",
                "missing commit identity",
            ))
        }
        CompareSourceRequest::LocalHistory { entry_id } if entry_id.trim().is_empty() => {
            Err(HistoryFailure::new(
                "invalid-request",
                "validate-request",
                "missing Local History identity",
            ))
        }
        _ => Ok(()),
    }
}

fn validate_release_request(request: &ReleaseCompareRequest) -> Result<(), HistoryFailure> {
    if request.operation_id.trim().is_empty()
        || request.project_root.trim().is_empty()
        || request.project_id.trim().is_empty()
        || request.lease_id.len() != 40
        || !request
            .lease_id
            .bytes()
            .all(|value| value.is_ascii_hexdigit())
    {
        return Err(HistoryFailure::new(
            "invalid-request",
            "validate-request",
            "invalid compare lease request",
        ));
    }
    Ok(())
}

fn lock_error() -> HistoryFailure {
    HistoryFailure::new(
        "history-busy",
        "acquire-lock",
        "version history lock is poisoned",
    )
    .retryable()
}

fn prepare_compare(
    context: &ProjectHistoryContext,
    request: &PrepareCompareRequest,
) -> Result<PrepareCompareResponse, HistoryFailure> {
    let relative_path = repository::normalize_history_path(context, &request.relative_path)?;
    let lease_id = Oid::hash_object(
        ObjectType::Blob,
        format!(
            "{}\0{}\0{}\0{}",
            context.project_id,
            request.operation_id,
            unix_time_ms(),
            std::process::id(),
        )
        .as_bytes(),
    )
    .map_err(|error| HistoryFailure::new("history-io", "create-lease", error.to_string()))?
    .to_string();
    let lease_root = context.project_history_root.join("compare").join(&lease_id);
    let historical_root = lease_root.join("historical");
    let current_root = lease_root.join("current");
    fs::create_dir_all(&historical_root).map_err(compare_io("create-compare"))?;
    fs::create_dir_all(&current_root).map_err(compare_io("create-compare"))?;

    let result = (|| {
        let (historical_exists, completeness) = match &request.source {
            CompareSourceRequest::Version { commit_id } => {
                let repository = repository::open_repository(context)?;
                let commit = find_history_commit(&repository, commit_id)?;
                let tree = commit
                    .tree()
                    .map_err(|error| compare_git("read-version-tree", error))?;
                materialize_tree(&repository, &tree, &historical_root)?;
                (tree.get_path(Path::new(&relative_path)).is_ok(), "project")
            }
            CompareSourceRequest::LocalHistory { entry_id } => {
                let content = local_history::read_entry_content(context, &relative_path, entry_id)?;
                write_materialized_file(&historical_root, &relative_path, &content)?;
                (true, "single-file")
            }
        };
        let current_paths = materialize_current_snapshot(context, &current_root)?;
        let current_exists = current_paths.binary_search(&relative_path).is_ok();
        Ok(PrepareCompareResponse {
            project_id: context.project_id.clone(),
            generation: request.generation,
            lease_id: lease_id.clone(),
            historical: SnapshotDescriptorDto {
                root_path: display_path(&historical_root),
                relative_path: relative_path.clone(),
                completeness,
                exists: historical_exists,
            },
            current: SnapshotDescriptorDto {
                root_path: display_path(&current_root),
                relative_path,
                completeness: "project",
                exists: current_exists,
            },
        })
    })();
    if result.is_err() {
        let _ = fs::remove_dir_all(&lease_root);
    }
    result
}

fn find_history_commit<'repo>(
    repository: &'repo Repository,
    expected: &str,
) -> Result<Commit<'repo>, HistoryFailure> {
    let expected = Oid::from_str(expected).map_err(|error| {
        HistoryFailure::new("invalid-request", "parse-version", error.to_string())
    })?;
    let mut commit = repository::head_commit(repository)?;
    while let Some(current) = commit {
        if current.id() == expected {
            return Ok(current);
        }
        commit = match current.parent_count() {
            0 => None,
            1 => Some(
                current
                    .parent(0)
                    .map_err(|error| compare_git("read-version-parent", error))?,
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

fn materialize_current_snapshot(
    context: &ProjectHistoryContext,
    target_root: &Path,
) -> Result<Vec<String>, HistoryFailure> {
    let paths = scan_managed_files(&context.canonical_root, &context.template_managed_paths)?;
    for relative_path in &paths {
        let source = context.canonical_root.join(Path::new(relative_path));
        let content = fs::read(&source).map_err(|error| {
            HistoryFailure::new("history-io", "read-current-snapshot", error.to_string())
                .project_id(&context.project_id)
                .relative_path(relative_path)
                .retryable()
        })?;
        write_materialized_file(target_root, relative_path, &content)?;
    }
    Ok(paths)
}

fn materialize_tree(
    repository: &Repository,
    tree: &Tree<'_>,
    target_root: &Path,
) -> Result<(), HistoryFailure> {
    materialize_tree_at(repository, tree, target_root, "")
}

fn materialize_tree_at(
    repository: &Repository,
    tree: &Tree<'_>,
    target_root: &Path,
    prefix: &str,
) -> Result<(), HistoryFailure> {
    for entry in tree {
        let name = entry
            .name()
            .map_err(|error| compare_git("materialize-tree", error))?;
        let relative_path = if prefix.is_empty() {
            name.to_owned()
        } else {
            format!("{prefix}/{name}")
        };
        match entry.kind() {
            Some(ObjectType::Blob) => {
                let blob = repository
                    .find_blob(entry.id())
                    .map_err(|error| compare_git("read-version-blob", error))?;
                write_materialized_file(target_root, &relative_path, blob.content())?;
            }
            Some(ObjectType::Tree) => {
                let child = repository
                    .find_tree(entry.id())
                    .map_err(|error| compare_git("read-version-tree", error))?;
                materialize_tree_at(repository, &child, target_root, &relative_path)?;
            }
            _ => {
                return Err(HistoryFailure::new(
                    "history-corrupt",
                    "materialize-tree",
                    "unsupported version tree entry",
                )
                .relative_path(&relative_path))
            }
        }
    }
    Ok(())
}

fn write_materialized_file(
    root: &Path,
    relative_path: &str,
    content: &[u8],
) -> Result<(), HistoryFailure> {
    let path = root.join(Path::new(relative_path));
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(compare_io("create-compare-directory"))?;
    }
    fs::write(&path, content).map_err(|error| {
        HistoryFailure::new("history-io", "write-compare-file", error.to_string())
            .relative_path(relative_path)
            .retryable()
    })
}

fn compare_io(phase: &'static str) -> impl FnOnce(std::io::Error) -> HistoryFailure {
    move |error| HistoryFailure::new("history-io", phase, error.to_string()).retryable()
}

fn compare_git(phase: &'static str, error: git2::Error) -> HistoryFailure {
    HistoryFailure::new("history-corrupt", phase, error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::version_history::repository::{create_version, get_status, CreateVersionRequest};

    #[test]
    fn materializes_version_and_current_snapshots_without_dirty_overlays() {
        let project = tempfile::tempdir().unwrap();
        let storage = tempfile::tempdir().unwrap();
        fs::create_dir(project.path().join("cards")).unwrap();
        fs::write(project.path().join("cards/main.json"), b"old").unwrap();
        let prepared = prepare_project(project.path(), storage.path(), 1, Vec::new()).unwrap();
        let context = load_project_context(
            project.path(),
            storage.path(),
            &prepared.identity.project_id,
        )
        .unwrap();
        let status = get_status(&context, 1).unwrap();
        let version = create_version(
            &context,
            CreateVersionRequest {
                operation_id: "create".to_owned(),
                project_root: display_path(project.path()),
                project_id: context.project_id.clone(),
                generation: 1,
                expected_head_commit_id: None,
                expected_snapshot_id: status.change_summary.snapshot_id,
                description: "Initial".to_owned(),
                requested_version: None,
            },
        )
        .unwrap();
        fs::write(project.path().join("cards/main.json"), b"current").unwrap();

        let response = prepare_compare(
            &context,
            &PrepareCompareRequest {
                operation_id: "compare".to_owned(),
                project_root: display_path(project.path()),
                project_id: context.project_id.clone(),
                generation: 1,
                relative_path: "cards/main.json".to_owned(),
                source: CompareSourceRequest::Version {
                    commit_id: version.version.commit_id,
                },
            },
        )
        .unwrap();

        assert_eq!(
            fs::read(Path::new(&response.historical.root_path).join("cards/main.json")).unwrap(),
            b"old"
        );
        assert_eq!(
            fs::read(Path::new(&response.current.root_path).join("cards/main.json")).unwrap(),
            b"current"
        );
        assert_eq!(response.historical.completeness, "project");
    }
}
