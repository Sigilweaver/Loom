import { ToolConfig, EmissionMap } from "@domain/workflow/entities/workflow";
import { ConfigSelect } from "@components/primitives/ConfigSelect";
import { ConfigNumber } from "@components/primitives/ConfigNumber";
import { AlertTriangle } from "lucide-react";

/**
 * Sample modes and their descriptions
 */
const SAMPLE_MODES = [
  {
    value: "FirstN",
    label: "First N Rows",
    description: "Take the first N rows from the data.",
  },
  {
    value: "LastN",
    label: "Last N Rows",
    description: "Take the last N rows from the data.",
  },
  {
    value: "EveryN",
    label: "Every Nth Row",
    description: "Take every Nth row (systematic sampling).",
  },
  {
    value: "Random",
    label: "Random N Rows",
    description: "Take N random rows.",
  },
  {
    value: "RandomPercent",
    label: "Random Percentage",
    description: "Take a random percentage of rows.",
  },
  {
    value: "FirstPercent",
    label: "First N Percent",
    description: "Take the first N% of rows.",
  },
];

/**
 * Modes that require full data scan (blocking)
 */
const BLOCKING_MODES = new Set(["LastN", "Random", "RandomPercent", "FirstPercent"]);

interface SampleConfigurationProps {
  config: ToolConfig;
  onChange: (config: ToolConfig) => void;
}

export function SampleConfiguration({
  config,
  onChange,
}: SampleConfigurationProps) {
  const currentMode = (config.mode as string) || "FirstN";
  const isBlocking = BLOCKING_MODES.has(currentMode);

  // Determine which fields to show based on mode
  const showN = ["FirstN", "LastN", "EveryN", "Random"].includes(currentMode);
  const showPercent = ["RandomPercent", "FirstPercent"].includes(currentMode);
  const showOffset = currentMode === "EveryN";
  const showSeed = ["Random", "RandomPercent"].includes(currentMode);

  const handleModeChange = (
    value: string | undefined,
    emitPatch: EmissionMap,
    _shouldEmit: boolean
  ) => {
    const newConfig = {
      ...config,
      mode: value,
      _emit: {
        ...config._emit,
        ...emitPatch,
      },
    };
    onChange(newConfig);
  };

  const handleNChange = (
    value: number | undefined,
    emitPatch: EmissionMap,
    _shouldEmit: boolean
  ) => {
    const newConfig = {
      ...config,
      n: value,
      _emit: {
        ...config._emit,
        ...emitPatch,
      },
    };
    onChange(newConfig);
  };

  const handlePercentChange = (
    value: number | undefined,
    emitPatch: EmissionMap,
    _shouldEmit: boolean
  ) => {
    const newConfig = {
      ...config,
      percent: value,
      _emit: {
        ...config._emit,
        ...emitPatch,
      },
    };
    onChange(newConfig);
  };

  const handleOffsetChange = (
    value: number | undefined,
    emitPatch: EmissionMap,
    _shouldEmit: boolean
  ) => {
    const newConfig = {
      ...config,
      offset: value,
      _emit: {
        ...config._emit,
        ...emitPatch,
      },
    };
    onChange(newConfig);
  };

  const handleSeedChange = (
    value: number | undefined,
    emitPatch: EmissionMap,
    _shouldEmit: boolean
  ) => {
    const newConfig = {
      ...config,
      seed: value ?? null,
      _emit: {
        ...config._emit,
        ...emitPatch,
      },
    };
    onChange(newConfig);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {/* Info Section */}
        <div className="p-3 text-sm rounded bg-theme-surface-elevated">
          <h3 className="mb-2 font-semibold text-theme-text-primary">
            Sample Tool
          </h3>
          <p className="mb-2 text-theme-text-secondary">
            Extract a subset of rows from your data using various sampling methods.
          </p>
        </div>

        {/* Blocking Warning */}
        {isBlocking && (
          <div className="flex items-start gap-2 p-3 text-sm border rounded bg-theme-status-warning-bg border-theme-status-warning-border">
            <AlertTriangle className="w-4 h-4 text-theme-status-warning-text mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-theme-status-warning-text">Performance Note</p>
              <p className="text-theme-text-secondary">
                This mode requires scanning all data before producing output.
                Results will be cached to avoid re-computation.
              </p>
            </div>
          </div>
        )}

        {/* Mode Selection */}
        <ConfigSelect
          configKey="mode"
          value={currentMode}
          onChange={handleModeChange}
          label="Sampling Method"
          description="How to select rows from the input data"
          defaultValue="FirstN"
          options={SAMPLE_MODES}
        />

        {/* N Value (for count-based modes) */}
        {showN && (
          <ConfigNumber
            configKey="n"
            value={(config.n as number) ?? 100}
            onChange={handleNChange}
            label={currentMode === "EveryN" ? "Take Every N Rows" : "Number of Rows"}
            description={
              currentMode === "EveryN"
                ? "Take one row for every N rows (e.g., 10 = every 10th row)"
                : "Maximum number of rows to include in the sample"
            }
            defaultValue={100}
            min={1}
            integerOnly
            required
          />
        )}

        {/* Percent Value (for percentage-based modes) */}
        {showPercent && (
          <ConfigNumber
            configKey="percent"
            value={(config.percent as number) ?? 10.0}
            onChange={handlePercentChange}
            label="Percentage"
            description="Percentage of rows to include (0-100)"
            defaultValue={10.0}
            min={0}
            max={100}
            step={0.1}
            unit="%"
            unitPosition="after"
            required
          />
        )}

        {/* Offset (for EveryN mode) */}
        {showOffset && (
          <ConfigNumber
            configKey="offset"
            value={(config.offset as number) ?? 0}
            onChange={handleOffsetChange}
            label="Starting Offset"
            description="Skip this many rows before starting to sample (0 = start from first row)"
            defaultValue={0}
            min={0}
            integerOnly
          />
        )}

        {/* Seed (for random modes) */}
        {showSeed && (
          <ConfigNumber
            configKey="seed"
            value={(config.seed as number | null) ?? undefined}
            onChange={handleSeedChange}
            label="Random Seed (Optional)"
            description="Set a seed for reproducible random sampling. Leave empty for different results each run."
            placeholder="Leave empty for random"
            integerOnly
          />
        )}
      </div>
    </div>
  );
}
