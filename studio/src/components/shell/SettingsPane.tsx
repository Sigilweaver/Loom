/**
 * Settings Pane
 * 
 * Global application settings displayed in the left pane.
 * Organized into collapsible sections for easy navigation.
 */

import React, { useState } from 'react';
import { useSettingsStore } from '@state/settingsStore';
import { availableThemes } from '../../themes';
import AboutContent from './AboutContent';
import ConnectionManager from './ConnectionManager';
import { Checkbox } from '@components/ui/Checkbox';
import { User, Database, Server, Palette, Info, ChevronDown, ChevronRight } from 'lucide-react';

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
        className="w-full px-4 py-3 flex items-center gap-2 text-sm font-medium hover:bg-theme-surface-hover transition-colors text-left"
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
  
  const toggleSection = (id: string) => {
    setOpenSections(prev => 
      prev.includes(id) 
        ? prev.filter(s => s !== id)
        : [...prev, id]
    );
  };

  const {
    author,
    backend,
    theme,
    ui,
    updateAuthor,
    updateBackendUrl,
    updateBackendAutoStart,
    updateBackendPreviewRows,
    updateTheme,
    updateSnapToGrid,
    updateMinimapVisible,
    updateMinimapPosition,
    updateEdgeStyle,
    resetToDefaults,
  } = useSettingsStore();

  const handleReset = async () => {
    if (confirm('Reset all settings to defaults? This cannot be undone.')) {
      await resetToDefaults();
    }
  };

  return (
    <div className="h-full flex flex-col bg-theme-surface-panel">
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
                className="w-full px-3 py-2 text-sm rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border border-theme-border-primary text-theme-text-primary"
                placeholder="Your Name"
              />
              <p className="mt-1 text-xs text-theme-text-tertiary">
                Default author in workflow metadata
              </p>
            </div>
          </div>
        </Section>

        {/* Connections */}
        <Section
          id="connections"
          title="Connections"
          icon={Database}
          openSections={openSections}
          toggleSection={toggleSection}
        >
          <ConnectionManager />
        </Section>

        {/* Backend */}
        <Section
          id="backend"
          title="Backend"
          icon={Server}
          openSections={openSections}
          toggleSection={toggleSection}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5 text-theme-text-primary">
                Backend URL
              </label>
              <input
                type="text"
                value={backend.url}
                onChange={(e) => updateBackendUrl(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border border-theme-border-primary text-theme-text-primary"
                placeholder="http://localhost:8000"
              />
              <p className="mt-1 text-xs text-theme-text-tertiary">
                Restart required after change
              </p>
            </div>

            <Checkbox
              checked={backend.autoStart}
              onCheckedChange={(checked) => updateBackendAutoStart(checked === true)}
              label="Auto-start bundled backend"
              description="Start backend on app launch (full mode only)"
            />

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
                className="w-full px-3 py-2 text-sm rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border border-theme-border-primary text-theme-text-primary"
                placeholder="100"
              />
            </div>

            <div className="p-3 rounded bg-theme-bg-secondary border border-theme-border-primary">
              <div className="text-xs space-y-1 text-theme-text-primary">
                <div><strong>Status:</strong> <span className="text-theme-status-success-text">Connected</span></div>
                <div><strong>Mode:</strong> Full (bundled backend)</div>
              </div>
            </div>
          </div>
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
              
              <div className="border border-theme-border-primary rounded-lg overflow-hidden">
                {/* Sigilweaver family (Signature/Dark/Light) */}
                {(() => {
                  const isActiveFamily = theme.id === 'sigilweaver' || theme.id === 'dark' || theme.id === 'light';
                  const variants = [
                    { id: 'sigilweaver', label: 'Signature' },
                    { id: 'dark', label: 'Dark' },
                    { id: 'light', label: 'Light' },
                  ] as const;
                  return (
                    <div className="flex items-center px-3 py-2 border-b border-theme-border-secondary">
                      <button
                        onClick={() => updateTheme('sigilweaver')}
                        className={`text-xs flex-1 text-left transition-colors ${
                          isActiveFamily
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
                            className={`px-2 py-0.5 text-xs rounded transition-colors ${
                              theme.id === id
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
                      className={`w-full px-3 py-2 text-left text-xs transition-colors border-b border-theme-border-secondary ${
                        theme.id === t.id
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
                        className={`w-full px-3 py-2 text-left text-xs transition-colors border-b border-theme-border-secondary ${
                          theme.id === t.id
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
                          className={`text-xs flex-1 text-left transition-colors ${
                            isActiveFamily
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
                                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                                  theme.id === id
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
              <h4 className="text-xs font-medium mb-2 text-theme-text-primary">
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
                  className="w-full px-3 py-2 text-sm rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border border-theme-border-primary text-theme-text-primary"
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
                  className="w-full px-3 py-2 text-sm rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border border-theme-border-primary text-theme-text-primary"
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
          className="w-full px-3 py-2 text-xs rounded transition-colors bg-theme-status-error-bg border border-theme-status-error-border text-theme-status-error-text hover:opacity-80"
        >
          Reset All Settings to Defaults
        </button>
      </div>
    </div>
  );
};

export default SettingsPane;
