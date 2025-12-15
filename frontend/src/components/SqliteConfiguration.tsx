/**
 * SQLite Configuration Component
 *
 * Configuration panel for SQLite database input.
 * SQLite is file-based, so users select a file instead of configuring a connection.
 */

import React, { useCallback } from 'react';
import {
  type EmissionMap,
  type ToolConfig,
} from '@domain/workflow/entities/workflow';
import { Database, AlertCircle, FolderOpen } from 'lucide-react';
import { CodeEditor } from './common/CodeEditor';

// Default values for SQLite tool
const SQLITE_DEFAULTS = {
  source: "",
  query: "",
} as const;

/**
 * Build the emission map for SQLite tool config.
 */
function buildSqliteEmit(config: ToolConfig): EmissionMap {
  const emit: EmissionMap = { ...(config._emit as EmissionMap | undefined) };
  
  const source = (config.source as string) ?? "";
  const query = (config.query as string) ?? "";
  
  if (source !== SQLITE_DEFAULTS.source) {
    emit.source = true;
  } else {
    delete emit.source;
  }
  if (query !== SQLITE_DEFAULTS.query) {
    emit.query = true;
  } else {
    delete emit.query;
  }
  
  return emit;
}

interface SqliteConfigurationProps {
  config: ToolConfig;
  onChange: (updatedConfig: ToolConfig) => void;
}

export const SqliteConfiguration: React.FC<SqliteConfigurationProps> = ({
  config,
  onChange,
}) => {
  const handleFileSelect = useCallback(async () => {
    // Use Electron's file dialog if available
    if (window.electronAPI?.showOpenDialog) {
      const result = await window.electronAPI.showOpenDialog({
        title: 'Select SQLite Database',
        filters: [
          { name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3', 'db3'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });
      
      if (result && result.length > 0) {
        const filePath = result[0];
        // Build SQLite URI format: sqlite:///path/to/file.db
        const sqliteUri = `sqlite://${filePath}`;
        const newConfig: ToolConfig = {
          ...config,
          source: sqliteUri,
        };
        newConfig._emit = buildSqliteEmit(newConfig);
        onChange(newConfig);
      }
    } else {
      // Fallback: prompt for manual path entry
      const path = prompt('Enter the path to your SQLite database file:');
      if (path) {
        // Build SQLite URI format: sqlite:///path/to/file.db
        const sqliteUri = `sqlite://${path}`;
        const newConfig: ToolConfig = {
          ...config,
          source: sqliteUri,
        };
        newConfig._emit = buildSqliteEmit(newConfig);
        onChange(newConfig);
      }
    }
  }, [config, onChange]);

  const handlePathChange = useCallback(
    (value: string) => {
      // Build SQLite URI format: sqlite:///path/to/file.db
      // If user pastes a URI, use it directly; otherwise prepend sqlite://
      const sqliteUri = value.startsWith('sqlite://') ? value : `sqlite://${value}`;
      const newConfig: ToolConfig = {
        ...config,
        source: sqliteUri,
      };
      newConfig._emit = buildSqliteEmit(newConfig);
      onChange(newConfig);
    },
    [config, onChange]
  );

  const handleQueryChange = useCallback(
    (value: string) => {
      const newConfig: ToolConfig = {
        ...config,
        query: value || "",
      };
      newConfig._emit = buildSqliteEmit(newConfig);
      onChange(newConfig);
    },
    [config, onChange]
  );

  // Type-safe getters
  const source = config.source as string | undefined;
  const query = config.query as string | undefined;
  
  // Extract file path from URI for display (strip sqlite:// prefix)
  const displayPath = source?.startsWith('sqlite://') 
    ? source.slice('sqlite://'.length) 
    : source;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-4 space-y-6">
          {/* Database File Selection */}
          <div>
            <label className="block mb-2 text-sm font-medium text-theme-text-primary">
              Database File
            </label>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={displayPath || ''}
                onChange={(e) => handlePathChange(e.target.value)}
                placeholder="/path/to/database.db"
                className="flex-1 px-3 py-2 text-sm border rounded-lg border-theme-border-primary bg-theme-surface-elevated text-theme-text-primary focus:outline-none focus:ring-1 focus:ring-theme-border-focus"
              />
              <button
                onClick={handleFileSelect}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors border border-theme-border-primary bg-theme-surface-elevated text-theme-text-primary hover:bg-theme-surface-panel"
              >
                <FolderOpen className="w-4 h-4" />
                Browse
              </button>
            </div>

            {displayPath && (
              <div className="p-2 mt-2 text-xs border rounded border-theme-border-primary bg-theme-surface-panel text-theme-text-tertiary">
                <div className="flex items-center gap-1">
                  <Database className="w-3 h-3" />
                  <span className="font-medium text-theme-text-secondary">
                    {displayPath.split('/').pop() || displayPath.split('\\').pop() || displayPath}
                  </span>
                </div>
                <div className="mt-1 truncate opacity-60">
                  {displayPath}
                </div>
              </div>
            )}
          </div>

          {/* SQL Query */}
          <div>
            <label className="block mb-2 text-sm font-medium text-theme-text-primary">
              SQL Query
            </label>
            <div className="overflow-hidden border rounded-lg border-theme-border-primary">
              <CodeEditor
                value={query || ''}
                onChange={handleQueryChange}
                language="sql"
                height="200px"
                placeholder="SELECT * FROM table_name"
              />
            </div>
            <p className="mt-1 text-xs text-theme-text-tertiary">
              Write a SQL query to load data from SQLite. The query will be executed when the workflow runs.
            </p>
          </div>

          {/* Validation warnings */}
          {!source && (
            <div className="flex items-start gap-2 p-3 border rounded-lg border-theme-border-warning bg-theme-surface-warning">
              <AlertCircle className="flex-shrink-0 w-4 h-4 mt-0.5" style={{ color: 'var(--color-text-primary)' }} />
              <div className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                <p className="font-medium">Database file required</p>
                <p className="mt-0.5 text-xs opacity-80">
                  Select or enter the path to a SQLite database file.
                </p>
              </div>
            </div>
          )}

          {source && !query?.trim() && (
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
                <span className="text-theme-text-secondary">-</span>
                <span>Use <code className="px-1 rounded bg-theme-surface-elevated">SELECT name FROM sqlite_master WHERE type='table'</code> to list tables</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-theme-text-secondary">-</span>
                <span>SQLite files typically use .db, .sqlite, or .sqlite3 extensions</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-theme-text-secondary">-</span>
                <span>The database file will be opened in read-only mode</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SqliteConfiguration;
