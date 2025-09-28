import { ToolConfig, XMLEmissionMap } from "@domain/workflow/entities/workflow";
import React from "react";
import {
  BrowserFileWarning,
  ConfigBoolean,
  ConfigFile,
  ConfigNumberRange,
  ConfigSelect,
  ConfigText,
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
    emitPatch: XMLEmissionMap,
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

            {/* XML Emission Demo */}
            <div className="text-xs text-theme-text-tertiary bg-theme-surface-elevated p-3 rounded border-l-2 border-theme-interactive-accent">
              <div className="font-medium mb-2">
                XML Emission Logic (automatic):
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
                default. XML generation simply checks: if (value != null)
                emit_attribute();
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
        </div>
      </div>
    </div>
  );
};
