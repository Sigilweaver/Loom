//! Settings commands
//!
//! Persistent settings storage using tauri-plugin-store.
//! Mirrors the electron-store functionality.

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const SETTINGS_STORE: &str = "application-settings.json";

/// UI settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UiSettings {
    pub snap_to_grid: bool,
    pub minimap_visible: bool,
    pub minimap_position: String,
}

impl Default for UiSettings {
    fn default() -> Self {
        Self {
            snap_to_grid: true,
            minimap_visible: true,
            minimap_position: "bottom-right".to_string(),
        }
    }
}

/// Backend connection settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendSettings {
    pub url: String,
    pub auto_start: bool,
}

impl Default for BackendSettings {
    fn default() -> Self {
        Self {
            url: "http://localhost:25811".to_string(),
            auto_start: true,
        }
    }
}

/// Theme settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeSettings {
    pub id: String,
}

impl Default for ThemeSettings {
    fn default() -> Self {
        Self {
            id: "sigilweaver-signature".to_string(),
        }
    }
}

/// Application settings - matches TypeScript AppSettings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub author: String,
    pub backend: BackendSettings,
    pub theme: ThemeSettings,
    pub ui: UiSettings,
}

impl Default for AppSettings {
    fn default() -> Self {
        // Try to get system username
        let author = whoami::username().unwrap_or_else(|_| "User".to_string());
        
        Self {
            author,
            backend: BackendSettings::default(),
            theme: ThemeSettings::default(),
            ui: UiSettings::default(),
        }
    }
}

/// Load application settings, propagating any store-open or parse error. A
/// missing "settings" key (first run) is not an error - it resolves defaults.
fn try_load_settings(app: &AppHandle) -> Result<AppSettings, String> {
    let store = app
        .store(SETTINGS_STORE)
        .map_err(|e| format!("Failed to open settings store: {}", e))?;

    match store.get("settings") {
        Some(value) => serde_json::from_value::<AppSettings>(value.clone())
            .map_err(|e| format!("Failed to parse settings: {}", e)),
        None => Ok(AppSettings::default()),
    }
}

/// Load application settings, falling back to defaults if the store is missing
/// or unreadable. For internal callers, such as the backend-lifecycle
/// autoStart check, that must not fail startup over a settings-read problem.
pub fn load_settings(app: &AppHandle) -> AppSettings {
    try_load_settings(app).unwrap_or_else(|e| {
        eprintln!("[Settings] {}, using defaults", e);
        AppSettings::default()
    })
}

/// Whether the bundled server should auto-start (Full build only).
/// Mirrors Electron's `settings.backend.autoStart` default of `true`.
pub fn backend_auto_start(app: &AppHandle) -> bool {
    load_settings(app).backend.auto_start
}

/// Get application settings
#[tauri::command]
pub async fn get_settings(app: AppHandle) -> Result<AppSettings, String> {
    try_load_settings(&app)
}

/// Save application settings
#[tauri::command]
pub async fn set_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let store = app
        .store(SETTINGS_STORE)
        .map_err(|e| format!("Failed to open settings store: {}", e))?;
    
    let value = serde_json::to_value(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    
    store.set("settings", value);
    store
        .save()
        .map_err(|e| format!("Failed to save settings: {}", e))?;
    
    Ok(())
}
