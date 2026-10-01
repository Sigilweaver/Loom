//! Settings commands
//!
//! Persistent settings storage using tauri-plugin-store.
//! Mirrors the electron-store functionality.
//!
//! The settings object is stored verbatim as JSON. The TypeScript side
//! (`AppSettings`) owns the schema and fills in defaults for missing fields,
//! so this layer must not drop keys it does not know about. (An earlier typed
//! struct silently discarded every field added after it was written, such as
//! `executionMode`, `hub` and `layout`.)

use serde_json::{json, Map, Value};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const SETTINGS_STORE: &str = "application-settings.json";
const SETTINGS_KEY: &str = "settings";

/// Author values that mean "the user never chose one".
const PLACEHOLDER_AUTHORS: [&str; 2] = ["User", "Sigilweaver Loom User"];

/// OS username for the default author, falling back to "User".
fn system_username() -> String {
    whoami::username().unwrap_or_else(|_| "User".to_string())
}

/// Apply the author hierarchy shared with the Electron shell: a persisted
/// custom value wins, otherwise the OS username, otherwise "User".
fn with_author_default(mut settings: Map<String, Value>, username: &str) -> Map<String, Value> {
    let is_placeholder = match settings.get("author") {
        None | Some(Value::Null) => true,
        Some(Value::String(author)) => {
            author.is_empty() || PLACEHOLDER_AUTHORS.contains(&author.as_str())
        }
        Some(_) => false,
    };
    if is_placeholder {
        settings.insert("author".to_string(), json!(username));
    }
    settings
}

/// Load the stored settings object (empty before the first save).
fn stored_settings(app: &AppHandle) -> Result<Map<String, Value>, String> {
    let store = app
        .store(SETTINGS_STORE)
        .map_err(|e| format!("Failed to open settings store: {}", e))?;

    match store.get(SETTINGS_KEY) {
        Some(Value::Object(map)) => Ok(map),
        Some(_) => Err("Failed to parse settings: expected an object".to_string()),
        None => Ok(Map::new()),
    }
}

/// Whether the bundled server should auto-start (Full build only).
/// Mirrors Electron's `settings.backend.autoStart` default of `true`. Falls
/// back to the default if the store is missing or unreadable, so a settings
/// problem never blocks startup.
pub fn backend_auto_start(app: &AppHandle) -> bool {
    match stored_settings(app) {
        Ok(settings) => auto_start_from(&settings),
        Err(e) => {
            eprintln!("[Settings] {}, using defaults", e);
            true
        }
    }
}

fn auto_start_from(settings: &Map<String, Value>) -> bool {
    settings
        .get("backend")
        .and_then(|backend| backend.get("autoStart"))
        .and_then(Value::as_bool)
        .unwrap_or(true)
}

/// Get application settings. Fields the user never set are absent; the
/// renderer merges them with its defaults.
#[tauri::command]
pub async fn get_settings(app: AppHandle) -> Result<Value, String> {
    let settings = with_author_default(stored_settings(&app)?, &system_username());
    Ok(Value::Object(settings))
}

/// Save application settings
#[tauri::command]
pub async fn set_settings(app: AppHandle, settings: Value) -> Result<(), String> {
    if !settings.is_object() {
        return Err("Settings must be an object".to_string());
    }

    let store = app
        .store(SETTINGS_STORE)
        .map_err(|e| format!("Failed to open settings store: {}", e))?;

    store.set(SETTINGS_KEY, settings);
    store
        .save()
        .map_err(|e| format!("Failed to save settings: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn object(value: Value) -> Map<String, Value> {
        value.as_object().cloned().unwrap()
    }

    #[test]
    fn author_defaults_to_the_os_username() {
        let out = with_author_default(Map::new(), "ada");
        assert_eq!(out["author"], "ada");
    }

    #[test]
    fn placeholder_authors_are_replaced() {
        for placeholder in ["User", "Sigilweaver Loom User", ""] {
            let out = with_author_default(object(json!({ "author": placeholder })), "ada");
            assert_eq!(out["author"], "ada");
        }
    }

    #[test]
    fn a_chosen_author_is_kept() {
        let out = with_author_default(object(json!({ "author": "Grace" })), "ada");
        assert_eq!(out["author"], "Grace");
    }

    #[test]
    fn unknown_fields_survive() {
        let stored = object(json!({
            "executionMode": "hub",
            "hub": { "url": "https://hub", "rememberLogin": true },
            "layout": { "gridSnap": 20 },
            "backend": { "url": "http://localhost:25811", "autoStart": false, "previewRows": 50 }
        }));
        let out = with_author_default(stored.clone(), "ada");
        for key in ["executionMode", "hub", "layout", "backend"] {
            assert_eq!(out[key], stored[key]);
        }
    }

    #[test]
    fn auto_start_defaults_to_true_and_honours_the_setting() {
        assert!(auto_start_from(&Map::new()));
        assert!(auto_start_from(&object(json!({ "backend": {} }))));
        assert!(auto_start_from(&object(
            json!({ "backend": { "autoStart": true } })
        )));
        assert!(!auto_start_from(&object(
            json!({ "backend": { "autoStart": false } })
        )));
    }
}
