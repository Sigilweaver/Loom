import {
  ConfigFile,
  ConfigSelect,
  type ConfigSelectOption,
} from "@components/primitives";
import { mergeEmitPatch } from "@components/primitives/hooks";
import {
  IPC_COMPRESSION_OPTIONS,
  IPC_OUTPUT_MODE_INFO,
  switchIpcOutputMode,
  type IpcOutputMode,
  type PolarsIpcOutputConfig,
} from "@domain/dataSources/ipcOutput";
import {
  type EmissionMap,
  type ToolConfig,
} from "@domain/workflow/entities/workflow";
import React, { useCallback } from "react";

interface IpcOutputConfigurationProps {
  mode: IpcOutputMode;
  config: ToolConfig;
  onChange: (updatedConfig: ToolConfig) => void;
}

export const IpcOutputConfiguration: React.FC<IpcOutputConfigurationProps> = ({
  mode,
  config,
  onChange,
}) => {
  const modeInfo = IPC_OUTPUT_MODE_INFO[mode];

  const handleModeChange = useCallback(
    (newMode: IpcOutputMode) => {
      if (newMode === mode) return;
      const switchedConfig = switchIpcOutputMode(
        config as Partial<PolarsIpcOutputConfig>,
        newMode
      );
      // Preserve ToolConfig fields (category, type, ipcMode) that aren't in PolarsIpcOutputConfig
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
      key: keyof PolarsIpcOutputConfig,
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
  const destination = config.destination as string | undefined;
  const compression = config.compression as
    | PolarsIpcOutputConfig["compression"]
    | undefined;

  const modeOptions: ConfigSelectOption[] = [
    { value: "sink", label: IPC_OUTPUT_MODE_INFO.sink.label },
    { value: "write", label: IPC_OUTPUT_MODE_INFO.write.label },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Mode Selector */}
      <div className="p-4 border-b bg-theme-surface-elevated border-theme-border-primary">
        <div className="space-y-3">
          <div>
            <label className="block mb-2 text-sm font-medium text-theme-text-primary">
              Output Mode
            </label>
            <ConfigSelect
              value={mode}
              options={modeOptions}
              onChange={(value) => handleModeChange(value as IpcOutputMode)}
              placeholder="Select output mode..."
              configKey="ipcMode"
            />
            <p className="mt-2 text-xs text-theme-text-tertiary">
              {modeInfo.description}
            </p>
          </div>
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
                accept=".arrow,.ipc,.feather"
                filters={[
                  { name: "Arrow Files", extensions: ["arrow", "ipc", "feather"] },
                  { name: "All Files", extensions: ["*"] },
                ]}
                placeholder="Select output file path..."
                description="Path where the IPC/Arrow file will be written"
                required
              />
            </div>
          </section>

          {/* === Compression === */}
          <section>
            <h3 className="mb-3 text-sm font-semibold text-theme-text-primary">
              Compression
            </h3>
            <div className="space-y-3">
              <ConfigSelect
                label="Compression Type"
                value={compression ?? "uncompressed"}
                options={IPC_COMPRESSION_OPTIONS}
                onChange={(value, emitPatch, shouldEmit) => {
                  updateConfig("compression", value, emitPatch, shouldEmit);
                }}
                configKey="compression"
                defaultValue="uncompressed"
                description="Compression algorithm to use (IPC supports fewer options than Parquet)"
                searchable={false}
              />
            </div>
          </section>

          {/* Info box about IPC format */}
          <section className="p-3 border rounded-lg bg-theme-surface-elevated border-theme-border-primary">
            <h4 className="mb-2 text-sm font-medium text-theme-text-primary">
              About IPC/Arrow Format
            </h4>
            <ul className="space-y-1 text-xs text-theme-text-secondary">
              <li>
                - <strong>Fastest</strong> read/write performance of all formats
              </li>
              <li>
                - <strong>Zero-copy</strong> data sharing between processes
              </li>
              <li>
                - <strong>Memory-mapped</strong> access for huge files
              </li>
              <li>
                - Compatible with Arrow ecosystem (DuckDB, Spark, R, Julia)
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};
