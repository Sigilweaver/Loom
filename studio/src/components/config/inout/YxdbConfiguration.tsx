import {
  ConfigFile,
  ConfigNumber,
} from "@components/primitives";
import { mergeEmitPatch } from "@components/primitives/hooks";
import {
  YXDB_INPUT_DOCUMENTATION_URL,
  type PolarsYxdbInputConfig,
} from "@domain/dataSources/yxdbInput";
import {
  type EmissionMap,
  type ToolConfig,
} from "@domain/workflow/entities/workflow";
import React, { useCallback } from "react";

interface YxdbConfigurationProps {
  config: ToolConfig;
  onChange: (updatedConfig: ToolConfig) => void;
}

export const YxdbConfiguration: React.FC<YxdbConfigurationProps> = ({
  config,
  onChange,
}) => {
  const updateConfig = useCallback(
    (
      key: keyof PolarsYxdbInputConfig,
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
  const n_rows = config.n_rows as number | undefined;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-theme-surface-elevated border-theme-border-primary">
        <div className="space-y-3">
          <div>
            <p className="text-xs text-theme-text-tertiary">
              Read Alteryx YXDB files using SigilYX — a high-performance Rust
              reader. All 17 YXDB field types are supported.
            </p>
          </div>
          <a
            href={YXDB_INPUT_DOCUMENTATION_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
            style={{ color: "var(--color-border-focus)" }}
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
            description="Path to the Alteryx YXDB file"
            placeholder="/path/to/file.yxdb"
            filters={[
              { name: "YXDB Files", extensions: ["yxdb"] },
              { name: "All Files", extensions: ["*"] },
            ]}
            accept=".yxdb"
            configKey="source"
            required
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

        {/* Info box about YXDB format */}
        <section className="p-3 border rounded-lg bg-theme-surface-elevated border-theme-border-primary">
          <h4 className="mb-2 text-sm font-medium text-theme-text-primary">
            About YXDB Format
          </h4>
          <ul className="space-y-1 text-xs text-theme-text-secondary">
            <li>
              - Alteryx proprietary binary format with LZF compression
            </li>
            <li>
              - Supports all 17 YXDB field types (strings, numbers, dates,
              blobs, spatial)
            </li>
            <li>
              - Read without Alteryx Designer installed, on any OS
            </li>
            <li>
              - Consider converting to Parquet or Arrow for long-term storage
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
};
