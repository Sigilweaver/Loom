/**
 * PostgreSQL Configuration Component
 *
 * Configuration panel for PostgreSQL database input.
 * Allows users to select a saved connection and write SQL queries.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  type EmissionMap,
  type ToolConfig,
} from '@domain/workflow/entities/workflow';
import { useConnectionStore } from '@state/connectionStore';
import type { ConnectionInfo } from '../../../types/connections';
import { Database, AlertCircle, Settings } from 'lucide-react';
import { CodeEditor } from '@components/common/CodeEditor';

// Default values for PostgreSQL tool (must match TOOL_DEFINITIONS)
const POSTGRESQL_DEFAULTS = {
  connectionId: "",
  query: "",
  owner: "client",
} as const;

/**
 * Build the emission map for PostgreSQL tool config.
 * Preserves existing _emit entries and updates PostgreSQL-specific fields
 * based on whether they differ from defaults.
 */
function buildPostgresqlEmit(config: ToolConfig): EmissionMap {
  // Start with existing _emit to preserve entries for other fields
  const emit: EmissionMap = { ...(config._emit as EmissionMap | undefined) };
  
  const connectionId = (config.connectionId as string) ?? "";
  const query = (config.query as string) ?? "";
  const owner = (config.owner as string) ?? "client";
  
  // Update PostgreSQL-specific fields based on whether they differ from defaults
  if (connectionId !== POSTGRESQL_DEFAULTS.connectionId) {
    emit.connectionId = true;
  } else {
    delete emit.connectionId;
  }
  if (query !== POSTGRESQL_DEFAULTS.query) {
    emit.query = true;
  } else {
    delete emit.query;
  }
  if (owner !== POSTGRESQL_DEFAULTS.owner) {
    emit.owner = true;
  } else {
    delete emit.owner;
  }
  
  return emit;
}

interface PostgresqlConfigurationProps {
  config: ToolConfig;
  onChange: (updatedConfig: ToolConfig) => void;
}

export const PostgresqlConfiguration: React.FC<PostgresqlConfigurationProps> = ({
  config,
  onChange,
}) => {
  const {
    connections,
    loaded,
    loadConnections,
    getConnectionsByType,
  } = useConnectionStore();
  
  const [postgresConnections, setPostgresConnections] = useState<ConnectionInfo[]>([]);

  // Load connections on mount
  useEffect(() => {
    if (!loaded) {
      loadConnections();
    }
  }, [loaded, loadConnections]);

  // Filter to PostgreSQL connections
  useEffect(() => {
    if (loaded) {
      const pgConnections = getConnectionsByType('postgresql');
      setPostgresConnections(pgConnections);
    }
  }, [loaded, connections, getConnectionsByType]);

  const handleConnectionChange = useCallback(
    (connectionId: string) => {
      // Find the connection to get its owner
      const connection = postgresConnections.find(c => c.id === connectionId);
      const owner = connection?.owner || 'client';
      
      const newConfig: ToolConfig = {
        ...config,
        connectionId,
        owner, // Set owner field based on the selected connection
      };
      // Build emission map based on what differs from defaults
      newConfig._emit = buildPostgresqlEmit(newConfig);
      onChange(newConfig);
    },
    [config, onChange, postgresConnections]
  );

  const handleQueryChange = useCallback(
    (value: string) => {
      const newConfig: ToolConfig = {
        ...config,
        query: value || "",
      };
      // Build emission map based on what differs from defaults
      newConfig._emit = buildPostgresqlEmit(newConfig);
      onChange(newConfig);
    },
    [config, onChange]
  );

  // Type-safe getters
  const connectionId = config.connectionId as string | undefined;
  const query = config.query as string | undefined;

  const selectedConnection = postgresConnections.find(c => c.id === connectionId);

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
            
            {postgresConnections.length === 0 ? (
              <div className="p-4 text-center border rounded-lg border-theme-border-primary bg-theme-surface-elevated">
                <Database className="w-8 h-8 mx-auto mb-2 opacity-40 text-theme-text-tertiary" />
                <p className="text-sm text-theme-text-secondary">
                  No PostgreSQL connections configured
                </p>
                <p className="mt-1 text-xs text-theme-text-tertiary">
                  Add a connection in Settings {'>'} Connections
                </p>
                <button
                  onClick={() => {
                    // Open settings dialog - this would need to be wired up
                    // For now, show a helpful message
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
                      // Reset to empty after opening settings
                      e.target.value = '';
                    } else {
                      handleConnectionChange(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 text-sm border rounded-lg border-theme-border-primary bg-theme-surface-elevated text-theme-text-primary focus:outline-none focus:ring-1 focus:ring-theme-border-focus"
                >
                  <option value="">Select a connection...</option>
                  {postgresConnections.map((conn) => (
                    <option key={conn.id} value={conn.id}>
                      {conn.name} ({conn.host}:{conn.port}/{conn.database}) {conn.owner === 'server' ? '[Server]' : '[Local]'}
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
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                    selectedConnection.owner === 'server' 
                      ? 'bg-theme-status-info-bg text-theme-status-info-text border border-theme-status-info-border'
                      : 'bg-theme-badge-write/10 text-theme-badge-write border border-theme-badge-write/20'
                  }`}>
                    {selectedConnection.owner === 'server' ? 'Server-Managed' : 'Local'}
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
              Write a SQL query to load data from PostgreSQL. The query will be executed when the workflow runs.
            </p>
          </div>

          {/* Validation warnings */}
          {!connectionId && (
            <div className="flex items-start gap-2 p-3 border rounded-lg border-theme-border-warning bg-theme-surface-warning">
              <AlertCircle className="flex-shrink-0 w-4 h-4 mt-0.5" style={{ color: 'var(--color-text-primary)' }} />
              <div className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                <p className="font-medium">Connection required</p>
                <p className="mt-0.5 text-xs opacity-80">
                  Select a PostgreSQL connection to enable query execution.
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
              <li className="flex items-start gap-1.5">
                <span className="text-theme-text-secondary">•</span>
                <span>Use <code className="px-1 rounded bg-theme-surface-elevated">LIMIT</code> to preview large tables</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-theme-text-secondary">•</span>
                <span>Column names are case-sensitive in PostgreSQL</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-theme-text-secondary">•</span>
                <span>Credentials are stored securely on your machine</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostgresqlConfiguration;
