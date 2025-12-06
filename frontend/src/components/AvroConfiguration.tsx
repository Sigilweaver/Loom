import {
  ConfigFile,
  ConfigNumber,
} from "@components/primitives";
import { mergeEmitPatch } from "@components/primitives/hooks";
import {
  AVRO_INFO,
  type PolarsAvroConfig,
} from "@domain/dataSources/avro";
import {
  type EmissionMap,
  type ToolConfig,
} from "@domain/workflow/entities/workflow";
import React, { useCallback } from "react";

interface AvroConfigurationProps {
  config: ToolConfig;
  onChange: (updatedConfig: ToolConfig) => void;
}

export const AvroConfiguration: React.FC<AvroConfigurationProps> = ({
  config,
  onChange,
}) => {
  const updateConfig = useCallback(
    (
      key: keyof PolarsAvroConfig,
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
      {/* Format Info Header */}
      <div className="p-4 border-b bg-theme-surface-elevated border-theme-border-primary">
        <div className="space-y-2">
          <div className="text-sm font-medium text-theme-text-primary">
            {AVRO_INFO.name}
          </div>
          <div className="text-xs text-theme-text-secondary">
            {AVRO_INFO.description}
          </div>
          <div className="px-2 py-1 text-xs rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
            Note: Avro files are fully loaded into memory (no lazy scanning)
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
            label="Avro File"
            placeholder="Select an .avro file..."
            accept=".avro"
            configKey="source"
          />
        </section>

        {/* Read Options */}
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-theme-text-primary">
            Read Options
          </h3>

          <ConfigNumber
            value={n_rows ?? undefined}
            onChange={(value, emitPatch, shouldEmit) =>
              updateConfig("n_rows", value, emitPatch, shouldEmit)
            }
            label="Max Rows"
            min={1}
            step={1}
            placeholder="All rows"
            configKey="n_rows"
          />
        </section>

        {/* Format Info */}
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-theme-text-primary">
            About Avro Format
          </h3>

          <div className="p-3 space-y-2 text-xs rounded-lg bg-theme-surface-secondary">
            <div className="font-medium text-theme-text-primary">Features:</div>
            <ul className="pl-4 space-y-1 list-disc text-theme-text-secondary">
              {AVRO_INFO.features.map((feature, i) => (
                <li key={i}>{feature}</li>
              ))}
            </ul>

            <div className="pt-2 font-medium text-theme-text-primary">
              Limitations:
            </div>
            <ul className="pl-4 space-y-1 list-disc text-theme-text-secondary">
              {AVRO_INFO.limitations.map((limitation, i) => (
                <li key={i}>{limitation}</li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
};
