import { ConnectionType } from '../types/configuration';

// Placeholder configurations for database types
// These will be implemented in future iterations

export const postgresqlConfig: ConnectionType = {
  id: 'postgresql',
  displayName: 'PostgreSQL Database',
  category: 'database',
  isImplemented: false,
  configSchema: [
    {
      id: 'host',
      label: 'Host',
      type: 'text',
      defaultValue: 'localhost',
      required: true
    },
    {
      id: 'port',
      label: 'Port',
      type: 'number',
      defaultValue: 5432,
      required: true
    },
    {
      id: 'database',
      label: 'Database Name',
      type: 'text',
      defaultValue: '',
      required: true
    },
    {
      id: 'username',
      label: 'Username',
      type: 'text',
      defaultValue: '',
      required: true
    },
    {
      id: 'password',
      label: 'Password',
      type: 'text', // TODO: Make this a password field
      defaultValue: '',
      required: true
    },
    {
      id: 'query',
      label: 'SQL Query',
      type: 'text', // TODO: Make this a textarea
      defaultValue: 'SELECT * FROM table_name',
      required: true
    }
  ]
};

export const sqliteConfig: ConnectionType = {
  id: 'sqlite',
  displayName: 'SQLite Database',
  category: 'database',
  isImplemented: false,
  configSchema: [
    {
      id: 'filePath',
      label: 'Database File Path',
      type: 'file',
      defaultValue: '',
      required: true
    },
    {
      id: 'query',
      label: 'SQL Query',
      type: 'text',
      defaultValue: 'SELECT * FROM table_name',
      required: true
    }
  ]
};
