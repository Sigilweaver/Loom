import { useMemo, useState } from "react";
import { useTheme } from "../contexts/ThemeContext";

interface DataSource {
  id: string;
  name: string;
  category: "file" | "database";
  description: string;
  enabled: boolean;
  defaultMode?: string;
  /** Which operations this format supports. Defaults to both if not specified. */
  supportedOperations?: ("input" | "output")[];
}

const DATA_SOURCES: DataSource[] = [
  // File formats
  {
    id: "csv",
    name: "CSV",
    category: "file",
    description: "Delimited text files (CSV, TSV, TAB, TXT)",
    enabled: true,
    defaultMode: "scan",
  },
  {
    id: "excel",
    name: "Excel",
    category: "file",
    description: "Microsoft Excel spreadsheet (.xlsx, .xls, .xlsb)",
    enabled: true,
  },
  {
    id: "parquet",
    name: "Parquet",
    category: "file",
    description: "Apache Parquet columnar storage",
    enabled: true,
    defaultMode: "scan",
  },
  {
    id: "json",
    name: "JSON",
    category: "file",
    description: "JSON and NDJSON files (.json, .jsonl, .ndjson)",
    enabled: true,
    defaultMode: "scan",
  },
  {
    id: "ipc",
    name: "IPC / Arrow",
    category: "file",
    description: "Apache Arrow IPC format (.arrow, .ipc, .feather)",
    enabled: true,
    defaultMode: "scan",
  },
  {
    id: "avro",
    name: "Avro",
    category: "file",
    description: "Apache Avro binary format (.avro)",
    enabled: true,
  },
  {
    id: "ods",
    name: "ODS",
    category: "file",
    description: "OpenDocument Spreadsheet (.ods) - LibreOffice/OpenOffice",
    enabled: false,
    supportedOperations: ["input"], // Read-only in Polars
  },

  // Databases
  {
    id: "sqlite",
    name: "SQLite",
    category: "database",
    description: "Lightweight SQL database",
    enabled: false,
  },
  {
    id: "postgresql",
    name: "PostgreSQL",
    category: "database",
    description: "Advanced open source database",
    enabled: false,
  },
  {
    id: "mysql",
    name: "MySQL",
    category: "database",
    description: "Popular open source database",
    enabled: false,
  },
  {
    id: "mariadb",
    name: "MariaDB",
    category: "database",
    description: "MySQL-compatible database",
    enabled: false,
  },
  {
    id: "oracle",
    name: "Oracle Database",
    category: "database",
    description: "Enterprise database system",
    enabled: false,
  },
  {
    id: "sqlserver",
    name: "SQL Server",
    category: "database",
    description: "Microsoft SQL Server database",
    enabled: false,
  },
];

interface DataSourceSelectorProps {
  onSelect: (dataSource: DataSource) => void;
  selectedId?: string | undefined;
  /** Filter data sources by operation type. Shows all if not specified. */
  operation?: "input" | "output";
}

// Get icon URL based on theme and data source
const getIconUrl = (dataSourceId: string, currentTheme: string): string => {
  // Determine icon color based on theme with much better contrast
  let color: string;

  switch (currentTheme) {
    case "sigilweaver":
      // Much lighter for sigilweaver dark theme
      color = "white";
      break;
    case "dark":
      // Much lighter for dark theme
      color = "white";
      break;
    case "light":
      // Much darker for light theme
      color = "333333"; // Very dark gray, almost black
      break;
    case "highContrast":
      // High contrast uses white for maximum contrast
      color = "white";
      break;
    default:
      // Default fallback to dark
      color = "333333";
  }

  // Simple Icons mapping
  const simpleIconsMap: Record<string, string> = {
    csv: "files",
    excel: "microsoftexcel",
    parquet: "apacheparquet",
    json: "json",
    ipc: "apachearrow",
    avro: "apachekafka", // Avro is closely associated with Kafka ecosystem
    ods: "libreoffice",
    sqlite: "sqlite",
    postgresql: "postgresql",
    mysql: "mysql",
    mariadb: "mariadb",
    sqlserver: "microsoftsqlserver",
  };

  // For Oracle, use devicons since simple-icons removed it due to legal issues
  if (dataSourceId === "oracle") {
    return `https://cdn.jsdelivr.net/gh/devicons/devicon/icons/oracle/oracle-original.svg`;
  }

  // Use simple-icons for everything else
  const iconName = simpleIconsMap[dataSourceId];
  if (iconName) {
    return `https://cdn.simpleicons.org/${iconName}/${color}`;
  }

  // Fallback
  return `https://cdn.simpleicons.org/files/${color}`;
};

export const DataSourceSelector: React.FC<DataSourceSelectorProps> = ({
  onSelect,
  selectedId,
  operation,
}) => {
  const { currentTheme } = useTheme();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    "all" | "file" | "database"
  >("all");

  // Filter data sources based on search, category, and operation
  const filteredSources = useMemo(() => {
    let sources = DATA_SOURCES;

    // Filter by operation (input/output) if specified
    if (operation) {
      sources = sources.filter((ds) => {
        // If supportedOperations is not specified, the format supports both
        const supported = ds.supportedOperations || ["input", "output"];
        return supported.includes(operation);
      });
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      sources = sources.filter(
        (ds) =>
          ds.name.toLowerCase().includes(term) ||
          ds.description.toLowerCase().includes(term)
      );
    }

    if (selectedCategory !== "all") {
      sources = sources.filter((ds) => ds.category === selectedCategory);
    }

    return sources;
  }, [searchTerm, selectedCategory, operation]);

  // Group sources by category
  const fileFormats = filteredSources.filter((ds) => ds.category === "file");
  const databases = filteredSources.filter((ds) => ds.category === "database");

  const DataSourceCard: React.FC<{ dataSource: DataSource }> = ({
    dataSource,
  }) => {
    const isSelected = selectedId === dataSource.id;

    const handleClick = () => {
      if (!dataSource.enabled) return;

      // Pass defaultMode if available (for CSV)
      if (dataSource.defaultMode) {
        onSelect({
          ...dataSource,
          selectedMode: dataSource.defaultMode,
        } as DataSource & { selectedMode: string });
      } else {
        onSelect(dataSource);
      }
    };

    return (
      <button
        onClick={handleClick}
        disabled={!dataSource.enabled}
        className={`
          relative w-full p-4 border-2 rounded-lg transition-all duration-200 text-left
          ${
            dataSource.enabled
              ? "cursor-pointer hover:shadow-md"
              : "cursor-not-allowed opacity-60"
          }
          ${
            isSelected
              ? "border-theme-border-focus bg-theme-interactive-accent text-white shadow-md"
              : "border-theme-border-primary bg-theme-surface-panel hover:border-theme-border-focus"
          }
        `}
      >
        {/* Coming Soon Badge */}
        {!dataSource.enabled && (
          <div className="absolute px-2 py-1 text-xs font-medium border rounded-md top-2 right-2 bg-theme-surface-elevated text-theme-text-tertiary border-theme-border-primary">
            Coming Soon
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center flex-shrink-0 w-8 h-8">
            <img
              src={getIconUrl(dataSource.id, currentTheme.id)}
              alt={`${dataSource.name} icon`}
              className="w-6 h-6"
              onError={(e) => {
                // Fallback to text if icon fails to load
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
                const fallback = target.nextElementSibling as HTMLDivElement;
                if (fallback) fallback.style.display = "flex";
              }}
            />
            <div className="items-center justify-center hidden w-6 h-6 text-xs font-bold text-white rounded bg-theme-text-tertiary">
              {dataSource.name.slice(0, 2).toUpperCase()}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div
              className={`font-medium ${isSelected ? "text-white" : "text-theme-text-primary"}`}
            >
              {dataSource.name}
            </div>
            <div
              className={`text-sm ${isSelected ? "text-white opacity-90" : "text-theme-text-secondary"}`}
            >
              {dataSource.description}
            </div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar and Filters - Fixed at top */}
      <div className="flex-shrink-0 p-4 space-y-3 border-b border-theme-border-primary bg-theme-surface-panel">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <span className="text-sm text-theme-text-tertiary">🔍</span>
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search data sources..."
            className="w-full py-2 pl-10 pr-4 text-sm border rounded-lg border-theme-border-primary bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
          />
        </div>

        {/* Category Filter */}
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors border ${
              selectedCategory === "all"
                ? "bg-theme-surface-elevated text-theme-text-primary border-theme-border-primary shadow-sm"
                : "bg-theme-surface-panel text-theme-text-tertiary hover:text-theme-text-secondary border-theme-border-primary"
            }`}
          >
            All Sources
          </button>

          <button
            onClick={() => setSelectedCategory("file")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 border ${
              selectedCategory === "file"
                ? "bg-theme-surface-elevated text-theme-text-primary border-theme-border-primary shadow-sm"
                : "bg-theme-surface-panel text-theme-text-tertiary hover:text-theme-text-secondary border-theme-border-primary"
            }`}
          >
            <span>📁</span>
            Files
          </button>

          <button
            onClick={() => setSelectedCategory("database")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 border ${
              selectedCategory === "database"
                ? "bg-theme-surface-elevated text-theme-text-primary border-theme-border-primary shadow-sm"
                : "bg-theme-surface-panel text-theme-text-tertiary hover:text-theme-text-secondary border-theme-border-primary"
            }`}
          >
            <span>🗄️</span>
            Databases
          </button>
        </div>
      </div>

      {/* Scrollable Data Sources */}
      <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
        <div className="space-y-4">
          {selectedCategory !== "database" && fileFormats.length > 0 && (
            <div>
              {selectedCategory === "all" && (
                <h4 className="flex items-center gap-2 mb-2 text-sm font-medium text-theme-text-primary">
                  <span>📁</span>
                  File Formats
                </h4>
              )}
              <div className="space-y-2">
                {fileFormats.map((dataSource) => (
                  <DataSourceCard key={dataSource.id} dataSource={dataSource} />
                ))}
              </div>
            </div>
          )}

          {selectedCategory !== "file" && databases.length > 0 && (
            <div>
              {selectedCategory === "all" && (
                <h4 className="flex items-center gap-2 mb-2 text-sm font-medium text-theme-text-primary">
                  <span>🗄️</span>
                  Databases
                </h4>
              )}
              <div className="space-y-2">
                {databases.map((dataSource) => (
                  <DataSourceCard key={dataSource.id} dataSource={dataSource} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* No Results */}
        {filteredSources.length === 0 && (
          <div className="py-8 text-center text-theme-text-tertiary">
            <div className="mb-2 text-2xl">🔍</div>
            <p className="text-sm">No data sources found</p>
            <p className="mt-1 text-xs">
              Try adjusting your search or category filter
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
