import {
  ConfigBoolean,
  ConfigFile,
  ConfigNumber,
  ConfigText,
} from "@components/primitives";
import { mergeEmitPatch } from "@components/primitives/hooks";
import {
  EXCEL_DOCUMENTATION_URL,
  EXCEL_MODE_INFO,
  type PolarsExcelConfig,
} from "@domain/dataSources/excel";
import {
  type EmissionMap,
  type ToolConfig,
} from "@domain/workflow/entities/workflow";
import React, { useCallback } from "react";

interface ExcelConfigurationProps {
  config: ToolConfig;
  onChange: (updatedConfig: ToolConfig) => void;
}

export const ExcelConfiguration: React.FC<ExcelConfigurationProps> = ({
  config,
  onChange,
}) => {
  const updateConfig = useCallback(
    (
      key: keyof PolarsExcelConfig,
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
  const sheet_id = config.sheet_id as number | null | undefined;
  const sheet_name = config.sheet_name as string | null | undefined;
  const has_header = config.has_header as boolean | undefined;
  const infer_schema_length = config.infer_schema_length as number | undefined;
  const drop_empty_rows = config.drop_empty_rows as boolean | undefined;
  const drop_empty_cols = config.drop_empty_cols as boolean | undefined;
  const raise_if_empty = config.raise_if_empty as boolean | undefined;

  // Determine sheet selection mode
  const useSheetName = sheet_name !== null && sheet_name !== undefined && sheet_name !== "";

  return (
    <div className="flex flex-col h-full">
      {/* Mode Info (Excel only has one mode) */}
      <div className="p-4 border-b bg-theme-surface-elevated border-theme-border-primary">
        <div className="space-y-3">
          <div>
            <label className="block mb-2 text-sm font-medium text-theme-text-primary">
              Reading Mode
            </label>
            <div className="px-3 py-2 text-sm border rounded bg-theme-surface border-theme-border-primary text-theme-text-secondary">
              {EXCEL_MODE_INFO.name}
            </div>
          </div>
          <p className="text-xs text-theme-text-tertiary">
            {EXCEL_MODE_INFO.description}
          </p>
          <a
            href={EXCEL_DOCUMENTATION_URL}
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
        {/* File Selection */}
        <div className="space-y-4">
          <ConfigFile
            value={source}
            onChange={(value, emitPatch, shouldEmit) =>
              updateConfig("source", value, emitPatch, shouldEmit)
            }
            label="Source"
            description="Path to the Excel file"
            placeholder="/path/to/file.xlsx"
            filters={[
              { name: "Excel Files", extensions: ["xlsx", "xls", "xlsb"] },
              { name: "All Files", extensions: ["*"] },
            ]}
            accept=".xlsx,.xls,.xlsb"
            configKey="source"
            required
          />
        </div>

        {/* Sheet Selection */}
        <div className="space-y-4">
          <h5 className="text-xs font-semibold tracking-wide uppercase text-theme-text-secondary">
            Sheet Selection
          </h5>

          <div className="p-3 border rounded bg-theme-surface border-theme-border-secondary">
            <p className="mb-3 text-xs text-theme-text-tertiary">
              Select sheet by number or name. Leave both empty for the first sheet.
            </p>

            <div className="space-y-4">
              <ConfigNumber
                value={useSheetName ? undefined : (sheet_id ?? 1)}
                onChange={(value, emitPatch, shouldEmit) => {
                  // Clear sheet_name when setting sheet_id
                  const updates = {
                    ...config,
                    sheet_id: value,
                    sheet_name: null,
                    _emit: shouldEmit
                      ? mergeEmitPatch(config._emit, emitPatch)
                      : (config._emit ?? {}),
                  } as ToolConfig;
                  onChange(updates);
                }}
                configKey="sheet_id"
                label="Sheet Number"
                description="1 = first sheet, 2 = second, etc. (0 = all sheets)"
                placeholder={useSheetName ? "Using sheet name" : "1"}
                disabled={useSheetName}
                min={0}
                step={1}
                integerOnly
              />

              <div className="flex items-center my-2">
                <div className="flex-1 border-t border-theme-border-secondary" />
                <span className="px-3 text-xs text-theme-text-tertiary">or</span>
                <div className="flex-1 border-t border-theme-border-secondary" />
              </div>

              <ConfigText
                value={sheet_name ?? ""}
                onChange={(value, emitPatch, shouldEmit) => {
                  // Clear sheet_id when setting sheet_name
                  const updates = {
                    ...config,
                    sheet_name: value || null,
                    sheet_id: value ? null : (sheet_id ?? 1),
                    _emit: shouldEmit
                      ? mergeEmitPatch(config._emit, emitPatch)
                      : (config._emit ?? {}),
                  } as ToolConfig;
                  onChange(updates);
                }}
                configKey="sheet_name"
                label="Sheet Name"
                description="Name of the sheet to read"
                placeholder="Sheet1"
                variant="text"
              />
            </div>
          </div>
        </div>

        {/* Common Options */}
        <div className="space-y-4">
          <h5 className="text-xs font-semibold tracking-wide uppercase text-theme-text-secondary">
            Parsing Options
          </h5>

          <ConfigBoolean
            value={has_header ?? true}
            onChange={(value, emitPatch, shouldEmit) =>
              updateConfig("has_header", value, emitPatch, shouldEmit)
            }
            label="Has Header"
            description="First row contains column names"
            defaultValue={true}
            configKey="has_header"
          />

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

        {/* Advanced Options (Collapsible) */}
        <details className="space-y-4">
          <summary className="pb-1 text-sm font-semibold border-b cursor-pointer text-theme-text-primary border-theme-border-primary hover:text-theme-interactive-accent">
            Advanced Options
          </summary>

          <div className="pt-4 space-y-6">
            {/* Empty Data Handling */}
            <div className="space-y-4">
              <h5 className="text-xs font-semibold tracking-wide uppercase text-theme-text-secondary">
                Empty Data Handling
              </h5>

              <ConfigBoolean
                value={drop_empty_rows ?? true}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("drop_empty_rows", value, emitPatch, shouldEmit)
                }
                label="Drop Empty Rows"
                description="Omit completely empty rows from the data"
                defaultValue={true}
                configKey="drop_empty_rows"
              />

              <ConfigBoolean
                value={drop_empty_cols ?? true}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("drop_empty_cols", value, emitPatch, shouldEmit)
                }
                label="Drop Empty Columns"
                description="Omit completely empty columns (with no headers)"
                defaultValue={true}
                configKey="drop_empty_cols"
              />

              <ConfigBoolean
                value={raise_if_empty ?? true}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("raise_if_empty", value, emitPatch, shouldEmit)
                }
                label="Error if Empty"
                description="Raise an error if the sheet contains no data"
                defaultValue={true}
                configKey="raise_if_empty"
              />
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};
