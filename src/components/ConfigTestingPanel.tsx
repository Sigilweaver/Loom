import { ToolConfig, XMLEmissionMap } from "@domain/workflow/entities/workflow";
import React from "react";
import {
  BrowserFileWarning,
  ConfigBoolean,
  ConfigFile,
  ConfigText,
} from "./primitives";
import { mergeEmitPatch } from "./primitives/hooks";

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
                The ConfigFile primitive above automatically includes this
                warning when showBrowserWarning=true (default).
              </p>
              <p className="mt-1">
                You can also use BrowserFileWarning standalone in other
                file-related components.
              </p>
            </div>
          </div>

          {/* Coming soon */}
          <div className="text-center py-8 text-theme-text-tertiary border-t border-theme-border-primary">
            <div className="text-2xl mb-2">🏗️</div>
            <p className="text-sm font-medium">More Primitives Coming Soon</p>
            <p className="text-xs mt-1">ConfigNumber, ConfigSelect</p>
          </div>
        </div>
      </div>
    </div>
  );
};
