/**
 * Settings Dialog
 * 
 * Persistent application settings with tabbed interface.
 */

import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '@state/settingsStore';
import { availableThemes } from '../../themes';
import AboutContent from './AboutContent';
import ConnectionManager from './ConnectionManager';

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

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'var(--color-modal-overlay)' }}>
      <div 
        className="rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[80vh] flex flex-col"
        style={{
          backgroundColor: 'var(--color-modal-container-bg)',
          border: '1px solid var(--color-modal-container-border)',
          boxShadow: 'var(--color-modal-container-shadow)',
        }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between p-6"
          style={{
            backgroundColor: 'var(--color-modal-header-bg)',
            borderBottom: '1px solid var(--color-modal-header-border)',
            color: 'var(--color-modal-header-text)',
          }}
        >
          <h2 className="text-xl font-bold">Settings</h2>
          <button
            onClick={onClose}
            className="opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Close"
            style={{ color: 'var(--color-modal-header-text)' }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex" style={{ borderBottom: '1px solid var(--color-modal-header-border)' }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-6 py-3 text-sm font-medium transition-colors"
              style={{
                borderBottom: activeTab === tab.id ? '2px solid var(--color-modal-btn-primary-bg)' : '2px solid transparent',
                color: activeTab === tab.id ? 'var(--color-modal-btn-primary-bg)' : 'var(--color-modal-content-text)',
                opacity: activeTab === tab.id ? 1 : 0.7,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div 
          className="flex-1 overflow-y-auto p-6"
          style={{
            backgroundColor: 'var(--color-modal-content-bg)',
            color: 'var(--color-modal-content-text)',
          }}
        >
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-modal-content-text)' }}>
                  Author Name
                </label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => updateAuthor(e.target.value)}
                  className="w-full px-3 py-2 rounded focus:outline-none"
                  style={{
                    backgroundColor: 'var(--color-modal-container-bg)',
                    border: '1px solid var(--color-modal-container-border)',
                    color: 'var(--color-modal-content-text)',
                  }}
                  placeholder="Your Name"
                />
                <p className="mt-1 text-xs opacity-60">
                  Used as default author in workflow metadata
                </p>
              </div>
            </div>
          )}

          {activeTab === 'connections' && (
            <ConnectionManager />
          )}

          {activeTab === 'backend' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-modal-content-text)' }}>
                  Backend URL
                </label>
                <input
                  type="text"
                  value={backend.url}
                  onChange={(e) => updateBackendUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded focus:outline-none"
                  style={{
                    backgroundColor: 'var(--color-modal-container-bg)',
                    border: '1px solid var(--color-modal-container-border)',
                    color: 'var(--color-modal-content-text)',
                  }}
                  placeholder="http://localhost:8000"
                />
                <p className="mt-1 text-xs opacity-60">
                  Backend API endpoint (restart required after change)
                </p>
              </div>

              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={backend.autoStart}
                    onChange={(e) => updateBackendAutoStart(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm" style={{ color: 'var(--color-modal-content-text)' }}>
                    Auto-start bundled backend
                  </span>
                </label>
                <p className="mt-1 ml-6 text-xs opacity-60">
                  Automatically start the bundled backend server on app launch (full mode only)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-modal-content-text)' }}>
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
                  className="w-full px-3 py-2 rounded focus:outline-none"
                  style={{
                    backgroundColor: 'var(--color-modal-container-bg)',
                    border: '1px solid var(--color-modal-container-border)',
                    color: 'var(--color-modal-content-text)',
                  }}
                  placeholder="100"
                />
                <p className="mt-1 text-xs opacity-60">
                  Number of rows to show in data previews. Server may limit this value. Large previews may slow down the application.
                </p>
              </div>

              <div 
                className="p-4 rounded"
                style={{
                  backgroundColor: 'var(--color-modal-container-bg)',
                  border: '1px solid var(--color-modal-container-border)',
                }}
              >
                <div className="text-xs space-y-1" style={{ color: 'var(--color-modal-content-text)' }}>
                  <div><strong>Status:</strong> <span style={{ color: 'var(--color-notification-success-text)' }}>Connected</span></div>
                  <div><strong>Mode:</strong> Full (bundled backend)</div>
                  <div><strong>Version:</strong> 0.0.0-dev</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-modal-content-text)' }}>
                  Theme
                </label>
                <select
                  value={theme.id}
                  onChange={(e) => updateTheme(e.target.value)}
                  className="w-full px-3 py-2 rounded focus:outline-none"
                  style={{
                    backgroundColor: 'var(--color-modal-container-bg)',
                    border: '1px solid var(--color-modal-container-border)',
                    color: 'var(--color-modal-content-text)',
                  }}
                >
                  {availableThemes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} - {t.description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={ui.snapToGrid}
                    onChange={(e) => updateSnapToGrid(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm" style={{ color: 'var(--color-modal-content-text)' }}>Snap to grid</span>
                </label>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={ui.minimapVisible}
                    onChange={(e) => updateMinimapVisible(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm" style={{ color: 'var(--color-modal-content-text)' }}>Show minimap</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-modal-content-text)' }}>
                  Minimap Position
                </label>
                <select
                  value={ui.minimapPosition}
                  onChange={(e) => updateMinimapPosition(e.target.value as typeof ui.minimapPosition)}
                  className="w-full px-3 py-2 rounded focus:outline-none"
                  style={{
                    backgroundColor: 'var(--color-modal-container-bg)',
                    border: '1px solid var(--color-modal-container-border)',
                    color: 'var(--color-modal-content-text)',
                  }}
                >
                  <option value="top-left">Top Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="bottom-right">Bottom Right</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-modal-content-text)' }}>
                  Edge Style
                </label>
                <select
                  value={ui.edgeStyle}
                  onChange={(e) => updateEdgeStyle(e.target.value as typeof ui.edgeStyle)}
                  className="w-full px-3 py-2 rounded focus:outline-none"
                  style={{
                    backgroundColor: 'var(--color-modal-container-bg)',
                    border: '1px solid var(--color-modal-container-border)',
                    color: 'var(--color-modal-content-text)',
                  }}
                >
                  <option value="bezier">Bezier (curved)</option>
                  <option value="straight">Straight (direct lines)</option>
                  <option value="step">Step (right-angle, sharp)</option>
                  <option value="smoothstep">Smooth Step (right-angle, rounded)</option>
                </select>
                <p className="mt-1 text-xs opacity-60">
                  Style of connection wires between tools
                </p>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <AboutContent />
          )}
        </div>

        {/* Footer */}
        <div 
          className="flex justify-between p-4"
          style={{ borderTop: '1px solid var(--color-modal-header-border)' }}
        >
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded transition-colors"
            style={{
              backgroundColor: 'var(--color-modal-btn-cancel-bg)',
              border: '1px solid var(--color-modal-btn-cancel-border)',
              color: 'var(--color-modal-btn-cancel-text)',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-modal-btn-cancel-bg-hover)';
              e.currentTarget.style.borderColor = 'var(--color-modal-btn-cancel-border-hover)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-modal-btn-cancel-bg)';
              e.currentTarget.style.borderColor = 'var(--color-modal-btn-cancel-border)';
            }}
          >
            Reset to Defaults
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded transition-opacity"
            style={{
              backgroundColor: 'var(--color-modal-btn-primary-bg)',
              border: '1px solid var(--color-modal-btn-primary-border)',
              color: 'var(--color-modal-btn-primary-text)',
            }}
            onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsDialog;
