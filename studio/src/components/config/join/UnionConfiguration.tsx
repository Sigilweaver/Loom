import { ToolConfig, EmissionMap } from "@domain/workflow/entities/workflow";
import { ConfigSelect } from "@components/primitives/ConfigSelect";

interface UnionConfigurationProps {
  config: ToolConfig;
  onChange: (config: ToolConfig) => void;
}

export function UnionConfiguration({
  config,
  onChange,
}: UnionConfigurationProps) {
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {/* Info Section */}
        <div className="p-3 bg-theme-surface-elevated rounded text-sm">
          <h3 className="font-semibold text-theme-text-primary mb-2">
            Union Tool
          </h3>
          <p className="text-theme-text-secondary mb-2">
            Combine multiple datasets vertically.
          </p>
        </div>

        {/* Mode Selection */}
        <ConfigSelect
          configKey="mode"
          value={(config.mode as string) || "ByName"}
          onChange={handleModeChange}
          label="Union Mode"
          description="How to align columns from different inputs"
          defaultValue="ByName"
          options={[
            {
              value: "ByName",
              label: "By Name",
              description: "Align columns by name. Missing columns are filled with nulls.",
            },
            {
              value: "ByPosition",
              label: "By Position",
              description: "Align columns by position. Columns are renamed to match the first input.",
            },
          ]}
        />
      </div>
    </div>
  );
}
