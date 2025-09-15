import React from 'react';

export interface BrowserFileWarningProps {
  className?: string;
}

/**
 * Reusable warning component for browser file path limitations
 * Shows when Electron API is not available (browser mode)
 */
export const BrowserFileWarning: React.FC<BrowserFileWarningProps> = ({ 
  className = "" 
}) => {
  // Only show if we're in browser mode (no Electron API)
  if (window.electronAPI?.showOpenDialog) {
    return null;
  }

  return (
    <div className={`p-3 bg-theme-warning/10 border border-theme-warning rounded-md ${className}`}>
      <div className="flex items-start space-x-2">
        <div className="text-theme-warning text-sm">⚠️</div>
        <div className="flex-1 text-xs text-theme-text-secondary">
          <div className="font-medium text-theme-warning mb-1">
            Browser Security Limitation
          </div>
          <div className="space-y-1">
            <p>
              Due to browser security restrictions, Sigilweaver can only access the file name, not the full file path.
            </p>
            <p className="font-medium">
              Any workflow run with only a file name will fail.
            </p>
            <div className="mt-2 text-theme-text-tertiary">
              <strong>Solutions:</strong>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>Use the Electron desktop app for full file access</li>
                <li>Manually paste the complete file path in the input field</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};