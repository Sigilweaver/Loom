/**
 * Connection Manager Component
 * 
 * Manages database connections in the Settings dialog.
 * Provides CRUD operations for connections with secure credential storage.
 */

import React, { useState, useEffect } from 'react';
import { useConnectionStore } from '@state/connectionStore';
import type { 
  ConnectionInfo, 
  CreateConnectionInput,
  UpdateConnectionInput,
  DatabaseType 
} from '../../types/connections';
import { DEFAULT_PORTS, DATABASE_TYPE_NAMES } from '../../types/connections';
import { Database, Plus, Pencil, Trash2, AlertCircle, Check, Loader2, HelpCircle, Info } from 'lucide-react';

interface ConnectionFormData {
  name: string;
  type: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

const EMPTY_FORM: ConnectionFormData = {
  name: '',
  type: 'postgresql',
  host: 'localhost',
  port: DEFAULT_PORTS.postgresql,
  database: '',
  username: '',
  password: '',
};

interface ConnectionFormProps {
  initialData?: ConnectionFormData;
  onSubmit: (data: ConnectionFormData) => Promise<void>;
  onCancel: () => void;
  isEditing?: boolean;
  loading?: boolean;
}

const ConnectionForm: React.FC<ConnectionFormProps> = ({
  initialData = EMPTY_FORM,
  onSubmit,
  onCancel,
  isEditing = false,
  loading = false,
}) => {
  const [formData, setFormData] = useState<ConnectionFormData>(initialData);
  const [errors, setErrors] = useState<Partial<Record<keyof ConnectionFormData, string>>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof ConnectionFormData, string>> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    // All connection types need host, port, database, and credentials
    if (!formData.host.trim()) {
      newErrors.host = 'Host is required';
    }
    if (formData.port < 1 || formData.port > 65535) {
      newErrors.port = 'Port must be between 1 and 65535';
    }
    if (!formData.database.trim()) {
      newErrors.database = 'Database name is required';
    }
    // Username is only required for new connections - when editing, leave blank to keep existing
    if (!isEditing && !formData.username.trim()) {
      newErrors.username = 'Username is required';
    }
    // Password can be empty for some setups
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      await onSubmit(formData);
    }
  };

  const handleTypeChange = (type: DatabaseType) => {
    setFormData(prev => ({
      ...prev,
      type,
      port: DEFAULT_PORTS[type],
    }));
  };

  const inputStyle = {
    backgroundColor: 'var(--color-modal-container-bg)',
    border: '1px solid var(--color-modal-container-border)',
    color: 'var(--color-modal-content-text)',
  };

  const labelStyle = {
    color: 'var(--color-modal-content-text)',
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Connection Name */}
      <div>
        <label className="block text-sm font-medium mb-1" style={labelStyle}>
          Connection Name *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          className="w-full px-3 py-2 rounded focus:outline-none"
          style={inputStyle}
          placeholder="My PostgreSQL Database"
          disabled={loading}
        />
        {errors.name && (
          <p className="mt-1 text-xs text-theme-form-error-text">{errors.name}</p>
        )}
      </div>

      {/* Database Type */}
      <div>
        <label className="block text-sm font-medium mb-1" style={labelStyle}>
          Database Type
        </label>
        <select
          value={formData.type}
          onChange={(e) => handleTypeChange(e.target.value as DatabaseType)}
          className="w-full px-3 py-2 rounded focus:outline-none"
          style={inputStyle}
          disabled={isEditing || loading} // Can't change type when editing
        >
          <option value="postgresql">PostgreSQL</option>
          <option value="mysql">MySQL</option>
          <option value="mssql">SQL Server</option>
        </select>
      </div>

      {/* Host and Port */}
      <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1" style={labelStyle}>
              Host *
            </label>
            <input
              type="text"
              value={formData.host}
              onChange={(e) => setFormData(prev => ({ ...prev, host: e.target.value }))}
              className="w-full px-3 py-2 rounded focus:outline-none"
              style={inputStyle}
              placeholder="localhost"
              disabled={loading}
            />
            {errors.host && (
              <p className="mt-1 text-xs text-theme-form-error-text">{errors.host}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={labelStyle}>
              Port *
            </label>
            <input
              type="number"
              value={formData.port}
              onChange={(e) => setFormData(prev => ({ ...prev, port: parseInt(e.target.value, 10) || 0 }))}
              className="w-full px-3 py-2 rounded focus:outline-none"
              style={inputStyle}
              min={1}
              max={65535}
              disabled={loading}
            />
            {errors.port && (
              <p className="mt-1 text-xs text-theme-form-error-text">{errors.port}</p>
            )}
          </div>
        </div>

      {/* Database Name */}
      <div>
        <label className="block text-sm font-medium mb-1" style={labelStyle}>
          Database *
        </label>
        <input
          type="text"
          value={formData.database}
          onChange={(e) => setFormData(prev => ({ ...prev, database: e.target.value }))}
          className="w-full px-3 py-2 rounded focus:outline-none"
          style={inputStyle}
          placeholder="mydb"
          disabled={loading}
        />
        {errors.database && (
          <p className="mt-1 text-xs text-theme-form-error-text">{errors.database}</p>
        )}
      </div>

      {/* Credentials */}
      <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1" style={labelStyle}>
              Username *
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
              className="w-full px-3 py-2 rounded focus:outline-none"
              style={inputStyle}
              placeholder={formData.type === 'mssql' ? 'sa' : 'postgres'}
              autoComplete="off"
              disabled={loading}
            />
            {errors.username && (
              <p className="mt-1 text-xs text-theme-form-error-text">{errors.username}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={labelStyle}>
              Password {isEditing ? '(leave blank to keep)' : ''}
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              className="w-full px-3 py-2 rounded focus:outline-none"
              style={inputStyle}
              placeholder={isEditing ? '********' : ''}
              autoComplete="new-password"
              disabled={loading}
            />
          </div>
        </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded transition-colors"
          style={{
            backgroundColor: 'var(--color-modal-btn-cancel-bg)',
            border: '1px solid var(--color-modal-btn-cancel-border)',
            color: 'var(--color-modal-btn-cancel-text)',
          }}
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 rounded transition-opacity flex items-center gap-2"
          style={{
            backgroundColor: 'var(--color-modal-btn-primary-bg)',
            border: '1px solid var(--color-modal-btn-primary-border)',
            color: 'var(--color-modal-btn-primary-text)',
            opacity: loading ? 0.7 : 1,
          }}
          disabled={loading}
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {isEditing ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
};

interface ConnectionListItemProps {
  connection: ConnectionInfo;
  onEdit: (connection: ConnectionInfo) => void;
  onDelete: (connection: ConnectionInfo) => void;
}

const ConnectionListItem: React.FC<ConnectionListItemProps> = ({
  connection,
  onEdit,
  onDelete,
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isServerManaged = connection.owner === 'server';

  return (
    <div 
      className="p-3 rounded flex items-center justify-between"
      style={{
        backgroundColor: 'var(--color-modal-container-bg)',
        border: '1px solid var(--color-modal-container-border)',
      }}
    >
      <div className="flex items-center gap-3 flex-1">
        <Database className="w-5 h-5" style={{ color: 'var(--color-modal-content-text)', opacity: 0.6 }} />
        <div className="flex-1">
          <span className="font-medium" style={{ color: 'var(--color-modal-content-text)' }}>
            {connection.name}
          </span>
          <div className="text-xs opacity-60" style={{ color: 'var(--color-modal-content-text)' }}>
            {DATABASE_TYPE_NAMES[connection.type]} - {connection.host}:{connection.port}/{connection.database}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-1">
        {confirmDelete ? (
          <>
            <span className="text-xs mr-2" style={{ color: 'var(--color-notification-error-text)' }}>
              Delete?
            </span>
            <button
              onClick={() => onDelete(connection)}
              className="p-1.5 rounded hover:bg-theme-status-error-bg"
              title="Confirm delete"
            >
              <Check className="w-4 h-4" style={{ color: 'var(--color-notification-error-text)' }} />
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="p-1.5 rounded hover:opacity-70"
              title="Cancel"
            >
              <AlertCircle className="w-4 h-4" style={{ color: 'var(--color-modal-content-text)' }} />
            </button>
          </>
        ) : (
          <>
            {!isServerManaged && (
              <>
                <button
                  onClick={() => onEdit(connection)}
                  className="p-1.5 rounded hover:opacity-70"
                  title="Edit connection"
                >
                  <Pencil className="w-4 h-4" style={{ color: 'var(--color-modal-content-text)' }} />
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="p-1.5 rounded hover:opacity-70"
                  title="Delete connection"
                >
                  <Trash2 className="w-4 h-4" style={{ color: 'var(--color-modal-content-text)' }} />
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export const ConnectionManager: React.FC = () => {
  const {
    connections,
    loaded,
    loading,
    error,
    encryptionAvailable,
    loadConnections,
    createConnection,
    updateConnection,
    deleteConnection,
    clearError,
  } = useConnectionStore();

  const [showForm, setShowForm] = useState(false);
  const [editingConnection, setEditingConnection] = useState<ConnectionInfo | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    if (!loaded) {
      loadConnections();
    }
  }, [loaded, loadConnections]);

  const handleCreate = async (data: ConnectionFormData) => {
    setFormLoading(true);
    try {
      await createConnection(data as CreateConnectionInput);
      setShowForm(false);
    } catch (err) {
      // Error is set in store
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdate = async (data: ConnectionFormData) => {
    if (!editingConnection) return;
    
    setFormLoading(true);
    try {
      // Only include password if it was changed
      const updateData: UpdateConnectionInput = {
        name: data.name,
        host: data.host,
        port: data.port,
        database: data.database,
        username: data.username,
        ...(data.password ? { password: data.password } : {}),
      };
      
      await updateConnection(editingConnection.id, updateData);
      setEditingConnection(null);
    } catch (err) {
      // Error is set in store
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (connection: ConnectionInfo) => {
    try {
      await deleteConnection(connection.id);
    } catch (err) {
      // Error is set in store
    }
  };

  const handleEdit = (connection: ConnectionInfo) => {
    setEditingConnection(connection);
    setShowForm(false);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingConnection(null);
    clearError();
  };

  // Show form for new connection
  if (showForm) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium" style={{ color: 'var(--color-modal-content-text)' }}>
            New Connection
          </h3>
        </div>
        <ConnectionForm
          onSubmit={handleCreate}
          onCancel={handleCancel}
          loading={formLoading}
        />
        {error && (
          <div className="p-3 rounded flex items-center gap-2" style={{ backgroundColor: 'var(--color-notification-error-bg)' }}>
            <AlertCircle className="w-4 h-4" style={{ color: 'var(--color-notification-error-text)' }} />
            <span className="text-sm" style={{ color: 'var(--color-notification-error-text)' }}>{error}</span>
          </div>
        )}
      </div>
    );
  }

  // Show form for editing connection
  if (editingConnection) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium" style={{ color: 'var(--color-modal-content-text)' }}>
            Edit Connection
          </h3>
        </div>
        <ConnectionForm
          initialData={{
            name: editingConnection.name,
            type: editingConnection.type,
            host: editingConnection.host,
            port: editingConnection.port,
            database: editingConnection.database,
            username: '', // Don't show existing username
            password: '', // Don't show existing password
          }}
          onSubmit={handleUpdate}
          onCancel={handleCancel}
          isEditing
          loading={formLoading}
        />
        {error && (
          <div className="p-3 rounded flex items-center gap-2" style={{ backgroundColor: 'var(--color-notification-error-bg)' }}>
            <AlertCircle className="w-4 h-4" style={{ color: 'var(--color-notification-error-text)' }} />
            <span className="text-sm" style={{ color: 'var(--color-notification-error-text)' }}>{error}</span>
          </div>
        )}
      </div>
    );
  }

  // Show connection list
  return (
    <div className="space-y-4">
      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-medium" style={{ color: 'var(--color-modal-content-text)' }}>
            Database Connections ({connections.length})
          </h3>
          <a
            href="https://docs.sigilweaver.app/user/interface/connections"
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-50 hover:opacity-100 transition-opacity"
            title="Connection documentation"
          >
            <HelpCircle className="w-4 h-4" style={{ color: 'var(--color-modal-content-text)' }} />
          </a>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-3 py-1.5 rounded flex items-center gap-1.5 transition-opacity hover:opacity-80"
          style={{
            backgroundColor: 'var(--color-modal-btn-primary-bg)',
            color: 'var(--color-modal-btn-primary-text)',
          }}
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm">Add Local Connection</span>
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 rounded flex items-center gap-2" style={{ backgroundColor: 'var(--color-notification-error-bg)' }}>
          <AlertCircle className="w-4 h-4" style={{ color: 'var(--color-notification-error-text)' }} />
          <span className="text-sm" style={{ color: 'var(--color-notification-error-text)' }}>{error}</span>
          <button 
            onClick={clearError}
            className="ml-auto text-xs opacity-70 hover:opacity-100"
            style={{ color: 'var(--color-notification-error-text)' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-modal-content-text)' }} />
        </div>
      )}

      {/* Connection list */}
      {!loading && connections.length === 0 && (
        <div 
          className="p-6 rounded text-center"
          style={{
            backgroundColor: 'var(--color-modal-container-bg)',
            border: '1px solid var(--color-modal-container-border)',
          }}
        >
          <Database className="w-10 h-10 mx-auto mb-3 opacity-30" style={{ color: 'var(--color-modal-content-text)' }} />
          <p className="text-sm opacity-60" style={{ color: 'var(--color-modal-content-text)' }}>
            No database connections configured.
          </p>
          <p className="text-xs opacity-40 mt-1" style={{ color: 'var(--color-modal-content-text)' }}>
            Click "Add Connection" to create your first connection.
          </p>
        </div>
      )}

      {!loading && connections.length > 0 && (
        <div className="space-y-4">
          {/* Local Connections */}
          {connections.some(c => c.owner === 'client') && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <h4 className="text-sm font-medium opacity-70" style={{ color: 'var(--color-modal-content-text)' }}>
                  Local Connections
                </h4>
                <span 
                  title={encryptionAvailable 
                    ? "Stored locally. Credentials are encrypted using your operating system's secure storage." 
                    : "Stored locally. Secure storage not available - credentials are encoded but not encrypted."}
                >
                  <Info 
                    className="w-3.5 h-3.5 opacity-40 hover:opacity-70 cursor-help transition-opacity" 
                    style={{ color: 'var(--color-modal-content-text)' }}
                  />
                </span>
              </div>
              <div className="space-y-2">
                {connections
                  .filter(c => c.owner === 'client')
                  .map(connection => (
                    <ConnectionListItem
                      key={connection.id}
                      connection={connection}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Server-Managed Connections */}
          {connections.some(c => c.owner === 'server') && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <h4 className="text-sm font-medium opacity-70" style={{ color: 'var(--color-modal-content-text)' }}>
                  Server-Managed Connections
                </h4>
                <span title="Managed by your administrator. Read-only and cannot be edited.">
                  <Info 
                    className="w-3.5 h-3.5 opacity-40 hover:opacity-70 cursor-help transition-opacity" 
                    style={{ color: 'var(--color-modal-content-text)' }}
                  />
                </span>
              </div>
              <div className="space-y-2">
                {connections
                  .filter(c => c.owner === 'server')
                  .map(connection => (
                    <ConnectionListItem
                      key={connection.id}
                      connection={connection}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default ConnectionManager;
