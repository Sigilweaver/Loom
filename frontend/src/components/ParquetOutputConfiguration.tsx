import {
  ConfigBoolean,
  ConfigFile,
  ConfigNumber,
  ConfigSelect,
  type ConfigSelectOption,
} from "@components/primitives";
import { mergeEmitPatch } from "@components/primitives/hooks";
import {
  COMPRESSION_LEVEL_RANGES,
  COMPRESSION_OPTIONS,
  PARQUET_OUTPUT_MODE_INFO,
  switchParquetOutputMode,
  type ParquetOutputMode,
  type PolarsParquetOutputConfig,
} from "@domain/dataSources/parquetOutput";
import {
  type EmissionMap,
  type ToolConfig,
} from "@domain/workflow/entities/workflow";
import React, { useCallback, useMemo } from "react";

interface ParquetOutputConfigurationProps {
  mode: ParquetOutputMode;
  config: ToolConfig;
  onChange: (updatedConfig: ToolConfig) => void;
}

export const ParquetOutputConfiguration: React.FC<
  ParquetOutputConfigurationProps
> = ({ mode, config, onChange }) => {
  const modeInfo = PARQUET_OUTPUT_MODE_INFO[mode];

  const handleModeChange = useCallback(
    (newMode: ParquetOutputMode) => {
      if (newMode === mode) return;
      const switchedConfig = switchParquetOutputMode(
        config as Partial<PolarsParquetOutputConfig>,
        newMode
      );
      // Preserve ToolConfig fields (category, type, parquetMode) that aren't in PolarsParquetOutputConfig
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
      key: keyof PolarsParquetOutputConfig,
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
    | PolarsParquetOutputConfig["compression"]
    | undefined;
  const compression_level = config.compression_level as number | null | undefined;
  const statistics = config.statistics as boolean | undefined;
  const row_group_size = config.row_group_size as number | null | undefined;
  const data_page_size = config.data_page_size as number | null | undefined;

  const modeOptions: ConfigSelectOption[] = [
    { value: "sink", label: PARQUET_OUTPUT_MODE_INFO.sink.label },
    { value: "write", label: PARQUET_OUTPUT_MODE_INFO.write.label },
  ];

  // Get compression level range for selected compression type
  const compressionLevelRange = useMemo(() => {
    if (!compression) return null;
    return COMPRESSION_LEVEL_RANGES[compression];
  }, [compression]);

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
              onChange={(value) => handleModeChange(value as ParquetOutputMode)}
              placeholder="Select output mode..."
              configKey="parquetMode"
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
                accept=".parquet"
                filters={[
                  { name: "Parquet Files", extensions: ["parquet"] },
                  { name: "All Files", extensions: ["*"] },
                ]}
                placeholder="Select output file path..."
                description="Path where the Parquet file will be written"
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
                value={compression ?? "zstd"}
                options={COMPRESSION_OPTIONS}
                onChange={(value, emitPatch, shouldEmit) => {
                  updateConfig("compression", value, emitPatch, shouldEmit);
                  // Reset compression level when changing type
                  updateConfig("compression_level", null, {}, false);
                }}
                configKey="compression"
                defaultValue="zstd"
                description="Compression algorithm to use"
                searchable
              />

              {compressionLevelRange && (
                <ConfigNumber
                  label="Compression Level"
                  value={compression_level ?? undefined}
                  onChange={(value, emitPatch, shouldEmit) =>
                    updateConfig("compression_level", value, emitPatch, shouldEmit)
                  }
                  configKey="compression_level"
                  min={compressionLevelRange.min}
                  max={compressionLevelRange.max}
                  defaultValue={compressionLevelRange.default}
                  placeholder={`Default: ${compressionLevelRange.default}`}
                  description={`Compression level (${compressionLevelRange.min}-${compressionLevelRange.max}, higher = more compression)`}
                  integerOnly
                />
              )}
            </div>
          </section>

          {/* === Statistics === */}
          <section>
            <h3 className="mb-3 text-sm font-semibold text-theme-text-primary">
              Statistics
            </h3>
            <div className="space-y-3">
              <ConfigBoolean
                label="Write Statistics"
                value={statistics ?? true}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("statistics", value, emitPatch, shouldEmit)
                }
                configKey="statistics"
                defaultValue={true}
                description="Write Parquet statistics (enables predicate pushdown)"
              />
            </div>
          </section>

          {/* === Advanced Options === */}
          <details className="space-y-4">
            <summary className="pb-1 text-sm font-semibold border-b cursor-pointer text-theme-text-primary border-theme-border-primary hover:text-theme-interactive-accent">
              Advanced Options
            </summary>

            <div className="pt-4 space-y-6">
              {/* Row Group Size */}
              <div className="space-y-4">
                <h5 className="text-xs font-semibold tracking-wide uppercase text-theme-text-secondary">
                  Row Group Configuration
                </h5>

                <ConfigNumber
                  label="Row Group Size"
                  value={row_group_size ?? undefined}
                  onChange={(value, emitPatch, shouldEmit) =>
                    updateConfig("row_group_size", value, emitPatch, shouldEmit)
                  }
                  configKey="row_group_size"
                  min={1}
                  placeholder="Auto"
                  description="Number of rows per row group (leave empty for auto)"
                  integerOnly
                  unit="rows"
                />

                <ConfigNumber
                  label="Data Page Size"
                  value={data_page_size ?? undefined}
                  onChange={(value, emitPatch, shouldEmit) =>
                    updateConfig("data_page_size", value, emitPatch, shouldEmit)
                  }
                  configKey="data_page_size"
                  min={1024}
                  step={1024}
                  placeholder="Auto"
                  description="Data page size in bytes (leave empty for auto)"
                  integerOnly
                  unit="bytes"
                />
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};
