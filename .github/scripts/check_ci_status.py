#!/usr/bin/env python3
"""
Gate a release on a passing CI run for the tagged commit.

Looks up runs of the CI workflow (ci.yml) for a commit SHA through the GitHub
API (via the `gh` CLI) and exits 0 only when one of them succeeded. While a run
is still queued or in progress the script polls, so a tag pushed right behind a
merge to main waits for CI instead of failing.

Only `push` and `workflow_dispatch` runs count. A `pull_request` run tests a
synthetic merge commit rather than the commit that ends up tagged.

CI ignores documentation-only pushes (see paths-ignore in ci.yml), so a tagged
commit that only touched markdown or docs has no run of its own. In that case,
or after a run was cancelled by a newer push, start CI by hand for the commit
(Actions > CI > Run workflow on main), then re-run the release workflow.

Usage:
    check_ci_status.py --repo Sigilweaver/Loom --sha <commit>
"""

import argparse
import json
import subprocess
import sys
import time
from collections.abc import Callable, Iterable
from typing import Any

WORKFLOW_FILE = "ci.yml"
COUNTED_EVENTS = {"push", "workflow_dispatch"}
PENDING_STATUSES = {"queued", "in_progress", "waiting", "requested", "pending"}

SUCCESS = "success"
PENDING = "pending"
FAILED = "failed"
MISSING = "missing"


def evaluate_runs(runs: Iterable[dict[str, Any]]) -> str:
    """
    Reduce a list of workflow runs for one commit to a single verdict.

    Precedence: any successful run wins (a re-run that passed supersedes an
    earlier failure), then any run still in flight, then a completed run that
    did not succeed, otherwise no counted run exists.
    """
    counted = [r for r in runs if r.get("event") in COUNTED_EVENTS]
    if not counted:
        return MISSING

    if any(r.get("status") == "completed" and r.get("conclusion") == "success" for r in counted):
        return SUCCESS
    if any(r.get("status") in PENDING_STATUSES for r in counted):
        return PENDING
    return FAILED


def fetch_runs(repo: str, sha: str) -> list[dict[str, Any]]:
    """Fetch CI workflow runs for a commit using the gh CLI."""
    endpoint = f"repos/{repo}/actions/workflows/{WORKFLOW_FILE}/runs?head_sha={sha}&per_page=100"
    result = subprocess.run(
        ["gh", "api", endpoint],
        capture_output=True,
        text=True,
        check=True,
    )
    return list(json.loads(result.stdout).get("workflow_runs", []))


def wait_for_ci(
    fetch: Callable[[], list[dict[str, Any]]],
    *,
    timeout: float,
    interval: float,
    missing_grace: float,
    sleep: Callable[[float], None] = time.sleep,
    clock: Callable[[], float] = time.monotonic,
) -> str:
    """
    Poll until CI has a final verdict or the timeout expires.

    A commit with no counted run yet gets `missing_grace` seconds for the run to
    be registered before the verdict is MISSING. A run that is still pending when
    the timeout expires yields PENDING.
    """
    start = clock()
    while True:
        verdict = evaluate_runs(fetch())
        elapsed = clock() - start

        if verdict in (SUCCESS, FAILED):
            return verdict
        if verdict == MISSING and elapsed >= missing_grace:
            return MISSING
        if elapsed >= timeout:
            return verdict

        sleep(interval)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--repo", required=True, help="owner/name")
    parser.add_argument("--sha", required=True, help="commit SHA that is being released")
    parser.add_argument("--timeout", type=float, default=45 * 60, help="max seconds to wait")
    parser.add_argument("--interval", type=float, default=30, help="seconds between polls")
    parser.add_argument(
        "--missing-grace",
        type=float,
        default=120,
        help="seconds to wait for a run to appear before treating CI as missing",
    )
    args = parser.parse_args()

    try:
        verdict = wait_for_ci(
            lambda: fetch_runs(args.repo, args.sha),
            timeout=args.timeout,
            interval=args.interval,
            missing_grace=args.missing_grace,
        )
    except subprocess.CalledProcessError as exc:
        print(f"::error::Could not query CI runs: {exc.stderr or exc}", file=sys.stderr)
        return 1

    if verdict == SUCCESS:
        print(f"CI passed for {args.sha}")
        return 0

    messages = {
        PENDING: f"CI for {args.sha} did not finish within {args.timeout:.0f}s.",
        FAILED: f"CI did not pass for {args.sha}.",
        MISSING: (
            f"No CI run found for {args.sha}. CI skips documentation-only pushes; "
            "start it manually (Actions > CI > Run workflow on main), then re-run this workflow."
        ),
    }
    print(f"::error::{messages[verdict]}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
