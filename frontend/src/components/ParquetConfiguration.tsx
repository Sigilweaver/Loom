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
  PARALLEL_STRATEGIES,
  PARQUET_MODE_INFO,
  switchParquetMode,
  type ParquetMode,
  type PolarsParquetConfig,
} from "@domain/dataSources/parquet";
import {
  type EmissionMap,
  type ToolConfig,
} from "@domain/workflow/entities/workflow";
import React, { useCallback } from "react";

interface ParquetConfigurationProps {
  mode: ParquetMode;
  config: ToolConfig;
  onChange: (updatedConfig: ToolConfig) => void;
}

export const ParquetConfiguration: React.FC<ParquetConfigurationProps> = ({
  mode,
  config,
  onChange,
}) => {
  const modeInfo = PARQUET_MODE_INFO[mode];

  const handleModeChange = useCallback(
    (newMode: ParquetMode) => {
      if (newMode === mode) return;
      const switchedConfig = switchParquetMode(
        config as Partial<PolarsParquetConfig>,
        newMode
      );
      // Preserve ToolConfig fields (category, type, parquetMode) that aren't in PolarsParquetConfig
      const updatedConfig = {
        ...switchedConfig,
        category: config.category,
        type: config.type,
        parquetMode: newMode,
      } as ToolConfig;
      onChange(updatedConfig);
    },
    [mode, config, onChange]
  );

  const updateConfig = useCallback(
    (
      key: keyof PolarsParquetConfig,
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
  const source = config.source as string | undefined;
  const n_rows = config.n_rows as number | undefined;
  const row_index_name = config.row_index_name as string | undefined;
  const row_index_offset = config.row_index_offset as number | undefined;
  const parallel = config.parallel as string | undefined;
  const use_statistics = config.use_statistics as boolean | undefined;
  const rechunk = config.rechunk as boolean | undefined;
  const low_memory = config.low_memory as boolean | undefined;
  const cache = config.cache as boolean | undefined;
  const retries = config.retries as number | undefined;
  const hive_partitioning = config.hive_partitioning as boolean | undefined;
  const hive_schema = config.hive_schema as Record<string, string> | undefined;
  const try_parse_hive_dates = config.try_parse_hive_dates as
    | boolean
    | undefined;

  const modeOptions: ConfigSelectOption[] = [
    { value: "scan", label: PARQUET_MODE_INFO.scan.name },
    { value: "read", label: PARQUET_MODE_INFO.read.name },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Mode Selector */}
      <div className="p-4 border-b bg-theme-surface-elevated border-theme-border-primary">
        <div className="space-y-3">
          <div>
            <label className="block mb-2 text-sm font-medium text-theme-text-primary">
              Reading Mode
            </label>
            <ConfigSelect
              value={mode}
              options={modeOptions}
              onChange={(value) => handleModeChange(value as ParquetMode)}
              placeholder="Select reading mode..."
              configKey="parquetMode"
              searchable={false}
            />
          </div>
          <p className="text-xs text-theme-text-tertiary">
            {modeInfo.description}
          </p>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        {/* Common Options */}
        <div className="space-y-4">
          <ConfigFile
            value={source}
            onChange={(value, emitPatch, shouldEmit) =>
              updateConfig("source", value, emitPatch, shouldEmit)
            }
            label="Source"
            description="Path to the Parquet file"
            placeholder="/path/to/file.parquet"
            filters={[
              { name: "Parquet Files", extensions: ["parquet"] },
              { name: "All Files", extensions: ["*"] },
            ]}
            accept=".parquet"
            configKey="source"
            required
          />

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

          <ConfigSelect
            value={parallel || "auto"}
            onChange={(value, emitPatch, shouldEmit) =>
              updateConfig("parallel", value, emitPatch, shouldEmit)
            }
            configKey="parallel"
            label="Parallel Strategy"
            description="How to parallelize reading"
            options={PARALLEL_STRATEGIES.map((strategy) => ({
              value: strategy.value,
              label: strategy.label,
              description: strategy.description,
            }))}
            defaultValue="auto"
          />

          <ConfigBoolean
            value={use_statistics ?? true}
            onChange={(value, emitPatch, shouldEmit) =>
              updateConfig("use_statistics", value, emitPatch, shouldEmit)
            }
            label="Use Statistics"
            description="Use Parquet statistics for filtering (faster)"
            defaultValue={true}
            configKey="use_statistics"
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
                value={row_index_name}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("row_index_name", value, emitPatch, shouldEmit)
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

            {/* Performance Tuning */}
            <div className="space-y-4">
              <h5 className="text-xs font-semibold tracking-wide uppercase text-theme-text-secondary">
                Performance Tuning
              </h5>

              <ConfigBoolean
                value={rechunk ?? (mode === "read" ? true : false)}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("rechunk", value, emitPatch, shouldEmit)
                }
                label="Rechunk"
                description="Reallocate to contiguous memory after reading"
                defaultValue={mode === "read"}
                configKey="rechunk"
              />

              <ConfigBoolean
                value={low_memory}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("low_memory", value, emitPatch, shouldEmit)
                }
                label="Low Memory"
                description="Reduce memory usage at the cost of performance"
                defaultValue={false}
                configKey="low_memory"
              />

              <ConfigNumber
                value={retries ?? 2}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("retries", value, emitPatch, shouldEmit)
                }
                configKey="retries"
                label="Retries"
                description="Number of retries on I/O errors"
                defaultValue={2}
                min={0}
                max={10}
                step={1}
                integerOnly
              />
            </div>

            {/* Mode-Specific Options */}
            {mode === "scan" && (
              <div className="space-y-4">
                <h5 className="text-xs font-semibold tracking-wide uppercase text-theme-text-secondary">
                  Scan Mode Options
                </h5>

                <ConfigBoolean
                  value={cache ?? true}
                  onChange={(value, emitPatch, shouldEmit) =>
                    updateConfig("cache", value, emitPatch, shouldEmit)
                  }
                  label="Cache"
                  description="Cache the result after reading"
                  defaultValue={true}
                  configKey="cache"
                />
              </div>
            )}

            {/* Hive Partitioning */}
            <div className="space-y-4">
              <h5 className="text-xs font-semibold tracking-wide uppercase text-theme-text-secondary">
                Hive Partitioning
              </h5>

              <ConfigBoolean
                value={hive_partitioning}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("hive_partitioning", value, emitPatch, shouldEmit)
                }
                label="Hive Partitioning"
                description="Infer schema from Hive-style directory structure"
                defaultValue={false}
                configKey="hive_partitioning"
              />

              {hive_partitioning && (
                <>
                  <ConfigText
                    value={
                      hive_schema
                        ? Object.entries(hive_schema)
                            .map(([k, v]) => `${k}:${v}`)
                            .join(", ")
                        : ""
                    }
                    onChange={(value, emitPatch, shouldEmit) => {
                      const schema =
                        value && value.trim()
                          ? Object.fromEntries(
                              value
                                .split(",")
                                .map((s) => s.trim().split(":") as [string, string])
                            )
                          : null;
                      updateConfig("hive_schema", schema, emitPatch, shouldEmit);
                    }}
                    configKey="hive_schema"
                    label="Hive Schema"
                    description="Explicit Hive partition schema (format: col1:type1, col2:type2)"
                    placeholder="year:Int32, month:Int32"
                    variant="text"
                  />

                  <ConfigBoolean
                    value={try_parse_hive_dates ?? true}
                    onChange={(value, emitPatch, shouldEmit) =>
                      updateConfig(
                        "try_parse_hive_dates",
                        value,
                        emitPatch,
                        shouldEmit
                      )
                    }
                    label="Try Parse Hive Dates"
                    description="Attempt to parse Hive partition values as dates"
                    defaultValue={true}
                    configKey="try_parse_hive_dates"
                  />
                </>
              )}
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};
