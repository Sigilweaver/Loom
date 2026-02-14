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
  COMMON_ENCODINGS,
  CSV_DOCUMENTATION_URL,
  CSV_MODE_INFO,
  switchCsvMode,
  type CSVMode,
  type PolarsCsvConfig,
} from "@domain/dataSources/csv";
import {
  type EmissionMap,
  type ToolConfig,
} from "@domain/workflow/entities/workflow";
import React, { useCallback } from "react";

interface CsvConfigurationProps {
  mode: CSVMode;
  config: ToolConfig;
  onChange: (updatedConfig: ToolConfig) => void;
}

export const CsvConfiguration: React.FC<CsvConfigurationProps> = ({
  mode,
  config,
  onChange,
}) => {
  const modeInfo = CSV_MODE_INFO[mode];

  const handleModeChange = useCallback(
    (newMode: CSVMode) => {
      if (newMode === mode) return;
      const switchedConfig = switchCsvMode(
        config as Partial<PolarsCsvConfig>,
        newMode
      );
      // Preserve ToolConfig fields (category, type, csvMode) that aren't in PolarsCsvConfig
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
      key: keyof PolarsCsvConfig,
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
  const separator = config.separator as string | undefined;
  const has_header = config.has_header as boolean | undefined;
  const quote_char = config.quote_char as string | undefined;
  const encoding = config.encoding as PolarsCsvConfig["encoding"] | undefined;
  const skip_rows = config.skip_rows as number | undefined;
  const n_rows = config.n_rows as number | undefined;
  const columns = config.columns as string[] | null | undefined;
  const new_columns = config.new_columns as string[] | null | undefined;
  const skip_rows_after_header = config.skip_rows_after_header as
    | number
    | undefined;
  const infer_schema_length = config.infer_schema_length as number | undefined;
  const eol_char = config.eol_char as PolarsCsvConfig["eol_char"] | undefined;
  const null_values = config.null_values as
    | PolarsCsvConfig["null_values"]
    | undefined;
  const ignore_errors = config.ignore_errors as boolean | undefined;
  const try_parse_dates = config.try_parse_dates as boolean | undefined;
  const missing_utf8_is_empty_string = config.missing_utf8_is_empty_string as
    | boolean
    | undefined;
  const rechunk = config.rechunk as boolean | undefined;
  const comment_prefix = config.comment_prefix as string | undefined;
  const row_index_name = config.row_index_name as string | undefined;
  const row_index_offset = config.row_index_offset as number | undefined;
  const truncate_ragged_lines = config.truncate_ragged_lines as
    | boolean
    | undefined;
  const decimal_comma = config.decimal_comma as boolean | undefined;
  const cache = config.cache as boolean | undefined;
  const low_memory = config.low_memory as boolean | undefined;
  const n_threads = config.n_threads as number | undefined;

  const separatorOptions: ConfigSelectOption[] = [
    { value: ",", label: "Comma (,)", description: "Standard CSV format" },
    { value: "\t", label: "Tab (\\t)", description: "TSV format" },
    { value: "|", label: "Pipe (|)", description: "Pipe-delimited" },
    { value: ";", label: "Semicolon (;)", description: "European CSV" },
    { value: " ", label: "Space", description: "Space-delimited" },
  ];

  const quoteCharOptions: ConfigSelectOption[] = [
    {
      value: '"',
      label: 'Double Quote (")',
      description: "Standard CSV quoting",
    },
    { value: "'", label: "Single Quote (')", description: "Alternate quoting" },
    { value: "", label: "None", description: "No quote character" },
  ];

  const modeOptions: ConfigSelectOption[] = [
    { value: "scan", label: CSV_MODE_INFO.scan.name },
    { value: "read", label: CSV_MODE_INFO.read.name },
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
              onChange={(value) => handleModeChange(value as CSVMode)}
              placeholder="Select reading mode..."
              configKey="csvMode"
              searchable={false}
            />
          </div>
          <p className="text-xs text-theme-text-tertiary">
            {modeInfo.description}
          </p>
          <a
            href={CSV_DOCUMENTATION_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
            style={{ color: 'var(--color-border-focus)' }}
          >
            Learn more
          </a>
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
            description="Path to the CSV file"
            placeholder="/path/to/file.csv"
            filters={[
              { name: "CSV Files", extensions: ["csv"] },
              { name: "TSV Files", extensions: ["tsv", "tab", "txt"] },
              { name: "All Files", extensions: ["*"] },
            ]}
            accept=".csv,.tsv,.tab,.txt"
            configKey="source"
            required
          />

          <ConfigSelectWithCustom
            value={separator || ","}
            onChange={(value, emitPatch, shouldEmit) =>
              updateConfig("separator", value, emitPatch, shouldEmit)
            }
            configKey="separator"
            label="Separator Character"
            description="Character used to separate fields (e.g., \\t for tab)"
            options={separatorOptions}
            defaultValue=","
            customOptionLabel="Custom..."
            customInputPlaceholder="Enter character(s) (e.g., \\t, \\r)"
          />

          <ConfigBoolean
            value={has_header}
            onChange={(value, emitPatch, shouldEmit) =>
              updateConfig("has_header", value, emitPatch, shouldEmit)
            }
            label="Has Header"
            description="First row contains column names"
            defaultValue={true}
            configKey="has_header"
          />

          <ConfigSelectWithCustom
            value={quote_char !== undefined ? quote_char : '"'}
            onChange={(value, emitPatch, shouldEmit) =>
              updateConfig("quote_char", value, emitPatch, shouldEmit)
            }
            configKey="quote_char"
            label="Quote Character"
            description="Character used for quoting fields"
            options={quoteCharOptions}
            defaultValue='"'
            customOptionLabel="Custom..."
            customInputPlaceholder="Enter character(s)"
          />

          <ConfigSelect
            value={encoding || "utf8"}
            onChange={(value, emitPatch, shouldEmit) =>
              updateConfig("encoding", value, emitPatch, shouldEmit)
            }
            configKey="encoding"
            label="Encoding"
            description="Character encoding of the file"
            options={COMMON_ENCODINGS.map((enc) => ({
              value: enc.value,
              label: enc.label,
              description: enc.description,
            }))}
            searchable
            defaultValue="utf8"
          />

          <ConfigNumber
            value={skip_rows ?? 0}
            onChange={(value, emitPatch, shouldEmit) =>
              updateConfig("skip_rows", value, emitPatch, shouldEmit)
            }
            configKey="skip_rows"
            label="Skip Rows"
            description="Number of rows to skip at the start"
            defaultValue={0}
            min={0}
            step={1}
            integerOnly
            unit="rows"
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
        </div>

        {/* Advanced Options (Collapsible) */}
        <details className="space-y-4">
          <summary className="pb-1 text-sm font-semibold border-b cursor-pointer text-theme-text-primary border-theme-border-primary hover:text-theme-interactive-accent">
            Advanced Options
          </summary>

          <div className="pt-4 space-y-6">
            {/* Column Selection */}
            <div className="space-y-4">
              <h5 className="text-xs font-semibold tracking-wide uppercase text-theme-text-secondary">
                Column Selection
              </h5>

              <ConfigText
                value={columns ? columns.join(", ") : ""}
                onChange={(value, emitPatch, shouldEmit) => {
                  const colArray =
                    value && value.trim()
                      ? value.split(",").map((s) => s.trim())
                      : null;
                  updateConfig("columns", colArray, emitPatch, shouldEmit);
                }}
                configKey="columns"
                label="Columns"
                description="Comma-separated list of columns to read (leave empty for all)"
                placeholder="col1, col2, col3"
                variant="text"
              />

              <ConfigText
                value={new_columns ? new_columns.join(", ") : ""}
                onChange={(value, emitPatch, shouldEmit) => {
                  const colArray =
                    value && value.trim()
                      ? value.split(",").map((s) => s.trim())
                      : null;
                  updateConfig("new_columns", colArray, emitPatch, shouldEmit);
                }}
                configKey="new_columns"
                label="Rename Columns"
                description="Comma-separated list of new column names (must match number of columns)"
                placeholder="new_col1, new_col2, new_col3"
                variant="text"
              />
            </div>

            {/* Row Options */}
            <div className="space-y-4">
              <h5 className="text-xs font-semibold tracking-wide uppercase text-theme-text-secondary">
                Row Options
              </h5>

              <ConfigNumber
                value={skip_rows_after_header ?? 0}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig(
                    "skip_rows_after_header",
                    value,
                    emitPatch,
                    shouldEmit
                  )
                }
                configKey="skip_rows_after_header"
                label="Skip Rows After Header"
                description="Number of rows to skip after the header row"
                defaultValue={0}
                min={0}
                step={1}
                integerOnly
                unit="rows"
              />

              <ConfigText
                value={comment_prefix}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("comment_prefix", value, emitPatch, shouldEmit)
                }
                configKey="comment_prefix"
                label="Comment Prefix"
                description="Skip lines starting with this string"
                placeholder="# or //"
                variant="text"
              />

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

              <ConfigBoolean
                value={truncate_ragged_lines}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig(
                    "truncate_ragged_lines",
                    value,
                    emitPatch,
                    shouldEmit
                  )
                }
                label="Truncate Ragged Lines"
                description="Truncate lines longer than the schema"
                defaultValue={false}
                configKey="truncate_ragged_lines"
              />
            </div>

            {/* Parsing Options */}
            <div className="space-y-4">
              <h5 className="text-xs font-semibold tracking-wide uppercase text-theme-text-secondary">
                Parsing Options
              </h5>

              <ConfigSelect
                value={eol_char || "\n"}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("eol_char", value, emitPatch, shouldEmit)
                }
                configKey="eol_char"
                label="End of Line Character"
                description="Character(s) used to denote end of line"
                options={[
                  {
                    value: "\n",
                    label: "LF (\\n)",
                    description: "Unix/Linux/macOS",
                  },
                  {
                    value: "\r\n",
                    label: "CRLF (\\r\\n)",
                    description: "Windows",
                  },
                  { value: "\r", label: "CR (\\r)", description: "Old Mac" },
                ]}
                defaultValue="\n"
              />

              <ConfigText
                value={
                  null_values
                    ? Array.isArray(null_values)
                      ? null_values.join(", ")
                      : String(null_values)
                    : ""
                }
                onChange={(value, emitPatch, shouldEmit) => {
                  const nullArray =
                    value && value.trim()
                      ? value.split(",").map((s) => s.trim())
                      : null;
                  updateConfig("null_values", nullArray, emitPatch, shouldEmit);
                }}
                configKey="null_values"
                label="Null Values"
                description="Comma-separated list of strings to interpret as null"
                placeholder="NA, null, None"
                variant="text"
              />

              <ConfigBoolean
                value={decimal_comma}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("decimal_comma", value, emitPatch, shouldEmit)
                }
                label="Decimal Comma"
                description="Use comma as decimal separator (European format)"
                defaultValue={false}
                configKey="decimal_comma"
              />
            </div>

            {/* Type Inference */}
            <div className="space-y-4">
              <h5 className="text-xs font-semibold tracking-wide uppercase text-theme-text-secondary">
                Type Inference
              </h5>

              <ConfigNumber
                value={infer_schema_length}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig(
                    "infer_schema_length",
                    value,
                    emitPatch,
                    shouldEmit
                  )
                }
                configKey="infer_schema_length"
                label="Infer Schema Length"
                description="Maximum rows to scan for schema inference (leave empty for all)"
                placeholder="All rows"
                min={1}
                step={100}
                integerOnly
                unit="rows"
              />

              <ConfigBoolean
                value={try_parse_dates}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("try_parse_dates", value, emitPatch, shouldEmit)
                }
                label="Try Parse Dates"
                description="Automatically parse date columns"
                defaultValue={false}
                configKey="try_parse_dates"
              />
            </div>

            {/* Error Handling */}
            <div className="space-y-4">
              <h5 className="text-xs font-semibold tracking-wide uppercase text-theme-text-secondary">
                Error Handling
              </h5>

              <ConfigBoolean
                value={ignore_errors}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("ignore_errors", value, emitPatch, shouldEmit)
                }
                label="Ignore Errors"
                description="Skip lines with parse errors instead of failing"
                defaultValue={false}
                configKey="ignore_errors"
              />

              <ConfigBoolean
                value={missing_utf8_is_empty_string}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig(
                    "missing_utf8_is_empty_string",
                    value,
                    emitPatch,
                    shouldEmit
                  )
                }
                label="Missing UTF-8 as Empty String"
                description="Treat missing UTF-8 values as empty strings"
                defaultValue={false}
                configKey="missing_utf8_is_empty_string"
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
            )}

            {mode === "read" && (
              <div className="space-y-4">
                <h5 className="text-xs font-semibold tracking-wide uppercase text-theme-text-secondary">
                  Read Mode Options
                </h5>

                <ConfigNumber
                  value={n_threads}
                  onChange={(value, emitPatch, shouldEmit) =>
                    updateConfig("n_threads", value, emitPatch, shouldEmit)
                  }
                  configKey="n_threads"
                  label="Number of Threads"
                  description="Threads for parallel parsing (leave empty for auto)"
                  placeholder="Auto"
                  min={1}
                  max={32}
                  step={1}
                  integerOnly
                  unit="threads"
                />

                <ConfigBoolean
                  value={rechunk ?? true}
                  onChange={(value, emitPatch, shouldEmit) =>
                    updateConfig("rechunk", value, emitPatch, shouldEmit)
                  }
                  label="Rechunk"
                  description="Reallocate to contiguous memory after parsing"
                  defaultValue={true}
                  configKey="rechunk"
                />
              </div>
            )}
          </div>
        </details>
      </div>
    </div>
  );
};
