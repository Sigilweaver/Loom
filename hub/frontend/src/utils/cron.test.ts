import { describe, it, expect } from "vitest";
import {
  DEFAULT_PARTS,
  buildCron,
  describeSchedule,
  formatHour,
  looksLikeCron,
  parseCron,
  type ScheduleParts,
} from "./cron";

describe("parseCron", () => {
  it("recognises every-N-minutes", () => {
    expect(parseCron("*/15 * * * *")).toMatchObject({ frequency: "minutes", interval: 15 });
  });

  it("recognises hourly at a minute", () => {
    expect(parseCron("30 * * * *")).toMatchObject({ frequency: "hourly", minute: 30 });
  });

  it("recognises daily, weekly and monthly schedules", () => {
    expect(parseCron("0 6 * * *")).toMatchObject({ frequency: "daily", hour: 6, minute: 0 });
    expect(parseCron("45 18 * * 5")).toMatchObject({ frequency: "weekly", hour: 18, minute: 45, weekday: 5 });
    expect(parseCron("0 0 15 * *")).toMatchObject({ frequency: "monthly", monthDay: 15 });
  });

  it("keeps midnight and Sunday instead of treating zero as missing", () => {
    expect(parseCron("0 0 * * *")).toMatchObject({ frequency: "daily", hour: 0, minute: 0 });
    expect(parseCron("0 0 * * 0")).toMatchObject({ frequency: "weekly", hour: 0, weekday: 0 });
    expect(buildCron(parseCron("0 0 * * 0"))).toBe("0 0 * * 0");
  });

  it("falls back to the default schedule for malformed input", () => {
    expect(parseCron("")).toEqual(DEFAULT_PARTS);
    expect(parseCron("not a cron")).toEqual(DEFAULT_PARTS);
    expect(parseCron("* * * *")).toEqual(DEFAULT_PARTS);
  });
});

describe("buildCron", () => {
  const base: ScheduleParts = { ...DEFAULT_PARTS, hour: 7, minute: 5, weekday: 3, monthDay: 12, interval: 10 };

  it("builds each frequency", () => {
    expect(buildCron({ ...base, frequency: "minutes" })).toBe("*/10 * * * *");
    expect(buildCron({ ...base, frequency: "hourly" })).toBe("5 * * * *");
    expect(buildCron({ ...base, frequency: "daily" })).toBe("5 7 * * *");
    expect(buildCron({ ...base, frequency: "weekly" })).toBe("5 7 * * 3");
    expect(buildCron({ ...base, frequency: "monthly" })).toBe("5 7 12 * *");
  });

  it("round-trips through parseCron", () => {
    for (const cron of ["*/5 * * * *", "20 * * * *", "0 9 * * *", "30 8 * * 1", "0 0 1 * *"]) {
      expect(buildCron(parseCron(cron))).toBe(cron);
    }
  });
});

describe("describeSchedule", () => {
  it("describes schedules in plain language", () => {
    expect(describeSchedule({ ...DEFAULT_PARTS, frequency: "minutes", interval: 1 })).toBe("Every 1 minute");
    expect(describeSchedule({ ...DEFAULT_PARTS, frequency: "minutes", interval: 5 })).toBe("Every 5 minutes");
    expect(describeSchedule({ ...DEFAULT_PARTS, frequency: "hourly", minute: 5 })).toBe("Every hour at :05");
    expect(describeSchedule({ ...DEFAULT_PARTS, frequency: "daily", hour: 15 })).toBe("Every day at 3:00 PM");
    expect(describeSchedule({ ...DEFAULT_PARTS, frequency: "weekly", weekday: 1, hour: 9 })).toBe(
      "Every Monday at 9:00 AM"
    );
    expect(describeSchedule({ ...DEFAULT_PARTS, frequency: "monthly", monthDay: 3, hour: 0 })).toBe(
      "On day 3 of every month at 12:00 AM"
    );
  });
});

describe("formatHour and looksLikeCron", () => {
  it("formats midnight and noon", () => {
    expect(formatHour(0)).toBe("12:00 AM");
    expect(formatHour(12)).toBe("12:00 PM");
    expect(formatHour(23)).toBe("11:00 PM");
  });

  it("checks for five fields", () => {
    expect(looksLikeCron("0 9 * * *")).toBe(true);
    expect(looksLikeCron("0 9 * *")).toBe(false);
  });
});
