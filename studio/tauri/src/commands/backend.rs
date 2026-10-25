//! Backend server lifecycle management.
//!
//! Starts and stops the bundled server. There are three build modes:
//!
//! - **Dev**: never spawn. The developer runs the server manually
//!   (`./scripts/dev.py --server`). Detected via [`tauri::is_dev`].
//! - **Client build**: never spawn. No server binary is bundled; the app talks
//!   to a separately running Server. Selected at compile time by the absence of
//!   the `bundled-server` Cargo feature.
//! - **Full build**: spawn the bundled PyInstaller binary (declared as a Tauri
//!   `externalBin`, installed next to the app executable as `loom-server`).
//!   Selected by the `bundled-server` feature plus the `externalBin` entry in
//!   `tauri.conf.full.json`.
//!
//! Why a compile-time feature instead of a runtime probe for the binary:
//! Tauri embeds its configuration (including `externalBin`) at build time via
//! `generate_context!`, so client-vs-full is already a compile-time distinction.
//! A Cargo feature makes the dispatch deterministic and keeps it in lockstep
//! with which config was compiled in.

//! The server runs in its own process group (Unix) or Job Object (Windows), so
//! stopping it stops the PyInstaller bootloader and the Python child together;
//! see `procs.rs`. A pid file records the server of the running session. After a
//! force-quit or crash the next launch uses it (or, failing that, the port's
//! listener) to stop the leftover server, but only ever a process that is
//! named `loom-server`, and never while another instance of the app is alive.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::process::Command;

use crate::commands::procs;
use crate::commands::{credentials, settings};

/// Port the bundled server listens on. Must match the server default.
pub(crate) const BACKEND_PORT: u16 = 25811;

/// The `externalBin` entry in `tauri.conf.full.json` (the source path, without
/// the target-triple suffix). Used to verify the compiled config matches the
/// `bundled-server` feature.
pub(crate) const SIDECAR_CONFIG_ENTRY: &str = "binaries/loom-server";

/// Image name of the bundled server. The bundler copies the `externalBin` file
/// next to the app executable under its bare file name (`loom-server`, or
/// `loom-server.exe` on Windows), so this is the file name and NOT the
/// `binaries/` config path.
const SIDECAR_NAME: &str = "loom-server";

/// Image name of the app itself, used to tell a live earlier instance from a
/// recycled pid.
const APP_NAME: &str = "sigilweaver-loom-studio";

/// How long a stopping server gets to finish in-flight work (a running
/// workflow, a streaming preview) after SIGTERM before it is killed. Windows
/// has no polite request, so the job is terminated immediately.
#[cfg(unix)]
const SHUTDOWN_GRACE: Duration = Duration::from_secs(10);

/// Readiness poll cadence.
const HEALTH_INTERVAL: Duration = Duration::from_millis(500);

/// Longest a single health probe may take. A server that accepts the
/// connection but never answers must not hang startup.
const HEALTH_PROBE_TIMEOUT: Duration = Duration::from_secs(2);

/// Longest the server may take to become healthy.
const STARTUP_DEADLINE: Duration = Duration::from_secs(45);

/// Whether this build bundles the server. `true` only for Full builds
/// compiled with `--features bundled-server`.
pub(crate) const HAS_BUNDLED_SERVER: bool = cfg!(feature = "bundled-server");

/// The running server's process tree.
struct Running {
    /// Pid of the PyInstaller bootloader, which is also the process group id
    /// on Unix.
    pid: u32,
    #[cfg(windows)]
    job: procs::Job,
}

/// Holds the spawned server so it can be terminated on app exit.
/// Managed as Tauri state and reaped from the `RunEvent` handler.
#[derive(Default)]
pub struct BackendManager {
    running: Mutex<Option<Running>>,
    /// True only while a server this shell launched is up and healthy. Gates
    /// the credential proxy and the legacy plaintext `resolve_connection`.
    owned: AtomicBool,
}

impl BackendManager {
    fn set(&self, running: Running) {
        // Recover a poisoned lock rather than dropping the update: a panic
        // elsewhere while holding this mutex doesn't invalidate the handle,
        // and skipping registration here would leave the server unkillable.
        let mut guard = self
            .running
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        *guard = Some(running);
    }

    fn take(&self) -> Option<Running> {
        let mut guard = self
            .running
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        guard.take()
    }

    fn set_owned(&self, owned: bool) {
        self.owned.store(owned, Ordering::SeqCst);
    }

    /// Whether this shell launched the running server (Full build).
    pub fn is_owned(&self) -> bool {
        self.owned.load(Ordering::SeqCst)
    }
}

/// Start the backend according to the build mode. Returns `Ok(())` once the
/// server is ready (Full build) or immediately (Dev / Client, which never
/// spawn). The returned future resolves only after `GET /api/health/` answers
/// OK, and rejects on spawn error, early process exit, or timeout.
pub async fn start_backend(app: &AppHandle) -> Result<(), String> {
    // DEV: never auto-spawn; the developer starts the server manually.
    if tauri::is_dev() {
        println!("[Backend] Dev mode - start the server manually (./scripts/dev.py --server)");
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

/// Path of the bundled server: next to the app executable.
fn sidecar_path() -> Result<PathBuf, String> {
    let exe =
        std::env::current_exe().map_err(|e| format!("Could not locate the app executable: {e}"))?;
    let dir = exe
        .parent()
        .ok_or_else(|| "The app executable has no parent directory".to_string())?;
    let file = if cfg!(windows) {
        format!("{SIDECAR_NAME}.exe")
    } else {
        SIDECAR_NAME.to_string()
    };
    let path = dir.join(file);
    if path.is_file() {
        Ok(path)
    } else {
        Err(format!(
            "The bundled server ({}) is missing from this install",
            path.display()
        ))
    }
}

/// Spawn the server in its own process group / job object.
fn spawn_server(
    path: &Path,
    env: &HashMap<String, String>,
) -> Result<(tokio::process::Child, Running), String> {
    let mut cmd = Command::new(path);
    cmd.envs(env)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(false);
    #[cfg(unix)]
    cmd.process_group(0);
    #[cfg(windows)]
    {
        // CREATE_NO_WINDOW: no console window for the server.
        cmd.creation_flags(0x0800_0000);
    }

    let child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn the bundled server: {e}"))?;
    let pid = child
        .id()
        .ok_or_else(|| "The bundled server exited immediately".to_string())?;

    #[cfg(windows)]
    let running = {
        let job = procs::Job::new().map_err(|e| format!("Could not create a job object: {e}"))?;
        let handle = child
            .raw_handle()
            .ok_or_else(|| "The bundled server exited immediately".to_string())?;
        job.assign(handle)
            .map_err(|e| format!("Could not put the server in its job object: {e}"))?;
        Running { pid, job }
    };
    #[cfg(not(windows))]
    let running = Running { pid };

    Ok((child, running))
}

/// Forward a server output stream to the log.
fn pump_output<R: tokio::io::AsyncRead + Unpin + Send + 'static>(stream: &'static str, reader: R) {
    tauri::async_runtime::spawn(async move {
        let mut lines = BufReader::new(reader).lines();
        loop {
            match lines.next_line().await {
                Ok(Some(line)) => log_server_line(stream, line.as_bytes()),
                Ok(None) => break,
                Err(e) => {
                    eprintln!("[Backend] Lost the server's {stream}: {e}");
                    break;
                }
            }
        }
    });
}

/// Spawn the server with its environment and wait until it is healthy.
async fn spawn_and_wait(app: &AppHandle) -> Result<(), String> {
    let token =
        credentials::session_token().ok_or_else(|| "Session token not initialized".to_string())?;

    let data_dir = server_data_dir(app)?;
    std::fs::create_dir_all(&data_dir)
        .map_err(|e| format!("Failed to create server data directory: {e}"))?;

    // A previous session that was force-quit or crashed leaves its server
    // running. Stop that one (and only that one) before starting a new one.
    // This runs only in the single running instance (see the single-instance
    // plugin in lib.rs).
    reap_stale_server(&data_dir).await?;

    // Something else already answering on the port would make the readiness
    // probe fail with an opaque timeout. Say what is wrong instead.
    if port_in_use().await {
        let owner = procs::find_listener_pid(BACKEND_PORT)
            .map(|pid| format!(" (process {pid})"))
            .unwrap_or_default();
        return Err(format!(
            "Port {BACKEND_PORT} is already in use{owner}. Close the program using it \
             and try again."
        ));
    }

    // A Full build always ships this binary. If it is missing, the package is
    // broken: fail startup with a clear message instead of opening a window
    // that has no backend behind it.
    let path = sidecar_path()?;

    println!("[Backend] Starting bundled server (Full build)");
    println!("[Backend] Server data directory: {}", data_dir.display());
    println!("[Backend] Auth mode: ephemeral");

    let (mut child, running) = spawn_server(&path, &build_env(&token, &data_dir))?;
    let pid = running.pid;
    println!("[Backend] Spawned server (pid: {pid})");
    write_pid_file(&data_dir, pid);
    app.state::<BackendManager>().set(running);

    if let Some(out) = child.stdout.take() {
        pump_output("stdout", out);
    }
    if let Some(err) = child.stderr.take() {
        pump_output("stderr", err);
    }

    // Reap the bootloader when it exits and flag it, so the readiness loop can
    // fail fast. The process tree record is kept: on Unix the Python child can
    // outlive the bootloader, and `stop_backend` must still be able to signal
    // the group.
    let terminated = Arc::new(AtomicBool::new(false));
    let terminated_waiter = terminated.clone();
    let app_for_waiter = app.clone();
    tauri::async_runtime::spawn(async move {
        match child.wait().await {
            Ok(status) => println!("[Backend] Server process exited ({status})"),
            Err(e) => eprintln!("[Backend] Could not wait for the server process: {e}"),
        }
        terminated_waiter.store(true, Ordering::SeqCst);
        app_for_waiter.state::<BackendManager>().set_owned(false);
    });

    // Poll the health endpoint until it answers OK, the process exits, or the
    // startup deadline passes.
    let started = Instant::now();
    let mut attempt = 0u32;
    while started.elapsed() < STARTUP_DEADLINE {
        attempt += 1;
        if terminated.load(Ordering::SeqCst) {
            return Err("Server process exited before becoming ready".to_string());
        }
        tokio::time::sleep(HEALTH_INTERVAL).await;
        if terminated.load(Ordering::SeqCst) {
            return Err("Server process exited before becoming ready".to_string());
        }
        if health_ok(&token).await {
            app.state::<BackendManager>().set_owned(true);
            println!("[Backend] Health check passed on attempt {attempt}");
            return Ok(());
        }
        println!("[Backend] Health check attempt {attempt} not ready yet");
    }

    Err(format!(
        "Server failed to start within {}s",
        STARTUP_DEADLINE.as_secs()
    ))
}

/// Stop the backend server if one is running. Idempotent: the record is taken
/// out of the manager, so a second call (e.g. `Exit` after `ExitRequested`) is
/// a no-op.
///
/// The whole process tree is stopped (see the module docs). On Unix the group
/// gets SIGTERM and [`SHUTDOWN_GRACE`] to finish in-flight work, then SIGKILL;
/// on Windows the job is terminated. The pid file is removed only once the
/// port is actually free, so a server that could not be stopped is still found
/// by the next launch.
pub fn stop_backend(app: &AppHandle) {
    let manager = app.state::<BackendManager>();
    manager.set_owned(false);
    let Some(running) = manager.take() else {
        println!("[Backend] No backend process to stop");
        return;
    };

    // Hide the window so the wait below does not look like a frozen app.
    if let Some(window) = app.get_webview_window("main") {
        if let Err(e) = window.hide() {
            eprintln!("[Backend] Could not hide the window during shutdown: {e}");
        }
    }

    let pid = running.pid;
    let gone = stop_tree(&running);
    let port_free = procs::wait_until(Duration::from_secs(5), || !port_in_use_blocking());
    if gone && port_free {
        println!("[Backend] Server stopped (pid: {pid})");
        match server_data_dir(app) {
            Ok(dir) => remove_pid_file(&dir),
            Err(e) => eprintln!("[Backend] Could not locate the pid file to remove: {e}"),
        }
    } else {
        eprintln!(
            "[Backend] Server (pid: {pid}) is still running or still holds port \
             {BACKEND_PORT}; the next launch will try to stop it"
        );
    }
}

#[cfg(unix)]
fn stop_tree(running: &Running) -> bool {
    procs::stop_group(running.pid, SHUTDOWN_GRACE)
}

#[cfg(windows)]
fn stop_tree(running: &Running) -> bool {
    if let Err(e) = running.job.terminate() {
        eprintln!("[Backend] Could not terminate the server's job object: {e}");
    }
    procs::wait_until(Duration::from_secs(5), || {
        !procs::process_alive(running.pid)
    })
}

/// Where the running server's pid is recorded so a later launch can find a
/// server that outlived its app (force-quit, crash, power loss). Content:
/// `<server pid> <app pid>`.
fn pid_file(data_dir: &Path) -> PathBuf {
    data_dir.join("loom-server.pid")
}

fn write_pid_file(data_dir: &Path, server_pid: u32) {
    let content = format!("{server_pid} {}", std::process::id());
    if let Err(e) = std::fs::write(pid_file(data_dir), content) {
        eprintln!("[Backend] Could not record the server pid: {e}");
    }
}

fn remove_pid_file(data_dir: &Path) {
    if let Err(e) = std::fs::remove_file(pid_file(data_dir)) {
        if e.kind() != std::io::ErrorKind::NotFound {
            eprintln!("[Backend] Could not remove the server pid file: {e}");
        }
    }
}

/// Parse the pid file: the server pid and, if recorded, the owning app pid.
fn parse_pid_file(text: &str) -> Option<(u32, Option<u32>)> {
    let mut parts = text.split_whitespace();
    let server = parts.next()?.parse().ok()?;
    let app = parts.next().and_then(|p| p.parse().ok());
    Some((server, app))
}

/// If a previous session left its bundled server running, stop it.
///
/// Safety rules, in order:
/// 1. If the app pid recorded with the server is another live instance of the
///    app, do nothing and say so: that server is in use.
/// 2. Only a process still named `loom-server` is ever stopped, so a recycled
///    pid never takes down an unrelated program.
/// 3. If the port is still held afterwards (the pid file was lost, or only the
///    Python child survived), the listener on the port is looked up and, if it
///    is `loom-server`, stopped too.
///
/// The pid file is removed only once the port is free.
async fn reap_stale_server(data_dir: &Path) -> Result<(), String> {
    let text = match std::fs::read_to_string(pid_file(data_dir)) {
        Ok(t) => Some(t),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => None,
        Err(e) => {
            eprintln!("[Backend] Could not read the server pid file: {e}");
            None
        }
    };

    if let Some(text) = text {
        match parse_pid_file(&text) {
            Some((server_pid, app_pid)) => {
                if let Some(app_pid) = app_pid {
                    if app_pid != std::process::id() && procs::is_process_named(app_pid, APP_NAME) {
                        return Err(format!(
                            "Another Sigilweaver Loom instance (process {app_pid}) is already \
                             running. Close it and try again."
                        ));
                    }
                }
                if procs::is_process_named(server_pid, SIDECAR_NAME) {
                    println!(
                        "[Backend] Stopping a server left over from an earlier session \
                         (pid: {server_pid})"
                    );
                    stop_stale_blocking(server_pid).await;
                }
            }
            None => eprintln!("[Backend] Ignoring an unreadable server pid file: {text:?}"),
        }
    }

    if !port_in_use().await {
        remove_pid_file(data_dir);
        return Ok(());
    }

    // The port is still held: look for the listener directly.
    match procs::find_listener_pid(BACKEND_PORT) {
        Some(pid) if procs::is_process_named(pid, SIDECAR_NAME) => {
            println!("[Backend] Stopping the server holding port {BACKEND_PORT} (pid: {pid})");
            stop_stale_blocking(pid).await;
        }
        Some(pid) => {
            eprintln!("[Backend] Port {BACKEND_PORT} is held by another program (pid: {pid})");
        }
        None => eprintln!("[Backend] Port {BACKEND_PORT} is in use but its owner was not found"),
    }

    for _ in 0..20 {
        if !port_in_use().await {
            remove_pid_file(data_dir);
            return Ok(());
        }
        tokio::time::sleep(Duration::from_millis(250)).await;
    }
    Ok(())
}

/// Run the blocking stop on a worker thread and log a failure.
async fn stop_stale_blocking(pid: u32) {
    #[cfg(unix)]
    let grace = SHUTDOWN_GRACE;
    #[cfg(windows)]
    let grace = Duration::from_secs(5);
    match tauri::async_runtime::spawn_blocking(move || procs::stop_stale(pid, grace)).await {
        Ok(true) => {}
        Ok(false) => eprintln!("[Backend] Could not stop the leftover server (pid: {pid})"),
        Err(e) => eprintln!("[Backend] Stopping the leftover server failed: {e}"),
    }
}

/// Resolve the writable data directory for the server's working files.
///
/// The app resources directory is read-only on AppImage and NSIS installs, so
/// the server's archive,
/// audit, cache, and connection-store paths are redirected under the per-user
/// app-data directory. These must never default to paths inside the bundle.
fn server_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data directory: {e}"))?;
    Ok(base.join("server-data"))
}

/// Build the environment block passed to the spawned server.
fn build_env(token: &str, data_dir: &Path) -> HashMap<String, String> {
    let path_str = |p: PathBuf| p.to_string_lossy().into_owned();
    let mut env = HashMap::new();
    env.insert("PYTHONUNBUFFERED".to_string(), "1".to_string());
    env.insert("POLARS_VERBOSE".to_string(), "1".to_string());
    // Production: ephemeral auth mode with the launch-scoped session token.
    env.insert("AUTH_MODE".to_string(), "ephemeral".to_string());
    env.insert("SESSION_TOKEN".to_string(), token.to_string());
    // Redirect server working paths to a writable location.
    env.insert(
        "ARCHIVE_PATH".to_string(),
        path_str(data_dir.join("archives")),
    );
    env.insert("AUDIT_PATH".to_string(), path_str(data_dir.join("audit")));
    env.insert("CACHE_PATH".to_string(), path_str(data_dir.join("cache")));
    env.insert(
        "CONNECTION_STORE_PATH".to_string(),
        path_str(data_dir.join("connections.json")),
    );
    env
}

/// Whether something is already accepting connections on the server port.
async fn port_in_use() -> bool {
    TcpStream::connect(("127.0.0.1", BACKEND_PORT))
        .await
        .is_ok()
}

/// Blocking variant of [`port_in_use`], for the exit path.
fn port_in_use_blocking() -> bool {
    std::net::TcpStream::connect_timeout(
        &std::net::SocketAddr::from(([127, 0, 0, 1], BACKEND_PORT)),
        Duration::from_millis(500),
    )
    .is_ok()
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
/// only on a 2xx response.
///
/// Implemented as a raw HTTP/1.1 request over a localhost TCP socket to avoid
/// pulling in an HTTP-client dependency; the readiness contract stays in Rust
/// rather than moving to the frontend.
async fn health_probe(token: &str) -> bool {
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

/// [`health_probe`] bounded by [`HEALTH_PROBE_TIMEOUT`].
async fn health_ok(token: &str) -> bool {
    match tokio::time::timeout(HEALTH_PROBE_TIMEOUT, health_probe(token)).await {
        Ok(ok) => ok,
        Err(_) => {
            println!("[Backend] Health probe timed out after {HEALTH_PROBE_TIMEOUT:?}");
            false
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
    fn parses_the_pid_file() {
        assert_eq!(parse_pid_file("123 456"), Some((123, Some(456))));
        assert_eq!(parse_pid_file("123\n"), Some((123, None)));
        assert_eq!(parse_pid_file(""), None);
        assert_eq!(parse_pid_file("abc 1"), None);
    }

    #[tokio::test]
    async fn a_silent_server_does_not_hang_the_health_probe() {
        // Accepts the connection, never answers: the probe must give up.
        let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
            .await
            .unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            let (_sock, _) = listener.accept().await.unwrap();
            tokio::time::sleep(Duration::from_secs(30)).await;
        });
        let started = Instant::now();
        let result = tokio::time::timeout(HEALTH_PROBE_TIMEOUT, async {
            // Same shape as health_probe: connect, write, wait for a reply.
            let mut s = TcpStream::connect(addr).await.unwrap();
            s.write_all(b"GET / HTTP/1.1\r\n\r\n").await.unwrap();
            let mut buf = [0u8; 8];
            s.read(&mut buf).await
        })
        .await;
        assert!(result.is_err(), "the silent server must hit the timeout");
        assert!(started.elapsed() < HEALTH_PROBE_TIMEOUT + Duration::from_secs(2));
    }

    #[test]
    fn build_env_sets_expected_keys() {
        let env = build_env("tok-123", Path::new("/data"));
        assert_eq!(env.get("AUTH_MODE").map(String::as_str), Some("ephemeral"));
        assert_eq!(
            env.get("SESSION_TOKEN").map(String::as_str),
            Some("tok-123")
        );
        assert!(env.get("ARCHIVE_PATH").unwrap().ends_with("archives"));
        assert!(env
            .get("CONNECTION_STORE_PATH")
            .unwrap()
            .ends_with("connections.json"));
    }
}
