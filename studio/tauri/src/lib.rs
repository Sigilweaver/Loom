//! Sigilweaver Loom Studio - Tauri Application
//!
//! This is the Rust backend for the Tauri build of Sigilweaver Loom Studio.
//! It provides the desktop platform capabilities:
//! - File operations (dialog-granted read/write, dialogs)
//! - Settings persistence
//! - Secure credential storage and the credential-injecting proxy
//! - Backend process management

mod commands;
mod navigation;

use commands::{backend, credentials, files, proxy, settings};
use navigation::{classify, UrlAction};
use tauri::webview::{NewWindowResponse, PermissionResponse, WebviewWindowBuilder};
use tauri::Manager;
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};
use tauri_plugin_opener::OpenerExt;

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

/// Quit through the normal exit path when the OS asks the process to
/// terminate (SIGTERM from a logout or shutdown, SIGINT from a terminal,
/// SIGHUP when the terminal closes, Ctrl+C on Windows). Without this the
/// process dies immediately, the exit handlers never run and the bundled
/// server is left running with its port bound.
fn exit_on_termination_signal(handle: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        #[cfg(unix)]
        {
            use tokio::signal::unix::{signal, SignalKind};
            let (Ok(mut term), Ok(mut int), Ok(mut hup)) = (
                signal(SignalKind::terminate()),
                signal(SignalKind::interrupt()),
                signal(SignalKind::hangup()),
            ) else {
                eprintln!("[Main] Could not install termination signal handlers");
                return;
            };
            tokio::select! {
                _ = term.recv() => {}
                _ = int.recv() => {}
                _ = hup.recv() => {}
            }
        }
        #[cfg(not(unix))]
        {
            if tokio::signal::ctrl_c().await.is_err() {
                eprintln!("[Main] Could not install the Ctrl+C handler");
                return;
            }
        }
        println!("[Main] Termination signal received, shutting down");
        handle.exit(0);
    });
}

/// Bring the main window to the front (a second launch, or a restore).
fn focus_main_window(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    for (what, result) in [
        ("unminimize", window.unminimize()),
        ("show", window.show()),
        ("focus", window.set_focus()),
    ] {
        if let Err(e) = result {
            eprintln!("[Main] Could not {what} the main window: {e}");
        }
    }
}

/// Create the main window from its config entry (`create: false` in
/// tauri.conf.json), with the navigation and permission policy attached.
fn create_main_window(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|w| w.label == "main")
        .ok_or("tauri.conf.json has no \"main\" window")?;

    let nav_handle = app.handle().clone();
    let new_window_handle = app.handle().clone();
    let title = format!("Sigilweaver Loom - Version {}", app.package_info().version);

    WebviewWindowBuilder::from_config(app.handle(), config)?
        .title(title)
        // Off-app URLs open in the system browser and are never loaded here.
        .on_navigation(move |url| match classify(url, tauri::is_dev()) {
            UrlAction::App => true,
            UrlAction::External => {
                open_externally(&nav_handle, url);
                false
            }
            UrlAction::Block => {
                eprintln!("[Main] Blocked navigation to {url}");
                false
            }
        })
        // window.open gets the same treatment; no extra windows are created.
        .on_new_window(move |url, _features| {
            match classify(&url, tauri::is_dev()) {
                UrlAction::External => open_externally(&new_window_handle, &url),
                UrlAction::App => eprintln!("[Main] Refused to open a second app window"),
                UrlAction::Block => eprintln!("[Main] Blocked window.open to {url}"),
            }
            NewWindowResponse::Deny
        })
        // Studio asks for no camera, microphone, location or notifications.
        .on_permission_request(|_, kind| {
            eprintln!("[Main] Denied webview permission request: {kind:?}");
            PermissionResponse::Deny
        })
        .build()?;
    Ok(())
}

fn open_externally(app: &tauri::AppHandle, url: &tauri::Url) {
    if let Err(e) = app.opener().open_url(url.as_str(), None::<&str>) {
        eprintln!("[Main] Could not open {url} in the system browser: {e}");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let context = tauri::generate_context!();
    check_bundled_server_config_matches_feature(context.config());

    let mut builder = tauri::Builder::default();

    // Must be the first plugin: a second launch hands over to the running
    // instance and exits before anything else (including the stale-server
    // reaper) starts, so it can never stop the first instance's server.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            println!("[Main] A second launch was redirected to the running instance");
            focus_main_window(app);
        }));
    }

    let app = builder
        // Dialogs and the store are used from Rust only; the renderer is
        // granted none of their commands (see capabilities/main.json). The
        // opener plugin backs external links.
        .plugin(tauri_plugin_dialog::init())
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
            exit_on_termination_signal(app.handle().clone());
            create_main_window(app)?;

            // Start the backend (Full build only; Dev and Client never spawn).
            // Run it off the setup path so window creation is not blocked, and
            // keep the main window (created hidden, see tauri.conf.json)
            // hidden until the backend is confirmed ready. A startup failure shows
            // an error dialog followed by exit instead of ever revealing a
            // window that has no working backend behind it.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match backend::start_backend(&handle).await {
                    Ok(()) => match handle.get_webview_window("main") {
                        Some(window) => {
                            if let Err(e) = window.show() {
                                eprintln!("[Main] Could not show the main window: {e}");
                            }
                        }
                        None => eprintln!("[Main] The main window does not exist"),
                    },
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
