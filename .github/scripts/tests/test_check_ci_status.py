"""Tests for the release CI gate."""

import pytest
from check_ci_status import (
    FAILED,
    MISSING,
    PENDING,
    SUCCESS,
    evaluate_runs,
    wait_for_ci,
)


def run(status="completed", conclusion="success", event="push"):
    return {"status": status, "conclusion": conclusion, "event": event}


IN_PROGRESS = {"status": "in_progress", "conclusion": None, "event": "push"}
QUEUED = {"status": "queued", "conclusion": None, "event": "push"}


class TestEvaluateRuns:
    def test_no_runs_is_missing(self):
        assert evaluate_runs([]) == MISSING

    def test_success(self):
        assert evaluate_runs([run()]) == SUCCESS

    def test_workflow_dispatch_counts(self):
        assert evaluate_runs([run(event="workflow_dispatch")]) == SUCCESS

    def test_pull_request_runs_are_ignored(self):
        assert evaluate_runs([run(event="pull_request")]) == MISSING

    def test_failure(self):
        assert evaluate_runs([run(conclusion="failure")]) == FAILED

    def test_cancelled_is_not_success(self):
        assert evaluate_runs([run(conclusion="cancelled")]) == FAILED

    def test_in_progress_is_pending(self):
        assert evaluate_runs([IN_PROGRESS]) == PENDING

    def test_queued_is_pending(self):
        assert evaluate_runs([QUEUED]) == PENDING

    def test_rerun_success_supersedes_failure(self):
        assert evaluate_runs([run(conclusion="failure"), run()]) == SUCCESS

    def test_success_wins_over_pending(self):
        assert evaluate_runs([IN_PROGRESS, run()]) == SUCCESS

    def test_pending_wins_over_failure(self):
        assert evaluate_runs([run(conclusion="failure"), IN_PROGRESS]) == PENDING


class FakeClock:
    """Deterministic clock: sleeping advances time."""

    def __init__(self):
        self.now = 0.0

    def sleep(self, seconds):
        self.now += seconds

    def __call__(self):
        return self.now


class TestWaitForCi:
    def wait(self, responses, **kwargs):
        """Feed successive poll results; the last one repeats once exhausted."""
        clock = FakeClock()
        remaining = list(responses)
        current = [responses[-1]]

        def fetch():
            if remaining:
                current[0] = remaining.pop(0)
            return current[0]

        params = {"timeout": 100, "interval": 10, "missing_grace": 30}
        params.update(kwargs)
        return wait_for_ci(fetch, sleep=clock.sleep, clock=clock, **params)

    def test_returns_immediately_on_success(self):
        assert self.wait([[run()]]) == SUCCESS

    def test_returns_immediately_on_failure(self):
        assert self.wait([[run(conclusion="failure")]]) == FAILED

    def test_waits_for_pending_run(self):
        assert self.wait([[IN_PROGRESS], [IN_PROGRESS], [run()]]) == SUCCESS

    def test_run_appearing_within_grace(self):
        assert self.wait([[], [], [run()]]) == SUCCESS

    def test_missing_after_grace(self):
        assert self.wait([[]]) == MISSING

    def test_pending_after_timeout(self):
        assert self.wait([[IN_PROGRESS]], timeout=50) == PENDING

    @pytest.mark.parametrize("conclusion", ["failure", "timed_out", "startup_failure"])
    def test_non_success_conclusions_fail(self, conclusion):
        assert self.wait([[run(conclusion=conclusion)]]) == FAILED
