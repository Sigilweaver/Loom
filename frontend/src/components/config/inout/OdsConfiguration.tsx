import {
  ConfigBoolean,
  ConfigFile,
  ConfigNumber,
  ConfigText,
} from "@components/primitives";
import { mergeEmitPatch } from "@components/primitives/hooks";
import { ODS_INFO, type PolarsOdsConfig } from "@domain/dataSources/ods";
import {
  type EmissionMap,
  type ToolConfig,
} from "@domain/workflow/entities/workflow";
import React, { useCallback } from "react";

interface OdsConfigurationProps {
  config: ToolConfig;
  onChange: (updatedConfig: ToolConfig) => void;
}

export const OdsConfiguration: React.FC<OdsConfigurationProps> = ({
  config,
  onChange,
}) => {
  const updateConfig = useCallback(
    (
      key: keyof PolarsOdsConfig,
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
  const sheet_id = config.sheet_id as number | undefined;
  const sheet_name = config.sheet_name as string | undefined;
  const has_header = config.has_header as boolean | undefined;
  const infer_schema_length = config.infer_schema_length as number | undefined;
  const drop_empty_rows = config.drop_empty_rows as boolean | undefined;
  const drop_empty_cols = config.drop_empty_cols as boolean | undefined;
  const raise_if_empty = config.raise_if_empty as boolean | undefined;

  return (
    <div className="flex flex-col h-full">
      {/* Format Info Header */}
      <div className="p-4 border-b bg-theme-surface-elevated border-theme-border-primary">
        <div className="space-y-2">
          <div className="text-sm font-medium text-theme-text-primary">
            {ODS_INFO.name}
          </div>
          <div className="text-xs text-theme-text-secondary">
            {ODS_INFO.description}
          </div>
          <div className="px-2 py-1 text-xs rounded bg-theme-status-warning-bg text-theme-status-warning-text">
            Note: ODS files are fully loaded into memory (no lazy scanning) and
            are read-only
          </div>
        </div>
      </div>

      {/* Scrollable Configuration Area */}
      <div className="flex-1 p-4 space-y-6 overflow-y-auto">
        {/* File Selection */}
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-theme-text-primary">
            Source File
          </h3>

          <ConfigFile
            value={source || ""}
            onChange={(value, emitPatch, shouldEmit) =>
              updateConfig("source", value, emitPatch, shouldEmit)
            }
            label="ODS File"
            placeholder="Select an .ods file..."
            accept=".ods"
            configKey="source"
          />
        </section>

        {/* Sheet Selection */}
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-theme-text-primary">
            Sheet Selection
          </h3>

          <ConfigNumber
            value={sheet_id ?? undefined}
            onChange={(value, emitPatch, shouldEmit) =>
              updateConfig("sheet_id", value, emitPatch, shouldEmit)
            }
            label="Sheet Number"
            min={0}
            step={1}
            placeholder="1 (first sheet)"
            configKey="sheet_id"
          />
          <div className="text-xs text-theme-text-secondary">
            1 = first sheet, 0 = all sheets. Leave empty or use name below.
          </div>

          <ConfigText
            value={sheet_name || ""}
            onChange={(value, emitPatch, shouldEmit) =>
              updateConfig("sheet_name", value || null, emitPatch, shouldEmit)
            }
            label="Or Sheet Name"
            placeholder="Alternative: specify by name..."
            configKey="sheet_name"
          />
        </section>

        {/* Data Options */}
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-theme-text-primary">
            Data Options
          </h3>

          <ConfigBoolean
            value={has_header ?? true}
            onChange={(value, emitPatch, shouldEmit) =>
              updateConfig("has_header", value, emitPatch, shouldEmit)
            }
            label="Has Header"
            configKey="has_header"
          />

          <ConfigNumber
            value={infer_schema_length ?? undefined}
            onChange={(value, emitPatch, shouldEmit) =>
              updateConfig("infer_schema_length", value, emitPatch, shouldEmit)
            }
            label="Schema Inference Length"
            min={1}
            step={1}
            placeholder="100"
            configKey="infer_schema_length"
          />

          <ConfigBoolean
            value={drop_empty_rows ?? true}
            onChange={(value, emitPatch, shouldEmit) =>
              updateConfig("drop_empty_rows", value, emitPatch, shouldEmit)
            }
            label="Drop Empty Rows"
            configKey="drop_empty_rows"
          />

          <ConfigBoolean
            value={drop_empty_cols ?? true}
            onChange={(value, emitPatch, shouldEmit) =>
              updateConfig("drop_empty_cols", value, emitPatch, shouldEmit)
            }
            label="Drop Empty Columns"
            configKey="drop_empty_cols"
          />

          <ConfigBoolean
            value={raise_if_empty ?? true}
            onChange={(value, emitPatch, shouldEmit) =>
              updateConfig("raise_if_empty", value, emitPatch, shouldEmit)
            }
            label="Error if Empty"
            configKey="raise_if_empty"
          />
        </section>

        {/* Format Info */}
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-theme-text-primary">
            About ODS Format
          </h3>

          <div className="p-3 space-y-2 text-xs rounded-lg bg-theme-surface-secondary">
            <div className="font-medium text-theme-text-primary">Features:</div>
            <ul className="pl-4 space-y-1 list-disc text-theme-text-secondary">
              {ODS_INFO.features.map((feature, i) => (
                <li key={i}>{feature}</li>
              ))}
            </ul>

            <div className="pt-2 font-medium text-theme-text-primary">
              Limitations:
            </div>
            <ul className="pl-4 space-y-1 list-disc text-theme-text-secondary">
              {ODS_INFO.limitations.map((limitation, i) => (
                <li key={i}>{limitation}</li>
              ))}
            </ul>

            <div className="pt-3 border-t border-theme-border-primary">
              <a
                href={ODS_INFO.documentationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium hover:underline"
                style={{ color: 'var(--color-border-focus)' }}
              >
                Learn more
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
