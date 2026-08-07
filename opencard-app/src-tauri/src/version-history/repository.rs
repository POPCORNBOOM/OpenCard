use super::*;
use git2::{Commit, ObjectType, Repository, Tree};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionProjectRequest {
    operation_id: String,
    project_root: String,
    project_id: String,
    generation: u64,
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
    snapshot_id: String,
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
    commit_id: String,
    parent_commit_id: Option<String>,
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
    change_summary: ChangeSummaryDto,
    has_managed_content: bool,
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

#[derive(Debug, Deserialize)]
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

fn get_status(
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

fn open_repository(context: &ProjectHistoryContext) -> Result<Repository, HistoryFailure> {
    Repository::open_bare(context.project_history_root.join("history.git")).map_err(|error| {
        HistoryFailure::new("history-corrupt", "open-repository", error.to_string())
            .project_id(&context.project_id)
    })
}

fn head_commit(repository: &Repository) -> Result<Option<Commit<'_>>, HistoryFailure> {
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
    let parent_entries = if commit.parent_count() == 0 {
        BTreeMap::new()
    } else if commit.parent_count() == 1 {
        let parent = commit
            .parent(0)
            .map_err(repository_error("read-version-parent"))?;
        tree_entries(
            repository,
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
}
