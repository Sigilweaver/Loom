import type { ReactNode } from "react";

import type { CSVMode } from "@domain/dataSources/csv";
import type { CSVOutputMode } from "@domain/dataSources/csvOutput";
import type { IpcMode } from "@domain/dataSources/ipc";
import type { IpcOutputMode } from "@domain/dataSources/ipcOutput";
import type { JSONMode } from "@domain/dataSources/json";
import type { JSONOutputMode } from "@domain/dataSources/jsonOutput";
import type { ParquetMode } from "@domain/dataSources/parquet";
import type { ParquetOutputMode } from "@domain/dataSources/parquetOutput";
import type { ToolConfig } from "@domain/workflow/entities/workflow";

import { AvroConfiguration } from "./AvroConfiguration";
import { AvroOutputConfiguration } from "./AvroOutputConfiguration";
import { CsvConfiguration } from "./CsvConfiguration";
import { CsvOutputConfiguration } from "./CsvOutputConfiguration";
import { DatabaseConfiguration } from "./DatabaseConfiguration";
import { DataSourceSelector, type DataSource } from "./DataSourceSelector";
import { ExcelConfiguration } from "./ExcelConfiguration";
import { ExcelOutputConfiguration } from "./ExcelOutputConfiguration";
import { IpcConfiguration } from "./IpcConfiguration";
import { IpcOutputConfiguration } from "./IpcOutputConfiguration";
import { JsonConfiguration } from "./JsonConfiguration";
import { JsonOutputConfiguration } from "./JsonOutputConfiguration";
import { OdsConfiguration } from "./OdsConfiguration";
import { ParquetConfiguration } from "./ParquetConfiguration";
import { ParquetOutputConfiguration } from "./ParquetOutputConfiguration";
import { PostgresqlConfiguration } from "./PostgresqlConfiguration";
import { QvdConfiguration } from "./QvdConfiguration";
import { SqliteConfiguration } from "./SqliteConfiguration";
import { YxdbConfiguration } from "./YxdbConfiguration";
import { YxdbOutputConfiguration } from "./YxdbOutputConfiguration";

type Operation = "input" | "output";
type ConfigChange = (config: ToolConfig) => void;

interface SourceEntry {
  createConfig: (existing: ToolConfig, selectedMode?: string) => ToolConfig;
  render: (config: ToolConfig, onChange: ConfigChange) => ReactNode;
}

const preserve = (
  config: ToolConfig,
  existing: ToolConfig,
  key: "filePath" | "source" | "connectionId",
): ToolConfig => {
  const value = existing[key];
  return value === undefined || value === null
    ? config
    : { ...config, [key]: value };
};

const INPUT_SOURCES: Record<string, SourceEntry> = {
  csv: {
    createConfig: (existing, mode = "scan") =>
      preserve(
        { category: "file", type: "csv", csvMode: mode },
        existing,
        "filePath",
      ),
    render: (config, onChange) => (
      <CsvConfiguration
        mode={(config.csvMode as CSVMode) || "scan"}
        config={config}
        onChange={onChange}
      />
    ),
  },
  excel: {
    createConfig: (existing) =>
      preserve(
        { category: "file", type: "excel", sheet_id: 1 },
        existing,
        "filePath",
      ),
    render: (config, onChange) => (
      <ExcelConfiguration config={config} onChange={onChange} />
    ),
  },
  parquet: {
    createConfig: (existing, mode = "scan") =>
      preserve(
        { category: "file", type: "parquet", parquetMode: mode },
        existing,
        "filePath",
      ),
    render: (config, onChange) => (
      <ParquetConfiguration
        mode={(config.parquetMode as ParquetMode) || "scan"}
        config={config}
        onChange={onChange}
      />
    ),
  },
  json: {
    createConfig: (existing, mode = "scan") =>
      preserve(
        { category: "file", type: "json", jsonMode: mode },
        existing,
        "filePath",
      ),
    render: (config, onChange) => (
      <JsonConfiguration
        mode={(config.jsonMode as JSONMode) || "scan"}
        config={config}
        onChange={onChange}
      />
    ),
  },
  ipc: {
    createConfig: (existing, mode = "scan") =>
      preserve(
        { category: "file", type: "ipc", ipcMode: mode },
        existing,
        "filePath",
      ),
    render: (config, onChange) => (
      <IpcConfiguration
        mode={(config.ipcMode as IpcMode) || "scan"}
        config={config}
        onChange={onChange}
      />
    ),
  },
  avro: {
    createConfig: (existing) =>
      preserve({ category: "file", type: "avro" }, existing, "filePath"),
    render: (config, onChange) => (
      <AvroConfiguration config={config} onChange={onChange} />
    ),
  },
  ods: {
    createConfig: (existing) =>
      preserve(
        {
          category: "file",
          type: "ods",
          sheet_id: 1,
          has_header: true,
          drop_empty_rows: true,
          drop_empty_cols: true,
          raise_if_empty: true,
        },
        existing,
        "filePath",
      ),
    render: (config, onChange) => (
      <OdsConfiguration config={config} onChange={onChange} />
    ),
  },
  yxdb: {
    createConfig: (existing) =>
      preserve({ category: "file", type: "yxdb" }, existing, "filePath"),
    render: (config, onChange) => (
      <YxdbConfiguration config={config} onChange={onChange} />
    ),
  },
  qvd: {
    createConfig: (existing) =>
      preserve({ category: "file", type: "qvd" }, existing, "filePath"),
    render: (config, onChange) => (
      <QvdConfiguration config={config} onChange={onChange} />
    ),
  },
  postgresql: {
    createConfig: (existing) =>
      preserve(
        { category: "database", type: "postgresql", query: "" },
        existing,
        "connectionId",
      ),
    render: (config, onChange) => (
      <PostgresqlConfiguration config={config} onChange={onChange} />
    ),
  },
  sqlite: {
    createConfig: (existing) =>
      preserve(
        { category: "database", type: "sqlite", query: "" },
        existing,
        "source",
      ),
    render: (config, onChange) => (
      <SqliteConfiguration config={config} onChange={onChange} />
    ),
  },
  mysql: {
    createConfig: (existing) =>
      preserve(
        { category: "database", type: "mysql", query: "" },
        existing,
        "connectionId",
      ),
    render: (config, onChange) => (
      <DatabaseConfiguration
        databaseType="mysql"
        config={config}
        onChange={onChange}
      />
    ),
  },
  mssql: {
    createConfig: (existing) =>
      preserve(
        { category: "database", type: "mssql", query: "" },
        existing,
        "connectionId",
      ),
    render: (config, onChange) => (
      <DatabaseConfiguration
        databaseType="mssql"
        config={config}
        onChange={onChange}
      />
    ),
  },
};

const OUTPUT_SOURCES: Record<string, SourceEntry> = {
  csv: {
    createConfig: () => ({ category: "file", type: "csv", csvMode: "sink" }),
    render: (config, onChange) => (
      <CsvOutputConfiguration
        mode={(config.csvMode as CSVOutputMode) || "sink"}
        config={config}
        onChange={onChange}
      />
    ),
  },
  parquet: {
    createConfig: () => ({
      category: "file",
      type: "parquet",
      parquetMode: "sink",
    }),
    render: (config, onChange) => (
      <ParquetOutputConfiguration
        mode={(config.parquetMode as ParquetOutputMode) || "sink"}
        config={config}
        onChange={onChange}
      />
    ),
  },
  excel: {
    createConfig: () => ({
      category: "file",
      type: "excel",
      table_style: "Table Style Medium 4",
      include_header: true,
      autofilter: true,
      autofit: false,
      float_precision: 3,
    }),
    render: (config, onChange) => (
      <ExcelOutputConfiguration config={config} onChange={onChange} />
    ),
  },
  json: {
    createConfig: () => ({ category: "file", type: "json", jsonMode: "sink" }),
    render: (config, onChange) => (
      <JsonOutputConfiguration
        mode={(config.jsonMode as JSONOutputMode) || "sink"}
        config={config}
        onChange={onChange}
      />
    ),
  },
  ipc: {
    createConfig: () => ({ category: "file", type: "ipc", ipcMode: "sink" }),
    render: (config, onChange) => (
      <IpcOutputConfiguration
        mode={(config.ipcMode as IpcOutputMode) || "sink"}
        config={config}
        onChange={onChange}
      />
    ),
  },
  avro: {
    createConfig: () => ({
      category: "file",
      type: "avro",
      compression: "uncompressed",
    }),
    render: (config, onChange) => (
      <AvroOutputConfiguration config={config} onChange={onChange} />
    ),
  },
  yxdb: {
    createConfig: () => ({ category: "file", type: "yxdb" }),
    render: (config, onChange) => (
      <YxdbOutputConfiguration config={config} onChange={onChange} />
    ),
  },
};

const SOURCE_REGISTRIES: Record<Operation, Record<string, SourceEntry>> = {
  input: INPUT_SOURCES,
  output: OUTPUT_SOURCES,
};

export function createSourceConfiguration(
  operation: Operation,
  sourceId: string,
  existing: ToolConfig = {},
  selectedMode?: string,
): ToolConfig | undefined {
  return SOURCE_REGISTRIES[operation][sourceId]?.createConfig(
    existing,
    selectedMode,
  );
}

export function getConfiguredSourceIds(operation: Operation): string[] {
  return Object.keys(SOURCE_REGISTRIES[operation]).sort();
}

interface SourceConfigurationPanelProps {
  operation: Operation;
  config: ToolConfig;
  onChange: ConfigChange;
}

export function SourceConfigurationPanel({
  operation,
  config,
  onChange,
}: SourceConfigurationPanelProps) {
  const sourceType = typeof config.type === "string" ? config.type : undefined;
  const isConfigured =
    operation === "input" ? Boolean(config.category) : Boolean(sourceType);

  if (!isConfigured) {
    return (
      <DataSourceSelector
        operation={operation}
        selectedId={sourceType}
        onSelect={(source: DataSource) => {
          const selectedMode = (
            source as DataSource & { selectedMode?: string }
          ).selectedMode;
          const nextConfig = createSourceConfiguration(
            operation,
            source.id,
            config,
            selectedMode,
          );
          if (nextConfig) onChange(nextConfig);
        }}
      />
    );
  }

  const entry = sourceType
    ? SOURCE_REGISTRIES[operation][sourceType]
    : undefined;
  if (entry) return entry.render(config, onChange);

  return (
    <div className="p-4 text-center text-theme-text-tertiary">
      <div className="text-sm">
        Configuration for {String(config.type)} {operation} is not implemented
      </div>
      <div className="mt-2 text-xs text-theme-text-disabled">
        Coming soon...
      </div>
    </div>
  );
}
