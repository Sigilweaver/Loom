//! File operation commands
//!
//! Read/write files and show native dialogs.
//!
//! The renderer is untrusted: a compromised page must not be able to read or
//! write arbitrary files. `read_file` and `write_file` therefore only accept
//! paths the user chose in a native open/save dialog during this session
//! ("grants"). Paths are canonicalised (absolute, `..` collapsed, symlinks
//! resolved) both when granted and when used, so a symlink swapped in after
//! the dialog cannot redirect an operation. Grants live in memory only; the
//! renderer can create one only by completing a native dialog.

use std::collections::HashSet;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
use tauri_plugin_dialog::{DialogExt, FilePath};

/// Upper bound for a single workflow read or write (bytes).
const MAX_FILE_BYTES: u64 = 50 * 1024 * 1024;

/// File filter for dialogs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

/// Options for open dialog
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenDialogOptions {
    pub title: Option<String>,
    pub default_path: Option<String>,
    pub filters: Option<Vec<FileFilter>>,
}

/// Options for save dialog
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveDialogOptions {
    pub title: Option<String>,
    pub default_path: Option<String>,
    pub filters: Option<Vec<FileFilter>>,
}

/// Paths the user picked in a native dialog this session.
#[derive(Default)]
pub struct FileGrants {
    granted: Mutex<HashSet<String>>,
}

/// Case-insensitive file systems are the default on Windows and macOS.
fn grant_key(canonical: &Path) -> String {
    let text = canonical.to_string_lossy().into_owned();
    if cfg!(any(windows, target_os = "macos")) {
        text.to_lowercase()
    } else {
        text
    }
}

/// Resolve `.`/`..` and symlinks. The final component may not exist yet
/// (a save dialog for a new file), in which case its directory is resolved
/// and the file name re-attached. A dangling symlink is rejected because
/// writing through it would create a file somewhere else.
async fn canonicalize_path(input: &str) -> Result<PathBuf, String> {
    if input.is_empty() || input.contains('\0') {
        return Err("Invalid file path".to_string());
    }
    let path = Path::new(input);
    if !path.is_absolute() {
        return Err("File path must be absolute".to_string());
    }

    match tokio::fs::canonicalize(path).await {
        Ok(real) => return Ok(real),
        Err(e) if e.kind() == ErrorKind::NotFound => {}
        Err(e) => return Err(format!("Cannot resolve file path: {e}")),
    }

    match tokio::fs::symlink_metadata(path).await {
        Ok(meta) if meta.file_type().is_symlink() => {
            return Err("Refusing to follow a dangling symbolic link".to_string());
        }
        Ok(_) => {}
        Err(e) if e.kind() == ErrorKind::NotFound => {}
        Err(e) => return Err(format!("Cannot resolve file path: {e}")),
    }

    let name = path
        .file_name()
        .ok_or_else(|| "Invalid file path".to_string())?;
    let parent = path
        .parent()
        .ok_or_else(|| "Invalid file path".to_string())?;
    let parent = tokio::fs::canonicalize(parent)
        .await
        .map_err(|e| format!("Cannot resolve file directory: {e}"))?;
    Ok(parent.join(name))
}

impl FileGrants {
    /// Record a path the user just chose in a native dialog.
    pub async fn grant(&self, path: &str) -> Result<PathBuf, String> {
        let canonical = canonicalize_path(path).await?;
        self.granted
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .insert(grant_key(&canonical));
        Ok(canonical)
    }

    /// Return the canonical path if it was granted, otherwise an error.
    pub async fn require(&self, path: &str) -> Result<PathBuf, String> {
        let canonical = canonicalize_path(path).await?;
        let allowed = self
            .granted
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .contains(&grant_key(&canonical));
        if allowed {
            Ok(canonical)
        } else {
            Err("Access denied: the file was not selected through an open or save dialog"
                .to_string())
        }
    }
}

/// Read a granted file as UTF-8 text, refusing oversized files.
async fn read_granted(grants: &FileGrants, path: &str) -> Result<String, String> {
    let canonical = grants.require(path).await?;
    let meta = tokio::fs::metadata(&canonical)
        .await
        .map_err(|e| format!("Failed to read file: {e}"))?;
    if !meta.is_file() {
        return Err("Not a regular file".to_string());
    }
    if meta.len() > MAX_FILE_BYTES {
        return Err("File is too large to open".to_string());
    }
    tokio::fs::read_to_string(&canonical)
        .await
        .map_err(|e| format!("Failed to read file: {e}"))
}

/// Write UTF-8 text to a granted file.
async fn write_granted(grants: &FileGrants, path: &str, content: &str) -> Result<(), String> {
    if content.len() as u64 > MAX_FILE_BYTES {
        return Err("Content is too large to save".to_string());
    }
    let canonical = grants.require(path).await?;
    tokio::fs::write(&canonical, content)
        .await
        .map_err(|e| format!("Failed to write file: {e}"))
}

/// Read a file as text. Only paths chosen in a native dialog are allowed.
#[tauri::command]
pub async fn read_file(grants: State<'_, FileGrants>, path: String) -> Result<String, String> {
    read_granted(&grants, &path).await
}

/// Write text to a file. Only paths chosen in a native dialog are allowed.
#[tauri::command]
pub async fn write_file(
    grants: State<'_, FileGrants>,
    path: String,
    content: String,
) -> Result<(), String> {
    write_granted(&grants, &path, &content).await
}

/// Apply a renderer-supplied default path. It may be a bare file name (a
/// suggested name) or a full path (re-browse from the current value); only the
/// directory that exists and the file name are used.
fn apply_default_path(
    mut builder: tauri_plugin_dialog::FileDialogBuilder<tauri::Wry>,
    default_path: Option<String>,
) -> tauri_plugin_dialog::FileDialogBuilder<tauri::Wry> {
    let Some(default_path) = default_path else {
        return builder;
    };
    let path = Path::new(&default_path);
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() && parent.is_dir() {
            builder = builder.set_directory(parent);
        }
    }
    if let Some(name) = path.file_name() {
        builder = builder.set_file_name(name.to_string_lossy());
    }
    builder
}

/// Apply renderer-supplied filters, or the workflow defaults.
fn apply_filters(
    mut builder: tauri_plugin_dialog::FileDialogBuilder<tauri::Wry>,
    filters: Option<Vec<FileFilter>>,
) -> tauri_plugin_dialog::FileDialogBuilder<tauri::Wry> {
    match filters {
        Some(filters) => {
            for filter in filters {
                let extensions: Vec<&str> = filter.extensions.iter().map(|s| s.as_str()).collect();
                builder = builder.add_filter(&filter.name, &extensions);
            }
            builder
        }
        None => builder
            .add_filter("Workflow Files", &["swwf"])
            .add_filter("All Files", &["*"]),
    }
}

/// Convert a dialog result to a path string and grant it.
async fn grant_dialog_result(
    grants: &FileGrants,
    picked: Option<FilePath>,
) -> Result<Option<String>, String> {
    let Some(picked) = picked else {
        return Ok(None);
    };
    let path = picked
        .into_path()
        .map_err(|e| format!("Unsupported file location: {e}"))?;
    let text = path.to_string_lossy().into_owned();
    grants.grant(&text).await?;
    Ok(Some(text))
}

/// Show native open file dialog. The chosen path becomes readable/writable.
#[tauri::command]
pub async fn show_open_dialog(
    app: AppHandle,
    grants: State<'_, FileGrants>,
    options: Option<OpenDialogOptions>,
) -> Result<Option<String>, String> {
    let opts = options.unwrap_or_default();

    let mut builder = app.dialog().file();
    if let Some(title) = opts.title {
        builder = builder.set_title(title);
    }
    builder = apply_default_path(builder, opts.default_path);
    builder = apply_filters(builder, opts.filters);

    grant_dialog_result(&grants, builder.blocking_pick_file()).await
}

/// Show native save file dialog. The chosen path becomes readable/writable.
#[tauri::command]
pub async fn show_save_dialog(
    app: AppHandle,
    grants: State<'_, FileGrants>,
    options: Option<SaveDialogOptions>,
) -> Result<Option<String>, String> {
    let opts = options.unwrap_or_default();

    let mut builder = app.dialog().file();
    if let Some(title) = opts.title {
        builder = builder.set_title(title);
    }
    builder = apply_default_path(builder, opts.default_path);
    builder = apply_filters(builder, opts.filters);

    grant_dialog_result(&grants, builder.blocking_save_file()).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    static COUNTER: AtomicU32 = AtomicU32::new(0);

    /// A unique, canonical scratch directory removed on drop.
    struct Scratch(PathBuf);

    impl Scratch {
        fn new() -> Self {
            let n = COUNTER.fetch_add(1, Ordering::SeqCst);
            let dir = std::env::temp_dir().join(format!(
                "loom-grants-{}-{}",
                std::process::id(),
                n
            ));
            std::fs::create_dir_all(&dir).unwrap();
            Scratch(std::fs::canonicalize(dir).unwrap())
        }

        fn path(&self, name: &str) -> String {
            self.0.join(name).to_string_lossy().into_owned()
        }
    }

    impl Drop for Scratch {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    #[tokio::test]
    async fn rejects_relative_empty_and_nul_paths() {
        assert!(canonicalize_path("relative/file.swwf").await.is_err());
        assert!(canonicalize_path("").await.is_err());
        assert!(canonicalize_path("/tmp/a\0b").await.is_err());
    }

    #[tokio::test]
    async fn denies_paths_that_were_never_granted() {
        let dir = Scratch::new();
        let file = dir.path("secret.txt");
        std::fs::write(&file, "secret").unwrap();
        let grants = FileGrants::default();

        assert!(read_granted(&grants, &file).await.is_err());
        assert!(write_granted(&grants, &file, "x").await.is_err());
        assert_eq!(std::fs::read_to_string(&file).unwrap(), "secret");
    }

    #[tokio::test]
    async fn allows_read_and_write_on_granted_path() {
        let dir = Scratch::new();
        let file = dir.path("wf.swwf");
        let grants = FileGrants::default();

        // A new file, as returned by a save dialog.
        grants.grant(&file).await.unwrap();
        write_granted(&grants, &file, "{\"ok\":true}").await.unwrap();
        assert_eq!(read_granted(&grants, &file).await.unwrap(), "{\"ok\":true}");
    }

    #[tokio::test]
    async fn grant_does_not_leak_to_siblings_or_traversal() {
        let dir = Scratch::new();
        let granted = dir.path("granted.swwf");
        let other = dir.path("other.swwf");
        std::fs::write(&other, "other").unwrap();
        let grants = FileGrants::default();
        grants.grant(&granted).await.unwrap();

        assert!(grants.require(&other).await.is_err());
        let via_dotdot = dir.path("x/../other.swwf");
        assert!(grants.require(&via_dotdot).await.is_err());
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn denies_a_symlink_swapped_in_after_the_grant() {
        let dir = Scratch::new();
        let target = dir.path("wf.swwf");
        let secret = dir.path("secret.txt");
        std::fs::write(&secret, "secret").unwrap();
        let grants = FileGrants::default();
        grants.grant(&target).await.unwrap();

        std::os::unix::fs::symlink(&secret, &target).unwrap();
        assert!(read_granted(&grants, &target).await.is_err());
        assert!(write_granted(&grants, &target, "pwned").await.is_err());
        assert_eq!(std::fs::read_to_string(&secret).unwrap(), "secret");
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn rejects_dangling_symlinks() {
        let dir = Scratch::new();
        let link = dir.path("dangling.swwf");
        std::os::unix::fs::symlink(dir.path("missing"), &link).unwrap();
        assert!(canonicalize_path(&link).await.is_err());
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn accepts_a_granted_file_reached_through_a_symlink() {
        let dir = Scratch::new();
        let real = dir.path("real.swwf");
        std::fs::write(&real, "hello").unwrap();
        let link = dir.path("link.swwf");
        std::os::unix::fs::symlink(&real, &link).unwrap();
        let grants = FileGrants::default();
        grants.grant(&real).await.unwrap();

        assert_eq!(read_granted(&grants, &link).await.unwrap(), "hello");
    }

    #[tokio::test]
    async fn refuses_directories() {
        let dir = Scratch::new();
        let sub = dir.path("sub");
        std::fs::create_dir(&sub).unwrap();
        let grants = FileGrants::default();
        grants.grant(&sub).await.unwrap();

        assert!(read_granted(&grants, &sub).await.is_err());
    }

    #[tokio::test]
    async fn fails_when_the_directory_does_not_exist() {
        let dir = Scratch::new();
        assert!(canonicalize_path(&dir.path("nope/x.swwf")).await.is_err());
    }
}
