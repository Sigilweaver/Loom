import { describe, it, expect } from "vitest";
import {
  formatBytes,
  formatDateTime,
  formatDuration,
  formatRelativeTime,
  formatTimeUntil,
  pluralize,
} from "./format";

const NOW = new Date("2026-09-28T12:00:00Z");

describe("formatRelativeTime", () => {
  it("collapses very recent times to 'Just now'", () => {
    expect(formatRelativeTime("2026-09-28T11:59:30Z", NOW)).toBe("Just now");
  });

  it("uses minutes, hours and days", () => {
    expect(formatRelativeTime("2026-09-28T11:55:00Z", NOW)).toBe("5m ago");
    expect(formatRelativeTime("2026-09-28T09:00:00Z", NOW)).toBe("3h ago");
    expect(formatRelativeTime("2026-09-26T12:00:00Z", NOW)).toBe("2d ago");
  });

  it("falls back to a date after a week", () => {
    const iso = "2026-09-01T12:00:00Z";
    expect(formatRelativeTime(iso, NOW)).toBe(new Date(iso).toLocaleDateString());
  });
});

describe("formatTimeUntil", () => {
  it("handles missing and past times", () => {
    expect(formatTimeUntil(null, NOW)).toBe("Not scheduled");
    expect(formatTimeUntil("2026-09-28T11:00:00Z", NOW)).toBe("Overdue");
  });

  it("uses minutes, hours and days", () => {
    expect(formatTimeUntil("2026-09-28T12:10:00Z", NOW)).toBe("in 10m");
    expect(formatTimeUntil("2026-09-28T15:00:00Z", NOW)).toBe("in 3h");
    expect(formatTimeUntil("2026-09-30T12:00:00Z", NOW)).toBe("in 2d");
  });
});

describe("formatDuration", () => {
  it("shows a dash when there is no duration", () => {
    expect(formatDuration(null)).toBe("-");
    expect(formatDuration(undefined)).toBe("-");
  });

  it("formats seconds and minutes", () => {
    expect(formatDuration(12.34)).toBe("12.3s");
    expect(formatDuration(258)).toBe("4m 18s");
  });
});

describe("formatDateTime", () => {
  it("returns a dash for empty values", () => {
    expect(formatDateTime(null)).toBe("-");
    expect(formatDateTime("")).toBe("-");
  });

  it("formats a valid ISO string", () => {
    expect(formatDateTime("2026-09-28T12:00:00Z")).toMatch(/2026/);
  });
});

describe("pluralize", () => {
  it("only pluralises when the count is not one", () => {
    expect(pluralize(1, "member")).toBe("1 member");
    expect(pluralize(0, "member")).toBe("0 members");
    expect(pluralize(2, "person", "people")).toBe("2 people");
  });
});

describe("formatBytes", () => {
  it("scales units", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});
