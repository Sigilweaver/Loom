/**
 * Hub Login Dialog
 * 
 * Modal dialog for authenticating with Hub when in hub execution mode.
 */

import React, { useState } from 'react';
import { X, Globe, AlertCircle, Loader2 } from 'lucide-react';
import { HubError, initHubClient, clearHubClient } from '../../api/hub';
import { useSettingsStore } from '../../state/settingsStore';

interface HubLoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const HubLoginDialog: React.FC<HubLoginDialogProps> = ({ isOpen, onClose, onSuccess }) => {
  const { hub } = useSettingsStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Initialize Hub client with the configured URL
      const client = initHubClient({
        url: hub.url,
        sessionToken: null,
      });

      // Attempt login
      const result = await client.login(username, password);

      // If rememberLogin is enabled, persist the token
      if (hub.rememberLogin) {
        const { useSettingsStore } = await import('../../state/settingsStore');
        await useSettingsStore.getState().updateHubSessionToken(result.token);
      }

      // Success - close dialog and notify parent
      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof HubError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Login failed');
      }
      // Clear the failed client
      clearHubClient();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50" 
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="relative w-full max-w-md bg-theme-surface-panel border border-theme-border-primary rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-theme-border-primary">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-theme-interactive-accent" />
            <h2 className="text-sm font-semibold text-theme-text-primary">Login to Hub</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-theme-surface-hover transition-colors"
          >
            <X className="w-4 h-4 text-theme-text-tertiary" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Hub URL display */}
          <div className="p-3 rounded bg-theme-bg-secondary border border-theme-border-secondary">
            <div className="text-xs text-theme-text-tertiary">Connecting to</div>
            <div className="text-sm text-theme-text-primary font-mono truncate">
              {hub.url || '(No Hub URL configured)'}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded bg-theme-status-error-bg border border-theme-status-error-border">
              <AlertCircle className="w-4 h-4 text-theme-status-error-text flex-shrink-0 mt-0.5" />
              <span className="text-sm text-theme-status-error-text">{error}</span>
            </div>
          )}

          {/* Username */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-theme-text-primary">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border border-theme-border-primary text-theme-text-primary"
              placeholder="Enter username"
              autoFocus
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-theme-text-primary">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border border-theme-border-primary text-theme-text-primary"
              placeholder="Enter password"
              disabled={loading}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm rounded border border-theme-border-primary text-theme-text-secondary hover:bg-theme-surface-hover transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !hub.url || !username || !password}
              className="px-4 py-2 text-sm rounded bg-theme-interactive-accent text-white hover:bg-theme-interactive-accent-hover transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HubLoginDialog;
