import { Database, FolderOpen } from "lucide-react";
import type { ConnectionType, DatabaseType, PathType } from "@api";

export const CONNECTION_TYPES: { value: ConnectionType; label: string; icon: typeof Database }[] = [
  { value: "database", label: "Database", icon: Database },
  { value: "filesystem", label: "Filesystem", icon: FolderOpen },
];

export const DATABASE_TYPES: { value: DatabaseType; label: string; defaultPort: number }[] = [
  { value: "postgresql", label: "PostgreSQL", defaultPort: 5432 },
  { value: "mysql", label: "MySQL", defaultPort: 3306 },
  { value: "mssql", label: "SQL Server", defaultPort: 1433 },
  { value: "sqlite", label: "SQLite", defaultPort: 0 },
];

export const PATH_TYPES: { value: PathType; label: string }[] = [
  { value: "local", label: "Local path" },
  { value: "unc", label: "UNC path (network)" },
];

export function defaultPort(dbType: DatabaseType): number {
  return DATABASE_TYPES.find((t) => t.value === dbType)?.defaultPort ?? 0;
}
