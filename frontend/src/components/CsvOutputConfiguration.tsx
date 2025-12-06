import {
  ConfigBoolean,
  ConfigFile,
  ConfigNumber,
  ConfigSelect,
  ConfigSelectWithCustom,
  ConfigText,
  type ConfigSelectOption,
} from "@components/primitives";
import { mergeEmitPatch } from "@components/primitives/hooks";
import {
  COMMON_LINE_TERMINATORS,
  COMMON_SEPARATORS,
  CSV_OUTPUT_DOCUMENTATION_URL,
  CSV_OUTPUT_MODE_INFO,
  QUOTE_STYLE_OPTIONS,
  switchCsvOutputMode,
  type CSVOutputMode,
  type PolarsCsvOutputConfig,
} from "@domain/dataSources/csvOutput";
import {
  type EmissionMap,
  type ToolConfig,
} from "@domain/workflow/entities/workflow";
import React, { useCallback } from "react";

interface CsvOutputConfigurationProps {
  mode: CSVOutputMode;
  config: ToolConfig;
  onChange: (updatedConfig: ToolConfig) => void;
}

export const CsvOutputConfiguration: React.FC<CsvOutputConfigurationProps> = ({
  mode,
  config,
  onChange,
}) => {
  const modeInfo = CSV_OUTPUT_MODE_INFO[mode];

  const handleModeChange = useCallback(
    (newMode: CSVOutputMode) => {
      if (newMode === mode) return;
      const switchedConfig = switchCsvOutputMode(
        config as Partial<PolarsCsvOutputConfig>,
        newMode
      );
      // Preserve ToolConfig fields (category, type, csvMode) that aren't in PolarsCsvOutputConfig
      const updatedConfig = {
        ...switchedConfig,
        category: config.category,
        type: config.type,
        csvMode: newMode,
      } as ToolConfig;
      onChange(updatedConfig);
    },
    [mode, config, onChange]
  );

  const updateConfig = useCallback(
    (
      key: keyof PolarsCsvOutputConfig,
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
  const separator = config.separator as string | undefined;
  const include_header = config.include_header as boolean | undefined;
  const include_bom = config.include_bom as boolean | undefined;
  const quote_char = config.quote_char as string | undefined;
  const line_terminator = config.line_terminator as string | undefined;
  const batch_size = config.batch_size as number | undefined;
  const datetime_format = config.datetime_format as string | null | undefined;
  const date_format = config.date_format as string | null | undefined;
  const time_format = config.time_format as string | null | undefined;
  const float_scientific = config.float_scientific as boolean | null | undefined;
  const float_precision = config.float_precision as number | null | undefined;
  const null_value = config.null_value as string | undefined;
  const quote_style = config.quote_style as
    | PolarsCsvOutputConfig["quote_style"]
    | undefined;

  const modeOptions: ConfigSelectOption[] = [
    { value: "sink", label: CSV_OUTPUT_MODE_INFO.sink.label },
    { value: "write", label: CSV_OUTPUT_MODE_INFO.write.label },
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
              onChange={(value) => handleModeChange(value as CSVOutputMode)}
              placeholder="Select output mode..."
              configKey="csvMode"
            />
            <p className="mt-2 text-xs text-theme-text-tertiary">
              {modeInfo.description}
            </p>
          </div>
          <a
            href={CSV_OUTPUT_DOCUMENTATION_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
            style={{ color: 'var(--color-border-focus)' }}
          >
            Learn more
          </a>
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
                accept=".csv"
                filters={[
                  { name: "CSV Files", extensions: ["csv"] },
                  { name: "All Files", extensions: ["*"] },
                ]}
                placeholder="Select output file path..."
                description="Path where the CSV file will be written"
                required
              />
            </div>
          </section>

          {/* === Basic Options === */}
          <section>
            <h3 className="mb-3 text-sm font-semibold text-theme-text-primary">
              Basic Options
            </h3>
            <div className="space-y-3">
              <ConfigBoolean
                label="Include Header"
                value={include_header ?? true}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("include_header", value, emitPatch, shouldEmit)
                }
                configKey="include_header"
                defaultValue={true}
                description="Include column names as first row"
              />

              <ConfigBoolean
                label="Include BOM"
                value={include_bom ?? false}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("include_bom", value, emitPatch, shouldEmit)
                }
                configKey="include_bom"
                defaultValue={false}
                description="Include UTF-8 byte order mark"
              />
            </div>
          </section>

          {/* === Delimiters === */}
          <section>
            <h3 className="mb-3 text-sm font-semibold text-theme-text-primary">
              Delimiters
            </h3>
            <div className="space-y-3">
              <ConfigSelectWithCustom
                label="Separator"
                value={separator ?? ","}
                options={COMMON_SEPARATORS}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("separator", value, emitPatch, shouldEmit)
                }
                configKey="separator"
                description="Character used to separate columns"
              />

              <ConfigSelectWithCustom
                label="Line Terminator"
                value={line_terminator ?? "\n"}
                options={COMMON_LINE_TERMINATORS}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("line_terminator", value, emitPatch, shouldEmit)
                }
                configKey="line_terminator"
                description="Character sequence to end each row"
              />

              <ConfigText
                label="Quote Character"
                value={quote_char ?? '"'}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("quote_char", value, emitPatch, shouldEmit)
                }
                configKey="quote_char"
                placeholder={'"'}
                description="Character used to quote values containing delimiters"
              />

              <ConfigSelect
                label="Quote Style"
                value={quote_style ?? "necessary"}
                options={QUOTE_STYLE_OPTIONS}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("quote_style", value, emitPatch, shouldEmit)
                }
                configKey="quote_style"
                description="When to apply quotes to values"
              />
            </div>
          </section>

          {/* === Formatting === */}
          <section>
            <h3 className="mb-3 text-sm font-semibold text-theme-text-primary">
              Formatting
            </h3>
            <div className="space-y-3">
              <ConfigText
                label="Null Value"
                value={null_value ?? ""}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("null_value", value, emitPatch, shouldEmit)
                }
                configKey="null_value"
                placeholder="(empty string)"
                description="String to represent null/missing values"
              />

              <ConfigText
                label="Datetime Format"
                value={datetime_format ?? ""}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig(
                    "datetime_format",
                    value || null,
                    emitPatch,
                    shouldEmit
                  )
                }
                configKey="datetime_format"
                placeholder="%Y-%m-%d %H:%M:%S"
                description="Format string for datetime columns (e.g., %Y-%m-%d %H:%M:%S)"
              />

              <ConfigText
                label="Date Format"
                value={date_format ?? ""}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("date_format", value || null, emitPatch, shouldEmit)
                }
                configKey="date_format"
                placeholder="%Y-%m-%d"
                description="Format string for date columns (e.g., %Y-%m-%d)"
              />

              <ConfigText
                label="Time Format"
                value={time_format ?? ""}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("time_format", value || null, emitPatch, shouldEmit)
                }
                configKey="time_format"
                placeholder="%H:%M:%S"
                description="Format string for time columns (e.g., %H:%M:%S)"
              />
            </div>
          </section>

          {/* === Float Formatting === */}
          <section>
            <h3 className="mb-3 text-sm font-semibold text-theme-text-primary">
              Float Formatting
            </h3>
            <div className="space-y-3">
              <ConfigNumber
                label="Float Precision"
                value={float_precision ?? undefined}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("float_precision", value, emitPatch, shouldEmit)
                }
                configKey="float_precision"
                min={0}
                max={17}
                placeholder="Auto"
                description="Number of decimal places for float values (empty = auto)"
              />

              <ConfigBoolean
                label="Float Scientific Notation"
                value={float_scientific ?? false}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("float_scientific", value, emitPatch, shouldEmit)
                }
                configKey="float_scientific"
                defaultValue={false}
                description="Use scientific notation for float values"
              />
            </div>
          </section>

          {/* === Performance === */}
          <section>
            <h3 className="mb-3 text-sm font-semibold text-theme-text-primary">
              Performance
            </h3>
            <div className="space-y-3">
              <ConfigNumber
                label="Batch Size"
                value={batch_size ?? 1024}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("batch_size", value, emitPatch, shouldEmit)
                }
                configKey="batch_size"
                min={1}
                placeholder="1024"
                description="Number of rows to write per batch"
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
