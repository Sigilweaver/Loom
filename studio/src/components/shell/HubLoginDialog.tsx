/**
 * Hub Login Dialog
 * 
 * Modal dialog for authenticating with Hub when in hub execution mode.
 */

import React, { useId, useState } from 'react';
import { Globe, AlertCircle, Loader2 } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui';
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
  const usernameId = useId();
  const passwordId = useId();

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

      // Always persist the token to settings store so it survives HMR reloads
      // The rememberLogin setting controls whether the token persists across app restarts
      const { useSettingsStore } = await import('../../state/settingsStore');
      await useSettingsStore.getState().updateHubSessionToken(result.token);

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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !loading) onClose(); }}>
      <DialogContent className="max-w-md">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 pr-10 border-b border-theme-border-primary">
          <Globe className="w-5 h-5 text-theme-interactive-accent" aria-hidden />
          <DialogTitle className="text-sm">Login to Hub</DialogTitle>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Hub URL display */}
          <div className="p-3 rounded bg-theme-bg-secondary border border-theme-border-secondary">
            <DialogDescription className="text-xs text-theme-text-tertiary">Connecting to</DialogDescription>
            <div className="text-sm text-theme-text-primary font-mono truncate">
              {hub.url || '(No Hub URL configured)'}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div role="alert" className="flex items-start gap-2 p-3 rounded bg-theme-status-error-bg border border-theme-status-error-border">
              <AlertCircle className="w-4 h-4 text-theme-status-error-text flex-shrink-0 mt-0.5" aria-hidden />
              <span className="text-sm text-theme-status-error-text">{error}</span>
            </div>
          )}

          {/* Username */}
          <div>
            <label htmlFor={usernameId} className="block text-xs font-medium mb-1.5 text-theme-text-primary">
              Username
            </label>
            <input
              id={usernameId}
              type="text"
              autoComplete="username"
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
            <label htmlFor={passwordId} className="block text-xs font-medium mb-1.5 text-theme-text-primary">
              Password
            </label>
            <input
              id={passwordId}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border border-theme-border-primary text-theme-text-primary"
              placeholder="Enter password"
              disabled={loading}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={loading || !hub.url || !username || !password}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default HubLoginDialog;
