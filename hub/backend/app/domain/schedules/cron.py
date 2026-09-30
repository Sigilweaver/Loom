"""Translate user cron weekdays to APScheduler without changing user numbering."""

from datetime import datetime
from zoneinfo import ZoneInfoNotFoundError

from apscheduler.triggers.cron import CronTrigger

_WEEKDAYS = ("sun", "mon", "tue", "wed", "thu", "fri", "sat")


def _weekday_number(value: str) -> int:
    if value in _WEEKDAYS:
        return _WEEKDAYS.index(value)
    number = int(value)
    if not 0 <= number <= 7:
        raise ValueError("Cron weekday must be between 0 and 7")
    return number


def _weekday_names(expression: str) -> str:
    """Expand lists/ranges/steps before mapping Sunday 0/7 to symbolic names."""
    days: set[int] = set()
    for item in expression.lower().split(","):
        parts = item.split("/")
        if len(parts) > 2:
            raise ValueError("Invalid cron weekday step")
        step = int(parts[1]) if len(parts) == 2 else 1
        if step < 1:
            raise ValueError("Cron weekday step must be positive")
        base = parts[0]
        if base == "*":
            start, end = 0, 6
        elif "-" in base:
            first, last = base.split("-", 1)
            start, end = _weekday_number(first), _weekday_number(last)
            if last == "sun" and start > 0:
                end = 7
        else:
            start = _weekday_number(base)
            end = 7 if len(parts) == 2 else start
        if start > end:
            raise ValueError("Cron weekday range must be ascending")
        days.update(day % 7 for day in range(start, end + 1, step))
    return ",".join(_WEEKDAYS[day] for day in sorted(days))


def cron_trigger(
    expression: str,
    timezone: str,
    start_at: datetime | None = None,
) -> CronTrigger:
    """Validate five fields and build a trigger using standard cron weekdays."""
    parts = expression.split()
    if len(parts) != 5:
        raise ValueError(f"Expected 5 fields, got {len(parts)}")
    try:
        return CronTrigger(
            minute=parts[0],
            hour=parts[1],
            day=parts[2],
            month=parts[3],
            day_of_week=_weekday_names(parts[4]),
            timezone=timezone,
            start_date=start_at,
        )
    except ZoneInfoNotFoundError as exc:
        raise ValueError(f"Unknown schedule timezone: {timezone}") from exc
