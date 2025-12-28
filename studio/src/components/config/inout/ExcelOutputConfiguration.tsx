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
  EXCEL_OUTPUT_DOCUMENTATION_URL,
  EXCEL_OUTPUT_MODE_INFO,
  EXCEL_TABLE_STYLE_OPTIONS,
  FREEZE_PANE_OPTIONS,
  type PolarsExcelOutputConfig,
} from "@domain/dataSources/excelOutput";
import {
  type EmissionMap,
  type ToolConfig,
} from "@domain/workflow/entities/workflow";
import React, { useCallback } from "react";

interface ExcelOutputConfigurationProps {
  config: ToolConfig;
  onChange: (updatedConfig: ToolConfig) => void;
}

export const ExcelOutputConfiguration: React.FC<
  ExcelOutputConfigurationProps
> = ({ config, onChange }) => {
  const updateConfig = useCallback(
    (
      key: keyof PolarsExcelOutputConfig,
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
  const worksheet = config.worksheet as string | null | undefined;
  const table_name = config.table_name as string | null | undefined;
  const table_style = config.table_style as string | null | undefined;
  const include_header = config.include_header as boolean | undefined;
  const autofilter = config.autofilter as boolean | undefined;
  const autofit = config.autofit as boolean | undefined;
  const hide_gridlines = config.hide_gridlines as boolean | undefined;
  const float_precision = config.float_precision as number | undefined;
  const sheet_zoom = config.sheet_zoom as number | null | undefined;
  const freeze_panes = config.freeze_panes as string | null | undefined;

  // Convert table style options to ConfigSelect format
  const tableStyleOptions: ConfigSelectOption[] = EXCEL_TABLE_STYLE_OPTIONS.map(
    (opt) => ({
      value: opt.value ?? "none",
      label: opt.label,
    })
  );

  // Convert freeze pane options to ConfigSelect format
  const freezePaneOptions: ConfigSelectOption[] = FREEZE_PANE_OPTIONS.map(
    (opt) => ({
      value: opt.value ?? "",
      label: opt.label,
    })
  );

  return (
    <div className="flex flex-col h-full">
      {/* Mode Info Header (Excel only has one mode) */}
      <div className="p-4 border-b bg-theme-surface-elevated border-theme-border-primary">
        <div className="space-y-3">
          <div>
            <label className="block mb-2 text-sm font-medium text-theme-text-primary">
              Output Mode
            </label>
            <div className="px-3 py-2 text-sm rounded-md bg-theme-surface-secondary text-theme-text-secondary">
              {EXCEL_OUTPUT_MODE_INFO.label}
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-theme-surface-tertiary rounded">
                {EXCEL_OUTPUT_MODE_INFO.badge}
              </span>
            </div>
            <p className="mt-2 text-xs text-theme-text-tertiary">
              {EXCEL_OUTPUT_MODE_INFO.description}
            </p>
            <a
              href={EXCEL_OUTPUT_DOCUMENTATION_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
              style={{ color: 'var(--color-border-focus)' }}
            >
              Learn more
            </a>
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
                accept=".xlsx"
                filters={[
                  { name: "Excel Files", extensions: ["xlsx"] },
                  { name: "All Files", extensions: ["*"] },
                ]}
                placeholder="Select output file path..."
                description="Path where the Excel file will be written"
                required
              />
            </div>
          </section>

          {/* === Worksheet Options === */}
          <section>
            <h3 className="mb-3 text-sm font-semibold text-theme-text-primary">
              Worksheet
            </h3>
            <div className="space-y-3">
              <ConfigText
                label="Sheet Name"
                value={worksheet ?? ""}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig(
                    "worksheet",
                    value || null,
                    emitPatch,
                    shouldEmit
                  )
                }
                configKey="worksheet"
                placeholder="Sheet1"
                description="Name of the worksheet (default: Sheet1)"
              />

              <ConfigText
                label="Table Name"
                value={table_name ?? ""}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig(
                    "table_name",
                    value || null,
                    emitPatch,
                    shouldEmit
                  )
                }
                configKey="table_name"
                placeholder="Table1"
                description="Name for the Excel table (for formulas and references)"
              />
            </div>
          </section>

          {/* === Table Style === */}
          <section>
            <h3 className="mb-3 text-sm font-semibold text-theme-text-primary">
              Table Style
            </h3>
            <div className="space-y-3">
              <ConfigSelectWithCustom
                label="Style"
                value={table_style === null ? "none" : (table_style ?? "Table Style Medium 4")}
                options={tableStyleOptions}
                onChange={(value, emitPatch, shouldEmit) => {
                  const styleValue = value === "none" ? null : value;
                  updateConfig("table_style", styleValue, emitPatch, shouldEmit);
                }}
                configKey="table_style"
                defaultValue="Table Style Medium 4"
                description="Excel table style. Enter a custom style name."
                customInputPlaceholder="e.g. Table Style Medium 15"
              />
              <p className="text-xs text-theme-text-tertiary">
                To find style names: In Excel, select a range, press Ctrl+T,
                go to Table Design, and hover over styles.
              </p>
            </div>
          </section>

          {/* === Display Options === */}
          <section>
            <h3 className="mb-3 text-sm font-semibold text-theme-text-primary">
              Display Options
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
                description="Include column names as header row"
              />

              <ConfigBoolean
                label="Enable Autofilter"
                value={autofilter ?? true}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("autofilter", value, emitPatch, shouldEmit)
                }
                configKey="autofilter"
                defaultValue={true}
                description="Add dropdown filters to header row"
              />

              <ConfigBoolean
                label="Autofit Column Widths"
                value={autofit ?? false}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("autofit", value, emitPatch, shouldEmit)
                }
                configKey="autofit"
                defaultValue={false}
                description="Automatically calculate column widths from data"
              />

              <ConfigBoolean
                label="Hide Gridlines"
                value={hide_gridlines ?? false}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("hide_gridlines", value, emitPatch, shouldEmit)
                }
                configKey="hide_gridlines"
                defaultValue={false}
                description="Hide worksheet gridlines"
              />
            </div>
          </section>

          {/* === Formatting === */}
          <section>
            <h3 className="mb-3 text-sm font-semibold text-theme-text-primary">
              Formatting
            </h3>
            <div className="space-y-3">
              <ConfigNumber
                label="Float Precision"
                value={float_precision ?? 3}
                onChange={(value, emitPatch, shouldEmit) =>
                  updateConfig("float_precision", value, emitPatch, shouldEmit)
                }
                configKey="float_precision"
                min={0}
                max={15}
                defaultValue={3}
                description="Number of decimal places for floating point values"
                integerOnly
              />
            </div>
          </section>

          {/* === Advanced Options === */}
          <details className="space-y-4">
            <summary className="pb-1 text-sm font-semibold border-b cursor-pointer text-theme-text-primary border-theme-border-primary hover:text-theme-interactive-accent">
              Advanced Options
            </summary>

            <div className="pt-4 space-y-6">
              {/* View Options */}
              <div className="space-y-4">
                <h5 className="text-xs font-semibold tracking-wide uppercase text-theme-text-secondary">
                  View Options
                </h5>

                <ConfigNumber
                  label="Sheet Zoom"
                  value={sheet_zoom ?? undefined}
                  onChange={(value, emitPatch, shouldEmit) =>
                    updateConfig(
                      "sheet_zoom",
                      value ?? null,
                      emitPatch,
                      shouldEmit
                    )
                  }
                  configKey="sheet_zoom"
                  min={10}
                  max={400}
                  placeholder="100"
                  description="Worksheet zoom level (10-400%, leave empty for default)"
                  integerOnly
                  unit="%"
                />

                <ConfigSelect
                  label="Freeze Panes"
                  value={freeze_panes ?? ""}
                  options={freezePaneOptions}
                  onChange={(value, emitPatch, shouldEmit) =>
                    updateConfig(
                      "freeze_panes",
                      value || null,
                      emitPatch,
                      shouldEmit
                    )
                  }
                  configKey="freeze_panes"
                  placeholder="None"
                  description="Freeze rows/columns for easier scrolling"
                />
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};
