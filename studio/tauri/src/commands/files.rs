//! File operation commands
//!
//! Read/write files and show native dialogs.
//! Uses tauri-plugin-fs and tauri-plugin-dialog.

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

/// File filter for dialogs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

/// Options for open dialog
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenDialogOptions {
    pub title: Option<String>,
    pub default_path: Option<String>,
    pub filters: Option<Vec<FileFilter>>,
    pub directory: Option<bool>,
    pub multiple: Option<bool>,
}

/// Options for save dialog
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveDialogOptions {
    pub title: Option<String>,
    pub default_path: Option<String>,
    pub filters: Option<Vec<FileFilter>>,
}

/// Read a file as text
#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read file '{}': {}", path, e))
}

/// Write text to a file
#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    // Ensure parent directory exists
    if let Some(parent) = std::path::Path::new(&path).parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    
    tokio::fs::write(&path, content)
        .await
        .map_err(|e| format!("Failed to write file '{}': {}", path, e))
}

/// Show native open file dialog
#[tauri::command]
pub async fn show_open_dialog(
    app: AppHandle,
    options: Option<OpenDialogOptions>,
) -> Result<Option<String>, String> {
    let opts = options.unwrap_or(OpenDialogOptions {
        title: None,
        default_path: None,
        filters: None,
        directory: None,
        multiple: None,
    });
    
    let mut builder = app.dialog().file();
    
    if let Some(title) = opts.title {
        builder = builder.set_title(title);
    }
    
    if let Some(default_path) = opts.default_path {
        builder = builder.set_file_name(default_path);
    }
    
    // Add filters
    if let Some(filters) = opts.filters {
        for filter in filters {
            let extensions: Vec<&str> = filter.extensions.iter().map(|s| s.as_str()).collect();
            builder = builder.add_filter(&filter.name, &extensions);
        }
    } else {
        // Default filters for workflows
        builder = builder
            .add_filter("Workflow Files", &["swwf"])
            .add_filter("All Files", &["*"]);
    }
    
    // Use blocking dialog (Tauri 2.0 style)
    let result = builder.blocking_pick_file();
    
    // FilePath is an enum, convert to string
    Ok(result.map(|p| p.to_string()))
}

/// Show native save file dialog
#[tauri::command]
pub async fn show_save_dialog(
    app: AppHandle,
    options: Option<SaveDialogOptions>,
) -> Result<Option<String>, String> {
    let opts = options.unwrap_or(SaveDialogOptions {
        title: None,
        default_path: None,
        filters: None,
    });
    
    let mut builder = app.dialog().file();
    
    if let Some(title) = opts.title {
        builder = builder.set_title(title);
    }
    
    if let Some(default_path) = opts.default_path {
        builder = builder.set_file_name(default_path);
    }
    
    // Add filters
    if let Some(filters) = opts.filters {
        for filter in filters {
            let extensions: Vec<&str> = filter.extensions.iter().map(|s| s.as_str()).collect();
            builder = builder.add_filter(&filter.name, &extensions);
        }
    } else {
        // Default filters for workflows
        builder = builder
            .add_filter("Workflow Files", &["swwf"])
            .add_filter("All Files", &["*"]);
    }
    
    // Use blocking dialog (Tauri 2.0 style)
    let result = builder.blocking_save_file();
    
    // FilePath is an enum, convert to string
    Ok(result.map(|p| p.to_string()))
}
