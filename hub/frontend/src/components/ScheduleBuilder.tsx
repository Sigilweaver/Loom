/**
 * ScheduleBuilder - User-friendly scheduling interface
 *
 * Provides intuitive scheduling options for business users while
 * generating valid cron expressions under the hood. Advanced users
 * can toggle to see/edit the raw cron expression.
 */

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

type FrequencyType = "minutes" | "hourly" | "daily" | "weekly" | "monthly";

interface ScheduleBuilderProps {
  /** Cron expression value */
  value: string;
  /** Called when cron expression changes */
  onChange: (value: string) => void;
}

// Days of the week for weekly scheduling
const WEEKDAYS = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];

// Generate hour options (12-hour format for display)
function formatHour(hour: number): string {
  if (hour === 0) return "12:00 AM";
  if (hour === 12) return "12:00 PM";
  if (hour < 12) return `${hour}:00 AM`;
  return `${hour - 12}:00 PM`;
}

/**
 * Parse a cron expression into structured schedule data
 */
function parseCron(cron: string): {
  frequency: FrequencyType;
  interval: number;
  hour: number;
  minute: number;
  weekday: number;
  monthDay: number;
} {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    return { frequency: "daily", interval: 1, hour: 9, minute: 0, weekday: 1, monthDay: 1 };
  }

  const [minute, hour, day, , weekday] = parts;

  // Every X minutes
  if (minute?.startsWith("*/") && hour === "*") {
    const interval = parseInt(minute.slice(2)) || 5;
    return { frequency: "minutes", interval, hour: 0, minute: 0, weekday: 1, monthDay: 1 };
  }

  // Hourly (at specific minute)
  if (hour === "*" && day === "*" && weekday === "*") {
    return {
      frequency: "hourly",
      interval: 1,
      hour: 0,
      minute: parseInt(minute ?? "0") || 0,
      weekday: 1,
      monthDay: 1,
    };
  }

  // Weekly (specific day and time)
  if (day === "*" && weekday !== "*") {
    return {
      frequency: "weekly",
      interval: 1,
      hour: parseInt(hour ?? "9") || 9,
      minute: parseInt(minute ?? "0") || 0,
      weekday: parseInt(weekday ?? "1") || 1,
      monthDay: 1,
    };
  }

  // Monthly (specific day of month and time)
  if (day !== "*" && weekday === "*") {
    return {
      frequency: "monthly",
      interval: 1,
      hour: parseInt(hour ?? "9") || 9,
      minute: parseInt(minute ?? "0") || 0,
      weekday: 1,
      monthDay: parseInt(day ?? "1") || 1,
    };
  }

  // Daily (specific time)
  return {
    frequency: "daily",
    interval: 1,
    hour: parseInt(hour ?? "9") || 9,
    minute: parseInt(minute ?? "0") || 0,
    weekday: 1,
    monthDay: 1,
  };
}

/**
 * Build a cron expression from structured schedule data
 */
function buildCron(
  frequency: FrequencyType,
  interval: number,
  hour: number,
  minute: number,
  weekday: number,
  monthDay: number
): string {
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
    default:
      return "0 9 * * *";
  }
}

/**
 * Get human-readable description of the schedule
 */
function describeSchedule(
  frequency: FrequencyType,
  interval: number,
  hour: number,
  minute: number,
  weekday: number,
  monthDay: number
): string {
  const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  const hourStr = formatHour(hour);

  switch (frequency) {
    case "minutes":
      return `Every ${interval} minute${interval > 1 ? "s" : ""}`;
    case "hourly":
      return `Every hour at :${minute.toString().padStart(2, "0")}`;
    case "daily":
      return `Every day at ${hourStr}`;
    case "weekly":
      return `Every ${WEEKDAYS[weekday]?.label ?? "Monday"} at ${hourStr}`;
    case "monthly":
      return `On day ${monthDay} of every month at ${hourStr}`;
    default:
      return `At ${timeStr}`;
  }
}

export function ScheduleBuilder({ value, onChange }: ScheduleBuilderProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [manualCron, setManualCron] = useState(value);

  // Parse the incoming cron value
  const parsed = parseCron(value);
  const [frequency, setFrequency] = useState<FrequencyType>(parsed.frequency);
  const [interval, setInterval] = useState(parsed.interval);
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const [weekday, setWeekday] = useState(parsed.weekday);
  const [monthDay, setMonthDay] = useState(parsed.monthDay);

  // Sync manual cron with value prop
  useEffect(() => {
    setManualCron(value);
  }, [value]);

  // Update cron when schedule changes
  const updateCron = (
    newFrequency: FrequencyType,
    newInterval: number,
    newHour: number,
    newMinute: number,
    newWeekday: number,
    newMonthDay: number
  ) => {
    const cron = buildCron(newFrequency, newInterval, newHour, newMinute, newWeekday, newMonthDay);
    onChange(cron);
    setManualCron(cron);
  };

  const handleFrequencyChange = (newFreq: FrequencyType) => {
    setFrequency(newFreq);
    updateCron(newFreq, interval, hour, minute, weekday, monthDay);
  };

  const handleIntervalChange = (newInterval: number) => {
    setInterval(newInterval);
    updateCron(frequency, newInterval, hour, minute, weekday, monthDay);
  };

  const handleHourChange = (newHour: number) => {
    setHour(newHour);
    updateCron(frequency, interval, newHour, minute, weekday, monthDay);
  };

  const handleMinuteChange = (newMinute: number) => {
    setMinute(newMinute);
    updateCron(frequency, interval, hour, newMinute, weekday, monthDay);
  };

  const handleWeekdayChange = (newWeekday: number) => {
    setWeekday(newWeekday);
    updateCron(frequency, interval, hour, minute, newWeekday, monthDay);
  };

  const handleMonthDayChange = (newMonthDay: number) => {
    setMonthDay(newMonthDay);
    updateCron(frequency, interval, hour, minute, weekday, newMonthDay);
  };

  const handleManualCronChange = (newCron: string) => {
    setManualCron(newCron);
    // Only update parent if it looks like a valid cron (5 space-separated parts)
    if (newCron.trim().split(/\s+/).length === 5) {
      onChange(newCron);
      // Re-parse and update UI state
      const newParsed = parseCron(newCron);
      setFrequency(newParsed.frequency);
      setInterval(newParsed.interval);
      setHour(newParsed.hour);
      setMinute(newParsed.minute);
      setWeekday(newParsed.weekday);
      setMonthDay(newParsed.monthDay);
    }
  };

  const description = describeSchedule(frequency, interval, hour, minute, weekday, monthDay);

  return (
    <div className="space-y-4">
      {/* Frequency selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Run this workflow
        </label>
        <div className="grid grid-cols-5 gap-1 bg-gray-100 p-1 rounded-lg">
          {(["minutes", "hourly", "daily", "weekly", "monthly"] as FrequencyType[]).map(
            (freq) => (
              <button
                key={freq}
                type="button"
                onClick={() => handleFrequencyChange(freq)}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors capitalize ${
                  frequency === freq
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {freq === "minutes" ? "Minutes" : freq}
              </button>
            )
          )}
        </div>
      </div>

      {/* Frequency-specific options */}
      <div className="space-y-3">
        {/* Minutes interval */}
        {frequency === "minutes" && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Every</span>
            <select
              value={interval}
              onChange={(e) => handleIntervalChange(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {[1, 2, 5, 10, 15, 20, 30].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span className="text-sm text-gray-600">minute(s)</span>
          </div>
        )}

        {/* Hourly - minute selector */}
        {frequency === "hourly" && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">At minute</span>
            <select
              value={minute}
              onChange={(e) => handleMinuteChange(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                <option key={m} value={m}>
                  :{m.toString().padStart(2, "0")}
                </option>
              ))}
            </select>
            <span className="text-sm text-gray-600">of every hour</span>
          </div>
        )}

        {/* Daily - time selector */}
        {frequency === "daily" && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">At</span>
            <select
              value={hour}
              onChange={(e) => handleHourChange(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {formatHour(i)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Weekly - day and time */}
        {frequency === "weekly" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">On</span>
              <select
                value={weekday}
                onChange={(e) => handleWeekdayChange(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {WEEKDAYS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">At</span>
              <select
                value={hour}
                onChange={(e) => handleHourChange(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {formatHour(i)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Monthly - day and time */}
        {frequency === "monthly" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">On day</span>
              <select
                value={monthDay}
                onChange={(e) => handleMonthDayChange(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {Array.from({ length: 28 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
              <span className="text-sm text-gray-600">of the month</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">At</span>
              <select
                value={hour}
                onChange={(e) => handleHourChange(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {formatHour(i)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Schedule summary */}
      <div className="p-3 bg-brand-50 border border-brand-100 rounded-lg">
        <p className="text-sm text-brand-700 font-medium">{description}</p>
      </div>

      {/* Advanced toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          {showAdvanced ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          Advanced (cron expression)
        </button>

        {showAdvanced && (
          <div className="mt-2">
            <input
              type="text"
              value={manualCron}
              onChange={(e) => handleManualCronChange(e.target.value)}
              placeholder="* * * * * (min hour day month weekday)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              Format: minute (0-59) hour (0-23) day (1-31) month (1-12) weekday (0-6, Sun=0)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
