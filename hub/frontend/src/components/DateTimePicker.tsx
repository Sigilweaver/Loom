/**
 * DateTimePicker component using Radix Popover and react-day-picker
 *
 * Provides a combined date and time picker with proper timezone handling.
 * Values are stored as ISO strings in UTC.
 */

import { useState, useEffect } from "react";
import * as Popover from "@radix-ui/react-popover";
import { DayPicker } from "react-day-picker";
import { format, parseISO } from "date-fns";
import { Calendar, Clock, X } from "lucide-react";
import "react-day-picker/style.css";

interface DateTimePickerProps {
  /** ISO datetime string (UTC) or empty string */
  value: string;
  /** Called with ISO datetime string (UTC) or empty string */
  onChange: (value: string) => void;
  /** Placeholder text when no value */
  placeholder?: string;
  /** Additional class names for the trigger button */
  className?: string;
  /** Whether to allow clearing the value */
  clearable?: boolean;
}

/**
 * Convert ISO UTC string to local Date for display
 */
function isoToLocalDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  try {
    return parseISO(iso);
  } catch {
    return undefined;
  }
}

/**
 * Convert local date + time to ISO UTC string
 */
function localToIso(date: Date, hours: number, minutes: number): string {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

/**
 * Extract hours and minutes from a Date
 */
function getTimeFromDate(date: Date | undefined): { hours: number; minutes: number } {
  if (!date) return { hours: 0, minutes: 0 };
  return {
    hours: date.getHours(),
    minutes: date.getMinutes(),
  };
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Select date and time",
  className = "",
  clearable = true,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  
  // Parse initial value
  const initialDate = isoToLocalDate(value);
  const initialTime = getTimeFromDate(initialDate);
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(initialDate);
  const [hours, setHours] = useState(initialTime.hours);
  const [minutes, setMinutes] = useState(initialTime.minutes);

  // Sync internal state when value prop changes
  useEffect(() => {
    const date = isoToLocalDate(value);
    const time = getTimeFromDate(date);
    setSelectedDate(date);
    setHours(time.hours);
    setMinutes(time.minutes);
  }, [value]);

  // Update parent when date or time changes
  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      onChange(localToIso(date, hours, minutes));
    }
  };

  const handleTimeChange = (newHours: number, newMinutes: number) => {
    setHours(newHours);
    setMinutes(newMinutes);
    if (selectedDate) {
      onChange(localToIso(selectedDate, newHours, newMinutes));
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDate(undefined);
    setHours(0);
    setMinutes(0);
    onChange("");
  };

  // Format display value
  const displayValue = selectedDate
    ? format(selectedDate, "MMM d, yyyy") + " at " + 
      `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
    : "";

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={`
            w-full px-3 py-2 text-left border border-gray-300 rounded-lg
            focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
            bg-white flex items-center gap-2
            ${!displayValue ? "text-gray-400" : "text-gray-900"}
            ${className}
          `}
        >
          <Calendar className="flex-shrink-0 w-4 h-4 text-gray-400" />
          <span className="flex-1 truncate">
            {displayValue || placeholder}
          </span>
          {clearable && displayValue && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="z-50 p-4 bg-white border border-gray-200 rounded-lg shadow-lg"
          sideOffset={4}
          align="start"
        >
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            className="rdp-custom"
          />

          {/* Time picker */}
          <div className="pt-3 mt-3 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">Time:</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={hours.toString().padStart(2, "0")}
                  onChange={(e) => {
                    const val = Math.max(0, Math.min(23, parseInt(e.target.value) || 0));
                    handleTimeChange(val, minutes);
                  }}
                  className="w-12 px-2 py-1 text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <span className="text-gray-600">:</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={minutes.toString().padStart(2, "0")}
                  onChange={(e) => {
                    const val = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                    handleTimeChange(hours, val);
                  }}
                  className="w-12 px-2 py-1 text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex items-center justify-between mt-3">
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setSelectedDate(now);
                setHours(now.getHours());
                setMinutes(now.getMinutes());
                onChange(now.toISOString());
              }}
              className="text-sm text-brand-600 hover:text-brand-700"
            >
              Now
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-1 text-sm text-white rounded bg-brand-600 hover:bg-brand-700"
            >
              Done
            </button>
          </div>

          <Popover.Arrow className="fill-white" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
