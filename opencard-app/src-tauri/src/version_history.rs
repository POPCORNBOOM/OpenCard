use git2::{ObjectType, Oid, Repository};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::io::Write;
#[cfg(target_os = "windows")]
use std::os::windows::fs::MetadataExt;
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Manager, State};

#[path = "version-history/compare.rs"]
pub(crate) mod compare;
#[path = "version-history/local_history.rs"]
pub(crate) mod local_history;
#[path = "version-history/repository.rs"]
pub(crate) mod repository;

const IDENTITY_PREFIX: &[u8] = b"opencard-project-v1\0";
const IDENTITY_KIND: &str = "canonical-path-v1";
const SCHEMA_VERSION: u32 = 1;
const WHITELIST_VERSION: u32 = 1;
const MAX_MANAGED_FILES: usize = 100_000;
const MAX_FILE_SIZE: u64 = 2 * 1024 * 1024 * 1024;
const MAX_SNAPSHOT_SIZE: u64 = 20 * 1024 * 1024 * 1024;
const EXCLUDED_DIRECTORIES: &[&str] = &[
    ".git",
    ".opencard",
    ".opencard-cache",
    "node_modules",
    "target",
    "dist",
    "build",
    "coverage",
    ".vite",
    ".vscode",
    ".idea",
];
const MANAGED_EXTENSIONS: &[&str] = &[
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
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "svg",
    "woff",
    "woff2",
    "ttf",
    "otf",
];
static ATOMIC_FILE_SEQUENCE: AtomicU64 = AtomicU64::new(1);

#[derive(Clone, Default)]
pub struct VersionHistoryState {
    write_lock: Arc<Mutex<()>>,
    compare_leases: Arc<Mutex<BTreeMap<String, String>>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareProjectRequest {
    operation_id: String,
    project_root: String,
    generation: u64,
    #[serde(default)]
    template_managed_paths: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectIdentityDto {
    project_id: String,
    canonical_root: String,
    generation: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareProjectResponse {
    identity: ProjectIdentityDto,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionErrorDto {
    code: String,
    operation: String,
    phase: String,
    project_id: Option<String>,
    relative_path: Option<String>,
    retryable: bool,
    diagnostic_id: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct VersionHistoryIdentity {
    schema_version: u32,
    identity_kind: String,
    project_id: String,
    canonical_root: String,
    whitelist_version: u32,
    template_managed_paths: Vec<String>,
    created_at_unix_ms: u64,
}

#[derive(Debug)]
struct ProjectHistoryContext {
    canonical_root: PathBuf,
    canonical_root_text: String,
    project_id: String,
    project_history_root: PathBuf,
    template_managed_paths: Vec<String>,
}

#[derive(Debug)]
struct HistoryFailure {
    code: &'static str,
    phase: &'static str,
    project_id: Option<String>,
    relative_path: Option<String>,
    retryable: bool,
    detail: String,
}

fn write_file_atomically(path: &Path, content: &[u8]) -> std::io::Result<()> {
    let sequence = ATOMIC_FILE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let temporary_path = path.with_extension(format!("tmp-{}-{sequence}", std::process::id()));
    let mut file = fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&temporary_path)?;
    if let Err(error) = file.write_all(content).and_then(|_| file.sync_all()) {
        let _ = fs::remove_file(&temporary_path);
        return Err(error);
    }
    drop(file);
    if let Err(error) = replace_file(&temporary_path, path) {
        let _ = fs::remove_file(&temporary_path);
        return Err(error);
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn replace_file(source: &Path, target: &Path) -> std::io::Result<()> {
    fs::rename(source, target)
}

#[cfg(target_os = "windows")]
fn replace_file(source: &Path, target: &Path) -> std::io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    let source = source
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let target = target
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let result = unsafe {
        MoveFileExW(
            source.as_ptr(),
            target.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if result == 0 {
        return Err(std::io::Error::last_os_error());
    }
    Ok(())
}

impl HistoryFailure {
    fn new(code: &'static str, phase: &'static str, detail: impl Into<String>) -> Self {
        Self {
            code,
            phase,
            project_id: None,
            relative_path: None,
            retryable: false,
            detail: detail.into(),
        }
    }

    fn project_id(mut self, project_id: &str) -> Self {
        self.project_id = Some(project_id.to_owned());
        self
    }

    fn relative_path(mut self, relative_path: &str) -> Self {
        self.relative_path = Some(relative_path.to_owned());
        self
    }

    fn retryable(mut self) -> Self {
        self.retryable = true;
        self
    }
}

fn ensure_project_not_compared(
    compare_leases: &Mutex<BTreeMap<String, String>>,
    project_id: &str,
) -> Result<(), HistoryFailure> {
    let leases = compare_leases.lock().map_err(|_| {
        HistoryFailure::new(
            "history-busy",
            "acquire-lock",
            "compare lease lock is poisoned",
        )
        .retryable()
    })?;
    if leases.values().any(|candidate| candidate == project_id) {
        return Err(HistoryFailure::new(
            "history-busy",
            "validate-write",
            "project has an active comparison",
        )
        .project_id(project_id)
        .retryable());
    }
    Ok(())
}

#[tauri::command]
pub async fn version_prepare_project(
    request: PrepareProjectRequest,
    app_handle: tauri::AppHandle,
    state: State<'_, VersionHistoryState>,
) -> Result<PrepareProjectResponse, VersionErrorDto> {
    let operation = "version_prepare_project";
    if request.operation_id.trim().is_empty() || request.project_root.trim().is_empty() {
        return Err(to_error_dto(
            operation,
            HistoryFailure::new(
                "invalid-request",
                "validate-request",
                "missing operation or project root",
            ),
        ));
    }

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
        prepare_project(
            Path::new(&request.project_root),
            &storage_root,
            request.generation,
            request.template_managed_paths,
        )
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

fn prepare_project(
    project_root: &Path,
    storage_root: &Path,
    generation: u64,
    template_managed_paths: Vec<String>,
) -> Result<PrepareProjectResponse, HistoryFailure> {
    let canonical_root = canonicalize_project_root(project_root)?;
    let canonical_root_text = display_path(&canonical_root);
    let project_id = project_id(&canonical_root_text)?;
    let template_managed_paths = normalize_template_managed_paths(template_managed_paths)?;
    scan_managed_files(&canonical_root, &template_managed_paths)?;
    let project_history_root = storage_root
        .join("version-history")
        .join("v1")
        .join(format!("p1-{project_id}"));

    fs::create_dir_all(&project_history_root).map_err(|error| {
        HistoryFailure::new("history-io", "create-sidecar", error.to_string())
            .project_id(&project_id)
            .retryable()
    })?;

    let identity_path = project_history_root.join("identity.json");
    if identity_path.exists() {
        validate_identity(
            &identity_path,
            &project_id,
            &canonical_root_text,
            &template_managed_paths,
        )?;
    } else {
        write_identity(
            &identity_path,
            &VersionHistoryIdentity {
                schema_version: SCHEMA_VERSION,
                identity_kind: IDENTITY_KIND.to_owned(),
                project_id: project_id.clone(),
                canonical_root: canonical_root_text.clone(),
                whitelist_version: WHITELIST_VERSION,
                template_managed_paths: template_managed_paths.clone(),
                created_at_unix_ms: unix_time_ms(),
            },
        )?;
    }

    prepare_repository(&project_history_root.join("history.git"), &project_id)?;
    repository::recover_pending_transactions(&ProjectHistoryContext {
        canonical_root: canonical_root.clone(),
        canonical_root_text: canonical_root_text.clone(),
        project_id: project_id.clone(),
        project_history_root: project_history_root.clone(),
        template_managed_paths: template_managed_paths.clone(),
    })?;
    repository::recover_pending_restore_transactions(&ProjectHistoryContext {
        canonical_root: canonical_root.clone(),
        canonical_root_text: canonical_root_text.clone(),
        project_id: project_id.clone(),
        project_history_root: project_history_root.clone(),
        template_managed_paths: template_managed_paths.clone(),
    })?;
    fs::create_dir_all(project_history_root.join("local-history")).map_err(|error| {
        HistoryFailure::new("history-io", "create-local-history", error.to_string())
            .project_id(&project_id)
            .retryable()
    })?;

    Ok(PrepareProjectResponse {
        identity: ProjectIdentityDto {
            project_id,
            canonical_root: canonical_root_text,
            generation,
        },
    })
}

fn resolve_storage_root(app_handle: &tauri::AppHandle) -> Result<PathBuf, HistoryFailure> {
    app_handle
        .path()
        .home_dir()
        .map(|path| path.join(".opencard"))
        .map_err(|error| {
            HistoryFailure::new("history-io", "resolve-storage", error.to_string()).retryable()
        })
}

fn load_project_context(
    project_root: &Path,
    storage_root: &Path,
    expected_project_id: &str,
) -> Result<ProjectHistoryContext, HistoryFailure> {
    let canonical_root = canonicalize_project_root(project_root)?;
    let canonical_root_text = display_path(&canonical_root);
    let project_id = project_id(&canonical_root_text)?;
    if expected_project_id != project_id {
        return Err(HistoryFailure::new(
            "identity-mismatch",
            "validate-request",
            "project identity does not match",
        )
        .project_id(&project_id));
    }
    let project_history_root = storage_root
        .join("version-history")
        .join("v1")
        .join(format!("p1-{project_id}"));
    let identity_path = project_history_root.join("identity.json");
    let bytes = fs::read(&identity_path).map_err(|error| {
        HistoryFailure::new("history-io", "read-identity", error.to_string())
            .project_id(&project_id)
            .retryable()
    })?;
    let identity: VersionHistoryIdentity = serde_json::from_slice(&bytes).map_err(|error| {
        HistoryFailure::new("history-corrupt", "parse-identity", error.to_string())
            .project_id(&project_id)
    })?;
    validate_identity(
        &identity_path,
        &project_id,
        &canonical_root_text,
        &identity.template_managed_paths,
    )?;
    Ok(ProjectHistoryContext {
        canonical_root,
        canonical_root_text,
        project_id,
        project_history_root,
        template_managed_paths: identity.template_managed_paths,
    })
}

fn canonicalize_project_root(project_root: &Path) -> Result<PathBuf, HistoryFailure> {
    let canonical_root = fs::canonicalize(project_root).map_err(|error| {
        HistoryFailure::new(
            "project-unavailable",
            "canonicalize-project",
            error.to_string(),
        )
        .retryable()
    })?;
    if !canonical_root.is_dir() {
        return Err(HistoryFailure::new(
            "project-unavailable",
            "canonicalize-project",
            "project root is not a directory",
        ));
    }
    Ok(canonical_root)
}

fn display_path(path: &Path) -> String {
    let normalized = path.to_string_lossy().replace('\\', "/");
    #[cfg(target_os = "windows")]
    {
        if let Some(path) = normalized.strip_prefix("//?/UNC/") {
            return format!("//{path}");
        }
        if let Some(path) = normalized.strip_prefix("//?/") {
            return path.to_owned();
        }
    }
    normalized
}

fn identity_path(path: &str) -> String {
    #[cfg(target_os = "windows")]
    {
        path.to_lowercase()
    }
    #[cfg(not(target_os = "windows"))]
    {
        path.to_owned()
    }
}

fn project_id(canonical_root: &str) -> Result<String, HistoryFailure> {
    let mut input = Vec::with_capacity(IDENTITY_PREFIX.len() + canonical_root.len());
    input.extend_from_slice(IDENTITY_PREFIX);
    input.extend_from_slice(identity_path(canonical_root).as_bytes());
    Oid::hash_object(ObjectType::Blob, &input)
        .map(|oid| oid.to_string())
        .map_err(|error| HistoryFailure::new("history-io", "hash-project", error.to_string()))
}

fn normalize_template_managed_paths(paths: Vec<String>) -> Result<Vec<String>, HistoryFailure> {
    let mut normalized = BTreeSet::new();
    for path in paths {
        let path = path.replace('\\', "/").trim_matches('/').to_owned();
        let parsed = Path::new(&path);
        if path.is_empty()
            || parsed.is_absolute()
            || parsed
                .components()
                .any(|component| !matches!(component, Component::Normal(_)))
            || is_excluded_path(&path)
        {
            return Err(HistoryFailure::new(
                "unsupported-entry",
                "validate-template-path",
                "invalid template-managed path",
            )
            .relative_path(&path));
        }
        normalized.insert(path);
    }
    Ok(normalized.into_iter().collect())
}

fn validate_identity(
    manifest_path: &Path,
    project_id: &str,
    canonical_root: &str,
    template_managed_paths: &[String],
) -> Result<(), HistoryFailure> {
    let bytes = fs::read(manifest_path).map_err(|error| {
        HistoryFailure::new("history-io", "read-identity", error.to_string())
            .project_id(project_id)
            .retryable()
    })?;
    let identity: VersionHistoryIdentity = serde_json::from_slice(&bytes).map_err(|error| {
        HistoryFailure::new("history-corrupt", "parse-identity", error.to_string())
            .project_id(project_id)
    })?;
    if identity.schema_version != SCHEMA_VERSION
        || identity.identity_kind != IDENTITY_KIND
        || identity.whitelist_version != WHITELIST_VERSION
    {
        return Err(HistoryFailure::new(
            "history-incompatible",
            "validate-identity",
            "unsupported history schema",
        )
        .project_id(project_id));
    }
    if identity.project_id != project_id
        || identity_path(&identity.canonical_root) != identity_path(canonical_root)
    {
        return Err(HistoryFailure::new(
            "identity-mismatch",
            "validate-identity",
            "project identity does not match",
        )
        .project_id(project_id));
    }
    if identity.template_managed_paths != template_managed_paths {
        return Err(HistoryFailure::new(
            "history-incompatible",
            "validate-identity",
            "template-managed paths differ from the initialized project",
        )
        .project_id(project_id));
    }
    Ok(())
}

fn write_identity(
    identity_path: &Path,
    identity: &VersionHistoryIdentity,
) -> Result<(), HistoryFailure> {
    let bytes = serde_json::to_vec_pretty(identity).map_err(|error| {
        HistoryFailure::new("history-io", "serialize-identity", error.to_string())
            .project_id(&identity.project_id)
    })?;
    let temporary_path =
        identity_path.with_extension(format!("tmp-{}-{}", std::process::id(), unix_time_ms(),));
    let mut file = fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&temporary_path)
        .map_err(|error| {
            HistoryFailure::new("history-io", "write-identity", error.to_string())
                .project_id(&identity.project_id)
                .retryable()
        })?;
    if let Err(error) = file.write_all(&bytes).and_then(|_| file.sync_all()) {
        let _ = fs::remove_file(&temporary_path);
        return Err(
            HistoryFailure::new("history-io", "write-identity", error.to_string())
                .project_id(&identity.project_id)
                .retryable(),
        );
    }
    fs::rename(&temporary_path, identity_path).map_err(|error| {
        let _ = fs::remove_file(&temporary_path);
        HistoryFailure::new("history-io", "commit-identity", error.to_string())
            .project_id(&identity.project_id)
            .retryable()
    })
}

fn prepare_repository(repository_path: &Path, project_id: &str) -> Result<(), HistoryFailure> {
    let repository = if repository_path.exists() {
        Repository::open_bare(repository_path)
    } else {
        Repository::init_bare(repository_path)
    }
    .map_err(|error| {
        HistoryFailure::new("history-corrupt", "open-repository", error.to_string())
            .project_id(project_id)
    })?;
    repository.set_head("refs/heads/main").map_err(|error| {
        HistoryFailure::new("history-corrupt", "set-repository-head", error.to_string())
            .project_id(project_id)
    })
}

fn scan_managed_files(
    project_root: &Path,
    template_managed_paths: &[String],
) -> Result<Vec<String>, HistoryFailure> {
    let canonical_root = canonicalize_project_root(project_root)?;
    let template_paths = template_managed_paths
        .iter()
        .cloned()
        .collect::<BTreeSet<_>>();
    let mut files = Vec::new();
    let mut total_size = 0_u64;
    scan_directory(
        &canonical_root,
        &canonical_root,
        &template_paths,
        &mut files,
        &mut total_size,
    )?;
    files.sort();
    Ok(files)
}

fn scan_directory(
    canonical_root: &Path,
    directory: &Path,
    template_paths: &BTreeSet<String>,
    files: &mut Vec<String>,
    total_size: &mut u64,
) -> Result<(), HistoryFailure> {
    let entries = fs::read_dir(directory).map_err(|error| {
        HistoryFailure::new("history-io", "scan-directory", error.to_string()).retryable()
    })?;
    for entry in entries {
        let entry = entry.map_err(|error| {
            HistoryFailure::new("history-io", "scan-directory", error.to_string()).retryable()
        })?;
        let absolute_path = entry.path();
        let relative_path = absolute_path
            .strip_prefix(canonical_root)
            .map(display_path)
            .map_err(|error| {
                HistoryFailure::new(
                    "project-boundary-violation",
                    "scan-boundary",
                    error.to_string(),
                )
            })?;
        let metadata = fs::symlink_metadata(&absolute_path).map_err(|error| {
            HistoryFailure::new("history-io", "scan-metadata", error.to_string())
                .relative_path(&relative_path)
                .retryable()
        })?;

        if is_linked_entry(&metadata) {
            return Err(HistoryFailure::new(
                "project-boundary-violation",
                "scan-boundary",
                "linked entries are not managed",
            )
            .relative_path(&relative_path));
        }
        if metadata.is_dir() {
            if is_excluded_directory(entry.file_name().to_string_lossy().as_ref()) {
                continue;
            }
            scan_directory(
                canonical_root,
                &absolute_path,
                template_paths,
                files,
                total_size,
            )?;
            continue;
        }
        if !metadata.is_file()
            || !is_managed_file(&relative_path, template_paths.contains(&relative_path))
        {
            continue;
        }
        if metadata.len() > MAX_FILE_SIZE {
            return Err(HistoryFailure::new(
                "snapshot-limit",
                "scan-size",
                "managed file exceeds size limit",
            )
            .relative_path(&relative_path));
        }
        *total_size = total_size.checked_add(metadata.len()).ok_or_else(|| {
            HistoryFailure::new("snapshot-limit", "scan-size", "snapshot size overflow")
                .relative_path(&relative_path)
        })?;
        if *total_size > MAX_SNAPSHOT_SIZE || files.len() >= MAX_MANAGED_FILES {
            return Err(HistoryFailure::new(
                "snapshot-limit",
                "scan-size",
                "managed snapshot exceeds limit",
            )
            .relative_path(&relative_path));
        }
        files.push(relative_path);
    }
    Ok(())
}

fn is_linked_entry(metadata: &fs::Metadata) -> bool {
    if metadata.file_type().is_symlink() {
        return true;
    }
    #[cfg(target_os = "windows")]
    {
        const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;
        metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
    }
    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

fn is_managed_file(relative_path: &str, template_managed: bool) -> bool {
    if is_excluded_path(relative_path) {
        return false;
    }
    if template_managed {
        return true;
    }
    let path = Path::new(relative_path);
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default();
    let is_root = path.components().count() == 1;
    if is_root
        && [
            ".ocproject",
            ".oclocale",
            ".ocfonts",
            ".ocicons",
            ".gitignore",
            ".gitattributes",
        ]
        .iter()
        .any(|candidate| names_equal(file_name, candidate))
    {
        return true;
    }
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    MANAGED_EXTENSIONS
        .iter()
        .any(|candidate| names_equal(extension, candidate))
}

fn is_excluded_path(relative_path: &str) -> bool {
    let path = Path::new(relative_path);
    if path.components().any(|component| {
        let Component::Normal(name) = component else {
            return true;
        };
        is_excluded_directory(name.to_string_lossy().as_ref())
    }) {
        return true;
    }
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default();
    let comparison_name = comparison_name(file_name);
    comparison_name.starts_with(".env")
        || comparison_name.ends_with(".octemplate")
        || comparison_name.ends_with(".ociconpack")
        || comparison_name.ends_with(".xlsx")
}

fn is_excluded_directory(name: &str) -> bool {
    EXCLUDED_DIRECTORIES
        .iter()
        .any(|candidate| names_equal(name, candidate))
}

fn names_equal(left: &str, right: &str) -> bool {
    #[cfg(target_os = "windows")]
    {
        left.eq_ignore_ascii_case(right)
    }
    #[cfg(not(target_os = "windows"))]
    {
        left == right
    }
}

fn comparison_name(name: &str) -> String {
    #[cfg(target_os = "windows")]
    {
        name.to_ascii_lowercase()
    }
    #[cfg(not(target_os = "windows"))]
    {
        name.to_owned()
    }
}

fn unix_time_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn to_error_dto(operation: &str, error: HistoryFailure) -> VersionErrorDto {
    let diagnostic_id = format!("vh-{}-{}", std::process::id(), unix_time_ms());
    eprintln!(
        "[{diagnostic_id}] {operation}/{}: {}",
        error.phase, error.detail
    );
    VersionErrorDto {
        code: error.code.to_owned(),
        operation: operation.to_owned(),
        phase: error.phase.to_owned(),
        project_id: error.project_id,
        relative_path: error.relative_path,
        retryable: error.retryable,
        diagnostic_id,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prepare_is_idempotent_and_uses_main_head_without_touching_project_git() {
        let project = tempfile::tempdir().unwrap();
        let storage = tempfile::tempdir().unwrap();
        fs::create_dir(project.path().join(".git")).unwrap();
        fs::write(project.path().join(".git/keep"), b"user repository").unwrap();

        let first = prepare_project(project.path(), storage.path(), 1, Vec::new()).unwrap();
        let second = prepare_project(project.path(), storage.path(), 2, Vec::new()).unwrap();

        assert_eq!(first.identity.project_id, second.identity.project_id);
        assert_eq!(second.identity.generation, 2);
        assert_eq!(
            fs::read(project.path().join(".git/keep")).unwrap(),
            b"user repository"
        );
        let repository_path = storage
            .path()
            .join("version-history/v1")
            .join(format!("p1-{}", first.identity.project_id))
            .join("history.git");
        let repository = Repository::open_bare(repository_path).unwrap();
        assert_eq!(
            repository.head().err().unwrap().code(),
            git2::ErrorCode::UnbornBranch
        );
        assert_eq!(
            repository
                .find_reference("HEAD")
                .unwrap()
                .symbolic_target()
                .unwrap(),
            Some("refs/heads/main")
        );
    }

    #[test]
    fn whitelist_tracks_supported_content_and_ignores_sensitive_or_generated_files() {
        let project = tempfile::tempdir().unwrap();
        for relative_path in [
            ".ocproject",
            ".gitignore",
            "cards/main.ocdocument",
            "notes/README.md",
            "assets/card.png",
            "assets/Brand.woff2",
            "custom.fixture",
            ".env.local",
            "exports/cards.xlsx",
            "dist/generated.json",
            "nested/.ocproject",
        ] {
            let path = project.path().join(relative_path);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, relative_path.as_bytes()).unwrap();
        }

        let files = scan_managed_files(project.path(), &["custom.fixture".to_owned()]).unwrap();
        let paths = files.iter().map(String::as_str).collect::<Vec<_>>();

        assert_eq!(
            paths,
            [
                ".gitignore",
                ".ocproject",
                "assets/Brand.woff2",
                "assets/card.png",
                "cards/main.ocdocument",
                "custom.fixture",
                "notes/README.md",
            ]
        );
    }

    #[test]
    fn incompatible_or_mismatched_identity_is_preserved_and_reported() {
        let project = tempfile::tempdir().unwrap();
        let storage = tempfile::tempdir().unwrap();
        let prepared = prepare_project(project.path(), storage.path(), 1, Vec::new()).unwrap();
        let identity_path = storage
            .path()
            .join("version-history/v1")
            .join(format!("p1-{}", prepared.identity.project_id))
            .join("identity.json");
        let original = fs::read_to_string(&identity_path).unwrap();
        let incompatible = original.replace("\"schemaVersion\": 1", "\"schemaVersion\": 2");
        fs::write(&identity_path, &incompatible).unwrap();

        let error = prepare_project(project.path(), storage.path(), 2, Vec::new()).unwrap_err();

        assert_eq!(error.code, "history-incompatible");
        assert_eq!(fs::read_to_string(identity_path).unwrap(), incompatible);
    }

    #[test]
    fn template_paths_reject_parent_traversal_and_sensitive_files() {
        for path in ["../outside.txt", ".env", "assets/../../outside.txt"] {
            let error = normalize_template_managed_paths(vec![path.to_owned()]).unwrap_err();
            assert_eq!(error.code, "unsupported-entry");
        }
    }

    #[test]
    fn active_compare_lease_blocks_project_history_writes() {
        let leases = Mutex::new(BTreeMap::from([(
            "lease".to_owned(),
            "project-id".to_owned(),
        )]));

        assert_eq!(
            ensure_project_not_compared(&leases, "project-id")
                .unwrap_err()
                .code,
            "history-busy"
        );
        ensure_project_not_compared(&leases, "other-project").unwrap();
    }
}
