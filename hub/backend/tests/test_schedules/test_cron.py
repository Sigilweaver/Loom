"""User cron syntax must retain Sunday-based numbering at every entry point."""

from datetime import UTC, datetime, timedelta

import pytest

from app.domain.schedules.cron import cron_trigger
from tests.conftest import make_workflow_content, new_client


@pytest.mark.parametrize(
    ("weekday", "expected"),
    [
        ("0", {0}),
        ("7", {0}),
        ("1", {1}),
        ("SUN,mon", {0, 1}),
        ("1-5", {1, 2, 3, 4, 5}),
        ("mon-fri", {1, 2, 3, 4, 5}),
        ("fri-sun", {0, 5, 6}),
        ("*/2", {0, 2, 4, 6}),
        ("1-5/2", {1, 3, 5}),
        ("mon-fri/2", {1, 3, 5}),
        ("5-7/2", {0, 5}),
    ],
)
def test_weekday_occurrences_in_a_known_week(weekday, expected):
    start = datetime(2026, 9, 27, tzinfo=UTC)  # Sunday
    end = start + timedelta(days=7)
    trigger = cron_trigger(f"0 9 * * {weekday}", "UTC")
    fire = trigger.get_next_fire_time(None, start)
    actual = set()
    while fire < end:
        actual.add(fire.isoweekday() % 7)
        fire = trigger.get_next_fire_time(fire, fire + timedelta(seconds=1))
    assert actual == expected


@pytest.fixture
async def api_schedule(user_headers, test_server):
    async with new_client() as client:
        upload = await client.post(
            "/api/v1/workflows",
            headers=user_headers,
            files={"file": ("test.swwf", make_workflow_content(), "application/octet-stream")},
            data={"folder_path": "/", "tags": ""},
        )
        assert upload.status_code == 201
        payload = {
            "workflow_id": upload.json()["id"],
            "target_server_id": test_server["id"],
            "cron_expression": "0 9 * * sun",
        }
        response = await client.post("/api/v1/schedules", headers=user_headers, json=payload)
        assert response.status_code == 201
        yield payload, response.json()["id"]


@pytest.mark.asyncio
@pytest.mark.parametrize("expression", ["0 9 * * 7", "0 9 * * MON-FRI/2"])
async def test_api_create_and_update_accept_user_weekdays(api_schedule, user_headers, expression):
    payload, schedule_id = api_schedule
    async with new_client() as client:
        created = await client.post(
            "/api/v1/schedules", headers=user_headers,
            json={**payload, "cron_expression": expression},
        )
        updated = await client.put(
            f"/api/v1/schedules/{schedule_id}", headers=user_headers,
            json={"cron_expression": expression},
        )
    assert created.status_code == 201
    assert updated.status_code == 200
    assert created.json()["cron_expression"] == expression
    assert updated.json()["cron_expression"] == expression


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "changes",
    [
        {"cron_expression": "0 9 * * 8"},
        {"cron_expression": "0 9 * * 5-1"},
        {"cron_expression": "0 9 * * */0"},
        {"cron_expression": "99 9 * * 0"},
        {"cron_expression": "0 9 * * 0 extra"},
        {"timezone": "Not/AZone"},
    ],
)
async def test_api_create_and_update_reject_invalid_cron(api_schedule, user_headers, changes):
    payload, schedule_id = api_schedule
    async with new_client() as client:
        created = await client.post(
            "/api/v1/schedules", headers=user_headers, json={**payload, **changes},
        )
        updated = await client.put(
            f"/api/v1/schedules/{schedule_id}", headers=user_headers, json=changes,
        )
    assert created.status_code == 400
    assert updated.status_code == 400


@pytest.mark.asyncio
@pytest.mark.parametrize("field", ["cron_expression", "timezone", "enabled"])
async def test_api_update_rejects_null_required_fields(api_schedule, user_headers, field):
    _, schedule_id = api_schedule
    async with new_client() as client:
        response = await client.put(
            f"/api/v1/schedules/{schedule_id}", headers=user_headers, json={field: None},
        )
    assert response.status_code == 400


@pytest.mark.asyncio
@pytest.mark.parametrize("field", ["cron_expression", "timezone"])
async def test_api_create_and_update_reject_empty_fields(api_schedule, user_headers, field):
    payload, schedule_id = api_schedule
    async with new_client() as client:
        created = await client.post(
            "/api/v1/schedules", headers=user_headers, json={**payload, field: ""},
        )
        updated = await client.put(
            f"/api/v1/schedules/{schedule_id}", headers=user_headers, json={field: ""},
        )
    assert created.status_code == 422
    assert updated.status_code == 422
