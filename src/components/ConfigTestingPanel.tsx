import { EmissionMap, ToolConfig } from "@domain/workflow/entities/workflow";
import React from "react";
import {
  BrowserFileWarning,
  ColumnOperation,
  ConfigBoolean,
  ConfigColumnList,
  ConfigFile,
  ConfigKeyValueList,
  ConfigMultiSelect,
  ConfigNumber,
  ConfigNumberRange,
  ConfigSelect,
  ConfigText,
  ItemHandlers,
  KeyValuePair,
  type ConfigNumberRangeValue,
} from "./primitives";
import { mergeEmitPatch } from "./primitives/hooks";

const CSV_DELIMITER_OPTIONS = [
  {
    value: ",",
    label: "Comma (,)",
    description: "Default for most CSV exports",
    keywords: ["comma", "csv", "delimiter"],
  },
  {
    value: "\t",
    label: "Tab (\\t)",
    description: "Tab separated values (TSV)",
    keywords: ["tab", "tsv"],
  },
  {
    value: "|",
    label: "Pipe (|)",
    keywords: ["pipe", "log"],
  },
  {
    value: ";",
    label: "Semicolon (;)",
    keywords: ["semicolon", "regional"],
  },
  {
    value: ":",
    label: "Colon (:)",
    keywords: ["custom"],
  },
];

const FILE_ENCODING_OPTIONS = [
  {
    value: "utf-8",
    label: "UTF-8 (default)",
    description: "Unicode, works for most datasets",
    keywords: ["unicode", "default"],
  },
  {
    value: "utf-16le",
    label: "UTF-16 Little Endian",
    keywords: ["unicode", "double-byte"],
  },
  {
    value: "iso-8859-1",
    label: "ISO-8859-1",
    description: "Latin-1 / Western European",
    keywords: ["latin", "iso"],
  },
  {
    value: "windows-1252",
    label: "Windows-1252",
    keywords: ["windows", "legacy"],
  },
];

const THEME_MODE_OPTIONS = [
  {
    value: "system",
    label: "Follow system",
    description: "Automatically switches between dark and light",
  },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  {
    value: "high-contrast",
    label: "High contrast",
    description: "Optimised for accessibility",
    disabled: true,
  },
];

const ROW_SAMPLE_DEFAULT: ConfigNumberRangeValue = { start: 1, end: 100 };
const BATCH_WINDOW_DEFAULT: ConfigNumberRangeValue = { start: 0, end: 500 };

interface ConfigTestingPanelProps {
  config: ToolConfig;
  onChange: (config: ToolConfig) => void;
}

export const ConfigTestingPanel: React.FC<ConfigTestingPanelProps> = ({
  config,
  onChange,
}) => {
  const updateConfig = (
    key: string,
    value: unknown,
    emitPatch: EmissionMap,
    _shouldEmit: boolean
  ) => {
    const nextConfig: ToolConfig = { ...config };

    if (value === undefined || value === "") {
      delete nextConfig[key];
    } else {
      nextConfig[key] = value as never;
    }

    const mergedEmit = mergeEmitPatch(config._emit, emitPatch);
    if (Object.keys(mergedEmit).length === 0) {
      delete nextConfig._emit;
    } else {
      nextConfig._emit = mergedEmit;
    }

    onChange(nextConfig);
  };

  const validateBatchWindow = React.useCallback(
    (range: ConfigNumberRangeValue) => {
      if (range.start != null && range.end != null) {
        const span = range.end - range.start;
        if (span > 500) {
          return "Limit batches to 500 rows at a time.";
        }
      }
      return null;
    },
    []
  );

  const formatRangeSummary = (range: ConfigNumberRangeValue | undefined) => {
    if (!range) {
      return "none";
    }
    const { start, end } = range;
    if (start === undefined && end === undefined) {
      return "none";
    }
    return JSON.stringify(range);
  };

  const selectDelimiterValue = config.selectDelimiter as string | undefined;
  const selectDelimiterSummary = selectDelimiterValue
    ? JSON.stringify(selectDelimiterValue)
    : "none";
  const fileEncodingValue = config.fileEncoding as string | undefined;
  const fileEncodingSummary = fileEncodingValue ?? "none";
  const themeModeValue = config.themeMode as string | undefined;
  const themeModeSummary = themeModeValue ?? "system (default)";

  const rowSampleRangeSummary = formatRangeSummary(
    config.rowSampleRange as ConfigNumberRangeValue | undefined
  );
  const batchWindowSummary = formatRangeSummary(
    config.batchWindow as ConfigNumberRangeValue | undefined
  );

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="p-4 space-y-6 text-theme-text-primary">
        {/* Testing Tool Header */}
        <div className="flex items-center justify-between bg-theme-surface-elevated p-3 rounded-md border border-theme-border-primary">
          <div className="flex items-center space-x-3">
            <div className="text-xl">🧪</div>
            <div>
              <h3 className="font-medium text-theme-text-primary">
                Config Primitives Testing
              </h3>
              <p className="text-xs text-theme-text-tertiary">
                Component playground for configuration primitives
              </p>
            </div>
          </div>
          <div className="px-2 py-1 text-xs bg-theme-interactive-accent text-black rounded">
            DEV ONLY
          </div>
        </div>

        {/* Placeholder for primitives */}
        <div className="space-y-6">
          <h3 className="text-sm font-semibold text-theme-text-primary border-b border-theme-border-primary pb-1">
            Configuration Primitives
          </h3>

          {/* ConfigFile Primitive Test */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wide">
              ConfigFile - File Path Selection
            </h4>

            {/* CSV Filter Example */}
            <ConfigFile
              value={config.testCSVFile as string | undefined}
              onChange={(value, emitPatch, shouldEmit) =>
                updateConfig("testCSVFile", value, emitPatch, shouldEmit)
              }
              label="CSV File"
              placeholder="Select a CSV file..."
              filters={[
                { name: "CSV Files", extensions: ["csv", "tsv", "tab"] },
                { name: "All Files", extensions: ["*"] },
              ]}
              accept=".csv,.tsv,.tab"
              configKey="testCSVFile"
            />

            {/* Excel Filter Example */}
            <ConfigFile
              value={config.testExcelFile as string | undefined}
              onChange={(value, emitPatch, shouldEmit) =>
                updateConfig("testExcelFile", value, emitPatch, shouldEmit)
              }
              label="Excel File"
              placeholder="Select an Excel file..."
              filters={[
                { name: "Excel Files", extensions: ["xlsx", "xls"] },
                { name: "All Files", extensions: ["*"] },
              ]}
              accept=".xlsx,.xls"
              configKey="testExcelFile"
            />

            {/* Data Files Filter Example */}
            <ConfigFile
              value={config.testDataFile as string | undefined}
              onChange={(value, emitPatch, shouldEmit) =>
                updateConfig("testDataFile", value, emitPatch, shouldEmit)
              }
              label="Data File (Multiple Types)"
              placeholder="Select any data file..."
              filters={[
                {
                  name: "Data Files",
                  extensions: ["csv", "xlsx", "parquet", "json", "tsv"],
                },
                { name: "CSV Files", extensions: ["csv", "tsv"] },
                { name: "Excel Files", extensions: ["xlsx", "xls"] },
                { name: "Parquet Files", extensions: ["parquet"] },
                { name: "JSON Files", extensions: ["json"] },
                { name: "All Files", extensions: ["*"] },
              ]}
              accept=".csv,.xlsx,.parquet,.json,.tsv"
              configKey="testDataFile"
            />

            {/* Custom Filter Example */}
            <ConfigFile
              value={config.testCustomFile as string | undefined}
              onChange={(value, emitPatch, shouldEmit) =>
                updateConfig("testCustomFile", value, emitPatch, shouldEmit)
              }
              label="Custom Filters (Text & Log Files)"
              placeholder="Select text or log files..."
              filters={[
                { name: "Text Files", extensions: ["txt", "log"] },
                {
                  name: "Configuration Files",
                  extensions: ["json", "yaml", "yml", "toml"],
                },
                { name: "All Files", extensions: ["*"] },
              ]}
              accept=".txt,.log,.json,.yaml,.yml,.toml"
              configKey="testCustomFile"
            />

            <div className="text-xs text-theme-text-tertiary bg-theme-surface-elevated p-3 rounded">
              <div className="font-medium mb-2">Current Values:</div>
              <div>
                CSV:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {(config.testCSVFile as string) || "none"}
                </code>
              </div>
              <div>
                Excel:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {(config.testExcelFile as string) || "none"}
                </code>
              </div>
              <div>
                Data:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {(config.testDataFile as string) || "none"}
                </code>
              </div>
              <div>
                Custom:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {(config.testCustomFile as string) || "none"}
                </code>
              </div>
            </div>
          </div>

          {/* ConfigBoolean Primitive Test */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wide">
              ConfigBoolean - Checkbox Input
            </h4>

            {/* Basic Boolean Example */}
            <ConfigBoolean
              value={config.hasHeader as boolean | string | undefined}
              onChange={(value, emitPatch, shouldEmit) =>
                updateConfig("hasHeader", value, emitPatch, shouldEmit)
              }
              label="Has Header Row"
              description="First row contains column names"
              defaultValue={true}
              configKey="hasHeader"
            />

            {/* Boolean with false default */}
            <ConfigBoolean
              value={config.skipBadLines as boolean | string | undefined}
              onChange={(value, emitPatch, shouldEmit) =>
                updateConfig("skipBadLines", value, emitPatch, shouldEmit)
              }
              label="Skip Bad Lines"
              description="Skip lines with parsing errors instead of failing"
              defaultValue={false}
              configKey="skipBadLines"
            />

            {/* Boolean for optional feature */}
            <ConfigBoolean
              value={config.inferSchemaLength as boolean | string | undefined}
              onChange={(value, emitPatch, shouldEmit) =>
                updateConfig("inferSchemaLength", value, emitPatch, shouldEmit)
              }
              label="Infer Schema Length"
              description="Scan more rows to infer column types"
              defaultValue={false}
              configKey="inferSchemaLength"
            />

            {/* Disabled example */}
            <ConfigBoolean
              value={config.readOnly as boolean | string | undefined}
              onChange={(value, emitPatch, shouldEmit) =>
                updateConfig("readOnly", value, emitPatch, shouldEmit)
              }
              label="Read Only Mode (Disabled)"
              description="This option is currently disabled"
              defaultValue={true}
              disabled={true}
              configKey="readOnly"
            />

            <div className="text-xs text-theme-text-tertiary bg-theme-surface-elevated p-3 rounded">
              <div className="font-medium mb-2">
                Current Boolean Values (undefined = use default):
              </div>
              <div>
                Has Header:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {config.hasHeader == null
                    ? "undefined (default: true)"
                    : config.hasHeader.toString()}
                </code>
              </div>
              <div>
                Skip Bad Lines:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {config.skipBadLines == null
                    ? "undefined (default: false)"
                    : config.skipBadLines.toString()}
                </code>
              </div>
              <div>
                Infer Schema:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {config.inferSchemaLength == null
                    ? "undefined (default: false)"
                    : config.inferSchemaLength.toString()}
                </code>
              </div>
              <div>
                Read Only:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {config.readOnly == null
                    ? "undefined (default: true)"
                    : config.readOnly.toString()}
                </code>
              </div>
            </div>

            {/* Serialization Emission Demo */}
            <div className="text-xs text-theme-text-tertiary bg-theme-surface-elevated p-3 rounded border-l-2 border-theme-interactive-accent">
              <div className="font-medium mb-2">
                Serialization Emission Logic (automatic):
              </div>
              <div className="font-mono text-xs space-y-1">
                {config.hasHeader != null ? (
                  <div className="text-theme-text-primary">
                    has_header="{config.hasHeader.toString()}"
                    <span className="text-theme-text-tertiary ml-2">
                      // Override default
                    </span>
                  </div>
                ) : (
                  <div className="text-theme-text-disabled">
                    {/* has_header omitted - using Polars default (true) */}
                  </div>
                )}

                {config.skipBadLines != null ? (
                  <div className="text-theme-text-primary">
                    skip_bad_lines="{config.skipBadLines.toString()}"
                    <span className="text-theme-text-tertiary ml-2">
                      // Override default
                    </span>
                  </div>
                ) : (
                  <div className="text-theme-text-disabled">
                    {/* skip_bad_lines omitted - using Polars default (false) */}
                  </div>
                )}

                {config.inferSchemaLength != null ? (
                  <div className="text-theme-text-primary">
                    infer_schema_length="{config.inferSchemaLength.toString()}"
                    <span className="text-theme-text-tertiary ml-2">
                      // Override default
                    </span>
                  </div>
                ) : (
                  <div className="text-theme-text-disabled">
                    {/* infer_schema_length omitted - using Polars default (false) */}
                  </div>
                )}
              </div>
              <div className="mt-2 text-theme-text-disabled">
                ConfigBoolean automatically sets undefined when value equals
                default. Serialization simply checks: if (value != null)
                emit_field();
              </div>
              {config._emit && (
                <div className="mt-3 text-xs">
                  <div className="font-medium text-theme-text-tertiary mb-1">
                    Emission metadata snapshot
                  </div>
                  <pre className="bg-theme-surface-panel border border-theme-border-primary rounded p-2 overflow-x-auto text-theme-text-secondary">
                    {JSON.stringify(config._emit, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* ConfigText Primitive Test */}
          <div className="space-y-4 border-t border-theme-border-primary pt-4">
            <h4 className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wide">
              ConfigText - Text & Character Inputs
            </h4>

            <ConfigText
              value={config.datasetName as string | undefined}
              onChange={(value, emitPatch, shouldEmit) =>
                updateConfig("datasetName", value, emitPatch, shouldEmit)
              }
              configKey="datasetName"
              label="Dataset Name"
              description="Name shown in the workflow UI"
              placeholder="e.g. Marketing Leads"
              minLength={3}
              validation={{ allowEmpty: true }}
              trim
            />

            <ConfigText
              value={config.delimiter as string | undefined}
              onChange={(value, emitPatch, shouldEmit) =>
                updateConfig("delimiter", value, emitPatch, shouldEmit)
              }
              configKey="delimiter"
              label="Delimiter"
              description="Override the detected delimiter"
              variant="char"
              presetOptions={[",", "\\t", "|", ";", " "]}
              validation={{ allowEmpty: true }}
              inlineMessage="Select a common delimiter or type a single character"
            />

            <ConfigText
              value={config.filePattern as string | undefined}
              onChange={(value, emitPatch, shouldEmit) =>
                updateConfig("filePattern", value, emitPatch, shouldEmit)
              }
              configKey="filePattern"
              label="File Pattern"
              description="Realtime regex validation ensures the filename ends with .csv"
              placeholder="example.csv"
              validation={{
                pattern: /^.*\.csv$/i,
                message: "Filename must end with .csv",
                allowEmpty: true,
                debounceMs: 250,
              }}
            />

            <div className="text-xs text-theme-text-tertiary bg-theme-surface-elevated p-3 rounded">
              <div className="font-medium mb-2">Current Text Values:</div>
              <div>
                Dataset Name:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {(config.datasetName as string) || "none"}
                </code>
              </div>
              <div>
                Delimiter:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {(config.delimiter as string)
                    ? JSON.stringify(config.delimiter)
                    : "none"}
                </code>
              </div>
              <div>
                File Pattern:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {(config.filePattern as string) || "none"}
                </code>
              </div>
            </div>
          </div>

          {/* ConfigSelect Primitive Test */}
          <div className="space-y-4 border-t border-theme-border-primary pt-4">
            <h4 className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wide">
              ConfigSelect - Dropdown Inputs
            </h4>

            <ConfigSelect
              value={config.selectDelimiter as string | undefined}
              onChange={(value, emitPatch, shouldEmit) =>
                updateConfig("selectDelimiter", value, emitPatch, shouldEmit)
              }
              configKey="csv.delimiter"
              label="Delimiter Override"
              description="Pick a delimiter when auto-detection struggles. Search is enabled to make it easy to find uncommon separators."
              options={CSV_DELIMITER_OPTIONS}
              searchable
              placeholder="Use detected delimiter"
              emptyOptionLabel="Use detected delimiter"
              defaultValue={","}
              inlineMessage="Emits only when different from the CSV default (comma)."
            />

            <ConfigSelect
              value={config.fileEncoding as string | undefined}
              onChange={(value, emitPatch, shouldEmit) =>
                updateConfig("fileEncoding", value, emitPatch, shouldEmit)
              }
              configKey="csv.encoding"
              label="File Encoding"
              description="Required field that demonstrates validation and search placeholder customisation."
              options={FILE_ENCODING_OPTIONS}
              searchable
              searchPlaceholder="Search hundreds of encodings"
              required
              defaultValue="utf-8"
              inlineMessage="Empty option removed because this field is required."
            />

            <ConfigSelect
              value={config.themeMode as string | undefined}
              onChange={(value, emitPatch, shouldEmit) =>
                updateConfig("themeMode", value, emitPatch, shouldEmit)
              }
              configKey="ui.theme"
              label="Theme Mode"
              description="Search is disabled to keep this focused. The control locks when Read Only Mode (above) is active."
              options={THEME_MODE_OPTIONS}
              placeholder="Follow system preference"
              emptyOptionLabel="Follow system preference"
              searchable={false}
              disabled={config.readOnly === true}
              inlineMessage="Per-instance search toggle off"
            />

            <div className="text-xs text-theme-text-tertiary bg-theme-surface-elevated p-3 rounded">
              <div className="font-medium mb-2">Current Select Values:</div>
              <div>
                Delimiter Override:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {selectDelimiterSummary}
                </code>
              </div>
              <div>
                File Encoding:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {fileEncodingSummary}
                </code>
              </div>
              <div>
                Theme Mode:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {themeModeSummary}
                </code>
              </div>
            </div>
          </div>

          {/* ConfigNumberRange Primitive Test */}
          <div className="space-y-4 border-t border-theme-border-primary pt-4">
            <h4 className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wide">
              ConfigNumberRange - Numeric Ranges
            </h4>

            <ConfigNumberRange
              value={
                config.rowSampleRange as ConfigNumberRangeValue | undefined
              }
              onChange={(value, emitPatch, shouldEmit) =>
                updateConfig("rowSampleRange", value, emitPatch, shouldEmit)
              }
              configKey="csv.preview.row_range"
              label="Row Sample Window"
              description="Controls how many rows the preview should read. Allows partial ranges so you can set just a start or end."
              inlineMessage="Runs validation on change for snappy feedback."
              defaultValue={ROW_SAMPLE_DEFAULT}
              min={1}
              max={5000}
              debounceMs={150}
            />

            <ConfigNumberRange
              value={config.batchWindow as ConfigNumberRangeValue | undefined}
              onChange={(value, emitPatch, shouldEmit) =>
                updateConfig("batchWindow", value, emitPatch, shouldEmit)
              }
              configKey="csv.import.batch_window"
              label="Batch Upload Window"
              description="Requires both start and end, clamps to bounds, and enforces a maximum span via custom validation."
              inlineMessage="Validation waits for blur so operators can tab through quickly."
              defaultValue={BATCH_WINDOW_DEFAULT}
              required
              allowPartial={false}
              integerOnly
              min={0}
              max={1000}
              clampToBounds
              validationMode="blur"
              debounceMs={0}
              layout="stacked"
              customValidator={validateBatchWindow}
            />

            <div className="text-xs text-theme-text-tertiary bg-theme-surface-elevated p-3 rounded">
              <div className="font-medium mb-2">Current Range Values:</div>
              <div>
                Row Sample Range:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {rowSampleRangeSummary}
                </code>
              </div>
              <div>
                Batch Window:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {batchWindowSummary}
                </code>
              </div>
            </div>
          </div>

          {/* Additional reusable components */}
          <div className="space-y-4 border-t border-theme-border-primary pt-4">
            <h4 className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wide">
              Reusable UI Components
            </h4>

            {/* Browser Warning Demo */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-theme-text-primary">
                Browser File Warning (Standalone)
              </div>
              <div className="text-xs text-theme-text-tertiary mb-2">
                This warning appears automatically when running in browser mode:
              </div>
              <BrowserFileWarning />
            </div>

            {/* Note about ConfigFile integration */}
            <div className="text-xs text-theme-text-tertiary bg-theme-surface-elevated p-3 rounded">
              <div className="font-medium mb-1">Note:</div>
              <p>
                ConfigFile adds this warning automatically when
                showBrowserWarning=true. Mix and match the new select and range
                primitives above to mock future configuration ideas.
              </p>
              <p className="mt-1">
                Want to experiment with another primitive? Duplicate one of the
                examples and point the configKey at a different path.
              </p>
            </div>
          </div>

          {/* ConfigNumber Primitive Test - NEW */}
          <div className="space-y-4 border-t border-theme-border-primary pt-4">
            <h4 className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wide">
              ConfigNumber - Single Number Inputs
            </h4>

            {/* Use Case 1: Row Skipping (Integer with Unit) */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-theme-interactive-accent">
                Use Case 1: Row Skipping (Input Tool)
              </div>
              <ConfigNumber
                value={config.skipRows as number | undefined}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("skipRows", value, emitPatch, shouldEmit)
                }
                configKey="csv.skip_rows"
                label="Skip Initial Rows"
                description="Number of rows to skip when reading the file (e.g., skip headers or metadata)"
                placeholder="0"
                defaultValue={0}
                min={0}
                max={1000}
                integerOnly
                unit="rows"
                unitPosition="after"
              />
            </div>

            {/* Use Case 2: Sample Size (Required, Blur Validation) */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-theme-interactive-accent">
                Use Case 2: Preview Sample Size (Required Field)
              </div>
              <ConfigNumber
                value={config.sampleSize as number | undefined}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("sampleSize", value, emitPatch, shouldEmit)
                }
                configKey="preview.sample_size"
                label="Sample Size"
                description="Number of records to sample for preview. Validation runs on blur for better performance."
                defaultValue={100}
                min={1}
                max={10000}
                integerOnly
                required
                validationMode="blur"
              />
            </div>

            {/* Use Case 3: Decimal Precision */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-theme-interactive-accent">
                Use Case 3: Decimal Precision (Formula Tool)
              </div>
              <ConfigNumber
                value={config.precision as number | undefined}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("precision", value, emitPatch, shouldEmit)
                }
                configKey="numeric.precision"
                label="Decimal Precision"
                description="Number of decimal places for rounding numeric results"
                defaultValue={2}
                min={0}
                max={10}
                step={1}
                integerOnly
                unit="decimals"
              />
            </div>

            {/* Use Case 4: Timeout (Clamping, Unit Position) */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-theme-interactive-accent">
                Use Case 4: Request Timeout (Auto-Clamping)
              </div>
              <ConfigNumber
                value={config.timeout as number | undefined}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("timeout", value, emitPatch, shouldEmit)
                }
                configKey="api.timeout"
                label="Request Timeout"
                description="Values outside range are automatically clamped to valid bounds"
                defaultValue={30}
                min={5}
                max={300}
                step={5}
                integerOnly
                clampToBounds
                unit="seconds"
                unitPosition="after"
              />
            </div>

            {/* Use Case 5: Percentage (Float, Custom Validation) */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-theme-interactive-accent">
                Use Case 5: Confidence Threshold (Float, Custom Validation)
              </div>
              <ConfigNumber
                value={config.confidence as number | undefined}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("confidence", value, emitPatch, shouldEmit)
                }
                configKey="filter.confidence"
                label="Confidence Threshold"
                description="Filter rows where confidence is above this threshold"
                defaultValue={0.5}
                min={0}
                max={1}
                step={0.01}
                unit="%"
                unitPosition="after"
                customValidator={(value) => {
                  if (value > 0 && value < 0.1) {
                    return "Very low threshold - most data will be included";
                  }
                  if (value > 0.99) {
                    return "Very high threshold - most data will be filtered out";
                  }
                  return null;
                }}
              />
            </div>

            <div className="text-xs text-theme-text-tertiary bg-theme-surface-elevated p-3 rounded">
              <div className="font-medium mb-2">Current Number Values:</div>
              <div>
                Skip Rows:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {String(config.skipRows ?? "none (default: 0)")}
                </code>
              </div>
              <div>
                Sample Size:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {String(config.sampleSize ?? "none (default: 100)")}
                </code>
              </div>
              <div>
                Precision:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {String(config.precision ?? "none (default: 2)")}
                </code>
              </div>
              <div>
                Timeout:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {String(config.timeout ?? "none (default: 30)")}
                </code>
              </div>
              <div>
                Confidence:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {String(config.confidence ?? "none (default: 0.5)")}
                </code>
              </div>
            </div>
          </div>

          {/* ConfigMultiSelect Primitive Test - NEW */}
          <div className="space-y-4 border-t border-theme-border-primary pt-4">
            <h4 className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wide">
              ConfigMultiSelect - Multiple Selection
            </h4>

            {/* Use Case 1: Column Selection (Select Tool) */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-theme-interactive-accent">
                Use Case 1: Column Selection (Select Tool)
              </div>
              <ConfigMultiSelect
                value={config.selectedColumns as string[] | undefined}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("selectedColumns", value, emitPatch, shouldEmit)
                }
                configKey="columns.select"
                label="Columns to Keep"
                description="Select which columns to include in the output. Search enabled for large datasets."
                options={[
                  {
                    value: "id",
                    label: "ID",
                    description: "Unique identifier",
                  },
                  { value: "name", label: "Name", description: "Full name" },
                  {
                    value: "email",
                    label: "Email",
                    description: "Email address",
                  },
                  { value: "age", label: "Age", description: "Age in years" },
                  { value: "city", label: "City", description: "City name" },
                  {
                    value: "country",
                    label: "Country",
                    description: "Country code",
                  },
                  {
                    value: "created_at",
                    label: "Created At",
                    description: "Creation timestamp",
                  },
                  {
                    value: "updated_at",
                    label: "Updated At",
                    description: "Last update timestamp",
                  },
                ]}
                searchable
                allowReorder={false}
                placeholder="Select columns..."
              />
            </div>

            {/* Use Case 2: Ordered Sort Columns (Sort Tool) */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-theme-interactive-accent">
                Use Case 2: Sort Columns (Sort Tool - Order Matters)
              </div>
              <ConfigMultiSelect
                value={config.sortColumns as string[] | undefined}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("sortColumns", value, emitPatch, shouldEmit)
                }
                configKey="columns.sort"
                label="Sort By"
                description="Drag to reorder - data will be sorted by first column, then second, etc."
                options={[
                  { value: "name", label: "Name" },
                  { value: "age", label: "Age" },
                  { value: "created_at", label: "Created At" },
                  { value: "city", label: "City" },
                  { value: "country", label: "Country" },
                ]}
                allowReorder
                required
                maxSelections={3}
                showSelectAll={false}
              />
            </div>

            {/* Use Case 3: Group By Columns (Summarize Tool) */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-theme-interactive-accent">
                Use Case 3: Group By Columns (Summarize Tool)
              </div>
              <ConfigMultiSelect
                value={config.groupByColumns as string[] | undefined}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("groupByColumns", value, emitPatch, shouldEmit)
                }
                configKey="columns.group_by"
                label="Group By"
                description="Group records by these columns before aggregating"
                options={[
                  {
                    value: "country",
                    label: "Country",
                    description: "Group by country",
                  },
                  {
                    value: "city",
                    label: "City",
                    description: "Group by city",
                  },
                  {
                    value: "category",
                    label: "Category",
                    description: "Product category",
                  },
                  {
                    value: "date",
                    label: "Date",
                    description: "Transaction date",
                  },
                ]}
                searchable
                allowReorder
                showSelectAll
                showClearAll
              />
            </div>

            {/* Use Case 4: File Types (Limited Selection) */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-theme-interactive-accent">
                Use Case 4: File Type Filter (Max 3 selections)
              </div>
              <ConfigMultiSelect
                value={config.fileTypes as string[] | undefined}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("fileTypes", value, emitPatch, shouldEmit)
                }
                configKey="import.file_types"
                label="Allowed File Types"
                description="Select up to 3 file types to allow for import"
                options={[
                  {
                    value: "csv",
                    label: "CSV",
                    description: "Comma-separated values",
                  },
                  {
                    value: "xlsx",
                    label: "Excel",
                    description: "Excel workbook",
                  },
                  {
                    value: "parquet",
                    label: "Parquet",
                    description: "Apache Parquet",
                  },
                  {
                    value: "json",
                    label: "JSON",
                    description: "JSON documents",
                  },
                  { value: "xml", label: "XML", description: "XML documents" },
                  {
                    value: "tsv",
                    label: "TSV",
                    description: "Tab-separated values",
                  },
                ]}
                searchable
                maxSelections={3}
                required
              />
            </div>

            {/* Use Case 5: Tag Selection (No Reorder, Compact) */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-theme-interactive-accent">
                Use Case 5: Tags/Categories (Filter Tool)
              </div>
              <ConfigMultiSelect
                value={config.filterTags as string[] | undefined}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("filterTags", value, emitPatch, shouldEmit)
                }
                configKey="filter.tags"
                label="Include Tags"
                description="Only include rows with these tags"
                options={[
                  { value: "urgent", label: "🔴 Urgent" },
                  { value: "important", label: "🟡 Important" },
                  { value: "normal", label: "🟢 Normal" },
                  { value: "low", label: "⚪ Low Priority" },
                  { value: "archived", label: "📦 Archived" },
                ]}
                searchable={false}
                allowReorder={false}
                placeholder="Select tags to filter by..."
              />
            </div>

            <div className="text-xs text-theme-text-tertiary bg-theme-surface-elevated p-3 rounded">
              <div className="font-medium mb-2">
                Current MultiSelect Values:
              </div>
              <div>
                Selected Columns:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {config.selectedColumns
                    ? JSON.stringify(config.selectedColumns)
                    : "none"}
                </code>
              </div>
              <div>
                Sort Columns:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {config.sortColumns
                    ? JSON.stringify(config.sortColumns)
                    : "none"}
                </code>
              </div>
              <div>
                Group By:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {config.groupByColumns
                    ? JSON.stringify(config.groupByColumns)
                    : "none"}
                </code>
              </div>
              <div>
                File Types:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {config.fileTypes ? JSON.stringify(config.fileTypes) : "none"}
                </code>
              </div>
              <div>
                Filter Tags:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {config.filterTags
                    ? JSON.stringify(config.filterTags)
                    : "none"}
                </code>
              </div>
            </div>
          </div>

          {/* ConfigKeyValueList Primitive Test - NEW */}
          <div className="space-y-4 border-t border-theme-border-primary pt-4">
            <h4 className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wide">
              ConfigKeyValueList - Key-Value Pairs
            </h4>

            {/* Use Case 1: Column Renaming (No Duplicate Keys) */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-theme-interactive-accent">
                Use Case 1: Rename Columns (No Duplicates)
              </div>
              <ConfigKeyValueList
                value={config.renameColumns as KeyValuePair[] | undefined}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("renameColumns", value, emitPatch, shouldEmit)
                }
                configKey="columns.rename"
                label="Rename Columns"
                description="Map old column names to new names. Duplicate old names are not allowed."
                keyLabel="Old Name"
                valueLabel="New Name"
                keyPlaceholder="customer_id"
                valuePlaceholder="id"
                allowDuplicateKeys={false}
                allowEmptyKeys={false}
              />
            </div>

            {/* Use Case 2: Find & Replace (Required, Min/Max) */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-theme-interactive-accent">
                Use Case 2: Find & Replace Values (Required)
              </div>
              <ConfigKeyValueList
                value={config.replaceValues as KeyValuePair[] | undefined}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("replaceValues", value, emitPatch, shouldEmit)
                }
                configKey="values.replace"
                label="Replace Values"
                description="Find and replace specific values. At least 1 pair required, max 10."
                keyLabel="Find"
                valueLabel="Replace With"
                keyPlaceholder="N/A"
                valuePlaceholder="null"
                minPairs={1}
                maxPairs={10}
                required
              />
            </div>

            {/* Use Case 3: Join Key Mapping (Duplicate Keys Allowed) */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-theme-interactive-accent">
                Use Case 3: Join Key Pairs (Duplicate Keys Allowed)
              </div>
              <ConfigKeyValueList
                value={config.joinKeys as KeyValuePair[] | undefined}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("joinKeys", value, emitPatch, shouldEmit)
                }
                configKey="join.keys"
                label="Join Conditions"
                description="Map left table columns to right table columns. Multiple joins on same column allowed."
                keyLabel="Left Column"
                valueLabel="Right Column"
                keyPlaceholder="users.id"
                valuePlaceholder="orders.user_id"
                allowDuplicateKeys={true}
                allowEmptyKeys={false}
                minPairs={1}
              />
            </div>

            {/* Use Case 4: Environment Variables (Empty Values Allowed) */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-theme-interactive-accent">
                Use Case 4: Environment Variables (Empty Values OK)
              </div>
              <ConfigKeyValueList
                value={config.envVars as KeyValuePair[] | undefined}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("envVars", value, emitPatch, shouldEmit)
                }
                configKey="api.env_vars"
                label="Environment Variables"
                description="Set environment variables for the API request. Empty values are allowed."
                keyLabel="Variable Name"
                valueLabel="Value"
                keyPlaceholder="API_KEY"
                valuePlaceholder="your_key_here"
                allowDuplicateKeys={false}
                allowEmptyKeys={false}
                allowEmptyValues={true}
              />
            </div>

            {/* Use Case 5: Type Casting Map */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-theme-interactive-accent">
                Use Case 5: Column Type Overrides
              </div>
              <ConfigKeyValueList
                value={config.typeOverrides as KeyValuePair[] | undefined}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("typeOverrides", value, emitPatch, shouldEmit)
                }
                configKey="schema.type_overrides"
                label="Type Overrides"
                description="Override inferred data types for specific columns"
                keyLabel="Column"
                valueLabel="Type"
                keyPlaceholder="price"
                valuePlaceholder="Float64"
                allowDuplicateKeys={false}
                maxPairs={20}
              />
            </div>

            <div className="text-xs text-theme-text-tertiary bg-theme-surface-elevated p-3 rounded">
              <div className="font-medium mb-2">
                Current KeyValueList Values:
              </div>
              <div>
                Rename Columns:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {config.renameColumns
                    ? JSON.stringify(config.renameColumns)
                    : "none"}
                </code>
              </div>
              <div>
                Replace Values:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {config.replaceValues
                    ? JSON.stringify(config.replaceValues)
                    : "none"}
                </code>
              </div>
              <div>
                Join Keys:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {config.joinKeys ? JSON.stringify(config.joinKeys) : "none"}
                </code>
              </div>
              <div>
                Environment Variables:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {config.envVars ? JSON.stringify(config.envVars) : "none"}
                </code>
              </div>
              <div>
                Type Overrides:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {config.typeOverrides
                    ? JSON.stringify(config.typeOverrides)
                    : "none"}
                </code>
              </div>
            </div>
          </div>

          {/* ConfigColumnList Primitive Test - NEW */}
          <div className="space-y-4 border-t border-theme-border-primary pt-4">
            <h4 className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wide">
              ConfigColumnList - Column Operations
            </h4>

            {/* Use Case 1: Aggregations (Summarize Tool) */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-theme-interactive-accent">
                Use Case 1: Aggregation Operations (Summarize Tool)
              </div>
              <ConfigColumnList
                value={config.aggregations as ColumnOperation[] | undefined}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("aggregations", value, emitPatch, shouldEmit)
                }
                configKey="columns.aggregations"
                label="Aggregation Operations"
                description="Define aggregations for grouped data. At least 1 required, max 5 allowed."
                createNewItem={() => ({
                  id: "",
                  field: "",
                  operation: "Sum",
                  outputName: "",
                })}
                itemRenderer={(
                  item: ColumnOperation,
                  _index: number,
                  handlers: ItemHandlers
                ) => (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-theme-text-tertiary">
                        Column
                      </label>
                      <input
                        type="text"
                        value={item.field}
                        onChange={(e) =>
                          handlers.update("field", e.target.value)
                        }
                        placeholder="sales_amount"
                        className="w-full px-2 py-1 text-sm border rounded border-theme-border-primary bg-theme-surface-panel text-theme-text-primary"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-theme-text-tertiary">
                        Operation
                      </label>
                      <select
                        value={item.operation}
                        onChange={(e) =>
                          handlers.update("operation", e.target.value)
                        }
                        className="w-full px-2 py-1 text-sm border rounded border-theme-border-primary bg-theme-surface-panel text-theme-text-primary"
                      >
                        <option value="Sum">Sum</option>
                        <option value="Avg">Average</option>
                        <option value="Count">Count</option>
                        <option value="Min">Minimum</option>
                        <option value="Max">Maximum</option>
                        <option value="First">First</option>
                        <option value="Last">Last</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-theme-text-tertiary">
                        Output Name
                      </label>
                      <input
                        type="text"
                        value={item.outputName}
                        onChange={(e) =>
                          handlers.update("outputName", e.target.value)
                        }
                        placeholder="total_sales"
                        className="w-full px-2 py-1 text-sm border rounded border-theme-border-primary bg-theme-surface-panel text-theme-text-primary"
                      />
                    </div>
                  </div>
                )}
                allowReorder
                minItems={1}
                maxItems={5}
                addButtonLabel="+ Add Aggregation"
                emptyMessage="No aggregations defined"
              />
            </div>

            {/* Use Case 2: Calculated Columns (Formula Tool) */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-theme-interactive-accent">
                Use Case 2: Calculated Columns (Formula Tool)
              </div>
              <ConfigColumnList
                value={config.formulas as ColumnOperation[] | undefined}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("formulas", value, emitPatch, shouldEmit)
                }
                configKey="columns.formulas"
                label="Formula Definitions"
                description="Define new calculated columns. Reorder to control evaluation sequence."
                createNewItem={() => ({
                  id: "",
                  outputName: "",
                  operation: "",
                  field: "",
                })}
                itemRenderer={(
                  item: ColumnOperation,
                  _index: number,
                  handlers: ItemHandlers
                ) => (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-theme-text-tertiary">
                          New Column Name
                        </label>
                        <input
                          type="text"
                          value={item.outputName}
                          onChange={(e) =>
                            handlers.update("outputName", e.target.value)
                          }
                          placeholder="profit_margin"
                          className="w-full px-2 py-1 text-sm border rounded border-theme-border-primary bg-theme-surface-panel text-theme-text-primary"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-theme-text-tertiary">
                          Type
                        </label>
                        <select
                          value={item.field}
                          onChange={(e) =>
                            handlers.update("field", e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border rounded border-theme-border-primary bg-theme-surface-panel text-theme-text-primary"
                        >
                          <option value="">Select type...</option>
                          <option value="Float64">Float64</option>
                          <option value="Int64">Int64</option>
                          <option value="Utf8">String</option>
                          <option value="Boolean">Boolean</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-theme-text-tertiary">
                        Formula Expression
                      </label>
                      <input
                        type="text"
                        value={item.operation}
                        onChange={(e) =>
                          handlers.update("operation", e.target.value)
                        }
                        placeholder="(revenue - cost) / revenue * 100"
                        className="w-full px-2 py-1 text-sm border rounded border-theme-border-primary bg-theme-surface-panel text-theme-text-primary font-mono"
                      />
                    </div>
                  </div>
                )}
                allowReorder
                addButtonLabel="+ Add Formula"
                emptyMessage="No formulas defined. Click + to add one."
              />
            </div>

            {/* Use Case 3: Sort Criteria (Sort Tool with Nulls Handling) */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-theme-interactive-accent">
                Use Case 3: Sort Criteria (Sort Tool - Order Matters)
              </div>
              <ConfigColumnList
                value={config.sortCriteria as ColumnOperation[] | undefined}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("sortCriteria", value, emitPatch, shouldEmit)
                }
                configKey="columns.sort_criteria"
                label="Sort Order"
                description="Define multi-column sort order. Drag to reorder priority."
                createNewItem={() => ({
                  id: "",
                  field: "",
                  operation: "Ascending",
                  outputName: "Last",
                })}
                itemRenderer={(
                  item: ColumnOperation,
                  _index: number,
                  handlers: ItemHandlers
                ) => (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-theme-text-tertiary">
                        Column
                      </label>
                      <input
                        type="text"
                        value={item.field}
                        onChange={(e) =>
                          handlers.update("field", e.target.value)
                        }
                        placeholder="date"
                        className="w-full px-2 py-1 text-sm border rounded border-theme-border-primary bg-theme-surface-panel text-theme-text-primary"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-theme-text-tertiary">
                        Direction
                      </label>
                      <select
                        value={item.operation}
                        onChange={(e) =>
                          handlers.update("operation", e.target.value)
                        }
                        className="w-full px-2 py-1 text-sm border rounded border-theme-border-primary bg-theme-surface-panel text-theme-text-primary"
                      >
                        <option value="Ascending">⬆️ Ascending</option>
                        <option value="Descending">⬇️ Descending</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-theme-text-tertiary">
                        Nulls
                      </label>
                      <select
                        value={item.outputName}
                        onChange={(e) =>
                          handlers.update("outputName", e.target.value)
                        }
                        className="w-full px-2 py-1 text-sm border rounded border-theme-border-primary bg-theme-surface-panel text-theme-text-primary"
                      >
                        <option value="First">First</option>
                        <option value="Last">Last</option>
                      </select>
                    </div>
                  </div>
                )}
                allowReorder
                minItems={1}
                addButtonLabel="+ Add Sort Column"
                emptyMessage="No sort criteria defined"
              />
            </div>

            {/* Use Case 4: Join Conditions (Join Tool - Complex) */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-theme-interactive-accent">
                Use Case 4: Join Conditions (Join Tool - Multi-Column)
              </div>
              <ConfigColumnList
                value={config.joinConditions as ColumnOperation[] | undefined}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("joinConditions", value, emitPatch, shouldEmit)
                }
                configKey="join.conditions"
                label="Join Conditions"
                description="Define column pairs for joining. All conditions must match (AND logic)."
                createNewItem={() => ({
                  id: "",
                  field: "",
                  operation: "=",
                  outputName: "",
                })}
                itemRenderer={(
                  item: ColumnOperation,
                  _index: number,
                  handlers: ItemHandlers
                ) => (
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
                    <div>
                      <label className="text-xs text-theme-text-tertiary">
                        Left Column
                      </label>
                      <input
                        type="text"
                        value={item.field}
                        onChange={(e) =>
                          handlers.update("field", e.target.value)
                        }
                        placeholder="users.id"
                        className="w-full px-2 py-1 text-sm border rounded border-theme-border-primary bg-theme-surface-panel text-theme-text-primary"
                      />
                    </div>
                    <div className="pb-1 text-theme-text-tertiary font-mono">
                      =
                    </div>
                    <div>
                      <label className="text-xs text-theme-text-tertiary">
                        Right Column
                      </label>
                      <input
                        type="text"
                        value={item.outputName}
                        onChange={(e) =>
                          handlers.update("outputName", e.target.value)
                        }
                        placeholder="orders.user_id"
                        className="w-full px-2 py-1 text-sm border rounded border-theme-border-primary bg-theme-surface-panel text-theme-text-primary"
                      />
                    </div>
                  </div>
                )}
                allowReorder={false}
                minItems={1}
                maxItems={5}
                addButtonLabel="+ Add Condition (AND)"
                emptyMessage="No join conditions defined"
              />
            </div>

            {/* Use Case 5: Window Functions (Window Tool) */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-theme-interactive-accent">
                Use Case 5: Window Functions (Window Tool)
              </div>
              <ConfigColumnList
                value={config.windowFunctions as ColumnOperation[] | undefined}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("windowFunctions", value, emitPatch, shouldEmit)
                }
                configKey="columns.window_functions"
                label="Window Functions"
                description="Define window-based calculations (rank, lag, cumulative sum, etc.)"
                createNewItem={() => ({
                  id: "",
                  field: "",
                  operation: "Rank",
                  outputName: "",
                })}
                itemRenderer={(
                  item: ColumnOperation,
                  _index: number,
                  handlers: ItemHandlers
                ) => (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-theme-text-tertiary">
                          Function
                        </label>
                        <select
                          value={item.operation}
                          onChange={(e) =>
                            handlers.update("operation", e.target.value)
                          }
                          className="w-full px-2 py-1 text-sm border rounded border-theme-border-primary bg-theme-surface-panel text-theme-text-primary"
                        >
                          <option value="Rank">Rank</option>
                          <option value="DenseRank">Dense Rank</option>
                          <option value="RowNumber">Row Number</option>
                          <option value="Lag">Lag</option>
                          <option value="Lead">Lead</option>
                          <option value="CumulativeSum">Cumulative Sum</option>
                          <option value="MovingAvg">Moving Average</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-theme-text-tertiary">
                          Column
                        </label>
                        <input
                          type="text"
                          value={item.field}
                          onChange={(e) =>
                            handlers.update("field", e.target.value)
                          }
                          placeholder="sales_amount"
                          className="w-full px-2 py-1 text-sm border rounded border-theme-border-primary bg-theme-surface-panel text-theme-text-primary"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-theme-text-tertiary">
                        Output Column
                      </label>
                      <input
                        type="text"
                        value={item.outputName}
                        onChange={(e) =>
                          handlers.update("outputName", e.target.value)
                        }
                        placeholder="sales_rank"
                        className="w-full px-2 py-1 text-sm border rounded border-theme-border-primary bg-theme-surface-panel text-theme-text-primary"
                      />
                    </div>
                  </div>
                )}
                allowReorder
                addButtonLabel="+ Add Window Function"
                emptyMessage="No window functions defined"
              />
            </div>

            <div className="text-xs text-theme-text-tertiary bg-theme-surface-elevated p-3 rounded">
              <div className="font-medium mb-2">Current ColumnList Values:</div>
              <div>
                Aggregations:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {config.aggregations
                    ? JSON.stringify(config.aggregations, null, 2)
                    : "none"}
                </code>
              </div>
              <div>
                Formulas:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {config.formulas
                    ? JSON.stringify(config.formulas, null, 2)
                    : "none"}
                </code>
              </div>
              <div>
                Sort Criteria:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {config.sortCriteria
                    ? JSON.stringify(config.sortCriteria, null, 2)
                    : "none"}
                </code>
              </div>
              <div>
                Join Conditions:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {config.joinConditions
                    ? JSON.stringify(config.joinConditions, null, 2)
                    : "none"}
                </code>
              </div>
              <div>
                Window Functions:{" "}
                <code className="bg-theme-surface-panel px-1 rounded">
                  {config.windowFunctions
                    ? JSON.stringify(config.windowFunctions, null, 2)
                    : "none"}
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
