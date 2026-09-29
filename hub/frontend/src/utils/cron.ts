/**
 * Friendly schedule <-> cron expression conversion.
 *
 * The schedule builder lets people pick "every day at 9:00 AM" and turns it
 * into a five-field cron expression (minute hour day-of-month month weekday).
 * Only the shapes the builder can produce are understood when parsing; any
 * other expression falls back to a daily schedule so the builder still opens.
 */

export type Frequency = "minutes" | "hourly" | "daily" | "weekly" | "monthly";

export interface ScheduleParts {
  frequency: Frequency;
  /** Minutes between runs (frequency "minutes"). */
  interval: number;
  hour: number;
  minute: number;
  /** 0 = Sunday. */
  weekday: number;
  /** 1-28. */
  monthDay: number;
}

export const FREQUENCIES: Frequency[] = ["minutes", "hourly", "daily", "weekly", "monthly"];

export const WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export const DEFAULT_PARTS: ScheduleParts = {
  frequency: "daily",
  interval: 1,
  hour: 9,
  minute: 0,
  weekday: 1,
  monthDay: 1,
};

/** "9:00 AM" style label for an hour of the day (0-23). */
export function formatHour(hour: number): string {
  if (hour === 0) return "12:00 AM";
  if (hour === 12) return "12:00 PM";
  if (hour < 12) return `${hour}:00 AM`;
  return `${hour - 12}:00 PM`;
}

/** True when the text has the five whitespace-separated fields of a cron expression. */
export function looksLikeCron(cron: string): boolean {
  return cron.trim().split(/\s+/).length === 5;
}

export function parseCron(cron: string): ScheduleParts {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) return { ...DEFAULT_PARTS };

  const [minuteField, hourField, dayField, , weekdayField] = fields;
  // Zero is meaningful here (midnight, Sunday, minute 0), so only NaN falls back.
  const num = (value: string | undefined, fallback: number) => {
    const parsed = parseInt(value ?? "", 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  };

  // Every N minutes
  if (minuteField?.startsWith("*/") && hourField === "*") {
    return { ...DEFAULT_PARTS, frequency: "minutes", interval: num(minuteField.slice(2), 5), hour: 0 };
  }

  // Hourly, at a given minute
  if (hourField === "*" && dayField === "*" && weekdayField === "*") {
    return { ...DEFAULT_PARTS, frequency: "hourly", hour: 0, minute: num(minuteField, 0) };
  }

  const time = { hour: num(hourField, 9), minute: num(minuteField, 0) };

  // Weekly: a weekday and a time
  if (dayField === "*" && weekdayField !== "*") {
    return { ...DEFAULT_PARTS, ...time, frequency: "weekly", weekday: num(weekdayField, 1) };
  }

  // Monthly: a day of the month and a time
  if (dayField !== "*" && weekdayField === "*") {
    return { ...DEFAULT_PARTS, ...time, frequency: "monthly", monthDay: num(dayField, 1) };
  }

  return { ...DEFAULT_PARTS, ...time, frequency: "daily" };
}

export function buildCron(parts: ScheduleParts): string {
  const { frequency, interval, hour, minute, weekday, monthDay } = parts;
  switch (frequency) {
    case "minutes":
      return `*/${interval} * * * *`;
    case "hourly":
      return `${minute} * * * *`;
    case "daily":
      return `${minute} ${hour} * * *`;
    case "weekly":
      return `${minute} ${hour} * * ${weekday}`;
    case "monthly":
      return `${minute} ${hour} ${monthDay} * *`;
  }
}

/** Plain-language summary, e.g. "Every Monday at 9:00 AM". */
export function describeSchedule(parts: ScheduleParts): string {
  const { frequency, interval, hour, minute, weekday, monthDay } = parts;
  const time = formatHour(hour);
  switch (frequency) {
    case "minutes":
      return `Every ${interval} minute${interval > 1 ? "s" : ""}`;
    case "hourly":
      return `Every hour at :${minute.toString().padStart(2, "0")}`;
    case "daily":
      return `Every day at ${time}`;
    case "weekly":
      return `Every ${WEEKDAYS[weekday]?.label ?? "Monday"} at ${time}`;
    case "monthly":
      return `On day ${monthDay} of every month at ${time}`;
  }
}
