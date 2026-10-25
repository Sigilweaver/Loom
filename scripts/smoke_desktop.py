#!/usr/bin/env python3
"""
Launch smoke test for the Studio desktop app.

Starts a built Studio binary, waits for it to report that it is up, then checks
how it shuts down. This is what CI runs on each OS against a freshly built
app, and what to run locally after `scripts/build.py`.

Full build (bundled server):
  - the app logs "Health check passed", meaning the sidecar was found, started
    and answered the authenticated health probe
  - the server is listening on 127.0.0.1:25811
  - after the app is stopped, nothing is left listening on that port
  - with --stop kill, the app is force-quit first; the server survives, and
    the next launch must stop that leftover server and start cleanly

Client build (--client): the app logs that it has no bundled server and
nothing listens on the port.

The app needs a display. On Linux without one, run under `xvfb-run -a`.

Usage:
    python3 scripts/smoke_desktop.py --app studio/tauri/target/release/sigilweaver-loom-studio
    python3 scripts/smoke_desktop.py --app <binary> --client
    python3 scripts/smoke_desktop.py --app <binary> --stop kill   # force-quit
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


def stop_app(proc: subprocess.Popen, how: str) -> None:
    """Stop the app the way a user, a shutdown or a crash would."""
    if how == "kill":
        proc.kill()
    elif sys.platform == "win32":
        # Closest to a graceful close for a console-less GUI process.
        subprocess.run(
            ["taskkill", "/PID", str(proc.pid), "/T"],
            capture_output=True,
            check=False,
        )
    else:
        proc.send_signal(signal.SIGTERM)
    try:
        proc.wait(timeout=20)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait()


def launch(args: argparse.Namespace, stop: str, expect_leftover: bool = False) -> bool:
    """Start the app once, check it, stop it with `stop`. Returns success."""
    lines: list[str] = []
    proc = subprocess.Popen(
        [args.app],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        errors="replace",
        env={**os.environ, "RUST_BACKTRACE": "1"},
    )

    def pump() -> None:
        assert proc.stdout is not None
        for line in proc.stdout:
            lines.append(line.rstrip())
            print(f"[app] {line.rstrip()}", flush=True)

    reader = threading.Thread(target=pump, daemon=True)
    reader.start()

    def saw(text: str) -> bool:
        return any(text in line for line in lines)

    ok = True
    ready_marker = "no bundled server" if args.client else "Health check passed"
    started = wait_for(lambda: saw(ready_marker) or proc.poll() is not None, args.timeout)
    if proc.poll() is not None:
        print(f"FAIL: app exited early with code {proc.returncode}")
        ok = False
    elif not started or not saw(ready_marker):
        print(f"FAIL: did not see '{ready_marker}' within {args.timeout:.0f}s")
        ok = False
    else:
        print(f"OK: app reported '{ready_marker}'")
        listening = port_open()
        if args.client and listening:
            print(f"FAIL: Client build but something listens on port {PORT}")
            ok = False
        elif not args.client and not listening:
            print(f"FAIL: Full build but nothing listens on port {PORT}")
            ok = False
        else:
            print(f"OK: port {PORT} {'is' if listening else 'is not'} listening")
        if expect_leftover:
            if saw("left over from an earlier session"):
                print("OK: stopped the server left by the force-quit session")
            else:
                print("FAIL: the leftover server was not detected and stopped")
                ok = False

    if proc.poll() is None:
        # Let the window settle so shutdown exercises a fully started app.
        time.sleep(2)
        stop_app(proc, stop)
        reader.join(timeout=5)

    return ok


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--app", required=True, help="Path to the Studio binary")
    parser.add_argument("--client", action="store_true", help="Expect a Client build (no server)")
    parser.add_argument(
        "--stop",
        choices=["term", "kill"],
        default="term",
        help=(
            "How to stop the app: term (graceful signal) or kill (force-quit, "
            "then relaunch to check the leftover server is cleaned up)"
        ),
    )
    parser.add_argument("--timeout", type=float, default=60, help="Seconds to wait for startup")
    args = parser.parse_args()

    if port_open():
        print(f"FAIL: port {PORT} is already in use before launch")
        return 1

    ok = launch(args, args.stop)

    if args.stop == "kill" and not args.client:
        # A force-quit cannot run the app's exit handlers, so the server is
        # expected to survive. The next launch must find and stop it.
        if ok and port_open():
            print("OK: server survived the force-quit, as expected; relaunching")
            ok = launch(args, "term", expect_leftover=True)
        elif ok:
            print("OK: no server was left behind by the force-quit")

    if not args.client:
        freed = wait_for(lambda: not port_open(), 10)
        if freed:
            print(f"OK: port {PORT} released at the end")
        else:
            print(f"FAIL: port {PORT} still bound at the end; the server was orphaned")
            ok = False

    print("PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
