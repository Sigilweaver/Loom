import {
  ConfigFile,
  ConfigNumber,
} from "@components/primitives";
import { mergeEmitPatch } from "@components/primitives/hooks";
import {
  QVD_INPUT_DOCUMENTATION_URL,
  type PolarsQvdInputConfig,
} from "@domain/dataSources/qvdInput";
import {
  type EmissionMap,
  type ToolConfig,
} from "@domain/workflow/entities/workflow";
import React, { useCallback } from "react";

interface QvdConfigurationProps {
  config: ToolConfig;
  onChange: (updatedConfig: ToolConfig) => void;
}

export const QvdConfiguration: React.FC<QvdConfigurationProps> = ({
  config,
  onChange,
}) => {
  const updateConfig = useCallback(
    (
      key: keyof PolarsQvdInputConfig,
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
              Read Qlik QVD files.
            </p>
          </div>
          <a
            href={QVD_INPUT_DOCUMENTATION_URL}
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
            description="Path to the Qlik QVD file"
            placeholder="/path/to/file.qvd"
            filters={[
              { name: "QVD Files", extensions: ["qvd"] },
              { name: "All Files", extensions: ["*"] },
            ]}
            accept=".qvd"
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
      </div>
    </div>
  );
};
