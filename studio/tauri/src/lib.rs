//! Sigilweaver Loom Studio - Tauri Application
//!
//! This is the Rust backend for the Tauri build of Sigilweaver Loom Studio.
//! It provides the desktop platform capabilities:
//! - File operations (dialog-granted read/write, dialogs)
//! - Settings persistence
//! - Secure credential storage and the credential-injecting proxy
//! - Backend process management

mod commands;

use commands::{backend, credentials, files, proxy, settings};
use tauri::Manager;
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

/// Refuse to run if the `bundled-server` Cargo feature and the compiled
/// config's `externalBin` disagree about whether a server sidecar exists.
/// These are two independently-toggled build inputs (feature flag vs.
/// `-c tauri.conf.full.json`) with nothing else enforcing they're supplied
/// together; a mismatch compiles cleanly but produces a broken binary at
/// runtime (see `backend::start_backend`), so fail loudly at startup instead.
fn check_bundled_server_config_matches_feature(config: &tauri::Config) {
    let sidecar_configured = config
        .bundle
        .external_bin
        .as_ref()
        .is_some_and(|bins| bins.iter().any(|b| b == backend::SIDECAR_CONFIG_ENTRY));

    if backend::HAS_BUNDLED_SERVER != sidecar_configured {
        eprintln!(
            "[Main] Build misconfiguration: the `bundled-server` Cargo feature is {} \
             but the compiled config {} the sidecar in `externalBin`. Build both \
             together (`--features bundled-server -c tauri/tauri.conf.full.json`) \
             or neither.",
            if backend::HAS_BUNDLED_SERVER {
                "enabled"
            } else {
                "disabled"
            },
            if sidecar_configured {
                "includes"
            } else {
                "does not include"
            },
        );
        std::process::exit(1);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let context = tauri::generate_context!();
    check_bundled_server_config_matches_feature(context.config());

    let app = tauri::Builder::default()
        // Dialogs, the store and the shell (sidecar) plugins are used from Rust
        // only; the renderer is granted none of their commands (see
        // capabilities/main.json). The opener plugin backs external links.
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(backend::BackendManager::default())
        .manage(files::FileGrants::default())
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
            credentials::get_connection,
            credentials::create_connection,
            credentials::update_connection,
            credentials::delete_connection,
            credentials::resolve_connection,
            credentials::connection_proxy_available,
            credentials::test_connection,
            // Credential proxy
            proxy::backend_request,
        ])
        .setup(|app| {
            // Initialize session token on app startup
            credentials::initialize_session(app.handle())?;

            // Start the backend (Full build only; Dev and Client never spawn).
            // Run it off the setup path so window creation is not blocked, and
            // keep the main window (created hidden, see tauri.conf.json)
            // hidden until the backend is confirmed ready. A startup failure shows
            // an error dialog followed by exit instead of ever revealing a
            // window that has no working backend behind it.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match backend::start_backend(&handle).await {
                    Ok(()) => {
                        if let Some(window) = handle.get_webview_window("main") {
                            let _ = window.show();
                        }
                    }
                    Err(e) => {
                        eprintln!("[Main] Failed to start the backend server: {e}");
                        let dialog_handle = handle.clone();
                        handle
                            .dialog()
                            .message(format!("Failed to start the backend server.\n\n{e}"))
                            .kind(MessageDialogKind::Error)
                            .title("Startup Error")
                            .show(move |_| dialog_handle.exit(1));
                    }
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
        .build(context)
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
