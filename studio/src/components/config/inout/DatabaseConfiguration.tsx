/**
 * Database Configuration Component
 *
 * Generic configuration panel for database inputs (MySQL, SQL Server).
 * Uses saved connections from the Connection Manager.
 * 
 * This component is reusable across database types that follow the
 * host/port/credentials connection pattern.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  type EmissionMap,
  type ToolConfig,
} from '@domain/workflow/entities/workflow';
import { useAllConnections, type DatabaseConnectionInfo } from '../../../hooks/useAllConnections';
import type { DatabaseType } from '../../../types/connections';
import { DATABASE_TYPE_NAMES } from '../../../types/connections';
import { Database, AlertCircle, Settings } from 'lucide-react';
import { CodeEditor } from '@components/common/CodeEditor';

// Default values for database tool
const DATABASE_DEFAULTS = {
  connectionId: "",
  query: "",
  owner: "client",
} as const;

/**
 * Build the emission map for database tool config.
 */
function buildDatabaseEmit(config: ToolConfig): EmissionMap {
  const emit: EmissionMap = { ...(config._emit as EmissionMap | undefined) };

  const connectionId = (config.connectionId as string) ?? "";
  const query = (config.query as string) ?? "";
  const owner = (config.owner as string) ?? "client";

  if (connectionId !== DATABASE_DEFAULTS.connectionId) {
    emit.connectionId = true;
  } else {
    delete emit.connectionId;
  }
  if (query !== DATABASE_DEFAULTS.query) {
    emit.query = true;
  } else {
    delete emit.query;
  }
  if (owner !== DATABASE_DEFAULTS.owner) {
    emit.owner = true;
  } else {
    delete emit.owner;
  }

  return emit;
}

interface DatabaseConfigurationProps {
  config: ToolConfig;
  onChange: (updatedConfig: ToolConfig) => void;
  /** The database type to filter connections for */
  databaseType: DatabaseType;
}

export const DatabaseConfiguration: React.FC<DatabaseConfigurationProps> = ({
  config,
  onChange,
  databaseType,
}) => {
  const { loaded, getByType } = useAllConnections();

  const [dbConnections, setDbConnections] = useState<DatabaseConnectionInfo[]>([]);
  const displayName = DATABASE_TYPE_NAMES[databaseType] || databaseType;

  // Filter to matching database type connections when loaded
  useEffect(() => {
    if (loaded) {
      const filteredConnections = getByType(databaseType);
      setDbConnections(filteredConnections);
    }
  }, [loaded, getByType, databaseType]);

  const handleConnectionChange = useCallback(
    (connectionId: string) => {
      // Find the connection to get its owner
      const connection = dbConnections.find(c => c.id === connectionId);
      // Preserve owner as-is: 'client' for local, 'hub' for Hub-managed
      // Backend expects owner='hub' to request credentials from Hub during token validation
      const owner = connection?.owner ?? 'client';

      const newConfig: ToolConfig = {
        ...config,
        connectionId,
        owner,
      };
      newConfig._emit = buildDatabaseEmit(newConfig);
      onChange(newConfig);
    },
    [config, onChange, dbConnections]
  );

  const handleQueryChange = useCallback(
    (value: string) => {
      const newConfig: ToolConfig = {
        ...config,
        query: value || "",
      };
      newConfig._emit = buildDatabaseEmit(newConfig);
      onChange(newConfig);
    },
    [config, onChange]
  );

  // Type-safe getters
  const connectionId = config.connectionId as string | undefined;
  const query = config.query as string | undefined;

  const selectedConnection = dbConnections.find(c => c.id === connectionId);

  // Database-specific tips
  const getTips = () => {
    switch (databaseType) {
      case 'mysql':
        return [
          { text: 'Use LIMIT to preview large tables', code: 'LIMIT' },
          { text: 'MySQL is case-insensitive for table names on Windows' },
          { text: 'Use backticks for reserved word column names' },
        ];
      case 'mssql':
        return [
          { text: 'Use TOP instead of LIMIT for row limiting', code: 'SELECT TOP 100' },
          { text: 'SQL Server uses square brackets for reserved words' },
          { text: 'Connections use TLS encryption by default' },
        ];
      default:
        return [
          { text: 'Use LIMIT to preview large tables', code: 'LIMIT' },
          { text: 'Credentials are stored securely on your machine' },
        ];
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-4 space-y-6">
          {/* Connection Selection */}
          <div>
            <label className="block mb-2 text-sm font-medium text-theme-text-primary">
              Connection
            </label>

            {dbConnections.length === 0 ? (
              <div className="p-4 text-center border rounded-lg border-theme-border-primary bg-theme-surface-elevated">
                <Database className="w-8 h-8 mx-auto mb-2 opacity-40 text-theme-text-tertiary" />
                <p className="text-sm text-theme-text-secondary">
                  No {displayName} connections configured
                </p>
                <p className="mt-1 text-xs text-theme-text-tertiary">
                  Add a connection in Settings {'>'} Connections
                </p>
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('open-settings', { detail: { tab: 'connections' } }));
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 mt-3 text-xs rounded transition-colors bg-theme-interactive-accent text-theme-text-on-accent hover:opacity-90"
                >
                  <Settings className="w-3 h-3" />
                  Open Settings
                </button>
              </div>
            ) : (
              <>
                <select
                  value={connectionId || ''}
                  onChange={(e) => {
                    if (e.target.value === '__configure_new__') {
                      window.dispatchEvent(new CustomEvent('open-settings', { detail: { tab: 'connections' } }));
                      e.target.value = '';
                    } else {
                      handleConnectionChange(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 text-sm border rounded-lg border-theme-border-primary bg-theme-surface-elevated text-theme-text-primary focus:outline-none focus:ring-1 focus:ring-theme-border-focus"
                >
                  <option value="">Select a connection...</option>
                  {dbConnections.map((conn) => (
                    <option key={conn.id} value={conn.id}>
                      {conn.name} ({conn.host}:{conn.port}/{conn.database}) {conn.owner === 'hub' ? '[Hub]' : '[Local]'}
                    </option>
                  ))}
                  <option value="__configure_new__" className="border-t border-theme-border-primary">
                    Configure new connection...
                  </option>
                </select>
              </>
            )}

            {selectedConnection && (
              <div className="p-2 mt-2 text-xs border rounded border-theme-border-primary bg-theme-surface-panel text-theme-text-tertiary">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <Database className="w-3 h-3" />
                    <span className="font-medium text-theme-text-secondary">
                      {selectedConnection.name}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${selectedConnection.owner === 'hub'
                      ? 'bg-theme-status-info-bg text-theme-status-info-text border border-theme-status-info-border'
                      : 'text-theme-badge-write border'
                    }`}>
                    {selectedConnection.owner === 'hub' ? 'Hub-Managed' : 'Local'}
                  </span>
                </div>
                <div className="mt-1">
                  {selectedConnection.host}:{selectedConnection.port}/{selectedConnection.database}
                </div>
              </div>
            )}
          </div>

          {/* SQL Query */}
          <div>
            <label className="block mb-2 text-sm font-medium text-theme-text-primary">
              SQL Query
            </label>
            <div className="border border-theme-border-primary rounded-lg overflow-hidden">
              <CodeEditor
                value={query || ''}
                onChange={handleQueryChange}
                language="sql"
                height="200px"
                placeholder="SELECT * FROM table_name"
              />
            </div>
            <p className="mt-1 text-xs text-theme-text-tertiary">
              Write a SQL query to load data from {displayName}. The query will be executed when the workflow runs.
            </p>
          </div>

          {/* Validation warnings */}
          {!connectionId && (
            <div className="flex items-start gap-2 p-3 border rounded-lg border-theme-border-warning bg-theme-surface-warning">
              <AlertCircle className="flex-shrink-0 w-4 h-4 mt-0.5" style={{ color: 'var(--color-text-primary)' }} />
              <div className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                <p className="font-medium">Connection required</p>
                <p className="mt-0.5 text-xs opacity-80">
                  Select a {displayName} connection to enable query execution.
                </p>
              </div>
            </div>
          )}

          {connectionId && !query?.trim() && (
            <div className="flex items-start gap-2 p-3 border rounded-lg border-theme-border-warning bg-theme-surface-warning">
              <AlertCircle className="flex-shrink-0 w-4 h-4 mt-0.5" style={{ color: 'var(--color-text-primary)' }} />
              <div className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                <p className="font-medium">Query required</p>
                <p className="mt-0.5 text-xs opacity-80">
                  Enter a SQL query to load data from the database.
                </p>
              </div>
            </div>
          )}

          {/* Tips section */}
          <div className="p-3 border rounded-lg border-theme-border-primary bg-theme-surface-panel">
            <h4 className="mb-2 text-xs font-medium text-theme-text-primary">Tips</h4>
            <ul className="space-y-1 text-xs text-theme-text-tertiary">
              {getTips().map((tip) => (
                <li key={tip.text} className="flex items-start gap-1.5">
                  <span className="text-theme-text-secondary">-</span>
                  <span>
                    {tip.code ? (
                      <>Use <code className="px-1 rounded bg-theme-surface-elevated">{tip.code}</code> {tip.text.replace(/^Use \w+ /, '')}</>
                    ) : (
                      tip.text
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatabaseConfiguration;
