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
  IPC_MODE_INFO,
  switchIpcMode,
  type IpcMode,
  type PolarsIpcConfig,
} from "@domain/dataSources/ipc";
import {
  type EmissionMap,
  type ToolConfig,
} from "@domain/workflow/entities/workflow";
import React, { useCallback } from "react";

interface IpcConfigurationProps {
  mode: IpcMode;
  config: ToolConfig;
  onChange: (updatedConfig: ToolConfig) => void;
}

export const IpcConfiguration: React.FC<IpcConfigurationProps> = ({
  mode,
  config,
  onChange,
}) => {
  const modeInfo = IPC_MODE_INFO[mode];

  const handleModeChange = useCallback(
    (newMode: IpcMode) => {
      if (newMode === mode) return;
      const switchedConfig = switchIpcMode(
        config as Partial<PolarsIpcConfig>,
        newMode
      );
      // Preserve ToolConfig fields (category, type, ipcMode) that aren't in PolarsIpcConfig
      const updatedConfig = {
        ...switchedConfig,
        category: config.category,
        type: config.type,
        ipcMode: newMode,
      } as ToolConfig;
      onChange(updatedConfig);
    },
    [mode, config, onChange]
  );

  const updateConfig = useCallback(
    (
      key: keyof PolarsIpcConfig,
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
  const cache = config.cache as boolean | undefined;
  const rechunk = config.rechunk as boolean | undefined;
  const memory_map = config.memory_map as boolean | undefined;
  const retries = config.retries as number | undefined;
  const hive_partitioning = config.hive_partitioning as boolean | undefined;
  const try_parse_hive_dates = config.try_parse_hive_dates as
    | boolean
    | undefined;

  const modeOptions: ConfigSelectOption[] = [
    { value: "scan", label: IPC_MODE_INFO.scan.name },
    { value: "read", label: IPC_MODE_INFO.read.name },
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
              onChange={(value) => handleModeChange(value as IpcMode)}
              placeholder="Select reading mode..."
              configKey="ipcMode"
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
            description="Path to the IPC/Arrow file"
            placeholder="/path/to/file.arrow"
            filters={[
              { name: "Arrow Files", extensions: ["arrow", "ipc", "feather"] },
              { name: "All Files", extensions: ["*"] },
            ]}
            accept=".arrow,.ipc,.feather"
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

          <ConfigBoolean
            value={memory_map ?? true}
            onChange={(value, emitPatch, shouldEmit) =>
              updateConfig("memory_map", value, emitPatch, shouldEmit)
            }
            label="Memory Map"
            description="Memory-map the file for efficient access to large files"
            defaultValue={true}
            configKey="memory_map"
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
                  updateConfig("row_index_name", value || null, emitPatch, shouldEmit)
                }
                label="Row Index Column"
                description="Add a row index column with this name"
                placeholder="e.g., row_nr"
                configKey="row_index_name"
              />

              <ConfigNumber
                value={row_index_offset}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("row_index_offset", value ?? 0, emitPatch, shouldEmit)
                }
                label="Row Index Offset"
                description="Start row index at this value"
                min={0}
                defaultValue={0}
                integerOnly
                configKey="row_index_offset"
              />
            </div>

            {/* Performance */}
            <div className="space-y-4">
              <h5 className="text-xs font-semibold tracking-wide uppercase text-theme-text-secondary">
                Performance
              </h5>

              {mode === "scan" && (
                <ConfigBoolean
                  value={cache ?? true}
                  onChange={(value, emitPatch, shouldEmit) =>
                    updateConfig("cache", value, emitPatch, shouldEmit)
                  }
                  label="Cache Result"
                  description="Cache the scan result for reuse"
                  defaultValue={true}
                  configKey="cache"
                />
              )}

              <ConfigBoolean
                value={rechunk ?? (mode === "read")}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("rechunk", value, emitPatch, shouldEmit)
                }
                label="Rechunk"
                description="Rechunk data to contiguous memory after reading"
                defaultValue={mode === "read"}
                configKey="rechunk"
              />

              <ConfigNumber
                value={retries}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("retries", value ?? 2, emitPatch, shouldEmit)
                }
                label="Retries"
                description="Number of retries on I/O errors"
                min={0}
                max={10}
                defaultValue={2}
                integerOnly
                configKey="retries"
              />
            </div>

            {/* Hive Partitioning (scan mode only) */}
            {mode === "scan" && (
              <div className="space-y-4">
                <h5 className="text-xs font-semibold tracking-wide uppercase text-theme-text-secondary">
                  Hive Partitioning
                </h5>

                <ConfigBoolean
                  value={hive_partitioning ?? false}
                  onChange={(value, emitPatch, shouldEmit) =>
                    updateConfig("hive_partitioning", value, emitPatch, shouldEmit)
                  }
                  label="Hive Partitioning"
                  description="Infer partition columns from directory structure"
                  defaultValue={false}
                  configKey="hive_partitioning"
                />

                {hive_partitioning && (
                  <ConfigBoolean
                    value={try_parse_hive_dates ?? true}
                    onChange={(value, emitPatch, shouldEmit) =>
                      updateConfig("try_parse_hive_dates", value, emitPatch, shouldEmit)
                    }
                    label="Parse Hive Dates"
                    description="Try to parse date columns from Hive partitions"
                    defaultValue={true}
                    configKey="try_parse_hive_dates"
                  />
                )}
              </div>
            )}
          </div>
        </details>
      </div>
    </div>
  );
};
