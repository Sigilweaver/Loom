//! Sigilweaver Loom Studio - Tauri Application
//!
//! This is the Rust backend for the Tauri build of Sigilweaver Loom Studio.
//! It implements the same platform capabilities as the Electron version:
//! - File operations (read, write, dialogs)
//! - Settings persistence
//! - Secure credential storage
//! - Backend process management

mod commands;

use commands::{backend, credentials, files, settings};
use tauri::Manager;
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(backend::BackendManager::default())
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

            // Start the backend (Full build only; Dev and Client never spawn).
            // Run it off the setup path so window creation is not blocked, and
            // surface a startup failure the way Electron does: an error dialog
            // followed by exit.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = backend::start_backend(&handle).await {
                    eprintln!("[Main] Failed to start the backend server: {e}");
                    let dialog_handle = handle.clone();
                    handle
                        .dialog()
                        .message(format!(
                            "Failed to start the backend server.\n\n{e}"
                        ))
                        .kind(MessageDialogKind::Error)
                        .title("Startup Error")
                        .show(move |_| dialog_handle.exit(1));
                }
            });

            #[cfg(debug_assertions)]
            {
                // Open devtools in debug mode
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    // Tear down the server on exit. `ExitRequested` fires on a normal quit;
    // `Exit` is the final event and covers abnormal paths, including the
    // programmatic exit from a startup failure. `stop_backend` is idempotent.
    app.run(|app_handle, event| match event {
        tauri::RunEvent::ExitRequested { .. } => backend::stop_backend(app_handle),
        tauri::RunEvent::Exit => backend::stop_backend(app_handle),
        _ => {}
    });
}
