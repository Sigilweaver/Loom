/**
 * Settings Pane
 * 
 * Global application settings displayed in the left pane.
 * Organized into collapsible sections for easy navigation.
 */

import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '@state/settingsStore';
import { availableThemes } from '../../themes';
import AboutContent from './AboutContent';
import ConnectionManager from './ConnectionManager';
import HubLoginDialog from './HubLoginDialog';
import { Checkbox } from '@components/ui/Checkbox';
import { User, Database, Palette, Info, ChevronDown, ChevronRight, Globe, LogIn, LogOut, RefreshCw, Sparkles, MousePointerClick, MessageSquare, LayoutDashboard } from 'lucide-react';
import type { ExecutionMode } from '../../types/settings';
import { hasHubClient, getHubClient, clearHubClient, initHubClient } from '../../api/hub';
import { triggerHubConnectionsRefresh } from '../../hooks/useAllConnections';
import AISettingsPanel from '../ai/AISettingsPanel';

interface SectionProps {
  id: string;
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  openSections: string[];
  toggleSection: (id: string) => void;
}

const Section: React.FC<SectionProps> = ({ id, title, icon: Icon, children, openSections, toggleSection }) => {
  const isOpen = openSections.includes(id);

  return (
    <div className="border-b border-theme-border-primary last:border-b-0">
      <button
        onClick={() => toggleSection(id)}
        className="flex items-center w-full gap-2 px-4 py-3 text-sm font-medium text-left transition-colors hover:bg-theme-surface-hover"
      >
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-theme-text-tertiary" />
        ) : (
          <ChevronRight className="w-4 h-4 text-theme-text-tertiary" />
        )}
        <Icon className="w-4 h-4 text-theme-text-secondary" />
        <span className="text-theme-text-primary">{title}</span>
      </button>
      {isOpen && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
};

const SettingsPane: React.FC = () => {
  const [openSections, setOpenSections] = useState<string[]>(['general']);
  const [showHubLogin, setShowHubLogin] = useState(false);
  const [hubUser, setHubUser] = useState<{ username: string } | null>(null);
  const [hubConnections, setHubConnections] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [hubConnectionsLoading, setHubConnectionsLoading] = useState(false);

  const toggleSection = (id: string) => {
    setOpenSections(prev =>
      prev.includes(id)
        ? prev.filter(s => s !== id)
        : [...prev, id]
    );
  };

  const {
    author,
    executionMode,
    backend,
    hub,
    theme,
    ui,
    behavior,
    updateAuthor,
    updateExecutionMode,
    updateBackendUrl,
    updateBackendAutoStart,
    updateBackendPreviewRows,
    updateHubUrl,
    updateHubRememberLogin,
    updateHubSessionToken,
    updateTheme,
    updateSnapToGrid,
    updateMinimapVisible,
    updateShowBlockingIndicators,
    updateMinimapPosition,
    updateEdgeStyle,
    updateAutoConnect,
    updateAutoConnectRadius,
    resetToDefaults,
  } = useSettingsStore();

  const {
    comments,
    updateCommentsVisible,
    updateCommentsAlignment,
    updateCommentsMaxWidth,
    updateCommentsMaxHeight,
  } = useSettingsStore();

  const {
    layout,
    updateLayoutAlignment,
    updateLayoutHorizontalSpacing,
    updateLayoutVerticalSpacing,
    updateLayoutGridSnap,
  } = useSettingsStore();

  // Check Hub login status on mount and when mode changes
  // Restore session from persisted token if available
  useEffect(() => {
    const checkHubStatus = async () => {
      if (executionMode === 'hub') {
        // If we have a persisted token but no client, restore it
        if (!hasHubClient() && hub.sessionToken && hub.url) {
          initHubClient({
            url: hub.url,
            sessionToken: hub.sessionToken,
          });
        }

        // Check if we're logged in
        if (hasHubClient()) {
          try {
            const user = await getHubClient().getCurrentUser();
            setHubUser({ username: user.username });
            // Trigger Hub connections to be fetched when session is restored
            triggerHubConnectionsRefresh();
          } catch {
            // Token expired or invalid - clear it
            setHubUser(null);
            clearHubClient();
            if (hub.sessionToken) {
              updateHubSessionToken(null);
            }
          }
        } else {
          setHubUser(null);
        }
      } else {
        setHubUser(null);
      }
    };
    checkHubStatus();
  }, [executionMode, hub.sessionToken, hub.url, updateHubSessionToken]);

  const handleHubLogout = async () => {
    if (hasHubClient()) {
      try {
        await getHubClient().logout();
      } catch {
        // Ignore logout errors
      }
      clearHubClient();
      setHubUser(null);
      // Clear persisted token
      await updateHubSessionToken(null);
    }
  };

  const handleHubLoginSuccess = async () => {
    if (hasHubClient()) {
      try {
        const user = await getHubClient().getCurrentUser();
        setHubUser({ username: user.username });
        // Trigger Hub connections to be fetched now that we're logged in
        triggerHubConnectionsRefresh();
      } catch {
        setHubUser(null);
      }
    }
  };

  const handleReset = async () => {
    if (confirm('Reset all settings to defaults? This cannot be undone.')) {
      await resetToDefaults();
    }
  };

  return (
    <div className="flex flex-col h-full bg-theme-surface-panel">
      {/* Header */}
      <div className="px-4 py-3 border-b border-theme-border-primary bg-theme-surface-elevated">
        <h2 className="text-sm font-semibold text-theme-text-primary">Global Settings</h2>
        <p className="text-xs text-theme-text-tertiary mt-0.5">Application preferences</p>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto">
        {/* General Settings */}
        <Section
          id="general"
          title="General"
          icon={User}
          openSections={openSections}
          toggleSection={toggleSection}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5 text-theme-text-primary">
                Author Name
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => updateAuthor(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border-theme-border-primary text-theme-text-primary"
                placeholder="Your Name"
              />
              <p className="mt-1 text-xs text-theme-text-tertiary">
                Default author in workflow metadata
              </p>
            </div>
          </div>
        </Section>

        {/* Execution */}
        <Section
          id="execution"
          title="Execution"
          icon={Globe}
          openSections={openSections}
          toggleSection={toggleSection}
        >
          <div className="space-y-4">
            {/* Execution Mode Selector */}
            <div>
              <label className="block text-xs font-medium mb-1.5 text-theme-text-primary">
                Execution Mode
              </label>
              <div className="flex overflow-hidden border rounded border-theme-border-primary">
                {([
                  { id: 'bundled', label: 'Bundled' },
                  { id: 'external', label: 'External' },
                  { id: 'hub', label: 'Hub' },
                ] as const).map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => updateExecutionMode(id as ExecutionMode)}
                    className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${executionMode === id
                        ? 'bg-theme-interactive-accent text-white'
                        : 'bg-theme-bg-secondary text-theme-text-secondary hover:bg-theme-bg-tertiary'
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-theme-text-tertiary">
                {executionMode === 'bundled' && 'Use bundled server (desktop mode)'}
                {executionMode === 'external' && 'Connect to external server directly'}
                {executionMode === 'hub' && 'Authenticate via Hub for managed credentials'}
              </p>
            </div>

            {/* Hub-specific settings */}
            {executionMode === 'hub' && (
              <>
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-theme-text-primary">
                    Hub URL
                  </label>
                  <input
                    type="text"
                    value={hub.url}
                    onChange={(e) => updateHubUrl(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border-theme-border-primary text-theme-text-primary"
                    placeholder="https://hub.example.com"
                  />
                </div>
                <Checkbox
                  checked={hub.rememberLogin}
                  onCheckedChange={(checked) => updateHubRememberLogin(checked === true)}
                  label="Remember login"
                  description="Stay logged in between sessions"
                />
                <div className="p-3 border rounded bg-theme-bg-secondary border-theme-border-primary">
                  <div className="space-y-2 text-xs text-theme-text-primary">
                    <div>
                      <strong>Status:</strong>{' '}
                      {hubUser ? (
                        <span className="text-theme-status-success-text">Connected as {hubUser.username}</span>
                      ) : (
                        <span className="text-theme-text-tertiary">Not connected</span>
                      )}
                    </div>
                    {hubUser ? (
                      <button
                        onClick={handleHubLogout}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-theme-border-primary text-theme-text-secondary hover:bg-theme-surface-hover transition-colors"
                      >
                        <LogOut className="w-3 h-3" />
                        Logout
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowHubLogin(true)}
                        disabled={!hub.url}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-theme-interactive-accent text-white hover:bg-theme-interactive-accent-hover transition-colors disabled:opacity-50"
                      >
                        <LogIn className="w-3 h-3" />
                        Login to Hub
                      </button>
                    )}
                    {!hubUser && (
                      <p className="text-theme-text-tertiary">
                        Login required. Hub provides secure credential management.
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Bundled/External specific settings */}
            {(executionMode === 'bundled' || executionMode === 'external') && (
              <>
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-theme-text-primary">
                    Server URL
                  </label>
                  <input
                    type="text"
                    value={backend.url}
                    onChange={(e) => updateBackendUrl(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border-theme-border-primary text-theme-text-primary"
                    placeholder="http://localhost:25811"
                  />
                  <p className="mt-1 text-xs text-theme-text-tertiary">
                    Restart required after change
                  </p>
                </div>

                {executionMode === 'bundled' && (
                  <Checkbox
                    checked={backend.autoStart}
                    onCheckedChange={(checked) => updateBackendAutoStart(checked === true)}
                    label="Auto-start bundled server"
                    description="Start server on app launch (desktop mode only)"
                  />
                )}

                <div>
                  <label className="block text-xs font-medium mb-1.5 text-theme-text-primary">
                    Preview Rows
                  </label>
                  <input
                    type="number"
                    value={backend.previewRows}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      if (!isNaN(value) && value > 0) {
                        updateBackendPreviewRows(value);
                      }
                    }}
                    min={1}
                    className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border-theme-border-primary text-theme-text-primary"
                    placeholder="100"
                  />
                </div>

                <div className="p-3 border rounded bg-theme-bg-secondary border-theme-border-primary">
                  <div className="space-y-1 text-xs text-theme-text-primary">
                    <div><strong>Status:</strong> <span className="text-theme-status-success-text">Connected</span></div>
                    <div><strong>Mode:</strong> {executionMode === 'bundled' ? 'Bundled server' : 'External server'}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </Section>

        {/* Connections - Available in all modes */}
        <Section
          id="connections"
          title="Connections"
          icon={Database}
          openSections={openSections}
          toggleSection={toggleSection}
        >
          {/* Hub Connections (when in Hub mode and logged in) */}
          {executionMode === 'hub' && hubUser && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-theme-text-primary">Hub Connections</span>
                <button
                  onClick={async () => {
                    if (hasHubClient()) {
                      setHubConnectionsLoading(true);
                      try {
                        const conns = await getHubClient().listConnections();
                        setHubConnections(conns.map(c => ({ id: c.id, name: c.name, type: c.type })));
                      } catch (e) {
                        console.error('Failed to load Hub connections:', e);
                      } finally {
                        setHubConnectionsLoading(false);
                      }
                    }
                  }}
                  disabled={hubConnectionsLoading}
                  className="p-1 transition-colors rounded hover:bg-theme-surface-hover text-theme-text-tertiary hover:text-theme-text-secondary disabled:opacity-50"
                  title="Refresh Hub connections"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${hubConnectionsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              {hubConnections.length === 0 ? (
                <p className="text-xs text-theme-text-tertiary">
                  No Hub connections available. Click refresh to load.
                </p>
              ) : (
                <div className="space-y-1">
                  {hubConnections.map(conn => (
                    <div
                      key={conn.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded bg-theme-bg-secondary text-xs"
                    >
                      <Database className="w-3 h-3 text-theme-text-tertiary" />
                      <span className="text-theme-text-primary flex-1">{conn.name}</span>
                      <span className="text-theme-text-tertiary">({conn.type})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Local Connections */}
          <ConnectionManager showHeader={executionMode === 'hub' && !!hubUser} />

          {executionMode === 'hub' && !hubUser && (
            <p className="mt-3 text-xs text-theme-text-tertiary">
              Login to Hub to access Hub-managed connections.
            </p>
          )}
        </Section>

        {/* Appearance */}
        <Section
          id="appearance"
          title="Appearance"
          icon={Palette}
          openSections={openSections}
          toggleSection={toggleSection}
        >
          <div className="space-y-4">
            {/* Theme Selection */}
            <div>
              <label className="block text-xs font-medium mb-1.5 text-theme-text-primary">
                Theme
              </label>

              <div className="overflow-hidden border rounded-lg border-theme-border-primary">
                {/* Sigilweaver family (Signature/Dark/Light) */}
                {(() => {
                  const isActiveFamily = theme.id === 'sigilweaver-signature' || theme.id === 'dark' || theme.id === 'light';
                  const variants = [
                    { id: 'sigilweaver-signature', label: 'Signature' },
                    { id: 'dark', label: 'Dark' },
                    { id: 'light', label: 'Light' },
                  ] as const;
                  return (
                    <div className="flex items-center px-3 py-2 border-b border-theme-border-secondary">
                      <button
                        onClick={() => updateTheme('sigilweaver-signature')}
                        className={`text-xs flex-1 text-left transition-colors ${isActiveFamily
                            ? 'text-theme-interactive-accent font-medium'
                            : 'text-theme-text-primary hover:text-theme-interactive-accent'
                          }`}
                      >
                        Sigilweaver
                      </button>
                      <div className="flex gap-1">
                        {variants.map(({ id, label }) => (
                          <button
                            key={id}
                            onClick={() => updateTheme(id)}
                            className={`px-2 py-0.5 text-xs rounded transition-colors ${theme.id === id
                                ? 'bg-theme-interactive-accent text-white font-medium'
                                : 'bg-theme-bg-tertiary hover:bg-theme-bg-secondary text-theme-text-secondary'
                              }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* High Contrast */}
                {(() => {
                  const t = availableThemes.find(th => th.id === 'high-contrast')!;
                  return (
                    <button
                      key={t.id}
                      onClick={() => updateTheme(t.id)}
                      className={`w-full px-3 py-2 text-left text-xs transition-colors border-b border-theme-border-secondary ${theme.id === t.id
                          ? 'bg-theme-interactive-accent/10 text-theme-interactive-accent font-medium'
                          : 'hover:bg-theme-bg-secondary text-theme-text-primary'
                        }`}
                    >
                      <span>{t.name}</span>
                      {theme.id === t.id && (
                        <span className="ml-2 opacity-70">(active)</span>
                      )}
                    </button>
                  );
                })()}

                {/* Extended themes (ordered by popularity) */}
                {([
                  // Single themes and families mixed by popularity
                  { type: 'single' as const, id: 'dracula' },
                  { type: 'family' as const, name: 'GitHub', ids: ['github-dark', 'github-light'], defaultId: 'github-dark', labels: ['Dark', 'Light'] },
                  { type: 'family' as const, name: 'One', ids: ['one-dark', 'one-light'], defaultId: 'one-dark', labels: ['Dark', 'Light'] },
                  { type: 'family' as const, name: 'Nord', ids: ['nord', 'nord-light'], defaultId: 'nord', labels: ['Polar Night', 'Snow Storm'] },
                  { type: 'single' as const, id: 'monokai' },
                  { type: 'family' as const, name: 'Gruvbox', ids: ['gruvbox-dark', 'gruvbox-light'], defaultId: 'gruvbox-dark', labels: ['Dark', 'Light'] },
                  { type: 'family' as const, name: 'Catppuccin', ids: ['catppuccin-mocha', 'catppuccin-latte'], defaultId: 'catppuccin-mocha', labels: ['Mocha', 'Latte'] },
                  { type: 'family' as const, name: 'Tokyo Night', ids: ['tokyo-night', 'tokyo-night-light'], defaultId: 'tokyo-night', labels: ['Night', 'Day'] },
                  { type: 'family' as const, name: 'Solarized', ids: ['solarized-dark', 'solarized-light'], defaultId: 'solarized-dark', labels: ['Dark', 'Light'] },
                  { type: 'single' as const, id: 'material-palenight' },
                  { type: 'family' as const, name: 'Rose Pine', ids: ['rose-pine', 'rose-pine-dawn'], defaultId: 'rose-pine', labels: ['Moon', 'Dawn'] },
                  { type: 'single' as const, id: 'night-owl' },
                  { type: 'single' as const, id: 'ayu-mirage' },
                  { type: 'single' as const, id: 'cobalt2' },
                  { type: 'single' as const, id: 'synthwave84' },
                ]).map((item) => {
                  if (item.type === 'single') {
                    const t = availableThemes.find(th => th.id === item.id)!;
                    return (
                      <button
                        key={item.id}
                        onClick={() => updateTheme(item.id)}
                        className={`w-full px-3 py-2 text-left text-xs transition-colors border-b border-theme-border-secondary ${theme.id === t.id
                            ? 'bg-theme-interactive-accent/10 text-theme-interactive-accent font-medium'
                            : 'hover:bg-theme-bg-secondary text-theme-text-primary'
                          }`}
                      >
                        <span>{t.name}</span>
                        {theme.id === t.id && (
                          <span className="ml-2 opacity-70">(active)</span>
                        )}
                      </button>
                    );
                  } else {
                    const isActiveFamily = item.ids.includes(theme.id);
                    return (
                      <div
                        key={item.name}
                        className="flex items-center px-3 py-2 border-b border-theme-border-secondary"
                      >
                        <button
                          onClick={() => updateTheme(item.defaultId)}
                          className={`text-xs flex-1 text-left transition-colors ${isActiveFamily
                              ? 'text-theme-interactive-accent font-medium'
                              : 'text-theme-text-primary hover:text-theme-interactive-accent'
                            }`}
                        >
                          {item.name}
                        </button>
                        <div className="flex gap-1">
                          {item.ids.map((id, idx) => {
                            const t = availableThemes.find(th => th.id === id);
                            if (!t) return null;
                            const label = item.labels[idx];
                            return (
                              <button
                                key={id}
                                onClick={() => updateTheme(id)}
                                className={`px-2 py-0.5 text-xs rounded transition-colors ${theme.id === id
                                    ? 'bg-theme-interactive-accent text-white font-medium'
                                    : 'bg-theme-bg-tertiary hover:bg-theme-bg-secondary text-theme-text-secondary'
                                  }`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
            </div>

            {/* Canvas Options */}
            <div className="pt-3 border-t border-theme-border-primary">
              <h4 className="mb-2 text-xs font-medium text-theme-text-primary">
                Canvas
              </h4>
              <div className="space-y-2">
                <Checkbox
                  checked={ui.snapToGrid}
                  onCheckedChange={(checked) => updateSnapToGrid(checked === true)}
                  label="Snap to grid"
                />

                <Checkbox
                  checked={ui.minimapVisible}
                  onCheckedChange={(checked) => updateMinimapVisible(checked === true)}
                  label="Show minimap"
                />

                <Checkbox
                  checked={ui.showBlockingIndicators}
                  onCheckedChange={(checked) => updateShowBlockingIndicators(checked === true)}
                  label="Show blocking indicators"
                />
              </div>
            </div>

            {/* Minimap & Edge Options */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1.5 text-theme-text-primary">
                  Minimap Position
                </label>
                <select
                  value={ui.minimapPosition}
                  onChange={(e) => updateMinimapPosition(e.target.value as typeof ui.minimapPosition)}
                  className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border-theme-border-primary text-theme-text-primary"
                >
                  <option value="top-left">Top Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="bottom-right">Bottom Right</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5 text-theme-text-primary">
                  Edge Style
                </label>
                <select
                  value={ui.edgeStyle}
                  onChange={(e) => updateEdgeStyle(e.target.value as typeof ui.edgeStyle)}
                  className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border-theme-border-primary text-theme-text-primary"
                >
                  <option value="bezier">Bezier (curved)</option>
                  <option value="straight">Straight</option>
                  <option value="step">Step (sharp)</option>
                  <option value="smoothstep">Smooth Step</option>
                </select>
              </div>
            </div>
          </div>
        </Section>

        {/* Behavior */}
        <Section
          id="behavior"
          title="Behavior"
          icon={MousePointerClick}
          openSections={openSections}
          toggleSection={toggleSection}
        >
          <div className="space-y-4">
            <Checkbox
              checked={behavior.autoConnect}
              onCheckedChange={(checked) => updateAutoConnect(checked === true)}
              label="Auto-connect on drop"
              description="Automatically wire new tools to the nearest compatible tool when dropped onto the canvas"
            />

            {behavior.autoConnect && (
              <div>
                <label className="block text-xs font-medium mb-1.5 text-theme-text-primary">
                  Detection radius
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={100}
                    max={600}
                    step={50}
                    value={behavior.autoConnectRadius}
                    onChange={(e) => updateAutoConnectRadius(Number(e.target.value))}
                    className="flex-1 accent-theme-interactive-accent"
                  />
                  <span className="text-xs tabular-nums text-theme-text-secondary w-12 text-right">
                    {behavior.autoConnectRadius}px
                  </span>
                </div>
                <p className="mt-1 text-xs text-theme-text-tertiary">
                  How close a tool must be to auto-connect
                </p>
              </div>
            )}
          </div>
        </Section>

        {/* Comments */}
        <Section
          id="comments"
          title="Comments"
          icon={MessageSquare}
          openSections={openSections}
          toggleSection={toggleSection}
        >
          <div className="space-y-4">
            <Checkbox
              checked={comments.visible}
              onCheckedChange={(checked) => updateCommentsVisible(checked === true)}
              label="Show comments on canvas"
              description="Display auto-generated or custom comments below each tool"
            />

            {comments.visible && (
              <>
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-theme-text-primary">
                    Text Alignment
                  </label>
                  <div className="flex overflow-hidden border rounded border-theme-border-primary">
                    {([
                      { id: 'left', label: 'Left' },
                      { id: 'center', label: 'Center' },
                      { id: 'right', label: 'Right' },
                    ] as const).map(({ id, label }) => (
                      <button
                        key={id}
                        onClick={() => updateCommentsAlignment(id)}
                        className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${comments.alignment === id
                            ? 'bg-theme-interactive-accent text-white'
                            : 'bg-theme-bg-secondary text-theme-text-secondary hover:bg-theme-bg-tertiary'
                          }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5 text-theme-text-primary">
                    Max Width
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={80}
                      max={300}
                      step={10}
                      value={comments.maxWidth}
                      onChange={(e) => updateCommentsMaxWidth(Number(e.target.value))}
                      className="flex-1 accent-theme-interactive-accent"
                    />
                    <span className="text-xs tabular-nums text-theme-text-secondary w-12 text-right">
                      {comments.maxWidth}px
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5 text-theme-text-primary">
                    Max Height
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={16}
                      max={120}
                      step={4}
                      value={comments.maxHeight}
                      onChange={(e) => updateCommentsMaxHeight(Number(e.target.value))}
                      className="flex-1 accent-theme-interactive-accent"
                    />
                    <span className="text-xs tabular-nums text-theme-text-secondary w-12 text-right">
                      {comments.maxHeight}px
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </Section>

        {/* Layout */}
        <Section
          id="layout"
          title="Auto Layout"
          icon={LayoutDashboard}
          openSections={openSections}
          toggleSection={toggleSection}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5 text-theme-text-primary">
                Alignment
              </label>
              <div className="flex overflow-hidden border rounded border-theme-border-primary">
                {([
                  { id: 'upstream', label: 'Upstream' },
                  { id: 'balanced', label: 'Balanced' },
                  { id: 'downstream', label: 'Downstream' },
                ] as const).map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => updateLayoutAlignment(id)}
                    className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                      layout.alignment === id
                        ? 'bg-theme-interactive-accent text-white'
                        : 'bg-theme-bg-secondary text-theme-text-secondary hover:bg-theme-bg-tertiary'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-theme-text-tertiary">
                {layout.alignment === 'upstream' && 'Align tools with their inputs - keeps linear chains straight'}
                {layout.alignment === 'balanced' && 'Center tools between inputs and outputs'}
                {layout.alignment === 'downstream' && 'Align tools with their outputs'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 text-theme-text-primary">
                Horizontal Spacing
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={160}
                  max={500}
                  step={20}
                  value={layout.horizontalSpacing}
                  onChange={(e) => updateLayoutHorizontalSpacing(Number(e.target.value))}
                  className="flex-1 accent-theme-interactive-accent"
                />
                <span className="text-xs tabular-nums text-theme-text-secondary w-12 text-right">
                  {layout.horizontalSpacing}px
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 text-theme-text-primary">
                Vertical Spacing
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={60}
                  max={300}
                  step={10}
                  value={layout.verticalSpacing}
                  onChange={(e) => updateLayoutVerticalSpacing(Number(e.target.value))}
                  className="flex-1 accent-theme-interactive-accent"
                />
                <span className="text-xs tabular-nums text-theme-text-secondary w-12 text-right">
                  {layout.verticalSpacing}px
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 text-theme-text-primary">
                Grid Snap
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={40}
                  step={5}
                  value={layout.gridSnap}
                  onChange={(e) => updateLayoutGridSnap(Number(e.target.value))}
                  className="flex-1 accent-theme-interactive-accent"
                />
                <span className="text-xs tabular-nums text-theme-text-secondary w-12 text-right">
                  {layout.gridSnap === 0 ? 'Off' : `${layout.gridSnap}px`}
                </span>
              </div>
              <p className="mt-1 text-xs text-theme-text-tertiary">
                Snap positions to a pixel grid after layout
              </p>
            </div>
          </div>
        </Section>

        {/* AI */}
        <Section
          id="ai"
          title="AI"
          icon={Sparkles}
          openSections={openSections}
          toggleSection={toggleSection}
        >
          <AISettingsPanel />
        </Section>

        {/* About */}
        <Section
          id="about"
          title="About"
          icon={Info}
          openSections={openSections}
          toggleSection={toggleSection}
        >
          <AboutContent />
        </Section>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-theme-border-primary bg-theme-surface-elevated">
        <button
          onClick={handleReset}
          className="w-full px-3 py-2 text-xs transition-colors border rounded bg-theme-status-error-bg border-theme-status-error-border text-theme-status-error-text hover:opacity-80"
        >
          Reset All Settings to Defaults
        </button>
      </div>

      {/* Hub Login Dialog */}
      <HubLoginDialog
        isOpen={showHubLogin}
        onClose={() => setShowHubLogin(false)}
        onSuccess={handleHubLoginSuccess}
      />
    </div>
  );
};

export default SettingsPane;
