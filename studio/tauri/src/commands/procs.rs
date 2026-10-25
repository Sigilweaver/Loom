//! Process control for the bundled server.
//!
//! The server is a PyInstaller one-file executable: a small bootloader process
//! that runs the real Python process as its child. Stopping "the server"
//! therefore means stopping a process tree, not a single pid:
//!
//! - **Unix**: the server is started as the leader of its own process group,
//!   and the whole group is signalled (SIGTERM, then SIGKILL).
//! - **Windows**: the server is placed in a Job Object. Terminating the job
//!   ends every process in it, and the job is set to kill its members when the
//!   last handle closes, so the tree also dies if the app crashes.
//!
//! Everything here reports failures instead of dropping them; callers decide
//! what to log.

use std::io;
use std::process::Command;
use std::time::{Duration, Instant};

/// Poll `pred` every 100 ms until it is true or `timeout` passes.
pub fn wait_until(timeout: Duration, mut pred: impl FnMut() -> bool) -> bool {
    let deadline = Instant::now() + timeout;
    loop {
        if pred() {
            return true;
        }
        if Instant::now() >= deadline {
            return false;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
}

/// Whether the leaf of `listing` (output of a process listing command) names
/// `want`. Accepts a bare name, a full path, a Windows `.exe` name, a CSV row
/// from `tasklist`, and a Linux `comm` truncated to 15 characters.
pub fn image_matches(listing: &str, want: &str) -> bool {
    let name = listing
        .lines()
        .next()
        .unwrap_or("")
        .trim()
        .trim_start_matches('"')
        .split('"')
        .next()
        .unwrap_or("")
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or("");
    let name = name.strip_suffix(".exe").unwrap_or(name);
    if name.is_empty() {
        return false;
    }
    name == want || (name.len() >= 15 && want.starts_with(name))
}

/// Executable name of a live process, or `None` if it is not running.
#[cfg(unix)]
pub fn image_name(pid: u32) -> Option<String> {
    let out = Command::new("ps")
        .args(["-p", &pid.to_string(), "-o", "comm="])
        .output()
        .map_err(|e| eprintln!("[Backend] Could not run ps: {e}"))
        .ok()?;
    out.status
        .success()
        .then(|| String::from_utf8_lossy(&out.stdout).into_owned())
}

#[cfg(windows)]
pub fn image_name(pid: u32) -> Option<String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let out = Command::new("tasklist")
        .args(["/FI", &format!("PID eq {pid}"), "/FO", "CSV", "/NH"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| eprintln!("[Backend] Could not run tasklist: {e}"))
        .ok()?;
    out.status
        .success()
        .then(|| String::from_utf8_lossy(&out.stdout).into_owned())
}

/// Whether `pid` is a live process whose executable is `want`.
pub fn is_process_named(pid: u32, want: &str) -> bool {
    image_name(pid).is_some_and(|listing| image_matches(&listing, want))
}

/// Find the pid listening on a loopback TCP port, if any.
pub fn find_listener_pid(port: u16) -> Option<u32> {
    #[cfg(unix)]
    {
        // lsof ships with macOS and most Linux desktops; ss is the fallback.
        if let Ok(out) = Command::new("lsof")
            .args(["-nP", &format!("-iTCP:{port}"), "-sTCP:LISTEN", "-t"])
            .output()
        {
            if let Some(pid) = String::from_utf8_lossy(&out.stdout)
                .lines()
                .find_map(|l| l.trim().parse::<u32>().ok())
            {
                return Some(pid);
            }
        }
        let out = Command::new("ss")
            .args(["-ltnpH", &format!("sport = :{port}")])
            .output()
            .map_err(|e| eprintln!("[Backend] Could not look up the port owner (lsof, ss): {e}"))
            .ok()?;
        String::from_utf8_lossy(&out.stdout)
            .split("pid=")
            .nth(1)
            .and_then(|rest| {
                rest.chars()
                    .take_while(char::is_ascii_digit)
                    .collect::<String>()
                    .parse()
                    .ok()
            })
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let out = Command::new("netstat")
            .args(["-ano", "-p", "TCP"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| eprintln!("[Backend] Could not look up the port owner (netstat): {e}"))
            .ok()?;
        let needle = format!(":{port}");
        String::from_utf8_lossy(&out.stdout).lines().find_map(|l| {
            let cols: Vec<&str> = l.split_whitespace().collect();
            (cols.len() >= 5
                && cols[3].eq_ignore_ascii_case("LISTENING")
                && cols[1].ends_with(&needle))
            .then(|| cols[4].parse().ok())
            .flatten()
        })
    }
}

// ---------------------------------------------------------------------------
// Unix: process groups
// ---------------------------------------------------------------------------

/// Send `sig` to every member of the process group led by `pgid`.
#[cfg(unix)]
pub fn signal_group(pgid: u32, sig: i32) -> io::Result<()> {
    // SAFETY: kill(2) with a negative pid signals a process group; no memory
    // is touched.
    if unsafe { libc::kill(-(pgid as i32), sig) } == 0 {
        Ok(())
    } else {
        Err(io::Error::last_os_error())
    }
}

/// Send `sig` to one process.
#[cfg(unix)]
pub fn signal_pid(pid: u32, sig: i32) -> io::Result<()> {
    // SAFETY: as above.
    if unsafe { libc::kill(pid as i32, sig) } == 0 {
        Ok(())
    } else {
        Err(io::Error::last_os_error())
    }
}

/// Whether any process in the group is still alive. EPERM means it exists but
/// belongs to someone else, which still counts as alive.
#[cfg(unix)]
pub fn group_alive(pgid: u32) -> bool {
    match signal_group(pgid, 0) {
        Ok(()) => true,
        Err(e) => e.raw_os_error() == Some(libc::EPERM),
    }
}

#[cfg(unix)]
pub fn process_alive(pid: u32) -> bool {
    match signal_pid(pid, 0) {
        Ok(()) => true,
        Err(e) => e.raw_os_error() == Some(libc::EPERM),
    }
}

/// Stop a process tree started as a process-group leader: SIGTERM the group,
/// wait up to `grace` for it to exit, then SIGKILL whatever is left. Returns
/// whether the group is gone.
#[cfg(unix)]
pub fn stop_group(pgid: u32, grace: Duration) -> bool {
    match signal_group(pgid, libc::SIGTERM) {
        Ok(()) => {}
        Err(e) if e.raw_os_error() == Some(libc::ESRCH) => return true,
        Err(e) => eprintln!("[Backend] SIGTERM to process group {pgid} failed: {e}"),
    }
    if wait_until(grace, || !group_alive(pgid)) {
        return true;
    }
    eprintln!("[Backend] Server group {pgid} did not exit within {grace:?}, killing it");
    if let Err(e) = signal_group(pgid, libc::SIGKILL) {
        if e.raw_os_error() != Some(libc::ESRCH) {
            eprintln!("[Backend] SIGKILL to process group {pgid} failed: {e}");
        }
    }
    wait_until(Duration::from_secs(3), || !group_alive(pgid))
}

/// Stop a process that is not known to lead a group (a leftover from an
/// earlier session): try its group first, then the process itself, then
/// SIGKILL. Returns whether it is gone.
#[cfg(unix)]
pub fn stop_stale(pid: u32, grace: Duration) -> bool {
    if group_alive(pid) {
        return stop_group(pid, grace);
    }
    match signal_pid(pid, libc::SIGTERM) {
        Ok(()) => {}
        Err(e) if e.raw_os_error() == Some(libc::ESRCH) => return true,
        Err(e) => {
            eprintln!("[Backend] SIGTERM to pid {pid} failed: {e}");
            return false;
        }
    }
    if wait_until(grace, || !process_alive(pid)) {
        return true;
    }
    if let Err(e) = signal_pid(pid, libc::SIGKILL) {
        if e.raw_os_error() != Some(libc::ESRCH) {
            eprintln!("[Backend] SIGKILL to pid {pid} failed: {e}");
        }
    }
    wait_until(Duration::from_secs(3), || !process_alive(pid))
}

// ---------------------------------------------------------------------------
// Windows: job objects
// ---------------------------------------------------------------------------

#[cfg(windows)]
pub use win::{process_alive, stop_stale, Job};

#[cfg(windows)]
mod win {
    use super::*;
    use std::os::windows::io::RawHandle;
    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE, WAIT_TIMEOUT};
    use windows_sys::Win32::Storage::FileSystem::SYNCHRONIZE;
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
        SetInformationJobObject, TerminateJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };
    use windows_sys::Win32::System::Threading::{
        OpenProcess, WaitForSingleObject, PROCESS_QUERY_LIMITED_INFORMATION,
    };

    /// A Job Object holding the server's process tree. Dropping it closes the
    /// handle, which kills every process still in the job.
    pub struct Job(HANDLE);

    // SAFETY: a job handle is just a kernel object reference usable from any
    // thread.
    unsafe impl Send for Job {}
    unsafe impl Sync for Job {}

    impl Job {
        pub fn new() -> io::Result<Job> {
            // SAFETY: plain Win32 calls with valid arguments; the handle is
            // closed on every error path.
            unsafe {
                let handle = CreateJobObjectW(std::ptr::null(), std::ptr::null());
                if handle.is_null() {
                    return Err(io::Error::last_os_error());
                }
                let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
                info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                let ok = SetInformationJobObject(
                    handle,
                    JobObjectExtendedLimitInformation,
                    &info as *const _ as *const _,
                    std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
                );
                if ok == 0 {
                    let err = io::Error::last_os_error();
                    CloseHandle(handle);
                    return Err(err);
                }
                Ok(Job(handle))
            }
        }

        /// Put a running process (and so its future children) in the job.
        pub fn assign(&self, process: RawHandle) -> io::Result<()> {
            // SAFETY: `process` is a live process handle owned by the caller.
            if unsafe { AssignProcessToJobObject(self.0, process as HANDLE) } == 0 {
                Err(io::Error::last_os_error())
            } else {
                Ok(())
            }
        }

        /// Kill every process in the job.
        pub fn terminate(&self) -> io::Result<()> {
            // SAFETY: valid job handle.
            if unsafe { TerminateJobObject(self.0, 1) } == 0 {
                Err(io::Error::last_os_error())
            } else {
                Ok(())
            }
        }
    }

    impl Drop for Job {
        fn drop(&mut self) {
            // SAFETY: the handle is owned by this value and closed once.
            unsafe { CloseHandle(self.0) };
        }
    }

    /// Whether the process is still running (it has not been signalled as
    /// exited). A process that cannot be opened is treated as gone.
    pub fn process_alive(pid: u32) -> bool {
        // SAFETY: the opened handle is closed before returning.
        unsafe {
            let handle = OpenProcess(SYNCHRONIZE | PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if handle.is_null() {
                return false;
            }
            let alive = WaitForSingleObject(handle, 0) == WAIT_TIMEOUT;
            CloseHandle(handle);
            alive
        }
    }

    /// Stop a leftover process tree from an earlier session. Windows has no
    /// polite request for a console-less server, so this ends the tree.
    pub fn stop_stale(pid: u32, grace: Duration) -> bool {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        match Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
        {
            Ok(out) if out.status.success() => {}
            Ok(out) => eprintln!(
                "[Backend] taskkill for pid {pid} failed: {}",
                String::from_utf8_lossy(&out.stderr).trim()
            ),
            Err(e) => eprintln!("[Backend] Could not run taskkill: {e}"),
        }
        wait_until(grace, || !process_alive(pid))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recognises_images_in_process_listings() {
        // Linux `ps -o comm=`
        assert!(image_matches("loom-server\n", "loom-server"));
        // macOS `ps -o comm=` prints the full path
        assert!(image_matches(
            "/Applications/Sigilweaver Loom.app/Contents/MacOS/loom-server\n",
            "loom-server"
        ));
        // Windows `tasklist /FO CSV /NH`
        assert!(image_matches(
            "\"loom-server.exe\",\"4242\",\"Console\",\"1\",\"52,000 K\"\r\n",
            "loom-server"
        ));
        // Linux truncates comm to 15 characters
        assert!(image_matches(
            "sigilweaver-loo\n",
            "sigilweaver-loom-studio"
        ));
    }

    #[test]
    fn rejects_other_images() {
        assert!(!image_matches("", "loom-server"));
        assert!(!image_matches("python3\n", "loom-server"));
        assert!(!image_matches("/usr/bin/server\n", "loom-server"));
        assert!(!image_matches("loom-server-extra\n", "loom-server"));
        assert!(!image_matches("short\n", "sigilweaver-loom-studio"));
        assert!(!image_matches(
            "INFO: No tasks are running which match the specified criteria.",
            "loom-server"
        ));
    }

    #[cfg(unix)]
    mod unix {
        use super::super::*;
        use std::os::unix::process::CommandExt;

        /// Spawn `sh -c <script>` as a process-group leader, like the server,
        /// and reap it in the background the way the app's wait task does (an
        /// unreaped leader stays a zombie and keeps its group "alive").
        /// Returns the leader's pid.
        fn spawn_group(script: &str) -> u32 {
            let mut child = Command::new("sh")
                .args(["-c", script])
                .process_group(0)
                .spawn()
                .expect("spawn sh");
            let pid = child.id();
            std::thread::spawn(move || {
                let _ = child.wait();
            });
            pid
        }

        fn read_pid(path: &std::path::Path) -> u32 {
            assert!(wait_until(Duration::from_secs(5), || path.exists()));
            std::thread::sleep(Duration::from_millis(200));
            std::fs::read_to_string(path)
                .unwrap()
                .trim()
                .parse()
                .unwrap()
        }

        #[test]
        fn stop_group_ends_the_grandchild_too() {
            let dir = std::env::temp_dir().join(format!("loom-procs-{}", std::process::id()));
            std::fs::create_dir_all(&dir).unwrap();
            let pidfile = dir.join("grandchild.pid");
            // Like the PyInstaller bootloader: a leader that runs a child.
            let pgid = spawn_group(&format!(
                "sleep 300 & echo $! > {}; wait",
                pidfile.display()
            ));
            let grandchild = read_pid(&pidfile);
            assert!(group_alive(pgid));

            assert!(stop_group(pgid, Duration::from_secs(5)));
            assert!(wait_until(Duration::from_secs(3), || !process_alive(
                grandchild
            )));
            assert!(!group_alive(pgid));
        }

        #[test]
        fn stop_group_escalates_to_sigkill_when_sigterm_is_ignored() {
            // The slow-shutdown case: the group ignores SIGTERM, so the
            // grace period expires and SIGKILL must still take the whole
            // group, including the child the leader would have orphaned.
            let dir = std::env::temp_dir().join(format!("loom-procs-slow-{}", std::process::id()));
            std::fs::create_dir_all(&dir).unwrap();
            let pidfile = dir.join("grandchild.pid");
            let pgid = spawn_group(&format!(
                "trap '' TERM; (trap '' TERM; sleep 300) & echo $! > {}; while true; do sleep 1; done",
                pidfile.display()
            ));
            let grandchild = read_pid(&pidfile);

            let started = Instant::now();
            assert!(stop_group(pgid, Duration::from_secs(1)));
            assert!(started.elapsed() >= Duration::from_secs(1));
            assert!(wait_until(Duration::from_secs(3), || !process_alive(
                grandchild
            )));
        }

        #[test]
        fn stop_stale_handles_a_process_that_leads_no_group() {
            let mut child = Command::new("sleep").arg("300").spawn().unwrap();
            let pid = child.id();
            std::thread::spawn(move || {
                let _ = child.wait();
            });
            assert!(stop_stale(pid, Duration::from_secs(5)));
            assert!(!process_alive(pid));
        }

        #[test]
        fn stopping_a_missing_group_is_not_an_error() {
            // A pid far above anything running.
            assert!(stop_group(4_000_000, Duration::from_millis(200)));
        }
    }
}
