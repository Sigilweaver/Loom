import { useState, type FormEvent } from "react";
import { Clock } from "lucide-react";
import type { ScheduleResponse, ServerResponse, WorkflowMetadata } from "@api";
import { errorMessage, fieldError } from "@utils/errors";
import { DateTimePicker } from "@components/DateTimePicker";
import { ScheduleBuilder } from "@components/ScheduleBuilder";
import { Alert, Button, Checkbox, Field, Modal, Select, Textarea } from "@components/ui";

export interface ScheduleFormData {
  workflow_id: string;
  cron_expression: string;
  timezone: string;
  start_at: string;
  target_server_id: string;
  enabled: boolean;
  description: string;
}

const DEFAULT_FORM: ScheduleFormData = {
  workflow_id: "",
  cron_expression: "0 * * * *",
  timezone: "UTC",
  start_at: "",
  target_server_id: "",
  enabled: true,
  description: "",
};

const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "America/New_York (EST/EDT)" },
  { value: "America/Chicago", label: "America/Chicago (CST/CDT)" },
  { value: "America/Denver", label: "America/Denver (MST/MDT)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST/PDT)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST)" },
  { value: "Europe/Paris", label: "Europe/Paris (CET/CEST)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST)" },
];

function initialForm(schedule: ScheduleResponse | null): ScheduleFormData {
  if (!schedule) return DEFAULT_FORM;
  return {
    workflow_id: schedule.workflow_id,
    cron_expression: schedule.cron_expression,
    timezone: schedule.timezone,
    start_at: schedule.start_at ?? "",
    target_server_id: schedule.target_server_id ?? "",
    enabled: schedule.enabled,
    description: schedule.description ?? "",
  };
}

interface ScheduleDialogProps {
  /** The schedule being edited, or null to create one. */
  schedule: ScheduleResponse | null;
  workflows: WorkflowMetadata[];
  servers: ServerResponse[];
  onClose: () => void;
  onSave: (data: ScheduleFormData) => Promise<void>;
}

export function ScheduleDialog({ schedule, workflows, servers, onClose, onSave }: ScheduleDialogProps) {
  const [form, setForm] = useState<ScheduleFormData>(() => initialForm(schedule));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof ScheduleFormData>(key: K, value: ScheduleFormData[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      const next: Record<string, string> = {};
      for (const key of ["workflow_id", "cron_expression", "timezone", "start_at", "description"]) {
        const message = fieldError(err, key);
        if (message) next[key] = message;
      }
      setFieldErrors(next);
      if (Object.keys(next).length === 0) setError(errorMessage(err, "Failed to save schedule"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={schedule ? "Edit schedule" : "Create schedule"}
      description={schedule ? undefined : "Run a workflow automatically on a repeating schedule."}
      icon={<Clock className="h-5 w-5" />}
      dismissable={!saving}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!form.workflow_id}>
            {schedule ? "Save changes" : "Create schedule"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert>{error}</Alert>}

        <Field
          label="Workflow"
          required
          error={fieldErrors.workflow_id}
          hint={schedule ? "The workflow of an existing schedule cannot be changed." : undefined}
        >
          <Select
            value={form.workflow_id}
            onChange={(e) => set("workflow_id", e.target.value)}
            required
            disabled={Boolean(schedule)}
          >
            <option value="">Select a workflow</option>
            {workflows.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </Field>

        <ScheduleBuilder value={form.cron_expression} onChange={(value) => set("cron_expression", value)} />
        {fieldErrors.cron_expression && <Alert>{fieldErrors.cron_expression}</Alert>}

        <Field label="Timezone" error={fieldErrors.timezone}>
          <Select value={form.timezone} onChange={(e) => set("timezone", e.target.value)}>
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Start at (optional)"
          hint="The schedule will not run before this time. Leave empty to start immediately."
          error={fieldErrors.start_at}
        >
          <DateTimePicker
            value={form.start_at}
            onChange={(value) => set("start_at", value)}
            placeholder="Select start date and time"
          />
        </Field>

        <Field label="Target server">
          <Select value={form.target_server_id} onChange={(e) => set("target_server_id", e.target.value)}>
            <option value="">Auto-select (round-robin)</option>
            {servers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Description" error={fieldErrors.description}>
          <Textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            rows={2}
            placeholder="Optional description for this schedule"
            className="resize-none"
          />
        </Field>

        <Checkbox
          label={schedule ? "Schedule is enabled" : "Enable schedule immediately"}
          checked={form.enabled}
          onChange={(e) => set("enabled", e.target.checked)}
        />
      </div>
    </Modal>
  );
}
