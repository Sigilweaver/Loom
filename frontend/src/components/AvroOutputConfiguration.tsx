import {
  ConfigFile,
  ConfigSelect,
  ConfigText,
  type ConfigSelectOption,
} from "@components/primitives";
import { mergeEmitPatch } from "@components/primitives/hooks";
import {
  AVRO_COMPRESSION_OPTIONS,
  AVRO_OUTPUT_INFO,
  type AvroCompressionType,
  type PolarsAvroOutputConfig,
} from "@domain/dataSources/avroOutput";
import {
  type EmissionMap,
  type ToolConfig,
} from "@domain/workflow/entities/workflow";
import React, { useCallback } from "react";

interface AvroOutputConfigurationProps {
  config: ToolConfig;
  onChange: (updatedConfig: ToolConfig) => void;
}

export const AvroOutputConfiguration: React.FC<
  AvroOutputConfigurationProps
> = ({ config, onChange }) => {
  const updateConfig = useCallback(
    (
      key: keyof PolarsAvroOutputConfig,
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
  const compression = config.compression as AvroCompressionType | undefined;
  const schemaName = config.name as string | undefined;

  const compressionOptions: ConfigSelectOption[] = AVRO_COMPRESSION_OPTIONS.map(
    (opt) => ({
      value: opt.value,
      label: opt.label,
    })
  );

  return (
    <div className="flex flex-col h-full">
      {/* Format Info Header */}
      <div className="p-4 border-b bg-theme-surface-elevated border-theme-border-primary">
        <div className="space-y-2">
          <div className="text-sm font-medium text-theme-text-primary">
            {AVRO_OUTPUT_INFO.name}
          </div>
          <div className="text-xs text-theme-text-secondary">
            {AVRO_OUTPUT_INFO.description}
          </div>
          <div className="px-2 py-1 text-xs rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
            {AVRO_OUTPUT_INFO.note}
          </div>
        </div>
      </div>

      {/* Scrollable Configuration Area */}
      <div className="flex-1 p-4 space-y-6 overflow-y-auto">
        {/* Destination File */}
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-theme-text-primary">
            Destination
          </h3>

          <ConfigFile
            value={destination || ""}
            onChange={(value, emitPatch, shouldEmit) =>
              updateConfig("destination", value, emitPatch, shouldEmit)
            }
            label="Output File"
            placeholder="Enter output path..."
            mode="save"
            accept=".avro"
            configKey="destination"
          />
        </section>

        {/* Compression */}
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-theme-text-primary">
            Compression
          </h3>

          <ConfigSelect
            value={compression || "uncompressed"}
            options={compressionOptions}
            onChange={(value, emitPatch, shouldEmit) =>
              updateConfig(
                "compression",
                value as AvroCompressionType,
                emitPatch,
                shouldEmit
              )
            }
            label="Algorithm"
            configKey="compression"
          />

          {/* Compression description */}
          <div className="text-xs text-theme-text-secondary">
            {AVRO_COMPRESSION_OPTIONS.find(
              (opt) => opt.value === (compression || "uncompressed")
            )?.description}
          </div>
        </section>

        {/* Schema Options */}
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-theme-text-primary">
            Schema Options
          </h3>

          <ConfigText
            value={schemaName || ""}
            onChange={(value, emitPatch, shouldEmit) =>
              updateConfig("name", value, emitPatch, shouldEmit)
            }
            label="Schema Name"
            placeholder="Optional schema name..."
            configKey="name"
          />
          <div className="text-xs text-theme-text-secondary">
            Optional name for the Avro schema. Leave empty for default.
          </div>
        </section>

        {/* Format Info */}
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-theme-text-primary">
            About Avro Output
          </h3>

          <div className="p-3 space-y-2 text-xs rounded-lg bg-theme-surface-secondary">
            <div className="font-medium text-theme-text-primary">Features:</div>
            <ul className="pl-4 space-y-1 list-disc text-theme-text-secondary">
              {AVRO_OUTPUT_INFO.features.map((feature, i) => (
                <li key={i}>{feature}</li>
              ))}
            </ul>

            <div className="pt-3 border-t border-theme-border-primary">
              <a
                href={AVRO_OUTPUT_INFO.documentationUrl}
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
