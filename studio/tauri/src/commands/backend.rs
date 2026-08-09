//! Backend server lifecycle management.
//!
//! Ports the bundled-server lifecycle from the Electron shell
//! (`studio/electron/main.ts`) to the Tauri shell. The three build modes behave
//! exactly as they do under Electron:
//!
//! - **Dev**: never spawn. The developer runs the server manually
//!   (`./scripts/dev.py --server`). Detected via [`tauri::is_dev`].
//! - **Client build**: never spawn. No server binary is bundled; the app talks
//!   to a separately running Server. Selected at compile time by the absence of
//!   the `bundled-server` Cargo feature.
//! - **Full build**: spawn the bundled PyInstaller binary as a Tauri sidecar.
//!   Selected by the `bundled-server` feature plus the `externalBin` entry in
//!   `tauri.conf.full.json`.
//!
//! Why a compile-time feature instead of Electron's runtime `existsSync` probe:
//! Tauri embeds its configuration (including `externalBin`) at build time via
//! `generate_context!`, so client-vs-full is already a compile-time distinction
//! in this shell. A Cargo feature makes the dispatch deterministic and keeps it
//! in lockstep with which config was compiled in.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

use crate::commands::{credentials, settings};

/// Port the bundled server listens on. Must match the server default and the
/// Electron shell's `BACKEND_PORT`.
const BACKEND_PORT: u16 = 25811;

/// Sidecar program name, as declared under `externalBin` in
/// `tauri.conf.full.json`. `Shell::sidecar` resolves this relative to the app
/// binary directory.
const SIDECAR_NAME: &str = "binaries/server";

/// Readiness poll cadence: 30 attempts, 500ms apart (15s total), matching the
/// Electron shell's health-check loop.
const HEALTH_MAX_ATTEMPTS: u32 = 30;
const HEALTH_INTERVAL: Duration = Duration::from_millis(500);

/// Whether this build bundles the server sidecar. `true` only for Full builds
/// compiled with `--features bundled-server`.
pub(crate) const HAS_BUNDLED_SERVER: bool = cfg!(feature = "bundled-server");

/// Holds the spawned server child so it can be terminated on app exit.
/// Managed as Tauri state and reaped from the `RunEvent` handler.
#[derive(Default)]
pub struct BackendManager {
    child: Mutex<Option<CommandChild>>,
}

impl BackendManager {
    fn set(&self, child: CommandChild) {
        // Recover a poisoned lock rather than dropping the update: a panic
        // elsewhere while holding this mutex doesn't invalidate the child
        // handle itself, and silently skipping registration here would leave
        // the sidecar unkillable on shutdown.
        let mut guard = self.child.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        *guard = Some(child);
    }

    fn take(&self) -> Option<CommandChild> {
        let mut guard = self.child.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        guard.take()
    }
}

/// Start the backend according to the build mode. Returns `Ok(())` once the
/// server is ready (Full build) or immediately (Dev / Client, which never
/// spawn). Mirrors Electron's `startBackend`: the returned future resolves only
/// after `GET /api/health/` answers OK, and rejects on spawn error, early
/// process exit, or timeout.
pub async fn start_backend(app: &AppHandle) -> Result<(), String> {
    // DEV: never auto-spawn; the developer starts the server manually.
    if tauri::is_dev() {
        println!(
            "[Backend] Dev mode - start the server manually (./scripts/dev.py --server)"
        );
        return Ok(());
    }

    // CLIENT build: no server bundled.
    if !HAS_BUNDLED_SERVER {
        println!("[Backend] Client build - no bundled server");
        println!("[Backend] Connect to a remote server via Settings");
        return Ok(());
    }

    // FULL build: honor the autoStart setting.
    if !settings::backend_auto_start(app) {
        println!("[Backend] autoStart disabled in settings");
        return Ok(());
    }

    spawn_and_wait(app).await
}

/// Spawn the sidecar with the server environment and wait until it is healthy.
async fn spawn_and_wait(app: &AppHandle) -> Result<(), String> {
    let token = credentials::session_token()
        .ok_or_else(|| "Session token not initialized".to_string())?;

    let data_dir = server_data_dir(app)?;
    std::fs::create_dir_all(&data_dir)
        .map_err(|e| format!("Failed to create server data directory: {e}"))?;

    // A Full build should always have this binary; if it's missing (e.g. a
    // packaging mistake), degrade the same way Electron's `getBackendPath`
    // does for a missing server executable - log and run without a backend -
    // rather than treating a bundling defect as an unrecoverable startup
    // failure the user can't do anything about.
    let sidecar_cmd = match app.shell().sidecar(SIDECAR_NAME) {
        Ok(cmd) => cmd,
        Err(e) => {
            eprintln!("[Backend] Server sidecar not found ({e})");
            println!("[Backend] Connect to a remote server via Settings");
            return Ok(());
        }
    };

    println!("[Backend] Starting bundled server (Full build)");
    println!("[Backend] Server data directory: {}", data_dir.display());
    println!("[Backend] Auth mode: ephemeral");

    let (mut rx, child) = sidecar_cmd
        .envs(build_env(&token, &data_dir))
        .spawn()
        .map_err(|e| format!("Failed to spawn server sidecar: {e}"))?;

    let pid = child.pid();
    println!("[Backend] Spawned server sidecar (pid: {pid})");
    app.state::<BackendManager>().set(child);

    // Drain the event stream: forward stdout/stderr to the log and flip a flag
    // when the process errors or terminates, so the readiness loop can fail fast
    // (Electron rejects startBackend on early process exit).
    let terminated = Arc::new(AtomicBool::new(false));
    let terminated_reader = terminated.clone();
    let app_for_reader = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => log_server_line("stdout", &bytes),
                CommandEvent::Stderr(bytes) => log_server_line("stderr", &bytes),
                CommandEvent::Error(err) => {
                    eprintln!("[Backend] Sidecar error: {err}");
                    terminated_reader.store(true, Ordering::SeqCst);
                    // Drop the stored child: it's already gone, and leaving it
                    // registered risks a later `stop_backend` killing a PID the
                    // OS has since recycled for something else.
                    app_for_reader.state::<BackendManager>().take();
                }
                CommandEvent::Terminated(payload) => {
                    println!(
                        "[Backend] Server process exited (code: {:?}, signal: {:?})",
                        payload.code, payload.signal
                    );
                    terminated_reader.store(true, Ordering::SeqCst);
                    app_for_reader.state::<BackendManager>().take();
                }
                _ => {}
            }
        }
    });

    // Poll the health endpoint until it answers OK, the process exits, or we
    // exhaust the attempt budget.
    for attempt in 1..=HEALTH_MAX_ATTEMPTS {
        if terminated.load(Ordering::SeqCst) {
            return Err("Server process exited before becoming ready".to_string());
        }
        tokio::time::sleep(HEALTH_INTERVAL).await;
        if terminated.load(Ordering::SeqCst) {
            return Err("Server process exited before becoming ready".to_string());
        }
        if health_ok(&token).await {
            println!("[Backend] Health check passed on attempt {attempt}");
            return Ok(());
        }
        println!(
            "[Backend] Health check attempt {attempt}/{HEALTH_MAX_ATTEMPTS} not ready yet"
        );
    }

    let timeout_secs = HEALTH_MAX_ATTEMPTS as u64 * HEALTH_INTERVAL.as_millis() as u64 / 1000;
    Err(format!("Server failed to start within {timeout_secs}s"))
}

/// Stop the backend server if one is running. Idempotent: the child is taken
/// out of the manager, so a second call (e.g. `Exit` after `ExitRequested`) is
/// a no-op.
///
/// Note: `CommandChild::kill` sends SIGKILL on Unix (via `shared_child`), which
/// is more aggressive than Electron's plain SIGTERM. This is a deliberate
/// choice: orphaning the Python server is the worst failure mode for this
/// feature, and a hung server currently blocks nothing on shutdown, so the
/// stronger signal trades graceful teardown for a guarantee that the process is
/// gone.
pub fn stop_backend(app: &AppHandle) {
    match app.state::<BackendManager>().take() {
        Some(child) => {
            let pid = child.pid();
            match child.kill() {
                Ok(()) => println!("[Backend] Stop signal sent to server (pid: {pid})"),
                Err(e) => eprintln!("[Backend] Failed to stop server (pid: {pid}): {e}"),
            }
        }
        None => println!("[Backend] No backend process to stop"),
    }
}

/// Resolve the writable data directory for the server's working files.
///
/// The app resources directory is read-only on AppImage and NSIS installs, so
/// (as Electron does with `app.getPath('userData')`) the server's archive,
/// audit, cache, and connection-store paths are redirected under the per-user
/// app-data directory. These must never default to paths inside the bundle.
fn server_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data directory: {e}"))?;
    Ok(base.join("server-data"))
}

/// Build the environment block passed to the spawned server. Mirrors the block
/// set by Electron's `startBackend`.
fn build_env(token: &str, data_dir: &Path) -> HashMap<String, String> {
    let path_str = |p: PathBuf| p.to_string_lossy().into_owned();
    let mut env = HashMap::new();
    env.insert("PYTHONUNBUFFERED".to_string(), "1".to_string());
    env.insert("POLARS_VERBOSE".to_string(), "1".to_string());
    // Production: ephemeral auth mode with the launch-scoped session token.
    env.insert("AUTH_MODE".to_string(), "ephemeral".to_string());
    env.insert("SESSION_TOKEN".to_string(), token.to_string());
    // Redirect server working paths to a writable location.
    env.insert("ARCHIVE_PATH".to_string(), path_str(data_dir.join("archives")));
    env.insert("AUDIT_PATH".to_string(), path_str(data_dir.join("audit")));
    env.insert("CACHE_PATH".to_string(), path_str(data_dir.join("cache")));
    env.insert(
        "CONNECTION_STORE_PATH".to_string(),
        path_str(data_dir.join("connections.json")),
    );
    env
}

/// Log a line emitted by the server, routing obvious error output to stderr.
fn log_server_line(stream: &str, bytes: &[u8]) {
    let message = String::from_utf8_lossy(bytes);
    let message = message.trim();
    if message.is_empty() {
        return;
    }
    if message.contains("ERROR") || message.contains("CRITICAL") || message.contains("Traceback") {
        eprintln!("[Backend {stream}] {message}");
    } else {
        println!("[Backend {stream}] {message}");
    }
}

/// Probe the server's health endpoint with the session token. Returns `true`
/// only on a 2xx response, matching Electron's `response.ok` check.
///
/// Implemented as a raw HTTP/1.1 request over a localhost TCP socket to avoid
/// pulling in an HTTP-client dependency; the readiness contract stays in Rust
/// (faithful to Electron) rather than moving to the frontend.
async fn health_ok(token: &str) -> bool {
    let addr = format!("127.0.0.1:{BACKEND_PORT}");
    let Ok(mut stream) = TcpStream::connect(&addr).await else {
        return false;
    };

    let request = format!(
        "GET /api/health/ HTTP/1.1\r\n\
         Host: 127.0.0.1:{BACKEND_PORT}\r\n\
         Authorization: Bearer {token}\r\n\
         Connection: close\r\n\r\n"
    );
    if stream.write_all(request.as_bytes()).await.is_err() {
        return false;
    }

    // Accumulate reads until the status line's terminating CRLF shows up; a
    // single `read` is not guaranteed to return the whole line in one call.
    let mut received = Vec::with_capacity(256);
    let mut chunk = [0u8; 256];
    loop {
        if received.len() > 4096 {
            return false;
        }
        let n = match stream.read(&mut chunk).await {
            Ok(0) | Err(_) => return false,
            Ok(n) => n,
        };
        received.extend_from_slice(&chunk[..n]);
        if let Some(line_end) = received.windows(2).position(|w| w == b"\r\n") {
            let head = String::from_utf8_lossy(&received[..line_end]);
            return is_2xx_status_line(&head);
        }
    }
}

/// Parse an HTTP status line and report whether the code is 2xx.
fn is_2xx_status_line(status_line: &str) -> bool {
    status_line
        .split_whitespace()
        .nth(1)
        .and_then(|code| code.parse::<u16>().ok())
        .is_some_and(|code| (200..300).contains(&code))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_2xx_status_lines() {
        assert!(is_2xx_status_line("HTTP/1.1 200 OK"));
        assert!(is_2xx_status_line("HTTP/1.0 204 No Content"));
        assert!(is_2xx_status_line("HTTP/1.1 299 Custom"));
    }

    #[test]
    fn rejects_non_2xx_and_garbage() {
        assert!(!is_2xx_status_line("HTTP/1.1 404 Not Found"));
        assert!(!is_2xx_status_line("HTTP/1.1 503 Service Unavailable"));
        assert!(!is_2xx_status_line("HTTP/1.1 301 Moved"));
        assert!(!is_2xx_status_line(""));
        assert!(!is_2xx_status_line("garbage"));
    }

    #[test]
    fn build_env_sets_expected_keys() {
        let env = build_env("tok-123", Path::new("/data"));
        assert_eq!(env.get("AUTH_MODE").map(String::as_str), Some("ephemeral"));
        assert_eq!(env.get("SESSION_TOKEN").map(String::as_str), Some("tok-123"));
        assert!(env.get("ARCHIVE_PATH").unwrap().ends_with("archives"));
        assert!(env
            .get("CONNECTION_STORE_PATH")
            .unwrap()
            .ends_with("connections.json"));
    }
}
