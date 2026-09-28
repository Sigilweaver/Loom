/**
 * ScheduleBuilder - friendly scheduling for business users.
 *
 * Generates a valid cron expression from plain choices ("every Monday at
 * 9:00 AM"). Advanced users can open the raw cron expression and edit it.
 */

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  FREQUENCIES,
  WEEKDAYS,
  buildCron,
  describeSchedule,
  formatHour,
  looksLikeCron,
  parseCron,
  type Frequency,
  type ScheduleParts,
} from "@utils/cron";
import { Input, Select, SegmentedControl } from "@components/ui";

interface ScheduleBuilderProps {
  /** Cron expression value */
  value: string;
  /** Called when cron expression changes */
  onChange: (value: string) => void;
}

const FREQUENCY_LABELS: Record<Frequency, string> = {
  minutes: "Minutes",
  hourly: "Hourly",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

const MINUTE_INTERVALS = [1, 2, 5, 10, 15, 20, 30];
const MINUTES_PAST = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function Row({ label, children, suffix }: { label: string; children: ReactNode; suffix?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-16 text-sm text-ink-muted">{label}</span>
      {children}
      {suffix && <span className="text-sm text-ink-muted">{suffix}</span>}
    </div>
  );
}

export function ScheduleBuilder({ value, onChange }: ScheduleBuilderProps) {
  const [parts, setParts] = useState<ScheduleParts>(() => parseCron(value));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [manualCron, setManualCron] = useState(value);

  // Keep the raw field in step when the parent changes the value.
  useEffect(() => {
    setManualCron(value);
  }, [value]);

  const update = (changes: Partial<ScheduleParts>) => {
    const next = { ...parts, ...changes };
    const cron = buildCron(next);
    setParts(next);
    setManualCron(cron);
    onChange(cron);
  };

  const handleManualChange = (text: string) => {
    setManualCron(text);
    // Only accept something that looks like a cron expression (five fields).
    if (looksLikeCron(text)) {
      onChange(text);
      setParts(parseCron(text));
    }
  };

  const hourSelect = (
    <Select
      aria-label="Hour"
      value={parts.hour}
      onChange={(e) => update({ hour: Number(e.target.value) })}
      className="w-auto"
    >
      {Array.from({ length: 24 }, (_, hour) => (
        <option key={hour} value={hour}>
          {formatHour(hour)}
        </option>
      ))}
    </Select>
  );

  return (
    <div className="space-y-4">
      <div>
        <span className="mb-2 block text-sm font-medium text-ink-muted">Run this workflow</span>
        <SegmentedControl
          label="Frequency"
          value={parts.frequency}
          options={FREQUENCIES.map((frequency) => ({ value: frequency, label: FREQUENCY_LABELS[frequency] }))}
          onChange={(frequency) => update({ frequency })}
        />
      </div>

      <div className="space-y-3">
        {parts.frequency === "minutes" && (
          <Row label="Every" suffix="minute(s)">
            <Select
              aria-label="Minutes between runs"
              value={parts.interval}
              onChange={(e) => update({ interval: Number(e.target.value) })}
              className="w-auto"
            >
              {MINUTE_INTERVALS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Row>
        )}

        {parts.frequency === "hourly" && (
          <Row label="At minute" suffix="of every hour">
            <Select
              aria-label="Minute of the hour"
              value={parts.minute}
              onChange={(e) => update({ minute: Number(e.target.value) })}
              className="w-auto"
            >
              {MINUTES_PAST.map((m) => (
                <option key={m} value={m}>
                  :{m.toString().padStart(2, "0")}
                </option>
              ))}
            </Select>
          </Row>
        )}

        {parts.frequency === "weekly" && (
          <Row label="On">
            <Select
              aria-label="Day of the week"
              value={parts.weekday}
              onChange={(e) => update({ weekday: Number(e.target.value) })}
              className="w-auto"
            >
              {WEEKDAYS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          </Row>
        )}

        {parts.frequency === "monthly" && (
          <Row label="On day" suffix="of the month">
            <Select
              aria-label="Day of the month"
              value={parts.monthDay}
              onChange={(e) => update({ monthDay: Number(e.target.value) })}
              className="w-auto"
            >
              {Array.from({ length: 28 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </Select>
          </Row>
        )}

        {(parts.frequency === "daily" || parts.frequency === "weekly" || parts.frequency === "monthly") && (
          <Row label="At">{hourSelect}</Row>
        )}
      </div>

      <p
        aria-live="polite"
        className="rounded-lg border border-accent-line bg-accent-soft p-3 text-sm font-medium text-accent-ink"
      >
        {describeSchedule(parts)}
      </p>

      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          aria-expanded={showAdvanced}
          className="flex items-center gap-1 text-sm text-ink-subtle hover:text-ink-muted"
        >
          {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Advanced (cron expression)
        </button>

        {showAdvanced && (
          <div className="mt-2">
            <Input
              aria-label="Cron expression"
              value={manualCron}
              onChange={(e) => handleManualChange(e.target.value)}
              placeholder="* * * * *"
              className="font-mono"
            />
            <p className="mt-1 text-xs text-ink-subtle">
              Format: minute (0-59) hour (0-23) day (1-31) month (1-12) weekday (0-6, Sunday is 0)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
