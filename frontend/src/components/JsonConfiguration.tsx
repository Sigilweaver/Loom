import {
  ConfigBoolean,
  ConfigFile,
  ConfigNumber,
  ConfigSelect,
  ConfigText,
  type ConfigSelectOption,
} from "@components/primitives";
import { mergeEmitPatch } from "@components/primitives/hooks";
import {
  isNdjsonFile,
  JSON_MODE_INFO,
  switchJsonMode,
  type JSONMode,
  type PolarsNdjsonConfig,
} from "@domain/dataSources/json";
import {
  type EmissionMap,
  type ToolConfig,
} from "@domain/workflow/entities/workflow";
import React, { useCallback, useMemo } from "react";

interface JsonConfigurationProps {
  mode: JSONMode;
  config: ToolConfig;
  onChange: (updatedConfig: ToolConfig) => void;
}

export const JsonConfiguration: React.FC<JsonConfigurationProps> = ({
  mode,
  config,
  onChange,
}) => {
  const modeInfo = JSON_MODE_INFO[mode];

  // Detect if file is NDJSON (supports mode selection)
  const source = config.source as string | undefined;
  const isNdjson = useMemo(() => {
    return source ? isNdjsonFile(source) : false;
  }, [source]);

  const handleModeChange = useCallback(
    (newMode: JSONMode) => {
      if (newMode === mode) return;
      const switchedConfig = switchJsonMode(
        config as Partial<PolarsNdjsonConfig>,
        newMode
      );
      // Preserve ToolConfig fields (category, type, jsonMode) that aren't in PolarsNdjsonConfig
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
      key: keyof PolarsNdjsonConfig,
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

  // Type-safe getters
  const infer_schema_length = config.infer_schema_length as number | undefined;
  const n_rows = config.n_rows as number | undefined;
  const row_index_name = config.row_index_name as string | undefined;
  const row_index_offset = config.row_index_offset as number | undefined;
  const batch_size = config.batch_size as number | undefined;
  const low_memory = config.low_memory as boolean | undefined;
  const rechunk = config.rechunk as boolean | undefined;
  const ignore_errors = config.ignore_errors as boolean | undefined;

  const modeOptions: ConfigSelectOption[] = [
    { value: "scan", label: JSON_MODE_INFO.scan.name },
    { value: "read", label: JSON_MODE_INFO.read.name },
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
                  Reading Mode
                </label>
                <ConfigSelect
                  value={mode}
                  options={modeOptions}
                  onChange={(value) => handleModeChange(value as JSONMode)}
                  placeholder="Select reading mode..."
                  configKey="jsonMode"
                  searchable={false}
                />
              </div>
              <p className="text-xs text-theme-text-tertiary">
                {modeInfo.description}
              </p>
            </>
          ) : (
            /* Standard JSON: Fixed read mode */
            <>
              <div>
                <label className="block mb-2 text-sm font-medium text-theme-text-primary">
                  Reading Mode
                </label>
                <div className="px-3 py-2 text-sm border rounded bg-theme-surface border-theme-border-primary text-theme-text-secondary">
                  {JSON_MODE_INFO.read.name}
                </div>
              </div>
              <p className="text-xs text-theme-text-tertiary">
                Standard JSON files only support eager reading (no lazy scan available).
              </p>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        {/* File Selection */}
        <div className="space-y-4">
          <ConfigFile
            value={source}
            onChange={(value, emitPatch, shouldEmit) =>
              updateConfig("source", value, emitPatch, shouldEmit)
            }
            label="Source"
            description="Path to the JSON or NDJSON file"
            placeholder="/path/to/file.json"
            filters={[
              { name: "JSON Files", extensions: ["json"] },
              { name: "NDJSON Files", extensions: ["jsonl", "ndjson"] },
              { name: "All Files", extensions: ["*"] },
            ]}
            accept=".json,.jsonl,.ndjson"
            configKey="source"
            required
          />
        </div>

        {/* Common Options */}
        <div className="space-y-4">
          <h5 className="text-xs font-semibold tracking-wide uppercase text-theme-text-secondary">
            Schema Inference
          </h5>

          <ConfigNumber
            value={infer_schema_length ?? 100}
            onChange={(value, emitPatch, shouldEmit) =>
              updateConfig("infer_schema_length", value, emitPatch, shouldEmit)
            }
            configKey="infer_schema_length"
            label="Infer Schema Length"
            description="Number of rows to scan for type inference (empty = all rows)"
            placeholder="100"
            min={1}
            step={100}
            integerOnly
            unit="rows"
          />
        </div>

        {/* NDJSON-specific options */}
        {isNdjson && (
          <>
            <div className="space-y-4">
              <h5 className="text-xs font-semibold tracking-wide uppercase text-theme-text-secondary">
                Row Selection
              </h5>

              <ConfigNumber
                value={n_rows}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("n_rows", value, emitPatch, shouldEmit)
                }
                configKey="n_rows"
                label="Number of Rows"
                description="Maximum rows to read (leave empty for all)"
                placeholder="All rows"
                min={1}
                step={100}
                integerOnly
                unit="rows"
              />
            </div>

            {/* Advanced Options (Collapsible) */}
            <details className="space-y-4">
              <summary className="pb-1 text-sm font-semibold border-b cursor-pointer text-theme-text-primary border-theme-border-primary hover:text-theme-interactive-accent">
                Advanced Options
              </summary>

              <div className="pt-4 space-y-6">
                {/* Row Index */}
                <div className="space-y-4">
                  <h5 className="text-xs font-semibold tracking-wide uppercase text-theme-text-secondary">
                    Row Index
                  </h5>

                  <ConfigText
                    value={row_index_name ?? ""}
                    onChange={(value, emitPatch, shouldEmit) =>
                      updateConfig(
                        "row_index_name",
                        value || null,
                        emitPatch,
                        shouldEmit
                      )
                    }
                    configKey="row_index_name"
                    label="Row Index Name"
                    description="Add a row index column with this name"
                    placeholder="row_nr"
                    variant="text"
                  />

                  <ConfigNumber
                    value={row_index_offset ?? 0}
                    onChange={(value, emitPatch, shouldEmit) =>
                      updateConfig("row_index_offset", value, emitPatch, shouldEmit)
                    }
                    configKey="row_index_offset"
                    label="Row Index Offset"
                    description="Starting value for row index"
                    defaultValue={0}
                    min={0}
                    step={1}
                    integerOnly
                  />
                </div>

                {/* Performance */}
                <div className="space-y-4">
                  <h5 className="text-xs font-semibold tracking-wide uppercase text-theme-text-secondary">
                    Performance
                  </h5>

                  <ConfigNumber
                    value={batch_size ?? 1024}
                    onChange={(value, emitPatch, shouldEmit) =>
                      updateConfig("batch_size", value, emitPatch, shouldEmit)
                    }
                    configKey="batch_size"
                    label="Batch Size"
                    description="Number of rows to read per batch"
                    defaultValue={1024}
                    min={1}
                    step={256}
                    integerOnly
                    unit="rows"
                  />

                  <ConfigBoolean
                    value={low_memory ?? false}
                    onChange={(value, emitPatch, shouldEmit) =>
                      updateConfig("low_memory", value, emitPatch, shouldEmit)
                    }
                    label="Low Memory Mode"
                    description="Reduce memory usage at the cost of performance"
                    defaultValue={false}
                    configKey="low_memory"
                  />

                  <ConfigBoolean
                    value={rechunk ?? false}
                    onChange={(value, emitPatch, shouldEmit) =>
                      updateConfig("rechunk", value, emitPatch, shouldEmit)
                    }
                    label="Rechunk"
                    description="Reallocate to contiguous memory after parsing"
                    defaultValue={false}
                    configKey="rechunk"
                  />
                </div>

                {/* Error Handling */}
                <div className="space-y-4">
                  <h5 className="text-xs font-semibold tracking-wide uppercase text-theme-text-secondary">
                    Error Handling
                  </h5>

                  <ConfigBoolean
                    value={ignore_errors ?? false}
                    onChange={(value, emitPatch, shouldEmit) =>
                      updateConfig("ignore_errors", value, emitPatch, shouldEmit)
                    }
                    label="Ignore Errors"
                    description="Return null for values that don't match the schema"
                    defaultValue={false}
                    configKey="ignore_errors"
                  />
                </div>
              </div>
            </details>
          </>
        )}
      </div>
    </div>
  );
};
