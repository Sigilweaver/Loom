import {
  ConfigFile,
  ConfigSelect,
  type ConfigSelectOption,
} from "@components/primitives";
import { mergeEmitPatch } from "@components/primitives/hooks";
import {
  isNdjsonOutputFile,
  JSON_OUTPUT_MODE_INFO,
  switchJsonOutputMode,
  type JSONOutputMode,
  type PolarsNdjsonOutputConfig,
} from "@domain/dataSources/jsonOutput";
import {
  type EmissionMap,
  type ToolConfig,
} from "@domain/workflow/entities/workflow";
import React, { useCallback, useMemo } from "react";

interface JsonOutputConfigurationProps {
  mode: JSONOutputMode;
  config: ToolConfig;
  onChange: (updatedConfig: ToolConfig) => void;
}

export const JsonOutputConfiguration: React.FC<
  JsonOutputConfigurationProps
> = ({ mode, config, onChange }) => {
  const modeInfo = JSON_OUTPUT_MODE_INFO[mode];

  // Detect if file is NDJSON (supports mode selection)
  const destination = config.destination as string | undefined;
  const isNdjson = useMemo(() => {
    return destination ? isNdjsonOutputFile(destination) : false;
  }, [destination]);

  const handleModeChange = useCallback(
    (newMode: JSONOutputMode) => {
      if (newMode === mode) return;
      const switchedConfig = switchJsonOutputMode(
        config as Partial<PolarsNdjsonOutputConfig>,
        newMode
      );
      // Preserve ToolConfig fields (category, type, jsonMode)
      const updatedConfig = {
        ...switchedConfig,
        category: config.category,
        type: config.type,
        jsonMode: newMode,
      } as ToolConfig;
      onChange(updatedConfig);
    },
    [mode, config, onChange]
  );

  const updateConfig = useCallback(
    (
      key: string,
      value: unknown,
      emitPatch: EmissionMap,
      shouldEmit: boolean
    ) => {
      const newEmit = shouldEmit
        ? mergeEmitPatch(config._emit, emitPatch)
        : (config._emit ?? {});

      const updatedConfig = {
        ...config,
        [key]: value,
        _emit: newEmit,
      } as ToolConfig;

      onChange(updatedConfig);
    },
    [config, onChange]
  );

  const modeOptions: ConfigSelectOption[] = [
    { value: "sink", label: JSON_OUTPUT_MODE_INFO.sink.label },
    { value: "write", label: JSON_OUTPUT_MODE_INFO.write.label },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Mode Selector */}
      <div className="p-4 border-b bg-theme-surface-elevated border-theme-border-primary">
        <div className="space-y-3">
          {isNdjson ? (
            /* NDJSON: Show mode selector */
            <>
              <div>
                <label className="block mb-2 text-sm font-medium text-theme-text-primary">
                  Output Mode
                </label>
                <ConfigSelect
                  value={mode}
                  options={modeOptions}
                  onChange={(value) => handleModeChange(value as JSONOutputMode)}
                  placeholder="Select output mode..."
                  configKey="jsonMode"
                  searchable={false}
                />
              </div>
              <p className="text-xs text-theme-text-tertiary">
                {modeInfo.description}
              </p>
            </>
          ) : (
            /* Standard JSON: Fixed write mode */
            <>
              <div>
                <label className="block mb-2 text-sm font-medium text-theme-text-primary">
                  Output Mode
                </label>
                <div className="px-3 py-2 text-sm border rounded bg-theme-surface border-theme-border-primary text-theme-text-secondary">
                  {JSON_OUTPUT_MODE_INFO.write.label}
                </div>
              </div>
              <p className="text-xs text-theme-text-tertiary">
                Standard JSON files only support eager writing (no streaming available).
              </p>
            </>
          )}
        </div>
      </div>

      {/* Scrollable Configuration */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-6">
          {/* === File Path === */}
          <section>
            <h3 className="mb-3 text-sm font-semibold text-theme-text-primary">
              Output File
            </h3>
            <div className="space-y-3">
              <ConfigFile
                label="Destination"
                value={destination ?? ""}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("destination", value, emitPatch, shouldEmit)
                }
                configKey="destination"
                mode="save"
                accept=".json,.jsonl,.ndjson"
                filters={[
                  { name: "JSON Files", extensions: ["json"] },
                  { name: "NDJSON Files", extensions: ["jsonl", "ndjson"] },
                  { name: "All Files", extensions: ["*"] },
                ]}
                placeholder="Select output file path..."
                description="Path where the JSON file will be written. Use .jsonl or .ndjson for streaming output."
                required
              />
            </div>
          </section>

          {/* Format Information */}
          <section>
            <h3 className="mb-3 text-sm font-semibold text-theme-text-primary">
              Format Information
            </h3>
            <div className="p-3 border rounded bg-theme-surface border-theme-border-secondary">
              {isNdjson ? (
                <div className="space-y-2">
                  <p className="text-sm text-theme-text-primary">
                    <span className="font-medium">NDJSON Format</span>
                  </p>
                  <p className="text-xs text-theme-text-tertiary">
                    Each row is written as a separate JSON object on its own line.
                    This format supports streaming and is ideal for large datasets.
                  </p>
                  <p className="text-xs text-theme-text-tertiary">
                    Example output:
                  </p>
                  <pre className="p-2 mt-1 overflow-x-auto text-xs rounded bg-theme-surface-elevated text-theme-text-secondary">
{`{"name": "Alice", "age": 30}
{"name": "Bob", "age": 25}`}
                  </pre>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-theme-text-primary">
                    <span className="font-medium">Standard JSON Format</span>
                  </p>
                  <p className="text-xs text-theme-text-tertiary">
                    Data is written as a JSON array of objects.
                    All data must be collected into memory before writing.
                  </p>
                  <p className="text-xs text-theme-text-tertiary">
                    Example output:
                  </p>
                  <pre className="p-2 mt-1 overflow-x-auto text-xs rounded bg-theme-surface-elevated text-theme-text-secondary">
{`[
  {"name": "Alice", "age": 30},
  {"name": "Bob", "age": 25}
]`}
                  </pre>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
