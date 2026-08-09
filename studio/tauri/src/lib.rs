//! Sigilweaver Loom Studio - Tauri Application
//!
//! This is the Rust backend for the Tauri build of Sigilweaver Loom Studio.
//! It implements the same platform capabilities as the Electron version:
//! - File operations (read, write, dialogs)
//! - Settings persistence
//! - Secure credential storage
//! - Backend process management

mod commands;

use commands::{credentials, files, settings};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            // Settings commands
            settings::get_settings,
            settings::set_settings,
            // File commands
            files::read_file,
            files::write_file,
            files::show_open_dialog,
            files::show_save_dialog,
            // Credential commands
            credentials::get_session_token,
            credentials::is_encryption_available,
            credentials::list_connections,
            credentials::list_connections_by_type,
            credentials::get_connection,
            credentials::create_connection,
            credentials::update_connection,
            credentials::delete_connection,
            credentials::resolve_connection,
            credentials::test_connection,
        ])
        .setup(|app| {
            // Initialize session token on app startup
            credentials::initialize_session(app.handle())?;

            #[cfg(debug_assertions)]
            {
                // Open devtools in debug mode
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
