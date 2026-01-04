/**
 * useAllConnections Hook
 * 
 * Provides access to all database connections from both local storage
 * and Hub (when in Hub mode and logged in). This is the primary hook for
 * components that need to display connection selectors.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useConnectionStore } from '@state/connectionStore';
import { useSettingsStore } from '@state/settingsStore';
import { hasHubClient, getHubClient, type HubConnectionInfo } from '../api/hub';
import type { ConnectionInfo, DatabaseType } from '../types/connections';

/**
 * Global Hub connections refresh listener set.
 * Used to notify all useAllConnections hooks when Hub connections should be refreshed.
 */
const hubConnectionsListeners = new Set<() => void>();

/**
 * Trigger all useAllConnections hooks to refresh Hub connections.
 * Call this after Hub login to ensure components get the latest connections.
 */
export function triggerHubConnectionsRefresh(): void {
  hubConnectionsListeners.forEach(listener => listener());
}

/**
 * Database connection info from local storage or Hub
 */
export interface DatabaseConnectionInfo {
  id: string;
  name: string;
  type: DatabaseType;
  host: string;
  port: number;
  database: string;
  /** 'client' for local, 'hub' for Hub-managed */
  owner: 'client' | 'hub';
}

interface UseAllConnectionsResult {
  /** All connections (local + Hub when applicable) */
  connections: DatabaseConnectionInfo[];
  /** Whether connections are being loaded */
  loading: boolean;
  /** Whether initial load has completed */
  loaded: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Refresh connections from all sources */
  refresh: () => Promise<void>;
  /** Get connections filtered by database type */
  getByType: (type: DatabaseType) => DatabaseConnectionInfo[];
}

/**
 * Convert local ConnectionInfo to DatabaseConnectionInfo
 */
function toLocalDbConnection(conn: ConnectionInfo): DatabaseConnectionInfo {
  return {
    id: conn.id,
    name: conn.name,
    type: conn.type,
    host: conn.host,
    port: conn.port,
    database: conn.database,
    owner: 'client',
  };
}

/**
 * Convert Hub connection to DatabaseConnectionInfo
 * Only handles database connections - filesystem connections are filtered out
 */
function toHubDbConnection(conn: HubConnectionInfo): DatabaseConnectionInfo | null {
  // Only convert database connections
  if (conn.type !== 'database' || !conn.database_config) {
    return null;
  }

  return {
    id: conn.id,
    name: conn.name,
    type: conn.database_config.db_type as DatabaseType,
    host: conn.database_config.host,
    port: conn.database_config.port,
    database: conn.database_config.database,
    owner: 'hub',
  };
}

/**
 * Hook to get all available connections from both local storage and Hub
 */
export function useAllConnections(): UseAllConnectionsResult {
  const { executionMode, hub } = useSettingsStore();
  const { connections: localConnections, loaded: localLoaded, loadConnections } = useConnectionStore();

  const [hubConnections, setHubConnections] = useState<DatabaseConnectionInfo[]>([]);
  const [hubLoading, setHubLoading] = useState(false);
  const [hubLoaded, setHubLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine if we should fetch Hub connections
  // Use hub.sessionToken from reactive store + hasHubClient() to ensure client is initialized
  const hubClientReady = hasHubClient();

  // Load Hub connections
  const loadHubConnections = useCallback(async () => {
    // Re-check hasHubClient() inside the callback since it may have changed
    const inHubMode = executionMode === 'hub' && !!hub.sessionToken;
    const clientAvailable = hasHubClient();

    // Not in Hub mode or no token: mark loaded immediately
    if (!inHubMode) {
      setHubConnections([]);
      setHubLoaded(true);
      setHubLoading(false);
      return;
    }

    // Hub mode but client not ready yet: expose as not loaded so retry logic runs
    if (!clientAvailable) {
      setHubConnections([]);
      setHubLoaded(false);
      setHubLoading(false);
      return;
    }

    setHubLoading(true);
    setError(null);

    try {
      const conns = await getHubClient().listConnections();
      // Filter to database connections only (filesystem connections return null)
      const databaseConns = conns
        .map(toHubDbConnection)
        .filter((c): c is DatabaseConnectionInfo => c !== null);
      setHubConnections(databaseConns);
      setHubLoaded(true);
    } catch (e) {
      console.error('[useAllConnections] Failed to load Hub connections:', e);
      setError(e instanceof Error ? e.message : 'Failed to load Hub connections');
      setHubLoaded(true);
    } finally {
      setHubLoading(false);
    }
  }, [executionMode, hub.sessionToken]); // Remove isHubMode, use direct dependencies

  // Subscribe to external refresh trigger (e.g., after Hub login)
  useEffect(() => {
    const listener = () => {
      loadHubConnections();
    };
    hubConnectionsListeners.add(listener);
    return () => {
      hubConnectionsListeners.delete(listener);
    };
  }, [loadHubConnections]);

  // Load all connections on mount only (not on every dependency change)
  // Use a ref to track if we've done the initial load
  const didInitialLoad = useRef(false);
  useEffect(() => {
    if (!didInitialLoad.current) {
      didInitialLoad.current = true;
      loadConnections();
      loadHubConnections();
    }
  }, [loadConnections, loadHubConnections]);

  // Retry loading Hub connections if we have a token but Hub client wasn't ready
  // This handles the race condition where component mounts before SettingsPane initializes Hub client
  useEffect(() => {
    if (executionMode === 'hub' && hub.sessionToken && !hubClientReady && !hubLoaded) {
      // Hub client not ready yet - retry after a short delay
      const timer = setTimeout(() => {
        if (hasHubClient()) {
          loadHubConnections();
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [executionMode, hub.sessionToken, hubClientReady, hubLoaded, loadHubConnections]);

  // Refresh function
  const refresh = useCallback(async () => {
    await Promise.all([
      loadConnections(),
      loadHubConnections(),
    ]);
  }, [loadConnections, loadHubConnections]);

  // Combine all connections - memoize to prevent unnecessary recalculations
  const allConnections: DatabaseConnectionInfo[] = useMemo(() => [
    ...hubConnections, // Hub connections first (if any)
    ...localConnections.map(toLocalDbConnection),
  ], [hubConnections, localConnections]);

  // Filter by type - stable callback that reads from current allConnections
  const getByType = useCallback((type: DatabaseType): DatabaseConnectionInfo[] => {
    // Combine inline to avoid dependency on allConnections array identity
    const combined = [
      ...hubConnections,
      ...localConnections.map(toLocalDbConnection),
    ];
    return combined.filter(c => c.type === type);
  }, [hubConnections, localConnections]);

  return {
    connections: allConnections,
    loading: hubLoading || !localLoaded,
    loaded: localLoaded && hubLoaded,
    error,
    refresh,
    getByType,
  };
}
