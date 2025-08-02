import { ConnectionType } from '../types/configuration';
import { csvConfig, excelConfig } from './fileTypes';
import { postgresqlConfig, sqliteConfig } from './databaseTypes';

// Central registry of all connection types
export const CONNECTION_TYPES: ConnectionType[] = [
  // File Types (Implemented)
  csvConfig,
  excelConfig,
  
  // Database Types (Future implementation)
  postgresqlConfig,
  sqliteConfig
];

// Helper functions
export const getConnectionType = (id: string): ConnectionType | undefined => {
  return CONNECTION_TYPES.find(type => type.id === id);
};

export const getFileTypes = (): ConnectionType[] => {
  return CONNECTION_TYPES.filter(type => type.category === 'file');
};

export const getDatabaseTypes = (): ConnectionType[] => {
  return CONNECTION_TYPES.filter(type => type.category === 'database');
};

export const getImplementedTypes = (): ConnectionType[] => {
  return CONNECTION_TYPES.filter(type => type.isImplemented);
};

// Get connection types that support the Input tool
export const getInputConnectionTypes = (): ConnectionType[] => {
  // For now, all connection types can be used for input
  // In the future, we might have output-only connection types
  return getImplementedTypes();
};
