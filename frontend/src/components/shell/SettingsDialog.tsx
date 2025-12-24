/**
 * Settings Dialog
 * 
 * Persistent application settings with tabbed interface.
 * Uses Radix UI Dialog and Tabs primitives.
 */

import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '@state/settingsStore';
import { availableThemes } from '../../themes';
import AboutContent from './AboutContent';
import ConnectionManager from './ConnectionManager';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@components/ui/Dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@components/ui/Tabs';
import { Checkbox } from '@components/ui/Checkbox';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
}

type SettingsTab = 'general' | 'connections' | 'backend' | 'appearance' | 'about';

const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose, initialTab = 'general' }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  
  // Sync activeTab when initialTab changes (e.g., opening to a specific tab)
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);
  
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

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'connections', label: 'Connections' },
    { id: 'backend', label: 'Backend' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'about', label: 'About' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh]" showCloseButton={true}>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as SettingsTab)}
          className="flex flex-col flex-1 overflow-hidden"
        >
          {/* Tabs */}
          <TabsList className="px-6 border-b border-theme-border-primary">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="px-6 py-3">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-theme-bg-primary text-theme-text-primary">
            <TabsContent value="general" className="m-0">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2 text-theme-text-primary">
                    Author Name
                  </label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => updateAuthor(e.target.value)}
                    className="w-full px-3 py-2 rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border border-theme-border-primary text-theme-text-primary"
                    placeholder="Your Name"
                  />
                  <p className="mt-1 text-xs text-theme-text-tertiary">
                    Used as default author in workflow metadata
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="connections" className="m-0">
              <ConnectionManager />
            </TabsContent>

            <TabsContent value="backend" className="m-0">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2 text-theme-text-primary">
                    Backend URL
                  </label>
                  <input
                    type="text"
                    value={backend.url}
                    onChange={(e) => updateBackendUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border border-theme-border-primary text-theme-text-primary"
                    placeholder="http://localhost:8000"
                  />
                  <p className="mt-1 text-xs text-theme-text-tertiary">
                    Backend API endpoint (restart required after change)
                  </p>
                </div>

                <Checkbox
                  checked={backend.autoStart}
                  onCheckedChange={(checked) => updateBackendAutoStart(checked === true)}
                  label="Auto-start bundled backend"
                  description="Automatically start the bundled backend server on app launch (full mode only)"
                />

                <div>
                  <label className="block text-sm font-medium mb-2 text-theme-text-primary">
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
                    className="w-full px-3 py-2 rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border border-theme-border-primary text-theme-text-primary"
                    placeholder="100"
                  />
                  <p className="mt-1 text-xs text-theme-text-tertiary">
                    Number of rows to show in data previews. Server may limit this value. Large previews may slow down the application.
                  </p>
                </div>

                <div className="p-4 rounded bg-theme-bg-secondary border border-theme-border-primary">
                  <div className="text-xs space-y-1 text-theme-text-primary">
                    <div><strong>Status:</strong> <span className="text-theme-status-success-text">Connected</span></div>
                    <div><strong>Mode:</strong> Full (bundled backend)</div>
                    <div><strong>Version:</strong> 0.0.0-dev</div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="appearance" className="m-0">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2 text-theme-text-primary">
                    Theme
                  </label>
                  <select
                    value={theme.id}
                    onChange={(e) => updateTheme(e.target.value)}
                    className="w-full px-3 py-2 rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border border-theme-border-primary text-theme-text-primary"
                  >
                    {availableThemes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} - {t.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
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

                <div>
                  <label className="block text-sm font-medium mb-2 text-theme-text-primary">
                    Minimap Position
                  </label>
                  <select
                    value={ui.minimapPosition}
                    onChange={(e) => updateMinimapPosition(e.target.value as typeof ui.minimapPosition)}
                    className="w-full px-3 py-2 rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border border-theme-border-primary text-theme-text-primary"
                  >
                    <option value="top-left">Top Left</option>
                    <option value="top-right">Top Right</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="bottom-right">Bottom Right</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-theme-text-primary">
                    Edge Style
                  </label>
                  <select
                    value={ui.edgeStyle}
                    onChange={(e) => updateEdgeStyle(e.target.value as typeof ui.edgeStyle)}
                    className="w-full px-3 py-2 rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border border-theme-border-primary text-theme-text-primary"
                  >
                    <option value="bezier">Bezier (curved)</option>
                    <option value="straight">Straight (direct lines)</option>
                    <option value="step">Step (right-angle, sharp)</option>
                    <option value="smoothstep">Smooth Step (right-angle, rounded)</option>
                  </select>
                  <p className="mt-1 text-xs text-theme-text-tertiary">
                    Style of connection wires between tools
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="about" className="m-0">
              <AboutContent />
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer */}
        <DialogFooter>
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded transition-colors bg-theme-status-error-bg border border-theme-status-error-border text-theme-status-error-text hover:opacity-80"
          >
            Reset to Defaults
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded transition-opacity bg-theme-interactive-accent border border-theme-interactive-accent text-theme-text-on-accent hover:opacity-90"
          >
            Close
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;
