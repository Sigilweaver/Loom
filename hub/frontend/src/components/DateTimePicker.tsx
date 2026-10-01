/**
 * DateTimePicker built on Radix Popover and react-day-picker.
 *
 * A combined date and time picker. Values are ISO strings (UTC); the picker
 * shows and edits them in the viewer's local time zone.
 */

import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { DayPicker } from "react-day-picker";
import { format, parseISO } from "date-fns";
import { Calendar, Clock, X } from "lucide-react";
import clsx from "clsx";
import { Button, IconButton, Input } from "@components/ui";
import "react-day-picker/style.css";

interface DateTimePickerProps {
  /** ISO datetime string (UTC) or empty string */
  value: string;
  /** Called with ISO datetime string (UTC) or empty string */
  onChange: (value: string) => void;
  /** Placeholder text when no value */
  placeholder?: string;
  className?: string;
  /** Whether to allow clearing the value */
  clearable?: boolean;
  id?: string;
}

function parseValue(iso: string): Date | undefined {
  if (!iso) return undefined;
  const date = parseISO(iso);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function withTime(date: Date, hours: number, minutes: number): string {
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next.toISOString();
}

const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value || 0));
const pad = (value: number) => value.toString().padStart(2, "0");

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Select date and time",
  className,
  clearable = true,
  id,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);

  const date = parseValue(value);
  const hours = date?.getHours() ?? 0;
  const minutes = date?.getMinutes() ?? 0;

  const display = date ? `${format(date, "MMM d, yyyy")} at ${pad(hours)}:${pad(minutes)}` : "";

  return (
    <div className={clsx("relative", className)}>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            id={id}
            type="button"
            className={clsx(
              "flex h-9 w-full items-center gap-2 rounded-lg border border-line-strong bg-field px-3 text-left text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40",
              display ? "text-ink" : "text-ink-faint",
              clearable && display && "pr-10"
            )}
          >
            <Calendar className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
            <span className="flex-1 truncate">{display || placeholder}</span>
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            className="z-[70] rounded-lg border border-line bg-surface-raised p-4 text-ink shadow-lg"
            sideOffset={4}
            align="start"
          >
            <DayPicker
              mode="single"
              selected={date}
              onSelect={(selected) => selected && onChange(withTime(selected, hours, minutes))}
              className="rdp-custom"
            />

            <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
              <Clock className="h-4 w-4 text-ink-faint" aria-hidden="true" />
              <span className="text-sm text-ink-muted">Time</span>
              <Input
                type="number"
                aria-label="Hour"
                min={0}
                max={23}
                value={pad(hours)}
                disabled={!date}
                onChange={(e) => date && onChange(withTime(date, clamp(parseInt(e.target.value, 10), 23), minutes))}
                className="w-16 text-center"
              />
              <span className="text-ink-muted">:</span>
              <Input
                type="number"
                aria-label="Minute"
                min={0}
                max={59}
                value={pad(minutes)}
                disabled={!date}
                onChange={(e) => date && onChange(withTime(date, hours, clamp(parseInt(e.target.value, 10), 59)))}
                className="w-16 text-center"
              />
            </div>

            <div className="mt-3 flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => onChange(new Date().toISOString())}>
                Now
              </Button>
              <Button variant="primary" size="sm" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {clearable && display && (
        <IconButton
          label="Clear date and time"
          size="sm"
          onClick={() => onChange("")}
          className="absolute top-1/2 right-1.5 -translate-y-1/2"
        >
          <X className="h-4 w-4" />
        </IconButton>
      )}
    </div>
  );
}
