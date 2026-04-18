import { ConfigFile } from "@components/primitives";
import { mergeEmitPatch } from "@components/primitives/hooks";
import {
  YXDB_OUTPUT_DOCUMENTATION_URL,
  type PolarsYxdbOutputConfig,
} from "@domain/dataSources/yxdbOutput";
import {
  type EmissionMap,
  type ToolConfig,
} from "@domain/workflow/entities/workflow";
import React, { useCallback } from "react";

interface YxdbOutputConfigurationProps {
  config: ToolConfig;
  onChange: (updatedConfig: ToolConfig) => void;
}

export const YxdbOutputConfiguration: React.FC<
  YxdbOutputConfigurationProps
> = ({ config, onChange }) => {
  const updateConfig = useCallback(
    (
      key: keyof PolarsYxdbOutputConfig,
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-theme-surface-elevated border-theme-border-primary">
        <div className="space-y-3">
          <div>
            <p className="text-xs text-theme-text-tertiary">
              Write data to Alteryx YXDB format using OpenYXDB. The output file
              can be opened in Alteryx Designer or read by any OpenYXDB-compatible
              tool.
            </p>
          </div>
          <a
            href={YXDB_OUTPUT_DOCUMENTATION_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
            style={{ color: "var(--color-border-focus)" }}
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
                accept=".yxdb"
                filters={[
                  { name: "YXDB Files", extensions: ["yxdb"] },
                  { name: "All Files", extensions: ["*"] },
                ]}
                placeholder="Select output file path..."
                description="Path where the YXDB file will be written"
                required
              />
            </div>
          </section>

          {/* Info box about YXDB format */}
          <section className="p-3 border rounded-lg bg-theme-surface-elevated border-theme-border-primary">
            <h4 className="mb-2 text-sm font-medium text-theme-text-primary">
              About YXDB Output
            </h4>
            <ul className="space-y-1 text-xs text-theme-text-secondary">
              <li>
                - Writes all Polars types with automatic YXDB type mapping
              </li>
              <li>
                - Uses LZF compression for compact file size
              </li>
              <li>
                - Compatible with Alteryx Designer and other YXDB readers
              </li>
              <li>
                - Data is collected into memory before writing (eager mode)
              </li>
            </ul>
          </section>

          {/* Recommendation box */}
          <section className="p-3 border rounded-lg border-amber-500/30 bg-amber-500/5">
            <h4 className="mb-1 text-sm font-medium text-theme-text-primary">
              💡 Recommendation
            </h4>
            <p className="text-xs text-theme-text-secondary">
              For new projects, consider using{" "}
              <strong>Parquet</strong> or <strong>Arrow IPC</strong> instead.
              These open formats offer better compression, columnar storage, and
              broader ecosystem support. Use YXDB when you need compatibility
              with Alteryx workflows.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
