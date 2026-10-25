#!/usr/bin/env python3
"""
Launch smoke test for the Studio desktop app.

Starts a Studio binary, waits for it to report that it is up, and checks how it
shuts down and recovers. CI runs it against each build as installed (AppImage,
deb in a container, the .app from the dmg, the NSIS install); run it locally
against `studio/tauri/target/<triple>/release/sigilweaver-loom-studio` after
`scripts/build.py`.

Checks (pick with --check, repeatable; default: basic):

  basic            Launch, wait for readiness, stop with SIGTERM (window close
                   on Windows), and confirm the server port is released.
                   Full build: readiness is "Health check passed" (the sidecar
                   was found, started and answered the authenticated probe).
                   Client build (--client): the app logs it has no server.
  kill             Force-quit the app. Unix: the server survives and the next
                   launch must find and stop it, then start cleanly. Windows:
                   the job object must take the server down with the app.
  second-instance  Launch a second copy while the first runs. The second must
                   exit, the first must keep its server, and the first's server
                   must not be restarted.
  slow-shutdown    (Linux, Full build) Hold an authenticated request open on
                   the server, then stop the app. The server cannot finish the
                   request, so shutdown has to escalate; afterwards nothing may
                   hold the port and the next launch must work.

The app needs a display. On Linux without one, run under `xvfb-run -a`.

Usage:
    python3 scripts/smoke_desktop.py --app <binary>
    python3 scripts/smoke_desktop.py --app <binary> --client
    python3 scripts/smoke_desktop.py --app <binary> --check kill --check second-instance
"""

import argparse
import os
import signal
import socket
import subprocess
import sys
import threading
import time

PORT = 25811


def port_open() -> bool:
    try:
        with socket.create_connection(("127.0.0.1", PORT), timeout=0.5):
            return True
    except OSError:
        return False


def wait_for(predicate, timeout: float, interval: float = 0.25) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return True
        time.sleep(interval)
    return predicate()


class App:
    """One running copy of the app, with its output captured."""

    def __init__(self, path: str, tag: str):
        self.tag = tag
        self.lines: list[str] = []
        kwargs = {}
        if sys.platform != "win32":
            # Own session, so signals reach wrappers such as the AppImage
            # runtime as well as the app, but never the server (which is
            # deliberately in a group of its own).
            kwargs["start_new_session"] = True
        self.proc = subprocess.Popen(
            [path],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            errors="replace",
            env={**os.environ, "RUST_BACKTRACE": "1"},
            **kwargs,
        )
        self.reader = threading.Thread(target=self._pump, daemon=True)
        self.reader.start()

    def _pump(self) -> None:
        assert self.proc.stdout is not None
        for line in self.proc.stdout:
            self.lines.append(line.rstrip())
            print(f"[{self.tag}] {line.rstrip()}", flush=True)

    def saw(self, text: str) -> bool:
        return any(text in line for line in self.lines)

    def running(self) -> bool:
        return self.proc.poll() is None

    def wait_ready(self, marker: str, timeout: float) -> bool:
        wait_for(lambda: self.saw(marker) or not self.running(), timeout)
        if not self.running():
            print(f"FAIL: {self.tag} exited early with code {self.proc.returncode}")
            return False
        if not self.saw(marker):
            print(f"FAIL: {self.tag} did not log '{marker}' within {timeout:.0f}s")
            return False
        return True

    def stop(self, how: str, timeout: float = 40) -> float:
        """Stop the app; returns how long it took to exit."""
        started = time.monotonic()
        if not self.running():
            return 0.0
        if how == "kill":
            if sys.platform == "win32":
                self.proc.kill()
            else:
                os.killpg(self.proc.pid, signal.SIGKILL)
        elif sys.platform == "win32":
            # Close the main window, as a user would. A GUI process has no
            # console to receive a signal.
            subprocess.run(
                [
                    "powershell",
                    "-NoProfile",
                    "-Command",
                    f"(Get-Process -Id {self.proc.pid}).CloseMainWindow() | Out-Null",
                ],
                capture_output=True,
                check=False,
            )
        else:
            os.killpg(self.proc.pid, signal.SIGTERM)
        try:
            self.proc.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            print(f"WARN: {self.tag} did not exit within {timeout:.0f}s; killing it")
            self.proc.kill()
            self.proc.wait()
        self.reader.join(timeout=5)
        return time.monotonic() - started


def ready_marker(args) -> str:
    return "no bundled server" if args.client else "Health check passed"


def start_ready(args, tag: str) -> App | None:
    app = App(args.app, tag)
    if not app.wait_ready(ready_marker(args), args.timeout):
        app.stop("term")
        return None
    listening = port_open()
    if args.client and listening:
        print(f"FAIL: Client build but something listens on port {PORT}")
        app.stop("term")
        return None
    if not args.client and not listening:
        print(f"FAIL: Full build but nothing listens on port {PORT}")
        app.stop("term")
        return None
    print(f"OK: {tag} is ready, port {PORT} {'is' if listening else 'is not'} listening")
    return app


def port_released(args, label: str, timeout: float = 15) -> bool:
    if args.client:
        return True
    if wait_for(lambda: not port_open(), timeout):
        print(f"OK: port {PORT} released ({label})")
        return True
    print(f"FAIL: port {PORT} still bound ({label}); the server was orphaned")
    return False


# -- checks -----------------------------------------------------------------


def check_basic(args) -> bool:
    app = start_ready(args, "app")
    if app is None:
        return False
    time.sleep(2)  # let the window settle so shutdown hits a fully started app
    app.stop("term")
    return port_released(args, "after a normal stop")


def check_kill(args) -> bool:
    app = start_ready(args, "app")
    if app is None:
        return False
    time.sleep(2)
    app.stop("kill")
    if args.client:
        return True
    if sys.platform == "win32":
        # The job object ends the server with the app.
        return port_released(args, "after a force-quit (job object)")

    if not port_open():
        print("OK: no server was left behind by the force-quit")
        return True
    print("OK: server survived the force-quit, as expected; relaunching")
    again = start_ready(args, "relaunch")
    if again is None:
        return False
    ok = True
    if again.saw("left over from an earlier session") or again.saw(
        "Stopping the server holding port"
    ):
        print("OK: the leftover server was found and stopped")
    else:
        print("FAIL: the leftover server was not detected")
        ok = False
    again.stop("term")
    return port_released(args, "after the relaunch stopped") and ok


def check_second_instance(args) -> bool:
    first = start_ready(args, "first")
    if first is None:
        return False
    second = App(args.app, "second")
    exited = wait_for(lambda: not second.running(), 30)
    ok = True
    if not exited:
        print("FAIL: the second launch did not exit")
        second.stop("term")
        ok = False
    else:
        print(f"OK: the second launch exited (code {second.proc.returncode})")
    time.sleep(1)
    if not first.running():
        print("FAIL: the first instance died when a second was launched")
        return False
    if not args.client and not port_open():
        print("FAIL: the first instance's server was stopped by the second launch")
        ok = False
    elif not args.client:
        print("OK: the first instance's server is still listening")
    if any("Stopping" in line and "leftover" in line.lower() for line in second.lines):
        print("FAIL: the second launch tried to stop a server")
        ok = False
    if first.saw("Starting bundled server") and sum(
        "Starting bundled server" in line for line in first.lines
    ) > 1:
        print("FAIL: the first instance restarted its server")
        ok = False
    first.stop("term")
    return port_released(args, "after stopping the first instance") and ok


def server_token() -> str | None:
    """SESSION_TOKEN of the running server, read from its environment
    (Linux only; the token is otherwise private to the app)."""
    for name in os.listdir("/proc"):
        if not name.isdigit():
            continue
        try:
            with open(f"/proc/{name}/comm") as f:
                if f.read().strip() != "loom-server":
                    continue
            with open(f"/proc/{name}/environ", "rb") as f:
                for item in f.read().split(b"\0"):
                    if item.startswith(b"SESSION_TOKEN="):
                        return item.split(b"=", 1)[1].decode()
        except OSError:
            continue
    return None


def check_slow_shutdown(args) -> bool:
    if args.client or not sys.platform.startswith("linux"):
        print("SKIP: slow-shutdown needs a Full build on Linux")
        return True
    app = start_ready(args, "app")
    if app is None:
        return False
    token = server_token()
    if not token:
        print("FAIL: could not read the server token from /proc")
        app.stop("term")
        return False

    # An authenticated POST that promises a large body and sends a sliver: the
    # server's handler waits for the rest, so it has an in-flight request that
    # a graceful shutdown cannot finish.
    sock = socket.create_connection(("127.0.0.1", PORT), timeout=5)
    sock.sendall(
        (
            "POST /api/workflow/execute HTTP/1.1\r\n"
            f"Host: 127.0.0.1:{PORT}\r\n"
            f"Authorization: Bearer {token}\r\n"
            "Content-Type: application/json\r\n"
            "Content-Length: 1000000\r\n\r\n"
            '{"workflow":'
        ).encode()
    )
    time.sleep(1)
    print("OK: holding an in-flight request open on the server")

    elapsed = app.stop("term", timeout=60)
    sock.close()
    print(f"OK: the app took {elapsed:.1f}s to exit with the request in flight")
    ok = port_released(args, "after shutdown with a request in flight", timeout=10)
    if not ok:
        subprocess.run(["pkill", "-x", "loom-server"], check=False)
        return False

    again = start_ready(args, "relaunch")
    if again is None:
        return False
    again.stop("term")
    return port_released(args, "after the relaunch stopped") and ok


CHECKS = {
    "basic": check_basic,
    "kill": check_kill,
    "second-instance": check_second_instance,
    "slow-shutdown": check_slow_shutdown,
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--app", required=True, help="Path to the Studio binary")
    parser.add_argument(
        "--client", action="store_true", help="Expect a Client build (no server)"
    )
    parser.add_argument(
        "--check",
        action="append",
        choices=sorted(CHECKS),
        help="Check to run (repeatable; default: basic)",
    )
    parser.add_argument(
        "--timeout", type=float, default=60, help="Seconds to wait for startup"
    )
    args = parser.parse_args()

    ok = True
    for name in args.check or ["basic"]:
        print(f"\n=== {name} ===", flush=True)
        if port_open():
            print(f"FAIL: port {PORT} is already in use before '{name}'")
            return 1
        result = CHECKS[name](args)
        print(f"--- {name}: {'PASS' if result else 'FAIL'}", flush=True)
        ok = ok and result
        if not result:
            break

    print("PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
